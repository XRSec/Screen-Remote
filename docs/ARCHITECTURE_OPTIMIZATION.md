# 项目架构优化方案

## 问题分析

### 1. maxSize 参数混乱问题

**当前状态：**
- SessionData 中 `maxSize: String = ""` （空字符串）
- ScrcpyOptions 中 `maxSize: Int = 1920`
- ScrcpyClient 中 `maxSize: Int? = null`（可空类型）
- Constants 中同时定义了 `DEFAULT_MAX_SIZE = "1920"` 和 `DEFAULT_MAX_SIZE_INT = 1920`

**混乱原因：**
- 空字符串 `""` 表示不限制
- `null` 也表示不限制
- `1920` 是默认值
- 三种表示方式混用，语义不清晰

**解决方案：**
```kotlin
// 1. 统一使用 Int? 类型，null 表示不限制
// 2. 提供明确的预填充值常量（仅用于创建新会话）
// 3. 在 UI 层和存储层统一处理

// Constants.kt
object ScrcpyConstants {
    /** 
     * 默认最大屏幕尺寸（推荐值）
     * 此值仅用于创建新会话时的预填充，不是运行时默认值
     */
    const val DEFAULT_MAX_SIZE = 1080
}

// SessionData.kt - 存储层使用字符串（便于序列化）
data class SessionData(
    val maxSize: String = "",  // 空字符串表示不限制
    // ...
)

// 转换逻辑统一在扩展函数中
fun String.parseMaxSize(): Int? {
    return when {
        this.isEmpty() -> null  // 空字符串表示不限制
        this == "0" -> null     // 0 也表示不限制
        else -> this.toIntOrNull()?.takeIf { it > 0 }
    }
}
```

### 2. Constants.kt 和 Models.kt 职责混淆

**当前问题：**
- Models.kt 中的 DeviceConfig 使用了 Constants 中的默认值
- 这是正确的！但需要明确职责边界

**职责划分：**

#### Constants.kt - 常量定义
- ✅ 配置参数的默认值（如端口、分辨率、超时时间）
- ✅ UI 相关常量（颜色、尺寸、文本）
- ✅ 系统级常量（日志标签、路径）
- ❌ 不应包含业务逻辑
- ❌ 不应包含数据结构定义

#### Models.kt - 数据模型定义
- ✅ 数据类（Data Class）定义
- ✅ 枚举类型（Enum）定义
- ✅ 可以使用 Constants 中的默认值
- ✅ 可以包含简单的数据转换方法
- ❌ 不应包含复杂的业务逻辑

**正确示例：**
```kotlin
// Constants.kt
object NetworkConstants {
    const val DEFAULT_ADB_PORT = 5555
}

// Models.kt
data class DeviceConfig(
    val host: String,
    val port: Int = NetworkConstants.DEFAULT_ADB_PORT,  // ✅ 正确使用
    val customName: String? = null
)
```

### 3. Models.kt 文件路径问题

**当前路径：**
```
core/data/model/Models.kt
```

**问题分析：**
- ✅ 符合 Clean Architecture 的分层
- ✅ 在 `core` 层，表示核心业务模型
- ⚠️ 但所有模型都在一个文件中，随着项目增长会变得臃肿

**优化方案：**

#### 方案 A：按领域拆分（推荐）
```
core/
├── domain/
│   └── model/
│       ├── Session.kt          # 会话相关模型
│       ├── Device.kt           # 设备相关模型
│       ├── Connection.kt       # 连接相关模型
│       ├── Settings.kt         # 设置相关模型
│       └── Common.kt           # 通用模型（枚举等）
```

#### 方案 B：保持单文件，但分组（当前可接受）
```
core/data/model/Models.kt  # 保持现状，但内部按注释分组
```

## 整体架构优化方案

### 当前架构分析

```
com.mobile.scrcpy.android/
├── app/                    # ✅ 应用入口层
├── common/                 # ✅ 通用工具和常量
│   ├── Constants.kt
│   └── LogManager.kt
├── core/                   # ✅ 核心业务层
│   ├── adb/               # ADB 连接管理
│   ├── data/              # 数据层
│   │   ├── model/         # 数据模型
│   │   ├── preferences/   # 偏好设置
│   │   └── repository/    # 数据仓库
│   └── media/             # 媒体解码
├── feature/               # ✅ 功能模块层
│   ├── device/
│   ├── scrcpy/
│   └── session/
└── ui/                    # ✅ UI 层
    ├── components/
    ├── screens/
    └── theme/
```

**评价：整体架构清晰，符合 Clean Architecture 原则**

### 优化建议

#### 1. 调整 core 层结构（推荐）

