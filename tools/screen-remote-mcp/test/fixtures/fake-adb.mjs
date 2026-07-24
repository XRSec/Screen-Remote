#!/usr/bin/env node

const args = process.argv.slice(2);
const generatedAtEpochMs = 1_750_000_000_000;

if (args[0] === "devices" && args[1] === "-l") {
  process.stdout.write(
    [
      "List of devices attached",
      "controller-1 device product:test model:Test_Controller device:test transport_id:1",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const shellIndex = args.indexOf("shell");
if (shellIndex >= 0 && args[shellIndex + 1] === "content" && args[shellIndex + 2] === "call") {
  const methodIndex = args.indexOf("--method");
  const method = methodIndex >= 0 ? args[methodIndex + 1] : null;
  const payload = providerPayload(method);
  process.stdout.write(`Result: Bundle[{payload_base64=${encodePayload(payload)}}]\n`);
  process.exit(0);
}

if (shellIndex >= 0 && args[shellIndex + 1] === "am" && args[shellIndex + 2] === "start") {
  const dataIndex = args.indexOf("-d");
  const url = dataIndex >= 0 ? args[dataIndex + 1] : "";
  process.stdout.write(
    [
      `Starting: Intent { act=android.intent.action.VIEW dat=${url} }`,
      "Status: ok",
      "LaunchState: WARM",
      "Activity: com.screen.remote.android/.app.MainActivity",
      "TotalTime: 10",
      "WaitTime: 12",
      "Complete",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

process.stderr.write(`Unsupported fake ADB command: ${args.join(" ")}\n`);
process.exit(1);

function providerPayload(method) {
  switch (method) {
    case "devices":
      return {
        schemaVersion: 1,
        generatedAtEpochMs,
        devices: [
          {
            deviceId: "tcp:device:5555",
            name: "Test device",
            model: "Test",
            manufacturer: "Test",
            androidVersion: "15",
            serialNumber: "serial",
            connectionType: "TCP",
          },
        ],
      };
    case "session":
      return {
        schemaVersion: 1,
        generatedAtEpochMs,
        available: true,
        active: true,
        connectionState: "Connected",
        sessionId: "runtime-1",
        deviceId: "tcp:device:5555",
        sessionState: "Connected",
        configuration: {
          audioEnabled: true,
          maxSize: 1080,
          maxFps: 60,
          videoBitRate: 8_000_000,
          audioBitRate: 128_000,
          tunnelMode: "DIRECT_ADB",
          selectedVideoCodec: "h264",
          selectedAudioCodec: "raw",
        },
        components: {
          VideoSocket: "Running",
          AudioSocket: "Running",
          ControlSocket: "Running",
        },
      };
    case "sockets":
      return {
        schemaVersion: 1,
        generatedAtEpochMs,
        active: true,
        connectedSockets: ["Video", "Audio", "Control"],
        expectedSocketCount: 3,
        audioEnabled: true,
        allRequiredSocketsConnected: true,
        videoSocketConnected: true,
        audioSocketConnected: true,
        controlSocketConnected: true,
        requiredConnectionOrder: ["Video", "Audio", "Control"],
      };
    case "codecs":
      return {
        schemaVersion: 1,
        generatedAtEpochMs,
        videoDecoders: [{ codec: "h264", name: "fake.h264.decoder", hardwareAccelerated: true }],
        audioDecoders: [{ codec: "raw", name: "fake.raw.decoder", hardwareAccelerated: false }],
      };
    case "logs":
      return {
        schemaVersion: 1,
        generatedAtEpochMs,
        entries: [
          { id: 1, level: "I", tag: "SCLI", message: "ADB Race winner: TCP:device" },
          { id: 2, level: "D", tag: "SCLI", message: "video socket connected" },
          { id: 3, level: "D", tag: "SCLI", message: "audio socket connected" },
          { id: 4, level: "D", tag: "SCLI", message: "control socket connected" },
          { id: 5, level: "I", tag: "SEVT", message: "Connection established" },
        ],
      };
    case "metrics":
      return {
        schemaVersion: 1,
        generatedAtEpochMs,
        uid: 10_000,
        networkTxBytes: 1_000,
        networkRxBytes: 2_000,
        liveLogEntryCount: 5,
        connectedDeviceCount: 1,
        sessionActive: true,
        videoStreamReady: true,
        audioStreamReady: true,
      };
    case "links":
      return {
        schemaVersion: 1,
        catalogVersion: 2,
        generatedAtEpochMs,
        navigation: {
          sessions: "screen-remote://open/sessions",
          settings: "screen-remote://open/settings",
        },
        templates: {
          scrcpy: "screen-remote://session/{sessionId|name|host:port}/scrcpy",
          manage: "screen-remote://session/{sessionId|name|host:port}/manage",
          edit: "screen-remote://session/edit/{sessionId|name}",
        },
        settings: [{ name: "debugmode", currentValue: "off", allowedValues: ["on", "off"] }],
        management: [{ section: "file", queryParameters: ["path"] }],
        sessions: [],
      };
    default:
      process.stderr.write(`Unsupported diagnostics method: ${method ?? "<missing>"}\n`);
      process.exit(1);
  }
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}
