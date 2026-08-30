# DADB helper protocol

The shared helper is owned by `external/dadb/dadb-helper/`. Android and macOS must consume the same wire format instead of maintaining separate long shell queries and parsers.

## Deployment and version gate

- Default remote path: `/data/local/tmp/dadb-helper.jar`.
- Invoke the helper with `CLASSPATH=<remote-path> exec app_process / <main-class> ...`.
- `dadb.helper.HelperVersionMain <expected-version>` prints exactly `DADB_HELPER_READY` on a match or `DADB_HELPER_VERSION_MISMATCH` otherwise.
- Deploy through the platform's helper runtime, verify the version, and replace a missing or mismatched JAR before invoking management commands.
- The version constant in dadb is the source of truth. Consumers must not carry an independent protocol version.

## Management snapshots

Main class: `dadb.helper.ManagementSnapshotMain`.

All records are UTF-8, tab-separated, and newline-delimited. Text fields use unwrapped Base64. `-` represents an absent optional value. A fatal helper error is:

```text
ERROR\t<base64 English diagnostic>
```

Supported commands and records:

```text
files <base64 remote path>
DADB_MANAGEMENT\tFILES
F\t<base64 name>\t<D|F|L|O>\t<size bytes>\t<mtime milliseconds>

processes
DADB_MANAGEMENT\tPROCESSES
P\t<pid>\t<rss bytes>\t<base64 process name>

device
DADB_MANAGEMENT\tDEVICE
D\t<wire name>\t<base64 value or ->\t<base64 English error or ->
```

The device response is field-tolerant: an unavailable vendor field preserves its English diagnostic, is omitted from the UI when empty, and must not fail the entire snapshot. Structural errors, unknown record kinds, invalid Base64, and invalid numeric fields fail parsing.

## Ownership

- dadb owns helper deployment semantics, stable records, parsing rules, and reusable remote collection.
- Platform applications own localized presentation, progress, cancellation, cache policy, and lifecycle.
- Helper output, protocol errors, and diagnostics are English only. Never transmit localized UI text in this protocol.
