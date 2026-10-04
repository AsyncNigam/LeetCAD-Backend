import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxEvent } from "../entities/OutboxEvent.js";
import { RabbitMQService } from "./rabbitmq.service.js";
import { OutboxRelayService } from "./outbox-relay.service.js";
import { WebhooksModule } from "../webhooks/webhooks.module.js";

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent]), WebhooksModule],
  providers: [RabbitMQService, OutboxRelayService],
  exports: [RabbitMQService],
})
export class RelayModule {}

