# v4.4.3.18

## 设备管理与主题问题修复 (Session Management & Theme Fixes)

- **修复设备管理界面主题适配**：修复会话管理界面与顶部栏在深色/浅色模式切换时背景和文本色彩未正确跟随的问题，显式接入 `ScreenRemoteMiuixTheme` 并补齐主题语义色彩映射，保证视觉一致性。
- **Fix Theme Switching in Management**: Fixed background and typography color synchronization issues in session management and its top bar during light/dark theme toggles by properly integrating `ScreenRemoteMiuixTheme` with semantic theme tokens.

## dadb 缓存与本地版本自愈 (dadb Cache & Self-healing Versioning)

- **本地版本特征签名校验**：在 `DadbHelperAsset` 中增加本地版本特征签名（`VERSION_CODE_DADB_HELPER_VERSION`）比对机制，在应用跨版本升级、覆盖安装时自动检测并覆写更新 `dadb-helper.jar`，杜绝旧版本残留。
- **日常零冗余 I/O**：同版本运行期间直接复用本地缓存资产，免除进入管理功能时的重复解压与写盘开销。

## 首次安装与引导修复 (First Install & Onboarding Fix)

- **修复全新安装启动白屏**：修复在系统（如 ColorOS 16 / Android 15+ 等）或全新环境中首次安装打开时，因重构遗漏挂载引导欢迎卡片导致全屏背景遮罩卡在顶层的白板（空白）问题。恢复首次启动引导卡片及跳过/完成回调。

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
