# 排障与分析

## 本目录解决什么问题

这一组文档回答：

- 出问题时应该先看哪条链路
- 哪些日志标签真正有信号
- metadata 与 codec 问题为什么会发生
- 远程 UI 布局分析依赖什么规则和边界

## 阅读顺序

1. [logs-and-signals.md](logs-and-signals.md)
2. [troubleshooting.md](troubleshooting.md)
3. [metadata-and-codec.md](metadata-and-codec.md)
4. [remote-ui-layout-inspector-rules.md](remote-ui-layout-inspector-rules.md)

## 文档分工

- [logs-and-signals.md](logs-and-signals.md)
  业务标签、信号字典、主链路日志优先级。
- [troubleshooting.md](troubleshooting.md)
  一般排障顺序和可执行检查清单。
- [metadata-and-codec.md](metadata-and-codec.md)
  metadata 读取时序、完整读取语义、codec 组合判断。
- [remote-ui-layout-inspector-rules.md](remote-ui-layout-inspector-rules.md)
  远程 UI 布局解析、toggle 识别、覆盖层渲染和已知边界。

## 最适合谁看

- 联调人员
- 排障人员
- 正在定位连接、decoder、metadata、USB/TLS 问题的人
- 正在迭代远程布局分析和页面语义识别的人
