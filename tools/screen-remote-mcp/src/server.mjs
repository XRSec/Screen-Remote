#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AdbDiagnosticsClient } from "./adb-client.mjs";
import {
  analyzeRuntime,
  buildConnectionTimeline,
  calculateMetricRates,
  summarizeLogs,
} from "./diagnostics-analysis.mjs";
import {
  buildEditSessionUrl,
  buildManageUrl,
  buildNewSessionUrl,
  buildScrcpyUrl,
  buildScreenRemoteUrl,
  buildSettingUrl,
  validateAppUrl,
} from "./url-actions.mjs";

const server = new McpServer(
  {
    name: "screen-remote",
    version: "0.5.0",
  },
  {
    instructions:
      "Diagnostics and screen-remote:// app commands for Screen Remote debug builds. App command tools launch Android deep links through host ADB and never build or install an APK. " +
      "scrcpy sockets must be established sequentially in Video, Audio, Control order; do not recommend parallel socket connection attempts.",
  },
);
const diagnostics = new AdbDiagnosticsClient();
const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const appActionAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};
const idempotentAppActionAnnotations = {
  ...appActionAnnotations,
  idempotentHint: true,
};
const destructiveAppActionAnnotations = {
  ...appActionAnnotations,
  destructiveHint: true,
};
const controllerSchema = {
  controllerSerial: z
    .string()
    .min(1)
    .optional()
    .describe("ADB serial of the Android device running Screen Remote; optional when exactly one device is online"),
};
const urlParameterValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const urlParametersSchema = z.record(z.string().min(1), urlParameterValueSchema);
const manageSectionSchema = z.enum(["device", "utility", "file", "app", "process", "port-forward", "command"]);

server.registerTool(
  "build_screen_remote_url",
  {
    title: "Build a Screen Remote app URL",
    description:
      "Build a validated screen-remote:// URL without opening Android. Targets may be a case-sensitive session ID, case-sensitive session name, or host:port.",
    inputSchema: {
      action: z.enum([
        "sessions",
        "settings",
        "new_session",
        "edit_session",
        "scrcpy",
        "manage",
        "setting",
        "generate_adb_keys",
        "diagnostic_logs",
        "disconnect",
      ]),
      target: z.string().min(1).optional(),
      parameters: urlParametersSchema.optional(),
      section: manageSectionSchema.optional(),
      path: z.string().min(1).optional(),
      command: z.string().min(1).optional(),
      setting: z.string().min(1).optional(),
      value: z.string().min(1).optional(),
    },
    annotations: readOnlyAnnotations,
  },
  async (input) => toolResult({ url: buildScreenRemoteUrl(input) }),
);

server.registerTool(
  "open_screen_remote_url",
  {
    title: "Open a Screen Remote app URL",
    description:
      "Open an existing screen-remote:// app command on the selected Android controller through ADB. runtime and links MCP resource URLs are rejected.",
    inputSchema: {
      ...controllerSchema,
      url: z.string().min(1),
    },
    annotations: destructiveAppActionAnnotations,
  },
  async ({ controllerSerial, url }) => toolResult(await diagnostics.openUrl(validateAppUrl(url), controllerSerial)),
);

server.registerTool(
  "start_scrcpy",
  {
    title: "Start a Screen Remote scrcpy session",
    description:
      "Start scrcpy for a case-sensitive session ID, case-sensitive session name, or host:port. Parameters are forwarded as one-time URL overrides.",
    inputSchema: {
      ...controllerSchema,
      target: z.string().min(1),
      parameters: urlParametersSchema.optional(),
    },
    annotations: appActionAnnotations,
  },
  async ({ controllerSerial, target, parameters }) =>
    toolResult(await diagnostics.openUrl(buildScrcpyUrl(target, parameters), controllerSerial)),
);

server.registerTool(
  "open_session_manager",
  {
    title: "Open Screen Remote session management",
    description:
      "Open a management section for a case-sensitive session ID, case-sensitive session name, or host:port. File paths and command prefill are supported.",
    inputSchema: {
      ...controllerSchema,
      target: z.string().min(1),
      section: manageSectionSchema.default("device"),
      path: z.string().min(1).optional(),
      command: z.string().min(1).optional(),
    },
    annotations: appActionAnnotations,
  },
  async ({ controllerSerial, target, section, path, command }) => {
    const url = buildManageUrl(target, { section, path, command });
    return toolResult(await diagnostics.openUrl(url, controllerSerial));
  },
);

