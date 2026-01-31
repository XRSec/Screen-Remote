现在我看清楚了！让我对比两者的控制流实现：

## **scrcpy 原生 vs 你的项目 - 控制流对比**

### **1. 架构差异**

| 特性 | scrcpy 原生 | 你的项目 |
|------|------------|---------|
| **控制线程** | ✅ 独立线程 `run_controller()` | ❌ 协程 `Dispatchers.IO` |
| **消息队列** | ✅ `sc_vecdeque` 队列 + 条件变量 | ❌ 直接发送 |
| **队列限制** | ✅ 60 条消息 + 丢弃策略 | ❌ 无限制 |
| **互斥锁** | ✅ `sc_mutex` 保护队列 | ✅ `Mutex` 保护 socket |
| **消息序列化** | ✅ 统一 `sc_control_msg_serialize()` | ✅ 手动序列化 |

---

### **2. scrcpy 原生的关键优势**

#### **A. 消息队列机制（controller.c:95-120）**
```c
#define SC_CONTROL_MSG_QUEUE_LIMIT 60

bool sc_controller_push_msg(struct sc_controller *controller,
                           const struct sc_control_msg *msg) {
    sc_mutex_lock(&controller->mutex);
    size_t size = sc_vecdeque_size(&controller->queue);
    
    if (size < SC_CONTROL_MSG_QUEUE_LIMIT) {
        // 队列未满，直接入队
        sc_vecdeque_push_noresize(&controller->queue, *msg);
        pushed = true;
        if (was_empty) {
            sc_cond_signal(&controller->msg_cond);  // 唤醒发送线程
        }
    } else if (!sc_control_msg_is_droppable(msg)) {
        // 队列已满，但消息不可丢弃（如剪贴板、UHID）
        sc_vecdeque_push(&controller->queue, *msg);
    }
    // 否则丢弃消息（如连续的触摸移动事件）
    
    sc_mutex_unlock(&controller->mutex);
    return pushed;
}
```

**优势**：
- **背压控制**：队列满时自动丢弃可丢弃消息（触摸移动）
- **优先级保证**：关键消息（剪贴板、按键）永不丢弃
- **异步解耦**：UI 线程不阻塞，消息入队即返回

#### **B. 独立发送线程（controller.c:145-180）**
```c
static int run_controller(void *data) {
    struct sc_controller *controller = data;
    
    for (;;) {
        sc_mutex_lock(&controller->mutex);
        // 等待队列有消息
        while (!controller->stopped && sc_vecdeque_is_empty(&controller->queue)) {
            sc_cond_wait(&controller->msg_cond, &controller->mutex);
        }
        
        struct sc_control_msg msg = sc_vecdeque_pop(&controller->queue);
        sc_mutex_unlock(&controller->mutex);
        
        // 序列化并发送
        size_t length = sc_control_msg_serialize(&msg, serialized_msg);
        net_send_all(controller->control_socket, serialized_msg, length);
        
        sc_control_msg_destroy(&msg);
    }
    return 0;
}
```

**优势**：
- **专用线程**：控制流独占线程，不受其他操作影响
- **顺序保证**：严格按队列顺序发送
- **阻塞隔离**：socket 阻塞不影响 UI 线程

---

### **3. 你的项目的问题**

#### **A. 无消息队列**
```kotlin
private suspend fun sendControlMessage(buffer: ByteArray, deviceId: String): Result<Boolean> = 
    controlMutex.withLock {
        val socket = getControlSocket()
        val outputStream = socket.getOutputStream()
        outputStream.write(buffer)  // ❌ 直接写入，无缓冲
        outputStream.flush()
    }
```

**问题**：
- 高频触摸事件（60fps）会导致协程调度开销
- 无背压控制，网络慢时会堆积大量协程
- 每次都要获取锁，竞争激烈

#### **B. 协程调度开销**
```kotlin
suspend fun sendTouchEvent(...) = withContext(Dispatchers.IO) {
    // ❌ 每次触摸都创建新协程
    sendControlMessage(buffer, deviceId)
}
```

**问题**：
- 60fps 触摸 = 每秒 60 次协程切换
- `Dispatchers.IO` 线程池调度延迟
- 无法保证严格顺序（协程可能乱序执行）

---

### **4. 建议优化方案**

#### **方案 A：添加消息队列（推荐）**

```kotlin
class ScrcpyController {
    private val messageQueue = Channel<ByteArray>(capacity = 60)  // 队列容量 60
    private var senderJob: Job? = null
    
    fun start() {
        senderJob = CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                val buffer = messageQueue.receive()  // 阻塞等待消息
                try {
                    val socket = getControlSocket()
                    socket?.getOutputStream()?.apply {
                        write(buffer)
                        flush()
                    }
                } catch (e: Exception) {
                    LogManager.e(LogTags.SCRCPY_CLIENT, "发送失败: ${e.message}")
                }
            }
        }
    }
    
    suspend fun sendTouchEvent(...) {
        val buffer = ByteArray(32)
        // ... 序列化
        
        // 非阻塞入队（队列满时丢弃）
        messageQueue.trySend(buffer).onFailure {
            LogManager.w(LogTags.SCRCPY_CLIENT, "控制队列已满，丢弃消息")
        }
    }
}
```

**优势**：
- 异步解耦，UI 线程不阻塞
- 自动背压控制
- 单线程顺序发送

#### **方案 B：优化现有实现（简单）**

```kotlin
private val controlScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

suspend fun sendTouchEvent(...) {
    val buffer = ByteArray(32)
    // ... 序列化
    
    // 使用固定协程作用域，避免频繁创建
    controlScope.launch {
        controlMutex.withLock {
            getControlSocket()?.getOutputStream()?.apply {
                write(buffer)
                flush()
            }
        }
    }
}
```

---

### **5. 总结**

**scrcpy 原生的核心优势**：
1. **消息队列 + 独立线程** = 异步解耦 + 背压控制
2. **可丢弃消息机制** = 高频触摸不堵塞
3. **条件变量唤醒** = 零 CPU 空转

**你的项目需要改进**：
1. 添加消息队列（`Channel`）
2. 使用专用协程作用域
3. 实现消息丢弃策略（触摸移动可丢弃）

建议优先实现**方案 A**，这样能最大程度接近 scrcpy 原生的性能和稳定性。