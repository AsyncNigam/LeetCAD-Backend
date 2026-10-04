import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Webhook } from "./webhook.entity.js";
import { WebhooksService } from "./webhooks.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Webhook])],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
