import { Controller, Post, Get, Body, Param, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { HybridAuthGuard } from "../auth/hybrid-auth.guard.js";
import { SubmissionsService } from "./submissions.service.js";

interface CompleteUploadRequest {
  fileKey: string;
  problemId: string;
}

interface AuthenticatedRequest {
  user: { userId: string };
}

@Controller("submissions")
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post("complete")
  @UseGuards(HybridAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async completeUpload(
    @Req() req: AuthenticatedRequest,
    @Body() body: CompleteUploadRequest,
  ) {
    return this.submissionsService.completeUpload(
      req.user.userId,
      body.fileKey,
      body.problemId,
    );
  }

  @Get("mine")
  @UseGuards(HybridAuthGuard)
  async getMySubmissions(@Req() req: AuthenticatedRequest) {
    const submissions = await this.submissionsService.findByUser(req.user.userId);
    return submissions.map((s) => ({
      id: s.id,
      problemId: s.problemId,
      problemTitle: s.problem?.title || "Unknown",
      problemDifficulty: s.problem?.difficulty || "MEDIUM",
      status: s.status,
      score: s.score,
      metrics: s.metrics,
      createdAt: s.createdAt,
    }));
  }

  @Get(":id")
  @UseGuards(HybridAuthGuard)
  async getSubmission(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.submissionsService.findById(id, req.user.userId);
  }
}
