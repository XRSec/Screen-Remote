import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const expectedTools = new Map([
  ["build_screen_remote_url", { action: "scrcpy", target: "Living room", parameters: { maxFps: 120 } }],
  ["open_screen_remote_url", { url: "screen-remote://open/sessions" }],
  ["start_scrcpy", { target: "Living room", parameters: { maxFps: 120 } }],
  ["open_session_manager", { target: "Living room", section: "file", path: "/sdcard/Download" }],
  [
    "open_session_editor",
    {
      name: "Living room",
      address: "192.168.1.20:5555",
      color: "blue",
      groupIds: ["home"],
      parameters: { maxFps: 120 },
    },
  ],
  ["set_app_setting", { setting: "debugmode", value: "on" }],
  ["generate_adb_keys", {}],
  ["disconnect_session", {}],
  ["list_devices", {}],
  ["get_session_status", {}],
  ["get_socket_status", {}],
  ["get_codec_capabilities", {}],
  ["get_recent_logs", { limit: 10 }],
  ["get_runtime_metrics", {}],
  ["sample_runtime_metrics", { intervalMs: 250 }],
  ["get_log_summary", { limit: 10 }],
  ["get_connection_timeline", { limit: 10 }],
  ["get_diagnostic_bundle", { logLimit: 10 }],
  ["get_url_catalog", {}],
]);

const expectedResources = [
  "screen-remote://links/catalog",
  "screen-remote://runtime/devices",
  "screen-remote://runtime/diagnostic-bundle",
  "screen-remote://runtime/metrics",
  "screen-remote://runtime/session",
  "screen-remote://runtime/sockets",
];

const expectedPrompts = ["diagnose_connection", "diagnose_control", "diagnose_media"];

test("invokes every MCP tool, resource, and prompt through STDIO", { timeout: 20_000 }, async (t) => {
  const serverPath = fileURLToPath(new URL("../src/server.mjs", import.meta.url));
  const fakeAdbPath = fileURLToPath(new URL("./fixtures/fake-adb.mjs", import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { ...process.env, SCREEN_REMOTE_ADB_PATH: fakeAdbPath },
    stderr: "pipe",
  });
  const client = new Client({ name: "screen-remote-all-interfaces-test", version: "0.5.0" });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      [...expectedTools.keys()].sort(),
    );
    for (const [name, args] of expectedTools) {
      await t.test(`tool: ${name}`, async () => {
        const result = await client.callTool({ name, arguments: args });
        assert.notEqual(result.isError, true);
        assert.ok(result.content.length > 0);
        assert.equal(result.content[0].type, "text");
        assert.doesNotThrow(() => JSON.parse(result.content[0].text));
      });
    }

    await t.test("tool branch: open_session_editor edits an existing session", async () => {
      const result = await client.callTool({
        name: "open_session_editor",
        arguments: { target: "Living room" },
      });
      assert.notEqual(result.isError, true);
      assert.match(result.content[0].text, /screen-remote:\/\/session\/edit\/Living%20room/u);
    });

    const resources = await client.listResources();
    assert.deepEqual(
      resources.resources.map((resource) => resource.uri).sort(),
      expectedResources,
    );
    for (const uri of expectedResources) {
      await t.test(`resource: ${uri}`, async () => {
        const result = await client.readResource({ uri });
        assert.equal(result.contents.length, 1);
        assert.equal(result.contents[0].mimeType, "application/json");
        assert.doesNotThrow(() => JSON.parse(result.contents[0].text));
      });
    }

    const prompts = await client.listPrompts();
    assert.deepEqual(
      prompts.prompts.map((prompt) => prompt.name).sort(),
      expectedPrompts,
    );
    for (const name of expectedPrompts) {
      await t.test(`prompt: ${name}`, async () => {
        const result = await client.getPrompt({
          name,
          arguments: { controllerSerial: "controller-1", focus: "integration test" },
        });
        assert.equal(result.messages.length, 1);
        assert.equal(result.messages[0].content.type, "text");
        assert.match(result.messages[0].content.text, /controllerSerial=controller-1/u);
        assert.match(result.messages[0].content.text, /integration test/u);
      });
    }
  } finally {
    await client.close();
  }
});
