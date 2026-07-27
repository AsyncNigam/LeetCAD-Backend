import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import amqplib from "amqplib";
import { v4 as uuidv4 } from "uuid";
import type { SubmissionCreatedPayload } from "@leetcad/shared-types";

const s3 = new S3Client({
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "minio_admin",
    secretAccessKey: "local_password",
  },
  forcePathStyle: true,
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
  const connection = await amqplib.connect("amqp://rmq_admin:local_password@localhost:5672");
  const channel = await connection.createChannel();

  await channel.prefetch(1);

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
      console.log(`[assessment-engine] Analysis complete for ${payload.submissionId}:`, analysisResult);

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
