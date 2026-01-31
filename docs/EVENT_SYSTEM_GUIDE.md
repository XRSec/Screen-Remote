# Scrcpy 事件系统使用指南

## 系统概述

项目使用 **ScrcpyEventBus**（SDL 风格事件系统）作为会话级事件总线，支持：
1. UI 层事件（按键、触摸、生命周期）
2. 监控事件（Server 日志、Socket 数据、Codec 状态）
3. Native 层回调
4. 统一日志输出（ScrcpyEventLogger）

**作用域**：连接会话内的全局事件总线，非应用级全局
**生命周期**：随 Scrcpy 连接会话启动/停止
**关系定位**：与 ADB 保活服务平级，各自独立管理自己的生命周期
**支持多设备**：虽然当前只连接一个设备，但架构支持多设备状态管理（通过 deviceId 区分）

## 快速定位

### 称呼
- **ScrcpyEventBus** - 全局事件总线（单例）
- **ScrcpyEvent** - 事件定义（包含分类、日志级别、描述）
- **ScrcpyEventLoop** - 事件循环
- **ScrcpyEventMonitor** - 监控器（自动处理监控事件）
- **ScrcpyEventLogger** - 日志处理器（统一日志输出）

### 位置
```
core/common/event/
├── ScrcpyEventBus.kt      # 全局单例，事件总线
├── ScrcpyEvent.kt         # 所有事件定义（含分类、日志级别）
├── ScrcpyEventLoop.kt     # 事件循环实现
├── ScrcpyEventMonitor.kt  # 监控器（自动更新状态）
├── ScrcpyEventLogger.kt   # 日志处理器（统一输出）
└── ScrcpyEventModels.kt   # 监控状态数据模型
```

## 事件分类

### 1. UI 事件（Category.UI）
用户交互、输入、窗口操作
- KeyDown, KeyUp - 键盘事件
- MouseMotion, MouseButtonDown, MouseButtonUp - 鼠标事件
- TouchDown, TouchMove, TouchUp - 触摸事件
- Scroll - 滚动事件
- ClipboardUpdate - 剪贴板更新

### 2. 监控事件（Category.MONITOR）
系统状态、性能指标、资源使用
- ServerLog - Server 日志
- SocketDataReceived, SocketDataSent - Socket 数据统计
- VideoFrameDecoded, AudioFrameDecoded - 解码器状态
- DeviceScreenLocked, DeviceScreenOn - 设备状态
- ShellCommandExecuted - Shell 命令执行
- ForwardSetup, FilePushSuccess - ADB 操作

### 3. 生命周期事件（Category.LIFECYCLE）
连接、断开、启动、停止
- ConnectionEstablished, ConnectionLost - 连接状态
- ServerConnected, ServerConnectionFailed - 服务器连接
- DeviceDisconnected - 设备断开

### 4. 系统事件（Category.SYSTEM）
错误、异常、系统任务
- Error, DemuxerError, ControllerError - 错误事件
- MonitorException - 监控异常
- RunOnMainThread - 主线程任务

## 日志级别

每个事件都有对应的日志级别：
- **VERBOSE** - 高频事件（视频帧、Socket 数据、鼠标移动）
- **DEBUG** - 调试事件（命令执行、状态变化）
- **INFO** - 重要事件（连接建立、设备状态）
- **WARN** - 警告事件（超时、重试、降级）
- **ERROR** - 错误事件（异常、失败）

## 使用方式

### 1. 启动事件系统（应用启动时）

```kotlin
// Application.onCreate()
ScrcpyEventBus.start()
ScrcpyEventMonitor.start()

// 可选：配置日志级别
ScrcpyEventLogger.setMinLogLevel(ScrcpyEvent.LogLevel.DEBUG)
ScrcpyEventLogger.setVerboseEnabled(false) // 默认关闭 VERBOSE
```

### 2. 推送事件

所有事件都会自动记录日志，无需手动调用 LogManager

#### UI 事件
```kotlin
// 触摸事件
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.TouchDown(pointerId = 0, x = 100f, y = 200f)
)

// 键盘事件
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.KeyDown(scancode = 0, keycode = 4, keymod = 0)
)
```

