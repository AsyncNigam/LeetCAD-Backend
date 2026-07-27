import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import amqplib from "amqplib";

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private readonly exchange = "leetcad.events";
  private readonly dlx = "leetcad.dlx";
  private readonly dlq = "leetcad.dlq";
  private readonly workerQueue = "leetcad.assessment.queue";

  async onModuleInit() {
    this.connection = await amqplib.connect(
      "amqp://guest:guest@localhost:5672",
    );
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(this.dlx, "topic", { durable: true });
    await this.channel.assertQueue(this.dlq, { durable: true });
    await this.channel.bindQueue(this.dlq, this.dlx, "#");

    await this.channel.assertExchange(this.exchange, "topic", { durable: true });
    await this.channel.assertQueue(this.workerQueue, {
      durable: true,
      arguments: { "x-dead-letter-exchange": this.dlx },
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
