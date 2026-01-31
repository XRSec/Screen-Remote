# Scrcpy 元数据读取错误分析与修复

## 问题现象

```
16:52:04.391 ComponentStateChanged(component=ControlSocket, state=Connected)
16:52:04.716 Dummy byte: 0x00
16:52:04.737 设备名称: aac��������������������������������U!E��PF��ZZZZZZZZZZZZZZZZZZZZZZZZ
16:52:04.738 设备名称原始字节 (前16字节): 0x61 0x61 0x63 0x80 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x02 0x11
16:52:04.740 Codec 元数据原始字节: 0x5a 0x5a 0x5a 0x5a 0x5a 0x5a 0x5a 0x5a 0x5a 0x5a 0x5a 0x5a
16:52:04.740 Codec ID: 0x5a5a5a5a
16:52:04.741 视频分辨率: 1515870810x1515870810
```

**异常特征**：
- 设备名称前 3 字节正确（`aac`），后续数据错乱
- Codec 元数据全是 `0x5a` 重复
- 解析出错误的分辨率 `1515870810x1515870810`

## 根本原因

### 1. 时序问题

从日志时间戳分析：
```
16:52:04.391 ControlSocket Connected
16:52:04.716 Dummy byte 读取 (时间差 325ms)
```

**问题**：在 Socket 连接后立即读取元数据，但此时 **Scrcpy Server 可能还没来得及发送完整数据**，导致读到了：
- 部分正确数据（设备名称前 3 字节）
- 缓冲区残留数据或未初始化数据（`0x5a` 重复）

### 2. 协议理解错误

**Scrcpy 协议规范**（参考 `external/scrcpy/server/src/main/java/com/genymobile/scrcpy/device/DesktopConnection.java`）：

```java
// Server 端发送顺序
public static DesktopConnection open(..., boolean sendDummyByte) {
    if (video) {
        videoSocket = localServerSocket.accept();
        if (sendDummyByte) {
            // 1. 立即发送 dummy byte (0x00) 作为同步信号
            videoSocket.getOutputStream().write(0);
        }
    }
    // ... audio, control socket 同理
}

public void sendDeviceMeta(String deviceName) {
    // 2. 发送设备名称 (64 bytes)
    byte[] buffer = new byte[64];
    // ...
    IO.writeFully(fd, buffer, 0, buffer.length);
}

// 3. 发送 codec metadata (12 bytes)
```

**Dummy Byte 的作用**：
- **同步信号**：Client 读到它就说明 Socket 已准备好
- **连接检测**：如果读取失败，说明连接有问题

### 3. 原代码问题

**错误做法**（修复前）：
```kotlin
// ConnectionSocketManager.kt
suspend fun connectSockets(...) {
    videoSocket = createAndConnectSocket("video", keyFrameInterval)
    // ❌ 连接后没有读取 dummy byte
    LogManager.d(LogTags.SCRCPY_CLIENT, "Video socket connected")
}

// ConnectionMetadataReader.kt
private fun readVideoMetadata(inputStream: InputStream): Pair<Int, Int> {
    val dis = DataInputStream(inputStream)
    
    // ❌ 在这里才读取 dummy byte，时机太晚
    val dummyByte = dis.readByte()
    
    // 读取设备名称 (64 bytes)
    val deviceNameBytes = ByteArray(64)
    var totalRead = 0
    while (totalRead < 64) {
        // ❌ 使用 read() 循环读取，可能读到部分数据就返回
        val bytesRead = dis.read(deviceNameBytes, totalRead, 64 - totalRead)
        if (bytesRead == -1) throw IOException("...")
        totalRead += bytesRead
    }
    // ...
}
```

**问题分析**：
1. **没有在 Socket 连接后立即读取 dummy byte**，失去了同步信号的作用
2. **使用 `read()` 而非 `readFully()`**，可能在数据未完全到达时就返回部分数据
3. **缺少数据合法性验证**，错误数据被当作正常数据处理

