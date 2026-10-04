import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { TerminalGateway } from "./terminal.gateway.js";

@Controller()
export class RabbitMQConsumerService {
  private readonly logger = new Logger(RabbitMQConsumerService.name);

  constructor(private readonly terminalGateway: TerminalGateway) {}

  @EventPattern("assessment.completed")
  async handleAssessmentCompleted(@Payload() payload: any) {
    const submissionId = payload?.submissionId;
    if (submissionId) {
      this.logger.debug(`Received assessment.completed for submissionId: ${submissionId}`);
      this.terminalGateway.broadcastToRoom(submissionId, "terminal.log", payload);
    } else {
      this.logger.warn("Received assessment.completed without submissionId");
    }
  }

  @EventPattern("kernel.panic")
  async handleKernelPanic(@Payload() payload: any) {
    const submissionId = payload?.submissionId;
    if (submissionId) {
      this.logger.debug(`Received kernel.panic for submissionId: ${submissionId}`);
      this.terminalGateway.broadcastToRoom(submissionId, "terminal.log", payload);
    } else {
      this.logger.warn("Received kernel.panic without submissionId");
    }
  }
}
