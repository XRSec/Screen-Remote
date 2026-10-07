# Screen Remote Desktop (Tauri v2 + Rust Core)

Screen Remote Desktop 是基于 **Tauri v2** 与 **Rust 原生核心** 构建的现代跨平台（macOS & Windows）Android 投屏与远程控制客户端。

它采用“**双层混合架构 (Hybrid Architecture)**”：
- **上层控制台 (Tauri Webview)**：采用极轻量现代 Web 前端 (React 19 + TypeScript + Vite)，以极低成本复刻 iOS / Miuix 细腻、克制的高质感设计系统（Normal 字重、0.5px 留白分割线、标准绿色开关、设备管理与分组配置）。
- **底层串流管线 (Native Window / Surface)**：Rust 核心处理 ADB 握手、scrcpy 协议解包与保序建链，并在各平台调用原生图形接口（macOS Metal / Windows DirectX）直接进行低延迟硬件加速视频渲染。

---

## 目录结构

```
Screen-Remote-desktop/
├── package.json               # 前端依赖配置 (React 19, TypeScript, Vite, Lucide)
├── vite.config.ts             # Vite 构建与 Tauri 开发服务端口配置
├── index.html                 # 应用入口骨架
├── src/                       # Webview 界面源码
│   ├── App.tsx                # 主窗口导航与状态中枢
│   ├── App.css                # Apple/Miuix 风格全局设计系统 Token 与组件样式
│   ├── types.ts               # 跨端数据模型 (AdbDevice, AppSettings)
│   └── components/
│       ├── DevicesView.tsx    # 设备发现、Wi-Fi 配对、电池信息、会话启停
│       ├── SessionConfigView.tsx # 分辨率/帧率/码率/编码器/音频流/息屏等高级投屏参数
│       ├── SettingsView.tsx   # ADB 自定义路径测试、明暗主题与语言
│       └── AboutView.tsx      # 版本架构信息与社区链接
└── src-tauri/                 # Rust 原生后端 (Tauri v2)
    ├── Cargo.toml             # Rust 依赖 (Tauri, Tokio, Which, Dirs, Serde)
    ├── tauri.conf.json        # 窗口布局、尺寸限制与安全策略
    └── src/
        ├── lib.rs             # Tauri IPC 命令注册与应用构建器
        ├── main.rs            # 二进制执行入口
        ├── adb.rs             # ADB 路径自动解析、设备扫描、无线连接与电池获取
        ├── scrcpy.rs          # scrcpy-server 参数生成与子进程生命周期管理
        └── config.rs          # 用户配置持久化 (JSON 存储至系统 Config 目录)
```

---

## 快速上手与运行

### 1. 安装依赖
```bash
cd Screen-Remote-desktop
bun install
```

### 2. 启动开发模式 (Hot Reload)
```bash
bun run tauri dev
```

### 3. 构建发布包
```bash
bun run tauri build
```
输出产物将位于 `src-tauri/target/release/bundle/` 下的 DMG (macOS) 或 MSI/NSIS (Windows) 安装包。

---

## 核心 IPC 命令清单

| IPC 接口名 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `list_devices` | `custom_path?` | `Vec<AdbDevice>` | 扫描当前连接的全部 USB/无线 Android 设备 |
| `connect_device` | `address`, `custom_path?` | `String` | 无线连接指定 `ip:port` 设备 |
| `disconnect_device` | `address`, `custom_path?` | `String` | 断开无线设备连接 |
| `get_battery_info` | `serial`, `custom_path?` | `Option<u32>` | 查询设备实时电量百分比 |
| `get_adb_version` | `custom_path?` | `String` | 测试指定或系统 ADB 是否有效 |
| `get_settings` | 无 | `AppSettings` | 读取本地持久化会话与外观偏好 |
| `save_settings` | `settings` | `()` | 保存用户偏好设置 |
| `start_session` | `serial` | `u32` (PID) | 启动对应设备的远控投屏会话 |
| `stop_session` | `serial` | `()` | 终止对应设备的投屏会话 |
| `get_active_sessions`| 无 | `Vec<String>` | 查询当前正在运行的设备会话列表 |
