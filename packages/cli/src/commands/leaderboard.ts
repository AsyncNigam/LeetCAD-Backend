import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { getConfig } from "../utils/config.js";

const API_BASE_URL = process.env.LEETCAD_API_URL || "https://leetcad.me/api";

export function registerLeaderboardCommand(program: Command) {
  program
    .command("leaderboard <slug>")
    .description("Display the leaderboard for a specific problem")
    .action(async (slug: string) => {
      const config = getConfig();

      if (!config || !config.apiKey) {
        console.error(
          chalk.red("Error: Unauthenticated. Please run `leetcad login <token>` first.")
        );
        process.exit(1);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/problems/${slug}/leaderboard`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
        });

        if (response.status === 404) {
          console.error(chalk.red(`Error: Problem '${slug}' not found.`));
          process.exit(1);
        }

        if (!response.ok) {
          console.error(chalk.red(`Error: Server returned status ${response.status} ${response.statusText}`));
          process.exit(1);
        }

        const entries = await response.json();

        if (entries.length === 0) {
          console.log(`No successful submissions yet for '${slug}'. Be the first!`);
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan.bold("Rank"),
            chalk.cyan.bold("User"),
            chalk.cyan.bold("Score"),
            chalk.cyan.bold("Status")
          ],
          style: { head: [], border: ["gray"] }
        });

        entries.forEach((entry: any) => {
          table.push([
            entry.rank,
            entry.user,
            entry.score,
            entry.status === "COMPLETED" ? chalk.green(entry.status) : entry.status
          ]);
        });

        console.log(`\n${chalk.cyan(`Leaderboard for '${slug}':`)}\n`);
        console.log(table.toString());
      } catch (err: any) {
        console.error(chalk.red("Error: Could not connect to the LeetCAD server."));
        console.error(`Details: ${err.message}`);
        process.exit(1);
      }
    });
}
