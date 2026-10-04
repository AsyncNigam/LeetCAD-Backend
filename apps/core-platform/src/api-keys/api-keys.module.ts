import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiKey } from "./api-key.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  exports: [TypeOrmModule],
})
export class ApiKeysModule {}
