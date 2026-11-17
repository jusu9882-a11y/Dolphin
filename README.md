# Dolphin

Dolphin is an early Android-first cross-platform app framework. It runs a React + Vite + TypeScript application inside a native Kotlin Android WebView and exposes native capabilities through a promise-based JavaScript bridge.

## Project status

**Prototype / MVP — not production-ready.** The initial source package exists, but it has not yet passed TypeScript, Android Gradle, emulator, or physical-device validation. Do not use it for sensitive production applications yet.

## Architecture

- `packages/cli`: Node.js/TypeScript command-line interface.
- `packages/bridge`: TypeScript promise-based native bridge SDK.
- `packages/android-shell/template`: Kotlin Android WebView host.
- `templates/default-app`: React + Vite + TypeScript starter.

## Security baseline

The Android shell uses AndroidX WebKit's `WebViewCompat.addWebMessageListener` with an explicit origin allow-list and rejects iframe messages. It avoids a global `@JavascriptInterface`, which cannot reliably validate the calling frame's origin. Keep this boundary intact: never allow arbitrary remote origins or enable unrestricted file access.

## Planned validation gates

1. Install dependencies reproducibly and run TypeScript checks.
2. Build the CLI and bridge packages.
3. Verify `dolphin init`, configuration, dev-server launch, and APK build.
4. Build the Android shell with a pinned Gradle wrapper and Android SDK.
5. Test bridge permissions, origin rejection, storage path validation, and error handling.
6. Run on an emulator and a physical Android device.
7. Add CI and release signing only after the build is repeatable.

## Known MVP gaps

- The Android project needs a committed Gradle wrapper and a reproducible SDK/Gradle configuration.
- Package ID changes must update Kotlin namespace and source package paths, not only `applicationId`.
- Launcher icon generation must create density-specific and adaptive icon resources.
- Automated CLI, bridge, and Android instrumentation tests are still required.
- A content security policy, bridge fuzzing, formal threat model, quotas, and release-signing workflow remain before production use.

See the source archive and subsequent commits for implementation details.