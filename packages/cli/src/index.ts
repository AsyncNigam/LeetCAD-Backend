import { Command } from "commander";
import { registerLoginCommand } from "./commands/login.js";
import { registerProblemsCommand } from "./commands/problems.js";
import { registerSubmitCommand } from "./commands/submit.js";

const program = new Command();

program
  .name("leetcad")
  .description("LeetCAD Developer CLI")
  .version("1.0.0");

// Register commands
registerLoginCommand(program);
registerProblemsCommand(program);
registerSubmitCommand(program);

program.parse(process.argv);
