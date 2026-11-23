import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createDatabase, type Database } from '../database/client';
import type { SqlPool, SqlResult } from '../database/types';
import { decrypt, encrypt, settings } from './security';

let postgres: PGlite;
let db: Database;
let service: typeof import('./service');
let route: typeof import('../../app/api/integrations/facebook/[...path]/route');
const originalFetch = globalThis.fetch;
let calls: URL[] = [];
let pagesAfter = false;
let deniedPage = false;
let failLeadBatch = false;
let pageRequests = 0;
let pauseToken: (() => Promise<void>) | undefined;
const ownerA = JSON.stringify(['company-a', 'user-a']);
const ownerB = JSON.stringify(['company-b', 'user-b']);
const app = { appId: '123456', appSecret: 'test-app-secret' };
const originalEnv = { ...process.env };
const globalDb = globalThis as unknown as { soft7Database?: Database };
const previousDb = globalDb.soft7Database;

before(async () => {
  process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
  process.env.FACEBOOK_REDIRECT_URI = 'https://dashboard.example/api/integrations/facebook/oauth/callback';
  process.env.FACEBOOK_APP_ID = app.appId;
  process.env.FACEBOOK_APP_SECRET = app.appSecret;
  process.env.FACEBOOK_GRAPH_VERSION = 'v25.0';
  process.env.DATABASE_URL = 'postgresql://unused/test';
  process.env.SOCKET_AUTH_API_URL = 'http://session.example/v1/auth/socket-session';
  postgres = new PGlite();
  await postgres.exec(await readFile(new URL('../../../scripts/database/facebook.sql', import.meta.url), 'utf8'));
  const query = async (sql: string, values: unknown[] = []): Promise<SqlResult> => {
    const result = await postgres.query<Record<string, unknown>>(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  const pool: SqlPool = { query, connect: async () => ({ query, release() {} }), end: async () => {} };
  db = createDatabase(pool, 'public', pool);
  globalDb.soft7Database = db;
  service = await import('./service');
  route = await import('../../app/api/integrations/facebook/[...path]/route');
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input)); calls.push(url);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.hostname === 'session.example') {
      if (!init?.headers || (init.headers as Record<string, string>).Authorization !== `Bearer ${sessionToken}`) return json({ success: false }, 401);
      return json({ success: true, data: { userId: 'user-a', companyId: 'company-a' } });
    }
    assert.equal(url.hostname, 'graph.facebook.com');
    if (url.pathname.endsWith('/oauth/access_token')) {
      assert.equal(init?.method, 'POST');
      assert.equal(url.searchParams.has('client_secret'), false);
      if (pauseToken) await pauseToken();
      return json({ access_token: 'private-facebook-user-token', expires_in: 3600 });
    }
    assert.ok((init?.headers as Record<string, string>).Authorization?.startsWith('Bearer '));
    assert.ok(url.searchParams.has('appsecret_proof'));
    if (url.pathname.endsWith('/me')) return json({ id: '999', name: 'Facebook User' });
    if (url.pathname.endsWith('/me/accounts')) {
      pageRequests++;
      if (pagesAfter && !url.searchParams.has('after')) return json({ data: [{ id: '111', name: 'First Page', access_token: 'private-page-one-token' }], paging: { next: 'https://evil.example/untrusted', cursors: { after: 'second-page' } } });
      return json({ data: [{ id: '222', name: 'Second Page', access_token: 'private-page-two-token' }] });
    }
    if (url.pathname.endsWith('/222/leadgen_forms')) {
      if (deniedPage) return json({ error: { code: 200, message: 'DO NOT expose private-page-two-token' } }, 403);
      return json({ data: [{ id: '333', name: 'Lead Form', status: 'ACTIVE', leads_count: 2 }, { id: '444', name: 'Other Form', status: 'ACTIVE', leads_count: 0 }] });
    }
    if (url.pathname.endsWith('/333/leads')) {
      if (failLeadBatch) return json({ error: { code: 190 } }, 400);
      const second = url.searchParams.has('after');
      return json({ data: [{ id: second ? 'lead-2' : 'lead-1', created_time: '2026-10-29T10:00:00+0000', field_data: [{ name: 'full_name', values: ['Test Lead'] }, { name: 'email', values: ['test@example.invalid'] }] }],
        ...(!second ? { paging: { next: 'https://evil.example/untrusted', cursors: { after: 'next-lead-page' } } } : {}),
      });
    }
    throw new Error(`Unexpected mocked Meta endpoint: ${url.pathname}`);
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = originalFetch;
  globalDb.soft7Database = previousDb;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  await postgres?.close();
});

