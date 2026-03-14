# 接入指南

## 本目录解决什么问题

这一组文档回答：

- 某个子系统应该怎么接
- 新功能接入时先看哪几层
- 事件、Shell、pairing、配置、编解码器各自怎么理解

## 阅读顺序

1. [event-and-shell.md](event-and-shell.md)
2. [event-flow.md](event-flow.md)
3. [adb-connection-lifecycle.md](adb-connection-lifecycle.md)
4. [session-options.md](session-options.md)
5. [device-pairing.md](device-pairing.md)
6. [pairing-and-codec.md](pairing-and-codec.md)

## 文档分工

- [event-and-shell.md](event-and-shell.md)
  事件总线和 Shell 管理器的接入边界。
- [event-flow.md](event-flow.md)
  事件流、采样、监控器、日志器如何协同。
- [adb-connection-lifecycle.md](adb-connection-lifecycle.md)
  ADB 连接、重连、保活与 `delayed_ack` 的当前机制。
- [session-options.md](session-options.md)
  `ScrcpyOptions` 字段分层和更新规则。
- [device-pairing.md](device-pairing.md)
  Wireless Debugging pairing 入口、阶段划分与失败判断。
- [pairing-and-codec.md](pairing-and-codec.md)
  pairing 与编解码器配置的联合视角。

## 最适合谁看

- 功能开发者
- UI/配置接入开发者
- 需要接入事件、Shell 或 pairing 的人
