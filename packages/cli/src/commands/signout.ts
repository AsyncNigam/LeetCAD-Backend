import { Command } from "commander";
import chalk from "chalk";
import { clearConfig } from "../utils/config.js";

export function registerSignoutCommand(program: Command) {
  program
    .command("signout")
    .description("Sign out from LeetCAD CLI")
    .action(() => {
      try {
        clearConfig();
        console.log(chalk.green("Successfully signed out."));
      } catch (err: any) {
        console.error(chalk.red(`Error signing out: ${err.message}`));
      }
    });
}
