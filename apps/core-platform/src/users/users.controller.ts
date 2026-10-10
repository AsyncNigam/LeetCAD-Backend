import { Controller, Get, Req, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/User.js";
import { HybridAuthGuard } from "../auth/hybrid-auth.guard.js";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Get("me")
  @UseGuards(HybridAuthGuard)
  @ApiOperation({ summary: "Get current authenticated user" })
  @ApiResponse({ status: 200, description: "User details returned" })
  async getMe(@Req() req: any) {
    const userId = req.user.userId || req.user.id;
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }
  @Get("me/submissions")
  @UseGuards(HybridAuthGuard)
  @ApiOperation({ summary: "Get current user's submissions" })
  async getMySubmissions(@Req() req: any) {
    const userId = req.user.userId || req.user.id;
    const submissionRepo = this.userRepository.manager.getRepository("Submission");
    
    const submissions = await submissionRepo.find({
      where: { userId },
      relations: { problem: true },
      order: { createdAt: "DESC" },
    });

    return submissions.map((sub: any) => ({
      id: sub.id,
      problemTitle: sub.problem?.title || "Unknown Problem",
      score: sub.score,
      status: sub.status,
      createdAt: sub.createdAt,
    }));
  }
}
