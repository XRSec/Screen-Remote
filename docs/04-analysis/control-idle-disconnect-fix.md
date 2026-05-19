# Control Idle Disconnect Fix

## 现象

- 连接建立后，用户持续操作时会话正常
- 用户停止操作一段时间后，远端画面冻结，控制失效
- `scrcpy_server` 最终正常退出，日志表现为：
  - `Controller stopped`
  - `Device message sender stopped`
  - `Screen streaming stopped`
  - `Server process exited: 0`

## 根因

本项目的 Android 客户端使用自定义 `SocketForwarder` + `dadb.open(localabstract:...)` 建立 scrcpy 的 `video/control` 通道。

诊断日志表明：

- `ADB` 心跳持续正常，说明不是整条 ADB 连接断开
- 空闲场景下，`control` 对应的 `adb->client` 方向先出现 EOF
- 原版 scrcpy server 中，控制线程结束会被视为致命结束，随后 server 进入统一清理并退出

因此问题本质是：

`control channel` 在空闲时被底层链路关闭，进而触发整个 `scrcpy_server` 正常退出。

## 修复

在 [ScrcpyController.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/infrastructure/scrcpy/controller/feature/scrcpy/ScrcpyController.kt) 中增加 control keepalive：

- 当控制通道空闲超过 `CONTROL_KEEPALIVE_INTERVAL_MS` 时
- 发送一个“空文本注入”控制包
- 该包不产生实际输入效果，也不要求服务端回包

协议构造由 [ScrcpyProtocol.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/infrastructure/scrcpy/protocol/feature/scrcpy/ScrcpyProtocol.kt) 统一提供：

- `createEmptyTextControlMessage()`

## 为什么不用重连

这次修复针对的是根因前置预防，而不是断后恢复。

如果 control channel 空闲就被关闭，那么把问题交给重连只会变成“稳定空闲断，再稳定重连”。先保住 control 通道更合理，也更不打扰现有重连状态机。
