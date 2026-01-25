好的，我将基于 dadb 库并参考 Easycontrol 实现 USB 功能。让我先查看当前项目的结构和相关文件。

现在让我开始实现 USB 功能。我将：

1. 添加 USB 相关的数据模型
2. 创建 USB 连接管理器
3. 扩展 AdbConnectionManager 支持 USB
4. 添加 UI 支持

现在开始实现 USB 功能。我将创建必要的文件：

现在添加双语文本支持：

继续完成 USB 功能实现。现在我需要：

1. 扩展 AdbConnectionManager 支持 USB 连接
2. 添加 AndroidManifest.xml 权限
3. 创建 UI 组件

现在扩展 AdbConnectionManager 支持 USB：

现在在 AdbConnectionManager 中添加 USB 连接方法：

现在创建 USB 设备选择 Dialog UI 组件：

现在扩展 DeviceViewModel 支持 USB：

继续完成 USB 功能。现在扩展 DeviceViewModel 并添加 UI 入口：

现在查看设备管理界面，添加 USB 连接入口：

现在在添加设备对话框中添加 USB 连接选项。我将修改 AddDeviceDialog：

现在添加必要的 import：

完成 USB 功能实现。现在创建实现总结文档：

## USB 有线连接功能实现完成

我已经成功为 Scrcpy Mobile 项目添加了 USB 有线连接功能。以下是实现的核心内容：

### 实现的功能

**1. USB 设备管理 (`UsbAdbManager.kt`)**
- USB 设备扫描和发现
- USB 权限请求和管理
- 通过 dadb 的 AdbServer 连接 USB 设备
- 参考 Easycontrol 的 USB 设备识别逻辑（ADB 接口：class=0xFF, subclass=0x42, protocol=0x01）

**2. 扩展 AdbConnectionManager**
- 添加 `connectUsbDevice()` 方法支持 USB 连接
- 添加 `scanUsbDevices()` 方法扫描 USB 设备
- 统一管理 TCP 和 USB 连接
- 在 DeviceInfo 中添加 `connectionType` 字段区分连接类型

**3. UI 组件**
- `UsbDeviceDialog.kt`：USB 设备选择对话框
  - 显示可用 USB 设备列表
  - 显示设备信息（制造商、产品名、序列号）
  - 显示权限状态
  - 支持扫描和连接操作
- 扩展 `DeviceManagementScreen`：在添加设备对话框中添加 "USB 有线连接" 按钮

**4. 数据模型扩展**
- `ConnectionType` 枚举：TCP 和 USB
- `UsbDeviceInfo`：USB 设备信息
- `DeviceConfig` 添加 `connectionType` 字段

**5. 双语支持**
- 添加 30+ USB 相关的双语文本到 `BilingualTexts.kt`
- 包括扫描、权限、连接状态等所有 UI 文本

**6. 权限配置**
- `AndroidManifest.xml` 添加 USB Host 权限
- `<uses-feature android:name="android.hardware.usb.host" android:required="false" />`
- `<uses-permission android:name="android.permission.USB_PERMISSION" />`

### 技术实现

**核心架构**：
```
UI Layer (UsbDeviceDialog)
    ↓
ViewModel (DeviceViewModel)
    ↓
Manager (AdbConnectionManager + UsbAdbManager)
    ↓
Library (dadb AdbServer)
```

**关键代码路径**：
1. 用户点击 "USB 有线连接" → 打开 `UsbDeviceDialog`
2. 自动扫描 USB 设备 → `UsbAdbManager.scanUsbDevices()`
3. 用户选择设备 → 请求 USB 权限（如需要）
4. 连接设备 → `AdbConnectionManager.connectUsbDevice()`
5. 使用 `AdbServer.createDadb()` 建立连接

### 版权说明

所有文件顶部都添加了完整的版权说明：
```kotlin
/*
 * USB ADB 连接管理器
 * 
 * 参考实现：
 * - Easycontrol: https://github.com/Chenyqiang/Easycontrol
 *   - UsbChannel.java: USB 通道实现
 *   - Adb.java: ADB 协议封装
 * - dadb: https://github.com/mobile-dev-inc/dadb
 *   - AdbServer.kt: ADB Server 集成
 * 
 * 版权说明：
 * - Easycontrol 使用 GPL-3.0 许可证
 * - dadb 使用 Apache-2.0 许可证
 * - 本实现基于 dadb 库，参考 Easycontrol 的 USB 设备发现逻辑
 */
```

### 使用方式

1. **扫描 USB 设备**：在设备管理界面点击 "添加设备" → "USB 有线连接"
2. **授权设备**：首次连接会弹出 USB 权限请求
3. **连接设备**：选择已授权的设备点击 "连接"
4. **查看连接**：已连接的 USB 设备会显示在设备列表中，标记为 USB 类型

### 文件清单

**新增文件**：
- `core/adb/usb/UsbAdbManager.kt` - USB 管理器
- `ui/components/UsbDeviceDialog.kt` - USB 设备选择对话框

**修改文件**：
- `core/adb/AdbConnectionManager.kt` - 添加 USB 支持
- `core/data/model/Models.kt` - 添加 ConnectionType
- `feature/device/DeviceViewModel.kt` - 添加 USB 方法
- `ui/screens/DeviceManagementScreen.kt` - 添加 USB 入口
- `common/BilingualTexts.kt` - 添加 USB 文本
- `AndroidManifest.xml` - 添加 USB 权限

### 注意事项

1. **ADB Server 依赖**：USB 连接需要 ADB Server 运行（dadb 会自动尝试启动）
2. **设备兼容性**：需要设备支持 USB Host 功能（大部分 Android 设备支持）
3. **权限管理**：首次连接需要用户授权 USB 权限
4. **连接稳定性**：USB 连接比 TCP 更稳定，适合长时间使用

### 测试建议

1. 测试 USB 设备扫描功能
2. 测试 USB 权限请求流程
3. 测试 USB 连接和断开
4. 测试 USB 和 TCP 混合连接场景
5. 测试设备拔插时的异常处理

USB 有线连接功能已完整实现，可以开始测试和使用。