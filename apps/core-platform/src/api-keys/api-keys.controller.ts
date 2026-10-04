import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ApiKeysService } from "./api-keys.service.js";
import type { CreateApiKeyDto } from "./dto/create-api-key.dto.js";

// ── Types ───────────────────────────────────────────────────

interface AuthenticatedRequest {
  user: { userId: string };
}

// ── Controller ──────────────────────────────────────────────

@Controller("api-keys")
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  // ── POST /api/api-keys ────────────────────────────────────
  // Generate a new Developer API key.
  // ⚠️  The `rawKey` is returned EXACTLY ONCE in this response.
  //     It is never stored and cannot be retrieved again.

  @Post()
  async createKey(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateApiKeyDto,
  ) {
    const name = body?.name?.trim();
    if (!name || name.length === 0) {
      throw new BadRequestException("Key name is required.");
    }
    if (name.length > 255) {
      throw new BadRequestException("Key name must be 255 characters or fewer.");
    }

    const { rawKey, apiKey } = await this.apiKeysService.generateKey(
      req.user.userId,
      name,
    );

    return {
      // ⚠️  ONLY time the plaintext key is transmitted.
      rawKey,
      id: apiKey.id,
      name: apiKey.name,
      createdAt: apiKey.createdAt,
    };
  }

  // ── GET /api/api-keys ─────────────────────────────────────
  // List all keys belonging to the authenticated user.
  // CRITICAL: keyHash is stripped — the frontend only needs
  //           id, name, createdAt, lastUsedAt, and isActive.

  @Get()
  async listKeys(@Req() req: AuthenticatedRequest) {
    const keys = await this.apiKeysService.listKeys(req.user.userId);

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      isActive: k.isActive,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  }

  // ── DELETE /api/api-keys/:id ──────────────────────────────
  // Soft-revoke a key by setting isActive = false.
  // Ownership is enforced: userId must match the record.

  @Delete(":id")
  async revokeKey(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    const revoked = await this.apiKeysService.revokeKey(id, req.user.userId);

    if (!revoked) {
      throw new NotFoundException("API key not found or already revoked.");
    }

    return { message: "API key revoked successfully.", id };
  }
}
