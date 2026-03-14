# 构建与入口

相关文档：

- [项目定位](project.md)
- [当前能力范围](capabilities.md)
- [模块地图](../02-architecture/module-map.md)

## 环境要求

当前项目的主要开发环境要求包括：

- Android Studio Hedgehog+
- JDK 21
- Android SDK 34
- NDK 25.x+
- CMake 3.22+

项目同时依赖 Kotlin/Compose 和 native 构建链，因此本地环境问题经常会表现为：

- Gradle 配置失败
- NDK/CMake 不匹配
- native 相关任务失败

## 最小构建路径

常用构建入口仍然是：

```bash
./gradlew assembleDebug
```

如果只是验证 app 是否能成功编译，这是最直接的入口。

## 运行前需要知道的事

项目运行时不是单纯 UI 启动即可，它依赖多类资源：

- ADB identity / peer storage
- 设备连接条件
- scrcpy server 推送与启动
- socket forward
- 媒体解码环境

因此“能装上 app”不等于“能跑通远控主链路”。

## 推荐的接手阅读顺序

如果第一次接手，建议按下面顺序进入：

1. `01-overview/*`
2. `02-architecture/*`
3. `03-guides/session-options.md`
4. `03-guides/device-pairing.md`
5. `04-analysis/logs-and-signals.md`
6. `05-handoff/*`

这样可以先建立边界，再去看具体接入和排障。

## 常用排查入口

### 构建问题

优先检查：

- JDK 版本
- Android SDK / NDK / CMake 是否齐全
- 本地 external 依赖是否正常

### 连接问题

优先看：

- [运行时主链路](../02-architecture/runtime.md)
- [排障方法](../04-analysis/troubleshooting.md)
- [日志与信号字典](../04-analysis/logs-and-signals.md)

### USB / Wireless Debugging 问题

优先看：

- [USB 与 Wireless Debugging 当前状态](../05-handoff/usb-and-wireless.md)
- [USB 与 TLS 时序](../05-handoff/timelines.md)

## 当前阶段的工作重心

项目当前已经不是“从零搭建”的阶段，而是：

- 收敛运行时边界
- 提高连接稳定性
- 明确 transport / session / decoder 的分层责任
- 让文档能够独立支撑接手和排障

## 一句话总结

当前项目的入门重点不是学会点一个按钮，而是先搭好构建环境，再沿着会话、连接、日志和交接文档理解远控主链路。
