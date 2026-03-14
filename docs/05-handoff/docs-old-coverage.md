# docs_old 覆盖情况

相关文档：

- [目标态与迁移计划](../02-architecture/evolution-plan.md)
- [开放问题与后续项](open-issues.md)
- [docs_old 归档说明](../../docs_old/ARCHIVE.md)

## 文档目的

这一篇不是技术说明，而是用于判断：

- `docs_old/` 里哪些内容已经迁入新 `docs/`
- 哪些内容仍然只是部分覆盖
- 哪些内容仍值得暂时保留

## 覆盖判断标准

### 已覆盖

表示新 `docs/` 已经能在当前维护和接手场景下替代旧文档。

### 部分覆盖

表示新 `docs/` 已经吸收了主线内容，但旧文档仍保留更细碎的历史过程、案例或参数细节。

### 仅归档价值

表示旧文档主要保留历史背景，不再是当前默认阅读入口。

## 根目录旧文档评估

| 旧文档 | 当前状态 | 对应新文档 |
|---|---|---|
| `README.md` | 已覆盖 | `01-overview/*` + `docs/README.md` |
| `ARCHITECTURE.md` | 大部分覆盖 | `02-architecture/*` + `07-steering/development.md` |
| `TARGET_ARCHITECTURE.md` | 大部分覆盖 | `02-architecture/evolution-plan.md` |
| `STRUCTURE_REFACTOR.md` | 大部分覆盖 | `02-architecture/module-map.md` + `evolution-plan.md` |
| `Session API.md` | 大部分覆盖 | `03-guides/session-options.md` + `02-architecture/runtime.md` |
| `EVENT_SYSTEM_GUIDE.md` | 已覆盖 | `03-guides/event-and-shell.md` + `event-flow.md` |
| `EVENT_ARCHITECTURE.md` | 已覆盖 | `03-guides/event-flow.md` |
| `SDL_EVENT_FLOW.md` | 已覆盖 | `03-guides/event-flow.md` |
| `SHELL_MANAGER_GUIDE.md` | 已覆盖 | `03-guides/event-and-shell.md` |
| `DEVICE_PAIRING.md` | 已覆盖 | `03-guides/device-pairing.md` |
| `LOG_ANALYSIS_RULES.md` | 已覆盖 | `04-analysis/logs-and-signals.md` + `troubleshooting.md` |
| `METADATA_READ_ISSUE_ANALYSIS.md` | 已覆盖 | `04-analysis/metadata-and-codec.md` |
| `USB_DADB_HANDOFF.md` | 大部分覆盖 | `05-handoff/*` |
| `TODO.md` | 部分覆盖 | `05-handoff/open-issues.md` |
| `编解码器缓存.md` | 部分覆盖 | `03-guides/pairing-and-codec.md` + `04-analysis/metadata-and-codec.md` |
| `编解码器选择逻辑.md` | 大部分覆盖 | `03-guides/session-options.md` + `pairing-and-codec.md` |

## `ScrcpyVS` 旧文档评估

| 旧文档 | 当前状态 | 对应新文档 |
|---|---|---|
| `README.md` | 已覆盖 | `06-research/comparison.md` |
| `SUMMARY.md` | 大部分覆盖 | `06-research/comparison.md` + `transport-control-buffer.md` |
| `01-architecture.md` | 部分覆盖 | `06-research/comparison.md` |
| `02-socket-architecture.md` | 大部分覆盖 | `06-research/server-socket-control.md` |
| `03-parameters-comparison.md` | 部分覆盖 | `06-research/transport-control-buffer.md` |
| `04-socket-buffer-optimization.md` | 大部分覆盖 | `06-research/transport-control-buffer.md` |
| `05-server-startup-parameters.md` | 大部分覆盖 | `06-research/server-socket-control.md` |
| `06-control-flow-comparison.md` | 已覆盖主结论 | `06-research/server-socket-control.md` |
| `07-sdl-event-system.md` | 大部分覆盖 | `03-guides/event-flow.md` |
| `08-parameter-buffer-relationship.md` | 大部分覆盖 | `06-research/transport-control-buffer.md` |
| `09-easycontrol-server-modifications.md` | 部分覆盖 | `06-research/comparison.md` |
| `10-codec-selection-strategy.md` | 大部分覆盖 | `06-research/codec-low-latency-c2.md` |
| `11-low-latency-and-c2-architecture.md` | 大部分覆盖 | `06-research/codec-low-latency-c2.md` |

## 当前仍建议保留 `docs_old/` 的原因

虽然新 `docs/` 已经覆盖了主入口和大部分实用内容，但 `docs_old/` 仍保留一些价值：

- 历史演进痕迹
- 个别详细参数案例
- 更长的研究过程文本
- 旧阶段的决策背景

因此当前更适合把它当作：

- 只读归档

而不是立刻删除。

## 什么时候适合真正删除 `docs_old/`

至少满足两个条件再考虑：

1. 最近一段开发或联调中，没人再需要回看 `docs_old/`
2. 新 `docs/` 已补齐你们实际还会查的剩余细节

## 下一步清理建议

### 第一阶段

继续保留 `docs_old/`，但只作为归档，不再维护内部链接。

### 第二阶段

如果确认新 `docs/` 已足够，可优先删除：

- 明显已被新文档覆盖的旧入口文档
- 旧索引文档
- 旧流程图文档

### 第三阶段

最后再决定是否删除仍保留详细研究过程的旧专题页。

## 一句话总结

当前最稳妥的策略不是立刻删 `docs_old/`，而是用这份覆盖清单持续压缩它的必要性，等新 `docs/` 真正跑过一轮接手和联调后再决定删除。
