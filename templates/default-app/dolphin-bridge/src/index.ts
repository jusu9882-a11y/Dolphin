export interface DeviceInfo { model: string; osVersion: string; batteryLevel: number; }
export type DeviceSensor = "accelerometer" | "gyroscope" | "magnetometer" | "light" | "proximity";
export interface SensorReading { sensor: string; type: string; values: number[]; accuracy: number; timestampNanos: number; }

type RpcResult<T> = { id: string; result: T } | { id: string; error: { code: string; message: string } };
declare global {
  interface Window {
    DolphinNative?: { postMessage(payload: string): void };
    __dolphinResolve?: (payload: string) => void;
    __dolphinSensorEvent?: (payload: string) => void;
  }
}
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let sequence = 0;
function receive(payload: string) {
  let response: RpcResult<unknown>;
  try { response = JSON.parse(payload) as RpcResult<unknown>; } catch { return; }
  const item = pending.get(response.id);
  if (!item) return;
  clearTimeout(item.timer); pending.delete(response.id);
  if ("error" in response) item.reject(new Error(`${response.error.code}: ${response.error.message}`));
  else item.resolve(response.result);
}
if (typeof window !== "undefined") window.__dolphinResolve = receive;
const sensorListeners = new Map<string, (reading: SensorReading) => void>();
if (typeof window !== "undefined") {
  window.__dolphinSensorEvent = (payload: string): void => {
    try {
      const event = JSON.parse(payload) as { streamId: string; reading: SensorReading };
      sensorListeners.get(event.streamId)?.(event.reading);
    } catch { /* Ignore malformed native events. */ }
  };
}
function rpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  if (typeof window === "undefined" || !window.DolphinNative) return Promise.reject(new Error("Dolphin native runtime is unavailable"));
  const id = `dolphin-${Date.now()}-${++sequence}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Dolphin RPC timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    try { window.DolphinNative!.postMessage(JSON.stringify({ id, method, params })); }
    catch (e) { clearTimeout(timer); pending.delete(id); reject(e instanceof Error ? e : new Error(String(e))); }
  });
}
const Dolphin = {
  isNative: () => typeof window !== "undefined" && typeof window.DolphinNative?.postMessage === "function",
  device: {
    vibrate: (durationMs = 100) => durationMs >= 0 && durationMs <= 10000 ? rpc<void>("device.vibrate", { durationMs }) : Promise.reject(new RangeError("Invalid vibration duration")),
    getInfo: () => rpc<DeviceInfo>("device.getInfo"),
    watchSensor: (sensor: DeviceSensor, onReading: (reading: SensorReading) => void, frequency: "normal" | "ui" | "game" | "fast" = "normal"): Promise<() => Promise<void>> => {
      const supported: DeviceSensor[] = ["accelerometer", "gyroscope", "magnetometer", "light", "proximity"];
      if (!supported.includes(sensor)) return Promise.reject(new RangeError("Unsupported sensor"));
      if (typeof onReading !== "function") return Promise.reject(new TypeError("onReading must be a function"));
      const streamId = "sensor-" + Date.now() + "-" + (++sequence);
      sensorListeners.set(streamId, onReading);
      return rpc<{ streamId: string }>("device.startSensorStream", { streamId, sensor, frequency }).then(() => {
        let stopped = false;
        return async (): Promise<void> => {
          if (stopped) return;
          stopped = true;
          sensorListeners.delete(streamId);
          await rpc<void>("device.stopSensorStream", { streamId });
        };
      }).catch((error: unknown) => {
        sensorListeners.delete(streamId);
        throw error;
      });
    },
    getSensorData: (sensor: DeviceSensor): Promise<SensorReading> => {
      const supported: DeviceSensor[] = ["accelerometer", "gyroscope", "magnetometer", "light", "proximity"];
      return supported.includes(sensor) ? rpc<SensorReading>("device.getSensorData", { sensor }) : Promise.reject(new RangeError("Unsupported sensor"));
    }
  },
  ui: { showToast: (message: string) => rpc<void>("ui.showToast", { message }) },
  fs: {
    readFile: (path: string) => rpc<string>("fs.readFile", { path }),
    writeFile: (path: string, data: string) => rpc<void>("fs.writeFile", { path, data })
  }
};
export default Dolphin;
