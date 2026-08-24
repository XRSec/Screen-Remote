# macOS Repository Guide

This guide is for developers who need the smallest useful checkout for macOS work.

## Repository model

The public `Screen-Remote` repository is an aggregate repository. The native macOS application is
the independent `Screen-Remote-macOS/` Git submodule.

```text
Screen-Remote/                 aggregate/public repository
├── Screen-Remote/             Android source (ADB/session behavior reference)
├── Screen-Remote-macOS/       native SwiftUI/macOS source
├── external/
│   ├── dadb/                  shared ADB transport and helper foundation
│   ├── wiki-macos/            macOS documentation
│   ├── wiki-android/          Android documentation
│   └── ...                    upstream/reference projects; normally read-only
├── docs/                      public documentation and cross-platform contracts
└── tools/, scripts/, Makefile aggregate-repository tooling
```

The macOS app uses `external/dadb` for shared ADB semantics and keeps native lifecycle, windows,
SwiftUI, persistence, media rendering, and scrcpy orchestration in `Screen-Remote-macOS/`.

## Smallest checkout

For macOS-only work:

```bash
git clone git@github.com:XRSec/Screen-Remote.git
cd Screen-Remote
git submodule update --init Screen-Remote-macOS external/dadb
```

The minimum layout is:

```text
Screen-Remote/
├── Screen-Remote-macOS/ # native macOS source
└── external/dadb/       # shared ADB foundation
```

The Android source is not required for most native UI work. It is needed when changing or verifying
ADB/session semantics against the Android implementation.

For a complete aggregate checkout:

```bash
git clone --recurse-submodules git@github.com:XRSec/Screen-Remote.git
cd Screen-Remote
git submodule update --init --recursive
```

## Working boundaries

- Make macOS code changes inside `Screen-Remote-macOS/`.
- Keep macOS Wiki changes in `external/wiki-macos/` when explicitly requested.
- Use `Screen-Remote/` as the Android reference for ADB/session meaning; do not modify it for a
  macOS-only task.
- Put genuinely shared ADB transport, helper, and device operations in `external/dadb/`.
- Keep stable cross-platform contracts in root `docs/contracts/`.
- The macOS repository commit and root gitlink update are separate commits.

Before editing:

```bash
git status --short --branch
git -C Screen-Remote-macOS status --short --branch
git -C external/dadb status --short --branch
```

Preserve existing changes. Do not reset, clean, or update unrelated submodules.

## macOS code map

```text
Screen-Remote-macOS/Screen-Remote/
├── App/                   app entry, root navigation, sidebar
├── Core/                  models, process support, state, design system
├── Features/              devices, screens, apps, management, settings, tooling
├── Platform/              macOS compatibility and platform behavior
├── Resources/             assets and String Catalog localization
└── Services/              ADB, persistence, Android tooling, scrcpy sessions/media
```

The native screen path is device discovery/ADB → scrcpy server → ordered `video`, optional `audio`,
and `control` sockets → H.264/VideoToolbox rendering and session state.

Read `Screen-Remote-macOS/AGENTS.md` and the macOS engineering skill before implementation, review,
or verification work.
