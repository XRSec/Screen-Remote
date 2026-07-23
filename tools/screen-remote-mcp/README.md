# Screen Remote MCP

MCP diagnostics and app commands for Screen Remote debug builds. The server runs locally over STDIO, reads structured runtime snapshots through ADB, and opens typed `screen-remote://` commands through Android Activity Manager. It never builds or installs an APK.

## Diagnostic tools

- `list_devices`
- `get_session_status`
- `get_socket_status`
- `get_codec_capabilities`
- `get_recent_logs`
- `get_runtime_metrics`
- `sample_runtime_metrics`
- `get_log_summary`
- `get_connection_timeline`
- `get_diagnostic_bundle`
- `get_url_catalog`

`sample_runtime_metrics` calculates TX/RX bit rates from two cumulative counter snapshots. `get_diagnostic_bundle` combines device, session, socket, metrics, log summary, timeline, and consistency findings in one result.

## App command tools

- `build_screen_remote_url`: build a URL without opening Android
- `open_screen_remote_url`: open any validated app-command URL
- `start_scrcpy`: start by case-sensitive session ID, case-sensitive name, or `host:port`, with custom parameters
- `open_session_manager`: open device, file, app, process, port-forward, utility, or command management
- `open_session_editor`: open new/edit; `host:port` prefills a new session
- `set_app_setting`: apply debug, log, theme, language, update-channel, and other settings
- `generate_adb_keys`: regenerate the app ADB key pair
- `disconnect_session`: disconnect the active scrcpy session

App command tools select the Android controller in the same way as diagnostic tools. They launch only the app URL; Android Studio remains responsible for build/install/run.

## Resources

- `screen-remote://runtime/devices`
- `screen-remote://runtime/session`
- `screen-remote://runtime/sockets`
- `screen-remote://runtime/metrics`
- `screen-remote://runtime/diagnostic-bundle`
- `screen-remote://links/catalog`

Runtime resources auto-select the controller only when exactly one host ADB device is online.

## Prompts

- `diagnose_connection`
- `diagnose_media`
- `diagnose_control`

The prompts define repeatable, read-only diagnostic workflows and explicitly distinguish current snapshots from historical log events.

The debug app exposes the diagnostics authority `com.screen.remote.android.debug.diagnostics`. Release builds do not register the provider.

## Setup

Requirements:

- Node.js 20 or newer
- `adb` on `PATH`
- The Screen Remote debug build installed and launched on an Android controller
- USB debugging or wireless ADB access from the development host to that controller

Install the server dependencies:

```bash
cd tools/screen-remote-mcp
npm install
```

Add it to Codex from the repository root:

```bash
codex mcp add screen-remote -- node "$PWD/tools/screen-remote-mcp/src/server.mjs"
```

Alternatively, add a project-scoped entry to `.codex/config.toml`:

```toml
[mcp_servers.screen-remote]
command = "node"
args = ["tools/screen-remote-mcp/src/server.mjs"]
cwd = "/absolute/path/to/Screen-Remote"
required = false
enabled_tools = [
  "list_devices",
  "get_session_status",
  "get_socket_status",
  "get_codec_capabilities",
  "get_recent_logs",
  "get_runtime_metrics",
  "sample_runtime_metrics",
  "get_log_summary",
  "get_connection_timeline",
  "get_diagnostic_bundle",
  "get_url_catalog",
  "build_screen_remote_url",
  "open_screen_remote_url",
  "start_scrcpy",
  "open_session_manager",
  "open_session_editor",
  "set_app_setting",
  "generate_adb_keys",
  "disconnect_session",
]
default_tools_approval_mode = "auto"
```

Restart Codex after changing MCP configuration. Use `/mcp` or `codex mcp list` to verify that the server is enabled.

When more than one Android controller is connected to host ADB, pass `controllerSerial` to each tool. Set `SCREEN_REMOTE_ADB_PATH` if `adb` is not on `PATH`; set `SCREEN_REMOTE_DIAGNOSTICS_AUTHORITY` only when using a custom debug application ID.

Live log results require debug mode to be enabled in Screen Remote. Runtime network values are cumulative byte counters, so callers can calculate rates from two snapshots without changing app state.

The MCP server never builds, installs, or launches the Android app. Android Studio remains responsible for the normal build/install/run lifecycle. When the debug package or diagnostics provider is unavailable, tools return a diagnostic error instead of attempting installation.

## Test

Run the complete MCP protocol suite:

```bash
npm test
```

The integration test invokes every tool, reads every resource, and renders every prompt over a real STDIO MCP connection. It uses an isolated fake ADB executable, so app-command tools are covered without installing an APK, opening Android UI, changing settings, generating real keys, or disconnecting a real session.

To smoke-test all read-only tools against an already installed debug app:

```bash
npm run test:live -- --controller <adb-serial>
```

The controller is explicit so the command remains deterministic when multiple ADB devices are online. Live resource reads still require exactly one online controller because MCP resource URIs do not carry tool arguments.

## App URLs

Screen Remote uses the same `screen-remote://` scheme for shareable app commands. The `open`, `session`, `setting`, `adb`, `diagnostics`, and `remote` hosts launch the Android app; the `runtime` and `links` hosts remain MCP resources.

Use `get_url_catalog` or read `screen-remote://links/catalog` to get:

- every settings destination;
- typed setting commands with current values, allowed values, and ready-to-open URLs;
- every management section and its supported query parameters;
- scrcpy, edit, and per-section management URLs for each saved session.

See the [URL Scheme Automation wiki page](https://github.com/XRSec/Screen-Remote/wiki/URL-Scheme-Automation-EN)
for the complete protocol.

## Execution invariants

- Diagnostic and URL-building tools carry read-only annotations; app-command tools are annotated according to their effects.
- The Android provider exists only in the debug source set and requires Android's privileged `DUMP` permission, which host ADB shell holds.
- The provider rejects insert, update, and delete operations.
- App commands use argument-array process spawning and do not invoke a host shell.
- The generic URL opener rejects MCP-only `runtime` and `links` resource URLs.
- scrcpy socket status reports the required `Video`, `Audio`, `Control` sequence. The MCP server does not expose low-level socket connection actions.
