# Easycontrol Server 魔改分析

## 概述

Easycontrol 对 scrcpy server 进行了大量简化和定制，**不是官方 scrcpy server**，而是自己实现的简化版本。

## 核心差异

### 1. 参数系统完全不同

#### 官方 Scrcpy Server
- **参数数量**: 40+ 个参数
- **参数格式**: `key=value`
- **版本校验**: 必须传入客户端版本号作为第一个参数
- **参数类型**: 支持复杂类型（Rect、Size、枚举等）
- **编解码器**: 通过 `video_codec` 和 `audio_codec` 参数指定（如 `audio_codec=opus`）

#### Easycontrol Server
- **参数数量**: 仅 10 个参数
- **参数格式**: `key=value`
- **版本校验**: 无
- **参数类型**: 仅支持简单类型（int、boolean、String）
- **编解码器**: 通过 `supportH265` 和 `supportOpus` 布尔值控制

### 2. supportOpus 参数对比

#### 官方 Scrcpy
```java
// 官方没有 supportOpus 参数！
// 而是通过 audio_codec 参数指定编解码器
private AudioCodec audioCodec = AudioCodec.OPUS;  // 默认值

// 支持的音频编解码器
public enum AudioCodec {
    OPUS(0x6f_70_75_73, "opus", MediaFormat.MIMETYPE_AUDIO_OPUS),
    AAC(0x00_61_61_63, "aac", MediaFormat.MIMETYPE_AUDIO_AAC),
    FLAC(0x66_6c_61_63, "flac", MediaFormat.MIMETYPE_AUDIO_FLAC),
    RAW(0x00_72_61_77, "raw", MediaFormat.MIMETYPE_AUDIO_RAW);
}

// 使用方式
audio_codec=opus  // 或 aac、flac、raw
```

#### Easycontrol
```java
// Easycontrol 自定义的 supportOpus 参数
public static boolean supportOpus = true;  // 默认值

// 参数解析
case "supportOpus":
    supportOpus = Integer.parseInt(value) == 1;
    break;

// 使用方式
supportOpus=1  // 或 0
```

**结论**: `supportOpus` 是 **Easycontrol 自己添加的参数**，官方 scrcpy server 没有这个参数！

### 3. 完整参数对比表

| 参数名 | Easycontrol | 官方 Scrcpy | 说明 |
|--------|-------------|-------------|------|
| `serverPort` | ✅ | ❌ | Easycontrol 自定义 |
| `listenClip` | ✅ | ❌ | Easycontrol 自定义（对应官方的 `clipboard_autosync`） |
| `isAudio` | ✅ | ❌ | Easycontrol 自定义（对应官方的 `audio`） |
| `maxSize` | ✅ | ✅ | 两者都有，但官方叫 `max_size` |
| `maxFps` | ✅ | ❌ | Easycontrol 自定义（对应官方的 `max_fps`） |
| `maxVideoBit` | ✅ | ❌ | Easycontrol 自定义（对应官方的 `video_bit_rate`） |
| `keepAwake` | ✅ | ❌ | Easycontrol 自定义（对应官方的 `stay_awake`） |
| `supportH265` | ✅ | ❌ | **Easycontrol 魔改**（官方用 `video_codec=h265`） |
| `supportOpus` | ✅ | ❌ | **Easycontrol 魔改**（官方用 `audio_codec=opus`） |
| `startApp` | ✅ | ❌ | Easycontrol 自定义 |
| `scid` | ❌ | ✅ | 官方独有（会话 ID） |
| `video_codec` | ❌ | ✅ | 官方独有（h264/h265/av1） |
| `audio_codec` | ❌ | ✅ | 官方独有（opus/aac/flac/raw） |
| `video_source` | ❌ | ✅ | 官方独有（display/camera） |
| `audio_source` | ❌ | ✅ | 官方独有（output/mic） |
| `control` | ❌ | ✅ | 官方独有（是否启用控制） |
| `display_id` | ❌ | ✅ | 官方独有（显示器 ID） |
| `camera_*` | ❌ | ✅ | 官方独有（摄像头相关参数） |
| `new_display` | ❌ | ✅ | 官方独有（虚拟显示器） |
| ... | ❌ | ✅ | 官方还有 30+ 个参数 |

### 4. 启动命令对比

#### Easycontrol
```bash
app_process -Djava.class.path=/data/local/tmp/easycontrol_server_xxx.jar / \
  top.saymzx.easycontrol.server.Server \
  serverPort=25166 \
  listenClip=1 \
  isAudio=1 \
  maxSize=1600 \
  maxFps=60 \
  maxVideoBit=4 \
  keepAwake=1 \
  supportH265=1 \
  supportOpus=1 \
  startApp=com.example.app
```

#### 官方 Scrcpy
```bash
app_process / com.genymobile.scrcpy.Server 2.7 \
  scid=12345678 \
  log_level=info \
  video=true \
  audio=true \
  video_codec=h264 \
  audio_codec=opus \
  max_size=1920 \
  video_bit_rate=8000000 \
  audio_bit_rate=128000 \
  max_fps=60 \
  control=true \
  display_id=0 \
  show_touches=false \
  stay_awake=true \
  clipboard_autosync=true \
  power_on=true \
  ... (还有 30+ 个参数)
```

## 魔改实现细节

### 1. supportOpus 的实现逻辑

```java
// Easycontrol/server/src/main/java/top/saymzx/easycontrol/server/helper/AudioEncode.java
public static boolean init() throws IOException {
    // 检查客户端和设备是否都支持 Opus
    useOpus = Options.supportOpus && EncodecTools.isSupportOpus();
    
    // 如果不支持 Opus，则回退到其他编解码器
    // ...
}
```

### 2. 编解码器检测

```java
// Easycontrol/server/src/main/java/top/saymzx/easycontrol/server/helper/EncodecTools.java
public static boolean isSupportOpus() {
    if (opusEncodecList == null) getEncodecList();
    return opusEncodecList.size() > 0;
}
```

### 3. 客户端检测

```java
// Easycontrol/app/src/main/java/top/saymzx/easycontrol/app/client/decode/DecodecTools.java
public static boolean isSupportOpus() {
    if (isSupportOpus != null) return isSupportOpus;
    if (opusDecodecList == null) getDecodecList();
    isSupportOpus = opusDecodecList.size() > 0;
    return isSupportOpus;
}
```

## 总结

1. **Easycontrol 不是官方 scrcpy server 的简单修改**，而是自己实现的简化版本
2. **supportOpus 是 Easycontrol 自定义的参数**，官方 scrcpy 没有这个参数
3. **官方 scrcpy 使用 `audio_codec=opus` 来指定音频编解码器**，支持 opus/aac/flac/raw
4. **Easycontrol 简化了参数系统**，只保留了 10 个核心参数，去掉了官方的 40+ 个参数
5. **两者的参数命名和格式完全不兼容**，不能混用

## 建议

如果你的项目需要兼容官方 scrcpy server，应该：
- 使用 `audio_codec=opus` 而不是 `supportOpus=1`
- 使用 `video_codec=h265` 而不是 `supportH265=1`
- 参考官方 Options.java 的完整参数列表
- 第一个参数必须是客户端版本号
