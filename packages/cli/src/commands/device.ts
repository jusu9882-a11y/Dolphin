import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

function adb(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("adb", args, { cwd, shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", data => stdout += data.toString());
    child.stderr.on("data", data => stderr += data.toString());
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `adb exited with code ${code}`)));
  });
}

export const deviceCommand = new Command("device").description("Manage connected Android devices");
deviceCommand.command("list").description("List connected Android devices").action(async () => {
  const output = await adb(["devices", "-l"], process.cwd());
  console.log(output.trim() || "No Android devices found.");
});
deviceCommand.command("install").description("Install an APK on an authorized Android device")
  .argument("[apk-path]", "APK path (defaults to the newest APK in dist-android)")
  .option("-r, --replace", "Replace an installed app while preserving app data")
  .action(async (apkPath: string | undefined, options: { replace?: boolean }) => {
    const cwd = process.cwd();
    let selected = apkPath ? path.resolve(cwd, apkPath) : "";
    if (!selected) {
      const outputDir = path.join(cwd, "dist-android");
      const entries = await fs.readdir(outputDir);
      const apks = await Promise.all(entries.filter(name => name.endsWith(".apk")).map(async name => ({
        name, time: (await fs.stat(path.join(outputDir, name))).mtimeMs
      })));
      apks.sort((a, b) => b.time - a.time);
      if (!apks.length) throw new Error("No APK found in dist-android. Run dolphin build first or provide an APK path.");
      selected = path.join(outputDir, apks[0].name);
    }
    await fs.access(selected);
    await adb(["install", ...(options.replace ? ["-r"] : []), selected], cwd);
    console.log("APK installed: " + selected);
  });
