import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { getConfig } from "../utils/config.js";

const API_BASE_URL = process.env.LEETCAD_API_URL || "https://leetcad.me/api";

export function registerLeaderboardCommand(program: Command) {
  program
    .command("leaderboard")
    .description("Display the global LeetCAD leaderboard")
    .action(async () => {
      const config = getConfig();

      if (!config || !config.apiKey) {
        console.error(
          chalk.red("Error: Unauthenticated. Please run `leetcad login <token>` first.")
        );
        process.exit(1);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/leaderboard`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
        });

        if (!response.ok) {
          console.error(chalk.red(`Error: Server returned status ${response.status} ${response.statusText}`));
          process.exit(1);
        }

        const entries = await response.json();

        if (entries.length === 0) {
          console.log("No submissions yet! Be the first to rank on the leaderboard.");
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan.bold("Rank"),
            chalk.cyan.bold("User"),
            chalk.cyan.bold("Solved"),
            chalk.cyan.bold("Avg Score")
          ],
          style: { head: [], border: ["gray"] }
        });

        entries.forEach((entry: any, index: number) => {
          table.push([
            index + 1,
            entry.userName || "Unknown",
            entry.totalSolved,
            entry.bestAvgScore
          ]);
        });

        console.log(`\n${chalk.cyan("Global LeetCAD Leaderboard:")}\n`);
        console.log(table.toString());
      } catch (err: any) {
        console.error(chalk.red("Error: Could not connect to the LeetCAD server."));
        console.error(`Details: ${err.message}`);
        process.exit(1);
      }
    });
}
