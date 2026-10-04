import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import amqplib from "amqplib";

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private readonly exchange = "leetcad.events";
  private readonly dlx = "dlx.exchange";
  private readonly dlq = "submissions.dlq";
  private readonly workerQueue = "submissions.queue";

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

    this.logger.log("RabbitMQ topology asserted (events + DLX/DLQ)");
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
