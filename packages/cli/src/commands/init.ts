import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { fileURLToPath } from "node:url";
import { findShellTemplate, writeConfig } from "../utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const initCommand = new Command("init").description("Create a new Dolphin application")
  .argument("<app-name>").option("--package-id <id>", "Android application ID")
  .action(async (appName: string, options: { packageId?: string }) => {
    const target = path.resolve(process.cwd(), appName);
    try { await fs.access(target); throw new Error(`Destination already exists: ${target}`); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    const template = path.resolve(here, "../../../../templates/default-app");
    await fs.mkdir(target, { recursive: true });
    await fs.cp(template, target, { recursive: true, filter: p => !p.includes("node_modules") && !p.includes("/dist/") });
    const shell = await findShellTemplate();
    await fs.cp(shell, path.join(target, "android"), { recursive: true });
    await writeConfig({
      appName, packageId: options.packageId ?? "com.dolphin.app",
      version: "1.0.0", icon: "./assets/icon.png", webDir: "dist"
    }, target);
    console.log(pc.green(`Created ${appName}. Next: cd ${appName} && npm install && dolphin run`));
  });
