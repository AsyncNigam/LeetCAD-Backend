import { Command } from "commander";
import { getConfig } from "../utils/config.js";

const API_BASE_URL = process.env.LEETCAD_API_URL || "https://leetcad.me/api";

interface Problem {
  id: string;
  title: string;
  difficulty: string;
  targetVolume: number;
}

export function registerProblemsCommand(program: Command) {
  program
    .command("problems")
    .description("List all available CAD challenges from the LeetCAD server")
    .action(async () => {
      const config = getConfig();

      if (!config || !config.apiKey) {
        console.error(
          "\x1b[31mError: Unauthenticated. Please run `leetcad login <token>` first.\x1b[0m"
        );
        process.exit(1);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/problems`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
        });

        if (response.status === 401) {
          console.error("\x1b[31mError: API key is invalid or has been revoked.\x1b[0m");
          console.error("Please generate a new key from the web dashboard and run `leetcad login <new-key>`.");
          process.exit(1);
        }

        if (!response.ok) {
          console.error(`\x1b[31mError: Server returned status ${response.status} ${response.statusText}\x1b[0m`);
          process.exit(1);
        }

        const problems = (await response.json()) as Problem[];

        if (problems.length === 0) {
          console.log("No problems currently available.");
          return;
        }

        // Format for console.table
        const displayData = problems.map((p) => ({
          ID: p.id.split("-")[0] + "...", // Shorten UUID
          Title: p.title,
          Difficulty: p.difficulty,
          "Target Vol (mm³)": p.targetVolume.toFixed(2),
        }));

        console.log("\n\x1b[36mAvailable LeetCAD Challenges:\x1b[0m\n");
        console.table(displayData);
      } catch (err: any) {
        console.error("\x1b[31mError: Could not connect to the LeetCAD server.\x1b[0m");
        console.error(`Details: ${err.message}`);
        process.exit(1);
      }
    });
}
