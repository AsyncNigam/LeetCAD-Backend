import { Controller, Get, Post, Param, Body, NotFoundException, UseGuards, Req } from "@nestjs/common";
import { HybridAuthGuard } from "../auth/hybrid-auth.guard.js";
import { DataSource } from "typeorm";
import { Problem } from "../entities/Problem.js";
import { StorageService } from "../storage/storage.service.js";

@Controller("problems")
@UseGuards(HybridAuthGuard)
export class ProblemsController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

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

  @Get(":slug")
  async getProblem(@Param("slug") slug: string) {
    const repo = this.dataSource.getRepository(Problem);
    const problems = await repo.find();
    
    // Support either UUID or slug
    const problem = problems.find(p => 
      p.id === slug || 
      p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") === slug
    );

    if (!problem) {
      throw new NotFoundException("Problem not found");
    }
    
    return {
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      targetVolume: problem.targetVolume,
      tolerance: problem.tolerance,
    };
  }


  @Post(":slug/submit")
  async submitProblem(
    @Req() req: any,
    @Param("slug") slug: string,
    @Body() body: { filename: string; contentType?: string }
  ) {
    const repo = this.dataSource.getRepository(Problem);
    const problems = await repo.find();
    
    // Find problem by slugifying its title
    const problem = problems.find(p => 
      p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") === slug
    );

    if (!problem) {
      throw new NotFoundException(`Problem with slug '${slug}' not found`);
    }

    const filename = body.filename || "cli_upload.step";
    const userId = req.user?.userId || req.user?.id || "anonymous";

    const presigned = await this.storageService.getPresignedUploadUrl(userId, filename);
    return { ...presigned, problemId: problem.id };
  }
}