server.registerTool(
  "open_session_editor",
  {
    title: "Open the Screen Remote session editor",
    description:
      "Open a saved session by ID or exact name when target is set. Otherwise open a new-session editor with optional name, address, groups, profile, and scrcpy prefill.",
    inputSchema: {
      ...controllerSchema,
      target: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      color: z.enum(["blue", "red", "green", "orange", "purple"]).optional(),
      profileId: z.string().min(1).optional(),
      useProfileDefaults: z.boolean().optional(),
      backupAddresses: z.array(z.string().min(1)).optional(),
      groupIds: z.array(z.string().min(1)).optional(),
      parameters: urlParametersSchema.optional(),
    },
    annotations: idempotentAppActionAnnotations,
  },
  async ({
    controllerSerial,
    target,
    name,
    address,
    color,
    profileId,
    useProfileDefaults,
    backupAddresses,
    groupIds,
    parameters,
  }) => {
    const hasPrefill =
      name !== undefined ||
      address !== undefined ||
      color !== undefined ||
      profileId !== undefined ||
      useProfileDefaults !== undefined ||
      backupAddresses !== undefined ||
      groupIds !== undefined ||
      parameters !== undefined;
    if (target && hasPrefill) {
      throw new Error("New-session prefill parameters cannot be combined with an edit target");
    }
    const url = target
      ? buildEditSessionUrl(target)
      : buildNewSessionUrl({
          name,
          address,
          color,
          profileId,
          useProfileDefaults,
          backupAddresses,
          groupIds,
          parameters,
        });
    return toolResult(await diagnostics.openUrl(url, controllerSerial));
  },
);

server.registerTool(
  "set_app_setting",
  {
    title: "Set a Screen Remote app setting",
    description:
      "Apply a typed Screen Remote setting such as debugmode, theme, language, updatechannel, or a log toggle.",
    inputSchema: {
      ...controllerSchema,
      setting: z.string().min(1),
      value: z.string().min(1),
    },
    annotations: idempotentAppActionAnnotations,
  },
  async ({ controllerSerial, setting, value }) =>
    toolResult(await diagnostics.openUrl(buildSettingUrl(setting, value), controllerSerial)),
);

server.registerTool(
  "generate_adb_keys",
  {
    title: "Generate Screen Remote ADB keys",
    description: "Ask Screen Remote to regenerate its application ADB key pair through the app URL command.",
    inputSchema: controllerSchema,
    annotations: destructiveAppActionAnnotations,
  },
  async ({ controllerSerial }) =>
    toolResult(
      await diagnostics.openUrl(buildScreenRemoteUrl({ action: "generate_adb_keys" }), controllerSerial),
    ),
);

server.registerTool(
  "disconnect_session",
  {
    title: "Disconnect the active Screen Remote session",
    description: "Ask Screen Remote to disconnect the active scrcpy session.",
    inputSchema: controllerSchema,
    annotations: idempotentAppActionAnnotations,
  },
  async ({ controllerSerial }) =>
    toolResult(await diagnostics.openUrl(buildScreenRemoteUrl({ action: "disconnect" }), controllerSerial)),
);

server.registerTool(
  "list_devices",
  {
    title: "List Screen Remote devices",
    description:
      "List Android controllers visible to host ADB and, when a controller can be selected, devices connected inside Screen Remote.",
    inputSchema: controllerSchema,
    annotations: readOnlyAnnotations,
  },
  async ({ controllerSerial }) => {
    const controllers = await diagnostics.listControllers();
    let connectedDevices = null;
    let runtimeNotice = null;
    try {
      connectedDevices = (await diagnostics.call("devices", controllerSerial)).payload.devices;
    } catch (error) {
      runtimeNotice = error.message;
    }
    return toolResult({ controllers, connectedDevices, runtimeNotice });
  },
);

registerProviderTool({
  name: "get_session_status",
  title: "Get session status",
  description: "Get the active scrcpy session, connection state, configuration, resolution, and component states.",
  method: "session",
});

registerProviderTool({
  name: "get_socket_status",
  title: "Get socket status",
  description:
    "Get video, audio, and control socket readiness plus the required sequential connection order.",
  method: "sockets",
});

registerProviderTool({
  name: "get_codec_capabilities",
  title: "Get codec capabilities",
  description: "Get local video and audio decoder capabilities on the Android controller.",
  method: "codecs",
});

