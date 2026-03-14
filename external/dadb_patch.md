# dadb USB Handoff

Last updated: 2026-03-22

This file is the continuation entry for the `external/dadb` work. It records the current patch shape, the design decisions that should be preserved, and the commands to replay the work later.

## Current state

- Workspace root: `/Users/xr/IDEA.localized/scrcpy-mobile`
- dadb repo: `/Users/xr/IDEA.localized/scrcpy-mobile/external/dadb`
- Current `dadb` HEAD: `ba987b2`
- Patch review baseline: `upstream/master` at `1566896`
- Current `external/dadb` worktree: dirty
- Replay patch file: `external/dadb_usb.patch`

## What this patch is trying to do

This patch adds Android USB host support to `dadb` without turning the core library into an Android-only library.

The intended shape is:

- `:dadb`
  - remains the core JVM ADB protocol library
  - supports direct TCP, the host-side `adb` binary backend with its managed `adb server`, and
    transport-backed connections
- `:dadb-android`
  - is an Android-only transport module
  - provides direct USB host access on Android
  - now also provides Android runtime storage for ADB identity and Wireless Debugging peer state
  - does not absorb app-specific permission, scanning, retry, or UI behavior

## Design decisions to preserve

These are the important conclusions. If work resumes later, treat these as the current direction unless requirements change.

- Keep the core abstraction generic. USB is a transport backend, not the center of the API.
- Keep Android-specific code out of `:dadb` and inside `:dadb-android`.
- Keep host-side `adb` binary support. When that binary exists, the `adb server` it manages remains a normal
  supported backend.
  Here "keep" means it remains an official supported backend, not a temporary compatibility escape hatch.
- Keep `Custom Transport` documented in the README. It is a real extension point and not just a temporary adapter for USB.
- Do not move USB permission handling, device discovery, selection UI, or app retry policy into `dadb`.
- Treat Android direct USB as the primary no-binary path for Android-host scenarios, not as a universal cross-platform transport.

## Terminology to keep precise

Use these terms consistently in docs and API discussions:

- `adb`
  - the protocol / ecosystem umbrella term
- `adb binary`
  - the host-side executable
- `adb server`
  - the background server managed by the host-side `adb` binary
- `adbd`
  - only when the device-side daemon is genuinely relevant

Avoid inventing public abbreviations such as `adbc` or `adbs`.
Prefer explicit names like `adbBinary`, `adbServer`, `adb_server`, and `adb_binary`.

## What changed

### 1. Core transport abstraction in `:dadb`

Files:

- `dadb/src/main/kotlin/dadb/AdbTransport.kt`
- `dadb/src/main/kotlin/dadb/AdbConnection.kt`
- `dadb/src/main/kotlin/dadb/AdbWriter.kt`
- `dadb/src/main/kotlin/dadb/Dadb.kt`
- `dadb/src/main/kotlin/dadb/DadbImpl.kt`

Key points:

- Added `AdbTransport`
- Added `AdbTransportFactory`
- Added `SourceSinkAdbTransport`
- Added `Dadb.create(transportFactory, keyPair)`
- Added `Dadb.create(description, keyPair) { ... }`
- Let transports provide `connectMaxData`
- Kept TCP and host-side `adb` binary paths intact, including the `adb server` backend they manage

Intent:

- preserve the existing library shape
- make transport injection a first-class core capability
- avoid baking Android USB assumptions into the base module

### 2. Android USB module in `:dadb-android`

Files:

- `dadb-android/build.gradle.kts`
- `dadb-android/gradle.properties`
- `dadb-android/src/main/AndroidManifest.xml`
- `dadb-android/src/main/kotlin/dadb/android/usb/UsbConstants.kt`
- `dadb-android/src/main/kotlin/dadb/android/usb/AdbPacketCodec.kt`
- `dadb-android/src/main/kotlin/dadb/android/usb/UsbChannel.kt`
- `dadb-android/src/main/kotlin/dadb/android/usb/UsbTransportFactory.kt`
- `dadb-android/src/test/kotlin/dadb/android/usb/AdbPacketCodecTest.kt`

Key points:

- Direct Android USB host transport
- Uses Android USB host APIs such as `UsbManager`, `UsbDevice`, and `bulkTransfer`
- Does not require a host-side `adb` binary
- Intended for Android-host scenarios such as Android controlling Android over USB
- Not a desktop JVM transport for Windows, macOS, or Linux

