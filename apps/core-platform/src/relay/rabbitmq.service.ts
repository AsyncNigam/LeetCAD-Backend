import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import amqplib from "amqplib";
import { WebhookDispatcherService } from "../webhooks/webhook.dispatcher.service.js";

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private readonly exchange = "leetcad.events";
  private readonly dlx = "dlx.exchange";
  private readonly dlq = "submissions.dlq";
  private readonly workerQueue = "submissions.queue";
  private readonly webhooksQueue = "core-platform.webhooks.queue";
  private readonly webhooksWaitExchange = "webhooks.wait.exchange";
  private readonly webhooksWaitQueue = "webhooks.wait.queue";

  constructor(private readonly webhookDispatcher: WebhookDispatcherService) {}

  async onModuleInit() {
    const rabbitUrl = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
    this.connection = await amqplib.connect(rabbitUrl);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(this.dlx, "direct", { durable: true });
    await this.channel.assertQueue(this.dlq, { durable: true });
    await this.channel.bindQueue(this.dlq, this.dlx, "dlq.submissions");

    await this.channel.assertExchange(this.exchange, "topic", { durable: true });
    await this.channel.assertQueue(this.workerQueue, {
      durable: true,
      deadLetterExchange: this.dlx,
      deadLetterRoutingKey: "dlq.submissions",
    });
    await this.channel.bindQueue(this.workerQueue, this.exchange, "SubmissionCreated");

    // Webhook topology
    await this.channel.assertQueue(this.webhooksQueue, { durable: true });
    await this.channel.bindQueue(this.webhooksQueue, this.exchange, "AssessmentCompleted");

    // Webhook Wait/Retry topology
    await this.channel.assertExchange(this.webhooksWaitExchange, "direct", { durable: true });
    await this.channel.assertQueue(this.webhooksWaitQueue, {
      durable: true,
      deadLetterExchange: "", // Default exchange routes directly to queue
      deadLetterRoutingKey: this.webhooksQueue,
    });
    await this.channel.bindQueue(this.webhooksWaitQueue, this.webhooksWaitExchange, "wait");

    this.logger.log("RabbitMQ topology asserted (events + DLX/DLQ + Webhooks + Retry)");

    // Start consuming
    this.channel.consume(this.webhooksQueue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        let success = true;
        
        if (payload.userId) {
          success = await this.webhookDispatcher.dispatch(payload.userId, payload);
        }

        if (success) {
          this.channel?.ack(msg);
        } else {
          // Transient failure, apply exponential backoff
          const headers = msg.properties.headers || {};
          const retryCount = typeof headers["x-retry-count"] === "number" ? headers["x-retry-count"] : 0;
          
          if (retryCount >= 3) {
            this.logger.warn(`Webhook permanently failed after 3 retries for user ${payload.userId}`);
            this.channel?.ack(msg);
          } else {
            const delay = 5000 * Math.pow(2, retryCount);
            this.channel?.publish(this.webhooksWaitExchange, "wait", msg.content, {
              persistent: true,
              contentType: "application/json",
              expiration: delay.toString(),
              headers: { ...headers, "x-retry-count": retryCount + 1 },
            });
            this.logger.log(`Scheduled webhook retry ${retryCount + 1} in ${delay}ms for user ${payload.userId}`);
            this.channel?.ack(msg);
          }
        }
      } catch (err: any) {
        this.logger.error(`Error consuming AssessmentCompleted for webhooks: ${err.message}`);
        this.channel?.nack(msg, false, false);
      }
    });
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }

  async publishEvent(routingKey: string, payload: unknown): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not initialized");
    }
    this.channel.publish(
      this.exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: "application/json" },
    );
  }
}
