import { createServer } from "node:http";
import { Server } from "socket.io";
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const pubClient = new Redis("redis://localhost:6379");
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId as string | undefined;

  if (userId) {
    socket.join(`user:${userId}`);
    console.log(`[realtime-service] User ${userId} connected (socket ${socket.id})`);
  }

  socket.on("disconnect", () => {
    console.log(`[realtime-service] Socket ${socket.id} disconnected (user: ${userId ?? "unknown"})`);
  });
});

const PORT = 3001;

httpServer.listen(PORT, () => {
  console.log(`[realtime-service] WebSocket server listening on port ${PORT}`);
});

const shutdown = async () => {
  console.log("[realtime-service] Shutting down gracefully...");
  io.close();
  await pubClient.quit();
  await subClient.quit();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