## 修复方案

### 1. 在 Socket 连接后立即读取 dummy byte

```kotlin
// ConnectionSocketManager.kt
suspend fun connectSockets(...) {
    // 连接视频 Socket
    videoSocket = createAndConnectSocket("video", keyFrameInterval)
    // ✅ 立即读取 dummy byte，验证 Server 已准备好
    waitForDummyByte(videoSocket!!, "video")
    
    // 连接音频 Socket
    if (enableAudio) {
        audioSocket = createAndConnectSocket("audio", keyFrameInterval)
        waitForDummyByte(audioSocket!!, "audio")
    }
    
    // 连接控制 Socket
    controlSocket = createAndConnectSocket("control", keyFrameInterval)
    waitForDummyByte(controlSocket!!, "control")
}

/**
 * 等待并验证 dummy byte（Server 准备就绪信号）
 * 参考：scrcpy Server 在 accept 后立即发送 dummy byte (0x00)
 */
private fun waitForDummyByte(socket: Socket, socketType: String) {
    val inputStream = socket.getInputStream()
    val dummyByte = inputStream.read()

    if (dummyByte == -1) {
        throw IOException("$socketType socket: Server 未发送 dummy byte（连接已关闭）")
    }

    if (dummyByte != 0x00) {
        LogManager.w(
            LogTags.SCRCPY_CLIENT,
            "$socketType socket: 收到非预期的 dummy byte: 0x${dummyByte.toString(16).padStart(2, '0')}",
        )
    }

    LogManager.d(
        LogTags.SCRCPY_CLIENT,
        "$socketType socket: Dummy byte 验证通过 (0x${dummyByte.toString(16).padStart(2, '0')})",
    )
}
```

### 2. 使用 readFully() 确保读取完整数据

```kotlin
// ConnectionMetadataReader.kt
private fun readVideoMetadata(inputStream: InputStream): Pair<Int, Int> {
    val dis = DataInputStream(inputStream)

    try {
        // 注意：dummy byte 已在 connectSockets 时读取并验证

        // 1. 设备名称 (64 bytes, null-terminated string)
        val deviceNameBytes = ByteArray(64)
        dis.readFully(deviceNameBytes) // ✅ 使用 readFully 确保读取完整
        
        val deviceName = String(deviceNameBytes, Charsets.UTF_8).trim('\u0000')
        LogManager.d(LogTags.SCRCPY_CLIENT, "设备名称: $deviceName")

        // 2. codec metadata (12 bytes)
        val codecBytes = ByteArray(12)
        dis.readFully(codecBytes) // ✅ 使用 readFully 确保读取完整

        // 解析 codec_id, width, height
        val codecId = ((codecBytes[0].toInt() and 0xFF) shl 24) or ...
        val width = ((codecBytes[4].toInt() and 0xFF) shl 24) or ...
        val height = ((codecBytes[8].toInt() and 0xFF) shl 24) or ...

        // ✅ 验证数据合法性
        if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
            throw IOException("无效的视频尺寸: ${width}x$height (可能是数据未就绪)")
        }

        // ✅ 验证 codec_id 合法性（常见值：0x68323634=h264, 0x68323635=h265）
        if (codecId == 0x5a5a5a5a || codecId == 0x00000000) {
            throw IOException("无效的 Codec ID: 0x${codecId.toString(16)} (数据未就绪，请重试)")
        }

        return Pair(width, height)
    } catch (e: Exception) {
        LogManager.e(LogTags.SCRCPY_CLIENT, "读取视频元数据失败: ${e.message}", e)
        throw IOException("元数据读取失败: ${e.message}", e)
    }
}
```

### 3. 关键改进点

