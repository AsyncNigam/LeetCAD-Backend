import "./observability/tracing.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { WinstonModule } from "nest-winston";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module.js";
import { winstonConfig } from "./observability/logger.config.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: WinstonModule.createLogger(winstonConfig) },
  );

  await app.register(helmet);
  app.enableCors({ origin: true, credentials: true });

  await app.listen(3000, "0.0.0.0");
}

bootstrap();
