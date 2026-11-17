import { useEffect, useRef, useState } from "react";
import Dolphin, { type DeviceSensor, type SensorReading } from "@dolphin/bridge";

type CaptureKind = "camera" | "microphone";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const stopSensorRef = useRef<(() => Promise<void>) | null>(null);
  const [captureStatus, setCaptureStatus] = useState("Not tested");
  const [captureKind, setCaptureKind] = useState<CaptureKind | null>(null);
  const [sensorStatus, setSensorStatus] = useState("Not tested");
  const [sensorReading, setSensorReading] = useState<SensorReading | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState("Checking runtime…");

  useEffect(() => {
    setBridgeStatus(Dolphin.isNative() ? "Native bridge connected" : "Native bridge unavailable");
    return () => {
      mediaRef.current?.getTracks().forEach((track) => track.stop());
      void stopSensorRef.current?.();
    };
  }, []);

  async function startCapture(kind: CaptureKind) {
    stopCapture();
    setCaptureKind(kind);
    setCaptureStatus(`Requesting ${kind} permission…`);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Media capture is unavailable in this WebView.");
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "camera" ? { video: { facingMode: "environment" }, audio: false } : { video: false, audio: true }
      );
      mediaRef.current = stream;
      if (kind === "camera" && videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCaptureStatus(`${kind === "camera" ? "Camera" : "Microphone"} permission granted; live capture is active.`);
    } catch (error) {
      setCaptureKind(null);
      setCaptureStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function stopCapture() {
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCaptureKind(null);
  }

  async function startSensor(sensor: DeviceSensor) {
    try {
      await stopSensorRef.current?.();
      stopSensorRef.current = null;
      setSensorReading(null);
      setSensorStatus(`Starting ${sensor}…`);
      const stop = await Dolphin.device.watchSensor(sensor, (reading) => {
        setSensorReading(reading);
        setSensorStatus(`${sensor} stream is active`);
      }, "ui");
      stopSensorRef.current = stop;
      setSensorStatus(`${sensor} stream started; waiting for a reading…`);
    } catch (error) {
      setSensorStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function stopSensor() {
    try {
      await stopSensorRef.current?.();
      stopSensorRef.current = null;
      setSensorStatus("Sensor stream stopped.");
    } catch (error) {
      setSensorStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return <main>
    <div className="eyebrow">DOLPHIN RUNTIME · DEVICE DIAGNOSTICS</div>
    <h1>Test your <span>device.</span></h1>
    <p>Run real permission and hardware checks on this Android device. Each test starts only when you tap its button.</p>

    <section className="panel">
      <h2>Native bridge</h2>
      <output>{bridgeStatus}</output>
      <button className="secondary" onClick={async () => {
        try { await Dolphin.ui.showToast("Dolphin native bridge is working"); setBridgeStatus("Native bridge RPC passed"); }
        catch (error) { setBridgeStatus(error instanceof Error ? error.message : String(error)); }
      }}>Test bridge message</button>
    </section>

    <section className="panel">
      <h2>Camera</h2>
      <p>Requests camera access through the app disclosure and Android permission prompt.</p>
      <video ref={videoRef} autoPlay playsInline muted />
      <div className="actions">
        <button onClick={() => void startCapture("camera")}>Test camera</button>
        {captureKind === "camera" && <button className="secondary" onClick={stopCapture}>Stop camera</button>}
      </div>
      <output>{captureKind === "camera" ? captureStatus : captureStatus}</output>
    </section>

    <section className="panel">
      <h2>Microphone</h2>
      <p>Requests microphone access and verifies that an audio capture track starts.</p>
      <div className="actions">
        <button onClick={() => void startCapture("microphone")}>Test microphone</button>
        {captureKind === "microphone" && <button className="secondary" onClick={stopCapture}>Stop microphone</button>}
      </div>
      <output>{captureKind === "microphone" ? captureStatus : "Microphone test is idle."}</output>
    </section>

    <section className="panel">
      <h2>Motion and environment sensors</h2>
      <p>Starts a live native sensor stream. Move or tilt the phone to see readings change.</p>
      <div className="actions sensor-actions">
        {(["accelerometer", "gyroscope", "magnetometer", "light", "proximity"] as DeviceSensor[]).map((sensor) =>
          <button className="secondary" key={sensor} onClick={() => void startSensor(sensor)}>{sensor}</button>
        )}
      </div>
      <button className="stop" onClick={() => void stopSensor()}>Stop sensor</button>
      <output>{sensorStatus}</output>
      {sensorReading && <pre>{JSON.stringify(sensorReading, null, 2)}</pre>}
    </section>
    <p className="footnote">Privacy: capture and sensor streams stop when you stop them or close the app. Nothing is uploaded or saved by this test screen.</p>
  </main>;
}
