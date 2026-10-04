import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
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

  @Get(":id")
  async getProblem(@Param("id") id: string) {
    const repo = this.dataSource.getRepository(Problem);
    const problem = await repo.findOne({
      where: { id },
      select: {
        id: true,
        title: true,
        difficulty: true,
        description: true,
        targetVolume: true,
        tolerance: true,
      },
    });

    if (!problem) {
      throw new NotFoundException("Problem not found");
    }
    return problem;
  }
}