const sessionToken = `test.${Buffer.from(JSON.stringify({ userId: 'user-a', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
const req = (path: string, method = 'GET', body?: unknown, token = sessionToken) => new NextRequest(`https://dashboard.example/api/integrations/facebook/${path}`, {
  method, headers: { Authorization: `Bearer ${token}`, Origin: 'https://dashboard.example', ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test('encrypted tokens are confidential, randomized, and tamper-evident', () => {
  const first = encrypt({ token: 'secret' }), second = encrypt({ token: 'secret' });
  assert.notEqual(first, second);
  assert.equal(first.includes('secret'), false);
  assert.deepEqual(decrypt(first), { token: 'secret' });
  const parts = first.split('.');
  const altered = Buffer.from(parts[2], 'base64url'); altered[0] ^= 1; parts[2] = altered.toString('base64url');
  assert.throws(() => decrypt(parts.join('.')));
});

test('configuration rejects insecure or incorrect OAuth callbacks', () => {
  const previous = process.env.FACEBOOK_REDIRECT_URI;
  for (const uri of ['http://dashboard.example/api/integrations/facebook/oauth/callback', 'https://dashboard.example/wrong', 'https://dashboard.example/api/integrations/facebook/oauth/callback?extra=1']) {
    process.env.FACEBOOK_REDIRECT_URI = uri;
    assert.throws(() => settings());
  }
  process.env.FACEBOOK_REDIRECT_URI = previous;
});

test('forged dashboard sessions cannot read or change Facebook connections', async () => {
  const response = await route.GET(req('connection', 'GET', undefined, 'forged'), context('connection'));
  assert.equal(response.status, 401);
  assert.equal((await db.execute('SELECT * FROM dashboard_facebook_connections')).rows.length, 0);
});

test('middleware lets the state-authenticated callback and bearer-authenticated API reach their handlers', async () => {
  const { middleware } = await import('../../middleware');
  for (const path of ['oauth/callback?state=example', 'connection']) {
    const response = await middleware(new NextRequest(`https://dashboard.example/api/integrations/facebook/${path}`));
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
});

test('OAuth start returns a browser binding cookie and does not expose credentials', async () => {
  const response = await route.POST(req('oauth/start', 'POST', app), context('oauth/start'));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(response.headers.get('set-cookie')?.includes('HttpOnly'));
  assert.ok(response.headers.get('set-cookie')?.includes('Secure'));
  assert.ok(response.headers.get('set-cookie')?.includes('SameSite=lax'));
  assert.equal(JSON.stringify(result).includes(app.appSecret), false);
  const url = new URL(result.data.authorization_url);
  assert.equal(url.origin, 'https://www.facebook.com');
  assert.ok(url.searchParams.get('state'));
  assert.ok(url.searchParams.get('scope')?.includes('leads_retrieval'));
});

test('OAuth rejects another browser and invalid state before contacting Meta', async () => {
  const attempt = await service.startOAuth(ownerA, app);
  const state = new URL(attempt.authorization_url).searchParams.get('state')!;
  const before = calls.length;
  await assert.rejects(service.finishOAuth(state, 'wrong-browser', 'code', false), /another browser/);
  await assert.rejects(service.finishOAuth('forged-state', attempt.browser, 'code', false), /another browser/);
  assert.equal(calls.length, before);
});

test('denied consent and expired attempts produce actionable status without connecting', async () => {
  const attempt = await service.startOAuth(ownerA, app);
  const state = new URL(attempt.authorization_url).searchParams.get('state')!;
  await assert.rejects(service.finishOAuth(state, attempt.browser, null, true), /declined/);
  assert.equal((await service.oauthStatus(ownerA, attempt.attempt_id)).status, 'error');
  assert.equal((await service.connectionStatus(ownerA)).connected, false);
  const expired = await service.startOAuth(ownerA, app);
  await db.execute("UPDATE dashboard_facebook_oauth_attempts SET expires_at=now()-interval '1 minute' WHERE id=$1", [expired.attempt_id]);
  await assert.rejects(service.finishOAuth(new URL(expired.authorization_url).searchParams.get('state')!, expired.browser, 'code', false), /expired/);
  assert.equal((await service.oauthStatus(ownerA, expired.attempt_id)).status, 'error');
});

test('successful callback persists encrypted credentials once and respects tenant boundaries', async () => {
  const attempt = await service.startOAuth(ownerA, app), state = new URL(attempt.authorization_url).searchParams.get('state')!;
  await service.finishOAuth(state, attempt.browser, 'code', false);
  assert.equal((await service.oauthStatus(ownerA, attempt.attempt_id)).status, 'connected');
  await assert.rejects(service.finishOAuth(state, attempt.browser, 'code', false), /expired|browser/);
  const raw = await service.connection(ownerA);
  assert.equal(raw?.credentials.includes('private-facebook'), false);
  assert.equal(JSON.stringify(await service.connectionStatus(ownerA)).includes('token'), false);
  assert.equal((await service.connectionStatus(ownerB)).connected, false);
  await assert.rejects(service.oauthStatus(ownerB, attempt.attempt_id), /not found/);
});

test('Page pagination uses trusted Graph endpoints and never exposes Page access tokens', async () => {
  pagesAfter = true; pageRequests = 0;
  const pages = await service.listPages(ownerA);
  assert.equal(pageRequests, 2);
  assert.deepEqual(pages.map(p => p.id), ['111', '222']);
  assert.equal(JSON.stringify(pages).includes('private-page'), false);
  assert.equal(calls.some(url => url.hostname === 'evil.example'), false);
  pagesAfter = false;
});

test('selection rejects unauthorized Pages and forms, and sanitizes provider errors', async () => {
  await assert.rejects(service.saveSelection(ownerA, '999999', '333'), /not available/);
  await assert.rejects(service.saveSelection(ownerA, '222', '999999'), /does not belong/);
  deniedPage = true;
  await assert.rejects(service.listForms(ownerA, '222'), error => {
    assert.equal(String(error).includes('private-page'), false);
    assert.match(String(error), /denied access/); return true;
  });
  deniedPage = false;
  assert.equal((await service.saveSelection(ownerA, '222', '333')).connection?.form_id, '333');
});

test('paginated sync persists partial progress, resumes safely, and skips duplicate lead IDs', async () => {
  const first = await service.syncLeads(ownerA);
  assert.equal(first.imported, 1); assert.equal(first.next_cursor, 'next-lead-page');
  assert.equal((await service.connectionStatus(ownerA)).connection?.last_synced_at, null);
  failLeadBatch = true;
  await assert.rejects(service.syncLeads(ownerA, first.next_cursor!, first.selection), /expired or was revoked/);
  assert.equal((await service.connectionStatus(ownerA)).connection?.lead_count, 1);
  failLeadBatch = false;
  assert.equal((await service.syncLeads(ownerA)).imported, 0);
  const second = await service.syncLeads(ownerA, first.next_cursor!, first.selection);
  assert.equal(second.imported, 1); assert.equal(second.next_cursor, null);
  assert.equal((await service.connectionStatus(ownerA)).connection?.lead_count, 2);
  assert.ok((await service.connectionStatus(ownerA)).connection?.last_synced_at);
  assert.equal((await service.syncLeads(ownerA, first.next_cursor!, first.selection)).imported, 0);
  assert.equal((await service.recentLeads(ownerA)).length, 2);
  await assert.rejects(service.recentLeads(ownerB), /connect/i);
});

test('changing form invalidates a prior sync cursor', async () => {
  const previous = await service.syncLeads(ownerA);
  await service.saveSelection(ownerA, '222', '444');
  await assert.rejects(service.syncLeads(ownerA, previous.next_cursor!, previous.selection), /changed/);
  assert.equal((await service.connectionStatus(ownerA)).connection?.lead_count, 0);
  await service.saveSelection(ownerA, '222', '333');
  assert.equal((await service.connectionStatus(ownerA)).connection?.lead_count, 2);
});

test('disconnect removes tokens and leads and cancels pending OAuth callbacks', async () => {
  const attempt = await service.startOAuth(ownerA, app), state = new URL(attempt.authorization_url).searchParams.get('state')!;
  await service.disconnect(ownerA);
  assert.equal((await service.connectionStatus(ownerA)).connected, false);
  assert.equal((await db.execute('SELECT * FROM dashboard_facebook_leads')).rows.length, 0);
  await assert.rejects(service.finishOAuth(state, attempt.browser, 'code', false), /expired|browser/);
});

test('cancelling while the callback exchanges tokens prevents a late connection write', async () => {
  const attempt = await service.startOAuth(ownerA, app), state = new URL(attempt.authorization_url).searchParams.get('state')!;
  let resume!: () => void, started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const paused = new Promise<void>(resolve => { resume = resolve; });
  pauseToken = async () => { started(); await paused; };
  const finishing = service.finishOAuth(state, attempt.browser, 'code', false);
  await ready;
  await service.cancelOAuth(ownerA, attempt.attempt_id);
  resume();
  await assert.rejects(finishing, /cancelled/);
  pauseToken = undefined;
  assert.equal((await service.connectionStatus(ownerA)).connected, false);
});
