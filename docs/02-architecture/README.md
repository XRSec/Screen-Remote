# 架构文档

## 本目录解决什么问题

这一组文档回答：

- 系统现在按什么边界组织
- 会话运行时如何理解
- 主状态、事件、资源如何分层
- 目录结构应该继续往哪里收敛

## 阅读顺序

1. [principles.md](principles.md)
2. [module-map.md](module-map.md)
3. [runtime.md](runtime.md)
4. [session-state.md](session-state.md)
5. [evolution-plan.md](evolution-plan.md)

## 文档分工

- [principles.md](principles.md)
  架构原则、唯一事实源、会话边界、目录职责。
- [module-map.md](module-map.md)
  代码层级和目录职责地图。
- [runtime.md](runtime.md)
  ADB 到 socket 到 decoder 的运行时主链路。
- [session-state.md](session-state.md)
  `SessionState`、`SessionEvent`、组件快照与 issue 模型。
- [evolution-plan.md](evolution-plan.md)
  目标态和后续迁移阶段。

## 最适合谁看

- 新接手项目的人
- 要改会话运行时的人
- 要做目录或边界收敛的人
