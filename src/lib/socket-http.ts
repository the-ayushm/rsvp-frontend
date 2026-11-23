import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Server } from 'socket.io';
import { emitScopedSocketEvent } from './socket-event-scope';

/** Private transport: a browser login token cannot authorize event publication. */
export function handleSocketHTTP(req: IncomingMessage, res: ServerResponse, io: Server | null): boolean {
  if (req.method === 'GET' && req.url === '/internal/socket-health') {
    res.writeHead(io ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: Boolean(io) })); return true;
  }
  if (req.url?.split('?')[0] !== '/internal/socket-emit') return false;
  const reply = (status: number) => { if (!res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ ok: status === 200 })); } };
  if (req.method !== 'POST') { reply(405); return true; }
  const expected = process.env.SOCKET_EMIT_SECRET;
  const supplied = req.headers['x-socket-emit-key'];
  if (!expected || expected.length < 32 || typeof supplied !== 'string' ||
      Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) { reply(401); return true; }
  let body = '', bytes = 0;
  const timeout = setTimeout(() => { reply(408); req.destroy(); }, 5000);
  res.on('close', () => clearTimeout(timeout));
  req.setEncoding('utf8');
  req.on('data', chunk => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 64 * 1024) { reply(413); req.destroy(); return; }
    body += chunk;
  });
  req.on('error', () => { clearTimeout(timeout); reply(400); });
  req.on('end', () => {
    clearTimeout(timeout);
    if (res.writableEnded) return;
    try {
      const { event, data } = JSON.parse(body);
      if (!io) { reply(503); return; }
      if (!['new_message', 'message_status_update'].includes(event) || !emitScopedSocketEvent(io, event, data)) { reply(400); return; }
      reply(200);
    } catch { reply(400); }
  });
  return true;
}
