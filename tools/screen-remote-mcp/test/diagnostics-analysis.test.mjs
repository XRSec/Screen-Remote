import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRuntime,
  buildConnectionTimeline,
  calculateMetricRates,
  summarizeLogs,
} from "../src/diagnostics-analysis.mjs";

const logEntries = [
  { id: 1, level: "I", tag: "SCLI", message: "ADB Race winner: TCP:device" },
  { id: 2, level: "D", tag: "SCLI", message: "video socket connected" },
  { id: 3, level: "D", tag: "SCLI", message: "audio socket connected" },
  { id: 4, level: "D", tag: "SCLI", message: "control socket connected" },
  { id: 5, level: "D", tag: "SCLI", message: "video socket: Dummy byte verified (0x00)" },
  { id: 6, level: "I", tag: "SEVT", message: "Connection established" },
  { id: 7, level: "W", tag: "RDSP", message: "Surface unavailable" },
];

test("summarizes logs by level and tag", () => {
  const summary = summarizeLogs(logEntries);
  assert.equal(summary.total, 7);
  assert.deepEqual(summary.byLevel, { D: 4, I: 2, W: 1 });
  assert.deepEqual(summary.byTag, { RDSP: 1, SEVT: 1, SCLI: 5 });
  assert.equal(summary.recentIssues[0].id, 7);
});

test("extracts ordered connection milestones", () => {
  assert.deepEqual(
    buildConnectionTimeline(logEntries).map((event) => event.stage),
    ["adb", "video_socket", "audio_socket", "control_socket", "dummy_byte", "session"],
  );
});

test("detects incomplete sockets in an active session", () => {
  const analysis = analyzeRuntime({
    session: { available: true, active: true, configuration: { audioEnabled: true } },
    sockets: { connectedSockets: ["Video"], expectedSocketCount: 3, allRequiredSocketsConnected: false },
    metrics: { videoStreamReady: true, audioStreamReady: false },
    logs: logEntries,
  });
  assert.deepEqual(
    analysis.findings.map((finding) => finding.code),
    ["socket_set_incomplete", "audio_stream_not_ready"],
  );
});

test("calculates bit rates from cumulative byte counters", () => {
  assert.deepEqual(
    calculateMetricRates(
      { networkTxBytes: 1_000, networkRxBytes: 2_000 },
      { networkTxBytes: 2_000, networkRxBytes: 4_000 },
      1_000,
    ),
    { elapsedMs: 1_000, networkTxBitsPerSecond: 8_000, networkRxBitsPerSecond: 16_000 },
  );
});
