import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { runProcess } from "../utils.js";

export const testCommand = new Command("test")
  .description("Run the app's configured test, typecheck, or build validation")
  .option("--typecheck", "Run the typecheck script when available")
  .action(async (options: { typecheck?: boolean }) => {
    const cwd = process.cwd();
    const pkg = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    const selected = options.typecheck
      ? (scripts.typecheck ? "typecheck" : undefined)
      : (scripts.test ? "test" : scripts.typecheck ? "typecheck" : scripts.build ? "build" : undefined);
    if (!selected) throw new Error("No test, typecheck, or build script is configured in package.json");
    console.log(`Running npm run ${selected}...`);
    await runProcess(process.platform === "win32" ? "npm.cmd" : "npm", ["run", selected], cwd);
    console.log(`Dolphin validation passed (${selected}).`);
  });
