#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const controllerSerial = readOption("--controller");
if (!controllerSerial) {
  process.stderr.write("Usage: npm run test:live -- --controller <adb-serial>\n");
  process.exit(2);
}

const serverPath = fileURLToPath(new URL("../src/server.mjs", import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  stderr: "pipe",
});
const client = new Client({ name: "screen-remote-live-smoke", version: "0.5.0" });
const toolCases = [
  ["build_screen_remote_url", { action: "scrcpy", target: "Smoke test", parameters: { maxFps: 60 } }],
  ["list_devices", { controllerSerial }],
  ["get_session_status", { controllerSerial }],
  ["get_socket_status", { controllerSerial }],
  ["get_codec_capabilities", { controllerSerial }],
  ["get_recent_logs", { controllerSerial, limit: 10 }],
  ["get_runtime_metrics", { controllerSerial }],
  ["sample_runtime_metrics", { controllerSerial, intervalMs: 250 }],
  ["get_log_summary", { controllerSerial, limit: 10 }],
  ["get_connection_timeline", { controllerSerial, limit: 10 }],
  ["get_diagnostic_bundle", { controllerSerial, logLimit: 10 }],
  ["get_url_catalog", { controllerSerial }],
];

let failures = 0;
try {
  await client.connect(transport);
  for (const [name, args] of toolCases) {
    try {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) {
        throw new Error(result.content?.[0]?.text ?? "MCP tool returned an error");
      }
      process.stdout.write(`PASS tool ${name}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`FAIL tool ${name}: ${error.message}\n`);
    }
  }

  for (const prompt of ["diagnose_connection", "diagnose_control", "diagnose_media"]) {
    try {
      await client.getPrompt({
        name: prompt,
        arguments: { controllerSerial, focus: "live read-only smoke test" },
      });
      process.stdout.write(`PASS prompt ${prompt}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`FAIL prompt ${prompt}: ${error.message}\n`);
    }
  }
} finally {
  await client.close();
}

if (failures > 0) {
  process.stderr.write(`Live read-only smoke test failed: ${failures} interface(s)\n`);
  process.exit(1);
}
process.stdout.write(`Live read-only smoke test passed: ${toolCases.length} tools and 3 prompts\n`);

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
