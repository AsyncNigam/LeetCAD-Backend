import { Controller, Get } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Problem } from "../entities/Problem.js";

@Controller("problems")
export class ProblemsController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async listProblems() {
    const repo = this.dataSource.getRepository(Problem);
    return repo.find({
      select: {
        id: true,
        title: true,
        difficulty: true,
        description: true,
        targetVolume: true,
        tolerance: true,
      },
      order: { createdAt: "ASC" },
    });
  }
}
