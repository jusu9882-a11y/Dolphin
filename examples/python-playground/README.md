# Dolphin Python Playground (experimental)

This example runs Python 3 code in a Dolphin-hosted web application using Pyodide 0.27.7 (CPython compiled to WebAssembly).

## Run

```sh
pnpm install
pnpm --dir examples/python-playground dev --host 0.0.0.0
```

Open the Vite URL in a browser. On first execution, Pyodide is downloaded from jsDelivr, so the first run requires internet access. Python code is executed locally in the WebAssembly runtime; the source code is not sent to a server.

## Python device API

When hosted by a supported Dolphin native shell, the playground registers a small Python module:

```python
import json
import dolphin

print(dolphin.is_native())

info = json.loads(await dolphin.get_info())
print(info["model"], info["batteryLevel"])

reading = json.loads(await dolphin.get_sensor_data("accelerometer"))
print(reading["values"])

await dolphin.vibrate(100)
await dolphin.show_toast("Hello from Python")
```

Available calls: `is_native()`, `get_info()`, `get_sensor_data(sensor)`, `vibrate(duration_ms=100)`, and `show_toast(message)`. Sensor names are limited to accelerometer, gyroscope, magnetometer, light, and proximity. Async device operations must be awaited. In a regular browser, `is_native()` returns false and native operations are unavailable.

The Python facade delegates to the existing `@dolphin/bridge` SDK. Android origin validation, declared app capabilities, runtime permission checks, and native-side input validation remain in force; Python does not bypass them. This first bridge milestone exposes device information, one-shot sensor readings, vibration, and toast notifications. It does not yet expose camera, microphone, sensor streaming, or general filesystem access to Python.

## Current limitations

- This is an experimental Python-in-WebView proof of concept, not yet a general Dolphin language backend.
- The initial runtime download requires internet access; offline packaging is a later milestone.
- Python packages requiring native system extensions may not work unless built for Pyodide.
- The native Python bridge currently supports Android only.
- Android APK build and physical-device execution must be verified separately from the web build.
