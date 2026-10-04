import { Command } from "commander";
import { saveConfig } from "../utils/config.js";

export function registerLoginCommand(program: Command) {
  program
    .command("login")
    .description("Authenticate the CLI with your LeetCAD API key")
    .argument("<api-key>", "Your Developer API Key (e.g. lc_live_...)")
    .action((apiKey: string) => {
      if (!apiKey.startsWith("lc_live_")) {
        console.error("\x1b[31mError: Invalid API key format. Key must start with 'lc_live_'.\x1b[0m");
        process.exit(1);
      }

      saveConfig({ apiKey });
      console.log("\x1b[32mSuccessfully authenticated with LeetCAD.\x1b[0m");
      console.log("Key saved to ~/.leetcad/config.json");
    });
}
