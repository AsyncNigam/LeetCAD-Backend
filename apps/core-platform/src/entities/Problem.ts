import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Submission } from "./Submission.js";

export enum ProblemDifficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

@Entity("problems")
export class Problem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({
    type: "enum",
    enum: ProblemDifficulty,
    default: ProblemDifficulty.MEDIUM,
  })
  difficulty: ProblemDifficulty;

  @Column({ type: "varchar" })
  goldenFileKey: string;

  @Column({ type: "float" })
  targetVolume: number;

  @Column({ type: "float" })
  tolerance: number;

  @OneToMany(() => Submission, (submission) => submission.problem)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