### 3. Android runtime storage and Wireless Debugging state in `:dadb-android`

Files:

- `dadb-android/src/main/kotlin/dadb/android/storage/AdbRuntimeFiles.kt`
- `dadb-android/src/main/kotlin/dadb/android/storage/AdbIdentityStore.kt`
- `dadb-android/src/main/kotlin/dadb/android/storage/AdbPeerStore.kt`
- `dadb-android/src/main/kotlin/dadb/android/runtime/AdbRuntime.kt`
- `dadb-android/src/main/kotlin/dadb/android/runtime/AdbRuntimeOptions.kt`
- `dadb-android/src/main/kotlin/dadb/android/tls/AdbTlsCertificatePins.kt`
- `dadb-android/src/main/kotlin/dadb/android/tls/AdbTlsTrustManagers.kt`
- `dadb-android/src/main/kotlin/dadb/android/tls/PeerAwareTlsAdbTransportFactory.kt`
- `dadb-android/src/main/kotlin/dadb/android/wireless/WirelessDebugPairing.kt`
- `dadb-android/src/main/kotlin/dadb/android/wireless/AdbPairingTypes.kt`
- `dadb-android/src/main/kotlin/dadb/android/wireless/DirectAdbPairingClient.kt`
- `dadb-android/src/main/cpp/CMakeLists.txt`
- `dadb-android/src/main/cpp/pairing/adb_pairing.cpp`

Key points:

- `dadb-android` now owns a single runtime root directory such as `filesDir/adb_keys`
- that directory stores:
  - `adbkey`
  - `adbkey.pub`
  - `peers.json`
- `AdbRuntime` is the Android-facing entry point for:
  - load or create local ADB identity
  - regenerate or replace the local ADB identity
  - perform Wireless Debugging pairing
  - persist pairing-derived peer metadata
  - create network `Dadb` instances through one STLS-capable auto transport
  - inspect, list, and prune stored peer / endpoint state
  - export and restore runtime storage snapshots
- `AdbPeerStore` now separates:
  - endpoint hints
  - peer identity records
- TLS trust is no longer only a global unsafe mode
  - first successful TLS connect is TOFU for the connect-port certificate
  - later connects pin the observed connect certificate public key from `peers.json`
  - a new endpoint can be rebound to an existing peer record when its connect pin matches
  - runtime diagnostics can now resolve a single endpoint or peer directly without the app scanning raw lists
  - `AdbRuntime.createNetworkDadb(...)` now forces one real handshake before returning so `transportMode`
    and known-TLS fallback checks are based on an actual connection result instead of lazy `Dadb` state
  - transport tests now cover:
    - plain ADB over auto transport stays plain TCP
    - known TLS peer without `A_STLS` fails
    - first TLS connect learns the connect pin and a later pin mismatch is rejected
- pairing native code and SPAKE2 client have now moved into `dadb-android`
- app no longer builds or owns the `adbpairing` native library
- app-side key / backup flows are being reduced toward runtime snapshot APIs instead of direct file access
- `AdbRuntimeOptions` now exposes a trust-policy extension point:
  - `Auto`
  - `Unsafe`
  - `PinnedOnly`
  - `Custom`

Current platform boundary conclusion:

- STLS/TLS-capable ADB connect is not Android-only in protocol terms
- Android USB host transport is Android-only because the backend uses Android USB APIs
- current `adb pair` support is Android-facing and currently lives in `dadb-android`
- host-side `adb` binary remains a standard supported backend, and the `adb server` it manages continues
  to coexist with direct TCP / direct TLS / Android USB

### 4. README positioning

Files:

- `README.md`

The README now states:

- `dadb` core is JVM and transport-neutral
- Android USB is available through `dadb-android`
- Android runtime storage can keep `adbkey`, `adbkey.pub`, and `peers.json` together
- Wireless Debugging TLS can be driven through `AdbRuntime`
- Wireless Debugging pairing can also be driven through `AdbRuntime`
- trust policy is configurable without forcing the app to own TLS branching
- host-side `adb` binary remains a valid optional path, with its `adb server` backend preserved
- `Custom Transport` remains part of the public story

