# Dolphin

Dolphin is an Android-first app framework for building mobile applications with React, Vite, and TypeScript, hosted in a native Kotlin Android WebView. Native capabilities are exposed through a promise-based JavaScript bridge.

## Project status

**Early MVP — not production-ready.** The repository currently builds the TypeScript bridge, CLI, starter app, and Android shell in GitHub Actions. CLI scaffolding and custom Android package-ID updates are smoke-tested in CI. A successful CI build does not prove correct behavior on a physical device; emulator and physical-device validation are still outstanding.

## Architecture

- `packages/cli`: Node.js/TypeScript command-line interface.
- `packages/bridge`: TypeScript promise-based native bridge SDK.
- `packages/android-shell/template`: Kotlin Android WebView host.
- `templates/default-app`: React + Vite + TypeScript starter.
- `examples/python-playground`: experimental Python 3 execution inside the Dolphin WebView using Pyodide/WebAssembly.

## Current capabilities

- Scaffold a React/Vite application with an Android Kotlin shell.
- Configure the display name, PNG icon input, and Android application ID.
- Keep Android `namespace`, `applicationId`, and Kotlin package declarations aligned when setting a custom package ID.
- Run a Vite development server and launch an authorized Android device through ADB reverse.
- Build web assets and package a debug/release APK or a release Android App Bundle (AAB); use `dolphin build --all` to produce a debug APK and release AAB together.
- Configure optional release signing through the environment variables `DOLPHIN_KEYSTORE_PATH`, `DOLPHIN_KEYSTORE_PASSWORD`, `DOLPHIN_KEY_ALIAS`, and `DOLPHIN_KEY_PASSWORD`. Never commit keystores or passwords. Without these variables, the release AAB is unsigned and is not ready for Google Play upload.
- Communicate asynchronously between JavaScript and native Kotlin code.
- Opt camera and microphone permissions into an app manifest only when explicitly enabled with `dolphin config capability camera enable` or `dolphin config capability microphone enable`.
- Mediate WebView camera/microphone requests with trusted-origin checks, an in-app disclosure, and Android runtime permission checks.
- Read one-shot accelerometer, gyroscope, magnetometer, light and proximity sensor samples through the typed JavaScript bridge when those sensors are present.
- Perform bounded app-private file reads/writes on an I/O dispatcher, with canonical-path traversal protection.

## Android build commands

Run these commands from a generated Dolphin app directory:

- `dolphin build` or `dolphin build --apk`: debug APK in `dist-android/`.
- `dolphin build --release`: release APK in `dist-android/`.
- `dolphin build --aab`: release AAB in `dist-android/`.
- `dolphin build --all`: debug APK and release AAB in `dist-android/`.

For a signed release, set all four signing environment variables before building. Keep the keystore and credentials outside source control. Android App Bundles are distribution artifacts; use a locally signed release bundle or your protected CI signing configuration before uploading to Google Play.

## CLI commands

Run these commands from a generated Dolphin app unless noted otherwise:

- `dolphin --help` / `dolphin --version`: show CLI help and version.
- `dolphin init <app-name> [--package-id <id>]`: create an app.
- `dolphin config name <name>`, `config icon <png>`, `config package-id <id>`, and `config capability <camera|microphone> <enable|disable>`: configure the app.
- `dolphin run [--host <host>] [--port <port>]`: start Vite and launch an authorized Android device.
- `dolphin build [--apk|--release|--aab|--all]`: package Android outputs.
- `dolphin doctor`: check Node.js, npm, ADB, project configuration and the available Gradle installation/Wrapper.
- `dolphin test`: run the configured npm test script; if absent, use typecheck, then build as a validation fallback. Use `dolphin test --typecheck` to require the typecheck script.
- `dolphin device list`: list Android devices visible to ADB.
- `dolphin device install [apk-path] [--replace]`: install an APK; without a path, use the newest APK in `dist-android/`. `--replace` preserves app data when Android permits it.
- `dolphin clean`: remove generated web and packaged output folders. `dolphin clean --all` also removes Android Gradle build outputs; it does not remove source files or dependencies.

Deployment providers, a plugin registry/installer, and a secure CLI self-update channel are not implemented yet. Their commands will be added when those services and their security/update policies exist; Dolphin will not expose placeholder commands that imply those operations work.

## Experimental Python support

An experimental Python playground lives in `examples/python-playground`. It embeds Pyodide (CPython compiled to WebAssembly) in the web application and CI builds a dedicated Android APK for device testing. The first run downloads the Python runtime from jsDelivr and therefore requires internet access. Python code runs locally in the WebView; it is not uploaded to a server. This is a proof of concept, not yet a stable Dolphin language backend: offline runtime packaging and access to Dolphin native device APIs from Python remain future work.

## Device permissions and privacy

See [Device Permissions and Privacy Standard](docs/DEVICE_PERMISSIONS.md) for Dolphin's least-privilege permission rules, WebView camera/microphone boundary, and store-release requirements.

## Security baseline

The Android shell uses AndroidX WebKit's `WebViewCompat.addWebMessageListener` with an explicit origin allow-list and rejects iframe messages. It avoids a global `@JavascriptInterface`, which cannot reliably validate the calling frame's origin. Keep this boundary intact: never allow arbitrary remote origins or enable unrestricted file access.

## CI validation

GitHub Actions currently:
1. Installs workspace dependencies and builds the TypeScript bridge and CLI.
2. Scaffolds an app with a custom package ID and checks generated Gradle/Kotlin package configuration.
3. Verifies sensitive device permissions are absent by default and can be enabled/disabled per app.
4. Changes that package ID again and verifies the source package is moved consistently.
5. Builds the React starter app.
6. Builds the Android shell and verifies both APK and AAB Gradle tasks.

## Remaining release gates

- Commit a pinned Gradle Wrapper (including its wrapper JAR) to generated projects so builds do not depend on a system Gradle installation.
- Add automated bridge tests for RPC success/error behavior, invalid payloads, origin rejection, iframe rejection, and storage traversal.
- Add Android instrumentation tests and verify lifecycle behavior on emulator and physical devices.
- Generate density-specific and adaptive launcher icon resources rather than only copying a PNG.
- Add a content security policy, bridge quotas, a formal threat model, and release signing before production use.
- Validate Termux workflows on a real Android device and document required Android SDK/ADB setup.

## Development

Use Node.js 22 and pnpm 9.15.0 for the monorepo. Android CI uses JDK 17, Android SDK 35, and Gradle 8.9. See the CLI help for the available commands.
