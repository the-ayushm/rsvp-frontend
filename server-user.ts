import { createServer } from 'node:http';
import next from 'next';
import { initSocket, getIO } from './src/lib/socket';
import { handleSocketHTTP } from './src/lib/socket-http';
const port = parseInt(process.env.USER_PORT || '3000', 10);
const app = next({ dev: process.env.NODE_ENV !== 'production' });
const handler = app.getRequestHandler();
app.prepare().then(() => {
  const server = createServer((req, res) => {
    if (handleSocketHTTP(req, res, getIO())) return;
    handler(req, res);
  });
  initSocket(server);
  // Use the authenticated HTTP transport exclusively, without the old Redis broadcasts.
  server.listen(port, () => console.log(`Dashboard and authenticated sockets listening on ${port}`));
});
