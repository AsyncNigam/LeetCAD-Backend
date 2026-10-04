import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHmac } from "node:crypto";
import { Webhook } from "./webhook.entity.js";
import { decrypt } from "../common/utils/crypto.util.js";

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly webhooksRepository: Repository<Webhook>,
  ) {}

  async dispatch(userId: string, payload: any): Promise<void> {
    try {
      const webhook = await this.webhooksRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!webhook) {
        // No active webhook for this user
        return;
      }

      const decryptedSecret = decrypt(webhook.signingSecret);
      const payloadString = JSON.stringify(payload);
      
      const signature = createHmac("sha256", decryptedSecret)
        .update(payloadString)
        .digest("hex");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      this.logger.log(`Dispatching webhook for user ${userId} to ${webhook.targetUrl}`);

      const response = await fetch(webhook.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-leetcad-signature": signature,
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(
          `Webhook delivery failed for user ${userId} (Status: ${response.status})`
        );
      } else {
        this.logger.log(`Webhook delivered successfully for user ${userId}`);
      }
    } catch (error: any) {
      this.logger.error(`Webhook dispatch error for user ${userId}: ${error.message}`, error.stack);
    }
  }
}
