# 设备配对与无线调试

相关文档：

- [配对与编解码器配置](pairing-and-codec.md)
- [USB 与 Wireless Debugging 当前状态](../05-handoff/usb-and-wireless.md)
- [USB 与 TLS 时序](../05-handoff/timelines.md)

## 文档目的

这一篇只讲无线调试配对，不混入编解码器和运行时主线。

重点包括：

- 用户操作流程
- 代码入口
- 失败时如何判断卡在哪个阶段

## 用户侧流程

### 被控设备侧

1. 打开开发者选项
2. 打开无线调试
3. 进入“使用配对码配对设备”
4. 记录：
   - IP 地址
   - 端口
   - 配对码

### 控制端 app 侧

1. 进入配对入口
2. 输入 IP、端口、配对码
3. 发起 pairing
4. pairing 成功后，再进行真正 connect

## 关键实现入口

当前配对主入口是：

- `AdbPairingManager.pairWithCode(ipAddress, port, pairingCode)`

它内部做的事情很明确：

1. 检查 Android 版本是否至少为 Android 11
2. 从 `AdbRuntimeProvider` 取得 `AdbRuntime`
3. 调用 `adbRuntime.pairWithCode(...)`
4. 记录成功或失败日志

这意味着：

- app 层不直接实现 pairing 传输协议
- pairing 底层细节已经下沉到 dadb runtime

## `AdbRuntime` 在配对中的角色

当前 `AdbRuntime` 承担的是 runtime scope 控制器角色，负责：

- 加载或创建 key pair
- 执行 pairing
- 记录 peer 材料
- 后续支持 TLS connect

它不是单次会话对象，也不是 UI 状态对象。

## 失败时的判断方式

无线调试失败时，先问：

### 是 pairing 失败，还是 connect 失败

这两个阶段不能混。

### pairing 失败常见原因

- Android 版本过低
- IP/端口错误
- 配对码已失效
- 设备侧无线调试界面过期

### connect 失败常见原因

- pairing 材料已存在，但 TLS connect 没有成功
- peer pin / trust 状态不一致
- 连接的是错误端口

## 排查时看哪些日志

优先看：

- `ADBP`
  pairing 相关日志
- `ADBC`
  连接验证和 network dadb 建链

## 一个实用判断

如果看到：

- pairing 已成功
- 但后续 `verifyDadb` 或 `createNetworkDadb` 失败

那就不要继续怀疑 pairing 输入，而应转去排查 connect 和 TLS 阶段。

## 一句话总结

无线调试链路里最重要的不是“怎么输配对码”，而是始终把 pairing 和 connect 当成两个不同阶段来记录、诊断和维护。
