# macOS 仓库开发者说明

本文面向需要最小工作集的 macOS 开发者。

## 仓库模型

公开的 `Screen-Remote` 是聚合仓库。原生 macOS 应用位于独立的 `Screen-Remote-macOS/` Git
子模块。

```text
Screen-Remote/                 聚合/公开仓库
├── Screen-Remote/             Android 源码仓库（ADB/会话语义参考）
├── Screen-Remote-macOS/       原生 SwiftUI/macOS 源码仓库
├── external/
│   ├── dadb/                  共享 ADB 传输与 helper 基础
│   ├── wiki-macos/            macOS 用户与开发文档
│   ├── wiki-android/          Android 文档
│   └── ...                    上游/参考项目，通常只读
├── docs/                      公开文档与跨平台契约
└── tools/、scripts/、Makefile 聚合仓库工具
```

macOS 应用使用 `external/dadb` 提供共享 ADB 语义；原生生命周期、窗口、SwiftUI、持久化、
媒体渲染和 scrcpy 编排保留在 `Screen-Remote-macOS/`。

## 最小克隆方式

只做 macOS 开发时：

```bash
git clone git@github.com:XRSec/Screen-Remote.git
cd Screen-Remote
git submodule update --init Screen-Remote-macOS external/dadb
```

最小结构是：

```text
Screen-Remote/
├── Screen-Remote-macOS/ # 原生 macOS 源码
└── external/dadb/       # 共享 ADB 基础
```

大多数原生 UI 工作不需要 Android 源码；只有修改或核对 ADB/会话语义时才需要
`Screen-Remote/`。

完整聚合工作区：

```bash
git clone --recurse-submodules git@github.com:XRSec/Screen-Remote.git
cd Screen-Remote
git submodule update --init --recursive
```

## 工作边界

- macOS 代码修改放在 `Screen-Remote-macOS/` 内。
- 明确需要更新 Wiki 时，macOS 文档放在 `external/wiki-macos/`。
- 使用 `Screen-Remote/` 作为 ADB 和远程会话语义参考；macOS-only 任务不要修改它。
- 只有确实被两个平台共享的 ADB 传输、helper 和设备操作行为，才放入 `external/dadb/`。
- 稳定的跨平台契约放在根仓库 `docs/contracts/`。
- macOS 仓库提交与根仓库更新 gitlink 是两个独立提交。

编辑前分别检查：

```bash
git status --short --branch
git -C Screen-Remote-macOS status --short --branch
git -C external/dadb status --short --branch
```

保留已有修改；不要使用 `reset`、`clean`，也不要顺手更新无关子模块。

## macOS 代码地图

```text
Screen-Remote-macOS/Screen-Remote/
├── App/                   应用入口、根导航、侧栏
├── Core/                  模型、进程支持、状态、设计系统
├── Features/              设备、屏幕、应用、管理、设置、工具等功能
├── Platform/              macOS 兼容层与平台行为
├── Resources/             资源与 String Catalog 本地化
└── Services/              ADB、持久化、Android 工具链、scrcpy 会话/媒体
```

原生屏幕链路是：设备发现/ADB → scrcpy server → 有序的 `video`、可选 `audio`、`control`
socket → H.264/VideoToolbox 渲染与会话状态。

开始实现、审查或验证前，先阅读 `Screen-Remote-macOS/AGENTS.md` 和 macOS engineering skill。
