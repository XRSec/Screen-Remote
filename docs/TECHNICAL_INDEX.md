# 技术文档索引

## 文档目的

这一页只服务技术文档导航，不包含交接、历史归档或协作流程说明。

如果你的目标是：

- 理解运行时和会话主链路
- 接入某个子系统
- 排查技术问题
- 研究传输、控制流和编解码器策略

优先从这里开始。

## 技术文档分组

### 1. 架构与运行时

目录：

- [02-architecture/README.md](02-architecture/README.md)

推荐阅读：

- [principles.md](02-architecture/principles.md)
- [module-map.md](02-architecture/module-map.md)
- [runtime.md](02-architecture/runtime.md)
- [session-state.md](02-architecture/session-state.md)
- [evolution-plan.md](02-architecture/evolution-plan.md)

适合场景：

- 想先理解会话、状态、事件、目录边界
- 想知道系统后续要往哪里收敛

### 2. 子系统接入

目录：

- [03-guides/README.md](03-guides/README.md)

推荐阅读：

- [event-and-shell.md](03-guides/event-and-shell.md)
- [event-flow.md](03-guides/event-flow.md)
- [session-options.md](03-guides/session-options.md)
- [device-pairing.md](03-guides/device-pairing.md)
- [pairing-and-codec.md](03-guides/pairing-and-codec.md)

适合场景：

- 想接事件、Shell、pairing、配置、编解码器功能

### 3. 排障与分析

目录：

- [04-analysis/README.md](04-analysis/README.md)

推荐阅读：

- [logs-and-signals.md](04-analysis/logs-and-signals.md)
- [troubleshooting.md](04-analysis/troubleshooting.md)
- [metadata-and-codec.md](04-analysis/metadata-and-codec.md)

适合场景：

- 连接失败
- decoder 异常
- metadata 错位
- USB 或 TLS 问题定位

### 4. 技术研究与策略结论

目录：

- [06-research/README.md](06-research/README.md)

推荐阅读：

- [comparison.md](06-research/comparison.md)
- [transport-control-buffer.md](06-research/transport-control-buffer.md)
- [server-socket-control.md](06-research/server-socket-control.md)
- [codec-low-latency-c2.md](06-research/codec-low-latency-c2.md)

适合场景：

- 需要做技术决策
- 想判断是否吸收外部实现经验
- 想分析 buffer、control flow、low latency、C2

## 按任务进入

### 我想先理解整个远控链路

顺序：

1. [runtime.md](02-architecture/runtime.md)
2. [session-state.md](02-architecture/session-state.md)
3. [event-flow.md](03-guides/event-flow.md)
4. [troubleshooting.md](04-analysis/troubleshooting.md)

### 我想修 USB / Wireless Debugging

顺序：

1. [device-pairing.md](03-guides/device-pairing.md)
2. [usb-and-wireless.md](05-handoff/usb-and-wireless.md)
3. [timelines.md](05-handoff/timelines.md)
4. [logs-and-signals.md](04-analysis/logs-and-signals.md)

### 我想修 decoder / codec 相关问题

顺序：

1. [session-options.md](03-guides/session-options.md)
2. [pairing-and-codec.md](03-guides/pairing-and-codec.md)
3. [metadata-and-codec.md](04-analysis/metadata-and-codec.md)
4. [codec-low-latency-c2.md](06-research/codec-low-latency-c2.md)

### 我想评估控制流或传输优化

顺序：

1. [transport-control-buffer.md](06-research/transport-control-buffer.md)
2. [server-socket-control.md](06-research/server-socket-control.md)
3. [comparison.md](06-research/comparison.md)

## 一句话总结

如果把 `docs/` 当成一本书，那么这一页就是技术章节目录，目的是让你直接进入实现、链路和排障，而不是在目录树里自己找入口。
