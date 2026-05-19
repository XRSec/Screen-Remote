# iOS Asset Mapping

This document tracks useful source assets from
`external/screen-remote-ios/scrcpy-ios/scrcpy-ios/Assets.xcassets`
and their extracted Android counterparts from `/Users/xr/Downloads/screen-remote-extracted-icons`.

## Current Inventory

| iOS asset        | Source file                                                     | Android target                    | Status                                | Notes                                                                          |
|------------------|-----------------------------------------------------------------|-----------------------------------|---------------------------------------|--------------------------------------------------------------------------------|
| `BackIcon`       | `Assets.xcassets/BackIcon.imageset/BackIcon@3x.png`             | Remote floating menu `Back`       | Applied from extracted Android assets | `@drawable/ic_toolbar_back` + `@drawable-nodpi/ic_toolbar_back_sf.png`         |
| `HomeIcon`       | `Assets.xcassets/HomeIcon.imageset/HomeIcon@3x.png`             | Remote floating menu `Home`       | Applied from extracted Android assets | `@drawable/ic_toolbar_home` + `@drawable-nodpi/ic_toolbar_home_sf.png`         |
| `SwitchAppIcon`  | `Assets.xcassets/SwitchAppIcon.imageset/SwitchAppIcon@3x.png`   | Remote floating menu `Recents`    | Applied from extracted Android assets | `@drawable/ic_toolbar_switch` + `@drawable-nodpi/ic_toolbar_switch_sf.png`     |
| `KeyboardIcon`   | `Assets.xcassets/KeyboardIcon.imageset/KeyboardIcon@3x.png`     | Remote floating menu `Keyboard`   | Applied from extracted Android assets | `@drawable/ic_toolbar_keyboard` + `@drawable-nodpi/ic_toolbar_keyboard_sf.png` |
| `More`           | `Assets.xcassets/More.imageset/More@3x.png`                     | Remote floating menu `More`       | Applied from extracted Android assets | `@drawable/ic_toolbar_more` + `@drawable-nodpi/ic_toolbar_more_sf.png`         |
| `DisconnectIcon` | `Assets.xcassets/DisconnectIcon.imageset/DisconnectIcon@3x.png` | Remote floating menu `Disconnect` | Applied from extracted Android assets | `@drawable/ic_toolbar_close` + `@drawable-nodpi/ic_toolbar_close_sf.png`       |
| `Share`          | `Assets.xcassets/Share.imageset/Share@3x.png`                   | Upload / share actions            | Applied from extracted Android assets | `@drawable/ic_action_send_files_or_photos`                                     |
| `Refresh`        | `Assets.xcassets/Refresh.imageset/Refresh@3x.png`               | Refresh actions                   | Applied from extracted Android assets | `@drawable/ic_toolbar_refresh`                                                 |
| `TouchIcon`      | `Assets.xcassets/TouchIcon.imageset/TouchIcon@3x.png`           | Touch / gesture help entry points | Not wired                             | Candidate for future remote help / touch-mode UI                               |
| `disconnect`     | `Assets.xcassets/disconnect.imageset/disconnect@3x.png`         | Unknown legacy usage              | Unused                                | Looks like an older duplicate of disconnect semantics                          |
| `LaunchAppIcon`  | `Assets.xcassets/LaunchAppIcon.imageset/AppLaunchImage@3x.png`  | Launch surfaces                   | Unused                                | App branding only                                                              |
| `LaunchImage`    | `Assets.xcassets/LaunchImage.imageset/LaunchImage@3x.png`       | Splash / onboarding               | Unused                                | App branding only                                                              |
| `AppIcon`        | `Assets.xcassets/AppIcon.appiconset/*`                          | Android app icon study            | Unused                                | Source branding material                                                       |

## Rules

1. Prefer system or Material icons when the semantics are standard and the visual gap is acceptable.
   Examples: refresh, close, back in generic dialogs.

2. Prefer imported iOS assets when the control is part of the remote-control chrome and we want the
   iOS reference style.
   Examples: floating menu buttons, touch-mode affordances, share/upload entry points.

3. Prefer Android vector redraws when:
    - the imported asset needs recoloring by state
    - the icon should scale cleanly at many sizes
    - the imported PNG is only useful as a visual reference

## Extracted Android Structure

The exported folder is used as-is:

- `android-drawable/*.xml` -> `app/src/main/res/drawable/`
- `android-drawable-nodpi/*_sf.png` -> `app/src/main/res/drawable-nodpi/`

These XML files are bitmap wrappers, not vector path drawables.

## First Batch Applied

The remote floating menu now uses the extracted Android wrappers for:

- back
- home
- recents
- keyboard
- more
- disconnect
- upload
- dump UI layouts

These references are now active:

- `@drawable/ic_toolbar_back`
- `@drawable/ic_toolbar_home`
- `@drawable/ic_toolbar_switch`
- `@drawable/ic_toolbar_keyboard`
- `@drawable/ic_toolbar_more`
- `@drawable/ic_toolbar_close`
- `@drawable/ic_action_send_files_or_photos`
- `@drawable/ic_action_dump_ui_layouts`
- `@drawable/ic_toolbar_refresh`

## Next Candidates

- Audit settings / session-management screens for non-system icons that should align with the iOS
  source set.
- Decide whether `ic_action_fit_device_window_size` should be wired into Android functionality or
  remain reserved for future use.
