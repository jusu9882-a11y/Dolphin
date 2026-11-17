import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { readConfig, runProcess } from "../utils.js";

export const buildCommand = new Command("build")
  .description("Build web assets and package the Android APK")
  .option("--release", "Build a release APK")
  .action(async (options: { release?: boolean }) => {
    const cwd = process.cwd();
    const config = await readConfig(cwd);
    await runProcess(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], cwd);
    const webOutput = path.resolve(cwd, config.webDir);
    const androidAssets = path.join(cwd, "android/app/src/main/assets/www");
    await fs.access(webOutput);
    await fs.rm(androidAssets, { recursive: true, force: true });
    await fs.mkdir(androidAssets, { recursive: true });
    await fs.cp(webOutput, androidAssets, { recursive: true });

    const androidDir = path.join(cwd, "android");
    const wrapper = path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
    const hasWrapper = await fs.access(wrapper).then(() => true).catch(() => false);
    const gradle = hasWrapper ? (process.platform === "win32" ? "gradlew.bat" : "./gradlew")
      : (process.platform === "win32" ? "gradle.bat" : "gradle");
    const task = options.release ? "assembleRelease" : "assembleDebug";
    if (!hasWrapper) console.warn("Gradle Wrapper not found; using the system Gradle installation.");
    await runProcess(gradle, [task], androidDir);

    const variant = options.release ? "release" : "debug";
    const apkDir = path.join(cwd, "android/app/build/outputs/apk", variant);
    const entries = await fs.readdir(apkDir);
    const apk = entries.find(file => file.endsWith(".apk"));
    if (!apk) throw new Error("Gradle completed but no APK was found");
    const output = path.join(cwd, "dist-apk");
    await fs.mkdir(output, { recursive: true });
    const destination = path.join(output, apk);
    await fs.copyFile(path.join(apkDir, apk), destination);
    console.log("APK created: " + destination);
  });
