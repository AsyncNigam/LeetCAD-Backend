import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { getConfig } from "../utils/config.js";

const API_BASE_URL = process.env.LEETCAD_API_URL || "http://localhost:3000/api";

export function registerSubmitCommand(program: Command) {
  program
    .command("submit")
    .description("Upload and assess a local CAD file against a LeetCAD problem")
    .argument("<filepath>", "Path to the local .step file")
    .requiredOption("-p, --problem <problemId>", "UUID of the problem statement")
    .action(async (filepath: string, options: { problem: string }) => {
      const config = getConfig();

      if (!config || !config.apiKey) {
        console.error(
          "\x1b[31mError: Unauthenticated. Please run `leetcad login <api-key>` first.\x1b[0m"
        );
        process.exit(1);
      }

      // 1. File validation
      const resolvedPath = path.resolve(filepath);
      if (!fs.existsSync(resolvedPath)) {
        console.error(`\x1b[31mError: File not found at ${resolvedPath}\x1b[0m`);
        process.exit(1);
      }

      if (!filepath.toLowerCase().endsWith(".step") && !filepath.toLowerCase().endsWith(".stp")) {
        console.error("\x1b[31mError: Only .step / .stp files are supported.\x1b[0m");
        process.exit(1);
      }

      const filename = path.basename(resolvedPath);
      const problemId = options.problem;
      let fileKey = "";

      // ── Phase 1: Request Presigned URL ──────────────────────────────
      console.log("\x1b[36m[1/3] Requesting secure upload URL...\x1b[0m");
      try {
        const urlRes = await fetch(`${API_BASE_URL}/storage/presigned-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            filename,
            contentType: "application/octet-stream",
            problemId,
          }),
        });

        if (!urlRes.ok) {
          const err = await urlRes.text();
          console.error(`\x1b[31mFailed to get upload URL: ${err}\x1b[0m`);
          process.exit(1);
        }

        const urlData = await urlRes.json();
        const uploadUrl = urlData.url;
        const fields = urlData.fields;
        fileKey = urlData.fileKey;

        // ── Phase 2: Binary Upload ───────────────────────────────────────
        console.log("\x1b[36m[2/3] Uploading CAD geometry...\x1b[0m");
        const fileBuffer = fs.readFileSync(resolvedPath);
        
        const formData = new FormData();
        Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
        // Must append file last
        formData.append("file", new Blob([fileBuffer]), filename);

        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          console.error(`\x1b[31mFailed to upload file to storage bucket.\x1b[0m`);
          process.exit(1);
        }
      } catch (e: any) {
        console.error(`\x1b[31mError during upload phase: ${e.message}\x1b[0m`);
        process.exit(1);
      }

      // ── Phase 3: Outbox Confirmation & Polling ───────────────────────
      console.log("\x1b[36m[3/3] Queueing assessment engine...\x1b[0m");
      let submissionId = "";
      try {
        const completeRes = await fetch(`${API_BASE_URL}/submissions/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ fileKey, problemId }),
        });

        if (!completeRes.ok) {
          console.error(`\x1b[31mFailed to trigger assessment worker.\x1b[0m`);
          process.exit(1);
        }

        const completeData = await completeRes.json();
        submissionId = completeData.id;
        console.log(`Submission tracked as ID: \x1b[33m${submissionId}\x1b[0m`);
      } catch (e: any) {
        console.error(`\x1b[31mError triggering submission: ${e.message}\x1b[0m`);
        process.exit(1);
      }

      console.log("\nEvaluating geometry via CAD engine (this may take up to 30 seconds)...");

      // Polling loop
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        process.stdout.write("."); // Spinner replacement

        try {
          const pollRes = await fetch(`${API_BASE_URL}/submissions/${submissionId}`, {
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
            },
          });

          if (pollRes.ok) {
            const data = await pollRes.json();
            
            if (data.status === "COMPLETED") {
              console.log("\n\n\x1b[32mAssessment Complete!\x1b[0m\n");
              console.log(`\x1b[1mDeterministic Score (Tolerance Check):\x1b[0m ${data.deterministicScore} / 60`);
              console.log(`\x1b[1mAI Qualitative Score (Gemini):\x1b[0m         ${data.aiScore} / 40`);
              console.log(`\x1b[1mTotal Composite Score:\x1b[0m                 \x1b[32m${data.score} / 100\x1b[0m\n`);
              console.log("\x1b[1mAI Feedback:\x1b[0m");
              console.log(data.feedback);
              process.exit(0);
            } else if (data.status === "FAILED_KERNEL_PANIC" || data.status === "ERROR" || data.status === "FAILED") {
              console.log("\n\n\x1b[31mAssessment Failed!\x1b[0m\n");
              console.log("The CAD kernel crashed or encountered an unrecoverable error.");
              if (data.feedback) {
                console.log("\x1b[1mFailure Report:\x1b[0m");
                console.log(data.feedback);
              }
              process.exit(1);
            }
          }
        } catch (e) {
          // Swallow intermittent connection errors during polling
        }
      }
    });
}
