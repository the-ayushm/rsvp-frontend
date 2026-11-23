import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client, type Socket } from 'socket.io-client';
import { installSocketSecurity, isSocketBrowserOrigin, verifySocketSession } from './socket-auth';
import { handleSocketHTTP } from './socket-http';

const secret = 'isolated-test-key-with-at-least-32-characters';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('authenticated users cannot subscribe to or receive another user\'s events', async () => {
  process.env.SOCKET_EMIT_SECRET = secret;
  const server = createServer((req, res) => {
    if (!handleSocketHTTP(req, res, io)) { res.writeHead(404); res.end(); }
  });
  const io = new Server(server);
  const revoked = new Set<string>();
  installSocketSecurity(io, async (token, origin) => {
    if (!['alice', 'bob', 'carol', 'expiring'].includes(String(token)) || origin !== 'https://app.soft7.in' || revoked.has(String(token))) throw new Error('Unauthorized');
    return { userId: String(token), companyId: token === 'carol' ? 'other-company' : 'same-company', expiresAt: Date.now() + (token === 'expiring' ? 120 : 60_000) };
  }, 50);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const clients: Socket[] = [];
  const connect = (token: string, origin = 'https://app.soft7.in') => new Promise<Socket>((resolve, reject) => {
    const socket = client(base, { transports: ['websocket'], reconnection: false, auth: { token }, extraHeaders: { Origin: origin }, timeout: 1000 });
    clients.push(socket);
    socket.once('connect', () => resolve(socket)); socket.once('connect_error', reject);
  });
  const emit = async (data: unknown, key = secret, event = 'new_message') => fetch(`${base}/internal/socket-emit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Socket-Emit-Key': key }, body: JSON.stringify({ event, data }),
  });
  try {
    await assert.rejects(connect(''), /Unauthorized/);
    await assert.rejects(connect('alice', 'https://unregistered.example'), /Unauthorized/);
    const alice = await connect('alice'), bob = await connect('bob'), carol = await connect('carol');
    const received: Record<string, unknown[]> = { alice: [], bob: [], carol: [] };
    for (const [name, socket] of Object.entries({ alice, bob, carol })) socket.on('new_message', payload => received[name].push(payload));
    assert.deepEqual(await bob.timeout(1000).emitWithAck('join_room', 'alice'), { ok: false });
    assert.deepEqual(await alice.timeout(1000).emitWithAck('join_room', 'alice'), { ok: true });
    assert.equal((await emit({ userId: 'alice', text: 'private test' })).status, 200);
    await delay(50);
    assert.equal(received.alice.length, 1); assert.equal(received.bob.length, 0); assert.equal(received.carol.length, 0);
    assert.equal((await emit({ text: 'missing owner' })).status, 400);
    assert.equal((await emit({ userId: 'alice', user_id: 'bob' })).status, 400);
    assert.equal((await emit({ userId: 'alice', message: { userId: 'bob' } })).status, 400);
    assert.equal((await emit({ userId: 'alice' }, 'bad-key')).status, 401);
    assert.equal((await emit({ userId: 'alice' }, secret, 'broadcast')).status, 400);
    await delay(30); assert.equal(received.alice.length, 1);
    const expiring = await connect('expiring');
    await delay(180); assert.equal(expiring.connected, false);
    revoked.add('bob'); await delay(100); assert.equal(bob.connected, false);
    assert.equal(alice.connected, true);
  } finally {
    clients.forEach(socket => socket.disconnect());
    await new Promise<void>(resolve => io.close(() => resolve()));
    server.closeAllConnections();
    delete process.env.SOCKET_EMIT_SECRET;
  }
});

test('origin and backend session validation fail closed', async () => {
  for (const origin of [undefined, 'null', 'http://app.soft7.in', 'https://app.soft7.in/path', 'https://app.soft7.in:8443']) assert.equal(isSocketBrowserOrigin(origin), false);
  assert.equal(isSocketBrowserOrigin('https://acer.soft7.in'), true);
  const original = globalThis.fetch;
  const token = `header.${Buffer.from(JSON.stringify({ userId: 'alice', exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url')}.signature`;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, data: { userId: 'alice', companyId: 'company' } }));
    assert.equal((await verifySocketSession(token, 'https://app.soft7.in')).userId, 'alice');
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, data: { userId: 'bob' } }));
    await assert.rejects(verifySocketSession(token, 'https://app.soft7.in'));
    globalThis.fetch = async () => new Response('{}', { status: 401 });
    await assert.rejects(verifySocketSession(token, 'https://app.soft7.in'));
    await assert.rejects(verifySocketSession('', 'https://app.soft7.in'));
  } finally { globalThis.fetch = original; }
});
