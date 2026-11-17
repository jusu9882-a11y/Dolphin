import { useState } from "react";
import Dolphin from "@dolphin/bridge";

export default function App() {
  const [status, setStatus] = useState("Ready");
  async function testBridge() {
    try {
      await Dolphin.ui.showToast("Hello from Dolphin");
      setStatus("Native bridge connected");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }
  return <main>
    <div className="eyebrow">DOLPHIN RUNTIME</div>
    <h1>Your app.<br /><span>Native speed.</span></h1>
    <p>A React application running inside a native Android shell.</p>
    <button onClick={testBridge}>Test native bridge</button>
    <output>{status}</output>
  </main>;
}
