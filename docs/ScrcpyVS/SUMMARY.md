# 三方架构完整对比总结

## 1. 架构设计对比

### Socket 架构

| 特性 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|------|-------------------|-------------|---------|
| **Socket 数量** | 3 个（video + audio + control） | 2 个（video + main） | 3 个（video + audio + control） |
| **连接模式** | adb reverse（默认）/ forward | TCP 直连 / ADB 转发 | ADB forward |
| **连接重试** | 100 次 × 100ms = 10s | 40 次 × 375ms = 15s | 10 次 × 500ms = 5s |
| **音频独立** | ✅ 独立 audio_socket | ❌ 混合在 video | ✅ 独立 audio_socket |

### 控制流架构

| 特性 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|------|-------------------|-------------|---------|
| **发送机制** | 独立线程 + 消息队列 | 直接发送 | 协程 + Mutex |
| **消息队列** | ✅ 60 条限制 | ❌ 无 | ❌ 无 |
| **背压控制** | ✅ 自动丢弃可丢弃消息 | ❌ 无 | ❌ 无 |
| **优先级** | ✅ 关键消息永不丢弃 | ❌ 无 | ❌ 无 |
| **线程模型** | 专用 C 线程 | Java 线程 | Kotlin 协程 |

---

## 2. 性能优化对比

### Socket 优化

| 优化项 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|--------|-------------------|-------------|---------|
| **TCP_NODELAY** | ✅ control_socket | ❌ 无 | ✅ 所有 socket |
| **SO_RCVBUF** | ✅ 64KB | ❌ 系统默认 | ✅ 64KB |
| **SO_SNDBUF** | ✅ 64KB | ❌ 系统默认 | ✅ 64KB |
| **MSG_WAITALL** | ✅ 所有接收 | ❌ 标准 recv | ❌ 标准 recv |

### 缓冲策略

| 缓冲类型 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|---------|-------------------|-------------|---------|
| **视频缓冲** | 33ms（可配置） | 无显式参数 | 0ms（实时） |
| **音频缓冲** | 60ms（可配置） | 40ms 包，最大 640ms | 50ms（自动） |
| **输出缓冲** | 5ms | - | - |

---

## 3. 参数对比

### Socket 缓冲区设置

| 特性 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|------|-------------------|-------------|---------|
| **SO_RCVBUF** | ✅ 64KB | ❌ 系统默认 | ✅ 64KB |
| **SO_SNDBUF** | ✅ 64KB | ❌ 系统默认 | ✅ 64KB |
| **TCP_NODELAY** | ✅ control_socket | ❌ 无 | ✅ 所有 socket |
| **MSG_WAITALL** | ✅ 所有接收 | ❌ 标准 recv | ❌ 标准 recv |
| **传输缓冲** | 64KB 块 | 系统默认 | 256B（可优化） |

### 启动参数配置

| 参数 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|------|-------------------|-------------|---------|
| **视频码率** | 4Mbps | 8Mbps | 8Mbps |
| **音频码率** | 128Kbps | 128Kbps | 128Kbps |
| **最大分辨率** | 1920 | 1920 | 1080 |
| **最大帧率** | 60fps (省电 30fps) | 60fps | 60fps |
| **视频编码** | H264 | H264/H265 | H264 |
| **音频编码** | Opus | AAC/Opus | AAC |

### 缓冲策略

| 缓冲类型 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|---------|-------------------|-------------|---------|
| **视频缓冲** | 33ms（可配置） | 无显式参数 | 0ms（实时） |
| **音频缓冲** | 60ms（可配置） | 40ms 包，最大 640ms | 50ms（自动） |
| **输出缓冲** | 5ms | - | - |
| **缓冲实现** | delay_buffer 独立线程 | 直接渲染 | 直接渲染 |

---

## 4. 数据流处理对比

### 视频流

