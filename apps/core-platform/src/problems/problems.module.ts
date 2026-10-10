import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Problem } from "../entities/Problem.js";
import { ProblemsController } from "./problems.controller.js";
import { StorageModule } from "../storage/storage.module.js";

@Module({
  imports: [TypeOrmModule.forFeature([Problem]), StorageModule],
  controllers: [ProblemsController],
})
export class ProblemsModule {}
