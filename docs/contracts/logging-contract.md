# Logging contract

All application logs, debug logs, event logs, state summaries, protocol diagnostics, helper diagnostics, and exception details written to logs must be English only.

- Logging text is explicit English source text and never follows the selected UI locale.
- Android logs must not call `TextPair.get()` or another localized presentation resolver.
- macOS logs must not use localized String Catalog values.
- Remote helper and wire-protocol error details are English and are not shown directly as localized UI copy.
- User-visible titles, explanations, actions, accessibility labels, and recoverable error summaries remain localized through each platform's presentation system.
- Do not log credentials, ADB private keys, authentication tokens, clipboard content, user files, or other sensitive payloads.
- Avoid per-frame and per-packet logging. Emit bounded state transitions and aggregate counters for media diagnostics.

When a low-level English diagnostic reaches the UI, map it to a localized summary and retain the original detail only in diagnostics or logs.