## Current file delta against upstream

The current diff against `upstream/master` touches these upstream files and adds the Android module:

- `.gitignore`
- `README.md`
- `build.gradle.kts`
- `dadb/build.gradle.kts`
- `dadb/src/main/kotlin/dadb/AdbConnection.kt`
- `dadb/src/main/kotlin/dadb/AdbTransport.kt`
- `dadb/src/main/kotlin/dadb/AdbWriter.kt`
- `dadb/src/main/kotlin/dadb/Dadb.kt`
- `dadb/src/main/kotlin/dadb/DadbImpl.kt`
- `dadb/src/test/kotlin/dadb/AdbConnectionTransportTest.kt`
- `dadb/src/test/kotlin/dadb/DadbImplTest.kt`
- `gradle/wrapper/gradle-wrapper.properties`
- `settings.gradle.kts`
- `dadb-android/...`

Diff size snapshot:

- 21 files changed
- 1010 insertions
- 89 deletions

## App integration state

The app side currently consumes the Android USB module through:

- `scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/infrastructure/adb/connection/AdbConnectionConnector.kt`

It uses:

- `dadb.android.usb.UsbTransportFactory`
- `dadb.android.runtime.AdbRuntime`

The app still owns:

- USB permission requests
- USB device scanning and selection
- retry and verification policy
- diagnostics and debug receivers
- pairing UI and pairing-code collection

The app no longer owns:

- Wireless Debugging native pairing implementation
- `adbpairing` native library build
- TLS trust-manager construction
- peer-store persistence details

The app is also moving away from direct `adbkey` / `adbkey.pub` / `peers.json` file access.
The intended steady state is:

- app asks `AdbRuntime` for identity text or runtime snapshots
- app asks `AdbRuntime` to replace or regenerate identity
- app no longer hardcodes runtime filenames outside of presentation / migration edges

If runtime debugging needs to continue on the app side, also read:

- `docs/05-handoff/usb-and-wireless.md`

That document is app/runtime focused. This file is only for the `external/dadb` patch itself.

## Naming and style decisions already made

These names were chosen to stay close to upstream `dadb` style:

- `AdbTransport`
- `AdbTransportFactory`
- `SourceSinkAdbTransport`
- `UsbTransportFactory`
- `UsbChannel`
- `AdbPacketCodec`
- `AdbRuntime`
- `AdbRuntimeOptions`
- `AdbIdentityStore`
- `AdbPeerStore`
- `PeerAwareTlsAdbTransportFactory`
- `WirelessDebugPairingClient`
- `AdbTlsTrustPolicy`

Other style choices already made:

- keep comments sparse and factual
- avoid app-specific terminology inside `dadb`
- do not introduce Android-specific names into core APIs unless they are required
- keep `peers.json` terminology explicit
  - `endpointHints` are routing hints
  - `peers` are identity records
  - do not conflate a host/IP hint with a trusted peer identity
  - endpoint strings are entrypoints, not durable identity

## Authorship notes

Independent new source files may include an attribution line:

- `github.com/XRSec/`

This was applied only to standalone new source files and tests. Existing upstream files were not given arbitrary authorship edits.

## Build and verification

### Important local setup

`external/dadb/local.properties` is ignored by git.

For local Android builds, create a local file if needed:

```properties
sdk.dir=/Users/xr/Library/Android/sdk
```

or provide Android SDK environment variables before invoking Gradle.

### Verified commands

From `external/dadb`:

```bash
./gradlew --no-daemon -Pkotlin.incremental=false :dadb:test --tests dadb.AdbConnectionTransportTest :dadb-android:compileDebugKotlin :dadb-android:testDebugUnitTest
```

From `scrcpy-mobile`:

```bash
./gradlew --no-daemon -Pkotlin.incremental=false :app:compileDebugKotlin
```

These passed in the current workspace.

## Patch and replay

### Suggested single-commit message

```text
Add transport-backed connections and Android USB host support
```

### Regenerate patch

```bash
git -C external/dadb diff upstream/master HEAD > external/dadb_usb.patch
```

### Apply patch in a clean dadb checkout

```bash
git apply ../dadb_usb.patch --allow-empty
```

### Rebase or replay flow

