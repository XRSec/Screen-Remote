---
inclusion: always
---

# Scrcpy Mobile 项目上下文

## 项目概述
Android 设备间屏幕镜像和控制应用，基于 scrcpy 技术。

**技术栈**：Kotlin + Jetpack Compose + MVVM + C/C++ (CMake)  
**兼容性**：Android 6.0+ (API 23+)  
**开发环境**：Android Studio Hedgehog+, JDK 21, SDK 34, NDK 25.x+, CMake 3.22+

## 国际化规范

### 核心原则
- 禁用 strings.xml（仅保留 app_name）
- 双语管理：XxxTexts.kt (object) + TextPair + LanguageManager
- 按功能模块拆分：CommonTexts, SessionTexts, SettingsTexts, AdbTexts, RemoteTexts, CodecTexts, LogTexts

### 使用规则
- Dialog/弹窗 → `XxxTexts.xxx.get()`（避免闪烁）
- 主页面 → `rememberText(XxxTexts.xxx)`（支持动态切换）
- 命名：`模块_功能`（如 MAIN_TITLE, SESSION_DELETE）

### 核心文件
- `core/i18n/XxxTexts.kt` - 双语文本定义
- `core/i18n/TextPair.kt` - 文本对数据类
- `core/common/manager/LanguageManager.kt` - 语言管理器（支持 AUTO/CHINESE/ENGLISH）

## 代码组织模式

### XxxModels.kt 模式
包级数据类、接口、枚举集中管理（类似 Go 的 model.go），便于 import package.*

### Constants.kt 模式
位置：`core/common/Constants.kt`，使用多个 object 按功能分组：AppColors, AppDimens, AppTextSizes, NetworkConstants, ScrcpyConstants, AppConstants, FilePathConstants, UIConstants, SessionColors, PlaceholderTexts, LogTags

### 核心工具类
- `ApiCompatHelper.kt` - Android API 版本兼容性统一管理，禁止直接使用 Build.VERSION.SDK_INT

## 开发规范

### 架构分层
core → infrastructure → feature → service → app（依赖方向单向）

### 代码规范
- Kotlin 官方风格 + Material Design 3
- 禁止硬编码，常量统一到 Constants.kt 或 XxxTexts.kt
- 使用 ApiCompatHelper 处理 API 兼容性
- 使用 LogTags 定义日志标签

### Compose Dialog 回调
onDismiss/onBack 必须修改状态触发重组，不能是空函数

## UI 组件规范（iOS 风格）

### Dialog/窗口布局
- 使用 wrapContentHeight，不要用 fillMaxHeight
- ✅ 使用：`DialogContainer` - 基础容器，自动处理宽高比和圆角
- ✅ 使用：`DialogPage` - 完整页面容器，包含标题栏、内容区、自动滚动
- ✅ 使用：`DialogHeader` - 标题栏组件
- 顶部容器少用 fillMaxSize

### 标题栏
- ✅ 使用：`DialogHeader(title, onDismiss)` - 统一的 iOS 风格标题栏
- ❌ 禁止：自定义 Surface + Row + IconButton 实现标题栏

### 输入框
- ✅ 使用：`CompactTextField` 或 `LabeledTextField` - iOS 风格无边框输入
- ❌ 禁止：`OutlinedTextField` - Material Design 风格，与项目不符

### 开关
- ✅ 使用：`IOSSwitch` - iOS 风格开关
- ❌ 禁止：`Switch` - Material Design 风格

### 下拉选择
- ✅ 使用：`IOSStyledDropdownMenu` + `IOSStyledDropdownMenuItem` - iOS 风格菜单
- ❌ 禁止：`DropdownMenu` + `DropdownMenuItem` - Material Design 风格

### 列表项
- ✅ 使用：`CompactClickableRow` - 统一高度 38.dp (AppDimens.listItemHeight)
- ✅ 使用：`CompactSwitchRow` - 带开关的列表项
- ✅ 使用：`LabeledRow` - 基础组件，支持任意内容（标题+自定义内容）
- ✅ 使用：`LabeledInputRow` - 标题+输入框
- ✅ 使用：`LabeledSwitchRow` - 标题+开关
- ✅ 使用：`LabeledClickableRow` - 标题+可点击文本
- ❌ 禁止：自定义 Row 实现列表项

### 分组标题
- ✅ 使用：`SectionTitle` - 统一的分组标题样式
- ❌ 禁止：直接使用 Text 作为分组标题

### 分割线
- ✅ 使用：`AppDivider()` - 统一的分割线
- ❌ 禁止：`Divider()` 或 `HorizontalDivider()`

### 核心组件位置
- `core/designsystem/component/CommonComponents.kt` - DialogHeader, AppDivider, SectionTitle
- `core/designsystem/component/IOSStyledComponents.kt` - IOSSwitch, IOSStyledDropdownMenu
- `feature/session/ui/component/SessionDialogComponents.kt` - CompactTextField, LabeledTextField, CompactSwitchRow, CompactClickableRow

## Scrcpy 会话管理

### 后台切换机制（Dummy Surface）
解码器启动时创建 1x1 dummy Surface 占位，前台解码到真实 Surface，后台解码到 dummy Surface 保持连接。详见 docs/video.md

## 代码审查要点

1. 无硬编码，常量统一到 Constants.kt 或 XxxTexts.kt
2. 双语文本：Dialog 用 .get()，主页面用 rememberText()
3. 数据模型集中到 XxxModels.kt
4. 使用 ApiCompatHelper 处理 API 兼容
5. Dialog 回调不能是空函数
6. 依赖方向：app → feature → infrastructure → core
7. **Dialog 必须使用 wrapContentHeight，不要用 fillMaxHeight**
8. **必须使用 DialogHeader，不要自定义标题栏**
9. **输入框使用 CompactTextField/LabeledTextField，不要用 OutlinedTextField**
10. **开关使用 IOSSwitch，不要用 Switch**
11. **下拉菜单使用 IOSStyledDropdownMenu，不要用 DropdownMenu**
12. **列表项高度统一使用 AppDimens.listItemHeight (38.dp)**

## 工作流程

### 添加新功能
1. 确定归属层级（core/infrastructure/feature）
2. 新增常量到 Constants.kt 对应 object
3. 新增双语文本到 core/i18n/XxxTexts.kt
4. 新增数据类到 XxxModels.kt
5. 实现功能（UI → ViewModel → Repository → DataSource）

## AI 协作规范

### 输出原则
- **禁止冗余总结**：完成任务后简短说明即可（1-2 句话），不要生成总结文档、介绍文档、变更列表
- **禁止重复描述**：不要重复说明已经做过的操作
- **直接执行**：理解需求后直接修改代码，不要先描述计划再执行
- **最小化输出**：只输出必要的代码和关键说明，避免冗长解释
