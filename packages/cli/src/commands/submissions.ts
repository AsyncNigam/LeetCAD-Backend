import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { getConfig } from "../utils/config.js";

const API_BASE_URL = process.env.LEETCAD_API_URL || "https://leetcad.me/api";

export function registerSubmissionsCommand(program: Command) {
  program
    .command("submissions")
    .description("List all your past submissions")
    .action(async () => {
      const config = getConfig();

      if (!config || !config.apiKey) {
        console.error(
          chalk.red("Error: Unauthenticated. Please run `leetcad login <token>` first.")
        );
        process.exit(1);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/users/me/submissions`, {
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

        const submissions = await response.json();

        if (submissions.length === 0) {
          console.log("You have not made any submissions yet.");
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan.bold("Problem"),
            chalk.cyan.bold("Score"),
            chalk.cyan.bold("Status"),
            chalk.cyan.bold("Date")
          ],
          style: { head: [], border: ["gray"] }
        });

        submissions.forEach((sub: any) => {
          const date = new Date(sub.createdAt).toLocaleString();
          const statusColor = 
            sub.status === "COMPLETED" ? chalk.green 
            : sub.status === "FAILED" ? chalk.red 
            : chalk.yellow;

          table.push([
            sub.problemTitle,
            sub.score !== null ? sub.score : "-",
            statusColor(sub.status),
            date
          ]);
        });

        console.log(`\n${chalk.cyan("Your Submissions:")}\n`);
        console.log(table.toString());
      } catch (err: any) {
        console.error(chalk.red("Error: Could not connect to the LeetCAD server."));
        console.error(`Details: ${err.message}`);
        process.exit(1);
      }
    });
}
