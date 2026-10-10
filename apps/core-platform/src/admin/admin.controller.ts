import { Controller, Get, Post, Body, UseGuards, Req, BadRequestException } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { DataSource } from "typeorm";
import { User, UserRole } from "../entities/User.js";
import { Submission } from "../entities/Submission.js";
import { Problem, ProblemDifficulty } from "../entities/Problem.js";
import { StorageService } from "../storage/storage.service.js";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class AdminController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

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
    const jwtUser = req.user;
    const repo = this.dataSource.getRepository(User);
    const user = await repo.findOne({ where: { id: jwtUser.userId } });

    return {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      role: user?.role,
    };
  }

  /**
   * PATCH /admin/users/:id/role — Change a user's role
   * Only accessible to OWNERs.
   */
  @Roles(UserRole.OWNER)
  @Post("users/:id/role")
  async updateUserRole(
    @Req() req: any,
    @Body() body: { role: string }
  ) {
    const targetUserId = req.params.id;
    const { role } = body;

    const validRoles = Object.values(UserRole);
    if (!validRoles.includes(role as UserRole)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
    }

    const repo = this.dataSource.getRepository(User);
    const targetUser = await repo.findOne({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new BadRequestException("User not found");
    }

    // Prevent modifying other owners
    if (targetUser.role === UserRole.OWNER) {
      throw new BadRequestException("Cannot modify the role of another OWNER.");
    }

    targetUser.role = role as UserRole;
    const saved = await repo.save(targetUser);

    return {
      id: saved.id,
      email: saved.email,
      role: saved.role,
    };
  }

  /**
   * POST /admin/problems — Create a new problem + get presigned URL for golden file
   *
   * Body: { title, description, difficulty, targetVolume, tolerance, filename }
   * Returns: { problem, uploadUrl } where uploadUrl is a presigned R2 PUT URL
   */
  @Post("problems")
  async createProblem(
    @Body() body: {
      title: string;
      description: string;
      difficulty: string;
      targetVolume: number;
      tolerance: number;
      filename: string;
    },
    @Req() req: any,
  ) {
    const { title, description, difficulty, targetVolume, tolerance, filename } = body;

    // ── Validate required fields ──────────────────────────
    if (!title?.trim()) throw new BadRequestException("Title is required");
    if (!description?.trim()) throw new BadRequestException("Description is required");
    if (!filename?.trim()) throw new BadRequestException("Golden file filename is required");
    if (!targetVolume || targetVolume <= 0) throw new BadRequestException("Target volume must be positive");
    if (tolerance === undefined || tolerance <= 0) throw new BadRequestException("Tolerance must be positive");

    const validDifficulties = Object.values(ProblemDifficulty);
    const normalizedDifficulty = (difficulty || "").toUpperCase() as ProblemDifficulty;
    if (!validDifficulties.includes(normalizedDifficulty)) {
      throw new BadRequestException(`Difficulty must be one of: ${validDifficulties.join(", ")}`);
    }

    // ── Generate presigned upload URL for the golden .step file ──
    const goldenFileKey = `problems/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-golden.step`;

    const { url: uploadUrl } = await this.storageService.getPresignedUploadUrlForKey(goldenFileKey);

    // ── Save problem record to database ──────────────────
    const repo = this.dataSource.getRepository(Problem);
    const problem = repo.create({
      title: title.trim(),
      description: description.trim(),
      difficulty: normalizedDifficulty,
      targetVolume,
      tolerance,
      goldenFileKey,
    });
    const saved = await repo.save(problem);

    return {
      problem: {
        id: saved.id,
        title: saved.title,
        difficulty: saved.difficulty,
        targetVolume: saved.targetVolume,
        tolerance: saved.tolerance,
        goldenFileKey: saved.goldenFileKey,
      },
      uploadUrl,
    };
  }

  /**
   * PATCH /admin/problems/:id — Edit an existing problem
   *
   * Body: { title, description, difficulty, targetVolume, tolerance }
   * Returns: { problem }
   */
  @Post("problems/:id/edit")
  async updateProblem(
    @Req() req: any,
    @Body() body: {
      title?: string;
      description?: string;
      difficulty?: string;
      targetVolume?: number;
      tolerance?: number;
    }
  ) {
    const problemId = req.params.id;
    const { title, description, difficulty, targetVolume, tolerance } = body;

    const repo = this.dataSource.getRepository(Problem);
    const problem = await repo.findOne({ where: { id: problemId } });

    if (!problem) {
      throw new BadRequestException("Problem not found");
    }

    if (title !== undefined && title.trim()) problem.title = title.trim();
    if (description !== undefined && description.trim()) problem.description = description.trim();
    if (targetVolume !== undefined && targetVolume > 0) problem.targetVolume = targetVolume;
    if (tolerance !== undefined && tolerance > 0) problem.tolerance = tolerance;
    
    if (difficulty !== undefined) {
      const validDifficulties = Object.values(ProblemDifficulty);
      const normalizedDifficulty = difficulty.toUpperCase() as ProblemDifficulty;
      if (!validDifficulties.includes(normalizedDifficulty)) {
        throw new BadRequestException(`Difficulty must be one of: ${validDifficulties.join(", ")}`);
      }
      problem.difficulty = normalizedDifficulty;
    }

    const saved = await repo.save(problem);

    return {
      problem: {
        id: saved.id,
        title: saved.title,
        difficulty: saved.difficulty,
        targetVolume: saved.targetVolume,
        tolerance: saved.tolerance,
        goldenFileKey: saved.goldenFileKey,
      },
    };
  }
}
