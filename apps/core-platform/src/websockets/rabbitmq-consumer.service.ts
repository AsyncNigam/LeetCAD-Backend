import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import amqplib from "amqplib";
import { TerminalGateway } from "./terminal.gateway.js";

/**
 * Consumes RabbitMQ events (assessment.completed, kernel.panic) and
 * broadcasts them to the WebSocket Live Terminal rooms via the gateway.
 *
 * Uses raw amqplib — consistent with RabbitMQService in the relay module.
 */
@Injectable()
export class RabbitMQConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQConsumerService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  private readonly exchange = "leetcad.events";
  private readonly queue = "leetcad.assessment.queue";

  constructor(private readonly terminalGateway: TerminalGateway) {}

  async onModuleInit() {
    const rabbitUrl = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
    this.connection = await amqplib.connect(rabbitUrl);
    this.channel = await this.connection.createChannel();

    // Assert exchange and queue (idempotent)
    await this.channel.assertExchange(this.exchange, "topic", { durable: true });
    await this.channel.assertQueue(this.queue, {
      durable: true,
      deadLetterExchange: "leetcad.dlx",
    });
    await this.channel.bindQueue(this.queue, this.exchange, "AssessmentCompleted");

    this.logger.log(`Consuming from ${this.queue} for Live Terminal broadcasts`);

    this.channel.consume(this.queue, (msg) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString());
        const submissionId = payload?.submissionId;

        if (submissionId) {
          this.terminalGateway.broadcastToRoom(submissionId, "terminal.log", payload);
        }

        this.channel?.ack(msg);
      } catch (err: any) {
        this.logger.error(`Failed to process terminal event: ${err.message}`);
        this.channel?.nack(msg, false, false);
      }
    });
  }

  async onModuleDestroy() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}
