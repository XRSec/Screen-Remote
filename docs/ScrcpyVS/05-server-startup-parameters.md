# Server 启动参数完整对比

本文档详细对比 scrcpy-mobile-ios、Easycontrol 和本地项目的 scrcpy_server 启动命令、socket 缓冲参数、视频渲染参数和控制流参数。

---

## **1. scrcpy-mobile-ios** (基于 scrcpy v2.3 原生)

### 完整启动命令 (server.c:230-308)
```bash
CLASSPATH=/data/local/tmp/scrcpy-server.jar \
app_process / com.genymobile.scrcpy.Server \
  2.3 \                              # scrcpy 版本
  scid=<随机8位16进制> \              # 会话ID
  log_level=debug \                  # 日志级别
  video_bit_rate=4000000 \           # 视频码率：4Mbps
  audio_bit_rate=128000 \            # 音频码率：128Kbps
  max_size=1920 \                    # 最大分辨率
  max_fps=60 \                       # 最大帧率：60fps
  video_codec=h264 \                 # 视频编码
  audio_codec=opus \                 # 音频编码（默认）
  control=true \                     # 启用控制
  tunnel_forward=false               # 使用 adb reverse
```

### iOS 客户端默认参数 (ScrcpyClient.m:460-463)
```objective-c
@"--verbosity=debug"
@"--shortcut-mod=lctrl+rctrl"
@"--fullscreen"
@"--video-buffer=33"            // 视频缓冲：33ms（替代废弃的 display-buffer）
@"--video-bit-rate=4M"
@"--audio-bit-rate=128K"
@"--audio-buffer=60"            // 音频缓冲：60ms
@"--no-audio"                   // 默认禁用音频
@"--max-fps=60"                 // 最大帧率：60fps（省电模式 30fps）
@"--print-fps"
```

### 关键时间参数详解

#### 视频缓冲 (options.c:65, scrcpy.c:837)
```c
.video_buffer = 0,  // 默认 0ms（实时），iOS 设置为 33ms
```
- **作用**：延迟缓冲，平滑视频播放，减少抖动
- **实现**：`sc_delay_buffer` 使用独立线程 + 条件变量 + 时钟同步
- **计算**：`deadline = sc_clock_to_system_time(&db->clock, pts) + delay`
- **iOS 配置**：33ms ≈ 2 帧 @ 60fps
- **⚠️ 不受码率/分辨率影响**：无论 4Mbps 还是 8Mbps，都延迟 33ms

#### 音频缓冲 (options.c:66, cli.c:2899-2911)
```c
.audio_buffer = -1,  // 自动：Opus/AAC 50ms, FLAC 120ms
.audio_output_buffer = SC_TICK_FROM_MS(5),  // 输出缓冲：5ms
```
- **作用**：音频播放缓冲，防止卡顿
- **iOS 配置**：60ms（手动设置）
- **✅ 自动计算逻辑**：
  ```c
  if (opts->audio_codec == SC_CODEC_FLAC) {
      opts->audio_buffer = SC_TICK_FROM_MS(120);  // FLAC 块大（4096 samples ≈ 85ms）
  } else {
      opts->audio_buffer = SC_TICK_FROM_MS(50);   // Opus/AAC 低延迟
  }
  ```
- **样本数计算**：`samples = buffer_ms * sample_rate / 1000`
  - 48kHz @ 50ms = 2400 samples
  - 48kHz @ 120ms = 5760 samples

#### 帧率限制 (max_fps)
- **60fps**：正常模式，流畅体验
- **30fps**：省电模式，降低 CPU 占用
- **实现**：Server 端限制编码帧率
- **缓冲影响**：60fps 时 33ms 缓冲 ≈ 2 帧，30fps 时 ≈ 1 帧

---

## **2. Easycontrol** (自定义协议)

### 完整启动命令 (ClientStream.java:75-86)
```bash
app_process -Djava.class.path=/data/local/tmp/easycontrol_server_<版本>.jar \
  / top.saymzx.easycontrol.server.Server \
  serverPort=27183 \                 # 服务端口
  listenClip=1 \                     # 监听剪贴板
  isAudio=1 \                        # 启用音频
  maxSize=1920 \                     # 最大分辨率
  maxFps=60 \                        # 最大帧率
  maxVideoBit=8000000 \              # 视频码率：8Mbps
  keepAwake=1 \                      # 保持唤醒
  supportH265=0 \                    # H265 支持
  supportOpus=0 \                    # Opus 支持
  startApp=<包名>                     # 启动应用
```

