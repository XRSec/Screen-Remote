# ADB Shell 管理器使用指南

## 概述

**AdbShellManager** 统一管理所有 Shell 命令执行，自动收集状态信息并推送到 ScrcpyEventBus。

**位置**：`infrastructure/adb/shell/AdbShellManager.kt`

## 优势

1. **统一入口** - 所有 Shell 命令通过一个管理器
2. **自动监控** - 自动记录命令执行时间、成功/失败状态
3. **事件上报** - 自动推送到 ScrcpyEventBus，便于调试和统计
4. **常用命令** - 封装常用 Shell 命令，避免重复代码

## 使用方式

### 1. 基础命令执行

```kotlin
// 替换原有的 connection.executeShell()
val result = AdbShellManager.execute(
    connection = connection,
    command = "input keyevent KEYCODE_HOME"
)

if (result.isSuccess) {
    val output = result.getOrNull()
}
```

### 2. 常用命令（已封装）

```kotlin
// 唤醒屏幕
AdbShellManager.wakeUpScreen(connection)

// 展开通知栏
AdbShellManager.expandNotifications(connection)

// 设置剪贴板
AdbShellManager.setClipboard(connection, "Hello")

// 杀死进程
AdbShellManager.killProcess(connection, "scrcpy.*scid=12345678")

// 设置文件权限
AdbShellManager.chmod(connection, "755", "/data/local/tmp/scrcpy-server.jar")

// 心跳检测
AdbShellManager.heartbeat(connection)

// 验证连接
val isConnected = AdbShellManager.verifyConnection(connection)

// 获取设备属性
val model = AdbShellManager.getProperty(connection, "ro.product.model")
```

### 3. 禁用事件上报（性能敏感场景）

```kotlin
// 心跳检测等高频命令，不上报事件
val result = AdbShellManager.execute(
    connection = connection,
    command = "echo 1",
    retryOnFailure = false,
    reportToEventBus = false  // 禁用事件上报
)
```

## 迁移指南

### 原有代码
```kotlin
// ControlViewModel.kt
val result = connection.executeShell(command)

// ScrcpyForegroundService.kt
val result = connection.executeShell("echo 1", retryOnFailure = false)

// ConnectionLifecycle.kt
connection.executeShell(killCmd, retryOnFailure = false)

// AdbFileOperations.kt
dadb.shell("chmod 755 $scrcpyServerPath")
```

### 迁移后
```kotlin
// ControlViewModel.kt
val result = AdbShellManager.execute(connection, command)

// ScrcpyForegroundService.kt
val result = AdbShellManager.heartbeat(connection)

// ConnectionLifecycle.kt
AdbShellManager.killProcess(connection, "scrcpy.*scid=$scidHex")

// AdbFileOperations.kt
AdbShellManager.chmod(connection, "755", scrcpyServerPath)
```

## 事件监控

### 自动上报事件

```kotlin
// 成功执行
ScrcpyEvent.ShellCommandExecuted(
    deviceId = "device123",
    command = "input keyevent KEYCODE_HOME",
    output = "",
    durationMs = 45,
    success = true
)

// 执行失败
ScrcpyEvent.ShellCommandFailed(
    deviceId = "device123",
    command = "invalid_command",
    error = "sh: invalid_command: not found",
    durationMs = 23
)
```

### 查询统计

```kotlin
val state = ScrcpyEventBus.getDeviceState(deviceId)

// Shell 命令统计
val totalCommands = state.shellCommandCount
val failedCommands = state.shellCommandFailCount
val lastCommand = state.lastShellCommand
val successRate = (totalCommands - failedCommands) / totalCommands.toFloat()
```

### 日志输出

```
[AdbConnection] [device123] Shell: input keyevent KEYCODE_HOME (45ms)
[AdbConnection] [device123] Shell 失败: invalid_command - sh: not found (23ms)
```

## 需要迁移的文件

1. `ControlViewModel.kt` - executeShellCommand()
2. `ScrcpyForegroundService.kt` - 心跳检测
3. `ConnectionLifecycle.kt` - 杀进程
4. `AdbFileOperations.kt` - chmod
5. `AdbConnectionKeepAlive.kt` - 心跳检测
6. `DeviceInfoProvider.kt` - getprop
7. `AdbConnectionVerifier.kt` - 验证连接
8. `AdbBridge.kt` - executeShellCommand
9. `ScrcpyController.kt` - 设置剪贴板
10. `FloatingMenuGestureHandler.kt` - 展开通知栏

## 注意事项

1. **高频命令** - 心跳检测等高频命令设置 `reportToEventBus = false`
2. **敏感命令** - 获取设备属性等敏感命令可禁用上报
3. **性能影响** - 事件上报开销极小（< 1ms），可放心使用
4. **统计准确性** - 只统计通过 AdbShellManager 执行的命令
