# SDL 事件系统架构图

## 系统架构

```mermaid
graph TB
    App[Application] -->|启动| EventBus[ScrcpyEventBus]
    App -->|启动| Monitor[ScrcpyEventMonitor]
    EventBus -->|管理| Loop[ScrcpyEventLoop]
    EventBus -->|存储| States[DeviceMonitorState]
    Monitor -->|监听| EventBus
    Monitor -->|更新| States

    subgraph Producers[事件生产者]
        Video[VideoDecoder]
        Audio[AudioDecoder]
        Server[ScrcpyServer]
        Socket[SocketManager]
        Control[ScrcpyController]
        Native[Native Layer]
        Shell[AdbShellManager]
    end

    Producers -->|pushEvent| EventBus

    subgraph Consumers[事件消费者]
        UI[UI Layer]
        Debug[Debug Tools]
    end

    States -->|查询状态| Consumers
```

## 事件流转

```mermaid
sequenceDiagram
    participant VD as VideoDecoder
    participant EB as ScrcpyEventBus
    participant EM as ScrcpyEventMonitor
    participant DS as DeviceState
    participant UI as UI Layer
    VD ->> EB: pushEvent(VideoFrameDecoded)
    EB ->> EM: 触发事件处理器
    EM ->> DS: 更新 videoFrameCount
    EM ->> EM: 输出日志（采样）
    UI ->> DS: getDeviceState()
    DS -->> UI: 返回状态
```

## 视频解码流程

```mermaid
flowchart LR
    A[解码视频帧] --> B[pushEvent<br/>VideoFrameDecoded]
    B --> C[ScrcpyEventMonitor<br/>自动处理]
    C --> D[更新状态<br/>videoFrameCount++]
    C --> E[采样输出日志<br/>每100帧]
    D --> F[DeviceMonitorState]
```

## Server 日志监控流程

```mermaid
flowchart LR
    A[读取 Server 日志] --> B{检测特殊日志}
    B -->|screen locked| C[pushEvent<br/>DeviceScreenLocked]
    B -->|screen unlocked| D[pushEvent<br/>DeviceScreenUnlocked]
    B -->|普通日志| E[pushEvent<br/>ServerLog]
    C --> F[ScrcpyEventMonitor]
    D --> F
    E --> F
    F --> G[更新设备状态]
    F --> H[输出日志]
```

## Socket 数据监控流程

```mermaid
flowchart LR
    A[读取 Socket 数据] --> B[pushEvent<br/>SocketDataReceived]
    B --> C[ScrcpyEventMonitor]
    C --> D[更新统计<br/>bytesReceived++]
    C --> E[采样输出日志<br/>每100包]
    D --> F[SocketStats]
```

## 连接生命周期

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    Disconnected --> Connecting: connect()
    Connecting --> Connected: ConnectionEstablished
    Connecting --> Error: ConnectionFailed
    Connected --> Disconnected: ConnectionLost
    Connected --> Reconnecting: 检测到断连
    Reconnecting --> Connected: 重连成功
    Reconnecting --> Disconnected: 重连失败
    Error --> Disconnected: 清理资源
    Disconnected --> [*]: clearDeviceState()
```

## Shell 命令执行流程

```mermaid
flowchart LR
    A[调用 AdbShellManager] --> B[执行 Shell 命令]
    B --> C{执行结果}
    C -->|成功| D[pushEvent<br/>ShellCommandExecuted]
    C -->|失败| E[pushEvent<br/>ShellCommandFailed]
    D --> F[ScrcpyEventMonitor]
    E --> F
    F --> G[更新统计]
    F --> H[输出日志]
```

## 组件关系

```mermaid
graph TB
    subgraph Core[核心层 core/common/event]
        EB[ScrcpyEventBus<br/>事件总线单例]
        EL[ScrcpyEventLoop<br/>事件循环]
        EV[ScrcpyEvent<br/>事件定义]
        EM[ScrcpyEventMonitor<br/>监控器]
        MD[ScrcpyEventModels<br/>状态模型]
    end

    subgraph Infra[基础设施层 infrastructure]
        VD[VideoDecoder]
        AD[AudioDecoder]
        SS[ScrcpyServer]
        SM[SocketManager]
        SC[ScrcpyController]
        SH[AdbShellManager]
    end

    subgraph Feature[功能层 feature]
        UI[RemoteDisplayScreen]
        VM[ControlViewModel]
    end

    EB --> EL
    EB --> MD
    EM --> EB
    EM --> MD
    Infra -->|pushEvent| EB
    Feature -->|getDeviceState| EB
    style EB fill: #4CAF50
    style EM fill: #2196F3
    style MD fill: #FF9800
```

## 数据流向

```mermaid
flowchart TD
    A[组件产生事件] -->|pushEvent| B[ScrcpyEventBus]
    B -->|Channel| C[ScrcpyEventLoop]
    C -->|触发处理器| D[ScrcpyEventMonitor]
    D -->|更新状态| E[DeviceMonitorState]
    D -->|输出日志| F[LogManager]
    E -->|查询| G[UI/Debug Tools]
    style B fill: #4CAF50
    style D fill: #2196F3
    style E fill: #FF9800
```

## 关键特性

| 特性        | 说明                              |
|-----------|---------------------------------|
| **单向数据流** | 组件 → EventBus → Monitor → State |
| **自动监控**  | Monitor 自动处理所有监控事件              |
| **状态查询**  | 任意组件可查询实时状态                     |
| **采样输出**  | 高频事件每 100 次输出一次                 |
| **异常追踪**  | 统一记录所有异常                        |
| **会话级**   | 随连接会话启动/停止                      |
| **多设备支持** | 通过 deviceId 区分设备                |

## 快速定位

- **称呼**：ScrcpyEventBus / SDL 事件系统
- **位置**：`core/common/event/`
- **文档**：`docs/EVENT_SYSTEM_GUIDE.md`
- **流程**：`docs/SDL_EVENT_FLOW.md`（本文档）
- **Shell 管理**：`docs/SHELL_MANAGER_GUIDE.md`
