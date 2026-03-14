# ADB 连接生命周期

## 当前目标

当前工程把 ADB 相关职责收敛成三层：

- ADB 连接建立与复用
- scrcpy 运行时健康监控
- app 前台服务的 ADB 保活与重建

这三层都存在，但职责已经拆开：

- scrcpy 只负责自己的 socket 健康和会话重连
- 前台服务只负责“需要保活的设备”的 ADB 心跳与 ADB 重建
- `AdbConnectionManager` 不再维护额外的 30 秒全局 keepalive

## 谁负责什么

### 1. `AdbConnectionManager`

文件：

- [AdbConnectionManager.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/infrastructure/adb/connection/AdbConnectionManager.kt)
- [AdbConnectionConnector.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/infrastructure/adb/connection/AdbConnectionConnector.kt)

职责：

- 作为 ADB 统一入口
- 管理 registry 中的当前连接
- 负责 TCP / USB 建链
- 负责同一设备 connect/disconnect 的互斥锁
- 负责 USB detach 事件收口

它当前不再主动跑一套独立的全局 keepalive。

### 2. scrcpy 健康监控

文件：

- [ConnectionHealthMonitor.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/infrastructure/scrcpy/connection/ConnectionHealthMonitor.kt)
- [ScrcpyConstants.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/common/constants/ScrcpyConstants.kt)

职责：

- 监控 `video / control / audio` socket
- 检测 scrcpy 数据面是否断开
- 默认 3 秒一次

它监控的是 scrcpy 会话，不是整条 ADB 命令链路。

### 3. app 前台服务 ADB 心跳

文件：

- [ScrcpyForegroundService.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/service/ScrcpyForegroundService.kt)
- [ScrcpyServiceHeartbeatMonitor.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/service/ScrcpyServiceHeartbeatMonitor.kt)

职责：

- 维护“被保护设备”的 ADB 心跳
- 默认 15 秒一次
- 当连接失效时，按登记的 `delayed_ack` 目标重建 ADB

它是当前唯一的 ADB 自动重建者。

## `delayed_ack` 怎么判断

`delayed_ack` 是否开启，不是从日志文本猜的，而是在建连时写进 `AdbConnection`。

文件：

- [AdbConnectionConnector.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/infrastructure/adb/connection/AdbConnectionConnector.kt)
- [AdbConnection.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/infrastructure/adb/connection/AdbConnection.kt)

规则：

- 请求建连时传入 `withDelayedAck`
- 设备对端也支持 `delayed_ack`
- 两者同时满足，当前 `AdbConnection.supportsDelayedAck()` 才为 `true`

当前约定：

- scrcpy 连接目标是 `false`
- management 连接目标是 `true`

共享复用层会先检查：

- 现有连接是否可用
- 现有连接的 `supportsDelayedAck()` 是否与本次请求一致

如果不一致，就断旧连再重建，而不是盲复用。

## scrcpy 与 management 的关系

当前实现不是“双连接并存”，而是“同一个设备槽位的接管与切换”。

表现为：

- scrcpy 请求 `false`
- management 请求 `true`
- 如果当前连接画像不匹配，就断开并重建

这意味着它们在业务语义上不会继续共用同一条“有效配置一致”的 ADB。

## 保活如何知道该用哪种 `delayed_ack`

前台服务当前为每个被保护设备记录：

- `deviceId`
- `deviceName`
- `delayedAck`

文件：

- [ScrcpyForegroundService.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/service/ScrcpyForegroundService.kt)

来源：

- scrcpy 连接成功后注册 `delayedAck=false`
- management 连接成功后注册 `delayedAck=true`

所以保活线程不会再自己猜“默认 false 还是 true”，而是按这台设备当前登记的目标值去重建。

## 当前已收掉的历史问题

### 1. 多余的 30 秒 `AdbConnectionKeepAlive`

旧实现里，`AdbConnectionManager` 还有一套本地 30 秒 keepalive。

它的问题是：

- 与前台服务的 15 秒 ADB 心跳职责重叠
- 会让人误以为有两套 ADB 重建逻辑
- 对 `delayed_ack` 画像不敏感

当前已经移除。

### 2. 复用层只看 verify，不看 `delayed_ack`

旧实现里，连接复用会直接复用已有连接，只要 verify 成功。

这会导致：

- management 可能复用 scrcpy 的 `false`
- scrcpy 可能复用 management 的 `true`

当前已改为：复用前先比较 `supportsDelayedAck()` 是否与请求一致。

### 3. 编码器检测临时连接不清理

文件：

- [EncoderSelectionDialog.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/codec/component/EncoderSelectionDialog.kt)

当前实现已经补上：

- 如果编码器检测是自己临时建的 ADB
- 检测完成后会显式 `disconnectDevice()`

这样临时连接不会再残留到 registry。

## 当前仍需知道的行为

management 页面返回时，当前 UI 只是关闭页面，不会自动调用 `disconnectManagementDevice()`。

这意味着：

- management ADB 可以继续被前台服务保活
- 后续如果 scrcpy 接管，会按 `delayed_ack` 不匹配规则替换掉它

这目前更像“保留连接”的产品行为，而不是连接链路 bug。

如果后续产品希望“退出 management 页面就释放 ADB”，再把页面返回动作接到 `disconnectManagementDevice()` 即可。

## 一句话总结

当前连接机制已经收敛成：

- scrcpy 监控 scrcpy
- 前台服务保活 ADB
- `AdbConnectionManager` 负责建链、复用和互斥
- `delayed_ack` 作为连接画像在建连时确定，并在复用与保活重建时被严格遵守
