import { Injectable } from "@nestjs/common";
import { DataSource, QueryRunner } from "typeorm";
import { Submission } from "../entities/Submission.js";
import { OutboxEvent } from "../entities/OutboxEvent.js";
import { SubmissionStatus } from "@leetcad/shared-types";
import type { SubmissionCreatedPayload } from "@leetcad/shared-types";

@Injectable()
export class SubmissionsService {
  constructor(private readonly dataSource: DataSource) {}

  async completeUpload(userId: string, fileKey: string, problemId: string): Promise<Submission> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const submission = queryRunner.manager.create(Submission, {
        userId,
        fileKey,
        problemId,
        status: SubmissionStatus.UPLOADED,
      });
      const savedSubmission = await queryRunner.manager.save(submission);

      const payload: SubmissionCreatedPayload = {
        submissionId: savedSubmission.id,
        userId,
        fileKey,
        bucketName: process.env.R2_BUCKET_NAME || "leetcad-storage",
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

  async findById(id: string, userId: string): Promise<Submission | null> {
    const repo = this.dataSource.getRepository(Submission);
    return repo.findOne({ where: { id, userId } });
  }

  /**
   * Get all submissions for a specific user, ordered by most recent first.
   * Includes the related problem info.
   */
  async findByUser(userId: string): Promise<Submission[]> {
    const repo = this.dataSource.getRepository(Submission);
    return repo.find({
      where: { userId },
      relations: { problem: true },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get leaderboard: top users ranked by their best score across all problems.
   * Returns aggregated stats per user.
   */
  async getLeaderboard(): Promise<
    Array<{
      userId: string;
      userName: string;
      totalSolved: number;
      bestAvgScore: number;
      totalSubmissions: number;
    }>
  > {
    const result = await this.dataSource.query(`
      SELECT
        s."userId",
        u."name" AS "userName",
        COUNT(DISTINCT CASE WHEN s."status" = 'COMPLETED' AND s."score" >= 60 THEN s."problemId" END)::int AS "totalSolved",
        ROUND(COALESCE(AVG(CASE WHEN s."status" = 'COMPLETED' THEN s."score" END), 0)::numeric, 1) AS "bestAvgScore",
        COUNT(s."id")::int AS "totalSubmissions"
      FROM submissions s
      JOIN users u ON u."id" = s."userId"
      GROUP BY s."userId", u."name"
      ORDER BY "totalSolved" DESC, "bestAvgScore" DESC
      LIMIT 100
    `);

    return result.map((row: any) => ({
      userId: row.userId,
      userName: row.userName,
      totalSolved: row.totalSolved,
      bestAvgScore: parseFloat(row.bestAvgScore),
      totalSubmissions: row.totalSubmissions,
    }));
  }
}
