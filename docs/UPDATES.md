## Add URL automation and compatibility recovery

- Add screen-remote URLs for navigation, transient scrcpy overrides, management, and settings.
- Add an ADB screenshot compatibility mode with user-confirmed video capture and decoder-size recovery.
- Add opt-out telemetry, debug diagnostics, media hardening, remote volume-key forwarding, and regression coverage.

## Add legacy shell fallback and remote device helpers

- Fall back from shell_v2 to legacy shell when unsupported or rejected, and remember rejected connection features.
- Add a remote JPEG screenshot stream with DisplaySurface and SurfaceControl capture backends.
- Add helper APIs for directory listing, process inspection, application metadata, icons, and remote text injection.
- Extend compatibility to older Android runtimes and replace unavailable platform APIs with portable implementations.
- Add regression and integration coverage for legacy shell, management helpers, screenshots, and platform compatibility.
