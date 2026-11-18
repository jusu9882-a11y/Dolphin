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

copyRequired(path.join(repoRoot, "templates/default-app"), path.join(packageDir, "templates/default-app"));
copyRequired(path.join(repoRoot, "packages/android-shell/template"), path.join(packageDir, "templates/android-shell"));
for (const name of ["LICENSE", "NOTICE"]) {
  copyRequired(path.join(repoRoot, name), path.join(packageDir, name));
}
console.log("Prepared Dolphin npm package assets.");