### Socket 连接超时 (ClientStream.java:35, 101-106)
```java
private static final int timeoutDelay = 1000 * 15;  // 总超时：15秒
int reTry = 40;                                      // 重试次数：40次
int reTryTime = timeoutDelay / reTry;                // 重试间隔：375ms

// 直连模式 Socket 连接
mainSocket.connect(inetSocketAddress, timeoutDelay / 2);   // 主控制流：7.5秒
videoSocket.connect(inetSocketAddress, timeoutDelay / 2);  // 视频流：7.5秒

// ADB 转发模式重试
for (int i = 0; i < reTry; i++) {
    Thread.sleep(reTryTime);  // 每次间隔 375ms
}
```

### 音频缓冲参数详解

#### 音频包大小 (AudioCapture.java:33)
```java
public static final int SAMPLE_RATE = 48000;        // 采样率：48kHz
public static final int CHANNELS = 2;               // 声道：立体声
private static final int BYTES_PER_SAMPLE = 2;      // 位深：16bit

// 音频包大小 = 48000 * 2 * 2 * 40 / 1000 = 7680 bytes
public static final int AUDIO_PACKET_SIZE = 
    SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * 40 / 1000;  // 40ms 音频包
```

#### 录音缓冲 (AudioCapture.java:33)
```java
private static final int MINI_BUFFER_SIZE = Math.min(
    AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, ENCODING),
    AUDIO_PACKET_SIZE * 4  // 4 * 40ms = 160ms 最大录音缓冲
);
```

#### 播放缓冲 (AudioDecode.java:113)
```java
int bufferSize = Math.min(
    AudioTrack.getMinBufferSize(...) * 8,
    16 * AUDIO_PACKET_SIZE  // 16 * 40ms = 640ms 最大播放缓冲
);
```

### BufferStream 刷新机制 (ClientStream.java:176-184)
```java
public ByteBuffer readFrameFromVideo() throws Exception {
    if (!connectDirect) videoBufferStream.flush();  // ADB 转发模式需手动刷新
    int size = readIntFromVideo();
    return readByteArrayFromVideo(size);
}
```
- **直连模式**：无需刷新，TCP 自动传输
- **ADB 转发模式**：需手动 flush，避免 ADB 同步阻塞

---

## **3. Socket 缓冲参数对比**

### scrcpy-mobile-ios (adb-mobile-ios)

#### Socket 缓冲设置 (adb_listeners.cpp:86, commandline.cpp:848)
```cpp
#define CHUNK_SIZE (64 * 1024)  // 64KB = 65536 bytes（固定值）

// 接收缓冲区
int rcv_buf_size = CHUNK_SIZE;
adb_setsockopt(fd.get(), SOL_SOCKET, SO_RCVBUF, &rcv_buf_size, sizeof(rcv_buf_size));

// 发送缓冲区
int opt = CHUNK_SIZE;
adb_setsockopt(out_fd, SOL_SOCKET, SO_SNDBUF, &opt, sizeof(opt));

// 传输缓冲
char buf[CHUNK_SIZE];  // 64KB 块传输
```

**⚠️ 重要特性**：
- **完全固定**：不受 `video_bit_rate`、`max_size`、`max_fps` 影响
- **设计原因**：
  - Socket 缓冲是传输层，与应用层码率无关
  - 64KB 可容纳多个视频帧（1080p H264 I帧 ~50KB）
  - 现代 TCP 有自动窗口缩放机制
  - 固定值简化实现，避免复杂计算

#### TCP 优化 (server.c:688, net.c:276)
```c
// 仅对 control_socket 启用 TCP_NODELAY（禁用 Nagle 算法）
net_set_tcp_nodelay(control_socket, true);

// 所有 socket 使用 MSG_WAITALL 接收
ssize_t net_recv_all(sc_socket socket, void *buf, size_t len) {
    return recv(raw_sock, buf, len, MSG_WAITALL);
}
```

### Easycontrol

#### Socket 缓冲
- **无显式设置**：使用系统默认缓冲区大小
- **依赖 TCP 自动调优**

#### 连接重试机制
```java
int reTry = 40;                          // 重试次数
int reTryTime = timeoutDelay / reTry;    // 375ms 间隔
```

---

## **4. 视频渲染参数对比**

