import assert from "node:assert/strict";
import test from "node:test";
import { decodeProviderPayload, parseActivityStartOutput } from "../src/adb-client.mjs";

test("decodes a ContentProvider Bundle payload", () => {
  const expected = { schemaVersion: 1, active: true };
  const encoded = Buffer.from(JSON.stringify(expected), "utf8").toString("base64");
  assert.deepEqual(decodeProviderPayload(`Result: Bundle[{payload_base64=${encoded}}]`), expected);
});

test("surfaces a provider error", () => {
  const encoded = Buffer.from(JSON.stringify({ error: "session unavailable" }), "utf8").toString("base64");
  assert.throws(
    () => decodeProviderPayload(`Result: Bundle[{payload_base64=${encoded}}]`),
    /Screen Remote diagnostics error: session unavailable/u,
  );
});

test("rejects output without a diagnostics payload", () => {
  assert.throws(() => decodeProviderPayload("Result: Bundle[{}]"), /did not return a payload/u);
});

test("parses Android activity launch output", () => {
  assert.deepEqual(
    parseActivityStartOutput(
      [
        "Status: ok",
        "LaunchState: WARM",
        "Activity: com.screen.remote.android/.app.MainActivity",
        "TotalTime: 42",
        "WaitTime: 50",
      ].join("\n"),
    ),
    {
      status: "ok",
      activity: "com.screen.remote.android/.app.MainActivity",
      launchState: "WARM",
      totalTimeMs: 42,
      waitTimeMs: 50,
      raw:
        "Status: ok\nLaunchState: WARM\nActivity: com.screen.remote.android/.app.MainActivity\nTotalTime: 42\nWaitTime: 50",
    },
  );
});
