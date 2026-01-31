# SDL 事件系统完整架构

## 系统架构图

```mermaid
graph TB
    subgraph Producers[事件生产者]
        UI[UI Layer<br/>触摸/键盘/鼠标]
        Video[VideoDecoder<br/>视频解码]
        Audio[AudioDecoder<br/>音频解码]
        Server[ScrcpyServer<br/>Server 日志]
        Socket[SocketManager<br/>网络数据]
        Control[ScrcpyController<br/>控制命令]
        Shell[AdbShellManager<br/>Shell 命令]
        Native[Native Layer<br/>JNI 回调]
    end

    subgraph Core[核心事件系统]
        EventBus[ScrcpyEventBus<br/>事件总线]
        EventLoop[ScrcpyEventLoop<br/>事件循环]
        Logger[ScrcpyEventLogger<br/>日志处理器]
        Monitor[ScrcpyEventMonitor<br/>状态监控器]
    end

    subgraph Storage[状态存储]
        DeviceState[DeviceMonitorState<br/>设备状态]
        EventStats[EventStats<br/>事件统计]
    end

    subgraph Consumers[事件消费者]
        UIConsumer[UI Layer<br/>状态查询]
        Debug[Debug Tools<br/>日志分析]
    end

    Producers -->|pushEvent| EventBus
    EventBus --> EventLoop
    EventLoop -->|自动记录| Logger
    EventLoop -->|触发处理器| Monitor
    Logger -->|更新| EventStats
    Monitor -->|更新| DeviceState
    DeviceState -->|查询| UIConsumer
    EventStats -->|查询| Debug
    Logger -->|输出| LogManager[LogManager<br/>日志系统]

    style EventBus fill:#4CAF50
    style Logger fill:#2196F3
    style Monitor fill:#FF9800
    style DeviceState fill:#9C27B0
```

## 事件处理流程

```mermaid
sequenceDiagram
    participant P as 事件生产者
    participant EB as ScrcpyEventBus
    participant EL as ScrcpyEventLoop
    participant LOG as ScrcpyEventLogger
    participant MON as ScrcpyEventMonitor
    participant DS as DeviceState
    participant LM as LogManager

    P->>EB: pushEvent(event)
    EB->>EL: Channel 传递
    EL->>LOG: logEvent(event)
    
    alt 检查日志级别
        LOG->>LOG: shouldLog()?
        alt 需要采样
            LOG->>LOG: shouldSample()?
        end
    end
    
    LOG->>LM: 输出日志
    LOG->>LOG: 更新 EventStats
    
    EL->>MON: 触发处理器
    MON->>DS: 更新设备状态
    
    Note over DS: 状态可随时查询
```

## 事件分类与日志级别

```mermaid
graph LR
    subgraph UI事件
        UI1[KeyDown/KeyUp<br/>DEBUG]
        UI2[MouseMotion<br/>VERBOSE]
        UI3[TouchDown/TouchUp<br/>DEBUG]
        UI4[ClipboardUpdate<br/>INFO]
    end

    subgraph 监控事件
        M1[ServerLog<br/>DEBUG]
        M2[SocketData<br/>VERBOSE]
        M3[VideoFrame<br/>VERBOSE]
        M4[DeviceScreen<br/>INFO]
        M5[ShellCommand<br/>DEBUG]
        M6[ForwardSetup<br/>INFO]
    end

    subgraph 生命周期事件
        L1[ConnectionEstablished<br/>INFO]
        L2[ConnectionLost<br/>WARN]
        L3[ServerConnected<br/>INFO]
        L4[DeviceDisconnected<br/>WARN]
    end

    subgraph 系统事件
        S1[Error<br/>ERROR]
        S2[MonitorException<br/>ERROR]
        S3[RunOnMainThread<br/>VERBOSE]
    end

    style UI1 fill:#E3F2FD
    style M1 fill:#FFF3E0
    style L1 fill:#E8F5E9
    style S1 fill:#FFEBEE
```

## 日志输出流程