| 参数 | scrcpy-mobile-ios | Easycontrol | 说明 |
|------|-------------------|-------------|------|
| **视频缓冲** | 33ms | 无 | scrcpy 使用 delay_buffer 平滑播放 |
| **缓冲实现** | 独立线程 + 条件变量 | 直接渲染 | scrcpy 有完整的时钟同步机制 |
| **首帧策略** | first_frame_asap=true | 立即显示 | scrcpy 首帧不延迟 |
| **时钟同步** | sc_clock_update() | 无 | scrcpy 维护 PTS 到系统时间映射 |

### scrcpy delay_buffer 实现 (delay_buffer.c:37-90)
```c
static int run_buffering(void *data) {
    struct sc_delay_buffer *db = data;
    
    for (;;) {
        // 1. 等待队列有帧
        sc_cond_wait(&db->queue_cond, &db->mutex);
        
        // 2. 取出帧
        struct sc_delayed_frame dframe = sc_vecdeque_pop(&db->queue);
        
        // 3. 计算延迟时间
        sc_tick pts = SC_TICK_FROM_US(dframe.frame->pts);
        sc_tick deadline = sc_clock_to_system_time(&db->clock, pts) + db->delay;
        
        // 4. 等待到达播放时间
        sc_cond_timedwait(&db->wait_cond, &db->mutex, deadline);
        
        // 5. 推送到渲染器
        sc_frame_source_sinks_push(&db->frame_source, dframe.frame);
    }
}
```

---

## **5. 控制流参数对比**

| 参数 | scrcpy-mobile-ios | Easycontrol | 说明 |
|------|-------------------|-------------|------|
| **消息队列** | 60 条限制 | 无队列 | scrcpy 有背压控制 |
| **TCP_NODELAY** | ✅ control_socket | ❌ 无 | scrcpy 控制流低延迟 |
| **发送线程** | 独立线程 | 直接发送 | scrcpy 异步解耦 |
| **消息丢弃** | 可丢弃消息自动丢弃 | 无策略 | scrcpy 触摸移动可丢弃 |

### scrcpy 控制流实现 (controller.c:95-120)
```c
#define SC_CONTROL_MSG_QUEUE_LIMIT 60

bool sc_controller_push_msg(struct sc_controller *controller,
                           const struct sc_control_msg *msg) {
    sc_mutex_lock(&controller->mutex);
    size_t size = sc_vecdeque_size(&controller->queue);
    
    if (size < SC_CONTROL_MSG_QUEUE_LIMIT) {
        // 队列未满，直接入队
        sc_vecdeque_push_noresize(&controller->queue, *msg);
        sc_cond_signal(&controller->msg_cond);  // 唤醒发送线程
    } else if (!sc_control_msg_is_droppable(msg)) {
        // 队列已满，但消息不可丢弃（剪贴板、按键）
        sc_vecdeque_push(&controller->queue, *msg);
    }
    // 否则丢弃消息（触摸移动事件）
    
    sc_mutex_unlock(&controller->mutex);
}
```

---

## **6. 连接重试参数对比**

### scrcpy-mobile-ios (server.c:640, transport.cpp:147)
```c
// Socket 连接重试
unsigned attempts = 100;                    // 重试次数：100次
sc_tick delay = SC_TICK_FROM_MS(100);      // 重试间隔：100ms
// 总超时：100 × 100ms = 10秒

// ADB 重连超时
static constexpr const std::chrono::seconds kDefaultTimeout = 3s;  // 单次超时：3秒
static constexpr const size_t kMaxAttempts = 20;                   // 最大重试：20次
// 总超时：20 × 3s = 60秒
```

### Easycontrol (ClientStream.java:35, 93-106)
```java
private static final int timeoutDelay = 1000 * 15;  // 总超时：15秒
int reTry = 40;                                      // 重试次数：40次
int reTryTime = timeoutDelay / reTry;                // 重试间隔：375ms

// Socket 连接超时
mainSocket.connect(inetSocketAddress, timeoutDelay / 2);  // 7.5秒
videoSocket.connect(inetSocketAddress, timeoutDelay / 2); // 7.5秒
```

---

## **7. 参数变化的实际影响**

### 场景分析

#### 场景 1: 提高视频码率（4M → 8M）

| 参数 | 是否变化 | 影响 |
|------|---------|------|
| **Socket 缓冲** | ❌ 不变（64KB） | 无影响 |
| **video_buffer** | ❌ 不变（33ms） | 无影响 |
| **帧大小** | ✅ 增加（~2倍） | 帧缓冲队列自动扩展 |
| **带宽需求** | ✅ 增加（~2倍） | 网络压力增大 |

