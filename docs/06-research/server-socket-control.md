# Server、Socket 与控制流细节

相关文档：

- [外部实现对比结论](comparison.md)
- [传输、控制流与缓冲结论](transport-control-buffer.md)
- [运行时主链路](../02-architecture/runtime.md)

## 文档目的

这一篇补的是更细的底层研究结论，重点解释：

- server 启动参数的意义
- 多 socket 结构为什么重要
- 控制流为什么需要队列与背压

## 多 socket 结构

稳定实现通常使用三条独立 socket：

- `video_socket`
- `audio_socket`
- `control_socket`

这样做的核心收益是：

- 视频、音频、控制互不阻塞
- 控制流不会被大视频帧拖慢
- 音频可以独立启停

## 连接顺序

多 socket 模型下，连接顺序本身就是协议的一部分。

典型顺序是：

1. `video`
2. `audio`
3. `control`

如果顺序混乱，或者客户端在 socket 未连齐时就提前读数据，会导致：

- server 端 accept 阶段阻塞
- metadata 读取错位
- control 或 audio 长时间不建立

## server 启动参数的工程意义

常见启动参数包括：

- `scid`
- `log_level`
- `video_bit_rate`
- `audio_bit_rate`
- `max_size`
- `max_fps`
- `video_codec`
- `audio_codec`
- `control`
- `tunnel_forward`

这些参数可以按三类理解：

### 会话标识与调试

- `scid`
- `log_level`

### 媒体与性能

- `video_bit_rate`
- `audio_bit_rate`
- `max_size`
- `max_fps`
- `video_codec`
- `audio_codec`

### 链路控制

- `control`
- `tunnel_forward`

## 参数变化的正确理解

这些参数并不是都直接影响 socket buffer。

更准确的理解是：

- 码率、分辨率、帧率主要影响编码和媒体链路压力
- 是否启用 control 影响控制流通道
- `tunnel_forward` 影响建链模式

## socket 接收语义

稳定实现往往强调“完整接收”语义，而不是假设一次 `recv` 就足够。

这类语义的价值是：

- 降低半包和错位读取风险
- 让 metadata、packet header、payload 的边界更稳定

这也是为什么本地项目在 metadata 读取问题上，后续重点转向：

- 完整读取
- 明确时序
- 明确字段边界

## 控制流为什么不能只靠直接发送

控制流与视频流不同：

- 数据包更小
- 对时延更敏感
- 用户操作常常是突发高频

如果只做“拿到消息就直接写 socket”，会遇到三个问题：

1. 高频触摸事件可能迅速堆积
2. 关键消息和可丢弃消息没有区分
3. 发送阻塞会反向拖累上层调用者

## 稳定控制流模型的三个要素

### 1. 独立发送执行单元

可以是线程，也可以是专用协程消费循环。

重点是：

- 不要每个输入事件都直接抢占发送路径

### 2. 有界消息队列

无界队列很容易把瞬时输入峰值放大成后续延迟。

### 3. 可丢弃消息策略

例如连续触摸移动事件，不一定每一条都必须送达。

而以下消息通常不应丢弃：

- 剪贴板
- 关键按键
- 设备控制语义

## 当前项目的启示

当前项目在 socket 模型上已经部分对齐：

- 三路 socket
- `TCP_NODELAY`
- 固定 64KB 缓冲
- dummy byte 验证

但在控制流上，仍值得继续往更稳定的模型收敛：

- 更清晰的消息队列
- 更明确的背压策略
- 更清晰的“可丢弃 / 不可丢弃”分类

## 一句话总结

server、socket 和控制流这三件事的关键，不是参数越多越好，而是让链路顺序、完整读取和控制背压都足够稳定。
