import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller.js";
import { StorageModule } from "../storage/storage.module.js";

@Module({
  imports: [StorageModule],
  controllers: [AdminController],
})
export class AdminModule {}
