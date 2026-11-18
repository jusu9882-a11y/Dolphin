import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { readConfig, runProcess } from "../utils.js";

type BuildOptions = {
  release?: boolean;
  apk?: boolean;
  aab?: boolean;
  all?: boolean;
};

export const buildCommand = new Command("build")
  .description("Build web assets and package Android APK and/or AAB outputs")
  .option("--release", "Build a release APK (requires release signing for store distribution)")
  .option("--apk", "Build an APK (default)")
  .option("--aab", "Build a release Android App Bundle")
  .option("--all", "Build a debug APK and a release Android App Bundle")
  .action(async (options: BuildOptions) => {
    if ([options.apk, options.aab, options.all].filter(Boolean).length > 1) {
      throw new Error("Choose only one of --apk, --aab, or --all");
    }

    const buildApk = options.all || (!options.aab && (options.apk || !options.aab));
    const buildAab = Boolean(options.aab || options.all);
    const releaseApk = Boolean(options.release) && !options.all;

    if (options.release && (options.aab || options.all)) {
      throw new Error("--release cannot be combined with --aab or --all; AAB builds are always release builds");
    }

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
    if (!hasWrapper) console.warn("Gradle Wrapper not found; using the system Gradle installation.");

    const tasks: string[] = [];
    if (buildApk) tasks.push(releaseApk ? "assembleRelease" : "assembleDebug");
    if (buildAab) tasks.push("bundleRelease");
    await runProcess(gradle, tasks, androidDir);

    const output = path.join(cwd, "dist-android");
    await fs.mkdir(output, { recursive: true });

    if (buildApk) {
      const variant = releaseApk ? "release" : "debug";
      const apkDir = path.join(cwd, "android/app/build/outputs/apk", variant);
      const entries = await fs.readdir(apkDir);
      const apk = entries.find(file => file.endsWith(".apk"));
      if (!apk) throw new Error("Gradle completed but no APK was found");
      const destination = path.join(output, apk);
      await fs.copyFile(path.join(apkDir, apk), destination);
      console.log("APK created: " + destination);
    }

    if (buildAab) {
      const bundleDir = path.join(cwd, "android/app/build/outputs/bundle/release");
      const entries = await fs.readdir(bundleDir);
      const aab = entries.find(file => file.endsWith(".aab"));
      if (!aab) throw new Error("Gradle completed but no Android App Bundle was found");
      const destination = path.join(output, aab);
      await fs.copyFile(path.join(bundleDir, aab), destination);
      console.log("AAB created: " + destination);
      if (!process.env.DOLPHIN_KEYSTORE_PATH) {
        console.warn("This AAB is not release-signed. Configure DOLPHIN_KEYSTORE_PATH, DOLPHIN_KEYSTORE_PASSWORD, DOLPHIN_KEY_ALIAS, and DOLPHIN_KEY_PASSWORD for a signed Play upload bundle.");
      }
    }
  });