| 处理阶段 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|---------|-------------------|-------------|---------|
| **接收** | `net_recv_all()` + MSG_WAITALL | `DataInputStream.readFully()` | `Socket.getInputStream().read()` |
| **解析** | `sc_demuxer_recv_packet()` | 自定义协议 | `ScrcpySocketStream` |
| **解码** | iOS VideoToolbox | Android MediaCodec | Android MediaCodec |
| **渲染** | SDL2 / AVSampleBufferDisplayLayer | TextureView | Surface |

### 音频流

| 处理阶段 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|---------|-------------------|-------------|---------|
| **接收** | 独立 audio_socket | 混合在 video_socket | 独立 audio_socket |
| **解码** | iOS AudioUnit | Android MediaCodec | Android MediaCodec |
| **播放** | AudioUnit | AudioTrack | AudioTrack |
| **缓冲** | 60ms | 40ms 包，最大 640ms | 50ms（自动） |

### 控制流

| 处理阶段 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|---------|-------------------|-------------|---------|
| **消息入队** | `sc_controller_push_msg()` | 直接发送 | 直接发送 |
| **序列化** | `sc_control_msg_serialize()` | 手动序列化 | 手动序列化 |
| **发送** | `net_send_all()` | `OutputStream.write()` | `OutputStream.write()` |
| **接收** | `net_recv()` | `DataInputStream.read()` | - |

---

## 5. 性能指标对比

### 延迟

| 场景 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|------|-------------------|-------------|---------|
| **视频延迟** | 33ms（缓冲） + 网络 | 网络延迟 | 网络延迟 |
| **音频延迟** | 60ms（缓冲） + 网络 | 40-640ms | 50ms + 网络 |
| **控制延迟** | < 10ms（TCP_NODELAY） | ~15ms | < 10ms（TCP_NODELAY） |
| **时钟同步** | ✅ sc_clock | ❌ 无 | ❌ 无 |

### 资源占用

| 指标 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|------|-------------------|-------------|---------|
| **CPU 占用** | 低（C/C++ 实现） | 中（Java 实现） | 中（Kotlin 实现） |
| **内存占用** | 低（原生代码） | 中（JVM） | 中（ART） |
| **线程数** | 3-5 个 | 5-8 个 | 协程池 |

---

## 6. 稳定性对比

### 错误处理

| 场景 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|------|-------------------|-------------|---------|
| **Socket 断开** | 自动重连（20 次） | 手动重试（40 次） | 自动重连（3 次） |
| **解码失败** | 降级处理 | 跳过帧 | 跳过帧 |
| **队列满** | 丢弃可丢弃消息 | 阻塞 | 阻塞 |

### 重连机制

| 特性 | scrcpy-mobile-ios | Easycontrol | 本地项目 |
|------|-------------------|-------------|---------|
| **Socket 重连** | 100 次 × 100ms = 10s | 40 次 × 375ms = 15s | 10 次 × 500ms = 5s |
| **ADB 重连** | 20 次 × 3s = 60s | 手动重试 | 3 次 × 2s = 6s（指数退避） |
| **状态保持** | ✅ delay_buffer 重置 | ❌ 需重新初始化 | ✅ 保持连接状态 |
| **重连间隔** | 固定间隔 | 固定间隔 | 指数退避 |

---

## 7. 实施建议

### 优先级 P0（已完成）

- ✅ **Socket 缓冲区优化**
  - 接收缓冲：64KB
  - 发送缓冲：64KB
  - 参考：adb-mobile-ios

### 优先级 P1（推荐实施）

- ⏳ **控制流消息队列**
  - 使用 `Channel<ByteArray>(capacity = 60)`
  - 实现背压控制
  - 参考：scrcpy 原生 `sc_controller`

- ⏳ **消息丢弃策略**
  - 触摸移动事件可丢弃
  - 按键、剪贴板事件永不丢弃
  - 参考：`sc_control_msg_is_droppable()`

### 优先级 P2（可选优化）

- ⏳ **SocketForwarder 缓冲优化**
  - 从 256B 提升到 8KB
  - 减少系统调用

