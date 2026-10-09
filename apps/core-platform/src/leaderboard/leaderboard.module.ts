import { Module } from "@nestjs/common";
import { LeaderboardController } from "./leaderboard.controller.js";
import { SubmissionsModule } from "../submissions/submissions.module.js";

@Module({
  imports: [SubmissionsModule],
  controllers: [LeaderboardController],
})
export class LeaderboardModule {}
