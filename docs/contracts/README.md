# Cross-platform contracts

This directory contains protocol and operational invariants shared by the Android and macOS clients. Platform-specific architecture, UI, troubleshooting, and release instructions belong in the corresponding Wiki.

- [DADB helper protocol](adb-helper-protocol.md)
- [scrcpy session order](scrcpy-session-order.md)
- [logging contract](logging-contract.md)

Current source code is authoritative when an implementation and this directory disagree. Update the contract and every consumer in the same change set; do not create compatibility branches for obsolete protocol shapes unless explicitly required.
