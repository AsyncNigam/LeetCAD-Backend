import "./observability/tracing.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { WinstonModule } from "nest-winston";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module.js";
import { winstonConfig } from "./observability/logger.config.js";
import { DataSource } from "typeorm";
import { Problem, ProblemDifficulty } from "./entities/Problem.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: WinstonModule.createLogger(winstonConfig) },
  );

  app.setGlobalPrefix("api");
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
  });
  
  const allowedOrigins = process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',') 
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];

  app.enableCors({ 
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("LeetCAD Core API")
    .setDescription("Interactive API documentation for LeetCAD.")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  // Seed default problem
  const dataSource = app.get(DataSource);
  const problemRepo = dataSource.getRepository(Problem);
  const existingProblem = await problemRepo.findOne({ where: {} });
  if (!existingProblem) {
    const seedProblem = problemRepo.create({
      id: "00000000-0000-0000-0000-000000000001", // fixed ID for testing
      title: "Calibration Cube (20mm)",
      description: "A standard 20mm x 20mm x 20mm calibration cube.",
      difficulty: ProblemDifficulty.EASY,
      goldenFileKey: "problems/calibration-cube-golden.step",
      targetVolume: 8000.0,
      tolerance: 0.1,
    });
    await problemRepo.save(seedProblem);
    console.log("Seeded default Problem: Calibration Cube");
  }

  await app.listen(3000, "0.0.0.0");
}

bootstrap();
