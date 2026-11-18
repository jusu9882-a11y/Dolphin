# Dolphin Python Playground (experimental)

This example runs Python 3 code in a Dolphin-hosted web application using Pyodide 0.27.7 (CPython compiled to WebAssembly).

## Run

```sh
pnpm install
pnpm --dir examples/python-playground dev --host 0.0.0.0
```

Open the Vite URL in a browser. On first execution, Pyodide is downloaded from jsDelivr, so the first run requires internet access. Python code is executed locally in the WebAssembly runtime; the source code is not sent to a server.

## Current limitations

- This is an experimental Python-in-WebView proof of concept, not yet a general Dolphin language backend.
- The initial runtime download requires internet access; offline packaging is a later milestone.
- Python packages requiring native system extensions may not work unless built for Pyodide.
- Native Dolphin device APIs are not yet exposed to Python.
- Android APK build and physical-device execution must be verified separately from the web build.