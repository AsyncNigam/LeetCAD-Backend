import { Command } from "commander";
import chalk from "chalk";
import { getConfig } from "../utils/config.js";

const API_BASE_URL = process.env.LEETCAD_API_URL || "https://leetcad.me/api";

export function registerWhoamiCommand(program: Command) {
  program
    .command("whoami")
    .description("Display the currently authenticated user session")
    .action(async () => {
      const config = getConfig();

      if (!config || !config.apiKey) {
        console.error(
          chalk.red("Error: Unauthenticated. Please run `leetcad login <token>` first.")
        );
        process.exit(1);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
        });

        if (response.status === 401) {
          console.error(chalk.red("Error: Session invalid or expired."));
          console.error("Please log in again using `leetcad login <token>`.");
          process.exit(1);
        }

        if (!response.ok) {
          console.error(chalk.red(`Error: Server returned status ${response.status} ${response.statusText}`));
          process.exit(1);
        }

        const user = await response.json();

        console.log(chalk.cyan.bold("Logged in as:"));
        console.log(`${chalk.gray("ID:")}      ${user.id}`);
        console.log(`${chalk.gray("Email:")}   ${user.email}`);
        console.log(`${chalk.gray("Role:")}    ${user.role}`);
        
      } catch (err: any) {
        console.error(chalk.red("Error: Could not connect to the LeetCAD server."));
        console.error(`Details: ${err.message}`);
        process.exit(1);
      }
    });
}
