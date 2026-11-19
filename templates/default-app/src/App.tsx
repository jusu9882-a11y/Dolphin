import { useEffect, useRef, useState } from "react";

type Recording = { id: string; name: string; createdAt: number; blob: Blob; mimeType: string };
const DB_NAME = "wittle-voice-recorder";
const STORE = "recordings";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local recording storage"));
  });
}
async function storeRecording(recording: Recording): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(recording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save recording"));
    tx.onabort = () => reject(tx.error ?? new Error("Saving recording was cancelled"));
  });
  db.close();
}
async function loadRecordings(): Promise<Recording[]> {
  const db = await openDatabase();
  const result = await new Promise<Recording[]>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as Recording[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error ?? new Error("Could not load recordings"));
  });
  db.close();
  return result;
}
async function updateRecording(recording: Recording): Promise<void> { await storeRecording(recording); }
async function removeRecording(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete recording"));
  });
  db.close();
}
function makeId(): string { return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `recording-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function App() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("Your recordings stay on this device.");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try { setRecordings(await loadRecordings()); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }
  useEffect(() => {
    void refresh();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach(track => track.stop());
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("Audio recording is not supported by this Android WebView.");
      return;
    }
    try {
      setStatus("Requesting microphone permission…");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onerror = event => setStatus(`Recording error: ${(event as Event & { error?: DOMException }).error?.message ?? "unknown error"}`);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setRecording(false);
        if (!blob.size) {
          setSaving(false);
          setStatus("No audio was captured. Please try again.");
          return;
        }
        const createdAt = Date.now();
        const clip: Recording = {
          id: makeId(),
          name: `Recording ${new Date(createdAt).toLocaleString()}`,
          createdAt,
          blob,
          mimeType: blob.type || "audio/webm"
        };
        try {
          await storeRecording(clip);
          await refresh();
          setStatus("Recording saved on this device.");
        } catch (error) {
          setStatus(error instanceof Error ? `Could not save recording: ${error.message}` : "Could not save recording.");
        } finally { setSaving(false); }
      };
      recorderRef.current = recorder;
      recorder.start(500);
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      setSaving(false);
      setStatus("Recording… speak near your phone.");
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 250);
    } catch (error) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      setSaving(true);
      setStatus("Finishing and saving recording…");
      recorder.stop();
    }
    recorderRef.current = null;
  }

  async function renameRecording(clip: Recording) {
    const name = window.prompt("Recording name", clip.name)?.trim();
    if (!name || name === clip.name) return;
    try { await updateRecording({ ...clip, name }); await refresh(); setStatus("Recording renamed."); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }
  async function deleteRecording(clip: Recording) {
    if (!window.confirm(`Delete "${clip.name}"? This cannot be undone.`)) return;
    try { await removeRecording(clip.id); await refresh(); setStatus("Recording deleted."); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }

  return <main className="recorder">
    <header>
      <div className="eyebrow">WITTLE · PRIVATE AUDIO</div>
      <h1>Voice <span>Recorder</span></h1>
      <p className="intro">Capture a thought, a meeting, or a voice note. Your audio stays on this device.</p>
    </header>
    <section className="record-card">
      <div className={`mic-orb ${recording ? "active" : ""}`} aria-hidden="true">●</div>
      <div className="timer">{formatDuration(elapsed)}</div>
      <div className="record-status">{status}</div>
      {!recording
        ? <button className="record-button" onClick={() => void startRecording()} disabled={saving}>● &nbsp; {saving ? "Saving…" : "Start recording"}</button>
        : <button className="stop-button" onClick={stopRecording}>■ &nbsp; Stop and save</button>}
      <div className="privacy-note"> <span>●</span> Microphone is used only while recording</div>
    </section>
    <section className="library">
      <div className="library-heading"><div><div className="eyebrow">ON THIS DEVICE</div><h2>My recordings</h2></div><span className="count">{recordings.length}</span></div>
      {recordings.length === 0
        ? <div className="empty"><div className="empty-icon">♫</div><strong>No recordings yet</strong><p>Tap Start recording to create your first voice note.</p></div>
        : <div className="recording-list">{recordings.map(clip => <article className="clip" key={clip.id}>
          <div className="clip-icon">♫</div>
          <div className="clip-info"><strong>{clip.name}</strong><span>{formatDate(clip.createdAt)} · {(clip.blob.size / 1024 / 1024).toFixed(2)} MB</span><audio controls preload="none" src={URL.createObjectURL(clip.blob)} /></div>
          <div className="clip-actions"><button className="small-button" onClick={() => void renameRecording(clip)} aria-label="Rename recording">✎</button><button className="small-button delete" onClick={() => void deleteRecording(clip)} aria-label="Delete recording">×</button></div>
        </article>)}</div>}
    </section>
    <footer>Recordings are stored locally in this app. Uninstalling the app or clearing its data may delete them. Back them up before removing the app.</footer>
  </main>;
}
