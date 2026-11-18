# Install Dolphin v0.1 from source

Dolphin v0.1 is currently distributed as source code. The CLI is not yet published to npm. These steps build the CLI from the repository and link the `dolphin` command on your machine.

## Requirements

- Node.js 22 or newer
- Git
- npm (included with Node.js)
- pnpm 9.15.0
- For Android packaging: JDK 17, Android SDK platform 35, Android build-tools 35.0.0, ADB, and Gradle 8.9 (or a compatible Gradle Wrapper when supplied by the project)

## Termux (Android)

Open Termux and run:

```sh
pkg update && pkg upgrade
pkg install git nodejs-lts
npm install --global pnpm@9.15.0
git clone https://github.com/jusu9882-a11y/Dolphin.git
cd Dolphin
pnpm install
pnpm --filter @dolphin/bridge build
pnpm --filter @dolphin/cli build
pnpm --filter @dolphin/cli link --global
```

If pnpm reports that its global binary directory is not configured, run:

```sh
pnpm setup
```

Close and reopen Termux, then repeat the link command:

```sh
cd ~/Dolphin
pnpm --filter @dolphin/cli link --global
dolphin --help
```

Create a project:

```sh
dolphin init MyApp --package-id com.example.myapp
cd MyApp
npm install
```

Run the web development server:

```sh
npm run dev -- --host 0.0.0.0
```

Open the local Vite address shown in the terminal in your Android browser.

### Important Termux limitation

Installing the CLI and generating a project does not automatically install the Android build toolchain. To produce an APK or AAB, Android SDK platform/build-tools, Java and Gradle must also be configured. The complete Android packaging workflow has not yet been validated on Termux. The build environment validated in CI is Ubuntu with JDK 17, Android SDK 35 and Gradle 8.9. Do not assume `dolphin build` will work on a fresh Termux installation.

## Linux and macOS

Install Node.js 22+, Git and npm, then:

```sh
npm install --global pnpm@9.15.0
git clone https://github.com/jusu9882-a11y/Dolphin.git
cd Dolphin
pnpm install
pnpm --filter @dolphin/bridge build
pnpm --filter @dolphin/cli build
pnpm --filter @dolphin/cli link --global
dolphin --help
```

## Windows

Install Node.js 22+ (which includes npm) and Git. In PowerShell:

```powershell
npm install --global pnpm@9.15.0
git clone https://github.com/jusu9882-a11y/Dolphin.git
cd Dolphin
pnpm install
pnpm --filter @dolphin/bridge build
pnpm --filter @dolphin/cli build
pnpm --filter @dolphin/cli link --global
dolphin --help
```

If the `dolphin` command is not found, ensure pnpm's global bin directory is on your PATH. Run `pnpm setup` and open a new terminal.

## Download without Git

Download the repository ZIP:

https://github.com/jusu9882-a11y/Dolphin/archive/refs/heads/main.zip

Extract it, open a terminal in the extracted `Dolphin` folder, and run the dependency/build/link commands above. This is a snapshot of the main branch, not a versioned release archive.

## Build Android apps

After generating a project:

- `dolphin build` — debug APK
- `dolphin build --release` — release APK
- `dolphin build --aab` — release Android App Bundle
- `dolphin build --all` — debug APK and release AAB

A release artifact is not automatically signed for Google Play. Configure all four `DOLPHIN_*` signing environment variables with your own protected keystore and credentials. Never commit signing credentials.

## Project status

Dolphin is an Android-first early MVP. The source-based CLI setup is documented for Termux, Linux, macOS and Windows, but full Android SDK builds on Termux and physical-device behavior still require independent validation. See the main README for known limitations.
