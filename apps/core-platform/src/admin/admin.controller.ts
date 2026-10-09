import { Controller, Get, UseGuards, Req } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { DataSource } from "typeorm";
import { User, UserRole } from "../entities/User.js";
import { Submission } from "../entities/Submission.js";
import { Problem } from "../entities/Problem.js";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class AdminController {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * GET /admin/stats — Platform-wide statistics
   */
  @Get("stats")
  async getStats() {
    const userRepo = this.dataSource.getRepository(User);
    const submissionRepo = this.dataSource.getRepository(Submission);
    const problemRepo = this.dataSource.getRepository(Problem);

    const [totalUsers, totalSubmissions, totalProblems] = await Promise.all([
      userRepo.count(),
      submissionRepo.count(),
      problemRepo.count(),
    ]);

    return {
      totalUsers,
      totalSubmissions,
      totalProblems,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /admin/users — List all users with their roles
   */
  @Get("users")
  async listUsers() {
    const repo = this.dataSource.getRepository(User);
    return repo.find({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * GET /admin/me — Confirm the caller's admin/owner status
   */
  @Get("me")
  async getMe(@Req() req: any) {
    const jwtUser = (req as any).user;
    const repo = this.dataSource.getRepository(User);
    const user = await repo.findOne({ where: { id: jwtUser.userId } });

    return {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      role: user?.role,
    };
  }
}
