import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { readConfig } from "../utils.js";

function commandAvailable(command: string, args: string[] = ["--version"]): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: "ignore", shell: process.platform === "win32" });
    child.once("error", () => resolve(false));
    child.once("exit", code => resolve(code === 0));
  });
}

export const doctorCommand = new Command("doctor")
  .description("Check the local Dolphin development environment")
  .action(async () => {
    let failed = false;
    const check = (label: string, ok: boolean, detail = "") => {
      console.log(`${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
      if (!ok) failed = true;
    };
    check("Node.js", await commandAvailable("node"));
    check("npm", await commandAvailable("npm"));
    check("Android Debug Bridge", await commandAvailable("adb"), "needed for dolphin run/device");
    check("Gradle", await commandAvailable("gradle"), "needed unless the project has a Gradle Wrapper");
    try {
      const config = await readConfig();
      check("Dolphin project", true, config.appName);
      const android = path.join(process.cwd(), "android");
      check("Android project", await fs.access(android).then(() => true).catch(() => false));
      const wrapper = path.join(android, process.platform === "win32" ? "gradlew.bat" : "gradlew");
      const hasWrapper = await fs.access(wrapper).then(() => true).catch(() => false);
      check("Gradle Wrapper", hasWrapper, hasWrapper ? "project-local Gradle" : "system Gradle fallback");
    } catch (error) {
      check("Dolphin project configuration", false, error instanceof Error ? error.message : String(error));
    }
    if (failed) {
      console.error("Some checks failed. Install the missing tools or open a generated Dolphin project.");
      process.exitCode = 1;
    } else {
      console.log("Dolphin environment checks passed.");
    }
  });
