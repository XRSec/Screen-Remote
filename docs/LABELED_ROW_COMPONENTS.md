# 通用标题+内容行组件

## 概述
提供一套统一的标题+内容布局组件，支持自适应宽度，适用于输入框、开关、选择器等多种场景。

## 核心组件

### LabeledRow（基础组件）
通用的标题+内容行布局，支持任意内容。

```kotlin
LabeledRow(
    label = "标题",
    helpText = "可选的帮助文本"
) {
    // 任意内容
    Text("自定义内容")
}
```

### LabeledInputRow（输入框）
标题+输入框组合，输入框自适应宽度。

```kotlin
LabeledInputRow(
    label = SessionTexts.GROUP_NAME.get(),
    value = name,
    onValueChange = { name = it },
    placeholder = "输入分组名称",
    helpText = "可选的帮助文本"
)
```

### LabeledSwitchRow（开关）
标题+iOS风格开关组合。

```kotlin
LabeledSwitchRow(
    label = "启用功能",
    checked = isEnabled,
    onCheckedChange = { isEnabled = it },
    helpText = "可选的帮助文本"
)
```

### LabeledClickableRow（可点击）
标题+可点击文本组合，常用于选择器。

```kotlin
LabeledClickableRow(
    label = SessionTexts.GROUP_PARENT_PATH.get(),
    trailingText = if (parentPath == "/") "首页" else parentPath,
    onClick = { showSelector = true },
    showArrow = true,
    helpText = "可选的帮助文本"
)
```

## 设计特点

### 自适应布局
- 标题区域：`wrapContentWidth`，根据文字长度自动调整
- 内容区域：`weight(1f, fill = false)`，占用剩余空间但不强制填充
- 间距：标题和内容之间固定 10dp 间距

### 统一高度
- 所有行组件统一使用 `AppDimens.listItemHeight`（38dp）
- 保持与其他列表项（CompactClickableRow、CompactSwitchRow）一致

### 帮助图标
- 所有组件都支持可选的 `helpText` 参数
- 显示为标题旁的 `?` 图标，点击显示帮助信息

## 使用场景

### 1. 表单输入
```kotlin
Column {
    LabeledInputRow(
        label = "名称",
        value = name,
        onValueChange = { name = it },
        placeholder = "输入名称"
    )
    
    LabeledInputRow(
        label = "端口",
        value = port,
        onValueChange = { port = it },
        placeholder = "5555",
        keyboardType = KeyboardType.Number
    )
}
```

### 2. 设置页面
```kotlin
Column {
    LabeledSwitchRow(
        label = "自动连接",
        checked = autoConnect,
        onCheckedChange = { autoConnect = it }
    )
    
    LabeledClickableRow(
        label = "语言",
        trailingText = "简体中文",
        onClick = { showLanguageSelector = true }
    )
}
```

### 3. 混合布局
```kotlin
Column {
    LabeledInputRow(
        label = "分组名称",
        value = name,
        onValueChange = { name = it },
        placeholder = "输入分组名称"
    )
    
    LabeledClickableRow(
        label = "父路径",
        trailingText = parentPath,
        onClick = { showPathSelector = true }
    )
    
    LabeledSwitchRow(
        label = "启用",
        checked = enabled,
        onCheckedChange = { enabled = it }
    )
}
```

## 与现有组件对比

### 旧方式（不推荐）
```kotlin
// 需要手动管理布局
Row(
    modifier = Modifier
        .fillMaxWidth()
        .height(AppDimens.listItemHeight)
        .padding(horizontal = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween
) {
    Text("标题")
    BasicTextField(...)
}
```

### 新方式（推荐）
```kotlin
// 使用通用组件，简洁明了
LabeledInputRow(
    label = "标题",
    value = value,
    onValueChange = { value = it },
    placeholder = "提示"
)
```

## 技术实现

### 核心文件
- `feature/session/ui/component/SessionDialogComponents.kt` - 组件实现

### 布局原理
```kotlin
Row(
    modifier = modifier
        .fillMaxWidth()
        .height(AppDimens.listItemHeight)
        .padding(horizontal = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween
) {
    // 标题区域：自适应宽度
    Row(
        modifier = Modifier.wrapContentWidth(),
        ...
    ) {
        Text(label)
        HelpIcon(helpText)
    }
    
    // 内容区域：占用剩余空间但不强制填充
    Box(
        modifier = Modifier
            .weight(1f, fill = false)
            .padding(start = 10.dp),
        contentAlignment = Alignment.CenterEnd
    ) {
        content()
    }
}
```

## 已更新的组件

### AddGroupDialog
位置：`core/designsystem/component/AddGroupDialog.kt`
- 分组名称输入：使用 `LabeledInputRow`
- 父路径选择：使用 `LabeledClickableRow`

## 扩展建议

可以基于 `LabeledRow` 创建更多变体：

```kotlin
// 标题+下拉菜单
@Composable
fun LabeledDropdownRow(
    label: String,
    selectedText: String,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    helpText: String? = null,
    content: @Composable () -> Unit
) {
    LabeledRow(label = label, helpText = helpText) {
        Box {
            Row(
                modifier = Modifier.clickable { onExpandedChange(true) },
                ...
            ) {
                Text(selectedText)
                Icon(Icons.Default.ArrowDropDown)
            }
            IOSStyledDropdownMenu(
                expanded = expanded,
                onDismissRequest = { onExpandedChange(false) }
            ) {
                content()
            }
        }
    }
}

// 标题+滑块
@Composable
fun LabeledSliderRow(
    label: String,
    value: Float,
    onValueChange: (Float) -> Unit,
    valueRange: ClosedFloatingPointRange<Float>,
    helpText: String? = null
) {
    LabeledRow(label = label, helpText = helpText) {
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = valueRange
        )
    }
}
```

## 最佳实践

1. **优先使用专用组件**：输入框用 `LabeledInputRow`，开关用 `LabeledSwitchRow`
2. **自定义场景用基础组件**：需要特殊内容时使用 `LabeledRow`
3. **保持一致性**：同一页面使用相同的组件系列
4. **合理使用帮助文本**：复杂功能添加 `helpText` 提升用户体验
