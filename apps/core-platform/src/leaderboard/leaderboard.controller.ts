import { Controller, Get, UseGuards } from "@nestjs/common";
import { HybridAuthGuard } from "../auth/hybrid-auth.guard.js";
import { SubmissionsService } from "../submissions/submissions.service.js";

@Controller("leaderboard")
@UseGuards(HybridAuthGuard)
export class LeaderboardController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  /**
   * GET /leaderboard — Global user rankings by problems solved + avg score
   */
  @Get()
  async getLeaderboard() {
    return this.submissionsService.getLeaderboard();
  }
}
