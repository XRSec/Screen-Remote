# 当前能力范围

## 功能面概览

当前项目已经覆盖的能力可以分成六组。

### 1. 会话与配置

- 多设备配置持久化
- 会话隔离
- 当前活跃会话管理
- 编解码器与连接参数配置

### 2. 连接与建链

- ADB 连接
- USB Host 场景接入
- Wireless Debugging 配对
- 连接验证与端口转发

### 3. scrcpy 运行时

- 启动并管理 scrcpy server
- 建立 video、audio、control 三类链路
- 处理 metadata 和运行状态

### 4. 媒体处理

- 视频解码与渲染
- 音频解码与播放
- 编解码器能力检测
- 编解码器缓存与选择

### 5. 控制与交互

- 触摸和手势控制
- 按键与输入控制
- 悬浮控件与辅助交互

### 6. 工程辅助能力

- 事件总线
- 日志系统
- Shell 管理器
- 状态监控与排障支持

## 代码结构概览

当前项目适合用下面五层理解。

### `core`

放稳定基础能力：

- 工具
- 模型
- 设计系统
- 国际化
- 数据基础设施

### `infrastructure`

放技术实现：

- adb
- scrcpy
- media

### `feature`

放业务功能：

- session
- remote
- device
- settings
- codec

### `service`

放前台服务和系统生命周期托管能力。

### `app`

放应用入口和装配逻辑。

## 关键实现入口

如果要从代码快速进入主链路，最值得优先看的对象包括：

- `core/domain/model/ScrcpyOptions.kt`
  会话配置的唯一载体。
- `infrastructure/scrcpy/session/SessionManager.kt`
  当前活跃会话入口。
- `infrastructure/scrcpy/session/Session.kt`
  单个运行中会话，承载配置快照、资源引用、状态和事件入口。
- `infrastructure/adb/connection/AdbConnectionManager.kt`
  ADB 连接总入口。
- `infrastructure/adb/connection/AdbConnectionConnector.kt`
  TCP、TLS、USB 建链细节。
- `infrastructure/scrcpy/connection/ConnectionSocketManager.kt`
  video、audio、control socket 建立逻辑。
- `infrastructure/adb/connection/SocketForwarder.kt`
  本地端口到设备 socket 的转发。
- `core/common/event/ScrcpyEventBus.kt`
  会话级事件总线。
- `infrastructure/adb/shell/AdbShellManager.kt`
  Shell 命令统一入口。

## 关键数据对象

### `ScrcpyOptions`

当前最重要的配置字段包括：

- 标识字段
  - `sessionId`
- 连接字段
  - `host`
  - `port`
- 视频参数
  - `maxSize`
  - `videoBitRate`
  - `maxFps`
  - `keyFrameInterval`
- 音频参数
  - `enableAudio`
  - `audioBitRate`
  - `audioBufferMs`
- 用户手选编解码器
  - `userVideoEncoder`
  - `userAudioEncoder`
  - `userVideoDecoder`
  - `userAudioDecoder`
- 自动检测能力与自动选择结果
  - `deviceSerial`
  - `remoteVideoEncoders`
  - `remoteAudioEncoders`
  - `selectedVideoEncoder`
  - `selectedAudioEncoder`
  - `selectedVideoDecoder`
  - `selectedAudioDecoder`

几个必须知道的方法：

- `isUsbConnection()`
- `getDeviceIdentifier()`
- `getFinalVideoEncoder()`
- `getFinalAudioEncoder()`
- `getFinalVideoDecoder()`
- `getFinalAudioDecoder()`

## 当前项目的重点不在“补全功能表”

从现有能力看，项目已经不是功能空白阶段。

当前更重要的是：

- 把已有能力组织得更清楚
- 让运行时边界更稳定
- 让问题排查路径更直接

因此接下来的工作重点通常不只是“继续加功能”，而是：

- 清理重复状态源
- 清理历史路径
- 让目录结构表达主链路

## 当前最值得关注的稳定性区域

如果从风险角度看，当前最值得重点关注的是：

- USB transport 生命周期
- Wireless Debugging 与 TLS 边界
- metadata 读取时序
- 控制流的发送模型
- 事件系统与运行时状态的职责边界

## 当前运行时中最重要的状态对象

围绕会话，当前至少存在两类核心状态对象：

- `SessionState`
  表达主运行时阶段，例如 `Idle`、`AdbConnecting`、`AdbConnected`、`ServerStarted`、`Connected`、`Reconnecting`、`Failed`。
- `SessionEvent`
  表达过程事实，例如 ADB、server、forward、socket、decoder、cleanup、reconnect 等事件。

后续理解任何问题时，都应先判断它属于“状态”还是“事件”。

## 一句话总结

当前项目的能力面已经较宽，但真正决定后续可维护性的，不是再堆多少功能，而是是否能把这些能力压缩成更清晰、更稳定的主链路。
