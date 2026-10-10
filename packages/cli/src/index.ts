import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import figlet from "figlet";

import { registerLoginCommand } from "./commands/login.js";
import { registerProblemsCommand } from "./commands/problems.js";
import { registerSubmitCommand } from "./commands/submit.js";
import { registerWhoamiCommand } from "./commands/whoami.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json dynamically
const pkgPath = path.resolve(__dirname, "../../package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

// Print Banner
console.log(chalk.greenBright(figlet.textSync("LeetCAD", { horizontalLayout: "full" })));
console.log(chalk.gray(`v${pkg.version} - The CAD Assessment Engine\n`));

const program = new Command();

program
  .name("leetcad")
  .description("LeetCAD Developer CLI")
  .version(pkg.version);

// Register commands
registerLoginCommand(program);
registerProblemsCommand(program);
registerSubmitCommand(program);
registerWhoamiCommand(program);

program.parse(process.argv);
