import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { readConfig, writeConfig, validPackageId } from "../utils.js";

export const configCommand = new Command("config").description("Update Dolphin app configuration");
configCommand.command("name").description("Set the application display name").argument("<new-name>")
  .action(async (name: string) => {
    if (!name.trim() || name.length > 80) throw new Error("App name must contain 1–80 characters");
    const config = await readConfig();
    config.appName = name.trim();
    await writeConfig(config);
    const strings = path.join(process.cwd(), "android/app/src/main/res/values/strings.xml");
    try {
      const xml = await fs.readFile(strings, "utf8");
      const escaped = name.trim().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      await fs.writeFile(strings, xml.replace(/(<string name="app_name">)[\s\S]*?(<\/string>)/, `$1${escaped}$2`));
    } catch { console.warn("Android strings.xml not found; config updated only."); }
    console.log(`App name updated: ${name}`);
  });
configCommand.command("icon").description("Validate and install a PNG launcher icon").argument("<path-to-png>")
  .action(async (input: string) => {
    const source = path.resolve(input);
    const bytes = await fs.readFile(source);
    if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
      throw new Error("Icon must be a valid PNG file");
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height || width > 4096 || height > 4096) throw new Error("PNG dimensions are invalid or too large");
    const config = await readConfig();
    const destination = path.join(process.cwd(), "android/app/src/main/res/drawable/dolphin_icon.png");
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
    config.icon = input;
    await writeConfig(config);
    console.log("PNG validated and copied to Android drawable resources.");
    console.warn("For release-quality launcher icons, generate density-specific mipmap assets.");
  });
configCommand.command("package-id").description("Set the Android application ID and Kotlin namespace").argument("<id>")
  .action(async (id: string) => {
    if (!validPackageId(id)) throw new Error("Invalid package ID. Expected reverse-DNS form, e.g. com.example.app");
    const config = await readConfig();
    const gradle = path.join(process.cwd(), "android/app/build.gradle.kts");
    const gradleText = await fs.readFile(gradle, "utf8");
    if (!/namespace\s*=\s*"[^"]+"/.test(gradleText) || !/applicationId\s*=\s*"[^"]+"/.test(gradleText))
      throw new Error("Android Gradle file is missing namespace or applicationId; no files were changed.");
    const sourceRoot = path.join(process.cwd(), "android/app/src/main/java");
    const kotlinFiles = ["MainActivity.kt", "WebAppInterface.kt"];
    const oldPackage = "com.dolphin.app";
    const oldDir = path.join(sourceRoot, ...oldPackage.split("."));
    const newDir = path.join(sourceRoot, ...id.split("."));
    const sources: Array<{ oldPath: string; content: string }> = [];
    for (const file of kotlinFiles) {
      const oldPath = path.join(oldDir, file);
      try {
        const content = await fs.readFile(oldPath, "utf8");
        sources.push({ oldPath, content: content.replace(/^package\s+com\.dolphin\.app\s*$/m, `package ${id}`) });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const updatedGradle = gradleText
      .replace(/namespace\s*=\s*"[^"]+"/, `namespace = "${id}"`)
      .replace(/applicationId\s*=\s*"[^"]+"/, `applicationId = "${id}"`);
    await fs.mkdir(newDir, { recursive: true });
    for (const source of sources) await fs.writeFile(path.join(newDir, path.basename(source.oldPath)), source.content);
    for (const source of sources) await fs.rm(source.oldPath);
    await fs.writeFile(gradle, updatedGradle);
    if (await fs.readdir(oldDir).then(items => items.length === 0).catch(() => false))
      await fs.rm(oldDir, { recursive: true });
    config.packageId = id;
    await writeConfig(config);
    console.log(`Android application ID and Kotlin namespace updated: ${id}`);
  });
