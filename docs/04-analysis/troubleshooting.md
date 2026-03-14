# 排障方法

相关文档：

- [运行时主链路](../02-architecture/runtime.md)
- [事件系统与 Shell 接入](../03-guides/event-and-shell.md)
- [日志与信号字典](logs-and-signals.md)
- [USB 与 Wireless Debugging 当前状态](../05-handoff/usb-and-wireless.md)

## 排障原则

遇到远控问题时，先还原主链路，再下钻细节。

不要一开始就盯着底层日志或单个异常字符串，因为那样很容易被噪音带偏。

## 推荐排查顺序

### 1. 先看配置

先确认：

- 当前会话是否正确
- 关键连接参数是否正确
- 编解码器选择是否明显冲突

### 2. 再看连接

确认：

- ADB 是否建立
- verify 是否通过
- forward 是否建立

### 3. 再看 server

确认：

- server 是否真正启动
- 是否已有 server 输出

### 4. 再看 socket

确认：

- video 是否连接
- audio 是否连接
- control 是否连接

### 5. 再看 metadata 与 decoder

确认：

- metadata 是否读取正确
- decoder 是否创建成功
- 渲染链路是否完整

### 6. 最后看 UI 和交互层

只有在前面都正常时，再去判断是不是展示层或控件层问题。

## 日志阅读方法

日志应优先看业务标签，而不是先看系统底层刷屏信息。

先看能够表达主链路的日志，再看底层细节。

重点不是“哪条日志最显眼”，而是“哪一步不再向前推进”。

建议优先关注的业务标签包括：

- `ADBC`
  ADB 建链、命令执行、推送和验证。
- `SCLI`
  scrcpy 客户端会话状态、forward、socket 连接。
- `SSVR`
  server 侧输出。
- `VDEC`
  视频 metadata、decoder 创建、格式变化。
- `RDSP`
  渲染 surface 生命周期。

如果这些标签已经能定位问题，不要过早下钻到 `MediaCodec` 或 `Codec2` 的底层刷屏日志。

## USB 场景的附加排查项

USB 问题比普通网络连接更容易因为 transport 生命周期而复杂化，因此要额外检查：

1. 当前 transport 是否已失效
2. 连接池中是否残留坏连接
3. 是否错误沿用了 TCP/IP 重连逻辑
4. 这次断开到底是用户主动结束，还是物理失联

和 USB 相关的关键代码落点包括：

- `AdbConnectionManager`
- `AdbConnectionConnector`
- `SocketForwarder`
- `ScrcpyServiceHeartbeatMonitor`

## 事件与监控的使用方式

在排障时，事件和监控很有价值，但要注意它们的角色。

正确用法：

- 用来还原发生过什么
- 用来定位哪一步失败
- 用来补充时序信息

错误用法：

- 仅凭监控投影推断业务真相
- 把日志文案本身当作唯一事实源

## 一条可执行的排查清单

当一次连接失败时，可以按这个顺序核对：

1. `SessionState` 最后停在哪个状态
2. 最后一个关键 `SessionEvent` 是什么
3. 是否出现 `ForwardSetup` 或 `ForwardFailed`
4. 是否出现 `SocketConnecting` 但没有后续 `SocketConnected`
5. video socket dummy byte 是否确认
6. metadata 是否已读到合理 codec id 和分辨率
7. decoder 是否发出 `DecoderStarted` 或 `DecoderError`

## 一句话总结

排障最有效的方式，是按“配置、连接、server、socket、metadata、decoder、UI”这条顺序逐层排除，而不是直接跳进最底层细节里猜问题。
