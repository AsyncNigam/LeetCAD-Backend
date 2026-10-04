import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiKey } from "./api-key.entity.js";
import { ApiKeysService } from "./api-keys.service.js";
import { ApiKeysController } from "./api-keys.controller.js";

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [TypeOrmModule, ApiKeysService],
})
export class ApiKeysModule {}
