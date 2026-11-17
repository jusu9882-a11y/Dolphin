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
    if (id === config.packageId) {
      console.log("Package ID is already set: " + id);
      return;
    }
    const gradle = path.join(process.cwd(), "android/app/build.gradle.kts");
    const gradleText = await fs.readFile(gradle, "utf8");
    if (!/namespace\s*=\s*"[^"]+"/.test(gradleText) || !/applicationId\s*=\s*"[^"]+"/.test(gradleText))
      throw new Error("Android Gradle file is missing namespace or applicationId; no files were changed.");
    const sourceRoot = path.join(process.cwd(), "android/app/src/main/java");
    const kotlinFiles = ["MainActivity.kt", "WebAppInterface.kt"];
    const configuredDir = path.join(sourceRoot, ...config.packageId.split("."));
    const defaultDir = path.join(sourceRoot, "com", "dolphin", "app");
    const oldDir = await fs.access(configuredDir).then(() => configuredDir).catch(() => defaultDir);
    const oldPackage = path.relative(sourceRoot, oldDir).split(path.sep).join(".");
    const newDir = path.join(sourceRoot, ...id.split("."));
    const sources: Array<{ oldPath: string; content: string }> = [];
    for (const file of kotlinFiles) {
      const oldPath = path.join(oldDir, file);
      try {
        const content = await fs.readFile(oldPath, "utf8");
        sources.push({ oldPath, content: content.replace(new RegExp("^package\\s+" + oldPackage.replaceAll(".", "\\.") + "\\s*$", "m"), "package " + id) });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    if (sources.length !== kotlinFiles.length)
      throw new Error("Android Kotlin source files are incomplete; package ID was not changed.");
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

configCommand.command("capability")
  .description("Enable or disable an Android device capability")
  .argument("<name>", "camera or microphone")
  .argument("<state>", "enable or disable")
  .action(async (name: string, state: string) => {
    const permissions: Record<string, string> = {
      camera: "android.permission.CAMERA",
      microphone: "android.permission.RECORD_AUDIO"
    };
    if (!(name in permissions)) throw new Error("Capability must be camera or microphone");
    if (state !== "enable" && state !== "disable") throw new Error("State must be enable or disable");

    const config = await readConfig();
    const manifest = path.join(process.cwd(), "android/app/src/main/AndroidManifest.xml");
    let xml = await fs.readFile(manifest, "utf8");
    const permission = permissions[name];
    const declaration = `    <uses-permission android:name="${permission}" />`;
    const hasPermission = new RegExp(`<uses-permission\\s+android:name=["']${permission}["']\\s*/>`).test(xml);
    if (state === "enable" && !hasPermission) {
      if (!xml.includes("<application")) throw new Error("Android manifest has no application element");
      xml = xml.replace("<application", declaration + "\n    <application");
    } else if (state === "disable" && hasPermission) {
      xml = xml.replace(new RegExp(`^\\s*<uses-permission\\s+android:name=["']${permission}["']\\s*/>\\s*\\n?`, "m"), "");
    }
    const capabilities = new Set(config.capabilities ?? []);
    if (state === "enable") capabilities.add(name as "camera" | "microphone");
    else capabilities.delete(name as "camera" | "microphone");
    config.capabilities = [...capabilities].sort();
    await fs.writeFile(manifest, xml);
    await writeConfig(config);
    console.log(`Android ${name} capability ${state}d. Runtime consent remains required.`);
  });
