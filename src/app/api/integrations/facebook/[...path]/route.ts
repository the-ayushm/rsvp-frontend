import { NextRequest, NextResponse } from 'next/server';
import { verifySocketSession } from '@/lib/socket-auth';
import { FacebookError, appCredentials, settings } from '@/lib/facebook/security';
import * as facebook from '@/lib/facebook/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown) => NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });

async function owner(request: NextRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const origin = request.headers.get('origin') || new URL(process.env.FACEBOOK_REDIRECT_URI || request.url).origin;
  try {
    const session = await verifySocketSession(token, origin);
    // Separate all records by the verified company AND user. Never trust a client user ID.
    return JSON.stringify([session.companyId, session.userId]);
  } catch { throw new FacebookError('Your session could not be verified. Sign in again and retry.', 401); }
}

function failure(error: unknown) {
  const code = (error as { code?: string })?.code;
  const message = error instanceof FacebookError ? error.message
    : code === '42P01' ? 'Facebook storage is not ready. The administrator must run scripts/database/setup-facebook.ts.'
    : 'Facebook integration is temporarily unavailable. Please try again.';
  return NextResponse.json({ error: message }, { status: error instanceof FacebookError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}

async function body(request: NextRequest): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > 8192) throw new FacebookError('Request is too large.', 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new FacebookError('Invalid request body.'); }
}
const str = (value: unknown) => typeof value === 'string' ? value : '';

async function callback(request: NextRequest) {
  let message = 'Facebook account connected. Return to the dashboard to select your Page and form.';
  let success = true;
  try {
    await facebook.finishOAuth(request.nextUrl.searchParams.get('state') || '', request.cookies.get(facebook.OAUTH_COOKIE)?.value || '',
      request.nextUrl.searchParams.get('code'), request.nextUrl.searchParams.has('error'));
  } catch (error) {
    success = false;
    message = error instanceof FacebookError ? error.message : 'Facebook connection failed. Return to the dashboard and try again.';
  }
  const escaped = message.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const response = new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facebook connection</title><body><main><h1>${success ? 'Facebook connected' : 'Could not connect Facebook'}</h1><p>${escaped}</p><p>You can close this window.</p></main></body></html>`, {
    status: success ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" },
  });
  response.cookies.set(facebook.OAUTH_COOKIE, '', { path: '/api/integrations/facebook/oauth', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0 });
  return response;
}

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, context: Context) {
  const path = (await context.params).path.join('/');
  if (request.method === 'GET' && path === 'oauth/callback') return callback(request);
  try {
    const key = await owner(request);
    if (request.method === 'GET') {
      if (path === 'setup') {
        try { settings(); appCredentials(); return json({ ready: true, issue: null, custom_ready: true }); }
        catch (error) {
          let customReady = true;
          try { settings(); } catch { customReady = false; }
          return json({ ready: false, issue: error instanceof Error ? error.message : 'Facebook is not configured.', custom_ready: customReady });
        }
      }
      if (path === 'connection') return json(await facebook.connectionStatus(key));
      if (path === 'oauth/status') return json(await facebook.oauthStatus(key, request.nextUrl.searchParams.get('attempt_id') || ''));
      if (path === 'pages') return json(await facebook.listPages(key));
      if (path === 'forms') return json(await facebook.listForms(key, request.nextUrl.searchParams.get('page_id') || ''));
      if (path === 'leads') return json(await facebook.recentLeads(key));
    }
    if (request.method === 'POST') {
      const input = await body(request);
      if (path === 'oauth/start') {
        if (request.headers.get('origin') !== settings().origin) throw new FacebookError('Open the dashboard using the public origin configured for Facebook login.', 400);
        let custom;
        if (input.appId !== undefined || input.appSecret !== undefined) {
          if (!/^\d+$/.test(str(input.appId)) || !str(input.appSecret).trim()) throw new FacebookError('Enter both your App ID and App Secret.');
          custom = { appId: str(input.appId), appSecret: str(input.appSecret), configId: str(input.configId) };
        }
        const result = await facebook.startOAuth(key, custom);
        const response = json({ attempt_id: result.attempt_id, authorization_url: result.authorization_url });
        response.cookies.set(facebook.OAUTH_COOKIE, result.browser, { path: '/api/integrations/facebook/oauth', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
        return response;
      }
      if (path === 'connection') return json(await facebook.saveSelection(key, str(input.page_id), str(input.form_id)));
      if (path === 'sync') {
        if (str(input.after).length > 4096 || str(input.selection).length > 256) throw new FacebookError('Invalid sync cursor.');
        return json(await facebook.syncLeads(key, str(input.after) || undefined, str(input.selection) || undefined));
      }
    }
    if (request.method === 'DELETE') {
      if (path === 'connection') return json(await facebook.disconnect(key));
      if (path === 'oauth/attempt') { await facebook.cancelOAuth(key, request.nextUrl.searchParams.get('attempt_id') || ''); return json({ cancelled: true }); }
    }
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  } catch (error) { return failure(error); }
}
export { handle as GET, handle as POST, handle as DELETE };
