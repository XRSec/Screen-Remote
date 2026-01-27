# Scrcpy Mobile 架构文档

## 1. 架构概述

### 1.1 设计理念

Scrcpy Mobile 采用 **Google Now in Android** 推荐的模块化架构，遵循以下核心原则：

- **单向数据流**：UI → ViewModel → Repository → DataSource
- **依赖倒置**：高层模块不依赖低层模块，都依赖抽象
- **关注点分离**：UI、业务逻辑、数据层严格分离
- **可测试性**：每层独立可测试
- **Feature-First**：按功能模块组织代码，而非技术层次

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        app 层                                │
│  应用入口、导航配置、全局状态管理                              │
│  - MainActivity.kt                                           │
│  - ScreenRemoteApp.kt                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      feature 层                              │
│  功能模块（Feature-First）                                    │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │ session  │ remote   │ device   │ settings │ codec    │  │
│  │ 会话管理  │ 远程控制  │ 设备管理  │ 设置功能  │ 编解码器 │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
│  每个功能模块包含：                                           │
│  - ui/          (Compose UI 组件)                            │
│  - viewmodel/   (ViewModel 层)                              │
│  - data/        (Repository 实现，可选)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  infrastructure 层                           │
│  基础设施实现（技术细节）                                      │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │ adb/         │ scrcpy/      │ media/       │            │
│  │ ADB 连接实现  │ Scrcpy 协议   │ 媒体编解码    │            │
│  └──────────────┴──────────────┴──────────────┘            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       core 层                                │
│  核心基础设施（被所有模块依赖）                                │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │ common   │ design   │ data     │ domain   │ i18n     │  │
│  │ 通用工具  │ 设计系统  │ 数据基础  │ 领域模型  │ 国际化   │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│                      service 层                              │
│  Android 后台服务                                             │
│  - ScrcpyForegroundService.kt                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 模块划分

### 2.1 app 层

**职责**：应用入口、导航配置、全局状态管理

**包名**：`com.mobile.scrcpy.android.app`

**主要组件**：
- `MainActivity.kt`：应用主入口
- `ScreenRemoteApp.kt`：Compose 应用根组件
- `navigation/`：导航配置（预留）

**依赖**：可依赖所有其他层

---

### 2.2 feature 层（功能模块）

**职责**：实现具体业务功能，每个功能模块独立

**包名**：`com.mobile.scrcpy.android.feature.*`

#### 2.2.1 session（会话管理）

**功能**：管理远程控制会话、分组管理

**结构**：
```
feature/session/
├── data/
│   └── repository/
│       ├── SessionRepository.kt      # 会话数据仓库
│       └── GroupRepository.kt        # 分组数据仓库
├── ui/
│   ├── SessionListScreen.kt          # 会话列表屏幕
│   └── component/
│       ├── AddSessionDialog.kt       # 添加会话对话框
│       ├── SessionDialogComponents.kt
│       ├── SessionDialogSections.kt
│       └── SessionDialogState.kt
└── viewmodel/
    ├── SessionViewModel.kt           # 会话视图模型
    ├── GroupViewModel.kt             # 分组视图模型
    └── MainViewModel.kt              # 主视图模型
```

**关键类**：
- `SessionRepository`：会话数据的 CRUD 操作
- `GroupRepository`：分组数据的 CRUD 操作
- `SessionViewModel`：会话列表状态管理
- `SessionListScreen`：会话列表 UI

#### 2.2.2 remote（远程控制）

**功能**：远程设备控制、视频/音频流显示、触摸交互

**结构**：
```
feature/remote/
├── ui/
│   ├── RemoteDisplayScreen.kt        # 远程显示主屏幕
│   └── component/
│       ├── video/                    # 视频显示组件
│       ├── audio/                    # 音频控制组件
│       ├── touch/                    # 触摸交互组件
│       ├── floating/                 # 悬浮按钮组件
│       └── connection/               # 连接状态组件
└── viewmodel/
    ├── ConnectionViewModel.kt        # 连接状态管理
    └── ControlViewModel.kt           # 控制逻辑管理
```

**关键类**：
- `RemoteDisplayScreen`：远程控制主界面
- `ConnectionViewModel`：管理设备连接状态
- `ControlViewModel`：管理控制逻辑（触摸、按键等）

#### 2.2.3 device（设备管理）

**功能**：USB/网络设备管理、ADB 密钥管理