```bash
git checkout main
git fetch --no-tags upstream
git diff upstream/master HEAD > ../dadb_usb.patch
git reset --hard upstream/master
git apply --3way ../dadb_usb.patch
git commit -a -m "Add transport-backed connections and Android USB host support"
git push
```

## Next useful work

- Add an explicit `peers.json` evolution policy:
  - schema migration
  - cleanup / expiry
  - damaged-file recovery
- Add a transport-level rebinding test for:
  - new endpoint
  - old peer
  - known connect pin
- Decide whether `createNetworkDadb(...)` should eventually be renamed to something more public-facing such
  as `connectAuto(...)`, without rushing an API rename
- Decide whether `dadb-android` should get its own README
- Decide what subset is suitable for an upstream PR
- Keep app-layer permission and scanning logic out of `dadb`
- Continue runtime validation from the app side if USB behavior changes
- Continue moving app-side TLS / peer-storage decisions behind `AdbRuntime`

## Wireless Debugging / TLS handoff

This section records the conclusions reached after the USB migration work, while exploring
Wireless Debugging support (`_adb-tls-connect._tcp` and pairing).

### Important design corrections

- Do not model TLS ADB as an Android-only feature.
- Do not require the app layer to understand `plain` vs `tls` as the default mental model.
- The public connection model should eventually allow:
  - `AUTO`
  - `PLAIN`
  - `TLS`
- `AUTO` should be the default.
- Manual selection should still remain available for diagnostics and controlled testing.

### Current Wireless Debugging runtime shape

The current practical runtime split is:

- app owns:
  - pairing UI
  - pairing code input
  - permission / discovery / diagnostics UI
- `dadb-android` owns:
  - local identity storage under one root
  - peer metadata storage in `peers.json`
  - connect-port TLS pin learning and later enforcement
  - one auto transport that can stay plain or upgrade to TLS in-band
  - endpoint to peer rebinding when a new endpoint presents a known connect pin

Important nuance:

- pairing-port TLS identity and connect-port TLS identity are stored separately
- the library does not pretend they are the same thing
- the first connect-port TLS success is still TOFU
- later connects pin the learned connect certificate

### What belongs where

Treat the following as the current intended shape unless requirements change.

- `:dadb`
  - should stay JVM-first and transport-neutral
  - should own generic connection policy and transport abstraction
  - should eventually support TLS-capable ADB connection as a first-class backend
- `:dadb-android`
  - should own Android-specific helpers and transports
  - currently owns Android USB host transport
  - currently owns the Android-facing Wireless Debugging runtime and pairing integration
- app layer
  - should own UI, history, metadata, reconnect policy, and diagnostics
  - should not own packet-level pairing logic or transport-level TLS connection logic

### USB wording correction

Keep this wording precise:

- USB itself is not Android-only.
- The current `dadb-android` USB backend is Android-only because it uses Android USB host APIs.
- Other platforms could support USB through different backends in the future if there is value.

### TLS certificate persistence

Current conclusion:

- Do not introduce a second long-lived TLS identity file by default.
- Keep one long-lived host identity source:
  - `AdbKeyPair`
- Generate self-signed TLS certificates from that long-lived key material on demand.
- Default TLS certificates should be in-memory derived artifacts, not separately persisted files.
- The app may persist pairing and connection metadata, but not a second independent TLS identity.

In practice:

- persist:
  - `AdbKeyPair`
  - pairing / connection metadata
- do not persist by default:
  - separate TLS cert files
  - separate TLS private keys

### Current code moved into `dadb` family

The current workspace has these Wireless Debugging related changes inside `external/dadb`:

- `dadb/src/main/kotlin/dadb/AdbKeyPair.kt`
  - now exposes `adbPublicKey()` and `privateKey()`
  - higher-level TLS / pairing helpers no longer need reflection
- `dadb/src/main/kotlin/dadb/Constants.kt`
  - includes `STLS`-related constants
- `dadb/src/main/kotlin/dadb/AdbWriter.kt`
  - can write `STLS`
- `dadb/src/main/kotlin/dadb/AdbTransport.kt`
  - supports TLS-upgradable transport shape
  - `SourceSinkAdbTransport` now closes `source` / `sink` if no external closeable is supplied
- `dadb/src/main/kotlin/dadb/AdbConnection.kt`
  - now handles `A_STLS`, upgrades the active transport, and continues `AUTH` / `CNXN`
