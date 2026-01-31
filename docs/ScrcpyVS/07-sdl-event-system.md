# SDL 事件系统详解

## 概述

scrcpy-mobile-ios 使用 **SDL2 (Simple DirectMedia Layer)** 的事件系统作为核心消息总线，实现跨线程通信和异步事件处理。

---

## 1. SDL 事件系统的作用

### 核心功能

1. **跨线程通信**：不同线程（解码、渲染、控制）通过事件队列安全通信
2. **异步事件处理**：主线程事件循环统一处理所有事件
3. **用户输入处理**：键盘、鼠标、触摸事件
4. **生命周期管理**：启动、停止、错误处理

### 为什么使用 SDL

- **线程安全**：SDL 事件队列是线程安全的
- **跨平台**：SDL 在 iOS/Android/Desktop 都可用
- **成熟稳定**：scrcpy 原生就使用 SDL
- **统一接口**：所有事件通过同一个循环处理

---

## 2. scrcpy 原生事件类型

### 自定义事件 (events.h:11-22)

```c
enum {
    SC_EVENT_NEW_FRAME = SDL_USEREVENT,      // 新视频帧到达
    SC_EVENT_RUN_ON_MAIN_THREAD,             // 在主线程执行任务
    SC_EVENT_DEVICE_DISCONNECTED,            // 设备断开
    SC_EVENT_SERVER_CONNECTION_FAILED,       // 服务器连接失败
    SC_EVENT_SERVER_CONNECTED,               // 服务器连接成功
    SC_EVENT_USB_DEVICE_DISCONNECTED,        // USB 设备断开
    SC_EVENT_DEMUXER_ERROR,                  // 解复用器错误
    SC_EVENT_RECORDER_ERROR,                 // 录制器错误
    SC_EVENT_SCREEN_INIT_SIZE,               // 屏幕初始化尺寸
    SC_EVENT_TIME_LIMIT_REACHED,             // 时间限制到达
    SC_EVENT_CONTROLLER_ERROR,               // 控制器错误
    SC_EVENT_AOA_OPEN_ERROR,                 // AOA 打开错误
};
```

### SDL 内置事件

```c
SDL_QUIT                  // 退出事件
SDL_KEYDOWN               // 按键按下
SDL_KEYUP                 // 按键释放
SDL_MOUSEMOTION           // 鼠标移动
SDL_MOUSEBUTTONDOWN       // 鼠标按下
SDL_MOUSEBUTTONUP         // 鼠标释放
SDL_CLIPBOARDUPDATE       // 剪贴板更新
SDL_WINDOWEVENT           // 窗口事件
```

---

## 3. 事件循环机制

### 主事件循环 (scrcpy.c:180-230)

```c
static enum scrcpy_exit_code
event_loop(struct scrcpy *s, bool has_screen) {
    SDL_Event event;
    while (SDL_WaitEvent(&event)) {  // 阻塞等待事件
        switch (event.type) {
            case SC_EVENT_DEVICE_DISCONNECTED:
                LOGW("Device disconnected");
                return SCRCPY_EXIT_DISCONNECTED;
                
            case SC_EVENT_DEMUXER_ERROR:
                LOGE("Demuxer error");
                return SCRCPY_EXIT_FAILURE;
                
            case SDL_QUIT:
                LOGD("User requested to quit");
                return SCRCPY_EXIT_SUCCESS;
                
            case SC_EVENT_RUN_ON_MAIN_THREAD: {
                // 执行主线程任务
                sc_runnable_fn run = event.user.data1;
                void *userdata = event.user.data2;
                run(userdata);
                break;
            }
            
            default:
                // 处理输入事件（键盘、鼠标）
                if (has_screen) {
                    sc_screen_handle_event(&s->screen, &event);
                }
                break;
        }
    }
}
```

### 工作流程

```
┌─────────────────────────────────────────────────────────┐
│                    主线程事件循环                          │
│                                                           │
│  while (SDL_WaitEvent(&event)) {                        │
│      switch (event.type) {                              │
│          case SC_EVENT_NEW_FRAME:                       │
│              渲染新帧                                     │
│          case SDL_QUIT:                                 │
│              退出程序                                     │
│          case SDL_KEYDOWN:                              │
│              处理按键                                     │
│      }                                                   │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
    │解码线程  │         │控制线程  │         │用户输入  │
    │         │         │         │         │         │
    │ 推送    │         │ 推送    │         │ 推送    │
    │ NEW_FRAME│        │ QUIT    │         │ KEYDOWN │
    └─────────┘         └─────────┘         └─────────┘
```

