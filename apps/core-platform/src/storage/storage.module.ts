import { Module } from "@nestjs/common";
import { StorageController } from "./storage.controller.js";
import { StorageService } from "./storage.service.js";

@Module({
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