```mermaid
flowchart TD
    Start[事件推送] --> Check1{检查日志级别}
    Check1 -->|低于最小级别| Skip[跳过]
    Check1 -->|符合级别| Check2{是否 VERBOSE?}
    
    Check2 -->|是| Check3{VERBOSE 已启用?}
    Check3 -->|否| Skip
    Check3 -->|是| Check4{需要采样?}
    
    Check2 -->|否| Check4
    
    Check4 -->|是| Sample{采样检查}
    Sample -->|不输出| UpdateStats[更新统计]
    Sample -->|输出| Format[格式化日志]
    
    Check4 -->|否| Format
    
    Format --> Output[输出到 LogManager]
    Output --> UpdateStats
    UpdateStats --> End[完成]
    Skip --> End

    style Format fill:#4CAF50
    style Output fill:#2196F3
    style UpdateStats fill:#FF9800
```

## 采样策略

```mermaid
graph LR
    subgraph 高频事件_每100次输出1次
        HF1[MouseMotion]
        HF2[TouchMove]
        HF3[SocketDataReceived]
        HF4[SocketDataSent]
        HF5[VideoFrameDecoded]
        HF6[AudioFrameDecoded]
        HF7[NewFrame]
    end

    subgraph 普通事件_每次都输出
        NF1[KeyDown/KeyUp]
        NF2[TouchDown/TouchUp]
        NF3[ConnectionEstablished]
        NF4[DeviceScreenLocked]
        NF5[ShellCommandExecuted]
    end

    subgraph 错误事件_每次都输出
        EF1[Error]
        EF2[MonitorException]
        EF3[ConnectionLost]
        EF4[DecoderStalled]
    end

    style HF1 fill:#FFF3E0
    style NF1 fill:#E8F5E9
    style EF1 fill:#FFEBEE
```

## 状态管理

```mermaid
graph TB
    subgraph DeviceMonitorState
        Connection[连接状态<br/>isConnected<br/>connectionTime]
        Screen[屏幕状态<br/>isScreenOn<br/>isScreenLocked]
        Video[视频状态<br/>videoFrameCount<br/>isVideoActive]
        Audio[音频状态<br/>audioFrameCount<br/>isAudioActive]
        Socket[Socket统计<br/>socketStats]
        Shell[Shell统计<br/>shellCommandCount]
        Exception[异常记录<br/>recentExceptions]
    end

    subgraph EventStats
        Total[总事件数<br/>totalCount]
        Logged[已记录数<br/>loggedCount]
        Sampled[采样数<br/>sampledCount]
        Duration[持续时间<br/>totalDuration]
    end

    Monitor[ScrcpyEventMonitor] -->|更新| DeviceMonitorState
    Logger[ScrcpyEventLogger] -->|更新| EventStats

    style DeviceMonitorState fill:#9C27B0
    style EventStats fill:#FF9800
```

## 关键特性

| 特性 | 说明 |
|------|------|
| **事件分类** | UI/监控/生命周期/系统四大类 |
| **日志级别** | VERBOSE/DEBUG/INFO/WARN/ERROR |
| **自动日志** | 所有事件自动记录，无需手动调用 |
| **智能采样** | 高频事件自动采样（每 100 次） |
| **状态管理** | 自动维护设备状态和事件统计 |
| **级别控制** | 支持动态调整日志级别 |
| **性能监控** | 自动统计事件频率和耗时 |
| **线程安全** | 可从任意线程推送事件 |

## 使用示例

### 配置日志级别

```kotlin
// 只输出 INFO 及以上
ScrcpyEventLogger.setMinLogLevel(ScrcpyEvent.LogLevel.INFO)

// 启用 VERBOSE（包含高频事件）
ScrcpyEventLogger.setVerboseEnabled(true)
```

### 推送事件

```kotlin
// UI 事件
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.TouchDown(pointerId = 0, x = 100f, y = 200f)
)

// 监控事件（自动采样）
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.VideoFrameDecoded(deviceId, 1080, 2400, pts)
)

// 生命周期事件
ScrcpyEventBus.pushEvent(
    ScrcpyEvent.ConnectionEstablished(deviceId)
)
```

### 查询状态

```kotlin
// 设备状态
val state = ScrcpyEventBus.getDeviceState(deviceId)
println("视频帧数: ${state.videoFrameCount}")

// 事件统计
val stats = ScrcpyEventLogger.getEventStats("VideoFrameDecoded")
println("总计: ${stats?.totalCount}, 已记录: ${stats?.loggedCount}")
```

## 快速定位

- **文档**：`docs/EVENT_SYSTEM_GUIDE.md` - 使用指南
- **架构**：`docs/EVENT_ARCHITECTURE.md` - 本文档
- **流程**：`docs/SDL_EVENT_FLOW.md` - 原始流程图
- **代码**：`core/common/event/` - 事件系统实现
