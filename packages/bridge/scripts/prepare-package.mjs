import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageDir, "../..");
for (const name of ["LICENSE", "NOTICE"]) {
  const source = path.join(repoRoot, name);
  if (!fs.existsSync(source)) throw new Error("Required release asset is missing: " + source);
  fs.copyFileSync(source, path.join(packageDir, name));
}
console.log("Prepared Dolphin bridge npm package assets.");
