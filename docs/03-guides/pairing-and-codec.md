# 配对与编解码器配置

相关文档：

- [运行时主链路](../02-architecture/runtime.md)
- [会话配置与更新规则](session-options.md)
- [设备配对与无线调试](device-pairing.md)
- [Metadata 与编解码器分析](../04-analysis/metadata-and-codec.md)
- [USB 与 Wireless Debugging 当前状态](../05-handoff/usb-and-wireless.md)

## Wireless Debugging 的基本流程

配对和连接要分开理解。

### 配对阶段

这一阶段的目标是建立信任关系，需要用户提供：

- IP
- 端口
- 配对码

### 连接阶段

这一阶段的目标是真正建立 ADB 通道。

因此，配对成功只能说明前一阶段完成，不代表后续连接链路一定没问题。

在工程实现上，应把这两段流程拆开记录和观测，否则日志会混成“无线调试失败”这种无法定位的问题。

## 使用配对时应注意什么

1. 用户输入的是配对端口，不一定是后续连接端口。
2. 连接失败时，要先判断是卡在 pairing 还是 connect。
3. Wireless Debugging 不应再依赖固定端口假设。

## 编解码器配置的核心原则

编解码器配置可以概括为三条：

1. 用户选择优先
2. 格式必须匹配
3. 系统负责兜底

这意味着最终使用结果，通常是用户配置和系统检测共同作用的结果。

在代码上，最终选择通过以下方法暴露：

- `getFinalVideoEncoder()`
- `getFinalAudioEncoder()`
- `getFinalVideoDecoder()`
- `getFinalAudioDecoder()`

## 用户字段与能力字段

与编解码器相关的字段，至少要分清两类。

### 用户字段

表示用户主动选择的偏好。

### 能力字段

表示设备或环境实际支持什么。

如果这两类字段混在一起，后续缓存、回显和自动选择都会变得混乱。

典型用户字段：

- `preferredVideoCodec`
- `preferredAudioCodec`
- `userVideoEncoder`
- `userAudioEncoder`
- `userVideoDecoder`
- `userAudioDecoder`

典型能力字段：

- `deviceSerial`
- `remoteVideoEncoders`
- `remoteAudioEncoders`
- `selectedVideoEncoder`
- `selectedAudioEncoder`
- `selectedVideoDecoder`
- `selectedAudioDecoder`

## 缓存策略

编解码器相关缓存存在的意义，是减少重复检测和降低进入成本。

缓存应重点考虑两件事：

- 设备身份是否变化
- 缓存是否过期

一旦设备身份变化，继续复用旧缓存通常是错误的。

设备身份判断的基础应当一致：

- USB 使用统一设备标识
- 网络连接使用 `host:port`

## 开发接入建议

后续新增编解码器相关设置时，建议按这个顺序思考：

1. 这是用户偏好还是设备能力
2. 是否需要持久化
3. 是否需要检测
4. 检测失败时如何兜底
5. 与已选编解码器是否格式兼容

## 技术细节补充

### USB 与网络连接的识别

`ScrcpyOptions` 目前通过 `port == 0` 判断 USB 连接，并通过 `getDeviceIdentifier()` 生成统一设备标识。

### 编码器有效性

远端编码器能力不是永久可信的，至少要结合：

- `deviceSerial`
- 远端编码器列表是否为空

来判断当前检测结果是否可复用。

## 一句话总结

配对问题的关键是分清 pairing 和 connect，编解码器问题的关键是分清用户选择、设备能力和系统兜底，这两类问题本质上都是边界问题。
