import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("advertises diagnostics and app command tools", async () => {
  const serverPath = fileURLToPath(new URL("../src/server.mjs", import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    stderr: "pipe",
  });
  const client = new Client({ name: "screen-remote-mcp-test", version: "0.5.0" });

  try {
    await client.connect(transport);
    const response = await client.listTools();
    assert.deepEqual(
      response.tools.map((tool) => tool.name).sort(),
      [
        "build_screen_remote_url",
        "disconnect_session",
        "generate_adb_keys",
        "get_codec_capabilities",
        "get_connection_timeline",
        "get_diagnostic_bundle",
        "get_log_summary",
        "get_recent_logs",
        "get_runtime_metrics",
        "get_session_status",
        "get_socket_status",
        "get_url_catalog",
        "list_devices",
        "open_screen_remote_url",
        "open_session_editor",
        "open_session_manager",
        "sample_runtime_metrics",
        "set_app_setting",
        "start_scrcpy",
      ],
    );
    const readOnlyTools = new Set([
      "build_screen_remote_url",
      "get_codec_capabilities",
      "get_connection_timeline",
      "get_diagnostic_bundle",
      "get_log_summary",
      "get_recent_logs",
      "get_runtime_metrics",
      "get_session_status",
      "get_socket_status",
      "get_url_catalog",
      "list_devices",
      "sample_runtime_metrics",
    ]);
    for (const tool of response.tools) {
      assert.equal(tool.annotations?.readOnlyHint, readOnlyTools.has(tool.name));
    }
    assert.equal(response.tools.find((tool) => tool.name === "generate_adb_keys").annotations?.destructiveHint, true);

    const built = await client.callTool({
      name: "build_screen_remote_url",
      arguments: {
        action: "scrcpy",
        target: "Living room",
        parameters: { maxFps: 120, audio: true },
      },
    });
    assert.equal(
      built.content[0].text.includes("screen-remote://session/Living%20room/scrcpy"),
      true,
    );

    const resources = await client.listResources();
    assert.deepEqual(
      resources.resources.map((resource) => resource.uri).sort(),
      [
        "screen-remote://links/catalog",
        "screen-remote://runtime/devices",
        "screen-remote://runtime/diagnostic-bundle",
        "screen-remote://runtime/metrics",
        "screen-remote://runtime/session",
        "screen-remote://runtime/sockets",
      ],
    );

    const prompts = await client.listPrompts();
    assert.deepEqual(
      prompts.prompts.map((prompt) => prompt.name).sort(),
      ["diagnose_connection", "diagnose_control", "diagnose_media"],
    );
    const prompt = await client.getPrompt({
      name: "diagnose_connection",
      arguments: { controllerSerial: "serial-1", focus: "video is blank" },
    });
    assert.match(prompt.messages[0].content.text, /controllerSerial=serial-1/u);
    assert.match(prompt.messages[0].content.text, /video is blank/u);
  } finally {
    await client.close();
  }
});
