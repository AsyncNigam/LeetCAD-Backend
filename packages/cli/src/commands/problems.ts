import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
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
          chalk.red("Error: Unauthenticated. Please run `leetcad login <token>` first.")
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
          console.error(chalk.red("Error: API key is invalid or has been revoked."));
          console.error("Please generate a new key from the web dashboard and run `leetcad login <new-key>`.");
          process.exit(1);
        }

        if (!response.ok) {
          console.error(chalk.red(`Error: Server returned status ${response.status} ${response.statusText}`));
          process.exit(1);
        }

        const problems = (await response.json()) as Problem[];

        if (problems.length === 0) {
          console.log("No problems currently available.");
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan.bold("Title"),
            chalk.cyan.bold("Slug"),
            chalk.cyan.bold("Difficulty")
          ],
          style: { head: [], border: ["gray"] }
        });

        problems.forEach(p => {
          const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          const difficultyColor = 
            p.difficulty === "EASY" ? chalk.green 
            : p.difficulty === "MEDIUM" ? chalk.yellow 
            : p.difficulty === "HARD" ? chalk.red : chalk.white;

          table.push([
            p.title,
            slug,
            difficultyColor(p.difficulty)
          ]);
        });

        console.log(`\n${chalk.cyan("Available LeetCAD Challenges:")}\n`);
        console.log(table.toString());
      } catch (err: any) {
        console.error(chalk.red("Error: Could not connect to the LeetCAD server."));
        console.error(`Details: ${err.message}`);
        process.exit(1);
      }
    });
}
