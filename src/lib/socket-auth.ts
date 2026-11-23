import type { Server } from 'socket.io';

export type SocketSession = { userId: string; companyId: string | null; expiresAt: number };

/** The API verifies the signature, live account status and the company's origin. */
export async function verifySocketSession(token: unknown, origin: unknown): Promise<SocketSession> {
  if (typeof token !== 'string' || !token || token.length > 8192 || typeof origin !== 'string') throw new Error('Unauthorized');
  const api = process.env.SOCKET_AUTH_API_URL || 'https://hostapi.soft7.in//v1/auth/socket-session';
  const response = await fetch(api, {
    headers: { Authorization: `Bearer ${token}`, 'X-Socket-Origin': origin },
    signal: AbortSignal.timeout(5000), cache: 'no-store', redirect: 'error',
  });
  if (!response.ok) throw new Error('Unauthorized');
  const body = await response.json();
  // Decode only after the exact token has been verified by the API.
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  const expiresAt = Number(claims.exp) * 1000;
  if (body.success !== true || typeof body.data?.userId !== 'string' || !body.data.userId ||
      !Number.isFinite(expiresAt) || expiresAt <= Date.now() || claims.userId !== body.data.userId) throw new Error('Unauthorized');
  return { userId: body.data.userId, companyId: body.data.companyId ?? null, expiresAt };
}

export function installSocketSecurity(io: Server, authenticate = verifySocketSession, revalidationMs = 60_000) {
  io.use(async (socket, next) => {
    try {
      socket.data.session = await authenticate(socket.handshake.auth.token, socket.handshake.headers.origin);
      next();
    } catch { next(new Error('Unauthorized')); }
  });
  io.on('connection', socket => {
    const session: SocketSession = socket.data.session;
    socket.join(`user_${session.userId}`);
    // Legacy join requests cannot grant access to another user's room.
    socket.on('join_room', (requested: unknown, acknowledge?: (result: { ok: boolean }) => void) => {
      if (typeof acknowledge === 'function') acknowledge({ ok: String(requested) === session.userId });
    });
    const expiry = setTimeout(() => socket.disconnect(true), Math.min(session.expiresAt - Date.now(), 2_147_483_647));
    let checking = false;
    const check = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const current = await authenticate(socket.handshake.auth.token, socket.handshake.headers.origin);
        if (current.userId !== session.userId || current.companyId !== session.companyId || current.expiresAt <= Date.now()) socket.disconnect(true);
      } catch { socket.disconnect(true); }
      finally { checking = false; }
    }, revalidationMs);
    socket.on('disconnect', () => { clearTimeout(expiry); clearInterval(check); });
  });
}

export function isSocketBrowserOrigin(origin: unknown): boolean {
  if (typeof origin !== 'string') return false;
  try { const url = new URL(origin); return url.protocol === 'https:' && url.origin === origin && !url.port; }
  catch { return false; }
}
