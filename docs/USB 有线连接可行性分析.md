我来分析 USB 有线连接的可行性。让我先查看相关文档和代码。

让我获取 AdbServer.kt 的完整内容：

让我查看 dadb 项目的本地文件：

现在让我查看更多相关文件来完整分析：

我已经分析了相关文档和代码，现在给你提供 USB 有线连接的可行性分析。

## USB 有线连接可行性分析

### 一、技术可行性：✅ 完全可行

基于以下三个参考实现，USB 连接在 Android 上是成熟方案：

#### 1. **dadb 库**（推荐方案）
- **优势**：
  - 纯 Kotlin 实现，与项目技术栈完美匹配
  - 支持 TCP 和 USB 两种连接方式
  - 通过 ADB Server（端口 5037）发现 USB 设备
  - API 简洁：`Dadb.discover()` 自动发现 USB/TCP 设备
  - Maven Central 可用，依赖管理简单

- **限制**：
  - **需要运行 ADB Server**（通常需要 adb 二进制文件）
  - 适合作为辅助方案，不能完全独立运行

#### 2. **Easycontrol 实现**（直接 USB 通信）
- **优势**：
  - 直接通过 Android USB Host API 与设备通信
  - 无需 ADB Server，完全独立
  - 实现了完整的 ADB 协议栈（认证、流管理）
  - 支持 USB 和 TCP 统一接口（`AdbChannel`）

- **核心实现**：
  ```java
  // USB 设备发现
  UsbInterface: class=0xFF, subclass=66, protocol=1
  
  // 端点识别
  - Bulk IN: 接收数据
  - Bulk OUT: 发送数据
  
  // 协议处理
  - 头部和载荷必须分开发送（USB 特性）
  - 异步读取使用 UsbRequest 队列
  ```

#### 3. **libadb-android**（备选方案）
- 功能完整的 ADB 库
- 支持配对、认证、Shell、文件传输
- 需要额外的证书生成逻辑

---

### 二、实现方案对比

| 方案 | 优势 | 劣势 | 推荐度 |
|------|------|------|--------|
| **dadb** | API 简洁、维护活跃、Kotlin 原生 | 依赖 ADB Server | ⭐⭐⭐⭐ |
| **Easycontrol 移植** | 完全独立、直接控制 | 需要移植 Java 代码 | ⭐⭐⭐⭐⭐ |
| **libadb-android** | 功能最全 | 配置复杂、证书管理繁琐 | ⭐⭐⭐ |

---

### 三、推荐实现路径

#### **阶段 1：快速验证（使用 dadb）**
```kotlin
// 1. 添加依赖
dependencies {
    implementation("dev.mobile:dadb:2.4.2")
}

// 2. 发现设备（自动包含 USB）
val devices = Dadb.list() // 返回 TCP + USB 设备

// 3. 连接特定 USB 设备
val dadb = AdbServer.createDadb(
    deviceQuery = "host:transport-usb" // 或 "host:transport:${serialNumber}"
)
```

**优势**：1-2 小时即可集成测试

#### **阶段 2：独立实现（移植 Easycontrol）**
基于你的项目结构，建议：

```
core/adb/
├── AdbConnectionManager.kt (已存在，扩展 USB 支持)
├── usb/
│   ├── UsbAdbConnection.kt      // USB 连接实现
│   ├── UsbChannel.kt            // USB 通道（移植自 Easycontrol）
│   ├── AdbProtocol.kt           // ADB 协议（移植）
│   └── AdbKeyPair.kt            // 密钥管理
```

**核心改动点**：
1. `AdbConnectionManager` 添加 `connectUsb(usbDevice: UsbDevice)` 方法
2. 实现 USB 设备发现和权限请求
3. 移植 `UsbChannel` 和 `AdbProtocol`（约 500 行代码）

---

### 四、关键技术点

#### 1. **USB 权限管理**
```kotlin
// AndroidManifest.xml
<uses-feature android:name="android.hardware.usb.host" />
<uses-permission android:name="android.permission.USB_PERMISSION" />

// 运行时请求
val usbManager = getSystemService(Context.USB_SERVICE) as UsbManager
val permissionIntent = PendingIntent.getBroadcast(...)
usbManager.requestPermission(device, permissionIntent)
```

#### 2. **设备过滤**
```kotlin
// 查找 ADB 接口
device.interfaces.find { 
    it.interfaceClass == 0xFF && 
    it.interfaceSubclass == 66 && 
    it.interfaceProtocol == 1 
}
```

#### 3. **与现有架构集成**
```kotlin
// Models.kt 扩展
data class DeviceInfo(
    val id: String,
    val name: String,
    val connectionType: ConnectionType // 新增
)

enum class ConnectionType {
    TCP,
    USB
}

// BilingualTexts.kt 新增
val USB_CONNECTION_TITLE = TextPair("USB 连接", "USB Connection")
val USB_DEVICE_NOT_FOUND = TextPair("未找到 USB 设备", "No USB device found")
```

---

### 五、潜在问题与解决

| 问题 | 解决方案 |
|------|----------|
| **USB 权限弹窗** | 使用 `<intent-filter>` 自动授权特定设备 |
| **设备兼容性** | 部分设备 USB 最大传输 16KB，需限制 `CONNECT_MAXDATA` |
| **连接稳定性** | 实现心跳检测（已有 `ScrcpyForegroundService`） |
| **多设备管理** | 扩展 `AdbConnectionManager` 支持 USB/TCP 混合列表 |

---

### 六、工作量估算

- **方案 1（dadb 集成）**：1-2 天
  - 依赖添加：0.5h
  - USB 发现逻辑：2h
  - UI 集成：4h
  - 测试：2h

- **方案 2（独立实现）**：3-5 天
  - 代码移植：1 天
  - 权限管理：0.5 天
  - 集成测试：1 天
  - 稳定性优化：1 天

---

### 七、建议

1. **先用 dadb 验证**：快速确认 USB 连接在目标设备上可用
2. **再独立实现**：如果需要完全控制或避免 ADB Server 依赖
3. **UI 改造**：在 `DeviceManagementScreen` 添加 USB 设备扫描按钮
4. **文档记录**：建议创建 `docs/USB_CONNECTION_IMPLEMENTATION.md`

**结论**：USB 有线连接完全可行，推荐先用 dadb 快速验证，再根据需求决定是否独立实现。Easycontrol 的实现已经证明了在 Android 上直接操作 USB 的可行性。