server.registerTool(
  "get_recent_logs",
  {
    title: "Get recent application logs",
    description:
      "Get recent in-memory Screen Remote logs. Live logs are available when debug mode is enabled in the app.",
    inputSchema: {
      ...controllerSchema,
      limit: z.number().int().min(1).max(500).default(100),
      levels: z.array(z.enum(["V", "D", "I", "W", "E"])).optional(),
      tags: z.array(z.string().min(1)).optional(),
    },
    annotations: readOnlyAnnotations,
  },
  async ({ controllerSerial, limit, levels, tags }) => {
    const { controller, payload } = await diagnostics.call("logs", controllerSerial);
    const levelSet = levels ? new Set(levels) : null;
    const tagSet = tags ? new Set(tags) : null;
    const entries = payload.entries
      .filter((entry) => !levelSet || levelSet.has(entry.level))
      .filter((entry) => !tagSet || tagSet.has(entry.tag))
      .slice(-limit);
    return toolResult({ controller, ...payload, entries });
  },
);

registerProviderTool({
  name: "get_runtime_metrics",
  title: "Get runtime metrics",
  description:
    "Get cumulative app network counters and current session, stream, log, and connected-device readiness metrics.",
  method: "metrics",
});

registerProviderTool({
  name: "get_url_catalog",
  title: "Get Screen Remote URL catalog",
  description:
    "Get shareable screen-remote:// navigation URLs, typed setting commands with current values, management sections, and scrcpy/manage/edit URLs for every saved session.",
  method: "links",
});

server.registerTool(
  "sample_runtime_metrics",
  {
    title: "Sample runtime rates",
    description:
      "Take two read-only runtime snapshots and calculate app network TX/RX bit rates over a short interval.",
    inputSchema: {
      ...controllerSchema,
      intervalMs: z.number().int().min(250).max(5_000).default(1_000),
    },
    annotations: readOnlyAnnotations,
  },
  async ({ controllerSerial, intervalMs }) => {
    const controller = await diagnostics.resolveController(controllerSerial);
    const before = (await diagnostics.callForController("metrics", controller)).payload;
    const startedAt = performance.now();
    await delay(intervalMs);
    const after = (await diagnostics.callForController("metrics", controller)).payload;
    const elapsedMs = performance.now() - startedAt;
    return toolResult({
      controller,
      before,
      after,
      rates: calculateMetricRates(before, after, elapsedMs),
    });
  },
);

server.registerTool(
  "get_log_summary",
  {
    title: "Summarize application logs",
    description: "Count recent logs by level and tag and return the latest warnings and errors.",
    inputSchema: {
      ...controllerSchema,
      limit: z.number().int().min(1).max(1_000).default(300),
    },
    annotations: readOnlyAnnotations,
  },
  async ({ controllerSerial, limit }) => {
    const { controller, payload } = await diagnostics.call("logs", controllerSerial);
    const entries = payload.entries.slice(-limit);
    return toolResult({ controller, generatedAtEpochMs: payload.generatedAtEpochMs, ...summarizeLogs(entries) });
  },
);

server.registerTool(
  "get_connection_timeline",
  {
    title: "Get scrcpy connection timeline",
    description:
      "Extract ordered ADB, socket, dummy-byte, session, decoder, media-output, and heartbeat milestones from recent logs.",
    inputSchema: {
      ...controllerSchema,
      limit: z.number().int().min(1).max(1_000).default(500),
    },
    annotations: readOnlyAnnotations,
  },
  async ({ controllerSerial, limit }) => {
    const { controller, payload } = await diagnostics.call("logs", controllerSerial);
    const entries = payload.entries.slice(-limit);
    return toolResult({
      controller,
      generatedAtEpochMs: payload.generatedAtEpochMs,
      timeline: buildConnectionTimeline(entries),
    });
  },
);

server.registerTool(
  "get_diagnostic_bundle",
  {
    title: "Get diagnostic bundle",
    description:
      "Collect connected devices, session, sockets, runtime metrics, logs, a connection timeline, and readiness findings in one read-only result.",
    inputSchema: {
      ...controllerSchema,
      logLimit: z.number().int().min(1).max(1_000).default(500),
    },
    annotations: readOnlyAnnotations,
  },
  async ({ controllerSerial, logLimit }) => toolResult(await collectDiagnosticBundle(controllerSerial, logLimit)),
);

