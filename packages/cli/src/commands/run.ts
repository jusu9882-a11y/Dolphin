import { Command } from "commander";
import path from "node:path";
import { spawn } from "node:child_process";
import { readConfig, runProcess } from "../utils.js";

export const runCommand = new Command("run").description("Start Vite and launch an Android device")
  .option("--host <host>", "Vite bind host", "0.0.0.0").option("--port <port>", "Vite port", "5173")
  .action(async (options: { host: string; port: string }) => {
    const config = await readConfig();
    const cwd = process.cwd();
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
    const url = `http://127.0.0.1:${port}`;
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "dev", "--", "--host", options.host, "--port", String(port)],
      { cwd, stdio: "inherit", shell: process.platform === "win32" });
    const stop = () => child.kill("SIGTERM");
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    await new Promise(r => setTimeout(r, 1800));
    try {
      await runProcess("adb", ["start-server"], cwd);
      const devices = await new Promise<string>((resolve, reject) => {
        const p = spawn("adb", ["devices"], { cwd });
        let out = "";
        p.stdout.on("data", d => out += d.toString());
        p.once("error", reject);
        p.once("exit", code => code === 0 ? resolve(out) : reject(new Error("adb devices failed")));
      });
      if (!devices.split(/\r?\n/).slice(1).some(line => /\tdevice$/.test(line)))
        throw new Error("No authorized Android device/emulator found.");
      await runProcess("adb", ["reverse", `tcp:${port}`, `tcp:${port}`], cwd);
      await runProcess("adb", ["shell", "am", "start", "-n", `${config.packageId}/.MainActivity`,
        "--es", "dolphinDevUrl", url], path.join(cwd, "android"));
      console.log(`Dolphin dev server: ${url}`);
    } catch (error) {
      child.kill("SIGTERM");
      throw error;
    }
    await new Promise<void>((resolve, reject) => {
      child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Vite exited with code ${code}`)));
    });
  });
