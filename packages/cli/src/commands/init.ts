import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { fileURLToPath } from "node:url";
import { findShellTemplate, writeConfig, validPackageId } from "../utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const initCommand = new Command("init").description("Create a new Dolphin application")
  .argument("<app-name>").option("--package-id <id>", "Android application ID")
  .action(async (appName: string, options: { packageId?: string }) => {
    const target = path.resolve(process.cwd(), appName);
    try { await fs.access(target); throw new Error("Destination already exists: " + target); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    const packageId = options.packageId ?? "com.dolphin.app";
    if (!validPackageId(packageId)) throw new Error("Invalid package ID. Expected reverse-DNS form, e.g. com.example.app");
    const template = path.resolve(here, "../../../../templates/default-app");
    await fs.mkdir(target, { recursive: true });
    await fs.cp(template, target, { recursive: true, filter: p => !p.includes("node_modules") && !p.includes("/dist/") });
    const shell = await findShellTemplate();
    await fs.cp(shell, path.join(target, "android"), { recursive: true });

    if (packageId !== "com.dolphin.app") {
      const gradle = path.join(target, "android/app/build.gradle.kts");
      const gradleText = await fs.readFile(gradle, "utf8");
      await fs.writeFile(gradle, gradleText
        .replace(/namespace\s*=\s*"[^"]+"/, "namespace = \"" + packageId + "\"")
        .replace(/applicationId\s*=\s*"[^"]+"/, "applicationId = \"" + packageId + "\""));
      const sourceRoot = path.join(target, "android/app/src/main/java");
      const oldDir = path.join(sourceRoot, "com", "dolphin", "app");
      const newDir = path.join(sourceRoot, ...packageId.split("."));
      await fs.mkdir(newDir, { recursive: true });
      for (const file of ["MainActivity.kt", "WebAppInterface.kt"]) {
        const oldPath = path.join(oldDir, file);
        const source = await fs.readFile(oldPath, "utf8");
        await fs.writeFile(path.join(newDir, file), source.replace(/^package\s+com\.dolphin\.app\s*$/m, "package " + packageId));
        await fs.rm(oldPath);
      }
      await fs.rm(oldDir, { recursive: true });
    }
    await writeConfig({
      appName, packageId, version: "1.0.0", icon: "./assets/icon.png", webDir: "dist", capabilities: []
    }, target);
    console.log(pc.green("Created " + appName + ". Next: cd " + appName + " && npm install && dolphin run"));
  });
