import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import crypto from "node:crypto";
import { ApiKey } from "./api-key.entity.js";

// ── Constants ───────────────────────────────────────────────
const KEY_PREFIX = "lc_live_";
const RANDOM_BYTES = 32;

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  // ── Key Generation ────────────────────────────────────────
  // Returns the raw key exactly ONCE so the controller can
  // surface it to the user. After this call the plaintext is
  // permanently discarded — only the SHA-256 hash is persisted.

  async generateKey(
    userId: string,
    name: string,
  ): Promise<{ rawKey: string; apiKey: ApiKey }> {
    const randomStr = crypto.randomBytes(RANDOM_BYTES).toString("hex");
    const rawKey = KEY_PREFIX + randomStr;
    const keyHash = crypto
      .createHash("sha256")
      .update(rawKey)
      .digest("hex");

    const apiKey = this.apiKeyRepo.create({
      userId,
      name,
      keyHash,
    });

    const saved = await this.apiKeyRepo.save(apiKey);

    return { rawKey, apiKey: saved };
  }

  // ── Key Validation ────────────────────────────────────────
  // Hashes the incoming raw key and looks up the matching
  // active record. Updates `lastUsedAt` on every successful
  // validation so operators can identify stale keys.

  async validateKey(rawKey: string): Promise<ApiKey | null> {
    const keyHash = crypto
      .createHash("sha256")
      .update(rawKey)
      .digest("hex");

    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash, isActive: true },
    });

    if (!apiKey) {
      return null;
    }

    // Fire-and-forget timestamp update — never block the
    // auth hot-path on a non-critical write.
    apiKey.lastUsedAt = new Date();
    this.apiKeyRepo.save(apiKey).catch(() => {
      /* intentionally swallowed — lastUsedAt is advisory */
    });

    return apiKey;
  }

  // ── Key Revocation ────────────────────────────────────────

  async revokeKey(id: string, userId: string): Promise<boolean> {
    const result = await this.apiKeyRepo.update(
      { id, userId, isActive: true },
      { isActive: false },
    );
    return (result.affected ?? 0) > 0;
  }

  // ── List Keys (for the owner) ─────────────────────────────

  async listKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }
}
