import { io, Socket } from 'socket.io-client';
let socket: Socket | null = null;
let clearSessionWatcher: (() => void) | null = null;
function accessToken(): string {
  if (typeof window === 'undefined') return '';
  const token = localStorage.getItem('console_access_token') || '';
  return token.startsWith('"') && token.endsWith('"') ? token.slice(1, -1) : token;
}
export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    socket = io(url, {
      auth: done => done({ token: accessToken() }),
      transports: ['websocket', 'polling'],
      reconnection: true, reconnectionAttempts: Infinity,
      reconnectionDelay: 2000, reconnectionDelayMax: 10000, timeout: 10000,
    });
    let sessionToken = accessToken();
    const sessionChanged = () => {
      const current = accessToken();
      if (current === sessionToken) return;
      sessionToken = current;
      socket?.disconnect();
      if (current) socket?.connect();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', sessionChanged);
      window.addEventListener('focus', sessionChanged);
      const timer = setInterval(sessionChanged, 1000);
      clearSessionWatcher = () => {
        clearInterval(timer);
        window.removeEventListener('storage', sessionChanged);
        window.removeEventListener('focus', sessionChanged);
      };
    }
    // The server selects the authenticated user's room.
    socket.on('connect_error', () => { /* Inbox polling remains the fallback. */ });
  }
  return socket;
}
export function disconnectSocket() {
  clearSessionWatcher?.();
  clearSessionWatcher = null;
  socket?.disconnect();
  socket = null;
}
