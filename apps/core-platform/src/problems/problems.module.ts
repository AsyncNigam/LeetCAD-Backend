import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Problem } from "../entities/Problem.js";
import { ProblemsController } from "./problems.controller.js";

@Module({
  imports: [TypeOrmModule.forFeature([Problem])],
  controllers: [ProblemsController],
})
export class ProblemsModule {}
