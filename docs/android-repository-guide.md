# Android Repository Guide

This guide is for developers who need the smallest useful checkout for Android work.

## Repository model

The public `Screen-Remote` repository is an aggregate repository. The Android application source is
the nested `Screen-Remote/` Git submodule, not the root repository itself.

```text
Screen-Remote/                 aggregate/public repository
├── Screen-Remote/             Android source repository
├── Screen-Remote-macOS/       macOS source repository (not needed for Android-only work)
├── external/
│   ├── dadb/                  shared ADB transport and device-operation dependency
│   ├── wiki-android/          Android developer and user documentation
│   ├── wiki-macos/            macOS documentation
│   └── ...                    upstream/reference projects; normally read-only
├── docs/                      public documentation and cross-platform contracts
└── tools/, scripts/, Makefile aggregate-repository tooling
```

`Screen-Remote/app/` is the Android Gradle module. Its Gradle settings include `../external/dadb` as
a composite build, so `external/dadb` must exist beside the Android source checkout when building.

## Smallest checkout

If you have access to the private Android source repository:

```bash
git clone git@github.com:XRSec/Screen-Remote.git
cd Screen-Remote
git submodule update --init Screen-Remote external/dadb
```

The minimum layout is:

```text
Screen-Remote/
├── Screen-Remote/       # Android source
└── external/dadb/       # Gradle dependency
```

Do not clone all `external/` projects for ordinary Android development. They are references unless
the task explicitly concerns one of them.

For a complete aggregate checkout:

```bash
git clone --recurse-submodules git@github.com:XRSec/Screen-Remote.git
cd Screen-Remote
git submodule update --init --recursive
```

This also initializes macOS, both Wikis, and reference projects; it is unnecessary for a focused
Android change.

## Working boundaries

- Make Android code changes inside `Screen-Remote/`.
- Keep Android Wiki changes in `external/wiki-android/` when explicitly requested.
- Keep stable contracts shared by both platforms in root `docs/contracts/`.
- Treat `external/dadb/` as a separate repository; change it only for shared ADB behavior.
- An Android repository commit and a root gitlink update are separate commits.

Before editing:

```bash
git status --short --branch
git -C Screen-Remote status --short --branch
git -C external/dadb status --short --branch
```

Preserve existing changes. Do not reset, clean, or update unrelated submodules.

## Android code map

```text
Screen-Remote/app/src/main/java/com/screen/remote/android/
├── app/                 application entry and top-level assembly
├── core/                shared models, storage, design system, i18n, utilities
├── infrastructure/     ADB, scrcpy, sockets, media, codecs, runtime
├── feature/             sessions, remote control, devices, settings, Compose UI
└── service/             foreground service and Android lifecycle coordination
```

The main path is session configuration → remote feature → ADB → scrcpy server and ordered sockets
(`video`, optional `audio`, `control`) → media/control runtime → foreground service.

Read `Screen-Remote/AGENTS.md` and the Android engineering skill before implementation, review, or
verification work.
