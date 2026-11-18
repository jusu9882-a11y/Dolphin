import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { fileURLToPath } from "node:url";
import { findShellTemplate, writeConfig, validPackageId } from "../utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const initCommand = new Command("init")
  .description("Create a new Dolphin application")
  .argument("<app-name>", "Name of the application to create")
  .option("--package-id <id>", "Android application ID")
  .addHelpText("after", `
Examples:
  dolphin init MyApp
  dolphin init MyApp --package-id com.example.myapp

After creating your app:
  cd MyApp
  npm install
  # Edit src/App.tsx to build your app
  npm run dev             Preview in your browser
  dolphin run             Run on a connected Android device
  dolphin build --apk     Build an Android APK
  dolphin build --aab     Build an Android App Bundle
`)
  .action(async (appName: string, options: { packageId?: string }) => {
    const target = path.resolve(process.cwd(), appName);

    try {
      await fs.access(target);
      throw new Error("Destination already exists: " + target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const packageId = options.packageId ?? "com.dolphin.app";
    if (!validPackageId(packageId)) {
      throw new Error("Invalid package ID. Expected reverse-DNS form, e.g. com.example.app");
    }

    const templateCandidates = [
      path.resolve(here, "../../templates/default-app"),
      path.resolve(here, "../../../../templates/default-app")
    ];
    let template: string | undefined;

    for (const candidate of templateCandidates) {
      try {
        await fs.access(path.join(candidate, "package.json"));
        template = candidate;
        break;
      } catch {
        // Try the next package layout.
      }
    }

    if (!template) {
      throw new Error("Default app template not found in this Dolphin installation.");
    }

    await fs.mkdir(target, { recursive: true });
    await fs.cp(template, target, {
      recursive: true,
      filter: sourcePath => {
        const relativePath = path.relative(template!, sourcePath);
        const segments = relativePath.split(path.sep);
        return !segments.includes("node_modules") && !segments.includes("dist");
      }
    });

    const shell = await findShellTemplate();
    await fs.cp(shell, path.join(target, "android"), { recursive: true });

    if (packageId !== "com.dolphin.app") {
      const gradle = path.join(target, "android/app/build.gradle.kts");
      const gradleText = await fs.readFile(gradle, "utf8");
      await fs.writeFile(gradle, gradleText
        .replace(/namespace\\s*=\\s*"[^"]+"/, "namespace = \"" + packageId + "\"")
        .replace(/applicationId\\s*=\\s*"[^"]+"/, "applicationId = \"" + packageId + "\""));

      const sourceRoot = path.join(target, "android/app/src/main/java");
      const oldDir = path.join(sourceRoot, "com", "dolphin", "app");
      const newDir = path.join(sourceRoot, ...packageId.split("."));
      await fs.mkdir(newDir, { recursive: true });

      for (const file of ["MainActivity.kt", "WebAppInterface.kt"]) {
        const oldPath = path.join(oldDir, file);
        const source = await fs.readFile(oldPath, "utf8");
        await fs.writeFile(
          path.join(newDir, file),
          source.replace(/^package\\s+com\\.dolphin\\.app\\s*$/m, "package " + packageId)
        );
        await fs.rm(oldPath);
      }

      await fs.rm(oldDir, { recursive: true });
    }

    await writeConfig({
      appName,
      packageId,
      version: "1.0.0",
      icon: "./assets/icon.png",
      webDir: "dist",
      capabilities: []
    }, target);

    console.log("");
    console.log(pc.green(pc.bold("🐬 Your Dolphin app is ready!")));
    console.log("");
    console.log(pc.bold("Created: ") + pc.cyan(appName));
    console.log("");
    console.log(pc.bold("NEXT STEPS"));
    console.log("");
    console.log(pc.cyan("  1.") + " Enter your project");
    console.log(pc.dim("     cd " + appName));
    console.log("");
    console.log(pc.cyan("  2.") + " Install app dependencies");
    console.log(pc.dim("     npm install"));
    console.log("");
    console.log(pc.cyan("  3.") + " Start building your app");
    console.log(pc.dim("     Edit src/App.tsx"));
    console.log("");
    console.log(pc.cyan("  4.") + " Preview in your browser");
    console.log(pc.dim("     npm run dev"));
    console.log("");
    console.log(pc.cyan("  5.") + " Run on an Android device");
    console.log(pc.dim("     dolphin run"));
    console.log("");
    console.log(pc.cyan("  6.") + " Build Android packages");
    console.log(pc.dim("     dolphin build --apk"));
    console.log(pc.dim("     dolphin build --aab"));
    console.log("");
    console.log(pc.dim("Note: Android device runs and local package builds still require"));
    console.log(pc.dim("Android platform tools on this version. Dolphin-managed cloud"));
    console.log(pc.dim("builds are planned and are not available yet."));
    console.log("");
    console.log(pc.dim("Run `dolphin --help` to explore all commands."));
  });
