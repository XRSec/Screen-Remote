好问题！让我梳理清楚 scrcpy-mobile-ios 的代码分层：

完美！现在我完全理解了架构分层。让我总结：

## **scrcpy-mobile-ios 代码分层架构**

### **1. 项目结构**

```
scrcpy-mobile-ios/
├── external/adb-mobile/          # ADB 子模块（独立项目）
├── scrcpy/                        # scrcpy 原生代码（git submodule）
├── porting/                       # iOS 移植层（胶水代码）
│   ├── src/
│   │   ├── scrcpy-porting.c      # scrcpy 入口劫持
│   │   ├── process-porting.cpp   # ADB 进程管理适配
│   │   ├── decoder-porting.c     # 硬件解码适配
│   │   ├── audio_player-porting.c
│   │   ├── controller-porting.c
│   │   ├── demuxer-porting.c
│   │   └── ...
│   └── cmake/CMakeLists.txt      # 编译配置
└── scrcpy-ios/                    # iOS UI 层（Objective-C）
    └── scrcpy-ios/ScrcpyClient.m  # 启动参数配置
```

---

### **2. 代码归属分析**

#### **Socket 逻辑在哪里？**

| 功能 | 代码位置 | 说明 |
|------|---------|------|
| **Socket 创建/连接** | `scrcpy/app/src/server.c` | scrcpy 原生代码 |
| **Socket 优化（TCP_NODELAY）** | `scrcpy/app/src/util/net.c` | scrcpy 原生代码 |
| **Socket 接收（MSG_WAITALL）** | `scrcpy/app/src/util/net.c` | scrcpy 原生代码 |
| **3 路 Socket 管理** | `scrcpy/app/src/server.c` | scrcpy 原生代码 |
| **视频流解析** | `scrcpy/app/src/demuxer.c` | scrcpy 原生代码 |
| **音频流解析** | `scrcpy/app/src/demuxer.c` | scrcpy 原生代码 |
| **控制流发送** | `scrcpy/app/src/controller.c` | scrcpy 原生代码 |
| **控制流接收** | `scrcpy/app/src/receiver.c` | scrcpy 原生代码 |

#### **ADB 逻辑在哪里？**

| 功能 | 代码位置 | 说明 |
|------|---------|------|
| **ADB 核心实现** | `external/adb-mobile/` | 独立子模块（adb-mobile-ios） |
| **ADB 命令执行** | `external/adb-mobile/porting/adb/client/` | adb-mobile-ios |
| **ADB Socket 缓冲** | `external/adb-mobile/porting/adb/adb_listeners.cpp` | adb-mobile-ios |
| **ADB 进程适配** | `porting/src/process-porting.cpp` | **iOS 移植层** |
| **ADB 调用接口** | `scrcpy/app/src/adb/adb.c` | scrcpy 原生代码 |

#### **iOS 移植层做了什么？**

| 文件 | 功能 | 说明 |
|------|------|------|
| `scrcpy-porting.c` | 劫持 scrcpy 入口 | 修改回调、修复 delay_buffer |
| `process-porting.cpp` | ADB 进程管理 | 调用 `adb_commandline_porting()` |
| `decoder-porting.c` | 硬件解码适配 | iOS VideoToolbox 解码 |
| `audio_player-porting.c` | 音频播放适配 | iOS AudioUnit 播放 |
| `demuxer-porting.c` | 解复用适配 | 修复 av_alloc_context 问题 |

---

### **3. 编译流程（Makefile）**

```makefile
# 1. 编译 ADB（独立子模块）
adb-mobile:
    make -C ../external/adb-mobile

# 2. 编译 SDL2（iOS 渲染库）
libsdl:
    bash ./scripts/make-libsdl.sh

# 3. 编译 FFmpeg（iOS 音视频库）
ffmpeg:
    bash ./scripts/make-ffmpeg.sh

# 4. 编译 scrcpy（混合 scrcpy 原生 + porting 层）
scrcpy:
    bash ./scripts/make-scrcpy.sh
    # 链接：libscrcpy.a + libSDL2.a + libavcodec.a + ...

# 5. 编译 scrcpy-server（Android 端 JAR）
scrcpy-server:
    # 下载 scrcpy v2.3 源码
    # 使用 meson + ninja 编译 server
```

---

### **4. CMakeLists.txt 关键配置**

```cmake
# 使用 scrcpy 原生代码
../../scrcpy/app/src/server.c          # Socket 管理
../../scrcpy/app/src/util/net.c        # Socket 优化
../../scrcpy/app/src/demuxer.c         # 流解析

# 替换为 porting 版本
../../porting/src/scrcpy-porting.c     # 劫持入口
../../porting/src/process-porting.cpp  # ADB 适配
../../porting/src/decoder-porting.c    # 硬件解码

# 链接 ADB 库
../../external/adb-mobile/output/include
```

---

### **5. 数据流向**

```
iOS App (ScrcpyClient.m)
    ↓ 启动参数配置
porting/scrcpy-porting.c
    ↓ 劫持 scrcpy_main()
scrcpy/app/src/scrcpy.c
    ↓ 初始化 server
scrcpy/app/src/server.c
    ↓ 调用 ADB 命令
porting/process-porting.cpp
    ↓ 调用 adb_commandline_porting()
external/adb-mobile/
    ↓ 执行 ADB 连接
    ↓ 建立 3 个 Socket
scrcpy/app/src/server.c
    ↓ video_socket, audio_socket, control_socket
scrcpy/app/src/demuxer.c
    ↓ 解析视频/音频流
porting/decoder-porting.c
    ↓ iOS 硬件解码
SDL2 / AudioUnit
    ↓ 渲染显示
```

---

### **6. 总结**

**Socket 逻辑 100% 在 scrcpy 原生代码**：
- `scrcpy/app/src/server.c` - 3 路 Socket 管理
- `scrcpy/app/src/util/net.c` - TCP_NODELAY、MSG_WAITALL
- `scrcpy/app/src/demuxer.c` - 视频/音频流解析
- `scrcpy/app/src/controller.c` - 控制流发送

**ADB 逻辑在 adb-mobile-ios 子模块**：
- `external/adb-mobile/porting/adb/` - ADB 核心实现
- `external/adb-mobile/porting/adb/adb_listeners.cpp` - Socket 缓冲设置（64KB）

**iOS 移植层只做适配**：
- `porting/process-porting.cpp` - 调用 ADB 接口
- `porting/decoder-porting.c` - 硬件解码适配
- `porting/scrcpy-porting.c` - 修复 delay_buffer 重连问题

所以你的 Android 项目应该参考 **scrcpy 原生代码**，而不是 iOS 移植层！