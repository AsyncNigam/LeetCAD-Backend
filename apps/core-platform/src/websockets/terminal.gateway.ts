import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({ cors: { origin: "*" } })
export class TerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TerminalGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribe_to_submission")
  handleSubscribeToSubmission(
    @MessageBody() data: { submissionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.submissionId) {
      this.logger.warn(`Client ${client.id} tried to subscribe without a submissionId`);
      return;
    }
    client.join(data.submissionId);
    this.logger.log(`Client ${client.id} subscribed to room: ${data.submissionId}`);
  }

  /**
   * Expose a public method to broadcast events to a specific submission room.
   */
  public broadcastToRoom(submissionId: string, event: string, payload: any) {
    this.server.to(submissionId).emit(event, payload);
    this.logger.debug(`Broadcasted ${event} to room ${submissionId}`);
  }
}
