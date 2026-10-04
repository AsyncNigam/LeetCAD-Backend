import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Problem } from "./Problem.js";
import { SubmissionStatus } from "@leetcad/shared-types";
import type { AssessmentMetrics } from "@leetcad/shared-types";

@Entity("submissions")
export class Submission {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  userId: string;

  @Column({ type: "uuid" })
  problemId: string;

  @ManyToOne(() => Problem, (problem) => problem.submissions)
  @JoinColumn({ name: "problemId" })
  problem: Problem;

  @Column({ type: "varchar" })
  fileKey: string;

  @Column({ type: "varchar", default: SubmissionStatus.PENDING })
  status: SubmissionStatus;

  @Column({ type: "float", nullable: true })
  score: number | null;

  @Column({ type: "varchar", nullable: true })
  aiReportId: string | null;

  @Column({ type: "jsonb", nullable: true })
  metrics: AssessmentMetrics | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
