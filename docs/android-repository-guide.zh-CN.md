# Android 仓库开发者说明

本文面向需要最小工作集的 Android 开发者。

## 仓库模型

公开的 `Screen-Remote` 是聚合仓库。Android 应用源码位于嵌套的 `Screen-Remote/` Git 子模块，
不是根仓库本身。

```text
Screen-Remote/                 聚合/公开仓库
├── Screen-Remote/             Android 源码仓库
├── Screen-Remote-macOS/       macOS 源码仓库（Android-only 不需要）
├── external/
│   ├── dadb/                  共享 ADB 传输与设备操作依赖
│   ├── wiki-android/          Android 用户与开发文档
│   ├── wiki-macos/            macOS 文档
│   └── ...                    上游/参考项目，通常只读
├── docs/                      公开文档与跨平台契约
└── tools/、scripts/、Makefile 聚合仓库工具
```

`Screen-Remote/app/` 是 Android Gradle 模块。它通过 composite build 引入 `../external/dadb`，
因此编译时 `external/dadb` 必须与 Android 源码目录处于同一个聚合根目录下。

## 最小克隆方式

如果你拥有私有 Android 源码仓库的权限：

```bash
git clone git@github.com:XRSec/Screen-Remote.git
cd Screen-Remote
git submodule update --init Screen-Remote external/dadb
```

最小结构是：

```text
Screen-Remote/
├── Screen-Remote/       # Android 源码
└── external/dadb/       # Gradle 依赖
```

普通 Android 开发不需要克隆全部 `external/` 项目；除非任务明确涉及某个项目，否则它们都
只是参考资料。

完整聚合工作区：

```bash
git clone --recurse-submodules git@github.com:XRSec/Screen-Remote.git
cd Screen-Remote
git submodule update --init --recursive
```

这还会初始化 macOS、两个 Wiki 和参考项目；Android 局部修改不需要这样做。

## 工作边界

- Android 代码修改放在 `Screen-Remote/` 内。
- 明确需要更新 Wiki 时，Android 文档放在 `external/wiki-android/`。
- 两个平台共享的稳定契约放在根仓库 `docs/contracts/`。
- `external/dadb/` 是独立仓库；只有共享 ADB 行为才应修改它。
- Android 仓库提交与根仓库更新 gitlink 是两个独立提交。

编辑前分别检查：

```bash
git status --short --branch
git -C Screen-Remote status --short --branch
git -C external/dadb status --short --branch
```

保留已有修改；不要使用 `reset`、`clean`，也不要顺手更新无关子模块。

## Android 代码地图

```text
Screen-Remote/app/src/main/java/com/screen/remote/android/
├── app/                 应用入口与顶层组装
├── core/                共享模型、存储、设计系统、i18n、工具
├── infrastructure/     ADB、scrcpy、socket、媒体、编解码与运行时
├── feature/             会话、远控、设备、设置与 Compose UI
└── service/             前台服务与 Android 生命周期协调
```

远控主链路是：会话配置 → 远控功能 → ADB → scrcpy server 与有序 socket（`video`、可选
`audio`、`control`）→ 媒体/控制运行时 → 前台服务。

开始实现、审查或验证前，先阅读 `Screen-Remote/AGENTS.md` 和 Android engineering skill。
