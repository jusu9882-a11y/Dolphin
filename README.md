# Wittle

Wittle is an Android-first app framework for building mobile applications with React, Vite, and TypeScript, hosted in a native Kotlin Android WebView. Native capabilities are exposed through a promise-based JavaScript bridge.

## Project ownership and license

Wittle is developed by **Francis Jusu**, founder of **JTT (JUSU TECH TEAM)**. Francis is a self-taught software engineer and open-source developer whose other projects include JUSU (a Python library for web applications), Earth Plus, and Hand Mouse.

Wittle is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Contributions are governed by [CONTRIBUTING.md](CONTRIBUTING.md). Third-party dependencies remain subject to their own licenses.

## Project status

**Early MVP — not production-ready.** The repository currently builds the TypeScript bridge, CLI, starter app, and Android shell in GitHub Actions. CLI scaffolding and custom Android package-ID updates are smoke-tested in CI. A successful CI build does not prove correct behavior on a physical device; emulator and physical-device validation are still outstanding.

## Download and install

Wittle v0.1 is distributed as source code from this repository. Download the ZIP from the green **Code** button on GitHub, or clone it with Git:

```sh
git clone https://github.com/jusu9882-a11y/Wittle.git
cd Wittle
```

See [Installation for Termux, Linux, macOS and Windows](docs/INSTALLATION.md) for prerequisites and commands to build and link the CLI locally. The CLI is not currently published to npm, so `npm install -g @wittle/cli` is not an available installation method.

**Termux note:** the source-based CLI and project scaffolding can be installed in Termux. Building Android APKs from Termux additionally requires a working Java, Android SDK/build-tools and Gradle setup; that complete Termux packaging workflow has not yet been validated. Wittle is an early MVP, not production-ready.

## Architecture

- `packages/cli`: Node.js/TypeScript command-line interface.
- `packages/bridge`: TypeScript promise-based native bridge SDK.
- `packages/android-shell/template`: Kotlin Android WebView host.
- `templates/default-app`: React + Vite + TypeScript starter.
- `examples/python-playground`: experimental Python 3 execution inside the Wittle WebView using Pyodide/WebAssembly.

## Current capabilities

- Scaffold a React/Vite application with an Android Kotlin shell.
- Configure the display name, PNG icon input, and Android application ID.
- Keep Android `namespace`, `applicationId`, and Kotlin package declarations aligned when setting a custom package ID.
- Run a Vite development server and launch an authorized Android device through ADB reverse.
- Build web assets and package a debug/release APK or a release Android App Bundle (AAB); use `wittle build --all` to produce a debug APK and release AAB together.
- Configure optional release signing through the environment variables `WITTLE_KEYSTORE_PATH`, `WITTLE_KEYSTORE_PASSWORD`, `WITTLE_KEY_ALIAS`, and `WITTLE_KEY_PASSWORD`. Never commit keystores or passwords. Without these variables, the release AAB is unsigned and is not ready for Google Play upload.
- Communicate asynchronously between JavaScript and native Kotlin code.
- Opt camera and microphone permissions into an app manifest only when explicitly enabled with `wittle config capability camera enable` or `wittle config capability microphone enable`.
- Mediate WebView camera/microphone requests with trusted-origin checks, an in-app disclosure, and Android runtime permission checks.
- Read one-shot accelerometer, gyroscope, magnetometer, light and proximity sensor samples through the typed JavaScript bridge when those sensors are present.
- Perform bounded app-private file reads/writes on an I/O dispatcher, with canonical-path traversal protection.

## Android build commands

Run these commands from a generated Wittle app directory:

- `wittle build` or `wittle build --apk`: debug APK in `dist-android/`.
- `wittle build --release`: release APK in `dist-android/`.
- `wittle build --aab`: release AAB in `dist-android/`.
- `wittle build --all`: debug APK and release AAB in `dist-android/`.

For a signed release, set all four signing environment variables before building. Keep the keystore and credentials outside source control. Android App Bundles are distribution artifacts; use a locally signed release bundle or your protected CI signing configuration before uploading to Google Play.

## CLI commands

Run these commands from a generated Wittle app unless noted otherwise:

- `wittle --help` / `wittle --version`: show CLI help and version.
- `wittle init <app-name> [--package-id <id>]`: create an app.
- `wittle config name <name>`, `config icon <png>`, `config package-id <id>`, and `config capability <camera|microphone> <enable|disable>`: configure the app.
- `wittle run [--host <host>] [--port <port>]`: start Vite and launch an authorized Android device.
- `wittle build [--apk|--release|--aab|--all]`: package Android outputs.
- `wittle doctor`: check Node.js, npm, ADB, project configuration and the available Gradle installation/Wrapper.
- `wittle test`: run the configured npm test script; if absent, use typecheck, then build as a validation fallback. Use `wittle test --typecheck` to require the typecheck script.
- `wittle device list`: list Android devices visible to ADB.
- `wittle device install [apk-path] [--replace]`: install an APK; without a path, use the newest APK in `dist-android/`. `--replace` preserves app data when Android permits it.
- `wittle clean`: remove generated web and packaged output folders. `wittle clean --all` also removes Android Gradle build outputs; it does not remove source files or dependencies.

Deployment providers, a plugin registry/installer, and a secure CLI self-update channel are not implemented yet. Their commands will be added when those services and their security/update policies exist; Wittle will not expose placeholder commands that imply those operations work.

## Experimental Python support

An experimental Python playground lives in `examples/python-playground`. It embeds Pyodide (CPython compiled to WebAssembly) in the web application and CI builds a dedicated Android APK for device testing. The first run downloads the Python runtime from jsDelivr and therefore requires internet access. Python code runs locally in the WebView; it is not uploaded to a server. This is a proof of concept, not yet a stable Wittle language backend: offline runtime packaging and access to Wittle native device APIs from Python remain future work.

## Device permissions and privacy

See [Device Permissions and Privacy Standard](docs/DEVICE_PERMISSIONS.md) for Wittle's least-privilege permission rules, WebView camera/microphone boundary, and store-release requirements.

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
