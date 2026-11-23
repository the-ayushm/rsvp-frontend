import { createServer } from "http";
import next from "next";
import { initSocket } from "./src/lib/socket";
import { initSocketBridge } from "./src/lib/socket-bridge";

const port = parseInt(process.env.ADMIN_PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handler(req, res);
  });

  const io = initSocket(server);
  console.log("🔌 Socket.IO initialized");

  initSocketBridge(io);

  server.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📡 Socket.IO ready for connections`);
  });
});