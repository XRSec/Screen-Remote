# USB 会话功能实现总结

## 已完成的修改

### 1. 数据模型更新 (SessionRepository.kt)
- 在 SessionData 中添加：
  - `connectionType: String = "TCP"` - 连接类型（"TCP" 或 "USB"）
  - `usbSerialNumber: String = ""` - USB 设备序列号

### 2. 双语文本添加 (BilingualTexts.kt)
- CONNECTION_TYPE - "连接类型" / "Connection Type"
- CONNECTION_TYPE_TCP - "TCP/IP"
- CONNECTION_TYPE_USB - "USB"
- USB_SELECT_DEVICE - "选择 USB 设备" / "Select USB Device"
- USB_DEVICE_SELECTED - "已选择设备" / "Device Selected"
- USB_NO_DEVICE_SELECTED - "未选择设备" / "No Device Selected"

### 3. 会话编辑对话框 (SessionDialog.kt)
**新增功能：**
- 连接类型下拉选择（TCP/USB 切换）
- TCP 模式：显示主机和端口输入框
- USB 模式：显示 USB 设备选择按钮
- USB 设备选择对话框（UsbDeviceSelectionDialog）
  - 自动扫描 USB 设备
  - 显示设备列表（名称、序列号、权限状态）
  - 支持选择设备

**数据处理：**
- USB 模式下，host 保存为 "usb:序列号" 格式
- USB 模式下，port 保存为空字符串
- 会话名称默认为 "USB:序列号"（USB 模式）

### 4. 连接逻辑更新 (ScrcpyClient.kt)
**connect 方法增强：**
- 自动识别 USB 连接（host 以 "usb:" 开头）
- USB 模式：验证设备已在 AdbConnectionManager 中连接
- TCP 模式：保持原有逻辑（先连接 ADB）
- 统一后续 scrcpy 连接流程

## 使用流程

### 创建 USB 会话
1. 点击"+"创建新会话
2. 连接类型选择"USB"
3. 点击"选择 USB 设备"
4. 扫描并选择 USB 设备
5. 配置其他参数（分辨率、比特率等）
6. 保存会话

### 启动 USB 会话
1. 确保 USB 设备已物理连接
2. 点击会话卡片启动
3. 系统自动验证 USB 连接
4. 启动 scrcpy 服务

## 技术要点

### USB 设备识别
- 格式：`usb:序列号`
- 示例：`usb:ABC123456`

### 连接验证
- USB 设备必须先在设备管理中建立 ADB 连接
- 会话启动时验证连接是否存在
- 不存在则提示用户先连接设备

### 兼容性
- 完全兼容现有 TCP 会话
- SessionData 向后兼容（默认值为 TCP 模式）
- 不影响现有功能

## 注意事项

1. **USB 权限**：首次使用需要授予 USB 权限
2. **设备连接**：启动会话前确保设备已在设备管理中连接
3. **序列号唯一性**：每个 USB 设备有唯一序列号
4. **端口字段**：USB 模式下端口字段为空，不影响连接