```
core/
├── domain/                 # 领域层（新增）
│   ├── model/             # 领域模型（从 data/model 移动）
│   │   ├── Session.kt
│   │   ├── Device.kt
│   │   ├── Connection.kt
│   │   └── Settings.kt
│   ├── usecase/           # 用例层（可选，复杂业务逻辑）
│   └── repository/        # 仓库接口定义
├── data/                  # 数据层
│   ├── local/             # 本地数据源
│   │   └── preferences/
│   ├── repository/        # 仓库实现
│   └── mapper/            # 数据映射（可选）
├── adb/                   # ADB 基础设施
└── media/                 # 媒体基础设施
```

**理由：**
- 更符合 Clean Architecture 的依赖规则
- domain 层不依赖任何外部框架
- data 层实现 domain 层定义的接口

#### 2. 移动 SessionRepository（建议）

**当前位置：**
```
feature/session/SessionRepository.kt
```

**建议移动到：**
```
core/data/repository/SessionRepository.kt
```

**理由：**
- Repository 是数据层的一部分，不应该在 feature 层
- feature 层应该只包含 UI 相关的 ViewModel 和 Screen

#### 3. 创建 domain 层（可选，适合大型项目）

```
core/domain/
├── model/                 # 领域模型
├── usecase/              # 用例
│   ├── ConnectDeviceUseCase.kt
│   ├── StartScrcpyUseCase.kt
│   └── ManageSessionUseCase.kt
└── repository/           # 仓库接口
    ├── ISessionRepository.kt
    └── IDeviceRepository.kt
```

**理由：**
- 将复杂的业务逻辑从 ViewModel 中抽离
- 提高代码的可测试性和可重用性

### 最终推荐架构

```
com.mobile.scrcpy.android/
├── app/                           # 应用入口
│   ├── MainActivity.kt
│   └── ScreenRemoteApp.kt
│
├── common/                        # 通用层
│   ├── Constants.kt              # ✅ 所有常量定义
│   ├── LogManager.kt
│   └── utils/                    # 工具类
│
├── core/                         # 核心层
│   ├── domain/                   # 领域层（新增）
│   │   ├── model/               # ✅ 领域模型（从 data/model 移动）
│   │   │   ├── Session.kt
│   │   │   ├── Device.kt
│   │   │   ├── Connection.kt
│   │   │   └── Settings.kt
│   │   └── repository/          # 仓库接口
│   │
│   ├── data/                    # 数据层
│   │   ├── local/
│   │   │   └── preferences/
│   │   └── repository/          # ✅ 仓库实现（从 feature 移动）
│   │       ├── SessionRepositoryImpl.kt
│   │       └── DeviceRepositoryImpl.kt
│   │
│   ├── adb/                     # ADB 基础设施
│   │   ├── AdbBridge.kt
│   │   ├── AdbConnectionManager.kt
│   │   └── SocketForwarder.kt
│   │
│   └── media/                   # 媒体基础设施
│       ├── AudioDecoder.kt
│       └── VideoDecoder.kt
│
├── feature/                     # 功能模块层
│   ├── device/
│   │   └── DeviceViewModel.kt
│   ├── scrcpy/
│   │   ├── ScrcpyClient.kt
│   │   ├── ScrcpyService.kt
│   │   └── TouchHandler.kt
│   └── session/
│       └── SessionViewModel.kt  # 重命名 MainViewModel
│
└── ui/                          # UI 层
    ├── components/
    ├── screens/
    └── theme/
```

## 迁移计划

### 阶段 1：修复 maxSize 混乱（高优先级）
1. ✅ 统一 maxSize 的语义
2. ✅ 更新 Constants.kt 中的默认值为 1080
3. ✅ 添加转换扩展函数
4. ✅ 更新所有使用 maxSize 的地方

### 阶段 2：拆分 Models.kt（中优先级）
1. 按领域拆分为多个文件
2. 更新所有 import 语句
3. 验证编译通过

### 阶段 3：调整目录结构（低优先级）
1. 创建 core/domain 目录
2. 移动 model 文件
3. 移动 repository 文件
4. 更新所有 import 语句
5. 全面测试

## 实施建议

### 立即执行（本次重构）
1. ✅ 修复 maxSize 混乱问题
2. ✅ 明确 Constants.kt 和 Models.kt 的职责
3. ✅ 在文档中说明架构规范

### 短期计划（1-2周）
1. 拆分 Models.kt 为多个文件
2. 移动 SessionRepository 到 core/data/repository

### 长期计划（按需）
1. 引入 domain 层和 usecase
2. 完善依赖注入（Hilt/Koin）
3. 添加单元测试和集成测试

## 总结

**当前架构评分：7/10**
- ✅ 基本符合 Clean Architecture
- ✅ 分层清晰
- ⚠️ 部分文件位置不够合理
- ⚠️ Models.kt 过于臃肿
- ⚠️ 缺少 domain 层

**优化后预期：9/10**
- ✅ 完全符合 Clean Architecture
- ✅ 职责划分清晰
- ✅ 易于维护和扩展
- ✅ 便于测试
