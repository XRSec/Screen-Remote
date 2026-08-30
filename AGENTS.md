# Screen Remote 聚合仓库导航

本仓库 `XRSec/Screen-Remote` 是公开的 Android 项目首页与聚合工作区。它负责公开介绍、发布入口、平台仓库和外部参考项目的子模块指针，以及少量跨平台工具；Android 闭源实现位于 `Screen-Remote/`，macOS 开源实现位于 `Screen-Remote-macOS/`。平台业务规则不在本文件重复维护。

## 规则路由

进入子目录工作时，以路径上最近的 `AGENTS.md` 为准：

- `Screen-Remote/**`：Android 私有源码仓库，读取 `Screen-Remote/AGENTS.md`。
- `Screen-Remote-macOS/**`：macOS 开源源码仓库，读取 `Screen-Remote-macOS/AGENTS.md`。
- `external/wiki-android/**`：Android GitHub Wiki 独立仓库；遵守其中的文档维护规则。
- `external/wiki-macos/**`：macOS GitHub Wiki 独立仓库；遵守其首页、侧栏和双语配对约定。
- `external/**`：先读取对应项目自己的 `AGENTS.md` 或 README；没有局部规则时默认只读参考。
- `tools/**`、`scripts/**`、`.github/**`、根 `Makefile`：属于聚合仓库，修改时只处理子模块协调、公开发布或跨平台工具职责。

不要把根文件中的导航规则当成 Android Studio、Xcode、ADB、SwiftUI、Compose 或 scrcpy 实现规则；这些约束由各平台文件维护。

## 文档所有权

- 根 `README.md` / `README_CN.md`：公开 Android 项目介绍、预览、下载与 Wiki 导航。
- `docs/`：公开首页媒体、根仓库发布资料及明确的跨平台契约；不要在这里新增平台实现专题。
- `external/wiki-android/`：Android 用户文档、开发文档、Compose 设计系统与 Android 调试说明。
- `external/wiki-macos/`：macOS 用户文档、SwiftUI 设计系统、原生 scrcpy 管线、Xcode 构建与发布说明。
- `Screen-Remote-macOS/README.md`：macOS 开源仓库首页；详细内容链接到 macOS Wiki。

跨平台协议若同时被 Android 和 macOS 消费，在根 `docs/contracts/` 维护稳定契约；两个 Wiki 只解释各自平台如何实现和验证，不复制一份容易漂移的协议正文。

## Git 与子模块边界

- 根仓库、Android、macOS、dadb、两个 Wiki 和每个 `external/` 子模块都是独立 Git 仓库。
- 修改子仓库源码与更新根仓库的 gitlink 指针是两个独立提交边界；不得把多个仓库描述成一个提交。
- 开始前分别检查受影响仓库的状态，保留用户已有修改，不得 reset、checkout、clean 或覆盖未知文件。
- 不要在一次任务中顺手更新无关子模块。跨平台协议变化必须分别检查 Android 与 macOS 消费方。
- `external/` 默认只读；只有任务明确属于该项目或共享依赖边界时才修改其源码。

## `external/` 项目用途

### 活跃共享基础设施

- `dadb/`：Screen Remote 维护和扩展的 ADB transport、认证、stream、forward、remote helper 与设备操作基础；平台 UI、窗口和 scrcpy 会话编排不放入 dadb。

### 上游协议与 ADB 实现参考

- `scrcpy/`：官方 scrcpy server、协议、socket、控制消息和音视频格式的权威上游。
- `Kadb/`、`libadb-android/`：ADB 连接、认证、transport 与 Android 设备操作实现参考。

### Android 远程控制参考

- `Easycontrol/`、`ScrcpyForAndroid/`、`ScrcpyForAndroid-Miuzarte/`、`ScrcpyForAndroid-aaxianyu/`：Android 端远程控制、scrcpy 接入、交互与功能实现参考。

### macOS、桌面与跨设备参考

- `AndroLaunch/`：桌面端 Android 设备、ADB/scrcpy 工具与依赖引导参考。
- `KonnectMac/`：原生 macOS 后台协调、菜单栏与伴侣式设备交互参考。
- `scrcpy-mask/`：原生 scrcpy 媒体、控制、输入映射与多窗口行为参考；不得把其 server 扩展当成官方协议。
- `Sefirah/`：桌面/Android 通知、文件、同步与 scrcpy 整合参考。

### iOS 可行性参考

- `adb-mobile-ios/`、`screen-remote-ios/`：移动端 ADB、scrcpy 与 iOS 平台可行性研究，不代表当前 Android 或 macOS 的运行时依赖。

### 文档与独立服务

- `wiki-android/`：`XRSec/Screen-Remote.wiki.git`，只维护 Android 文档。
- `wiki-macos/`：`XRSec/Screen-Remote-macOS.wiki.git`，只维护 macOS 文档。
- `screen-remote-telemetry/`：被根仓库忽略的独立遥测服务工作树，使用其自身 `AGENTS.md`，不是根仓库 gitlink。
- `dadb_patch.md`、`dadb_usb.patch`：根仓库保存的补丁资料，不是子模块。

除 `dadb` 和明确声明的构建依赖外，上述项目通常只是上游或产品参考。修改外部源码、在外部仓库提交、以及在根仓库更新子模块指针必须分别说明。
