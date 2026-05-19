# 日志维护指南

本文档说明应用日志如何组织、设置页开关如何控制日志输出，以及后续新增日志时如何避免绕过统一日志系统。

## 目标

- 应用自身日志必须统一经过 `LogManager`。
- 高频诊断日志必须受设置页开关控制。
- 警告和错误必须保留，方便定位真实失败。
- 新增日志标签必须有明确分类。
- 业务代码和基础设施代码不要直接调用 `android.util.Log`。

## 核心模型

日志系统分为三层：

1. 日志标签：短标签，定义在 `LogTags.kt`。
2. 日志分类：语义分组，定义在 `LogDetailCategory.kt`。
3. 设置开关：面向用户的开关，持久化在 `AppSettings`。

主要文件：

- `app/src/main/java/com/mobile/scrcpy/android/core/common/constants/LogTags.kt`
- `app/src/main/java/com/mobile/scrcpy/android/core/common/manager/LogManager.kt`
- `app/src/main/java/com/mobile/scrcpy/android/core/common/manager/LogDetailCategory.kt`
- `app/src/main/java/com/mobile/scrcpy/android/core/domain/model/Settings.kt`
- `app/src/main/java/com/mobile/scrcpy/android/core/data/datastore/PreferencesManager.kt`
-
`app/src/main/java/com/mobile/scrcpy/android/feature/settings/ui/internal/SettingsScreenContent.kt`

## 输出规则

`LogManager.v`、`LogManager.d`、`LogManager.i` 属于详细日志，会根据日志标签对应的分类，再由设置页开关决定是否输出。

`LogManager.w`、`LogManager.e` 用于真实警告和错误。只要总日志开关开启，它们就会输出，不受详细分类开关影响。

不要在功能代码或基础设施代码里直接使用 `android.util.Log`。允许直接调用 Android 日志 API 的位置只有日志系统内部：

- `LogManager`
- `LogFileController`
- `LogMessageWriter`

## 当前分类

| 分类               | 设置字段                     | 适用范围                                                   |
|------------------|--------------------------|--------------------------------------------------------|
| `AUDIO_STREAM`   | `enableAudioStreamLog`   | 音频元数据、音频包、解码器输入/输出、AudioTrack 细节                       |
| `VIDEO_STREAM`   | `enableVideoStreamLog`   | 视频元数据、视频包、解码器输入/输出、Surface/渲染诊断                        |
| `CONTROL_STREAM` | `enableControlStreamLog` | 触摸、按键、控制消息、控制 Socket、控制保活诊断                            |
| `EVENT_STREAM`   | `enableEventStreamLog`   | 会话状态机、事件总线、组件快照、连接事件流                                  |
| `SHELL_STREAM`   | `enableShellStreamLog`   | scrcpy-server stdout/stderr、shell monitor、server 运行期诊断 |
| `MANAGEMENT`     | `enableManagementLog`    | 应用管理、ADB 管理、文件/应用管理、设置和工具类诊断                           |

## 当前标签映射

权威映射在 `LogManager.detailCategoryForTag(tag)`。

常见标签示例：

| 标签                                                                           | 分类               |
|------------------------------------------------------------------------------|------------------|
| `VDEC`, `VCSL`, `SKPK`, `RDSP`                                               | `VIDEO_STREAM`   |
| `ADEC`, `ACSL`, `AAC`, `OPUS`                                                | `AUDIO_STREAM`   |
| `CTRL`, `TOCH`, `CTVM`, `CMNU`                                               | `CONTROL_STREAM` |
| `SCLI`, `SDL`, `SEVT`, `SDHM`                                                | `EVENT_STREAM`   |
| `SSVR`                                                                       | `SHELL_STREAM`   |
| `SSVC`, `ADBC`, `ADBM`, `ADBB`, `ADBP`, `USBC`, `CVM`, `APP`, `FCTL`, `FCTM` | `MANAGEMENT`     |

不确定分类时，按“这条日志主要帮助排查什么问题”来归类，而不是按代码所在包名归类。

## 新增日志标签

新增标签时按这个流程走：

