---
inclusion: always
---

# Scrcpy Mobile 项目上下文

## 项目概述
Android 设备间屏幕镜像和控制应用，基于 scrcpy 技术。

**技术栈**：Kotlin + Jetpack Compose + MVVM + C/C++ (CMake)  
**兼容性**：Android 6.0+ (API 23+)  
**开发环境**：Android Studio Hedgehog+, JDK 17, SDK 34, NDK 25.x+, CMake 3.22+

## 国际化规范

### 核心原则
- **禁用 strings.xml**：不使用 Android 传统资源文件
- **双语管理**：`BilingualTexts.kt` + `LanguageManager.kt`
- **单语管理**：`Constants.kt` 的 `UITexts`（技术性文本）
- **占位符**：`PlaceholderTexts`（输入框占位符）

### 文本分类与使用

#### 1. BilingualTexts.kt（双语文本）
**用途**：所有需要中英文支持的 UI 文本

**定义**：`val SETTINGS_TITLE = TextPair("设置", "Settings")`

**使用规则**：
- Dialog/Sheet/弹窗 → `BilingualTexts.xxx.get()`（避免闪烁）
- 主页面/长期显示 → `rememberText()`（支持动态切换）

**命名**：`模块_功能`（如 `SETTINGS_TITLE`、`SESSION_DELETE`）

#### 2. Constants.kt UITexts（单语文本）
**用途**：技术性文本，统一使用英文

**定义**：`const val DIALOG_CONNECTING = "Connecting"`

**适用**：连接进度、日志输出、调试信息、API 固定文本

**命名**：`类型_描述`（如 `STEP_ADB_CONNECT`、`CONNECTION_FAILED`）

### 语言闪烁问题
**原因**：`rememberText()` 首次订阅 Flow 返回默认值，后加载真实设置  
**解决**：Dialog/弹窗使用 `.get()` 直接读取当前语言

## 核心配置文件

### Constants.kt (`common/Constants.kt`)
项目常量唯一来源：AppColors、AppDimens、AppTextSizes、NetworkConstants、ScrcpyConstants、PlaceholderTexts、LogTags、UITexts

### BilingualTexts.kt (`common/BilingualTexts.kt`)
双语文本定义，按功能模块分组（设置、会话、日志、编解码器等）

### LanguageManager.kt (`common/LanguageManager.kt`)
语言管理器，支持 AUTO（跟随系统）、CHINESE、ENGLISH

### Models.kt (`core/data/model/Models.kt`)
统一数据模型定义：会话、设备、配置、语言等跨模块数据结构

### ApiCompatHelper.kt (`common/ApiCompatHelper.kt`)
Android API 版本兼容性统一管理：PendingIntent、前台服务、系统栏、MediaCodec、权限  
**规范**：禁止直接使用 `Build.VERSION.SDK_INT`

## 开发规范

### 文件组织
- `common/`: Constants.kt, LanguageManager.kt, ApiCompatHelper.kt
- `core/data/model/`: Models.kt（统一数据模型）
- `ui/`: screens/, components/
- `ui/viewmodels/`: ViewModel 层
- `domain/`: 业务逻辑
- `data/`: 数据层
- `cpp/`: 原生代码

### 代码规范
- Kotlin 官方风格 + Material Design 3
- 复杂逻辑必须注释，公共 API 需要 KDoc
- 禁止硬编码，所有常量在 Constants.kt

### Compose Dialog 回调规范
**问题**：`onDismiss` / `onBack` 回调必须正确实现，否则返回键失效  
**原因**：Dialog 显示由父组件状态控制，回调必须修改状态触发重组

**规则**：
- ❌ `onDismiss = { }` 空函数导致返回键失效
- ✅ `onDismiss = { showDialog = false }` 修改状态关闭 Dialog
- ⚠️ IDE 警告 "Assigned value is never read" 是误报（赋值触发 Compose 重组）

**适用**：Dialog、ModalBottomSheet、自定义全屏覆盖组件

### 日志规范
使用 `LogTags` 定义标签，遵循包含命名逻辑：Decode → AudioDecode → XxxAudioDecode

## Scrcpy 会话管理

### 后台切换机制（Dummy Surface 技术）
**问题**：后台时 Surface 销毁，传统方案停止解码器导致连接断开

**解决方案**：
- 解码器启动时创建 1x1 dummy Surface 作为占位
- 前台：解码到真实 Surface（正常渲染）
- 后台：解码到 dummy Surface（丢弃帧但保持连接）

**实现要点**：
- `LaunchedEffect` 只依赖 `videoStream`，不依赖 `surfaceHolder`
- `DisposableEffect` 监听生命周期，统一处理 Surface 切换
- `SurfaceHolder.Callback` 只更新状态，不直接操作解码器

**详细文档**：`docs/video.md`

## 代码审查要点

1. **常量管理**：无硬编码，统一到 Constants.kt 或 BilingualTexts.kt
2. **双语文本**：Dialog 用 `.get()`，主页面用 `rememberText()`
3. **单语文本**：技术性文本使用 Constants.kt UITexts
4. **数据模型**：无重复定义，统一到 Models.kt
5. **API 兼容**：使用 ApiCompatHelper，禁止直接判断 SDK 版本
6. **日志标签**：使用 LogTags，遵循包含命名
7. **Dialog 回调**：`onDismiss` / `onBack` 不能是空函数
8. **性能**：避免主线程阻塞
9. **安全**：权限检查和数据验证

## 重要文档
- `docs/TODO.md`: 待办事项
- `docs/IMPLEMENTATION_PROGRESS*.md`: 实现进度
- `docs/android-interface-spec.md`: Android 接口规范
- `docs/video.md`: 视频解码和后台切换详细文档

## 依赖项目
- `external/scrcpy`: 官方 C 实现
- `external/libadb-android`: Android ADB 库
- `external/Easycontrol`、`external/ScrcpyForAndroid`: 参考实现

## 工作流程

### 添加新功能
1. 在 `docs/TODO.md` 记录需求
2. 新增常量 → `Constants.kt`
3. 新增数据模型 → `Models.kt`
4. 实现功能

### 文档规范
- 不生成 markdown .md 文档（节约 token）
- 有意义的总结/分析，提供文件名让用户自行创建
- 文件名格式：`IMPLEMENTATION_PROGRESS_N`
