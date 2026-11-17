/**
 * Dolphin browser-to-native RPC client.
 * The Android host exposes window.DolphinNative.postMessage(json).
 */
export interface DeviceInfo {
  model: string;
  osVersion: string;
  batteryLevel: number;
}

export type DeviceSensor = "accelerometer" | "gyroscope" | "magnetometer" | "light" | "proximity";
export interface SensorReading {
  sensor: string;
  type: string;
  values: number[];
  accuracy: number;
  timestampNanos: number;
}

type RpcResult<T> =
  | { id: string; result: T }
  | { id: string; error: { code: string; message: string } };

declare global {
  interface Window {
    DolphinNative?: { postMessage(payload: string): void };
    __dolphinResolve?: (payload: string) => void;
    __dolphinSensorEvent?: (payload: string) => void;
  }
}

const pending = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();
let sequence = 0;
const DEFAULT_TIMEOUT_MS = 15_000;

function receive(payload: string): void {
  let response: RpcResult<unknown>;
  try { response = JSON.parse(payload) as RpcResult<unknown>; }
  catch { return; }
  const request = pending.get(response.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(response.id);
  if ("error" in response) request.reject(new Error(`${response.error.code}: ${response.error.message}`));
  else request.resolve(response.result);
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
  if (typeof window === "undefined" || !window.DolphinNative) {
    return Promise.reject(new Error("Dolphin native runtime is unavailable"));
  }
  const id = `dolphin-${Date.now()}-${++sequence}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Dolphin RPC timed out: ${method}`));
    }, DEFAULT_TIMEOUT_MS);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
    try { window.DolphinNative!.postMessage(JSON.stringify({ id, method, params })); }
    catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export const Dolphin = {
  isNative: (): boolean =>
    typeof window !== "undefined" && typeof window.DolphinNative?.postMessage === "function",
  device: {
    vibrate(durationMs = 100): Promise<void> {
      if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 10_000)
        return Promise.reject(new RangeError("durationMs must be between 0 and 10000"));
      return rpc<void>("device.vibrate", { durationMs });
    },
    getInfo(): Promise<DeviceInfo> { return rpc<DeviceInfo>("device.getInfo"); },
    watchSensor(sensor: DeviceSensor, onReading: (reading: SensorReading) => void, frequency: "normal" | "ui" | "game" | "fast" = "normal"): Promise<() => Promise<void>> {
      const supported: DeviceSensor[] = ["accelerometer", "gyroscope", "magnetometer", "light", "proximity"];
      if (!supported.includes(sensor)) return Promise.reject(new RangeError("Unsupported sensor"));
      if (typeof onReading !== "function") return Promise.reject(new TypeError("onReading must be a function"));
      const streamId = "sensor-" + Date.now() + "-" + (++sequence);
      return rpc<{ streamId: string }>("device.startSensorStream", { streamId, sensor, frequency }).then(() => {
        sensorListeners.set(streamId, onReading);
        let stopped = false;
        return async (): Promise<void> => {
          if (stopped) return;
          stopped = true;
          sensorListeners.delete(streamId);
          await rpc<void>("device.stopSensorStream", { streamId });
        };
      });
    },
    getSensorData(sensor: DeviceSensor): Promise<SensorReading> {
      const supported: DeviceSensor[] = ["accelerometer", "gyroscope", "magnetometer", "light", "proximity"];
      if (!supported.includes(sensor)) return Promise.reject(new RangeError("Unsupported sensor"));
      return rpc<SensorReading>("device.getSensorData", { sensor });
    }
  },
  ui: {
    showToast(message: string): Promise<void> {
      if (typeof message !== "string" || message.length > 500)
        return Promise.reject(new TypeError("message must be a string of at most 500 characters"));
      return rpc<void>("ui.showToast", { message });
    }
  },
  fs: {
    readFile(path: string): Promise<string> { return rpc<string>("fs.readFile", { path }); },
    writeFile(path: string, data: string): Promise<void> { return rpc<void>("fs.writeFile", { path, data }); }
  }
};
export default Dolphin;
