import { createWriteStream } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import amqplib from "amqplib";
import Redis from "ioredis";
import pg from "pg";
import { v4 as uuidv4 } from "uuid";
import { SubmissionStatus } from "@leetcad/shared-types";
import type { SubmissionCreatedPayload, AssessmentCompletedPayload } from "@leetcad/shared-types";

const s3 = new S3Client({
  endpoint: process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : (process.env.S3_ENDPOINT || "http://localhost:9000"),
  region: process.env.R2_ACCOUNT_ID ? "auto" : (process.env.S3_REGION || "us-east-1"),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || process.env.S3_ACCESS_KEY || "leetcad",
    secretAccessKey: process.env.R2_SECRET_KEY || process.env.S3_SECRET_KEY || "leetcad_dev",
  },
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || "true") === "true",
});

const S3_BUCKET = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET || "leetcad";

import { LLMRouter } from "./llm-router.js";
const llmRouter = new LLMRouter();

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

const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        user: process.env.DB_USER || "leetcad",
        password: process.env.DB_PASSWORD || "leetcad_dev",
        database: process.env.DB_NAME || "leetcad_db",
      }
);

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

const PROCESS_TIMEOUT_MS = 30_000;

function runPython(inputPath: string, outputPath: string, goldenPath?: string): Promise<{ metrics: any; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    // Windows dev environment safety fallback for python binary
    const bin = process.platform === "win32" ? "python" : "python3";
    const args = [
      join(__dirname, "../sandbox/analyze_cad.py"),
      "--input", inputPath,
      "--output", outputPath,
    ];
    if (goldenPath) {
      args.push("--golden-file", goldenPath);
    }
    const proc = spawn(bin, args);

    let stdoutData = "";
    let stderrData = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, PROCESS_TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => { stdoutData += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderrData += chunk.toString(); });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 139 || signal === 'SIGSEGV' || code === 137 || signal === 'SIGKILL') {
        const err = new Error("Catastrophic failure: The uploaded geometry caused a rendering engine crash.");
        (err as any).isKernelPanic = true;
        return reject(err);
      }
      if (killed) {
        return reject(new Error("Worker timeout: CadQuery geometric analysis exceeded 30 seconds."));
      }
      if (code !== 0) {
        return reject(new Error(`Python exited with ${code}:${stderrData}`));
      }

      let parsed;
      try {
        parsed = JSON.parse(stdoutData);
      } catch (err) {
        const firstBrace = stdoutData.indexOf("{");
        const lastBrace = stdoutData.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const sanitized = stdoutData.substring(firstBrace, lastBrace + 1);
          try {
            parsed = JSON.parse(sanitized);
          } catch (sanitizeErr) {
            return reject(new Error(`Failed to parse sanitized python output: ${stdoutData}`));
          }
        } else {
          return reject(new Error(`Failed to parse python output: ${stdoutData}`));
        }
      }
      resolve({ metrics: parsed.metrics, stderr: stderrData, code: code ?? 0 });
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

  await channel.assertExchange("leetcad.events", "topic", { durable: true });
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

  // LLMRouter handles its own initialization and provider discovery.

  console.log("[assessment-engine] Waiting for messages on submissions.queue");

  await channel.consume("submissions.queue", async (msg) => {
    if (!msg) return;

    const payload: SubmissionCreatedPayload = JSON.parse(msg.content.toString());
    const jobId = uuidv4();
    const inputPath = join(tmpdir(), `${jobId}-input.step`);
    const outputPath = join(tmpdir(), `${jobId}-output.png`);



    let goldenFileKey: string | null = null;
    let goldenPath: string | null = null;
    let targetVolume: number | null = null;
    let tolerance: number | null = null;

    try {
      console.log(`[assessment-engine] [${jobId}] Started processing submission ${payload.submissionId}`);
      // 0. Fetch problem info for golden file
      const dbResult = await pool.query(
        `SELECT p."goldenFileKey", p."targetVolume", p.tolerance FROM problems p JOIN submissions s ON s."problemId" = p.id WHERE s.id = $1`,
        [payload.submissionId]
      );
      if (dbResult.rows.length > 0) {
        goldenFileKey = dbResult.rows[0].goldenFileKey;
        targetVolume = dbResult.rows[0].targetVolume;
        tolerance = dbResult.rows[0].tolerance;
      }
      console.log(`[assessment-engine] [${jobId}] Fetched problem info, goldenFileKey=${goldenFileKey}`);

      if (goldenFileKey) {
        goldenPath = join(tmpdir(), `${jobId}-golden.step`);
        try {
          console.log(`[assessment-engine] [${jobId}] Fetching golden file from S3...`);
          const getGolden = await s3.send(new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: goldenFileKey,
          }));
          if (getGolden.Body) {
            await pipeline(getGolden.Body as Readable, createWriteStream(goldenPath));
          }
          console.log(`[assessment-engine] [${jobId}] Golden file fetched.`);
        } catch (e: any) {
          throw new Error(`Failed to fetch golden file from R2 (Key: ${goldenFileKey}): ${e.message}`);
        }
      }
      
      let getObject;
      try {
        console.log(`[assessment-engine] [${jobId}] Fetching user submission from S3...`);
        getObject = await s3.send(new GetObjectCommand({
          Bucket: payload.bucketName,
          Key: payload.fileKey,
        }));
      } catch (e: any) {
        throw new Error(`Failed to fetch user submission file from R2 (Key: ${payload.fileKey}): ${e.message}`);
      }

      if (!getObject.Body) {
        throw new Error(`Empty response body for key ${payload.fileKey}`);
      }

      const bodyStream = getObject.Body as Readable;
      await pipeline(bodyStream, createWriteStream(inputPath));
      console.log(`[assessment-engine] [${jobId}] User submission fetched.`);

      let runResult;
      try {
        console.log(`[assessment-engine] [${jobId}] Starting python geometry analysis...`);
        runResult = await runPython(inputPath, outputPath, goldenPath || undefined);
        console.log(`[assessment-engine] [${jobId}] Python geometry analysis finished.`);
      } catch (pyErr) {
        console.error(`[assessment-engine] [${jobId}] Python execution error:`, pyErr);
        throw pyErr; // Throw to outer catch block to trigger UI failure state
      }

      const { metrics } = runResult;

      const pngBuffer = await readFile(outputPath);
      const pngBase64 = pngBuffer.toString("base64");

      // 1. Deterministic Geometric Scoring (60 Points)
      let deterministicScore = 0;
      let svRatio = 0;

      const { volume, surfaceArea, boundingBox, centerOfMass, variance_mm3 } = metrics;
      const isValid = boundingBox && boundingBox.length === 6 && volume > 0 && surfaceArea > 0;

      if (!isValid) {
        deterministicScore = 0;
      } else if (variance_mm3 !== undefined && targetVolume !== null && tolerance !== null) {
        svRatio = surfaceArea / volume;
        const errorMargin = variance_mm3 / targetVolume;

        if (variance_mm3 === -1 || errorMargin > tolerance) {
          deterministicScore = 0;
        } else {
          // Scale 60 points linearly based on how close variance_mm3 is to 0
          deterministicScore = (1 - (errorMargin / tolerance)) * 60;
        }
      } else {
        svRatio = surfaceArea / volume;
        // Grant full 60 points if geometry metrics are valid and no golden comparison available
        deterministicScore = 60;
      }

      // 2. Gemini Multimodal Evaluation (40 Points)
      let aiScore = 0;
      let aiReport = "";

      if (isValid) {
        try {
          const metricsPrompt = [
            "You are a senior mechanical engineer performing a quantitative and qualitative design review of a CAD model.",
            "The following physical metrics were extracted from the model:",
            `- Volume: ${volume} cubic units`,
            `- Surface Area: ${surfaceArea} square units`,
            `- Bounding Box: [${boundingBox.join(", ")}]`,
            `- Center of Mass: [${centerOfMass.join(", ")}]`,
            variance_mm3 !== undefined && tolerance !== null
              ? `- The boolean difference between the target model and the user model is ${variance_mm3} mm³. The allowed tolerance is ${tolerance}.`
              : "",
            "",
            "Based on the rendered image and these metrics, perform a rigorous engineering assessment.",
            "Calculate a numerical quality score from 0 to 40 by evaluating the following criteria:",
            "  - Geometry validity and watertightness (0–10 points)",
            "  - Material efficiency / surface-to-volume ratio (0–10 points)",
            "  - Symmetry and center of mass positioning (0–10 points)",
            "  - Manufacturability and wall thickness adequacy (0–10 points)",
            "",
            variance_mm3 !== undefined && tolerance !== null
              ? "If the boolean variance significantly exceeds the tolerance, this means the user uploaded the completely wrong part. You MUST output an aiScore of 0 and state that the geometry fails the problem constraints."
              : "",
            "Return your response as JSON matching the requested schema."
          ].filter(Boolean).join("\n");

          const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
              aiScore: {
                type: Type.INTEGER,
                description: "Numerical quality score from 0 to 40."
              },
              reportMarkdown: {
                type: Type.STRING,
                description: "Detailed Markdown engineering review."
              }
            },
            required: ["aiScore", "reportMarkdown"]
          };


          // 3. Evaluate using LLM Router with multi-provider fallback
          try {
            console.log(`[assessment-engine] [${jobId}] Calling LLMRouter for evaluation...`);
            const llmResult = await llmRouter.evaluate(pngBase64, metricsPrompt);

            if (llmResult) {
              aiScore = llmResult.score;
              aiReport = llmResult.report;
              console.log(`[assessment-engine] [${jobId}] LLM Evaluation successful, score=${aiScore}, provider=${llmResult.provider}`);
            } else {
              throw new Error("All LLM providers failed or timed out.");
            }
          } catch (aiErr) {
            console.error(`[assessment-engine] [${jobId}] AI evaluation failed or timed out:`, aiErr);
            aiScore = 0;
            aiReport = "> **System Notice:** AI evaluation timed out or is currently unavailable. Score reflects deterministic geometric metrics only.\n\n" +
              "## Metrics\n" +
              `- **Volume:** ${volume.toFixed(2)} cubic units\n` +
              `- **Surface Area:** ${surfaceArea.toFixed(2)} square units\n` +
              `- **Surface-to-Volume Ratio (SVR):** ${svRatio.toFixed(4)}\n\n` +
              "## Score Breakdown\n" +
              `- Deterministic Score: **${deterministicScore}/60**\n` +
              `- AI Score: **0/40** (Unavailable)\n`;
          }
      } else {
        aiReport = "> **System Notice:** Invalid geometry detected. Bounding box or volume is invalid.";
      }

      // 4. Score Aggregation
      const score = deterministicScore + aiScore;

      const reportKey = `reports/${payload.submissionId}.md`;
      const renderKey = `renders/${payload.submissionId}.png`;

      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: reportKey,
        Body: new TextEncoder().encode(aiReport),
        ContentType: "text/markdown",
      }));

      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: renderKey,
        Body: new Uint8Array(pngBuffer),
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

        channel.ack(msg);
        return;
      }


      // ── Unified State Transition ──────────────────────────────
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

        channel.ack(msg);
        return;
      }

      // Update Redis global leaderboard
      const userEmail = payload.userId; // userId carries the email in our system
      await redis.zadd("leetcad:leaderboard", score, userEmail);

      // Emit realtime event for WebSocket push
      await redis.publish("leetcad:events", JSON.stringify({
        type: "assessment.completed",
        submissionId: payload.submissionId,
        score,
      }));

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



      channel.ack(msg);
    } catch (error: any) {
      console.error(`[assessment-engine] Job ${jobId} failed:`, error);
      // ── Graceful failure: update DB + notify frontend so UI doesn't hang ──
      try {
        if (error.isKernelPanic) {
          await pool.query(
            `UPDATE submissions SET status = $1, report = $2, score = 0 WHERE id = $3 AND status != 'COMPLETED'`,
            ['FAILED_KERNEL_PANIC', 'Catastrophic failure: The uploaded geometry caused a rendering engine crash.', payload.submissionId],
          );
        } else {
          await pool.query(
            `UPDATE submissions SET status = $1, score = 0 WHERE id = $2 AND status != 'COMPLETED'`,
            [SubmissionStatus.FAILED, payload.submissionId],
          );
        }
        const failPayload: AssessmentCompletedPayload = {
          submissionId: payload.submissionId,
          userId: payload.userId,
          status: error.isKernelPanic ? 'FAILED_KERNEL_PANIC' as any : SubmissionStatus.FAILED,
          score: 0,
          aiReportId: "",
          metrics: { volume: 0, surfaceArea: 0, centerOfMass: [0, 0, 0] },
          renderUrls: [],
        };
        channel.publish(
          "leetcad.events",
          "AssessmentCompleted",
          Buffer.from(JSON.stringify(failPayload)),
          { persistent: true, contentType: "application/json" },
        );
      } catch (notifyErr) {
        console.error(`[assessment-engine] Could not notify frontend of failure:`, notifyErr);
      }
      channel.nack(msg, false, false);
    } finally {
      await cleanupFile(inputPath);
      await cleanupFile(outputPath);
      if (goldenPath) {
        await cleanupFile(goldenPath);
      }
    }
  });
}

main().catch((err) => {
  console.error("[assessment-engine] Fatal error:", err);
  process.exit(1);
});
