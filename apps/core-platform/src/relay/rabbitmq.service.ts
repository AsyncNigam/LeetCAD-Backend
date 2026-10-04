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

    this.logger.log("RabbitMQ topology asserted (events + DLX/DLQ + Webhooks)");

    // Start consuming
    this.channel.consume(this.webhooksQueue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        if (payload.userId) {
          await this.webhookDispatcher.dispatch(payload.userId, payload);
        }
        this.channel?.ack(msg);
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
