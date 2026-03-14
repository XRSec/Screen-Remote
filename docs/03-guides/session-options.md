# 会话配置与更新规则

相关文档：

- [运行时主链路](../02-architecture/runtime.md)
- [会话状态与事件](../02-architecture/session-state.md)
- [配对与编解码器配置](pairing-and-codec.md)

## 文档目的

这一篇专门解释 `ScrcpyOptions` 和会话配置更新规则。

重点回答：

- 哪些字段是用户字段
- 哪些字段是设备能力字段
- 何时应该更新
- 何时必须重检

## `ScrcpyOptions` 的角色

`ScrcpyOptions` 是当前会话配置的唯一载体。

它不是临时 UI state，也不是运行时资源容器。

它的职责是：

- 描述一次会话希望如何连接和运行
- 保存用户偏好
- 承载连接过程中检测出来的设备能力

## 字段分组

### 标识与连接字段

- `sessionId`
- `host`
- `port`

### 用户配置字段

例如：

- `maxSize`
- `videoBitRate`
- `maxFps`
- `displayId`
- `showTouches`
- `stayAwake`
- `powerOffOnClose`
- `enableAudio`
- `audioBitRate`
- `audioBufferMs`
- `keyFrameInterval`

### 编解码器偏好与用户手选字段

- `preferredVideoCodec`
- `preferredAudioCodec`
- `userVideoEncoder`
- `userAudioEncoder`
- `userVideoDecoder`
- `userAudioDecoder`

### 设备能力与自动选择字段

- `deviceSerial`
- `remoteVideoEncoders`
- `remoteAudioEncoders`
- `selectedVideoEncoder`
- `selectedAudioEncoder`
- `selectedVideoDecoder`
- `selectedAudioDecoder`

## 更新原则

### 用户字段由 UI 改

用户在设置界面中修改的字段，应直接更新 `ScrcpyOptions`。

### 能力字段由连接过程改

设备能力不应由 UI 伪造，而应由连接、检测或探测过程填充。

### 最终使用值通过方法统一读取

不要在业务代码里手写：

- “如果用户选了就用用户的，否则用自动的”

当前应统一通过：

- `getFinalVideoEncoder()`
- `getFinalAudioEncoder()`
- `getFinalVideoDecoder()`
- `getFinalAudioDecoder()`

## 何时需要重新检测

至少遇到以下情况之一时，原能力结果就不应继续直接复用：

1. `deviceSerial` 变化
2. 远端编码器列表为空
3. 用户偏好发生关键改变
4. 已选编码器和解码器格式不再兼容

## 典型场景

### 场景 1：用户全选

如果用户已手选编码器和解码器，系统通常无需再做补齐。

### 场景 2：用户只选编码器

系统必须检查当前解码器是否仍然兼容。

不兼容时，需要重新检测或重新补齐。

### 场景 3：用户只选解码器

系统必须检查编码端是否与其格式一致。

### 场景 4：用户都没选

系统应根据当前能力结果选择默认组合。

## 会话隔离

会话配置最重要的一个约束是：

- 一个会话的配置和能力结果，不应串到另一个会话

因此：

- `sessionId` 用于会话标识
- `deviceSerial` 或 `deviceIdentifier` 用于设备身份判断

这两个维度都不能丢。

## 一句话总结

会话配置真正稳定的前提，是把用户偏好、设备能力和最终使用值三层分开，而不是把所有字段都当成同一种“当前值”。
