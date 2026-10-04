import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomBytes } from "node:crypto";
import { Webhook } from "./webhook.entity.js";
import { encrypt } from "../common/utils/crypto.util.js";

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Webhook)
    private readonly webhooksRepository: Repository<Webhook>,
  ) {}

  async registerWebhook(
    userId: string,
    targetUrl: string,
  ): Promise<{ webhook: Webhook; rawSecret: string }> {
    // Generate a random 32-byte cryptographically secure string
    const rawSecret = randomBytes(32).toString("hex");

    // Encrypt the raw secret
    const encryptedSecret = encrypt(rawSecret);

    // Save to database
    const webhook = this.webhooksRepository.create({
      userId,
      targetUrl,
      signingSecret: encryptedSecret,
      isActive: true,
    });

    await this.webhooksRepository.save(webhook);

    // Return the raw secret EXACTLY ONCE to the user
    return { webhook, rawSecret };
  }
}
