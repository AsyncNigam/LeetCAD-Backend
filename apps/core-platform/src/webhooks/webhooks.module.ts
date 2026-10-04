import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Webhook } from "./webhook.entity.js";
import { WebhooksService } from "./webhooks.service.js";
import { WebhookDispatcherService } from "./webhook.dispatcher.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Webhook])],
  providers: [WebhooksService, WebhookDispatcherService],
  exports: [WebhooksService, WebhookDispatcherService],
})
export class WebhooksModule {}
