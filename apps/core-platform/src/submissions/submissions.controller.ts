import { Controller, Post, Get, Body, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
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
  @UseGuards(JwtAuthGuard)
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

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getSubmission(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.submissionsService.findById(id, req.user.userId);
  }
}
