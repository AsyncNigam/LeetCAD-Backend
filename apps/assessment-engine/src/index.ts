import { createWriteStream } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";
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

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "local_mock_key",
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
                  "You are a senior mechanical engineer performing a qualitative design review of a CAD model.",
                  "The following physical metrics were extracted from the model:",
                  `- Volume: ${metrics.volume} cubic units`,
                  `- Surface Area: ${metrics.surfaceArea} square units`,
                  `- Center of Mass: [${metrics.centerOfMass.join(", ")}]`,
                  "",
                  "Based on the rendered image and these metrics, provide a detailed engineering review.",
                  "Assess structural integrity, material efficiency (surface-to-volume ratio),",
                  "symmetry, center of mass positioning, and any potential manufacturing concerns.",
                  "Format your response as a structured Markdown report.",
                ].join("\n"),
              },
            ],
          },
        ],
      });

      const aiReport = geminiResponse.text ?? "No report generated.";

      const reportKey = `reports/${payload.submissionId}.md`;
      const renderKey = `renders/${payload.submissionId}.png`;

      await s3.send(new PutObjectCommand({
        Bucket: "leetcad",
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

      console.log(`[assessment-engine] Assessment complete for ${payload.submissionId}:`, {
        metrics,
        reportKey,
        renderKey,
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
