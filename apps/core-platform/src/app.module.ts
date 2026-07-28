import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { SubmissionsModule } from "./submissions/submissions.module.js";
import { RelayModule } from "./relay/relay.module.js";
import { Submission } from "./entities/Submission.js";
import { OutboxEvent } from "./entities/OutboxEvent.js";
import { User } from "./entities/User.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "leetcad",
      password: "leetcad_dev",
      database: "leetcad_db",
      entities: [Submission, OutboxEvent, User],
      synchronize: true,
    }),
    AuthModule,
    StorageModule,
    SubmissionsModule,
    RelayModule,
  ],
})
export class AppModule {}
