# TextureView vs SurfaceView 技术说明

## 概述

Scrcpy Mobile 支持两种视频渲染方式：TextureView 和 SurfaceView。用户可以通过"全屏模式"开关在两者之间切换。

## 技术对比

### TextureView（全屏模式启用）

#### 优势
1. **真全屏支持**
   - 可以隐藏系统导航栏
   - 提供沉浸式体验
   - 适合需要最大化显示区域的场景

2. **原生后台运行支持**
   - 不需要虚拟 Surface 机制
   - 切换到后台时不会被 Android 系统杀死
   - 可以直接在后台继续渲染
   - 适合需要长时间保持连接的场景

3. **灵活性**
   - 支持动画和变换
   - 可以像普通 View 一样操作
   - 支持透明度和旋转

#### 劣势
1. **延迟略高**
   - 需要额外的图形缓冲区拷贝
   - 渲染路径更长
   - 相比 SurfaceView 延迟增加约 1-2 帧

2. **内存占用**
   - 需要额外的纹理内存
   - 在低端设备上可能影响性能

### SurfaceView（全屏模式关闭）

#### 优势
1. **延迟更低**
   - 直接渲染到独立的 Surface
   - 渲染路径最短
   - 适合对延迟敏感的场景（如游戏）

2. **性能更好**
   - 硬件加速效率更高
   - CPU 和 GPU 占用更低
   - 在低端设备上表现更好

3. **内存效率**
   - 不需要额外的纹理缓冲区
   - 内存占用更小

#### 劣势
1. **不支持真全屏**
   - 无法隐藏系统导航栏
   - 导航栏始终显示
   - 显示区域受限

2. **后台运行需要特殊处理**
   - 必须使用虚拟 Surface（Dummy Surface）方案
   - 切换到后台时需要切换到虚拟 Surface
   - 实现相对复杂

3. **灵活性受限**
   - 不支持动画和变换
   - 不能像普通 View 一样操作
   - 在 View 层级中是一个"洞"

## 后台运行机制

### TextureView - 原生支持

TextureView 原生支持后台运行，不需要特殊处理：

1. **前台运行**
   - TextureView 正常渲染视频流
   - 用户可以看到画面

2. **切换到后台**
   - TextureView 继续存在
   - 解码器继续运行
   - 视频流继续解码（但不显示）
   - 连接保持活跃

3. **返回前台**
   - TextureView 立即恢复显示
   - 无需重新连接

### SurfaceView - 虚拟 Surface（Dummy Surface）方案

SurfaceView 在后台会被系统销毁，需要使用虚拟 Surface 机制：

1. **初始化阶段**
   - 创建 1x1 像素的虚拟 Surface 作为占位符
   - 虚拟 Surface 始终存在

2. **前台运行**
   - 解码器输出到真实的 SurfaceView
   - 视频正常解码和显示

3. **切换到后台**
   - SurfaceView 被系统销毁
   - 解码器切换到虚拟 Surface
   - 解码器继续运行但输出到虚拟 Surface（不显示）
   - 保持与远程设备的连接

4. **返回前台**
   - SurfaceView 重新创建
   - 解码器切换回真实 SurfaceView
   - 恢复正常显示

**关键区别**：
- TextureView：不需要虚拟 Surface，原生支持后台运行
- SurfaceView：必须使用虚拟 Surface 方案才能在后台保持连接

详见项目文档中的后台切换机制说明。

## 黑边问题

### 原因
无论使用 TextureView 还是 SurfaceView，都可能出现黑边。这是由于：

1. **屏幕比例不匹配**
   - 远程设备屏幕比例：如 16:9、18:9、19.5:9
   - 本地设备屏幕比例：可能不同
   - 为保持画面不变形，必须添加黑边

2. **分辨率差异**
   - 远程设备分辨率可能高于或低于本地设备
   - 需要缩放以适配屏幕

### 解决方案
黑边是无法完全避免的，但可以通过以下方式优化：

