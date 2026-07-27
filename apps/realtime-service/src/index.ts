import { createServer } from "node:http";
import { Server } from "socket.io";
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import amqplib from "amqplib";
import type { AssessmentCompletedPayload } from "@leetcad/shared-types";

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

async function startConsumer(): Promise<{ connection: amqplib.ChannelModel; channel: amqplib.Channel }> {
  const connection = await amqplib.connect("amqp://rmq_admin:local_password@localhost:5672");
  const channel = await connection.createChannel();

  await channel.assertQueue("leetcad.realtime.queue", { durable: true });
  await channel.bindQueue("leetcad.realtime.queue", "leetcad.events", "AssessmentCompleted");

  console.log("[realtime-service] Consuming from leetcad.realtime.queue");

  await channel.consume("leetcad.realtime.queue", async (msg) => {
    if (!msg) return;

    try {
      const payload: AssessmentCompletedPayload = JSON.parse(msg.content.toString());

      await pubClient.zadd("leaderboard:global", payload.score, payload.userId);

      io.to(`user:${payload.userId}`).emit("assessment.completed", payload);

      console.log(`[realtime-service] Notified user ${payload.userId}, leaderboard updated (score: ${payload.score})`);

      channel.ack(msg);
    } catch (error) {
      console.error("[realtime-service] Failed to process message:", error);
      channel.nack(msg, false, false);
    }
  });

  return { connection, channel };
}

const PORT = 3001;

let rmqConnection: amqplib.ChannelModel | null = null;
let rmqChannel: amqplib.Channel | null = null;

httpServer.listen(PORT, async () => {
  console.log(`[realtime-service] WebSocket server listening on port ${PORT}`);

  const { connection, channel } = await startConsumer();
  rmqConnection = connection;
  rmqChannel = channel;
});

const shutdown = async () => {
  console.log("[realtime-service] Shutting down gracefully...");
  if (rmqChannel) await rmqChannel.close();
  if (rmqConnection) await rmqConnection.close();
  io.close();
  await pubClient.quit();
  await subClient.quit();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
