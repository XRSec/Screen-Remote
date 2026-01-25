# 常量重构文档

## 重构目标

将项目中所有硬编码的魔法数字和字符串统一迁移到 `Constants.kt` 和 `Models.kt` 中，确保：
1. 所有常量有唯一的定义来源
2. 提高代码可维护性
3. 便于后续修改和国际化

## 已完成的重构

### 1. Constants.kt 扩展

新增以下常量对象和字段：

#### ScrcpyConstants
- `DEFAULT_MAX_SIZE_INT = 1920` - 默认最大屏幕尺寸（整数）
- `DEFAULT_BITRATE_INT = 8000000` - 默认码率（整数，8Mbps）
- `DEFAULT_DISPLAY_ID = 0` - 默认显示 ID
- `DEFAULT_CODEC_OPTIONS` - 默认编码器配置
- `DEFAULT_AUDIO_BITRATE = 128000` - 默认音频码率（128kbps）
- `DECODER_INPUT_TIMEOUT_US = 10000L` - 解码器输入缓冲区超时
- `DECODER_OUTPUT_TIMEOUT_US = 10000L` - 解码器输出缓冲区超时
- `PTS_TO_MS_DIVISOR = 1000L` - PTS 时间单位转换
- `LOCAL_FORWARD_PORT = 27183` - 本地转发端口

#### NetworkConstants
- `DEFAULT_ADB_PORT_INT = 5555` - 默认 ADB 端口（整数）
- `LOCALHOST = "127.0.0.1"` - 本地回环地址
- `SOCKET_WAIT_TIMEOUT_MS = 5000L` - Socket 等待超时
- `SOCKET_WAIT_RETRIES = 10` - Socket 等待重试次数

#### AppConstants
- `WAKELOCK_TIMEOUT_MS` - WakeLock 超时时间（10小时）
- `STATEFLOW_SUBSCRIBE_TIMEOUT_MS = 5000L` - StateFlow 订阅超时
- `PROCESS_ID_START = 10000` - 进程 ID 起始值

#### UIConstants（新增）
- `HIDDEN_INPUT_OFFSET = -1000` - 隐藏输入框的偏移量
- `LOG_FRAME_INTERVAL = 100` - 日志输出间隔
- `LOG_INITIAL_FRAMES = 5` - 初始日志输出帧数

### 2. 已更新的文件

#### ScrcpyOptions.kt
- ✅ 使用 `ScrcpyConstants.DEFAULT_MAX_SIZE_INT`
- ✅ 使用 `ScrcpyConstants.DEFAULT_BITRATE_INT`
- ✅ 使用 `ScrcpyConstants.DEFAULT_MAX_FPS`
- ✅ 使用 `ScrcpyConstants.DEFAULT_DISPLAY_ID`
- ✅ 使用 `ScrcpyConstants.DEFAULT_CODEC_OPTIONS`
- ✅ 使用 `ScrcpyConstants.DEFAULT_VIDEO_CODEC`
- ✅ 使用 `ScrcpyConstants.DEFAULT_AUDIO_CODEC`
- ✅ 使用 `ScrcpyConstants.DEFAULT_AUDIO_BITRATE`

#### SessionRepository.kt
- ✅ 添加 import `NetworkConstants` 和 `ScrcpyConstants`
- ✅ SessionData 默认值使用常量

#### Models.kt
- ✅ DeviceConfig 使用 `NetworkConstants.DEFAULT_ADB_PORT_INT`

#### MainViewModel.kt
- ✅ StateFlow 订阅超时使用 `AppConstants.STATEFLOW_SUBSCRIBE_TIMEOUT_MS`
- ✅ connectToDevice 默认端口使用 `NetworkConstants.DEFAULT_ADB_PORT_INT`
- ✅ connectSession 中的端口和码率使用常量

## 待完成的重构

### 高优先级

#### ScrcpyClient.kt
需要更新的硬编码值：
- [ ] `port: Int = 5555` → `NetworkConstants.DEFAULT_ADB_PORT_INT`
- [ ] `bitRate: Int = 1000000` → `ScrcpyConstants.DEFAULT_BITRATE_INT`
- [ ] `maxFps: Int = 30` → `ScrcpyConstants.DEFAULT_MAX_FPS`
- [ ] `videoCodec: String = "h264"` → `ScrcpyConstants.DEFAULT_VIDEO_CODEC`
- [ ] `audioCodec: String = "aac"` → `ScrcpyConstants.DEFAULT_AUDIO_CODEC`
- [ ] `"127.0.0.1"` → `NetworkConstants.LOCALHOST`
- [ ] `5000` (连接超时) → `NetworkConstants.CONNECT_TIMEOUT_MS`
- [ ] `10000` (读取超时) → `NetworkConstants.READ_TIMEOUT_MS`