**结构**：
```
feature/device/
├── ui/
│   ├── DeviceManagementScreen.kt     # 设备管理屏幕
│   └── component/
│       ├── AdbKeyDialog.kt           # ADB 密钥对话框
│       ├── UsbDeviceDialog.kt        # USB 设备对话框
│       ├── UsbDeviceItem.kt          # USB 设备列表项
│       └── UsbDeviceSelectionDialog.kt
└── viewmodel/
    ├── ui/                           # UI 相关 ViewModel
    └── feature/                      # 功能相关 ViewModel
```

**关键类**：
- `DeviceManagementScreen`：设备管理主界面
- `UsbDeviceDialog`：USB 设备选择和配置

#### 2.2.4 settings（设置功能）

**功能**：应用设置、外观配置、语言切换、日志管理

**结构**：
```
feature/settings/
├── ui/
│   ├── SettingsScreen.kt             # 设置主屏幕
│   ├── AboutScreen.kt                # 关于页面
│   ├── ActionsScreen.kt              # 操作设置
│   ├── AppearanceScreen.kt           # 外观设置
│   ├── LanguageScreen.kt             # 语言设置
│   ├── LogManagementScreen.kt        # 日志管理
│   ├── FilePathDialog.kt             # 文件路径选择
│   └── SettingsComponents.kt         # 通用设置组件
└── viewmodel/
    └── SettingsViewModel.kt          # 设置视图模型
```

**关键类**：
- `SettingsScreen`：设置主界面
- `SettingsViewModel`：设置状态管理
- `LanguageScreen`：语言切换界面

#### 2.2.5 codec（编解码器测试）

**功能**：编解码器测试和选择

**结构**：
```
feature/codec/
├── ui/
│   ├── CodecTestScreen.kt            # 编解码器测试屏幕
│   └── CodecTestUtils.kt             # 测试工具
└── component/
    ├── CodecMapper.kt                # 编解码器映射
    ├── EncoderModels.kt              # 编码器模型
    └── EncoderSelectionDialog.kt     # 编码器选择对话框
```

**关键类**：
- `CodecTestScreen`：编解码器测试界面
- `EncoderSelectionDialog`：编码器选择对话框

---

### 2.3 infrastructure 层（基础设施）

**职责**：提供技术实现，封装底层协议和硬件交互

**包名**：`com.mobile.scrcpy.android.infrastructure.*`

#### 2.3.1 adb（ADB 基础设施）

**功能**：ADB 连接、USB 通信、设备信息获取

**结构**：
```
infrastructure/adb/
├── connection/
│   ├── AdbBridge.kt                  # ADB 桥接
│   ├── AdbConnection.kt              # ADB 连接
│   ├── AdbConnectionManager.kt       # 连接管理器
│   ├── AdbConnectionKeepAlive.kt     # 连接保活
│   ├── AdbConnectionVerifier.kt      # 连接验证
│   ├── AdbModels.kt                  # ADB 数据模型
│   ├── AdbEncoderDetector.kt         # 编码器检测
│   ├── AdbFileOperations.kt          # 文件操作
│   ├── DeviceInfoProvider.kt         # 设备信息提供者
│   └── SocketForwarder.kt            # Socket 转发
├── key/
│   └── core/                         # ADB 密钥管理
└── usb/
    ├── AdbProtocol.kt                # ADB 协议
    ├── UsbAdbChannel.kt              # USB ADB 通道
    ├── UsbAdbManager.kt              # USB ADB 管理器
    └── UsbDadb.kt                    # USB Dadb 实现
```

**关键类**：
- `AdbConnectionManager`：管理 ADB 连接生命周期
- `UsbAdbManager`：管理 USB ADB 连接
- `DeviceInfoProvider`：获取设备信息

#### 2.3.2 scrcpy（Scrcpy 协议）

**功能**：Scrcpy 协议实现、视频/音频流处理

**结构**：
```
infrastructure/scrcpy/
├── client/
│   └── feature/                      # 客户端功能
├── connection/
│   ├── feature/                      # 连接功能
│   ├── ConnectionLifecycle.kt        # 连接生命周期
│   ├── ConnectionMetadataReader.kt   # 元数据读取
│   ├── ConnectionShellMonitor.kt     # Shell 监控
│   ├── ConnectionSocketManager.kt    # Socket 管理
│   ├── ConnectionState.kt            # 连接状态
│   └── ConnectionStateMachine.kt     # 状态机
├── controller/
│   └── feature/                      # 控制器功能
├── protocol/
│   └── feature/                      # 协议功能
└── stream/
    └── feature/                      # 流处理功能
```

