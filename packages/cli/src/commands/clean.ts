import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";

export const cleanCommand = new Command("clean")
  .description("Remove generated Dolphin build outputs")
  .option("--all", "Also remove Android Gradle build outputs")
  .action(async (options: { all?: boolean }) => {
    const cwd = process.cwd();
    const targets = ["dist", "dist-android"];
    if (options.all) targets.push(path.join("android", "app", "build"));
    for (const target of targets) {
      const absolute = path.resolve(cwd, target);
      if (!absolute.startsWith(cwd + path.sep)) throw new Error("Refusing to clean a path outside the project");
      await fs.rm(absolute, { recursive: true, force: true });
      console.log("Removed " + target);
    }
    console.log("Clean complete. Source files and dependencies were preserved.");
  });
