import { Command } from "commander";
import chalk from "chalk";
import { getConfig } from "../utils/config.js";

const API_BASE_URL = process.env.LEETCAD_API_URL || "https://leetcad.me/api";

export function registerInfoCommand(program: Command) {
  program
    .command("info <slug>")
    .description("Print the description and constraints for a specific problem")
    .action(async (slug: string) => {
      const config = getConfig();

      if (!config || !config.apiKey) {
        console.error(
          chalk.red("Error: Unauthenticated. Please run `leetcad login <token>` first.")
        );
        process.exit(1);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/problems/${slug}`, {
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

        const problem = await response.json();

        const difficultyColor = 
          problem.difficulty === "EASY" ? chalk.green 
          : problem.difficulty === "MEDIUM" ? chalk.yellow 
          : problem.difficulty === "HARD" ? chalk.red : chalk.white;

        console.log(`\n${chalk.cyan.bold(problem.title)} [${difficultyColor(problem.difficulty)}]`);
        console.log(chalk.gray("--------------------------------------------------"));
        console.log(problem.description);
        console.log(chalk.gray("--------------------------------------------------"));
        console.log(`${chalk.bold("Target Volume:")} ${problem.targetVolume} mm³ (±${problem.tolerance || 5}%)`);
        console.log("\n");
      } catch (err: any) {
        console.error(chalk.red("Error: Could not connect to the LeetCAD server."));
        console.error(`Details: ${err.message}`);
        process.exit(1);
      }
    });
}
