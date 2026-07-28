import "reflect-metadata";
import { DataSource } from "typeorm";
import { Submission } from "./entities/Submission.js";
import { OutboxEvent } from "./entities/OutboxEvent.js";
import { User } from "./entities/User.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "leetcad",
  password: "leetcad_dev",
  database: "leetcad_db",
  synchronize: true,
  logging: false,
  entities: [Submission, OutboxEvent, User],
});
