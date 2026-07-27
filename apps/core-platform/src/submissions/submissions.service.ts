import { Injectable } from "@nestjs/common";
import { DataSource, QueryRunner } from "typeorm";
import { Submission } from "../entities/Submission.js";
import { OutboxEvent } from "../entities/OutboxEvent.js";
import { SubmissionStatus } from "@leetcad/shared-types";
import type { SubmissionCreatedPayload } from "@leetcad/shared-types";

@Injectable()
export class SubmissionsService {
  constructor(private readonly dataSource: DataSource) {}

  async completeUpload(userId: string, fileKey: string): Promise<Submission> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const submission = queryRunner.manager.create(Submission, {
        userId,
        fileKey,
        status: SubmissionStatus.UPLOADED,
      });
      const savedSubmission = await queryRunner.manager.save(submission);

      const payload: SubmissionCreatedPayload = {
        submissionId: savedSubmission.id,
        userId,
        fileKey,
        bucketName: "leetcad",
      };

      const outboxEvent = queryRunner.manager.create(OutboxEvent, {
        aggregateType: "Submission",
        aggregateId: savedSubmission.id,
        eventType: "SubmissionCreated",
        payload: payload as unknown as Record<string, unknown>,
      });
      await queryRunner.manager.save(outboxEvent);

      await queryRunner.commitTransaction();

      return savedSubmission;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