**关键类**：
- `ConnectionStateMachine`：管理连接状态转换
- `ConnectionSocketManager`：管理 Socket 连接
- `ConnectionLifecycle`：管理连接生命周期

#### 2.3.3 media（媒体编解码）

**功能**：视频/音频编解码、格式处理

**结构**：
```
infrastructure/media/
├── video/
│   ├── VideoCodecManager.kt          # 视频编解码器管理
│   ├── VideoDecoder.kt               # 视频解码器
│   ├── VideoFormatHandler.kt         # 视频格式处理
│   └── VideoNalParser.kt             # NAL 单元解析
└── audio/
    ├── AudioDecoder.kt               # 音频解码器
    ├── AudioFormatHandler.kt         # 音频格式处理
    └── AudioTrackManager.kt          # 音频轨道管理
```

**关键类**：
- `VideoDecoder`：视频解码实现
- `AudioDecoder`：音频解码实现
- `VideoCodecManager`：管理视频编解码器

---

### 2.4 core 层（核心基础设施）

**职责**：提供通用工具、设计系统、领域模型，不依赖任何其他层

**包名**：`com.mobile.scrcpy.android.core.*`

#### 2.4.1 common（通用工具）

**功能**：通用工具类、管理器、常量

**结构**：
```
core/common/
├── util/
│   ├── ApiCompatHelper.kt            # API 兼容性辅助
│   └── Extensions.kt                 # Kotlin 扩展函数
├── manager/
│   ├── LanguageManager.kt            # 语言管理器
│   ├── LogManager.kt                 # 日志管理器
│   ├── HapticFeedbackManager.kt      # 触觉反馈管理器
│   └── TTSManager.kt                 # 文本转语音管理器
└── Constants.kt                      # 全局常量
```

**关键类**：
- `LanguageManager`：管理应用语言切换
- `LogManager`：统一日志管理
- `ApiCompatHelper`：处理不同 Android 版本的 API 兼容性

#### 2.4.2 designsystem（设计系统）

**功能**：Material 3 主题、通用 UI 组件

**结构**：
```
core/designsystem/
├── theme/
│   ├── Theme.kt                      # 主题定义
│   ├── Color.kt                      # 颜色定义
│   └── Typography.kt                 # 字体定义
├── component/
│   ├── ActionDialog.kt               # 操作对话框
│   ├── CommonComponents.kt           # 通用组件
│   ├── AddGroupDialog.kt             # 添加分组对话框
│   ├── CompactGroupSelector.kt       # 紧凑分组选择器
│   ├── GroupManagementDialog.kt      # 分组管理对话框
│   ├── GroupSelectorDialog.kt        # 分组选择对话框
│   ├── GroupTreeComponents.kt        # 分组树组件
│   ├── GroupTreeUtils.kt             # 分组树工具
│   ├── LogFileItem.kt                # 日志文件列表项
│   ├── LogViewerDialog.kt            # 日志查看器
│   ├── MessageList.kt                # 消息列表
│   ├── PathSelectorDialog.kt         # 路径选择器
│   └── TagFilterDialog.kt            # 标签过滤器
└── icon/                             # 图标资源（预留）
```

**关键类**：
- `Theme.kt`：定义应用主题（亮色/暗色）
- `CommonComponents.kt`：可复用的 Compose 组件
- `GroupTreeComponents.kt`：分组树形结构组件

#### 2.4.3 data（数据层基础设施）

**功能**：数据存储、Repository 接口定义

**结构**：
```
core/data/
├── datastore/
│   └── PreferencesManager.kt         # DataStore 封装
├── repository/
│   ├── SessionRepositoryInterface.kt # 会话仓库接口
│   └── GroupRepositoryInterface.kt   # 分组仓库接口
└── model/                            # 数据传输对象（DTO，预留）
```

**关键类**：
- `PreferencesManager`：封装 DataStore 操作
- `SessionRepositoryInterface`：定义会话数据操作接口

#### 2.4.4 domain（领域模型）

**功能**：领域实体、业务规则

