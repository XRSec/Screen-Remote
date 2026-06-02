## 更新日志

日期：2026-07-19

## 已完成

- 将内置 `scrcpy-server.jar` 更新到官方 v4.1，并增加 `updateScrcpyServer` 与离线 `verifyScrcpyServerVersion` 任务。
- 完成 VP8/VP9 codec ID、MIME、metadata、无 CSD 视频包路由、MediaCodec 配置入口和相关 JVM 路由测试。
- 新增统一 `CodecCatalog`、`EncoderCapability` 与 `DecoderCapability`：完整覆盖 H.264、H.265、AV1、VP9、VP8 及 Opus、AAC、FLAC、RAW，自动路径按远端 encoder 与本地 decoder 的 MIME 交集选择，不再依赖实现名称猜格式。
- 统一硬件、软件、vendor、alias 与 low-latency 能力判定；API 29+ 使用 MediaCodec 结构化能力，本地能力缓存绑定系统指纹、SDK 与安全补丁并在运行环境变化时整体失效。
- 完成视频 PTS 微秒语义修复、当前/旋转尺寸预检、`KEY_LOW_LATENCY` 请求、configure/start 失败候选淘汰，以及 H.264/H.265/AV1/VPx 的运行时 decoder fallback。
- 让音频 decoder 选择进入真实 `createByCodecName()` 链路，补齐 Opus、AAC、FLAC 配置解析、RAW PCM 路径、运行时候选回退和 AudioTrack 完整写入。
- 将 scrcpy video、audio、control sockets 固化为严格串行建链，并增加顺序、并发数和早期失败不继续建链的回归测试。
- 会话配置新增 `ignoreVideoEncoderConstraints`，并在 scrcpy-server 启动参数中透传。
- 增加解码器能力预检：按实际宽高与旋转宽高查询 `VideoCapabilities`。
- 增加解码失败后的运行时 `maxSize` 自动降级与重连，且限制单会话自动恢复次数。
- 修复 `startForegroundService()` 与旧停止/心跳请求竞争导致的 `ForegroundServiceDidNotStartInTimeException`：每次保护设备请求立即前台化，使用 `stopSelfResult(startId)` 拒绝过期停止，并将 Service 生命周期更新串行化到主线程。
- 更新《编解码器策略、Low Latency 与 C2》研究报告，记录 scrcpy 4.1、Miuzarte 对比、格式策略、C2 硬件判断、`BAD_INDEX` 排障结论和真机验证矩阵。
- 文件管理器路径改为可点击面包屑，支持层级跳转、清空选择、长路径滚动到末级。
- 新增通用 `ClickableBreadcrumb` 组件和远程路径拆分测试。
- 文件管理列表查询增加文件大小：针对不支持 `find -printf` 且 `/sdcard` 为符号链接的设备，使用带尾部 `/` 的目录操作数和 `ls -lAnp` 回退解析；普通文件显示格式化大小，文件夹隐藏大小，修改时间统一靠右展示。
- 文件管理列表按后缀展示差异化图标和颜色，覆盖 APK、音频、视频、图片、PDF、压缩包、代码和文本等常见类型；长按选择后的底部工具栏与文件操作弹窗图标也增加语义颜色。
- 文件详情弹窗移除与标题栏重复的文件名区域，“所在路径”支持长按复制并显示成功提示。
- 空目录提示卡宽度调整为父容器的 `0.95`，水平居中并增加顶部留白。
- 修复高级重启、熄屏待机和激活应用等弹窗选项阴影在列表边界被裁剪成横线的问题，为首尾阴影增加安全间距。
- 激活应用弹窗改为内容少时自适应高度、内容多时最高 `320dp` 后滚动，加载占位不再强制撑满窗口。
- 增加结构化 `ConnectionCandidate`，用于表达一个会话下多个 ADB 会话地址候选。
- TCP 会话地址明确为完整 `IP:端口` endpoint，不能拆成“多个 IP + 固定端口”。
- 会话编辑 UI 将“设备类型”改为“会话类型”。
- 会话编辑 UI 增加“会话地址”快捷预览，默认只显示主地址；点击后打开类似“选择分组”的弹窗，弹窗内使用取消/保存的临时编辑模式管理会话类型、主机、端口和备用会话地址。
- 会话地址弹窗改为 `DialogPage` 页面式结构，右上角提供添加按钮；每个新增地址以独立卡片展示，卡片内包含会话类型、主机/端口或 serial/mDNS 服务字段，以及样式化删除按钮。
- 会话地址弹窗中主会话地址也改为独立卡片，主地址与备用地址使用统一的表单盒子样式；选择分组弹窗右侧“保存”按钮字号与左侧“取消”保持一致。
- 备用会话地址切换到 USB 或 mDNS 时，提供与主会话地址一致的“选择 USB 设备”和“发现设备”入口，选择结果只回填当前备用地址。
- 会话地址相关文案简化：mDNS 发现入口改为“发现设备”，空状态改为“无”；TCP 主机字段不再兼容其它协议，不再通过输入 `usb` 自动切换类型。
- 主会话地址与备用会话地址的字段提示按类型统一：TCP 主机只提示主机地址，端口只提示端口，USB 提示 serial 与设备选择，mDNS 提示服务名与发现设备。
- 备用会话地址支持 TCP endpoint、`usb:serial`、`mdns:service`，保存为 `connectionCandidates`，且 TCP 地址按 `IP+端口` 整体处理。
- 会话编辑行布局改为标签/提示图标按内容占位，右侧输入框、下拉值和快捷预览自动占用剩余宽度。
- scrcpy 连接与文件管理 ADB 连接按显式候选地址逐个尝试，并记录成功/失败状态。
- 增加应用级共享 mDNS 会话发现管理器，与日志、ADB Runtime 等基础设施一同在 `Application.onCreate()` 初始化；只要存在已配置的 mDNS 会话地址就持续监听，添加/编辑会话页面通过临时 lease 复用同一监听器。
- mDNS 会话发现、在线匹配和持久化身份统一使用 `mdns:<service-name>` transport serial；解析得到的 IP/端口不进入会话状态模型，“发现设备”列表也不再展示 IP/端口。
- 修复全局 mDNS 启动时 `AdbRuntime` 缺少 Android `Context` 导致应用启动崩溃的问题，`AdbRuntimeProvider` 现在使用 Application Context 构造 runtime。
- 增加主地址与备用地址的会话在线状态聚合：任意地址在线则会话在线，全部地址离线时显示主地址类型；徽标按“实际连接地址、连接中优先候选、在线主地址、在线备用地址、离线主地址”的顺序选择 transport。
- 会话状态徽标按 transport 使用独立图标：TCP 使用 Wi-Fi 图标、USB 使用 USB 图标、mDNS 使用 Sensors 广播图标；徽标只表达在线、离线、连接中和已连接，不进行延迟测速。
- USB 状态接入系统插入/拔出广播和设备 serial/path 匹配；主 TCP 离线而备用 USB 在线时，会话显示“USB + 在线”。TCP 在没有实际连接时默认离线，不增加后台测速或主动探测。
- 增加 mDNS serial 归一化、已配置会话发现、主备地址在线聚合、在线备用地址选择和实际连接地址优先等 JVM 测试；完整 `:app:testDebugUnitTest` 已通过。
- 增加 `ScrcpyProfile` 与 `ScrcpyProfileRepository`，支持默认模板、创建/复制/重命名/删除/排序等底层 API。
- 增加 stable/prerelease 更新通道模型、语义化版本比较和 GitHub Releases 检查器。
- 增加 GitHub Actions Debug 构建工作流，执行 server 校验、单元测试、Debug APK 构建和产物上传。
- 增加 Renovate 配置，迁移主要 Gradle 插件和依赖到 `gradle/libs.versions.toml`。
- 已通过 `./gradlew :app:testDebugUnitTest :app:assembleDebug :app:verifyScrcpyServerVersion`。

