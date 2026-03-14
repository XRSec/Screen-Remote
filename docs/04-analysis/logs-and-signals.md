# 日志与信号字典

相关文档：

- [排障方法](troubleshooting.md)
- [会话状态与事件](../02-architecture/session-state.md)
- [设备配对与无线调试](../03-guides/device-pairing.md)

## 文档目的

这一篇把常用业务日志标签和排障信号整理成一份字典，减少联调时来回翻旧日志规则。

## 先看什么

排障时优先看业务标签，不要先盯系统底层刷屏日志。

优先级建议如下：

1. `ADBC`
2. `SCLI`
3. `SSVR`
4. `VDEC`
5. `USBC`
6. `ADBP`

## 关键标签说明

### `ADBC`

ADB 连接、验证、命令执行、推送、建链。

看到它时，通常在判断：

- verify 是否通过
- transport 是否可用
- shell 是否可执行

### `ADBP`

Wireless Debugging pairing。

看到它时，通常在判断：

- pairing 是否真正发起
- pairing 成功还是失败

### `USBC`

USB 连接和 detach 相关。

看到它时，通常在判断：

- USB 设备是否断开
- 是否匹配到了正确的 `usb:<serial>`

### `SCLI`

scrcpy 客户端主链路。

看到它时，通常在判断：

- forward 是否建立
- socket 是否连接
- 会话是否推进到下一阶段

### `SSVR`

scrcpy server 输出。

看到它时，通常在判断：

- server 是否真正启动
- server 是否抛出异常或退出

### `VDEC`

视频 metadata、decoder 创建、输出格式变化。

看到它时，通常在判断：

- metadata 是否合理
- decoder 是否建立
- 渲染链路是否进入工作状态

### `RDSP`

渲染 surface 生命周期。

### `SEVT`

事件总线相关日志。

更适合辅助观察，不应单独拿来充当业务真相。

## 典型排查信号

### ADB 阶段

正向信号：

- verify 成功
- shell 输出正常

异常信号：

- verify timeout
- connection unavailable
- handshake failed

### Server 阶段

正向信号：

- push 完成
- server started

异常信号：

- push failed
- startup timeout
- process exited

### Socket 阶段

正向信号：

- video socket connected
- control socket connected
- dummy byte confirmed

异常信号：

- connect failed
- connection lost
- health check failed

### Decoder 阶段

正向信号：

- decoder started
- 输出格式变化正常

异常信号：

- create failed
- runtime error
- metadata 异常

## 默认噪音

通常可以先压低优先级的内容包括：

- Android framework 生命周期噪音
- 厂商 ROM 噪音
- `MediaCodec` / `Codec2` 的大量底层细节

只有在主链路已经定位到媒体层问题时，再去深挖这些日志。

## 三种实际阅读模式

### 模式 1：按主链路看

适合绝大多数问题。

顺序：

- ADB
- forward
- server
- socket
- metadata
- decoder

### 模式 2：按 transport 看

适合 USB 或 TLS 问题。

顺序：

- 权限或 pairing
- transport 建立
- verify
- detach / reconnect

### 模式 3：按媒体看

适合画面有了但体验异常。

顺序：

- metadata
- decoder
- render
- codec 选择

## 一句话总结

日志最重要的不是“看得多”，而是先建立一份稳定的信号字典，知道每个标签在主链路里代表哪一层事实。