**结构**：
```
core/domain/
├── model/
│   ├── Session.kt                    # 会话实体
│   ├── Device.kt                     # 设备实体
│   ├── Group.kt                      # 分组实体
│   ├── Settings.kt                   # 设置实体
│   ├── ScrcpyOptions.kt              # Scrcpy 选项
│   ├── Connection.kt                 # 连接实体
│   └── Action.kt                     # 操作实体
└── usecase/                          # 用例（预留）
```

**关键类**：
- `Session`：会话领域模型
- `Device`：设备领域模型
- `ScrcpyOptions`：Scrcpy 配置选项

#### 2.4.5 i18n（国际化）

**功能**：多语言支持

**结构**：
```
core/i18n/
├── BilingualTexts.kt                 # 双语文本定义
└── LanguageManager.kt                # 语言管理器（链接）
```

**关键类**：
- `BilingualTexts`：定义中英文文本映射

---

### 2.5 service 层

**职责**：Android 后台服务

**包名**：`com.mobile.scrcpy.android.service`

**主要组件**：
- `ScrcpyForegroundService.kt`：Scrcpy 前台服务，保持连接活跃

**依赖**：依赖 `infrastructure` 和 `core` 层

---

## 3. 依赖关系

### 3.1 依赖规则

```
app 层
  ↓ 可依赖所有层
feature 层
  ↓ 可依赖 infrastructure、core
infrastructure 层
  ↓ 只能依赖 core
core 层
  ↓ 不依赖任何层（纯工具和模型）
service 层
  ↓ 可依赖 infrastructure、core
```

### 3.2 依赖图

```
┌─────────┐
│   app   │
└────┬────┘
     │
     ├──────────────┬──────────────┐
     ↓              ↓              ↓
┌─────────┐   ┌─────────┐   ┌─────────┐
│ feature │   │ service │   │  core   │
└────┬────┘   └────┬────┘   └─────────┘
     │             │
     ├─────────────┤
     ↓             ↓
┌──────────────────────┐
│   infrastructure     │
└──────────┬───────────┘
           ↓
      ┌─────────┐
      │  core   │
      └─────────┘
```

### 3.3 禁止的依赖

❌ **core 层不能依赖任何其他层**  
❌ **infrastructure 层不能依赖 feature 层**  
❌ **feature 模块之间不能相互依赖**（通过 core 层共享）

---

## 4. 包名规范

### 4.1 包名结构

| 层级 | 包名前缀 | 示例 |
|------|---------|------|
| app | `com.mobile.scrcpy.android.app` | `com.mobile.scrcpy.android.app.MainActivity` |
| feature | `com.mobile.scrcpy.android.feature.<功能>` | `com.mobile.scrcpy.android.feature.session.ui` |
| infrastructure | `com.mobile.scrcpy.android.infrastructure.<技术>` | `com.mobile.scrcpy.android.infrastructure.adb.connection` |
| core | `com.mobile.scrcpy.android.core.<模块>` | `com.mobile.scrcpy.android.core.common.util` |
| service | `com.mobile.scrcpy.android.service` | `com.mobile.scrcpy.android.service.ScrcpyForegroundService` |

### 4.2 命名约定

- **UI 组件**：`*Screen.kt`（屏幕）、`*Dialog.kt`（对话框）、`*Item.kt`（列表项）
- **ViewModel**：`*ViewModel.kt`
- **Repository**：`*Repository.kt`
- **Manager**：`*Manager.kt`
- **Utils**：`*Utils.kt` 或 `*Helper.kt`

---

## 5. 开发指南

### 5.1 添加新功能模块

1. 在 `feature/` 下创建新目录，如 `feature/newfeature/`
2. 创建标准结构：
   ```
   feature/newfeature/
   ├── ui/              # UI 组件
   ├── viewmodel/       # ViewModel
   └── data/            # Repository（可选）
   ```
3. 定义包名：`com.mobile.scrcpy.android.feature.newfeature.*`
4. 只依赖 `core` 和 `infrastructure` 层

### 5.2 添加通用组件

1. 如果是 UI 组件，放在 `core/designsystem/component/`
2. 如果是工具类，放在 `core/common/util/`
3. 如果是领域模型，放在 `core/domain/model/`

### 5.3 添加基础设施

1. 在 `infrastructure/` 下创建新目录，如 `infrastructure/bluetooth/`
2. 只依赖 `core` 层
3. 提供清晰的接口供 `feature` 层使用

### 5.4 数据流示例