---

## 4. scrcpy-mobile-ios 的使用场景

### 场景 1: 退出 scrcpy (ScrcpyClient.m:345-348)

```objective-c
-(void)stopScrcpy {
    // 发送 SDL_QUIT 事件到事件循环
    SDL_Event event;
    event.type = SDL_QUIT;
    SDL_PushEvent(&event);
    
    // 等待 scrcpy 退出
    while (self.status != ScrcpyStatusDisconnected) {
        CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.01, NO);
    }
}
```

**作用**：优雅地停止 scrcpy，让主循环正常退出

### 场景 2: 同步剪贴板 (ScrcpyClient.m:183-189)

```objective-c
-(void)onStartOrResume {
    if (self.status == ScrcpyStatusConnected) {
        NSLog(@"-> Syncing clipboard");
        SDL_Event clip_event;
        clip_event.type = SDL_CLIPBOARDUPDATE;
        
        BOOL posted = (SDL_PushEvent(&clip_event) > 0);
        NSLog(@"CLIPBOARD EVENT: Post %@", posted? @"Success" : @"Failed");
    }
}
```

**作用**：从后台恢复时，触发剪贴板同步到远程设备

### 场景 3: 发送按键事件 (ScrcpyClient.m:521-542)

```objective-c
-(void)sendKeycodeEvent:(SDL_Scancode)scancode 
                keycode:(SDL_Keycode)keycode 
                 keymod:(SDL_Keymod)keymod {
    SDL_Keysym keySym;
    keySym.scancode = scancode;
    keySym.sym = keycode;
    keySym.mod = keymod;
    
    // 发送按键按下事件
    SDL_KeyboardEvent keyEvent;
    keyEvent.type = SDL_KEYDOWN;
    keyEvent.state = SDL_PRESSED;
    keyEvent.keysym = keySym;
    
    SDL_Event event;
    event.type = keyEvent.type;
    event.key = keyEvent;
    SDL_PushEvent(&event);
    
    // 发送按键释放事件
    keyEvent.type = SDL_KEYUP;
    event.type = keyEvent.type;
    event.key = keyEvent;
    SDL_PushEvent(&event);
}
```

**作用**：模拟按键（Home、Back、Switch App）

### 场景 4: 视频帧渲染 (screen.c:316-319)

```c
static bool push_frame(struct sc_screen *screen) {
    // 解码线程推送新帧事件
    bool ok = sc_push_event(SC_EVENT_NEW_FRAME);
    if (!ok) {
        return false;
    }
    return true;
}
```

**作用**：解码线程通知主线程有新帧需要渲染

---

## 5. 跨线程通信机制

### SC_EVENT_RUN_ON_MAIN_THREAD

```c
// 任意线程调用
bool sc_post_to_main_thread(sc_runnable_fn run, void *userdata) {
    SDL_Event event = {
        .user = {
            .type = SC_EVENT_RUN_ON_MAIN_THREAD,
            .data1 = run,      // 函数指针
            .data2 = userdata, // 用户数据
        },
    };
    return SDL_PushEvent(&event) == 1;
}

// 主线程处理
case SC_EVENT_RUN_ON_MAIN_THREAD: {
    sc_runnable_fn run = event.user.data1;
    void *userdata = event.user.data2;
    run(userdata);  // 在主线程执行
    break;
}
```

**作用**：让其他线程的任务在主线程执行（如 UI 更新）

---

## 6. 事件处理流程

### 视频帧渲染流程

```
解码线程                     主线程
   │                          │
   │ 解码完成                  │
   │                          │
   ├─ sc_push_event(          │
   │    SC_EVENT_NEW_FRAME)   │
   │                          │
   │                          ├─ SDL_WaitEvent()
   │                          │
   │                          ├─ case SC_EVENT_NEW_FRAME:
   │                          │
   │                          ├─ sc_screen_update_frame()
   │                          │
   │                          ├─ 从 frame_buffer 取帧
   │                          │
   │                          ├─ 渲染到屏幕
   │                          │
   ▼                          ▼
```

### 退出流程

```
用户操作                     主线程
   │                          │
   │ 点击退出按钮              │
   │                          │
   ├─ SDL_PushEvent(          │
   │    SDL_QUIT)             │
   │                          │
   │                          ├─ SDL_WaitEvent()
   │                          │
   │                          ├─ case SDL_QUIT:
   │                          │
   │                          ├─ return SCRCPY_EXIT_SUCCESS
   │                          │
   │                          ├─ 清理资源
   │                          │
   │                          ├─ 关闭连接
   │                          │
   ▼                          ▼
```

