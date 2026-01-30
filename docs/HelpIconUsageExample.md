# HelpIcon 使用指南

## 概述
`HelpIcon` 是一个通用的帮助提示组件，可以在任何需要说明的地方使用。点击问号图标会弹出帮助对话框显示详细说明。

## 组件位置
- **组件文件**: `core/designsystem/component/HelpComponents.kt`
- **文本定义**: `core/i18n/CommonTexts.kt` 和 `core/i18n/SessionTexts.kt`

## 基本使用

### 1. 独立使用 HelpIcon

```kotlin
import com.mobile.scrcpy.android.core.designsystem.component.HelpIcon
import com.mobile.scrcpy.android.core.i18n.SessionTexts

Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(6.dp)
) {
    Text("设置项名称")
    HelpIcon(helpText = SessionTexts.HELP_SESSION_NAME.get())
}
```

### 2. 在 LabeledTextField 中使用

```kotlin
LabeledTextField(
    label = SessionTexts.LABEL_SESSION_NAME.get(),
    value = state.sessionName,
    onValueChange = { state.sessionName = it },
    placeholder = SessionTexts.PLACEHOLDER_SESSION_NAME.get(),
    helpText = SessionTexts.HELP_SESSION_NAME.get()  // 添加帮助文本
)
```

### 3. 在 CompactSwitchRow 中使用

```kotlin
CompactSwitchRow(
    text = SessionTexts.SWITCH_ENABLE_AUDIO.get(),
    checked = state.enableAudio,
    onCheckedChange = { state.enableAudio = it },
    helpText = SessionTexts.HELP_ENABLE_AUDIO.get()  // 添加帮助文本
)
```

### 4. 在 CompactClickableRow 中使用

```kotlin
CompactClickableRow(
    text = SessionTexts.GROUP_SELECT.get(),
    trailingText = "未分组",
    onClick = { /* ... */ },
    helpText = SessionTexts.HELP_SELECT_GROUP.get()  // 添加帮助文本
)
```

## 添加新的帮助文本

### 步骤 1: 在对应的 XxxTexts.kt 中添加双语文本

```kotlin
// 在 SessionTexts.kt 或其他 XxxTexts.kt 中
val HELP_YOUR_FEATURE = TextPair(
    "这是中文说明，详细解释这个功能的作用和使用方法。",
    "This is English description, explaining what this feature does and how to use it."
)
```

### 步骤 2: 在组件中使用

```kotlin
// 方式 1: 直接使用 HelpIcon
Row {
    Text("功能名称")
    HelpIcon(helpText = SessionTexts.HELP_YOUR_FEATURE.get())
}

// 方式 2: 使用支持 helpText 参数的组件
LabeledTextField(
    label = "功能名称",
    value = value,
    onValueChange = { },
    placeholder = "提示",
    helpText = SessionTexts.HELP_YOUR_FEATURE.get()
)
```

## 设计规范

### 图标样式
- 大小: 20dp 外框，16dp 图标
- 颜色: iOS 蓝色 (#007AFF)
- 背景: 半透明 surfaceVariant
- 形状: 圆形

### 对话框样式
- 标题: "说明" / "Help"
- 内容: 帮助文本
- 按钮: "关闭" / "Close"
- 圆角: 16dp

### 布局规范
- 图标与文本间距: 6dp
- 图标垂直居中对齐
- 图标放在标签文本右侧

## 已支持的组件

以下组件已内置 `helpText` 参数支持：

1. **LabeledTextField** - 带标签的文本输入框
2. **CompactSwitchRow** - 紧凑型开关行
3. **CompactClickableRow** - 紧凑型可点击行

## 注意事项

1. **文本定义位置**: 帮助文本必须定义在 `core/i18n/XxxTexts.kt` 中，不能硬编码
2. **Dialog 中使用 .get()**: 因为帮助对话框是 Dialog，必须使用 `.get()` 获取文本，避免闪烁
3. **可选参数**: `helpText` 是可选参数，默认为 `null`，不传则不显示帮助图标
4. **文本长度**: 帮助文本可以较长，对话框会自动换行显示

## 扩展到其他组件

如果需要在其他自定义组件中添加帮助图标支持：

```kotlin
@Composable
fun YourCustomComponent(
    text: String,
    // ... 其他参数
    helpText: String? = null  // 添加可选的 helpText 参数
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(text)
        if (helpText != null) {
            HelpIcon(helpText = helpText)
        }
        // ... 其他内容
    }
}
```

## 示例：完整的会话编辑表单

参考 `SessionDialogSections.kt` 查看完整的实现示例，其中包含了所有字段的帮助提示。
