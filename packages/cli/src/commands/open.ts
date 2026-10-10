import { Command } from "commander";
import chalk from "chalk";
import open from "open";

export function registerOpenCommand(program: Command) {
  program
    .command("open <slug>")
    .description("Open the problem in your default web browser")
    .action(async (slug: string) => {
      const url = `https://app.leetcad.me/problems/${slug}`;
      console.log(chalk.cyan(`Opening ${url} in your default browser...`));
      
      try {
        await open(url);
      } catch (err: any) {
        console.error(chalk.red(`Error: Could not open the browser. You can navigate to: ${url}`));
      }
    });
}
