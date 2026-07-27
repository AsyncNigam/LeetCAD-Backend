import { Controller, Post, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { StorageService } from "./storage.service.js";

interface PresignedUrlRequest {
  filename: string;
}

interface AuthenticatedRequest {
  user: { userId: string };
}

@Controller("storage")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post("presigned-url")
  @UseGuards(JwtAuthGuard)
  async getPresignedUrl(
    @Req() req: AuthenticatedRequest,
    @Body() body: PresignedUrlRequest,
  ) {
    return this.storageService.getPresignedUploadUrl(
      req.user.userId,
      body.filename,
    );
  }
}
