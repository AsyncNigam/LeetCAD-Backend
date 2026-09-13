import { createWriteStream } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI, Type } from "@google/genai";
import amqplib from "amqplib";
import Redis from "ioredis";
import pg from "pg";
import { v4 as uuidv4 } from "uuid";
import { SubmissionStatus } from "@leetcad/shared-types";
import type { SubmissionCreatedPayload, AssessmentCompletedPayload } from "@leetcad/shared-types";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "leetcad",
    secretAccessKey: process.env.S3_SECRET_KEY || "leetcad_dev",
  },
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || "true") === "true",
});

const S3_BUCKET = process.env.S3_BUCKET || "leetcad";

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "local_mock_key",
});

function buildRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || "localhost";
  const port = process.env.REDIS_PORT || "6379";
  const password = process.env.REDIS_PASSWORD;
  return password
    ? `redis://:${password}@${host}:${port}`
    : `redis://${host}:${port}`;
}

const redis = new Redis(buildRedisUrl());

const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER || "leetcad",
  password: process.env.DB_PASSWORD || "leetcad_dev",
  database: process.env.DB_NAME || "leetcad_db",
});

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

const PROCESS_TIMEOUT_MS = 60_000;

function runPython(inputPath: string, outputPath: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [
      "src/sandbox/analyze_cad.py",
      "--input", inputPath,
      "--output", outputPath,
    ], { cwd: join(process.cwd()) });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, PROCESS_TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(new Error(`Process killed due to ${PROCESS_TIMEOUT_MS / 1000}s timeout`));
        return;
      }
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

