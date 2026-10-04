import { Command } from "commander";
import { registerLoginCommand } from "./commands/login.js";

const program = new Command();

program
  .name("leetcad")
  .description("LeetCAD Developer CLI")
  .version("1.0.0");

// Register commands
registerLoginCommand(program);

program.parse(process.argv);
