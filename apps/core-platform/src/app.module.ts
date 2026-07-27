import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { StorageModule } from "./storage/storage.module.js";

@Module({
  imports: [AuthModule, StorageModule],
})
export class AppModule {}
