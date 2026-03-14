# 技术研究

## 本目录解决什么问题

这一组文档回答：

- 外部实现有哪些值得吸收的经验
- socket、buffer、control flow 应该怎么理解
- low latency 和 C2 值不值得引入到自动选择策略

## 阅读顺序

1. [comparison.md](comparison.md)
2. [transport-control-buffer.md](transport-control-buffer.md)
3. [server-socket-control.md](server-socket-control.md)
4. [codec-low-latency-c2.md](codec-low-latency-c2.md)

## 文档分工

- [comparison.md](comparison.md)
  总体对比框架和吸收策略。
- [transport-control-buffer.md](transport-control-buffer.md)
  buffer、控制流、传输层的总结合并页。
- [server-socket-control.md](server-socket-control.md)
  server 参数、多 socket、控制流队列与背压细节。
- [codec-low-latency-c2.md](codec-low-latency-c2.md)
  codec 策略、硬件优先、low latency 与 C2 的价值判断。

## 最适合谁看

- 需要做技术决策的人
- 正在评估优化方案的人
- 想从旧 `ScrcpyVS` 研究资料里提炼结论的人
