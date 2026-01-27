# Scrcpy Mobile

一个基于 Scrcpy 协议的 Android 远程控制应用，采用现代化的模块化架构设计。

## 预览

<p align="center">
  <img src="assets/app-home.png" alt="app home" width="30%" />
  <img src="assets/app-add-devices.png" alt="app add devices" width="30%" />
  <img src="assets/app-setting.png" alt="app setting" width="30%" />
</p>

## 项目架构

本项目采用 **Google Now in Android** 推荐的模块化架构，遵循 **Feature-First + Core Infrastructure** 设计原则。

### 架构层次

```
app/                          # 应用入口层
├── MainActivity.kt
└── ScreenRemoteApp.kt

feature/                      # 功能模块层（Feature-First）
├── session/                  # 会话管理
├── remote/                   # 远程控制
├── device/                   # 设备管理
├── settings/                 # 设置功能
└── codec/                    # 编解码器测试

infrastructure/               # 基础设施层（技术实现）
├── adb/                      # ADB 连接实现
├── scrcpy/                   # Scrcpy 协议实现
└── media/                    # 媒体编解码

core/                         # 核心基础设施层
├── common/                   # 通用工具
├── designsystem/             # 设计系统（Material 3）
├── data/                     # 数据层基础设施
├── domain/                   # 领域模型
└── i18n/                     # 国际化

service/                      # Android 服务
└── ScrcpyForegroundService.kt
```

### 依赖关系

```
app → feature → infrastructure → core
     ↓         ↓                  ↓
   service    core              (无依赖)
```

详细架构说明请参阅 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 开发进度

正在开发中 `60%`，计划任务请查阅 [docs/TODO.md](TODO.md)

✅ **架构迁移已完成**（2024）- 详见 [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)

> 目前 Kiro 已破产 努力更新中
>
> 由于目前所有代码都是作者一人编写，所以闭源处理
>
> 后期如果有贡献者会考虑开源
> 

## 多功能按键

- 点击：打开/关闭菜单（就是现有的三个点按钮功能）
- 拖动：移动按钮位置（现有功能保留）
- 长按：桌面（Home）
- 长按+左滑：返回（Back）
- 长按+右滑：后台任务（Recent）
- 长按+上滑：桌面（HOME）
- 长按+下滑：通知栏（Notification）
- 长按：预留功能
- 震动反馈：手势触发时提供触觉反馈