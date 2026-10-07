# Screen Remote Desktop 开发规范与准则

本文件适用于 `Screen-Remote-desktop/` 目录及其所有子文件。

## UI 与交互设计红线（核心原则）

1. **严禁基于 `Screen-Remote-macOS` 进行主观“创意美化”或过度拟态**：
   - 不得以 `Screen-Remote-macOS` 为视觉蓝本强行将 macOS 风格（如拟原生硬件边框 Bezel、仿 SwiftUI 视觉滤镜、多余的装饰性下巴 Chin、过度拟态的 Preference 布局等）移植到桌面端。
   - 坚决杜绝“为了美化而美化”的主观创意发挥，拒绝画蛇添足的装饰性元素。

2. **立足桌面端（Tauri + React）自身的简洁与实用性**：
   - 保持现代桌面端纯粹、克制、高可用、功能优先的 UI 设计语言。
   - 界面布局与控件严格以**功能可用性、画面低延迟显示、操作高效性**为第一指标。
   - 一切 UI 调整必须严格遵循用户给出的具体明确需求或功能逻辑演进，不随意自行重构视觉样式。

## 平台逻辑与跨端参考边界

- **核心协议与会话参考**：仅在 ADB 协议、设备通讯、scrcpy 流媒体解码控制、会话生命周期等核心底层逻辑上，参考 Android (`Screen-Remote`)、macOS (`Screen-Remote-macOS`) 或 `external/dadb` / `external/scrcpy` 的契约规范。
- **UI 与视图实现独立**：桌面端 UI、窗口管理、组件状态和用户配置完全遵循自身 Web/Tauri 技术栈与交互规范，不强求也不应搞“视觉 1:1 复刻”。