#### 监控事件
```kotlin
// Server 日志
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.ServerLog(deviceId, "Device: Pixel 6")
)

// Socket 数据（自动采样，每 100 次输出一次）
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.SocketDataReceived(deviceId, "video", 1024)
)

// 视频帧（自动采样）
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.VideoFrameDecoded(deviceId, 1080, 2400, pts)
)

// 设备状态
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.DeviceScreenLocked(deviceId)
)

// 连接建立
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.ConnectionEstablished(deviceId)
)

// 异常
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.MonitorException(deviceId, "socket", "Connection reset", e)
)
```

### 3. 查询状态

```kotlin
// 获取设备状态
val state = ScrcpyEventBus.getDeviceState(deviceId)

// 检查连接
if (state.isConnected) { ... }

// 检查锁屏
if (state.isScreenLocked) { ... }

// 检查视频活跃
if (!state.isVideoActive) { ... }

// 获取统计
val videoFrames = state.videoFrameCount
val socketStats = state.socketStats["video"]
```

### 4. 输出状态摘要

```kotlin
// 输出到日志
val summary = ScrcpyEventBus.getStateSummary(deviceId)
LogManager.i(TAG, summary)

// 获取事件统计
val stats = ScrcpyEventLogger.getStatsSummary()
LogManager.i(TAG, stats)
```

### 5. 清理状态

```kotlin
// 断开连接时清理
ScrcpyEventBus.clearDeviceState(deviceId)
```

## 日志输出示例

### 正常运行
```
[ScrcpyEventBus] 🔄 [LIFECYCLE] [device123] 连接建立
[ScrcpyEventBus] 📊 [MONITOR] [device123] Server: Device: Pixel 6
[ScrcpyEventBus] 📊 [MONITOR] [device123] Socket[video] 接收: 1024B (累计: 100)
[ScrcpyEventBus] 📊 [MONITOR] [device123] 视频帧解码: 1080x2400 pts=12345 (累计: 100)
```

### 锁屏检测
```
[ScrcpyEventBus] 📊 [MONITOR] [device123] 设备锁屏
```

### 连接异常
```
[ScrcpyEventBus] 🔄 [LIFECYCLE] [device123] 连接丢失: Socket closed
[ScrcpyEventBus] 📊 [MONITOR] [device123] 异常[socket]: Connection reset
```

## 高级功能

### 1. 日志级别控制

```kotlin
// 只输出 INFO 及以上
ScrcpyEventLogger.setMinLogLevel(ScrcpyEvent.LogLevel.INFO)

// 启用 VERBOSE 日志（包含高频事件）
ScrcpyEventLogger.setVerboseEnabled(true)
```

### 2. 事件统计

```kotlin
// 获取所有事件统计
val allStats = ScrcpyEventLogger.getAllEventStats()

// 获取特定事件统计
val videoStats = ScrcpyEventLogger.getEventStats("VideoFrameDecoded")
println("总计: ${videoStats?.totalCount}")
println("已记录: ${videoStats?.loggedCount}")

// 重置统计
ScrcpyEventLogger.resetStats()
```

### 3. 自定义事件处理

```kotlin
// 注册自定义处理器
ScrcpyEventBus.on<ScrcpyEvent.ConnectionEstablished> { event ->
    // 自定义逻辑
    println("设备 ${event.deviceId} 已连接")
}
```

## 优势

1. **统一管理** - 所有事件通过一个总线
2. **自动日志** - ScrcpyEventLogger 自动处理所有日志输出
3. **分类清晰** - UI/监控/生命周期/系统四大类
4. **级别控制** - 支持日志级别过滤
5. **自动采样** - 高频事件自动采样（每 100 次输出一次）
6. **状态查询** - 随时查询设备状态
7. **事件统计** - 自动统计事件频率和性能
8. **线程安全** - 可从任意线程推送事件

## 注意事项

1. **deviceId 必填** - 所有监控事件都需要 deviceId
2. **启动监控器** - 必须调用 `ScrcpyEventMonitor.start()`
3. **清理状态** - 断开连接时调用 `clearDeviceState()`
4. **自动采样** - 高频事件（视频帧、Socket 数据）自动采样
5. **无需手动日志** - 所有事件都会自动记录日志，不要重复调用 LogManager