#### VideoDecoder.kt
- [ ] `videoCodec: String = "h264"` → `ScrcpyConstants.DEFAULT_VIDEO_CODEC`
- [ ] `"h264"` 字符串比较 → 使用常量
- [ ] `pts / 1000` → `pts / ScrcpyConstants.PTS_TO_MS_DIVISOR`

#### AudioDecoder.kt
- [ ] `10000` (dequeueInputBuffer 超时) → `ScrcpyConstants.DECODER_INPUT_TIMEOUT_US`
- [ ] `pts/1000` → `pts / ScrcpyConstants.PTS_TO_MS_DIVISOR`
- [ ] `"aac"` 字符串比较 → 使用常量
- [ ] 日志输出间隔 100 → `UIConstants.LOG_FRAME_INTERVAL`

#### RemoteDisplayScreen.kt
- [ ] `offset(x = (-1000).dp, y = (-1000).dp)` → `UIConstants.HIDDEN_INPUT_OFFSET`
- [ ] `videoCodec ?: "h264"` → `ScrcpyConstants.DEFAULT_VIDEO_CODEC`

#### DeviceViewModel.kt
- [ ] `port: Int = 5555` → `NetworkConstants.DEFAULT_ADB_PORT_INT`

#### AdbConnectionManager.kt
- [ ] `port: Int = 5555` → `NetworkConstants.DEFAULT_ADB_PORT_INT`
- [ ] 错误消息中的 "5555" → 使用常量
- [ ] `"h264"` 字符串比较 → 使用常量
- [ ] `"aac"` 字符串比较 → 使用常量

#### ScrcpyForegroundService.kt
- [ ] `parts[1].toIntOrNull() ?: 5555` → `NetworkConstants.DEFAULT_ADB_PORT_INT`
- [ ] `10 * 60 * 60 * 1000L` → `AppConstants.WAKELOCK_TIMEOUT_MS`

#### SocketForwarder.kt
- [ ] `waitFor(10, 5000)` → 使用 `NetworkConstants.SOCKET_WAIT_RETRIES` 和 `SOCKET_WAIT_TIMEOUT_MS`

#### AdbBridge.kt
- [ ] `AtomicInteger(10000)` → `AppConstants.PROCESS_ID_START`

#### CodecTestScreen.kt
- [ ] `dequeueInputBuffer(10000)` → `ScrcpyConstants.DECODER_INPUT_TIMEOUT_US`
- [ ] `dequeueOutputBuffer(bufferInfo, 10000)` → `ScrcpyConstants.DECODER_OUTPUT_TIMEOUT_US`

### 中优先级

#### PlaceholderTexts
需要确保所有占位符文本都在使用：
- [ ] 检查 UI 组件是否使用 `PlaceholderTexts` 中的常量
- [ ] 检查是否有遗漏的占位符文本

#### UITexts
需要确保所有 UI 文本都在使用：
- [ ] 检查对话框标题是否使用 `UITexts` 常量
- [ ] 检查按钮文字是否使用 `UITexts` 常量
- [ ] 检查标签文字是否使用 `UITexts` 常量

### 低优先级

#### 编码格式字符串
在多个文件中重复出现的编码格式字符串：
- [ ] 创建 `CodecMimeTypes` 对象统一管理 MIME 类型
- [ ] 例如：`"video/avc"`, `"video/hevc"`, `"audio/opus"`, `"audio/mp4a-latm"` 等

## 重构原则

1. **向后兼容**：确保重构不破坏现有功能
2. **类型安全**：整数常量和字符串常量分开定义
3. **语义清晰**：常量命名要能清楚表达其用途
4. **分组合理**：相关常量放在同一个 object 中
5. **文档完整**：每个常量都要有注释说明

## 验证清单

重构完成后需要验证：
- [ ] 项目编译通过
- [ ] 所有单元测试通过
- [ ] 手动测试核心功能：
  - [ ] ADB 连接
  - [ ] 视频流播放
  - [ ] 音频播放
  - [ ] 触摸控制
  - [ ] 会话管理
- [ ] 检查日志输出是否正常
- [ ] 检查错误提示是否正确

## 后续改进

1. **国际化支持**：将 `UITexts` 和 `PlaceholderTexts` 迁移到字符串资源文件
2. **配置化**：考虑将部分常量改为可配置项
3. **类型安全枚举**：将编码格式等字符串常量改为枚举类型
4. **单元测试**：为常量使用添加单元测试

## 注意事项

1. 修改常量值时要特别小心，可能影响多个模块
2. 某些"魔法数字"可能有特殊含义，修改前要理解其用途
3. 网络超时等参数可能需要根据实际情况调整
4. 编码格式字符串要与 Android MediaCodec API 保持一致