```kotlin
// 1. UI 层（feature/session/ui/SessionListScreen.kt）
@Composable
fun SessionListScreen(viewModel: SessionViewModel = viewModel()) {
    val sessions by viewModel.sessions.collectAsState()
    // UI 渲染
}

// 2. ViewModel 层（feature/session/viewmodel/SessionViewModel.kt）
class SessionViewModel(
    private val repository: SessionRepository
) : ViewModel() {
    val sessions: StateFlow<List<Session>> = repository.getAllSessions()
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())
}

// 3. Repository 层（feature/session/data/repository/SessionRepository.kt）
class SessionRepository(
    private val preferencesManager: PreferencesManager
) {
    fun getAllSessions(): Flow<List<Session>> {
        return preferencesManager.getSessions()
    }
}

// 4. DataStore 层（core/data/datastore/PreferencesManager.kt）
class PreferencesManager(context: Context) {
    private val dataStore = context.dataStore
    
    fun getSessions(): Flow<List<Session>> {
        return dataStore.data.map { it.sessions }
    }
}
```

---

## 6. 测试指南

### 6.1 单元测试

- **core 层**：测试工具类、扩展函数、领域模型
- **infrastructure 层**：测试协议实现、编解码器
- **feature 层**：测试 ViewModel、Repository

### 6.2 UI 测试

- 使用 Compose Testing 测试 UI 组件
- 测试用户交互流程

### 6.3 集成测试

- 测试模块间交互
- 测试完整的数据流

---

## 7. 性能优化

### 7.1 模块化优势

- **并行编译**：各模块可并行编译，加快构建速度
- **增量编译**：只重新编译修改的模块
- **按需加载**：未来可支持动态功能模块（Dynamic Feature Module）

### 7.2 依赖优化

- **避免循环依赖**：严格遵循依赖规则
- **最小化依赖**：只依赖必要的模块
- **接口隔离**：通过接口解耦

---

## 8. 迁移历史

### 8.1 迁移时间线

- **2024 年**：完成架构迁移
  - 阶段 1：核心基础设施层重组
  - 阶段 2：基础设施层重组
  - 阶段 3：功能模块重组
  - 阶段 4：服务层和应用入口
  - 阶段 5：清理和验证

### 8.2 迁移收益

- ✅ 清晰的模块边界和职责划分
- ✅ 更好的代码复用性
- ✅ 降低模块间耦合度
- ✅ 更容易定位和修复 Bug
- ✅ 支持团队协作开发

详见：[MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)

---

## 9. 参考资料

- [Now in Android Architecture](https://github.com/android/nowinandroid/blob/main/docs/ArchitectureLearningJourney.md)
- [Guide to app architecture](https://developer.android.com/topic/architecture)
- [Modularization](https://developer.android.com/topic/modularization)
- [Kotlin Coding Conventions](https://kotlinlang.org/docs/coding-conventions.html)

---

## 10. 常见问题

### Q1: 为什么采用 Feature-First 而不是 Layer-First？

**A**: Feature-First 按功能模块组织代码，每个功能模块包含完整的 UI、ViewModel、Repository，便于：
- 功能独立开发和测试
- 代码定位更快（所有相关代码在一起）
- 支持动态功能模块
- 团队协作更高效（不同团队负责不同功能）

### Q2: core 层和 infrastructure 层有什么区别？

**A**:
- **core 层**：纯工具、模型、接口定义，不包含技术实现细节
- **infrastructure 层**：技术实现，如 ADB 协议、Scrcpy 协议、媒体编解码

### Q3: feature 模块之间如何共享代码？

**A**: 通过 `core` 层共享：
- 通用 UI 组件 → `core/designsystem/component/`
- 领域模型 → `core/domain/model/`
- 工具类 → `core/common/util/`

### Q4: 如何避免 ViewModel 过于臃肿？

**A**:
- 使用 UseCase 封装复杂业务逻辑（`core/domain/usecase/`）
- 将数据操作委托给 Repository
- 使用 Kotlin Flow 进行响应式编程

### Q5: 如何处理跨功能模块的导航？

**A**:
- 在 `app/navigation/` 定义全局导航图
- 使用 Jetpack Navigation Compose
- 功能模块只负责自己的 UI，不处理导航逻辑

---

**文档版本**：1.0  
**最后更新**：2024  
**维护者**：Scrcpy Mobile Team
