import { Command } from "commander";
import { saveConfig } from "../utils/config.js";

export function registerLoginCommand(program: Command) {
  program
    .command("login")
    .description("Authenticate the CLI with your LeetCAD API key")
    .argument("<token>", "Your Developer CLI Token or API Key")
    .action((token: string) => {
      if (!token.startsWith("lc_live_") && !token.startsWith("eyJ")) {
        console.error("\x1b[31mError: Invalid token format. Token must be a valid JWT or API key.\x1b[0m");
        process.exit(1);
      }

      saveConfig({ apiKey: token });
      console.log("\x1b[32mSuccessfully authenticated with LeetCAD.\x1b[0m");
      console.log("Key saved to ~/.leetcad/config.json");
    });
}
