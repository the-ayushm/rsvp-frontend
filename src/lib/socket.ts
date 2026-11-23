import { Server as IOServer } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';
import { installSocketSecurity, isSocketBrowserOrigin } from './socket-auth';

let io: IOServer | null = null;
export function initSocket(server: HTTPServer) {
  if (!io) {
    io = new IOServer(server, {
      maxHttpBufferSize: 64 * 1024,
      cors: { origin: (origin, done) => done(null, isSocketBrowserOrigin(origin)) },
      // WebSocket handshakes also need an origin check.
      allowRequest: (request, done) => done(null, isSocketBrowserOrigin(request.headers.origin)),
    });
    installSocketSecurity(io);
  }
  return io;
}
export function getIO() { return io; }
