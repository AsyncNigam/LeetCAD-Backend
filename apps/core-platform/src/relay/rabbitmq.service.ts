import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import amqplib from "amqplib";

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private readonly exchange = "leetcad.events";

  async onModuleInit() {
    this.connection = await amqplib.connect(
      "amqp://rmq_admin:local_password@localhost:5672",
    );
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.exchange, "topic", {
      durable: true,
    });
    this.logger.log(`Connected to RabbitMQ, exchange "${this.exchange}" asserted`);
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
