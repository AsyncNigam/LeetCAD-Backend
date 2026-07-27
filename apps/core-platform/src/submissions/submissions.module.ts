import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Submission } from "../entities/Submission.js";
import { OutboxEvent } from "../entities/OutboxEvent.js";
import { SubmissionsController } from "./submissions.controller.js";
import { SubmissionsService } from "./submissions.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Submission, OutboxEvent])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
