---
name: qmd
description: Search and retrieve Screen Remote Android and macOS Wiki documentation through the local QMD BM25 index, and audit bilingual Wiki pairing and navigation integrity. Use when users ask to find project documentation, inspect or compare either platform Wiki, locate a documented interface or procedure, answer from indexed local Markdown, maintain bilingual Wiki pages, or verify language counterparts and sidebar links.
---

# QMD - Query Markdown Documents

This installed skill is intentionally a small bootstrap so it does not go stale
when the qmd package updates.

Load the full, version-matched QMD instructions from the CLI:

!`qmd skill show`

If your agent does not support bang-command expansion, run:

```bash
qmd skill show
```

Then follow those instructions. In short: search first, fetch full sources with
`qmd get` or `qmd multi-get`, and answer from retrieved text rather than snippets.

## Screen Remote workflow

Before the first search in a turn, refresh only when the two Wiki trees changed:

```bash
node "$(git rev-parse --show-toplevel)/.codex/hooks/qmd-wiki-sync.mjs"
```

Use BM25 keyword search by default. Do not run `qmd query`, `qmd vsearch`, or
`qmd embed` unless the user explicitly requests semantic search; those modes can
download local models.

Search both platforms by omitting `-c`:

```bash
qmd search "scrcpy resolution" --format files --full-path
```

Restrict a platform only when the request is platform-specific:

```bash
qmd search "ADB authentication" -c screen-remote-android-wiki --format files --full-path
qmd search "SwiftUI session window" -c screen-remote-macos-wiki --format files --full-path
```

After identifying the strongest result, retrieve its full source with `qmd get`.
The configured collections are:

- `screen-remote-android-wiki` → `external/wiki-android/`
- `screen-remote-macos-wiki` → `external/wiki-macos/`

## Bilingual routing

- Treat a `-EN.md` suffix as an explicit English signal when it exists. Do not assume an unsuffixed ASCII filename is English; `URL-Scheme-Automation.md` is Chinese while `URL-Scheme-Automation-EN.md` is English.
- Treat reciprocal `[English](...)` and `[中文](...)` links near the top of a page as the complete bilingual-pair registry.
- Treat `_Sidebar.md` as curated primary navigation, not an exhaustive page registry. Validate every listed pair, but do not add every detail page merely to make the sidebar exhaustive.
- When both translations are search candidates, return or read the English page by default and collapse the Chinese counterpart into it. Do not count translations as independent corroboration.
- The first-prompt session lookup returns paths only. Read a selected source later when the task actually needs its facts.

After changing either Wiki's pages, language links, filenames, or sidebar, run the deterministic audit:

```bash
node .agents/skills/qmd/scripts/audit-bilingual-wiki.mjs
```

Use `--verbose` only when the compact summary reports errors or when reviewing which valid pairs are intentionally absent from primary navigation. Fix every reported error before declaring Wiki maintenance complete. An `unlisted` count is informational, not a failure.
