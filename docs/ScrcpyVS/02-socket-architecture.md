你说得对！让我重新深入分析 scrcpy 原生架构（scrcpy-mobile-ios 使用的就是这个）：

完美！现在我看清楚了 scrcpy 的完整架构。让我继续查看更多细节：

完美！现在我完全理解了。让我整理完整的 scrcpy 架构：

## **scrcpy 原生架构完整分析（scrcpy-mobile-ios 使用）**

### **1. 多 Socket 架构**

scrcpy 使用 **3 个独立的 TCP Socket**：

```c
// server.h:92-94
sc_socket video_socket;    // 视频流
sc_socket audio_socket;    // 音频流
sc_socket control_socket;  // 控制流（双向）
```

### **2. Socket 连接顺序（server.c:600-680）**

#### **adb reverse 模式**（默认）
```c
// 服务端监听，客户端依次 accept
video_socket = net_accept_intr(tunnel->server_socket);
audio_socket = net_accept_intr(tunnel->server_socket);
control_socket = net_accept_intr(tunnel->server_socket);
```

#### **adb forward 模式**
```c
// 客户端主动连接，重试 100 次，间隔 100ms
first_socket = connect_to_server(server, 100, 100ms, host, port);
// 然后依次连接其他 socket
audio_socket = net_connect_intr(audio_socket, host, port);
control_socket = net_connect_intr(control_socket, host, port);
```

### **3. Socket 优化设置**

#### **控制流专属优化（server.c:687-690）**
```c
// 仅对 control_socket 启用 TCP_NODELAY（禁用 Nagle 算法）
net_set_tcp_nodelay(control_socket, true);
```

#### **接收模式（net.c:215-217）**
```c
// 所有 socket 使用 MSG_WAITALL 标志，确保接收完整数据
ssize_t net_recv_all(sc_socket socket, void *buf, size_t len) {
    return recv(raw_sock, buf, len, MSG_WAITALL);
}
```

### **4. Server 启动参数（server.c:270-308）**

```bash
CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server \
  scid=<随机ID> \
  log_level=<级别> \
  video_bit_rate=<码率> \      # 如 4000000 (4M)
  audio_bit_rate=<码率> \      # 如 128000 (128K)
  max_size=<分辨率> \          # 如 1920
  max_fps=<帧率> \             # 如 60
  video_codec=<编码> \         # h264/h265/av1
  audio_codec=<编码> \         # opus/aac/flac
  control=true/false \
  tunnel_forward=true/false
```

### **5. 数据流处理**

#### **视频流（demuxer.c）**
```c
// video_socket 接收流程
sc_demuxer_recv_codec_id(demuxer, &codec_id);        // 4 字节编码 ID
sc_demuxer_recv_video_size(demuxer, &width, &height); // 8 字节分辨率
// 循环接收数据包
sc_demuxer_recv_packet(demuxer, packet) {
    net_recv_all(socket, header, 12);  // 12 字节头：PTS(8) + Size(4)
    net_recv_all(socket, packet->data, len);  // 实际数据
}
```

#### **音频流（demuxer.c）**
```c
// audio_socket 接收流程（与视频相同）
sc_demuxer_recv_codec_id(demuxer, &codec_id);  // 4 字节编码 ID
// 循环接收数据包
sc_demuxer_recv_packet(demuxer, packet);
```

#### **控制流（controller.c + receiver.c）**
```c
// 发送控制消息（controller.c:137）
net_send_all(control_socket, serialized_msg, length);

// 接收设备消息（receiver.c:192）
net_recv(control_socket, buf + head, DEVICE_MSG_MAX_SIZE - head);
```

### **6. 缓冲参数**

#### **客户端缓冲（options.c:66-68）**
```c
.video_buffer = 0,                          // 视频缓冲：0ms（实时）
.audio_buffer = -1,                         // 音频缓冲：自动（50ms 或 120ms）
.audio_output_buffer = SC_TICK_FROM_MS(5),  // 音频输出缓冲：5ms
```

#### **scrcpy-mobile-ios 默认配置（ScrcpyClient.m:460-463）**
```objective-c
@"--video-buffer=33"   // 视频缓冲：33ms
@"--audio-buffer=60"   // 音频缓冲：60ms
@"--max-fps=60"        // 帧率：60fps
```

### **7. 关键差异对比**

| 特性 | scrcpy (scrcpy-mobile-ios) | Easycontrol |
|------|---------------------------|-------------|
| **Socket 数量** | 3 个（video + audio + control） | 2 个（video + main） |
| **控制流优化** | TCP_NODELAY（禁用 Nagle） | 无特殊优化 |
| **接收模式** | MSG_WAITALL（阻塞完整接收） | 标准 recv |
| **音频支持** | 独立 audio_socket | 混合在 video_socket |
| **视频缓冲** | 33ms（可配置） | 无显式参数 |
| **音频缓冲** | 60ms（可配置） | 40ms 包，最大 640ms |
| **连接重试** | 100 次 × 100ms = 10s | 40 次 × 375ms = 15s |

### **8. 核心优势**

scrcpy 的架构优势：
1. **三路分离**：视频、音频、控制完全独立，互不阻塞
2. **TCP_NODELAY**：控制流低延迟（触摸、按键响应快）
3. **MSG_WAITALL**：保证数据完整性，减少分包处理
4. **灵活缓冲**：video_buffer 和 audio_buffer 可独立调节延迟

Easycontrol 的双 Socket 设计主要解决 ADB 转发的同步阻塞问题，而 scrcpy 原生就是为直连优化的。