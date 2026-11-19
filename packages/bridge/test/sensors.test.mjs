import test from "node:test";
import assert from "node:assert/strict";

const sent = [];
globalThis.window = {
  WittleNative: {
    postMessage(payload) {
      const request = JSON.parse(payload);
      sent.push(request);
      // The native stop RPC completes with an empty result; mirror that
      // acknowledgement so the test exercises the SDK's full stop lifecycle.
      if (request.method === "device.stopSensorStream") {
        queueMicrotask(() => respond(request, null));
      }
    }
  }
};
const { default: Wittle } = await import("../dist/index.js");

function respond(request, result) {
  window.__wittleResolve(JSON.stringify({ id: request.id, result }));
}

test("getSensorData resolves a native sensor reading", async () => {
  const promise = Wittle.device.getSensorData("accelerometer");
  const request = sent.at(-1);
  assert.equal(request.method, "device.getSensorData");
  assert.equal(request.params.sensor, "accelerometer");
  const reading = {
    sensor: "Accelerometer", type: "android.sensor.accelerometer",
    values: [0.1, 0.2, 9.8], accuracy: 3, timestampNanos: 123
  };
  respond(request, reading);
  assert.deepEqual(await promise, reading);
});

test("watchSensor receives events and its stop callback closes the stream", async () => {
  const received = [];
  const started = Wittle.device.watchSensor("gyroscope", value => received.push(value), "ui");
  const startRequest = sent.at(-1);
  assert.equal(startRequest.method, "device.startSensorStream");
  assert.equal(startRequest.params.sensor, "gyroscope");
  assert.equal(startRequest.params.frequency, "ui");

  const reading = {
    sensor: "Gyroscope", type: "android.sensor.gyroscope",
    values: [1, 2, 3], accuracy: 3, timestampNanos: 456
  };
  window.__wittleSensorEvent(JSON.stringify({
    streamId: startRequest.params.streamId, reading
  }));
  assert.deepEqual(received, [reading]);

  respond(startRequest, { streamId: startRequest.params.streamId });
  const stop = await started;
  await stop();
  assert.equal(sent.at(-1).method, "device.stopSensorStream");
  assert.equal(sent.at(-1).params.streamId, startRequest.params.streamId);
  assert.equal(received.length, 1);
});

test("watchSensor rejects unsupported sensor names", async () => {
  await assert.rejects(
    Wittle.device.watchSensor("camera", () => {}),
    RangeError
  );
});