| 改进项 | 修复前 | 修复后 |
|--------|--------|--------|
| **Dummy byte 读取时机** | 在 readMetadata 时读取 | 在 connectSockets 后立即读取 |
| **同步机制** | 无 | 通过 dummy byte 确保 Server 准备好 |
| **数据读取方式** | `read()` 循环 | `readFully()` 阻塞等待 |
| **数据验证** | 仅验证分辨率范围 | 验证分辨率 + Codec ID |
| **错误提示** | 通用错误信息 | 明确提示"数据未就绪，请重试" |

## 参考项目对比

### 1. Scrcpy 原版（C）

```c
// external/scrcpy/server/src/main/java/com/genymobile/scrcpy/device/DesktopConnection.java
if (sendDummyByte) {
    // send one byte so the client may read() to detect a connection error
    videoSocket.getOutputStream().write(0);
}

public void sendDeviceMeta(String deviceName) throws IOException {
    byte[] buffer = new byte[DEVICE_NAME_FIELD_LENGTH]; // 64 bytes
    // ...
    IO.writeFully(fd, buffer, 0, buffer.length);
}
```

**特点**：
- ✅ 明确使用 dummy byte 作为同步信号
- ✅ 使用 `writeFully()` 确保完整发送

### 2. Easycontrol

```java
// external/Easycontrol/easycontrol/app/src/main/java/top/saymzx/easycontrol/app/client/tools/ClientStream.java
mainSocket.connect(inetSocketAddress, timeoutDelay / 2);
videoSocket.connect(inetSocketAddress, timeoutDelay / 2);
mainDataInputStream = new DataInputStream(mainSocket.getInputStream());
videoDataInputStream = new DataInputStream(videoSocket.getInputStream());

// 直接开始读取数据
public ByteBuffer readByteArrayFromMain(int size) {
    byte[] buffer = new byte[size];
    mainDataInputStream.readFully(buffer);
    return ByteBuffer.wrap(buffer);
}
```

**特点**：
- ❌ 没有 dummy byte 机制
- ✅ 使用 `readFully()` 确保完整读取
- ⚠️ 使用自定义协议，不兼容 Scrcpy

### 3. ScrcpyForAndroid

```java
// external/ScrcpyForAndroid/app/src/main/java/org/client/scrcpy/Scrcpy.java
dataInputStream.readFully(packetSize, 0, 4);
int size = ByteUtils.bytesToInt(packetSize);
byte[] packet = new byte[size];
dataInputStream.readFully(packet, 0, size);
```

**特点**：
- ❌ 没有 dummy byte 机制
- ✅ 使用 `readFully()` 确保完整读取
- ⚠️ 使用自定义协议（包长度 + 数据包）

### 4. screen-remote-ios

```c
// external/screen-remote-ios/porting/src/scrcpy-porting.c
#include "scrcpy.c"  // 直接包含 Scrcpy 原版代码
```

**特点**：
- ✅ 完全遵循 Scrcpy 原版协议
- ✅ 包含 dummy byte 机制
- ✅ 只在 porting 层做适配（hijack）

## 总结

### 问题根源
1. **时序错误**：没有在 Socket 连接后立即读取 dummy byte
2. **读取方式错误**：使用 `read()` 而非 `readFully()`
3. **缺少验证**：没有检测异常数据

### 修复要点
1. **Socket 连接后立即读取 dummy byte**，作为同步信号
2. **使用 `readFully()` 阻塞等待**，确保读取完整数据
3. **验证关键字段**（Codec ID、分辨率），检测异常值时触发重连

### 协议规范
**Scrcpy 协议数据流**：
```
Socket Accept
    ↓
Dummy Byte (1 byte, 0x00)  ← 同步信号
    ↓
Device Name (64 bytes)      ← 设备名称
    ↓
Codec Metadata (12 bytes)   ← codec_id (4) + width (4) + height (4)
    ↓
Video/Audio Stream
```

### 下次避免
- 所有固定长度的协议数据都应使用 `DataInputStream.readFully()`
- 关键字段（如 Codec ID、分辨率）必须验证合法性
- 异常值应触发重连而非继续执行
- 遵循 Scrcpy 原版协议规范，参考 Server 端实现
