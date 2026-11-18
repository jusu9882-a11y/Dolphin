import { useState } from "react";
import { loadPyodide, type PyodideInterface } from "pyodide";

const STARTER = `name = "Dolphin"
numbers = [10, 20, 30, 40]

print("Hello from", name)
print("Numbers:", numbers)
print("Total:", sum(numbers))
print("Average:", sum(numbers) / len(numbers))`;

let runtimePromise: Promise<PyodideInterface> | null = null;
function getPython(): Promise<PyodideInterface> {
  if (!runtimePromise) {
    runtimePromise = loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/"
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
      setOutput(lines.join("\n") || "Python finished without printed output.");
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <main className="shell">
    <header>
      <div className="eyebrow">DOLPHIN FRAMEWORK · LANGUAGE EXPERIMENT</div>
      <h1>Python <span>Playground</span></h1>
      <p>Run real Python code inside a Dolphin app using the Pyodide WebAssembly runtime.</p>
    </header>
    <section className="status"><span className={ready ? "dot ready" : "dot"} />{ready ? "Python runtime loaded" : "Python runtime not loaded"} <small>First launch downloads the runtime; an internet connection is required.</small></section>
    <label htmlFor="python-code">YOUR PYTHON CODE</label>
    <textarea id="python-code" spellCheck={false} value={code} onChange={event => setCode(event.target.value)} />
    <button onClick={() => void runPython()} disabled={busy}>{busy ? "Running Python…" : "▶  Run Python"}</button>
    <label htmlFor="python-output">OUTPUT</label>
    <pre id="python-output" aria-live="polite">{output}</pre>
    <footer>Code executes locally in this app. Dolphin does not upload your code to a server. The Python runtime is downloaded from jsDelivr on first use.</footer>
  </main>;
}