1. 在 `LogTags.kt` 添加标签常量。
2. 在 `LogManager.detailCategoryForTag(tag)` 中给标签归类。
3. 使用 `LogManager` 或已有分类 wrapper 输出日志。
4. 执行本文档里的审计命令。
5. 执行 `./gradlew :app:compileDebugKotlin`。

不要新增未映射的应用自有标签。未映射标签默认允许输出，主要是为了兼容少量第三方、临时或系统风格标签；应用自有标签必须显式归类。

## 新增日志分类

只有现有分类无法准确描述某条日志流时，才新增分类。

新增分类需要同步修改：

1. 在 `LogDetailCategory.kt` 增加 enum。
2. 在 `LogManagerState.kt` 增加状态字段。
3. 在 `AppSettings` 增加设置字段。
4. 在 `PreferencesManager` 增加 DataStore key、读取和写入。
5. 在 `LogManager.applySettings()` 中应用设置。
6. 在 `LogManager.isDetailLoggingEnabled()` 中处理开关。
7. 在 `SettingsTexts.kt` 增加中英文文案。
8. 在 `SettingsScreenTexts.kt` 增加 UI 文案字段。
9. 在 `SettingsScreenContent.kt` 增加设置页开关。
10. 在 `LogManager.detailCategoryForTag(tag)` 增加标签映射。

## 日志级别选择

普通诊断使用 `d`：

```kotlin
LogManager.d(LogTags.SCRCPY_CLIENT, "处理事件: $event")
```

`i` 只用于比普通 debug 更重要、但仍属于诊断性质的信息。`i` 仍然受分类开关控制。

可恢复但异常的状态使用 `w`：

```kotlin
LogManager.w(LogTags.VIDEO_DECODER, "解码器未运行，跳过 Surface 切换")
```

真实失败使用 `e`：

```kotlin
LogManager.e(LogTags.VIDEO_DECODER, "解码失败: ${error.message}", error)
```

高频日志必须采样或受开关保护。优先使用已有 wrapper：

- `VideoDebugLog`
- `AudioDebugLog`
- `ControlDebugLog`
- `ShellDebugLog`
- `ManagementDebugLog`
- `FloatingDebugLog`

## 审计命令

查找日志基础设施外的直接 Android 日志调用：

```bash
rg -n "import android\\.util\\.Log|\\bLog\\.(v|d|i|w|e)\\(" app/src/main/java/com/mobile/scrcpy/android
```

预期只允许以下文件直接使用 Android 日志 API：

- `LogManager.kt`
- `LogFileController.kt`
- `LogMessageWriter.kt`

列出当前通过 `LogManager` 使用的应用标签：

```bash
rg -o "LogManager\\.(?:v|d|i|w|e)\\(LogTags\\.[A-Z0-9_]+" app/src/main/java/com/mobile/scrcpy/android \
  | sed -E 's/.*LogTags\\.//' \
  | sort -u
```

查找需要人工确认分类的动态 tag：

```bash
rg -n "LogManager\\.(v|d|i)\\(\\s*\\\"|LogManager\\.(v|d|i)\\([^L]" app/src/main/java/com/mobile/scrcpy/android
```

编译检查：

```bash
./gradlew :app:compileDebugKotlin
```

## Logcat 现实边界

设置页开关只能控制应用通过 `LogManager` 输出的日志。

它不能控制 Android framework、MediaCodec、厂商 codec 或系统组件日志，例如：

- `CCodec`
- `CCodecConfig`
- `MediaCodec`
- `SurfaceUtils`
- `BufferPoolAccessor2.0`
- `InsetsController`
- `InteractionJankMonitor`

这些日志需要通过 logcat 过滤。

## 合并前检查清单

- 功能代码没有导入 `android.util.Log`。
- 新增 `LogTags` 常量已在 `LogManager` 里归类。
- 高频包、帧、触摸、状态日志没有使用 `w` 或 `e`。
- `w/e` 只表示真实警告或错误。
- 新增设置字段已持久化，并已应用到 `LogManager`。
- `compileDebugKotlin` 通过。
