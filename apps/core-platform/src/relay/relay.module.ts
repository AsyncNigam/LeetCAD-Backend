import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxEvent } from "../entities/OutboxEvent.js";
import { RabbitMQService } from "./rabbitmq.service.js";
import { OutboxRelayService } from "./outbox-relay.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [RabbitMQService, OutboxRelayService],
  exports: [RabbitMQService],
})
export class RelayModule {}

