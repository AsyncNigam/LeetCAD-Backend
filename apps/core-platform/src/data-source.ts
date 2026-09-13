import "reflect-metadata";
import { DataSource } from "typeorm";
import { Submission } from "./entities/Submission.js";
import { OutboxEvent } from "./entities/OutboxEvent.js";
import { User } from "./entities/User.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USER || "leetcad",
  password: process.env.DB_PASSWORD || "leetcad_dev",
  database: process.env.DB_NAME || "leetcad_db",
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : false,
  synchronize: true,
  logging: false,
  entities: [Submission, OutboxEvent, User],
});