## 部分完成

- 多会话地址底层候选、UI 入口、保存和连接尝试已完成；但会话连接模型仍保留旧 `host + port` 字段，尚未重构为仅以 `connectionCandidates` 为唯一来源。
- Scrcpy 配置模板的领域模型、仓库和覆盖规则已完成；但会话编辑页和设置页尚未提供完整模板选择/管理 UI。
- GitHub Releases 更新检查器已完成核心逻辑；但设置页尚未提供更新通道切换和手动检查入口，也未接入检查频率限制调度。

## 仍未完成

- H.264/H.265/AV1/VP8/VP9 的真实 MediaCodec 首帧、普通帧、旋转、Surface 重建和断线重连真机/仪器回归测试。
- 厂商 MediaCodec 能力误报、旋转失败、重复失败等 Android 真机/仪器测试。
- Opus/AAC/FLAC/RAW 的长时间播放、运行时 decoder fallback、音画同步和低延迟缓冲真机测试。
- Qualcomm、MediaTek、Exynos 的编解码首帧/帧延迟/掉帧/功耗基准，以及连续快速连接/断开时的前台服务竞态压力测试。
- 多会话地址的进阶 UI：地址启用/禁用、标签、手动排序、设为首选、测试连接、失败次数展示；当前主地址不可删除，备用地址可无限添加和删除，且每条备用地址已有独立会话类型和对应字段。
- 主备会话地址的在线状态聚合与徽标 transport 选择已经完成；连接层仍需继续优化失败后切换策略、用户手动指定首选地址，以及当前连接候选切换过程的细粒度展示。
- 将会话连接模型彻底改为显式 `connectionCandidates` 唯一来源，并清理旧 `host + port` 存储字段。
- 多地址真实网络/设备测试：IPv4、IPv6、mDNS 重绑定、全部不可达、备用地址成功。
- 模板快速切换 UI，以及完整模板管理页面。
- `ScrcpyProfileRepository` 的 DataStore 仓库级 Android 仪器测试。
- 正式签名发布工作流，以及根据版本标签自动设置 GitHub Release prerelease 状态。
- 更新检查 UI：稳定版/预发行版通道选择、手动检查、检查频率限制和错误展示。