---

## 7. 与 Easycontrol 的对比

| 特性 | scrcpy-mobile-ios (SDL) | Easycontrol |
|------|------------------------|-------------|
| **事件系统** | SDL 事件队列 | Java Handler + Looper |
| **跨线程通信** | SDL_PushEvent | Handler.post() |
| **主循环** | SDL_WaitEvent | Looper.loop() |
| **线程安全** | SDL 内置保证 | 需手动同步 |
| **事件类型** | 统一 SDL_Event | 多种消息类型 |
| **平台依赖** | SDL 跨平台 | Android 专用 |

---

## 8. 优势与劣势

### 优势

1. **统一接口**：所有事件通过同一个循环处理
2. **线程安全**：SDL 事件队列天然线程安全
3. **跨平台**：SDL 在多平台可用
4. **成熟稳定**：scrcpy 原生使用，经过验证
5. **解耦合**：事件发送者和接收者解耦

### 劣势

1. **额外依赖**：需要引入 SDL2 库
2. **学习成本**：需要理解 SDL 事件机制
3. **iOS 限制**：iOS 上 SDL 功能受限（无窗口管理）
4. **性能开销**：事件队列有一定开销

---

## 9. 本地项目的选择

### 为什么不使用 SDL

1. **Android 原生**：Android 有 Handler/Looper 机制
2. **Kotlin 协程**：更现代的异步方案
3. **依赖简化**：避免引入 SDL 库
4. **平台优化**：使用 Android 原生 API 性能更好

### 替代方案：Kotlin Channel 事件系统

本项目实现了基于 Kotlin Channel 的事件系统，完全替代 SDL 事件机制。

#### 核心组件

```kotlin
// 1. 事件定义 (ScrcpyEvent.kt)
sealed class ScrcpyEvent {
    object Quit : ScrcpyEvent()
    data class NewFrame(val frameData: ByteArray) : ScrcpyEvent()
    data class ScreenInitSize(val width: Int, val height: Int) : ScrcpyEvent()
    data class DeviceDisconnected : ScrcpyEvent()
    data class DemuxerError(val message: String) : ScrcpyEvent()
    data class ControllerError(val message: String) : ScrcpyEvent()
    // ... 更多事件类型
}

// 2. 事件循环 (ScrcpyEventLoop.kt)
class ScrcpyEventLoop(scope: CoroutineScope) {
    private val eventChannel = Channel<ScrcpyEvent>(Channel.UNLIMITED)
    
    fun pushEvent(event: ScrcpyEvent): Boolean
    fun start()  // 启动事件循环
    fun stop()   // 停止事件循环
    inline fun <reified T : ScrcpyEvent> on(handler: (T) -> Unit)
}

// 3. 全局事件总线 (ScrcpyEventBus.kt)
object ScrcpyEventBus {
    fun pushEvent(event: ScrcpyEvent): Boolean
    fun postToMainThread(task: () -> Unit): Boolean
    fun start()
    fun stop()
    inline fun <reified T : ScrcpyEvent> on(handler: (T) -> Unit)
}
```

#### 使用示例

```kotlin
// 注册事件处理器
ScrcpyEventBus.on<ScrcpyEvent.DeviceDisconnected> {
    handleDisconnection()
}

// 启动事件循环
ScrcpyEventBus.start()

// 推送事件（任意线程）
ScrcpyEventBus.pushEvent(ScrcpyEvent.NewFrame(frameData))

// 主线程任务
ScrcpyEventBus.postToMainThread {
    updateUI()
}

// 停止事件循环
ScrcpyEventBus.stop()
```

#### 集成位置

- **VideoDecoder**: 推送 NewFrame、ScreenInitSize、DemuxerError、DeviceDisconnected
- **AudioDecoder**: 推送 DeviceDisconnected、DemuxerError
- **ScrcpyController**: 推送 ControllerError、MouseButtonDown/Up、MouseMotion
- **ScrcpyStream**: 推送 DeviceDisconnected、DemuxerError

详见：`core/common/event/ScrcpyEventUsageExample.kt`

---

## 10. 总结

SDL 事件系统在 scrcpy-mobile-ios 中扮演**消息总线**的角色：

1. **解码线程** → SDL 事件 → **主线程渲染**
2. **控制线程** → SDL 事件 → **主线程处理**
3. **用户输入** → SDL 事件 → **控制流发送**
4. **生命周期** → SDL 事件 → **状态管理**

这是 scrcpy 原生架构的核心，保证了多线程环境下的安全通信和统一的事件处理流程。
