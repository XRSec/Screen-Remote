# ADB 配对码配对功能

## 功能说明

通过配对码方式配对 Android 设备的无线调试功能，建立 ADB 连接。

## 使用流程

### 1. 在被控设备上操作

1. 打开"设置" → "开发者选项"
2. 启用"无线调试"
3. 点击"使用配对码配对设备"
4. 记录显示的信息：
   - IP 地址（如：192.168.1.100）
   - 端口（如：37829）
   - 配对码（6位数字，如：123456）

### 2. 在控制端（本应用）操作

1. 打开"设置"
2. 进入"ADB 管理" → "使用配对码进行 ADB 配对"
3. 输入被控设备显示的信息：
   - IP 地址
   - 端口
   - 配对码
4. 点击"配对"按钮
5. 等待配对完成

### 3. 配对成功后

1. 配对成功后，被控设备的 ADB 端口通常是 **5555**
2. 返回主页面，点击"添加会话"
3. 输入连接信息：
   - 主机：被控设备的 IP 地址（如：192.168.1.100）
   - 端口：**5555**（不是配对端口）
4. 保存并连接

## 技术实现

### 当前状态

- ✅ UI 界面完成
- ✅ 输入验证完成
- ✅ 状态管理完成
- ✅ 配对管理器框架完成
- ⏳ SPAKE2+ 协议实现待完成

### 技术限制

Android ADB 配对协议使用 SPAKE2+ 密钥交换算法，实现复杂：

1. **协议要求**
   - TLS 连接（使用自签名证书）
   - SPAKE2+ 密钥交换（需要专门的加密库）
   - AES-GCM 加密通信
   - RSA 公钥交换

2. **实现难点**
   - SPAKE2+ 算法没有标准的 Java/Kotlin 实现
   - 需要 BoringSSL 或类似的 C++ 加密库
   - Android 应用层无法直接调用系统 `adb` 命令

3. **参考实现**
   - iOS 版本：使用完整的 ADB 客户端移植（C++）
   - PC 端：使用官方 ADB 工具（C++）
   - Easycontrol：未实现配对功能

### 替代方案

由于完整实现需要引入 C++ 加密库，建议：

1. **方案一：提示用户使用 PC 配对**
   - 用户在 PC 上运行 `adb pair IP:PORT CODE`
   - 配对成功后，Android 应用可以直接连接 5555 端口

2. **方案二：引入 C++ SPAKE2 库**
   - 使用 NDK 编译 BoringSSL
   - 实现 JNI 接口
   - 工作量较大

3. **方案三：等待第三方库**
   - 等待社区提供 SPAKE2+ 的 Kotlin 实现
   - 或使用 Kotlin Multiplatform 封装现有实现

## 代码结构

```
feature/device/
├── data/
│   └── DevicePairingModels.kt          # 数据模型
├── viewmodel/
│   └── DevicePairingViewModel.kt      # 业务逻辑
└── ui/component/
    └── AdbPairingCodeDialog.kt         # UI 界面

core/common/
└── Constants.kt                        # 配对常量
```

## 常见问题

### Q: 配对失败怎么办？

检查以下几点：
1. 两台设备是否在同一局域网
2. 被控设备是否开启了无线调试
3. IP 地址和端口是否正确
4. 配对码是否在有效期内（通常几分钟）

### Q: 配对成功后无法连接？

1. 确认使用的是 ADB 端口 **5555**，不是配对端口
2. 检查网络连接是否正常
3. 尝试重新配对

### Q: 配对码有效期多久？

配对码通常在生成后几分钟内有效，过期后需要重新生成。

## 参考资料

- [Android 无线调试文档](https://developer.android.com/studio/command-line/adb#wireless)
- [ADB 配对协议](https://android.googlesource.com/platform/packages/modules/adb/)
