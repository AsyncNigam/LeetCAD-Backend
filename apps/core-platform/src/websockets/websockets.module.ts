import { Module } from "@nestjs/common";
import { TerminalGateway } from "./terminal.gateway.js";
import { RabbitMQConsumerService } from "./rabbitmq-consumer.service.js";

@Module({
  providers: [TerminalGateway],
  controllers: [RabbitMQConsumerService],
  exports: [TerminalGateway],
})
export class WebSocketsModule {}
