# Dolphin

Dolphin is an Android-first app framework for building mobile applications with React, Vite, and TypeScript, hosted in a native Kotlin Android WebView. Native capabilities are exposed through a promise-based JavaScript bridge.

## Project status

**Early MVP — not production-ready.** The repository currently builds the TypeScript bridge, CLI, starter app, and Android shell in GitHub Actions. CLI scaffolding and custom Android package-ID updates are smoke-tested in CI. A successful CI build does not prove correct behavior on a physical device; emulator and physical-device validation are still outstanding.

## Architecture

- `packages/cli`: Node.js/TypeScript command-line interface.
- `packages/bridge`: TypeScript promise-based native bridge SDK.
- `packages/android-shell/template`: Kotlin Android WebView host.
- `templates/default-app`: React + Vite + TypeScript starter.

## Current capabilities

- Scaffold a React/Vite application with an Android Kotlin shell.
- Configure the display name, PNG icon input, and Android application ID.
- Keep Android `namespace`, `applicationId`, and Kotlin package declarations aligned when setting a custom package ID.
- Run a Vite development server and launch an authorized Android device through ADB reverse.
- Build web assets and package an APK using the Gradle Wrapper when present, or a system Gradle installation as a fallback.
- Communicate asynchronously between JavaScript and native Kotlin code.
- Opt camera and microphone permissions into an app manifest only when explicitly enabled with `dolphin config capability camera enable` or `dolphin config capability microphone enable`.
- Mediate WebView camera/microphone requests with trusted-origin checks, an in-app disclosure, and Android runtime permission checks.
- Read one-shot accelerometer, gyroscope, magnetometer, light and proximity sensor samples through the typed JavaScript bridge when those sensors are present.
- Perform bounded app-private file reads/writes on an I/O dispatcher, with canonical-path traversal protection.

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
6. Builds the Android shell with Java 17, Android SDK 35, and Gradle 8.9.

## Remaining release gates

- Commit a pinned Gradle Wrapper (including its wrapper JAR) to generated projects so builds do not depend on a system Gradle installation.
- Add automated bridge tests for RPC success/error behavior, invalid payloads, origin rejection, iframe rejection, and storage traversal.
- Add Android instrumentation tests and verify lifecycle behavior on emulator and physical devices.
- Generate density-specific and adaptive launcher icon resources rather than only copying a PNG.
- Add a content security policy, bridge quotas, a formal threat model, and release signing before production use.
- Validate Termux workflows on a real Android device and document required Android SDK/ADB setup.

## Development

Use Node.js 22 and pnpm 9.15.0 for the monorepo. Android CI uses JDK 17, Android SDK 35, and Gradle 8.9. See the CLI help for the available commands.
