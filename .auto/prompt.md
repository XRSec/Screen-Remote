# Autoresearch: Screen Remote Android Miuix UI Migration

## Objective
推进 Screen Remote Android 端 Miuix UI 迁移，在已完成的设置体系、Session 卡片、设备配对卡片基础上，系统性收敛 DesignSystem 组件、RemoteDisplay 菜单/overlay、会话管理弹窗与各类列表卡片，全面迁移到 Miuix 组件基线，杜绝非白名单 Material3 组件泄漏，并保持 100% 编译通过与零功能退化。

## Metrics
- **Primary**: `unmigrated_targets` (count, lower is better) — 目标未迁移 M3 组件（Card, HorizontalDivider, AlertDialog, Button, TextButton, OutlinedButton, Checkbox）数量
- **Secondary**: `non_whitelisted` (count, lower is better), `miuix_count` (count, higher is better), `measure_ms` (ms, lower is better)

## How to Run
`./.auto/measure.sh` — 输出 `METRIC name=number` 指标。

## Files in Scope
- `Screen-Remote/app/src/main/java/com/screen/remote/android/core/designsystem/**`：设计系统组件（Card, Divider, Dialog, TagFilter 等）
- `Screen-Remote/app/src/main/java/com/screen/remote/android/feature/remote/**`：RemoteDisplay 菜单/状态覆盖层/控制组件
- `Screen-Remote/app/src/main/java/com/screen/remote/android/feature/device/**`：设备连接与添加弹窗（AddDeviceDialog, UsbDeviceDialog 等）
- `Screen-Remote/app/src/main/java/com/screen/remote/android/feature/session/**`：会话管理页面、命令页、文件页、端口转发卡片等
- `Screen-Remote/app/src/main/java/com/screen/remote/android/feature/settings/**`：设置页残余组件与卡片收敛

## Off Limits
- `Screen-Remote/app/src/main/java/com/screen/remote/android/core/scrcpy/**`：scrcpy 协议、渲染器、编解码器与 Socket 逻辑
- `Screen-Remote/app/src/main/java/com/screen/remote/android/core/adb/**` / `external/dadb/**`：ADB 底层通信与连接
- `Screen-Remote-macOS/**`：macOS 平台源码（独立仓库）

## Constraints
1. **构建约束**：所有改动必须通过 `./gradlew :app:compileDebugKotlin` 编译。
2. **样式约束**：
   - 弹窗按钮必须使用 `MiuixTextButton` + `ButtonDefaults.textButtonColors`。
   - 危险操作按钮使用 `AppColors.warning`。
   - Miuix Card 统一使用 `cornerRadius = 12.dp` 或 `AppDimens.cardCornerRadius`。
   - 分割线使用 `MiuixHorizontalDivider` 且 `thickness = 0.5.dp`。
   - 页面或弹窗外层包裹 `ScreenRemoteMiuixTheme`。
3. **合法 M3 保留项**：`Icon`, `IconButton`, `CircularProgressIndicator`, `LinearProgressIndicator`, `OutlinedTextField`, `Surface`, `FloatingActionButton`, `Badge`, `MaterialTheme.colorScheme`（文本颜色读取）等 Miuix 未提供替代的基础组件。

## What's Been Tried
- Baseline: 41 unmigrated target M3 usages across DesignSystem, RemoteDisplay overlay, Device dialogs, and Session management pages.