- `dadb-android/src/main/kotlin/dadb/android/tls/TlsAdbTransportFactory.kt`
  - Android TLS transport factory
  - now supports an explicit `trustManager` constructor
  - the convenience constructor still uses an unsafe trust policy for self-signed peers
- `dadb-android/src/main/kotlin/dadb/android/tls/AdbTlsContexts.kt`
  - Android TLS context and self-signed cert derivation helper
  - `createUnsafe()` now makes the insecure trust choice explicit
- `dadb-android/src/main/kotlin/dadb/android/wireless/WirelessDebugPairing.kt`
  - now remains internal-only as an unfinished placeholder
  - it should not be described as a stable library-facing pairing API

### Very important: STLS-aware TLS connect is now implemented

This document previously described TLS support as unfinished. That is no longer accurate.

Current status:

- real STLS-aware TLS ADB connect is implemented in `:dadb`
- the active connection can upgrade in-place after `A_STLS`
- the app side no longer needs to guess TLS only from port shape

What remains unfinished is pairing consolidation, not connect:

- the old `dadb-android` pairing shell is not a correct production implementation
- it has now been reduced to an internal placeholder instead of a public-facing default API
- the app currently uses a native SPAKE2 client as a pragmatic bridge
- that means connect is in better shape than pairing modularization

### Current architecture split

Treat the current split as intentional and temporary:

- `:dadb`
  - owns transport-neutral ADB protocol and STLS-aware TLS connection flow
- `:dadb-android`
  - owns Android TLS context / transport helpers
  - currently exposes STLS-aware connect support
  - does not yet expose a production-ready pairing client
- app layer
  - still temporarily owns the working native SPAKE2 pairing client
  - owns history, metadata, diagnostics, and UI behavior

Do not misread the current state as "pairing already fully moved into `dadb-android`". It has not.

### Port-based TLS detection is obsolete

Preserve this conclusion:

- do not infer Wireless Debugging TLS from port number
- ports are now effectively random
- the app should prefer metadata-based TLS hints gathered from successful pairing / connection

### TLS trust policy status

Current code status:

- the default convenience path in `TlsAdbTransportFactory(keyPair, ...)` still uses an unsafe
  trust manager so current self-signed Wireless Debugging peers keep working
- this unsafe behavior is now explicit in `AdbTlsContexts.createUnsafe(...)`
- callers that need a stricter policy can now provide their own `X509ExtendedTrustManager`

Current design conclusion:

- treat trust-all as a temporary interoperability default, not as the final library security model
- a production-grade trust policy should eventually be driven by pairing metadata, pinning, or an
  equivalent verified peer identity mechanism

### Reference projects inspected

Two local references were checked:

- `external/ScrcpyForAndroid-Miuzarte`
- `external/Easycontrol`

Findings:

- `ScrcpyForAndroid-Miuzarte` does not use `dadb`
- it implements its own direct ADB stack, including:
  - Kotlin connection logic
  - TLS context and self-signed cert generation
  - native SPAKE2 bridge in `app/src/main/jni/adb_pairing.cpp`
- `Easycontrol` is useful as a traditional ADB reference, but not as a finished Wireless Debugging
  pairing implementation

Treat `ScrcpyForAndroid-Miuzarte` as an implementation reference, not as an example of how `dadb`
is consumed.

### Recent runtime conclusions that matter to the patch

Recent device logs confirmed:

- successful pairing on the real pairing port works
- later failures with a stale or wrong port produce `ECONNREFUSED`
- that error means the socket was refused before pairing protocol exchange started

This distinction matters:

- `ECONNREFUSED` is a wrong / expired pairing port problem
- it is not evidence of an "invalid pairing code" path

When validating the wrong-code path later, keep:

- same host
- same live pairing port
- only the code changed

### Recommended next step

When work resumes, prefer this order:

1. keep the STLS-aware connect path in `:dadb`; do not regress it back into app-level TLS socket handling
2. move the working native SPAKE2 pairing path into the `dadb` family when there is time
3. keep pairing and connect testing anchored to the app's existing settings-page pairing flow
4. preserve metadata-based TLS preference in the app
5. distinguish wrong-port errors from wrong-code errors in app-facing diagnostics
