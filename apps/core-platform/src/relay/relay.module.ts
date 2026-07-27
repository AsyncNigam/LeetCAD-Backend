import { Module } from "@nestjs/common";
import { RabbitMQService } from "./rabbitmq.service.js";

@Module({
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RelayModule {}
