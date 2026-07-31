# AI 必读

> 项目路由：`Screen-Remote/` 是 Android 项目，使用本文件规则；`Screen-Remote-macOS/` 是 macOS 项目，使用 `Screen-Remote-macOS/AGENTS.md`规则。

- 不考虑旧版本兼容性问题
- 不要为了兼容旧版本、旧数据结构、旧存储路径或历史行为
- 不要总是跑编译
- 允许使用 ADB 做只读诊断、Logcat、截图、界面层级检查和界面自动化；禁止使用 `adb install`、卸载、清除应用数据或其他 ADB 命令直接安装/替换应用，也不得用 ADB 替代 Android Studio 的编译、安装或正常启动流程。需要安装或验证新版本时，必须通过 Android Studio 运行应用
- scrcpy 的 video、audio、control sockets 必须按顺序建立，不能并发建链
- 所有应用日志、调试日志、事件日志、状态摘要及写入日志的异常信息必须仅使用英文，不得输出中文或中英双语；日志不得通过 `TextPair.get()` 跟随界面语言，必须显式使用英文文本
- 修改 Compose UI、主题、颜色、圆角、尺寸、窗口或共享组件前，必须先阅读并遵守 [UI 设计系统](external/wiki/开发文档-专题-UI-设计.md)；实现以 token 和共享组件为准，并同步检查浅色/深色及受影响页面系列
- 根目录 `README.md` / `README_CN.md` 只负责项目首页介绍、预览与 Wiki 导航；详细项目文档统一维护在 `external/wiki/`。根目录 `docs/` 只允许保留截图等媒体资产，禁止新增或维护 Markdown 文档
- MCP 使用应保持克制，不要因为能力可用就默认调用。目前本项目实际需要的 MCP 能力仅限 Android Studio 运行应用和查看 Logcat；代码检索、文件读取、编辑、重构、终端命令等其他任务使用常规本地工具即可，不要额外调用 MCP
- Android Studio MCP 的固定运行设备为控制端 `10AEAG2YZS0020P`（vivo V2403A）。需要运行应用时，先调用 `get_run_configurations` 获取准确配置名，再按需调用 `execute_run_configuration`；不得用 ADB 命令替代 Android Studio 的编译、安装或正常运行流程
- `build_project` 和 `execute_run_configuration` 仅在任务确实需要验证或用户明确要求运行时调用，不因一般代码修改默认触发
- 本项目确实需要编译并安装应用时，可以调用 Android Studio MCP 的 `execute_run_configuration` 完成；如果 Android Studio MCP 不在线，或运行因非编译问题失败，必须停止并明确提示用户“Android Studio MCP 不在线”，不得改用 ADB 或其他安装方式绕过

## 子代理模型分工

- 当任务中存在边界清晰、风险较低且可独立完成的编码子任务时，优先将这部分工作委派给 `gpt-5.3-codex-spark`，利用其快速、面向编码的特点降低等待时间；不要为了使用子代理而强行拆分任务
- 适合委派的工作包括：代码与文件定位、局部实现调查、单文件或少量文件的机械性修改、补充针对性测试、整理编译或日志错误，以及对明确范围的改动做独立复查
- 委派时必须给出具体目标、允许修改的范围、相关约束和预期交付物；能并行且不会修改同一批文件的子任务可以并行执行
- 主代理必须负责总体方案、跨模块设计、任务拆分、结果整合和最终验证；涉及架构决策、模糊需求、高风险修改、复杂并发或生命周期问题、跨模块重构，以及需要综合判断的疑难问题，不得直接交由 `gpt-5.3-codex-spark` 独立决定
- 涉及 Compose UI、Android Studio 运行、设备操作、发布流程或其他受本文件约束的操作时，子代理同样必须遵守全部项目规则；主代理必须检查其结论和修改，不得未经审查直接采用