- ⏳ **MSG_WAITALL 语义实现**
  - 手动实现完整读取
  - 保证数据完整性

### 优先级 P3（长期优化）

- ⏳ **视频缓冲可配置**
  - 添加 `video_buffer` 参数
  - 支持用户自定义延迟

- ⏳ **音频缓冲优化**
  - 动态调整缓冲大小
  - 根据网络状况自适应

---

## 8. 核心差异总结

### scrcpy-mobile-ios 的优势

1. **成熟的架构**：基于 scrcpy v2.3 原生，经过大量实战验证
2. **完善的优化**：
   - TCP_NODELAY：控制流低延迟（< 10ms）
   - MSG_WAITALL：保证数据完整性
   - 64KB Socket 缓冲：减少系统调用
3. **消息队列机制**：
   - 60 条队列限制
   - 异步解耦 + 背压控制
   - 可丢弃消息自动丢弃（触摸移动）
   - 关键消息永不丢弃（剪贴板、按键）
4. **时间同步机制**：
   - delay_buffer 独立线程
   - sc_clock 时钟同步（PTS → 系统时间）
   - 条件变量精确等待
   - 首帧不延迟策略
5. **三路 Socket 分离**：视频、音频、控制完全独立

### Easycontrol 的特点

1. **双 Socket 设计**：解决 ADB 转发同步阻塞
2. **简化实现**：无复杂的消息队列和时间同步
3. **直连优先**：TCP 直连性能更好
4. **灵活的音频缓冲**：40ms 包，最大 640ms 自适应

### 本地项目的现状

1. **已完成**：Socket 缓冲区优化（64KB）
2. **待改进**：
   - 控制流消息队列
   - 消息丢弃策略
   - 视频缓冲机制（可选）
3. **优势**：Kotlin 协程，代码简洁

---

## 9. 参考资料

### 代码位置

- **scrcpy 原生**
  - Socket 管理：`scrcpy/app/src/server.c`
  - 控制流：`scrcpy/app/src/controller.c`
  - 网络优化：`scrcpy/app/src/util/net.c`
  - 视频缓冲：`scrcpy/app/src/delay_buffer.c`
  - 时钟同步：`scrcpy/app/src/clock.c`

- **adb-mobile-ios**
  - Socket 缓冲：`porting/adb/adb_listeners.cpp`
  - ADB 命令：`porting/adb/client/commandline.cpp`
  - 传输优化：`porting/adb/transport.cpp`

- **Easycontrol**
  - Socket 连接：`app/src/main/java/.../ClientStream.java`
  - 音频缓冲：`server/src/main/java/.../AudioCapture.java`
  - 音频播放：`app/src/main/java/.../AudioDecode.java`

### 关键常量

```c
// scrcpy 原生
#define SC_CONTROL_MSG_QUEUE_LIMIT 60           // 控制消息队列限制
#define SC_TICK_FROM_MS(ms) ((sc_tick) (ms) * 1000)  // 毫秒转 tick

// adb-mobile-ios
#define CHUNK_SIZE (64 * 1024)                  // 64KB Socket 缓冲

// Easycontrol
private static final int timeoutDelay = 1000 * 15;  // 15s 总超时
public static final int AUDIO_PACKET_SIZE = 7680;   // 40ms 音频包
```

### 时间参数汇总

| 参数 | scrcpy-mobile-ios | Easycontrol | 说明 |
|------|-------------------|-------------|------|
| **视频缓冲** | 33ms | 0ms | delay_buffer 延迟 |
| **音频缓冲** | 60ms | 40ms 包 | 播放缓冲 |
| **输出缓冲** | 5ms | - | 音频输出 |
| **Socket 重连间隔** | 100ms | 375ms | 单次重试间隔 |
| **ADB 重连超时** | 3s | - | 单次超时 |
| **控制队列限制** | 60 条 | 无限制 | 背压控制 |