**结论**：Socket 缓冲不变，但帧缓冲队列会自动扩展（`sc_vecdeque_push`）

#### 场景 2: 提高分辨率（720p → 1080p）

| 参数 | 是否变化 | 影响 |
|------|---------|------|
| **Socket 缓冲** | ❌ 不变（64KB） | 无影响 |
| **video_buffer** | ❌ 不变（33ms） | 无影响 |
| **帧大小** | ✅ 增加（~2.25倍） | 帧缓冲队列自动扩展 |
| **解码时间** | ✅ 增加 | 可能需要手动增加 video_buffer |

**建议**：4K 视频建议手动增加 `video_buffer` 到 50-100ms

#### 场景 3: 提高帧率（30fps → 60fps）

| 参数 | 是否变化 | 影响 |
|------|---------|------|
| **Socket 缓冲** | ❌ 不变（64KB） | 无影响 |
| **video_buffer** | ❌ 不变（33ms） | 缓冲帧数增加（1帧 → 2帧） |
| **控制队列** | ❌ 不变（60条） | 仍可缓冲 1 秒触摸 |
| **带宽需求** | ✅ 增加（~2倍） | 网络压力增大 |

**结论**：所有缓冲参数不变，但 33ms 内缓冲的帧数从 1 帧变为 2 帧

#### 场景 4: 切换音频编码（Opus → FLAC）

| 参数 | 是否变化 | 影响 |
|------|---------|------|
| **Socket 缓冲** | ❌ 不变（64KB） | 无影响 |
| **audio_buffer** | ✅ 自动调整（50ms → 120ms） | 延迟增加 70ms |
| **音频码率** | ✅ 增加（128K → 1M+） | 带宽压力增大 |

**结论**：音频缓冲自动调整，这是**唯一会动态变化的缓冲参数**

### 何时需要手动调整缓冲？

| 场景 | 建议调整 | 原因 |
|------|---------|------|
| **4K 视频** | `video_buffer` → 50-100ms | 帧更大，解码慢 |
| **低端设备** | `video_buffer` → 100ms | 解码慢，需要更多缓冲 |
| **高延迟网络** | `video_buffer` → 200ms | 网络抖动大 |
| **FLAC 音频** | 自动 → 120ms | 编码块大（4096 samples） |
| **实时控制** | `video_buffer` → 0ms | 降低延迟 |

---

## **8. 关键差异总结**

| 特性 | scrcpy-mobile-ios | Easycontrol |
|------|-------------------|-------------|
| **Socket 架构** | 3 路（video + audio + control） | 2 路（main + video） |
| **Socket 缓冲** | 64KB (CHUNK_SIZE) | 系统默认 |
| **TCP_NODELAY** | ✅ control_socket | ❌ 无 |
| **MSG_WAITALL** | ✅ 所有接收 | ❌ 标准 recv |
| **视频缓冲** | 33ms (delay_buffer) | 无显式参数 |
| **音频缓冲** | 60ms | 40ms 包，最大 640ms |
| **控制队列** | 60 条 + 背压控制 | 无队列 |
| **连接超时** | 10s (socket) + 60s (adb) | 15s (总超时) |
| **重连机制** | ADB 自动重连 | 手动重试 40 次 |
| **缓冲刷新** | 自动 | ADB 模式需手动 flush |

### 核心优势

**scrcpy-mobile-ios**：
- 完整的时间同步机制（delay_buffer + clock）
- 消息队列 + 背压控制
- TCP_NODELAY 低延迟控制
- MSG_WAITALL 保证数据完整性
- 64KB Socket 缓冲减少系统调用
- **音频缓冲自动计算**（Opus/AAC 50ms, FLAC 120ms）
- **Socket 缓冲固定不变**（不受码率/分辨率影响）

**Easycontrol**：
- 双 Socket 避免 ADB 同步阻塞
- 简化实现，无复杂缓冲机制
- 直连模式性能更好
- 音频缓冲固定（40ms 包，最大 640ms）

### 缓冲参数设计哲学

| 设计原则 | scrcpy-mobile-ios | 说明 |
|---------|-------------------|------|
| **Socket 层** | 固定 64KB | 传输层与应用层解耦 |
| **视频缓冲** | 用户配置 | 根据场景手动调整 |
| **音频缓冲** | 自动计算 | 根据编码格式智能选择 |
| **控制队列** | 固定 60 条 | 简单有效的背压控制 |

**核心思想**：简单固定 > 复杂动态，64KB Socket 缓冲适用于绝大多数场景
