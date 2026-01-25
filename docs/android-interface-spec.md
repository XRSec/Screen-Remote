# Android 接口规范

## 核心组件
- ADB 连接管理
- Scrcpy 会话控制
- 设备状态监控

## 数据模型
```kotlin
data class ScrcpySession(
    val id: String,
    val name: String,
    val color: SessionColor,
    val isConnected: Boolean,
    val hasWifi: Boolean,
    val hasWarning: Boolean
)

data class SessionData(
    val id: String?,
    val name: String,
    val host: String,
    val port: String,
    val forceAdb: Boolean = false,
    val maxSize: String = "",
    val bitrate: String = "",
    val videoCodec: String = "h264",
    val enableAudio: Boolean = false,
    val stayAwake: Boolean = true,
    val turnScreenOff: Boolean = true,
    val powerOffOnClose: Boolean = false
)
```

## UI 组件
- SessionDialog：会话配置
- CommonComponents：统一组件库
- 遵循 iOS 风格设计