async function main(): Promise<void> {
  const connection = await amqplib.connect(process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672");
  const channel = await connection.createChannel();

  connection.on("error", (err) => {
    console.error("[assessment-engine] RabbitMQ connection error:", err.message);
  });

  connection.on("close", () => {
    console.error("[assessment-engine] RabbitMQ connection closed unexpectedly, exiting...");
    process.exit(1);
  });

  channel.on("error", (err) => {
    console.error("[assessment-engine] RabbitMQ channel error:", err.message);
  });

  await channel.prefetch(1);

  const shutdown = async () => {
    console.log("[assessment-engine] Shutting down gracefully...");
    await channel.close();
    await connection.close();
    await pool.end();
    redis.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[assessment-engine] Waiting for messages on leetcad.assessment.queue");

  await channel.consume("leetcad.assessment.queue", async (msg) => {
    if (!msg) return;

    const payload: SubmissionCreatedPayload = JSON.parse(msg.content.toString());
    const jobId = uuidv4();
    const inputPath = join(tmpdir(), `${jobId}-input.step`);
    const outputPath = join(tmpdir(), `${jobId}-output.png`);

    console.log(`[assessment-engine] Processing job ${jobId} for submission ${payload.submissionId}`);

    try {
      const getObject = await s3.send(new GetObjectCommand({
        Bucket: payload.bucketName,
        Key: payload.fileKey,
      }));

      if (!getObject.Body) {
        throw new Error(`Empty response body for key ${payload.fileKey}`);
      }

      const bodyStream = getObject.Body as Readable;
      await pipeline(bodyStream, createWriteStream(inputPath));

      const result = await runPython(inputPath, outputPath);

      if (result.code !== 0) {
        console.error(`[assessment-engine] Python process exited with code ${result.code}`);
        console.error(`[assessment-engine] stderr: ${result.stderr}`);
        channel.nack(msg, false, false);
        return;
      }

      const analysisResult = JSON.parse(result.stdout);
      const { metrics } = analysisResult;

      const pngBuffer = await readFile(outputPath);
      const pngBase64 = pngBuffer.toString("base64");

      const geminiResponse = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: pngBase64,
                },
              },
              {
                text: [
                  "You are a senior mechanical engineer performing a quantitative and qualitative design review of a CAD model.",
                  "The following physical metrics were extracted from the model:",
                  `- Volume: ${metrics.volume} cubic units`,
                  `- Surface Area: ${metrics.surfaceArea} square units`,
                  `- Bounding Box: [${metrics.boundingBox?.join(", ") ?? "N/A"}]`,
                  `- Center of Mass: [${metrics.centerOfMass.join(", ")}]`,
                  "",
                  "Based on the rendered image and these metrics, perform a rigorous engineering assessment.",
                  "Calculate a numerical quality score from 0 to 100 by evaluating the following criteria:",
                  "  - Geometry validity and watertightness (0–25 points)",
                  "  - Material efficiency / surface-to-volume ratio (0–25 points)",
                  "  - Symmetry and center of mass positioning (0–25 points)",
                  "  - Manufacturability and wall thickness adequacy (0–25 points)",
                  "",
                  "Return the total score as an integer in the 'score' field.",
                  "Provide a detailed engineering review as a structured Markdown report in the 'report' field.",
                ].join("\n"),
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: {
                type: Type.NUMBER,
                description: "CAD quality score from 0 to 100",
                minimum: 0,
                maximum: 100,
              },
              report: {
                type: Type.STRING,
                description: "Detailed Markdown engineering review report",
              },
            },
            required: ["score", "report"],
          },
        },
      });

      let score: number;
      let aiReport: string;

      try {
        const parsed = JSON.parse(geminiResponse.text ?? "");
        score = Math.max(0, Math.min(100, Number(parsed.score)));
        if (Number.isNaN(score)) {
          throw new Error("Parsed score is NaN");
        }
        aiReport = typeof parsed.report === "string" && parsed.report.length > 0
          ? parsed.report
          : "No report generated.";
      } catch (parseErr) {
        console.warn(
          `[assessment-engine] Failed to parse structured Gemini response for submissionId=${payload.submissionId}. Using deterministic fallback.`,
          parseErr,
        );
        const svRatio = metrics.surfaceArea > 0 ? metrics.volume / metrics.surfaceArea : 0;
        score = Math.max(0, Math.min(100, Math.round(svRatio * 100)));
        aiReport = "Assessment report could not be generated. Fallback score computed from surface-to-volume ratio.";
      }

      const reportKey = `reports/${payload.submissionId}.md`;
      const renderKey = `renders/${payload.submissionId}.png`;

      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: reportKey,
        Body: aiReport,
        ContentType: "text/markdown",
      }));

      await s3.send(new PutObjectCommand({
        Bucket: "leetcad",
        Key: renderKey,
        Body: pngBuffer,
        ContentType: "image/png",
      }));

      let fence: number;
      try {
        fence = await redis.incr(`submission:${payload.submissionId}:fence`);
        if (fence === 1) {
          await redis.expire(`submission:${payload.submissionId}:fence`, 86_400);
        }
      } catch (redisErr) {
        console.error(`[assessment-engine] Redis fence check failed for submissionId=${payload.submissionId}:`, redisErr);
        channel.nack(msg, false, true);
        return;
      }

      if (fence > 1) {
        console.warn(`[assessment-engine] Zombie worker or duplicate delivery detected. Dropping write. submissionId=${payload.submissionId} fence=${fence}`);
        channel.ack(msg);
        return;
      }


      const updateResult = await pool.query(
        `UPDATE submissions SET status = $1, score = $2, "aiReportId" = $3, metrics = $4 WHERE id = $5 AND status != 'COMPLETED'`,
        [
          SubmissionStatus.COMPLETED,
          score,
          reportKey,
          JSON.stringify(metrics),
          payload.submissionId,
        ],
      );

      if (updateResult.rowCount === 0) {
        console.warn(`[assessment-engine] Submission ${payload.submissionId} already resolved or not found. Dropping redundant write.`);
        channel.ack(msg);
        return;
      }

      const completedPayload: AssessmentCompletedPayload = {
        submissionId: payload.submissionId,
        userId: payload.userId,
        status: SubmissionStatus.COMPLETED,
        score,
        aiReportId: reportKey,
        metrics,
        renderUrls: [renderKey],
      };

      channel.publish(
        "leetcad.events",
        "AssessmentCompleted",
        Buffer.from(JSON.stringify(completedPayload)),
        { persistent: true, contentType: "application/json" },
      );

      console.log(`[assessment-engine] Assessment complete for ${payload.submissionId}:`, {
        metrics,
        reportKey,
        renderKey,
        fence,
      });

      channel.ack(msg);
    } catch (error) {
      console.error(`[assessment-engine] Job ${jobId} failed:`, error);
      channel.nack(msg, false, false);
    } finally {
      await cleanupFile(inputPath);
      await cleanupFile(outputPath);
    }
  });
}

main().catch((err) => {
  console.error("[assessment-engine] Fatal error:", err);
  process.exit(1);
});
