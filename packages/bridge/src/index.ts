/**
 * Dolphin browser-to-native RPC client.
 * The Android host exposes window.DolphinNative.postMessage(json).
 */
export interface DeviceInfo {
  model: string;
  osVersion: string;
  batteryLevel: number;
}

type RpcResult<T> =
  | { id: string; result: T }
  | { id: string; error: { code: string; message: string } };

declare global {
  interface Window {
    DolphinNative?: { postMessage(payload: string): void };
    __dolphinResolve?: (payload: string) => void;
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
    getInfo(): Promise<DeviceInfo> { return rpc<DeviceInfo>("device.getInfo"); }
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
