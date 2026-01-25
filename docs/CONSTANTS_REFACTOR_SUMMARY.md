# 常量重构总结

## 概述

本次重构的目标是消除项目中的硬编码常量，将所有魔法数字和字符串统一管理到 `Constants.kt` 和 `Models.kt` 中。

## 重构成果

### 1. Constants.kt 新增内容

#### ScrcpyConstants 扩展
```kotlin
// 视频参数
const val DEFAULT_MAX_SIZE_INT = 1920          // 默认最大屏幕尺寸（整数）
const val DEFAULT_BITRATE_INT = 8000000        // 默认码率（8Mbps）
const val DEFAULT_DISPLAY_ID = 0               // 默认显示 ID
const val DEFAULT_CODEC_OPTIONS = "..."        // 默认编码器配置

// 音频参数
const val DEFAULT_AUDIO_BITRATE = 128000       // 默认音频码率（128kbps）

// 解码器参数
const val DECODER_INPUT_TIMEOUT_US = 10000L    // 解码器输入超时
const val DECODER_OUTPUT_TIMEOUT_US = 10000L   // 解码器输出超时
const val PTS_TO_MS_DIVISOR = 1000L            // PTS 时间转换

// 连接参数
const val SOCKET_READ_TIMEOUT = 10000L         // Socket 读取超时
const val LOCAL_FORWARD_PORT = 27183           // 本地转发端口
```

#### NetworkConstants 扩展
```kotlin
const val DEFAULT_ADB_PORT_INT = 5555          // 默认 ADB 端口（整数）
const val LOCALHOST = "127.0.0.1"              // 本地回环地址
const val SOCKET_WAIT_TIMEOUT_MS = 5000L       // Socket 等待超时
const val SOCKET_WAIT_RETRIES = 10             // Socket 等待重试次数
```

#### AppConstants 扩展
```kotlin
const val WAKELOCK_TIMEOUT_MS = 10L * 60 * 60 * 1000  // WakeLock 超时（10小时）
const val STATEFLOW_SUBSCRIBE_TIMEOUT_MS = 5000L      // StateFlow 订阅超时
const val PROCESS_ID_START = 10000                     // 进程 ID 起始值
```

#### UIConstants（新增）
```kotlin
object UIConstants {
    const val HIDDEN_INPUT_OFFSET = -1000      // 隐藏输入框偏移
    const val LOG_FRAME_INTERVAL = 100         // 日志输出间隔
    const val LOG_INITIAL_FRAMES = 5           // 初始日志帧数
}
```

### 2. 已重构的文件

#### ✅ ScrcpyOptions.kt
- 所有默认参数使用 `ScrcpyConstants` 中的常量
- 音频码率使用 `DEFAULT_AUDIO_BITRATE`

#### ✅ SessionRepository.kt  
- SessionData 默认值使用常量
- 添加必要的 import

#### ✅ Models.kt
- DeviceConfig 默认端口使用 `NetworkConstants.DEFAULT_ADB_PORT_INT`

#### ✅ MainViewModel.kt
- StateFlow 订阅超时使用 `AppConstants.STATEFLOW_SUBSCRIBE_TIMEOUT_MS`
- 函数默认参数使用常量
- 端口和码率解析使用常量作为默认值

#### ✅ ScrcpyClient.kt（部分）
- 连接参数默认值使用常量
- 缓存变量初始值使用常量
- 添加必要的 import

## 重构前后对比

### 示例 1: ScrcpyOptions
```kotlin
// 重构前
data class ScrcpyOptions(
    val maxSize: Int = 1920,
    val bitRate: Int = 8000000,
    val maxFps: Int = 60,
    val videoCodec: String = "h264",
    val audioCodec: String = "aac"
)

// 重构后
data class ScrcpyOptions(
    val maxSize: Int = ScrcpyConstants.DEFAULT_MAX_SIZE_INT,
    val bitRate: Int = ScrcpyConstants.DEFAULT_BITRATE_INT,
    val maxFps: Int = ScrcpyConstants.DEFAULT_MAX_FPS,
    val videoCodec: String = ScrcpyConstants.DEFAULT_VIDEO_CODEC,
    val audioCodec: String = ScrcpyConstants.DEFAULT_AUDIO_CODEC
)
```

### 示例 2: 端口号
```kotlin
// 重构前
fun connectDevice(host: String, port: Int = 5555)
val port = sessionData.port.toIntOrNull() ?: 5555

// 重构后
fun connectDevice(host: String, port: Int = NetworkConstants.DEFAULT_ADB_PORT_INT)
val port = sessionData.port.toIntOrNull() ?: NetworkConstants.DEFAULT_ADB_PORT_INT
```

## 待完成的重构任务

详见 `REFACTOR_CONSTANTS.md` 文档中的"待完成的重构"章节。

主要包括：
- VideoDecoder.kt - 视频解码器常量
- AudioDecoder.kt - 音频解码器常量
- RemoteDisplayScreen.kt - UI 相关常量
- DeviceViewModel.kt - 设备管理常量
- AdbConnectionManager.kt - ADB 连接常量
- 其他文件中的硬编码值

## 收益

1. **可维护性提升**：修改常量值只需在一处修改
2. **代码可读性**：常量名称清晰表达含义
3. **类型安全**：整数和字符串常量分开定义
4. **便于国际化**：UI 文本集中管理
5. **减少错误**：避免在多处重复输入相同的值

## 注意事项

1. 修改 `Constants.kt` 中的值会影响整个项目
2. 某些常量（如超时时间）可能需要根据实际情况调整
3. 编码格式字符串要与 Android API 保持一致
4. 重构后需要全面测试以确保功能正常

## 下一步计划

1. 完成剩余文件的常量重构
2. 添加单元测试验证常量使用
3. 考虑将部分常量改为可配置项
4. 将 UI 文本迁移到字符串资源文件以支持国际化
5. 创建编码格式枚举类型以提高类型安全性

## 相关文档

- `REFACTOR_CONSTANTS.md` - 详细的重构计划和进度
- `project-context.md` - 项目上下文和开发规范
- `Constants.kt` - 常量定义文件
- `Models.kt` - 数据模型定义文件
