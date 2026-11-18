import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export interface DolphinConfig {
  appName: string;
  packageId: string;
  version: string;
  icon: string;
  webDir: string;
  devServerUrl?: string;
  capabilities?: Array<"camera" | "microphone">;
}
export const configFile = "dolphin.config.json";

export async function readConfig(cwd = process.cwd()): Promise<DolphinConfig> {
  const file = path.join(cwd, configFile);
  let value: unknown;
  try { value = JSON.parse(await fs.readFile(file, "utf8")); }
  catch { throw new Error(`Cannot read ${configFile} in ${cwd}`); }
  if (!value || typeof value !== "object") throw new Error("Invalid Dolphin config");
  const c = value as Partial<DolphinConfig>;
  for (const key of ["appName", "packageId", "version", "icon", "webDir"] as const)
    if (typeof c[key] !== "string" || !c[key]) throw new Error(`Invalid config field: ${key}`);
  return c as DolphinConfig;
}
export async function writeConfig(config: DolphinConfig, cwd = process.cwd()): Promise<void> {
  await fs.writeFile(path.join(cwd, configFile), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
export function runProcess(command: string, args: string[], cwd: string, inherit = true): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd, stdio: inherit ? "inherit" : "pipe", shell: process.platform === "win32"
    });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}
export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}
export async function findShellTemplate(): Promise<string> {
  const candidates = [
    path.join(packageRoot(), "packages", "android-shell", "template"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates/android-shell"),
    path.join(packageRoot(), "templates", "android-shell")
  ];
  for (const candidate of candidates) {
    try { await fs.access(path.join(candidate, "app", "src", "main", "AndroidManifest.xml")); return candidate; }
    catch { /* try next */ }
  }
  throw new Error("Android shell template not found. Install the complete Dolphin monorepo or bundled CLI package.");
}
export function validPackageId(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(value);
}
