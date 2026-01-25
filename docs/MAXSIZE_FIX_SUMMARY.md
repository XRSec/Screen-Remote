# maxSize 参数统一方案

## 问题描述

之前 maxSize 参数在项目中有三种不同的表示方式，导致语义混乱：
- `""` (空字符串) - 在 SessionData 中
- `null` - 在 ScrcpyClient 中
- `1920` - 在 ScrcpyOptions 中

## 解决方案

### 1. 统一语义规则

```kotlin
// 正确的规则定义
空字符串 ""     -> null（不限制分辨率，用户未设置）
"0"            -> null（不限制分辨率，用户明确选择不限制）
有效数字字符串  -> 使用该数字（用户明确设置的值）
无效输入       -> null（不限制分辨率）

// DEFAULT_MAX_SIZE = 1080 仅用于创建新会话时的预填充值
```

### 2. Constants.kt 更新

```kotlin
object ScrcpyConstants {
    /** 
     * 默认最大屏幕尺寸（推荐值：1080）
     * 此值仅用于创建新会话时的预填充，不是运行时默认值
     */
    const val DEFAULT_MAX_SIZE = 1080
    
    /** 默认最大屏幕尺寸（字符串，用于 UI 预填充） */
    const val DEFAULT_MAX_SIZE_STR = "1080"
}

object PlaceholderTexts {
    const val MAX_SIZE = "1080 (留空表示不限制)"
}
```

### 3. Models.kt 添加扩展函数

```kotlin
/**
 * 解析 maxSize 字符串为整数
 * 
 * 规则：
 * - 空字符串 "" -> null（不限制分辨率）
 * - "0" -> null（不限制分辨率）
 * - 有效数字 -> 返回该数字
 * - 无效输入 -> null（不限制分辨率）
 * 
 * @return Int? - null 表示不限制，否则返回具体数值
 */
fun String.parseMaxSize(): Int? {
    return when {
        this.isEmpty() -> null  // 空字符串表示不限制
        this == "0" -> null     // 0 表示不限制
        else -> this.toIntOrNull()?.takeIf { it > 0 }
    }
}

/**
 * 将 maxSize 整数转换为字符串（用于存储）
 * 
 * @return String - null 转为空字符串 ""，其他转为字符串
 */
fun Int?.toMaxSizeString(): String {
    return this?.toString() ?: ""
}
```

### 4. 使用示例

#### 在 ViewModel 中使用

```kotlin
// 正确的逻辑
val maxSize = sessionData.maxSize.parseMaxSize()  
// 空字符串 "" -> null（不限制）
// "1080" -> 1080（用户设置的值）
```

#### 创建新会话时的预填充

```kotlin
// 在创建新会话对话框中
TextField(
    value = maxSizeInput,
    placeholder = { Text(PlaceholderTexts.MAX_SIZE) },  // "1080 (留空表示不限制)"
    // 初始值可以预填充为 ScrcpyConstants.DEFAULT_MAX_SIZE_STR
)
```

#### 在 ScrcpyClient 中使用

```kotlin
private fun buildScrcpyCommand(
    maxSize: Int?,  // null 表示不限制
    // ...
) {
    // 只有当 maxSize 不为 null 时才添加 max_size 参数
    if (maxSize != null && maxSize > 0) {
        params.add("max_size=$maxSize")
    }
    // maxSize 为 null 时，scrcpy-server 不会限制分辨率
}
```

## 为什么选择 1080 作为预填充值？

1. **移动设备性能**：1080p 对移动设备的 CPU/GPU 负担更小
2. **网络带宽**：1080p 需要的带宽更少，在 WiFi 环境下更流畅
3. **电池续航**：更低的分辨率意味着更少的功耗
4. **实际体验**：在手机屏幕上，1080p 和 1920p 的视觉差异不大
5. **用户可配置**：用户可以在创建会话时修改为其他值，或留空表示不限制

## 数据流转

```
创建新会话
    ↓
UI 预填充 "1080" (ScrcpyConstants.DEFAULT_MAX_SIZE_STR)
    ↓
用户可以修改或清空
    ↓
SessionData.maxSize (String)  // 存储用户输入，空字符串表示不限制
    ↓
parseMaxSize()  // 转换层
    ↓
Int? (null 或具体数值)  // 业务层，null 表示不限制
    ↓
ScrcpyClient.connect(maxSize: Int?)  // 传输层
    ↓
buildScrcpyCommand()  // 命令构建
    ↓
scrcpy-server  // 如果 maxSize 为 null，不添加 max_size 参数
```

## 用户界面提示

在会话编辑对话框中，maxSize 输入框：
- **占位符文本**: `"1080 (留空表示不限制)"`
- **创建新会话时**: 预填充 `"1080"`
- **编辑现有会话时**: 显示已保存的值，如果为空则显示占位符

这样用户就清楚地知道：
- 预填充的 1080 是推荐值
- 留空 = 不限制分辨率
- 输入其他数字 = 使用该分辨率

## 测试场景

| 用户输入 | SessionData.maxSize | parseMaxSize() 结果 | scrcpy-server 行为 |
|---------|-------------------|-------------------|------------------|
| (留空)   | ""                | null              | 不添加 max_size（不限制） |
| 0       | "0"               | null              | 不添加 max_size（不限制） |
| 720     | "720"             | 720               | max_size=720     |
| 1080    | "1080"            | 1080              | max_size=1080    |
| 1920    | "1920"            | 1920              | max_size=1920    |
| abc     | "abc"             | null              | 不添加 max_size（不限制） |
| -100    | "-100"            | null              | 不添加 max_size（不限制） |

**注意**：创建新会话时，输入框会预填充 "1080"，但用户可以清空它。

## 相关文件

- `common/Constants.kt` - 常量定义
- `core/data/model/Models.kt` - 扩展函数
- `feature/session/MainViewModel.kt` - 使用扩展函数
- `feature/scrcpy/ScrcpyClient.kt` - 处理 null 值
- `feature/scrcpy/ScrcpyOptions.kt` - 默认值

## 后续优化

1. 在 UI 层添加输入验证，只允许输入数字
2. 添加常用分辨率的快捷选择（720p, 1080p, 1440p, 1920p, 不限制）
3. 根据设备性能自动推荐合适的分辨率
4. 在创建新会话时，确保 maxSize 输入框预填充 "1080"