registerRuntimeResource("runtime-devices", "screen-remote://runtime/devices", "Connected devices snapshot", "devices");
registerRuntimeResource("runtime-session", "screen-remote://runtime/session", "Current scrcpy session snapshot", "session");
registerRuntimeResource("runtime-sockets", "screen-remote://runtime/sockets", "Current scrcpy socket snapshot", "sockets");
registerRuntimeResource("runtime-metrics", "screen-remote://runtime/metrics", "Current runtime metrics snapshot", "metrics");
registerRuntimeResource("url-catalog", "screen-remote://links/catalog", "Screen Remote URL catalog", "links");

server.registerResource(
  "runtime-diagnostic-bundle",
  "screen-remote://runtime/diagnostic-bundle",
  {
    title: "Screen Remote diagnostic bundle",
    description: "Aggregated read-only runtime diagnostics using the single online Android controller.",
    mimeType: "application/json",
  },
  async (uri) => jsonResource(uri.href, await collectDiagnosticBundle(undefined, 500)),
);

registerDiagnosticPrompt(
  "diagnose_connection",
  "Diagnose a Screen Remote connection",
  "Use get_diagnostic_bundle first. Verify ADB selection, then Video/Audio/Control socket order, dummy-byte confirmation, session state, and decoder readiness. Correlate findings with get_connection_timeline. Do not perform mutations or install an APK.",
);
registerDiagnosticPrompt(
  "diagnose_media",
  "Diagnose Screen Remote audio or video",
  "Use get_session_status, get_socket_status, get_codec_capabilities, sample_runtime_metrics, and filtered recent logs. Confirm transport readiness before blaming decoders. Separate negotiation, decoder initialization, and rendered/output media stages. Do not perform mutations.",
);
registerDiagnosticPrompt(
  "diagnose_control",
  "Diagnose Screen Remote input control",
  "Use get_socket_status, get_connection_timeline, and recent SCLI/SDL/control logs. Confirm the Control socket was established after Video and Audio and check control keepalive activity. Do not send input or perform mutations.",
);

function registerProviderTool({ name, title, description, method }) {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema: controllerSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ controllerSerial }) => {
      const { controller, payload } = await diagnostics.call(method, controllerSerial);
      return toolResult({ controller, ...payload });
    },
  );
}

function registerRuntimeResource(name, uri, description, method) {
  server.registerResource(
    name,
    uri,
    {
      title: description,
      description: `${description} using the single online Android controller.`,
      mimeType: "application/json",
    },
    async (resourceUri) => {
      const { controller, payload } = await diagnostics.call(method);
      return jsonResource(resourceUri.href, { controller, ...payload });
    },
  );
}

function registerDiagnosticPrompt(name, title, instructions) {
  server.registerPrompt(
    name,
    {
      title,
      description: instructions,
      argsSchema: {
        controllerSerial: z.string().min(1).optional().describe("Optional host ADB controller serial"),
        focus: z.string().min(1).optional().describe("Optional symptom or area to prioritize"),
      },
    },
    async ({ controllerSerial, focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              instructions,
              controllerSerial ? `Use controllerSerial=${controllerSerial}.` : "Auto-select the controller only if exactly one is online.",
              focus ? `Focus on this symptom: ${focus}` : null,
              "Base conclusions on current tool results and clearly distinguish current state from historical log events.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        },
      ],
    }),
  );
}

async function collectDiagnosticBundle(controllerSerial, logLimit) {
  const controller = await diagnostics.resolveController(controllerSerial);
  const devices = (await diagnostics.callForController("devices", controller)).payload;
  const session = (await diagnostics.callForController("session", controller)).payload;
  const sockets = (await diagnostics.callForController("sockets", controller)).payload;
  const metrics = (await diagnostics.callForController("metrics", controller)).payload;
  const logsPayload = (await diagnostics.callForController("logs", controller)).payload;
  const logs = logsPayload.entries.slice(-logLimit);
  const analysis = analyzeRuntime({ session, sockets, metrics, logs });
  return {
    controller,
    collectedAtEpochMs: Date.now(),
    devices,
    session,
    sockets,
    metrics,
    logSummary: summarizeLogs(logs),
    connectionTimeline: analysis.timeline,
    findings: analysis.findings,
  };
}

function jsonResource(uri, value) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toolResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

await server.connect(new StdioServerTransport());
