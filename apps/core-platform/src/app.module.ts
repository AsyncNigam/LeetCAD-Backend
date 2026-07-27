import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { SubmissionsModule } from "./submissions/submissions.module.js";
import { Submission } from "./entities/Submission.js";
import { OutboxEvent } from "./entities/OutboxEvent.js";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "leetcad",
      password: "leetcad_dev",
      database: "leetcad_db",
      entities: [Submission, OutboxEvent],
      synchronize: true,
    }),
    AuthModule,
    StorageModule,
    SubmissionsModule,
  ],
})
export class AppModule {}

