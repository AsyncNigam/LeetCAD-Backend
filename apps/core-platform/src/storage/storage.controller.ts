import { Controller, Post, Body, Req, UseGuards, UsePipes } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { StorageService } from "./storage.service.js";
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
  constructor(private readonly storageService: StorageService) {}

  @Post("presigned-url")
  @ApiOperation({ summary: "Generate MinIO Presigned URL for CAD Upload" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["filename", "contentType"],
      properties: {
        filename: { type: "string", description: "Name of the CAD file" },
        contentType: { type: "string", description: "MIME type of the file" },
      },
    },
  })
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
