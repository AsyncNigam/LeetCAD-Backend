import { Controller, Post, Body, Req, UseGuards, UsePipes, NotFoundException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { DataSource } from "typeorm";
import { HybridAuthGuard } from "../auth/hybrid-auth.guard.js";
import { StorageService } from "./storage.service.js";
import { Problem } from "../entities/Problem.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { PresignedUrlSchema } from "./dto/presigned-url.dto.js";
import type { PresignedUrlDto } from "./dto/presigned-url.dto.js";

interface AuthenticatedRequest {
  user: { userId: string };
}

@ApiTags("Storage")
@ApiBearerAuth()
@Controller("storage")
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  @Post("presigned-url")
  @ApiOperation({ summary: "Generate MinIO Presigned URL for CAD Upload" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["filename", "contentType", "problemId"],
      properties: {
        filename: { type: "string", description: "Name of the CAD file" },
        contentType: { type: "string", description: "MIME type of the file" },
        problemId: { type: "string", description: "UUID of the problem statement" },
      },
    },
  })
  @UseGuards(HybridAuthGuard)
  @UsePipes(new ZodValidationPipe(PresignedUrlSchema))
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async getPresignedUrl(
    @Req() req: AuthenticatedRequest,
    @Body() body: PresignedUrlDto,
  ) {
    const problem = await this.dataSource.getRepository(Problem).findOne({ where: { id: body.problemId } });
    if (!problem) {
      throw new NotFoundException("Problem statement not found");
    }

    return this.storageService.getPresignedUploadUrl(
      req.user.userId,
      body.filename,
    );
  }
}
