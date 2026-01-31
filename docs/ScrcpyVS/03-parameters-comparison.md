你说得对，让我查看 adb-mobile-ios 项目中的相关配置。

很好！找到了关键信息。让我继续查看更多细节：

根据对两个项目的深入分析，我整理了完整的参数对比：

## **完整参数对比总结**

### **1. scrcpy-mobile-ios + adb-mobile-ios**

#### Socket 缓冲区设置 (adb_listeners.cpp:86)
```cpp
int rcv_buf_size = CHUNK_SIZE;  // 接收缓冲区：64KB
adb_setsockopt(fd.get(), SOL_SOCKET, SO_RCVBUF, &rcv_buf_size, sizeof(rcv_buf_size));
```

#### 发送缓冲区 (commandline.cpp:848, 937)
```cpp
int opt = CHUNK_SIZE;  // 发送缓冲区：64KB
adb_setsockopt(out_fd, SOL_SOCKET, SO_SNDBUF, &opt, sizeof(opt));
char buf[CHUNK_SIZE];  // 64KB 传输缓冲
```
**注**：CHUNK_SIZE = 64 * 1024 = 65536 bytes (64KB)

#### Scrcpy 启动参数 (ScrcpyClient.m)
```objective-c
@"--display-buffer=33"      // 视频渲染缓冲：33ms (已废弃，改用 video-buffer)
@"--video-buffer=33"        // 视频缓冲：33ms
@"--audio-buffer=60"        // 音频缓冲：60ms
@"--max-fps=60"             // 帧率：60fps (省电模式 30fps)
```

#### ADB 连接超时 (transport.cpp:147)
```cpp
static constexpr const std::chrono::seconds kDefaultTimeout = 3s;  // 重连超时 3秒
static constexpr const size_t kMaxAttempts = 20;                   // 最多重试 20次
```

#### Scrcpy 延迟缓冲实现 (scrcpy-porting.c:71-78)
```c
// 修复重连后视频/音频缓冲无法继续的问题
sc_delay_buffer_init_hijack(struct sc_delay_buffer *db, sc_tick delay, bool first_frame_asap) {
    sc_delay_buffer_init(db, delay, first_frame_asap);
    db->stopped = false;  // 重置停止状态
}
```

---

### **2. Easycontrol**

#### Server 启动命令 (ClientStream.java:75-86)
```java
"app_process -Djava.class.path=" + serverName + " / top.saymzx.easycontrol.server.Server"
+ " maxSize=" + device.maxSize           // 视频分辨率
+ " maxFps=" + device.maxFps             // 最大帧率
+ " maxVideoBit=" + device.maxVideoBit   // 视频码率
```

#### Socket 连接超时 (ClientStream.java:35, 101-106)
```java
private static final int timeoutDelay = 1000 * 15;  // 总超时 15秒

mainSocket.connect(inetSocketAddress, timeoutDelay / 2);   // 主控制流：7.5秒
videoSocket.connect(inetSocketAddress, timeoutDelay / 2);  // 视频流：7.5秒
```

#### 音频包大小 (AudioCapture.java:33)
```java
public static final int AUDIO_PACKET_SIZE = 
    SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * 40 / 1000;
// = 48000 * 2 * 2 * 40 / 1000 = 7680 bytes (40ms 音频包)
```

#### 音频缓冲区 (AudioCapture.java:33, AudioDecode.java:113)
```java
// 录音缓冲
int MINI_BUFFER_SIZE = Math.min(
    AudioRecord.getMinBufferSize(...), 
    AUDIO_PACKET_SIZE * 4  // 160ms
);

// 播放缓冲
int bufferSize = Math.min(
    AudioTrack.getMinBufferSize(...) * 8,
    16 * AUDIO_PACKET_SIZE  // 640ms 最大
);
```

#### BufferStream 刷新机制 (ClientStream.java:176-184)
```java
public ByteBuffer readFrameFromVideo() throws Exception {
    if (!connectDirect) videoBufferStream.flush();  // ADB 转发模式需手动刷新
    int size = readIntFromVideo();
    return readByteArrayFromVideo(size);
}
```

---

## **关键差异**

| 参数 | scrcpy-mobile-ios | Easycontrol |
|------|-------------------|-------------|
| **Socket 架构** | 单连接 (scrcpy 原生) | 双 Socket (main + video) |
| **Socket 缓冲** | 64KB (CHUNK_SIZE) | 系统默认 |
| **视频缓冲** | 33ms (video-buffer) | 无显式参数 |
| **音频缓冲** | 60ms | 40ms 包，最大 640ms |
| **连接超时** | 3s × 20次 = 60s | 7.5s × 2 = 15s |
| **重连机制** | ADB 自动重连 | 手动重试 40次 |
| **缓冲刷新** | 自动 | ADB 模式需手动 flush |

Easycontrol 的双 Socket 设计避免了 ADB 同步阻塞，scrcpy-mobile-ios 依赖原生 scrcpy 的 delay_buffer 机制控制延迟。