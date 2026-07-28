import { Controller, Post, Body, Req, UseGuards, UsePipes } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { StorageService } from "./storage.service.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { PresignedUrlSchema } from "./dto/presigned-url.dto.js";
import type { PresignedUrlDto } from "./dto/presigned-url.dto.js";

interface AuthenticatedRequest {
  user: { userId: string };
}

@Controller("storage")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post("presigned-url")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(PresignedUrlSchema))
  async getPresignedUrl(
    @Req() req: AuthenticatedRequest,
    @Body() body: PresignedUrlDto,
  ) {
    return this.storageService.getPresignedUploadUrl(
      req.user.userId,
      body.filename,
    );
  }
}