1. **调整最大尺寸**
   - 设置合适的最大分辨率
   - 减少分辨率差异

2. **选择合适的模式**
   - TextureView：真全屏可以最大化显示区域
   - SurfaceView：虽然有导航栏，但延迟更低

3. **接受黑边**
   - 黑边是保持画面比例的必要代价
   - 避免画面拉伸变形

## 使用建议

### 选择 TextureView（启用全屏）的场景

✅ 需要沉浸式体验  
✅ 需要隐藏导航栏  
✅ 需要长时间后台运行  
✅ 对延迟不太敏感（如视频播放、浏览）  
✅ 设备性能较好  

### 选择 SurfaceView（关闭全屏）的场景

✅ 对延迟敏感（如游戏、实时操作）  
✅ 设备性能较低  
✅ 需要最低的 CPU/GPU 占用  
✅ 可以接受导航栏显示  
✅ 追求最佳性能  

## 性能数据参考

### 延迟对比（参考值）
- **SurfaceView**: ~30-50ms
- **TextureView**: ~40-60ms
- **差异**: 约 10ms（1-2 帧 @ 60fps）

### CPU 占用对比（参考值）
- **SurfaceView**: 基准
- **TextureView**: +5-10%

### 内存占用对比（参考值）
- **SurfaceView**: 基准
- **TextureView**: +10-20MB（取决于分辨率）

*注：实际数据因设备、分辨率、编码器等因素而异*

## 实现细节

### TextureView 渲染流程
```
远程设备 → 编码 → 网络传输 → 解码 → 纹理缓冲区 → TextureView → 屏幕
                                          ↑
                                    额外拷贝（增加延迟）
```

### SurfaceView 渲染流程
```
远程设备 → 编码 → 网络传输 → 解码 → Surface → 屏幕
                                    ↑
                                直接渲染（延迟最低）
```

## 代码位置

### 相关文件
- 视频渲染实现：`app/src/main/java/com/mobile/scrcpy/android/feature/video/`
- 后台切换逻辑：`app/src/main/java/com/mobile/scrcpy/android/service/`
- 虚拟 Surface 管理：参考 `docs/video.md`

### 配置选项
- UI 开关：`SessionDialogSections.kt` - "全屏模式"
- 数据模型：`SessionConfig.useFullScreen`
- 帮助说明：`SessionTexts.HELP_USE_FULL_SCREEN`

## 常见问题

### Q: 为什么不能同时支持真全屏和低延迟？
A: 这是 Android 系统的限制。TextureView 的灵活性（包括真全屏）需要额外的图形处理，导致延迟增加。SurfaceView 直接渲染到独立 Surface，无法像普通 View 一样控制系统 UI。

### Q: 黑边能完全消除吗？
A: 不能。黑边是保持画面比例的必要代价。如果强制拉伸以填满屏幕，画面会变形。

### Q: 后台运行会消耗流量吗？
A: 会。虽然画面不显示，但视频流仍在传输和解码，会持续消耗流量和电量。TextureView 和 SurfaceView 在后台都会继续解码视频流。

### Q: 如何选择最适合的模式？
A: 根据使用场景：
- 游戏、实时操作 → SurfaceView（低延迟）
- 视频播放、浏览 → TextureView（真全屏）
- 低端设备 → SurfaceView（低资源占用）
- 高端设备 → TextureView（更好的体验）

## 未来优化方向

1. **自适应模式**
   - 根据设备性能自动选择
   - 根据使用场景智能切换

2. **延迟优化**
   - 优化 TextureView 渲染路径
   - 减少缓冲区拷贝

3. **黑边优化**
   - 智能裁剪选项
   - 自适应缩放算法

## 参考资料

- [Android TextureView 官方文档](https://developer.android.com/reference/android/view/TextureView)
- [Android SurfaceView 官方文档](https://developer.android.com/reference/android/view/SurfaceView)
- [Scrcpy 官方文档](https://github.com/Genymobile/scrcpy)
- 项目文档：`docs/video.md`
