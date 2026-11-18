import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageDir, "../..");

function copyRequired(source, destination) {
  if (!fs.existsSync(source)) throw new Error("Required release asset is missing: " + source);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

const appTemplate = path.join(packageDir, "templates/default-app");
copyRequired(path.join(repoRoot, "templates/default-app"), appTemplate);
copyRequired(path.join(repoRoot, "packages/android-shell/template"), path.join(packageDir, "templates/android-shell"));
const appPackagePath = path.join(appTemplate, "package.json");
const appPackage = JSON.parse(fs.readFileSync(appPackagePath, "utf8"));
appPackage.dependencies["@dolphin/bridge"] = "^0.1.0";
fs.writeFileSync(appPackagePath, JSON.stringify(appPackage, null, 2) + "\n");
for (const name of ["LICENSE", "NOTICE"]) {
  copyRequired(path.join(repoRoot, name), path.join(packageDir, name));
}
console.log("Prepared Dolphin npm package assets.");
