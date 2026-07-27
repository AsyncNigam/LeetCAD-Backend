import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DataSource, QueryRunner } from "typeorm";
import { OutboxEvent } from "../entities/OutboxEvent.js";
import { RabbitMQService } from "./rabbitmq.service.js";

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly rabbitmqService: RabbitMQService,
  ) {}

  @Cron("* * * * * *")
  async pollOutbox(): Promise<void> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const events = await queryRunner.manager
        .createQueryBuilder(OutboxEvent, "event")
        .where("event.processed = :processed", { processed: false })
        .orderBy("event.createdAt", "ASC")
        .limit(50)
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getMany();

      if (events.length === 0) {
        await queryRunner.commitTransaction();
        return;
      }

      for (const event of events) {
        await this.rabbitmqService.publishEvent(event.eventType, event.payload);
        event.processed = true;
      }

      await queryRunner.manager.save(events);
      await queryRunner.commitTransaction();

      this.logger.log(`Relayed ${events.length} outbox event(s)`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error("Outbox relay failed", (error as Error).stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
