import { useState } from "react";
import { loadPyodide, type PyodideInterface } from "pyodide";
import { Dolphin } from "../../../packages/bridge/src/index";

const STARTER = `import json
import dolphin

print("Hello from Dolphin Python")

if dolphin.is_native():
    info = json.loads(await dolphin.get_info())
    print("Device:", info["model"])
    print("Android:", info["osVersion"])
    print("Battery:", str(info["batteryLevel"]) + "%")

    reading = json.loads(await dolphin.get_sensor_data("accelerometer"))
    print("Accelerometer:", reading["values"])
else:
    print("Native device APIs are available when this code runs inside a Dolphin app.")
`;

let runtimePromise: Promise<PyodideInterface> | null = null;
function getPython(): Promise<PyodideInterface> {
  if (!runtimePromise) {
    runtimePromise = loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/"
    }).then(pyodide => {
      // Expose a deliberately small, documented Python facade over the
      // existing trusted Dolphin SDK. Native permission checks remain native.
      pyodide.registerJsModule("dolphin", {
        is_native: () => Dolphin.isNative(),
        get_info: async () => JSON.stringify(await Dolphin.device.getInfo()),
        get_sensor_data: async (sensor: string) => {
          if (!["accelerometer", "gyroscope", "magnetometer", "light", "proximity"].includes(sensor)) {
            throw new RangeError("Unsupported sensor");
          }
          return JSON.stringify(await Dolphin.device.getSensorData(
            sensor as "accelerometer" | "gyroscope" | "magnetometer" | "light" | "proximity"
          ));
        },
        vibrate: async (durationMs = 100) => {
          await Dolphin.device.vibrate(Number(durationMs));
          return true;
        },
        show_toast: async (message: string) => {
          await Dolphin.ui.showToast(String(message));
          return true;
        }
      });
      return pyodide;
    }).catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

export default function App() {
  const [code, setCode] = useState(STARTER);
  const [output, setOutput] = useState("Press Run Python to start the Python runtime.");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  async function runPython() {
    setBusy(true);
    setOutput("Starting Python WebAssembly runtime…");
    try {
      const pyodide = await getPython();
      setReady(true);
      const lines: string[] = [];
      pyodide.setStdout({ batched: line => lines.push(line) });
      pyodide.setStderr({ batched: line => lines.push(line) });
      await pyodide.runPythonAsync(code);
      setOutput(lines.join("\\n") || "Python finished without printed output.");
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <main className="shell">
    <header>
      <div className="eyebrow">DOLPHIN FRAMEWORK · PYTHON DEVICE BRIDGE</div>
      <h1>Python <span>Playground</span></h1>
      <p>Run Python code and access supported native Dolphin device APIs from Python.</p>
    </header>
    <section className="status"><span className={ready ? "dot ready" : "dot"} />{ready ? "Python runtime loaded" : "Python runtime not loaded"} <small>First launch downloads the runtime; an internet connection is required.</small></section>
    <label htmlFor="python-code">YOUR PYTHON CODE</label>
    <textarea id="python-code" spellCheck={false} value={code} onChange={event => setCode(event.target.value)} />
    <button onClick={() => void runPython()} disabled={busy}>{busy ? "Running Python…" : "▶  Run Python"}</button>
    <label htmlFor="python-output">OUTPUT</label>
    <pre id="python-output" aria-live="polite">{output}</pre>
    <footer>Python executes locally in WebAssembly. Device calls go through Dolphin's validated native bridge; Android permissions and capability checks are still enforced by the host app.</footer>
  </main>;
}
