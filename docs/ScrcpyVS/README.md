# Scrcpy 架构对比分析

本目录包含 scrcpy-mobile-ios、Easycontrol 和本地项目的深度对比分析。

## 文档索引

1. **[01-architecture.md](./01-architecture.md)** - 代码分层架构
   - scrcpy-mobile-ios 项目结构
   - Socket 逻辑归属
   - ADB 逻辑归属
   - 编译流程

2. **[02-socket-architecture.md](./02-socket-architecture.md)** - Socket 架构分析
   - 3 路 Socket 设计
   - 连接顺序和模式
   - Socket 优化设置
   - 数据流处理

3. **[03-parameters-comparison.md](./03-parameters-comparison.md)** - 参数对比
   - Socket 缓冲区设置
   - 启动参数配置
   - 超时和重连机制
   - 音频缓冲策略

4. **[04-socket-buffer-optimization.md](./04-socket-buffer-optimization.md)** - Socket 缓冲优化
   - 本地项目现状分析
   - 缺失的优化项
   - 优化方案实施

5. **[05-server-startup-parameters.md](./05-server-startup-parameters.md)** - Server 启动参数完整对比
   - scrcpy-mobile-ios 完整启动命令
   - Easycontrol 完整启动命令
   - Socket 缓冲参数详解
   - 视频渲染参数详解
   - 控制流参数详解
   - 连接重试机制对比

6. **[06-control-flow-comparison.md](./06-control-flow-comparison.md)** - 控制流对比
   - 消息队列机制
   - 独立发送线程
   - 本地项目问题分析
   - 优化方案建议

7. **[07-sdl-event-system.md](./07-sdl-event-system.md)** - SDL 事件系统详解
   - SDL 事件系统作用
   - 事件类型和循环机制
   - 跨线程通信
   - 使用场景分析

8. **[08-parameter-buffer-relationship.md](./08-parameter-buffer-relationship.md)** - 参数与缓冲关系分析
   - Socket 缓冲是否动态调整
   - 音频缓冲自动计算逻辑
   - 视频缓冲配置原则
   - 参数变化的实际影响

9. **[SUMMARY.md](./SUMMARY.md)** - 完整对比总结
   - 三方架构对比表
   - 性能指标对比
   - 实施建议

## 快速导航

### 按主题查找

- **架构设计**: 01-architecture.md, 02-socket-architecture.md
- **性能优化**: 03-parameters-comparison.md, 04-socket-buffer-optimization.md
- **参数配置**: 05-server-startup-parameters.md
- **控制流**: 06-control-flow-comparison.md
- **完整对比**: SUMMARY.md

### 按项目查找

- **scrcpy-mobile-ios**: 所有文档
- **Easycontrol**: 03-parameters-comparison.md, 05-server-startup-parameters.md
- **本地项目**: 04-socket-buffer-optimization.md, 06-control-flow-comparison.md

## 关键发现

### scrcpy 原生的核心优势

1. **三路 Socket 分离** - 视频、音频、控制完全独立
2. **TCP_NODELAY 优化** - 控制流低延迟（< 10ms）
3. **MSG_WAITALL 接收** - 保证数据完整性
4. **消息队列机制** - 60 条限制 + 异步解耦 + 背压控制
5. **64KB Socket 缓冲** - 减少系统调用
6. **delay_buffer 机制** - 33ms 视频缓冲 + 时钟同步
7. **连接重试** - 100×100ms socket + 20×3s adb

### 本地项目需要改进

1. ✅ **已完成**: Socket 缓冲区优化（64KB）
2. ⏳ **待实施**: 控制流消息队列（Channel<ByteArray>(60)）
3. ⏳ **待实施**: 消息丢弃策略（触摸移动可丢弃）
4. ⏳ **待实施**: 专用发送协程
5. ⏳ **可选**: 视频缓冲机制（delay_buffer）

## 更新日志

- 2026-01-31: 完成 Socket 缓冲区优化
- 2026-01-31: 完成完整参数对比分析
- 2026-01-31: 文档重命名整理
