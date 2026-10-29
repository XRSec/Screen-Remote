# 4.4.3.16 — Final Release Supporting minSdk: 23 (Android 6.0+)

> ⚠️ **重要公告 / Notice**: 这是支持 Android 6.0+ (`minSdk: 23`) 的**最后一个版本**。后续版本将提升最低支持系统版本，以现代化 Android 底层架构。
> This is the **final release supporting Android 6.0+ (`minSdk: 23`)**. Subsequent releases will raise the minimum SDK requirement to modernize the Android runtime architecture.

## 管理功能与文件浏览性能优化 (File Management & Performance)

- **移除冗余的 Helper 强制推送**：在底层 `dadb` 通道中关闭了每次目录查询前对 `dadb-helper.jar` 的无条件重复推送，仅在远端缺失或版本不匹配时才执行补推，显著消除因网络 I/O 带来的目录加载延迟。
- **本地 Helper 资产内存缓存**：避免每次列出或刷新目录时反复从 APK assets 执行重复解压写盘，降低 I/O 开销。
- **大幅提升目录加载速度**：进入文件管理、多级文件夹上下穿梭的加载体验恢复毫秒级流畅响应。

## 本机无线调试体系与期望状态自愈 (Local ADB & Desired State)

- **独立开关解耦**：开发者选项 (`DEVELOPMENT_SETTINGS_ENABLED`) 与 USB 调试 (`ADB_ENABLED`) 独立受控，开启无线调试绝不暗中强开 USB 调试。
- **动态探测与回环验证**：反射快速探测 Android 11+ TLS 动态端口 `service.adb.tls.port` 与 TCP `service.adb.tcp.port`，结合 `127.0.0.1` 双向 Socket 自检。
- **期望状态对齐 (Desired State Configuration)**：冷启动与 Wi-Fi 网络漫游（`NetworkCallback`）自动对齐系统设置，保持无线调试自愈不断联。
- **开机自启动 (`BootCompletedReceiver`)**：监听 `BOOT_COMPLETED` 广播，重启后无需进入应用即可后台恢复调试环境。
- **即时校验与回弹防护**：开关操作执行实时前置/后置校验，条件未满足或失败立即回弹并提示。
- **Root 辅助与静默提权**：支持 Root 命令原子重启 adbd 重载端口，一键写入 `WRITE_SECURE_SETTINGS`、Android 13+ 受限设置 (`ACCESS_RESTRICTED_SETTINGS`) 与永久授权超时。
- **无障碍授权自动化 (`AdbAuthAccessibilityService`)**：覆盖 AOSP、MIUI/HyperOS、ColorOS、OriginOS、EMUI/HarmonyOS、OneUI 弹窗自动确认，受严格限时安全租期令牌 (`grantAuthPermit`) 保护。

## Miuix 0.9.3 全面重构与 iOS 融合设计系统 (Miuix 0.9.3 & iOS Design System)

- 全面完成从 Material3 向 Miuix 0.9.3 的迁移，覆盖设置、会话管理、设备发现配对与远控管理子页面。
- 列表项高度严格规范为 `40.dp`，开关全量采用 iOS 风格 `IOSSwitch`，操作行采用紧凑状态徽章与显式操作按钮（`配置`、`一键激活`、`前往开启`）。

## 远控交互、媒体与传输优化 (Remote Control & Media Enhancements)

- **scrcpy server 升级至 5.0.1**，同步底层协议与媒体管道。
- **控制消息保序与防抖**：引入协程 Channel FIFO 顺序管道与原子两阶段按键机制，支持鼠标高精度滚轮滑动注入 (`ScrollMessage`) 与控制队列背压防护 (`MAX_PENDING_CONTROL_MESSAGES = 256`)。
- **显示控制与状态解耦**：通知栏下拉、黑屏待机模式与画面镜像完全独立控制，退出远控自动恢复系统屏幕方向 (`SCREEN_ORIENTATION_USER`)。
