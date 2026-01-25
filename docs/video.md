## Scrcpy 视频编码器选择逻辑

### 1. **默认编码器（用户不指定）**

当 `videoEncoder` 为空时，scrcpy 调用：

```
MediaCodec mediaCodec = MediaCodec.createEncoderByType(codec.getMimeType());
Ln.d("Using video encoder: '" + mediaCodec.getName() + "'");
```

**Android 系统自动选择规则：**
- 从 `MediaCodecList.REGULAR_CODECS` 中查找支持该 MIME 类型的编码器
- **优先级顺序**：
  1. 硬件编码器（hw）- 最快，功耗低
  2. 混合编码器（hybrid）
  3. 软件编码器（sw）- 最慢，CPU 占用高
- 通常选择**第一个硬件加速编码器**

### 2. **用户指定编码器**

当 `videoEncoder` 不为空时：

```java
MediaCodec mediaCodec = MediaCodec.createByCodecName(encoderName);
```
直接使用用户指定的编码器名称。

### 3. **编码器列表示例**

```
List of video encoders:
    --video-codec=h264 --video-encoder='c2.android.avc.encoder'       (hw)
    --video-codec=h264 --video-encoder='OMX.qcom.video.encoder.avc'   (hw) [vendor]
    --video-codec=h264 --video-encoder='OMX.google.h264.encoder'      (sw)
```

- 第一个 `c2.android.avc.encoder` 就是默认选择的
- `(hw)` = 硬件加速
- `(sw)` = 软件编码
- `[vendor]` = 厂商定制


帧大小解析错误！这说明帧头解析有问题。让我检查 `readFrameHeader` 的逻辑：

问题找到了！`readFrameHeader` 在读取完 12 字节后做了 `flip()` 和 `compact()`，但这会导致 buffer 状态混乱。

## 视频缩放显示逻辑总结

### 缩放策略

- **视频宽高比** = `w/h`（统一计算，不区分横竖屏）
- **容器宽高比** = `screenWidthDp / screenHeightDp`
- **缩放规则**：
  - 视频宽高比 > 容器宽高比 → 填满宽度
  - 视频宽高比 < 容器宽高比 → 填满高度

### 旋转检测

- **控制端旋转**：监听 `configuration` 变化，重新计算宽高比
- **被控端旋转**：通过 `INFO_OUTPUT_FORMAT_CHANGED` 和 `crop` 信息检测
- 流程：屏幕旋转 → 重新编码 → 新 SPS/PPS → `INFO_OUTPUT_FORMAT_CHANGED` → 从 `crop` 获取新尺寸

## 后台切换机制（Dummy Surface 技术）

### 问题背景

传统方案在切换到后台时会停止解码器，导致：
- Socket 连接断开
- 需要重新连接（耗时、用户体验差）
- 无法保持会话状态

### 解决方案：Dummy Surface

**核心思路**：解码器持续运行，只切换输出目标

#### 1. Dummy Surface 创建

在解码器启动时创建一个 1x1 的占位 Surface：
- 使用 `SurfaceTexture(0)` 创建
- 设置最小缓冲区 `setDefaultBufferSize(1, 1)`
- 在解码器 `configure()` 前创建

#### 2. Surface 切换逻辑

**前台模式**：
- 解码器输出到真实 Surface
- 正常渲染到屏幕
- `releaseOutputBuffer(index, true)` 渲染帧

**后台模式**：
- 解码器输出到 dummy Surface
- 丢弃帧但保持解码
- `releaseOutputBuffer(index, false)` 不渲染
- Socket 保持活跃，连接不断开

#### 3. 实现架构

**VideoDecoder.kt**：
- `createDummySurface()`：创建 dummy Surface
- `setSurface(newSurface)`：动态切换 Surface
  - `newSurface == null` → 切换到 dummy Surface
  - `newSurface != null` → 切换到真实 Surface
- `drainOutputBuffers()`：根据 Surface 状态决定是否渲染

**RemoteDisplayScreen.kt**：

**LaunchedEffect(videoStream)**：
- 只依赖 `videoStream`，不依赖 `surfaceHolder`
- 只在真正的流变化时重启解码器
- 允许在后台启动（使用 dummy Surface）

**DisposableEffect(surfaceHolder, lifecycleState)**：
- 监听生命周期和 Surface 变化
- `ON_PAUSE`：调用 `decoder.setSurface(null)` 切换到后台
- `ON_RESUME`：调用 `decoder.setSurface(realSurface)` 恢复前台
- 统一管理 Surface 切换，避免重复调用

**SurfaceHolder.Callback**：
- `surfaceCreated/Changed/Destroyed` 只更新状态
- 不直接调用 `setSurface()`
- 避免与 DisposableEffect 冲突

#### 4. 关键要点

**避免重启的核心**：
- `LaunchedEffect` 不依赖 `surfaceHolder`
- Surface 变化不触发 Effect 重新执行
- 解码器只在流真正变化时重启

**线程安全**：
- 使用 `surfaceLock` 同步锁
- 防止并发切换 Surface
- 检查解码器状态避免崩溃

**状态管理**：
- `isSurfaceBound`：标记当前是否绑定真实 Surface
- `shouldRender`：根据 Surface 状态决定是否渲染帧

#### 5. 生命周期流程

**前台 → 后台**：
1. `ON_PAUSE` 事件触发
2. `DisposableEffect` 调用 `decoder.setSurface(null)`
3. 解码器切换到 dummy Surface
4. 继续解码，丢弃帧，Socket 保持活跃

**后台 → 前台**：
1. `ON_RESUME` 事件触发
2. `DisposableEffect` 调用 `decoder.setSurface(realSurface)`
3. 解码器切换回真实 Surface
4. 恢复渲染，用户立即看到画面

**优势**：
- 无需重新连接
- 切换瞬间完成
- 用户体验流畅

### 注意事项

1. **MediaCodec 限制**：
   - `setOutputSurface()` 在 API 23+ (Android 6.0+) 可用
   - 本项目要求 Android 8.0+ (API 26+)，完全支持
   - 必须在解码器 `start()` 后调用
   - 不能在 `configure()` 时传 null

2. **资源管理**：
   - dummy Surface 在解码器启动时创建
   - 在解码器停止时释放
   - 避免内存泄漏

3. **错误处理**：
   - 检查 Surface 有效性 `surface.isValid`
   - 捕获 `IllegalStateException`（解码器已停止）
   - 日志记录切换状态便于调试
