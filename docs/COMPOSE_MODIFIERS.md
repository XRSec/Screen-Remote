# Jetpack Compose 布局修饰符说明

## 官方文档资源

**Android 官方文档**：
- [Compose Modifiers 概述](https://developer.android.com/develop/ui/compose/modifiers) - 修饰符基础概念和最佳实践
- [Compose Modifiers 完整列表](https://developer.android.com/jetpack/compose/modifiers-list) - 所有可用修饰符的详细参数和作用域

**重要概念**：
- 修饰符是标准的 Kotlin 对象，通过链式调用组合使用
- 修饰符的顺序非常重要，会影响最终的渲染结果
- 某些修饰符只能在特定作用域（Scope）中使用，如 weight 只能在 Row/Column 中使用

---

## 尺寸修饰符

### wrapContentHeight()
**作用**：让组件高度自适应内容，不会撑满父容器。

**使用场景**：
- Dialog 内容区域（避免空白过多）
- 列表项（根据文本行数自动调整）
- 卡片内容（内容多少决定高度）

**参数说明**：
- `align: Alignment.Vertical` - 当内容高度小于父容器时的对齐方式（Top/CenterVertically/Bottom）
- `unbounded: Boolean` - 是否忽略父容器的最大高度约束，默认 false

**常用对齐方式**：
- `Alignment.Top` - 顶部对齐
- `Alignment.CenterVertically` - 垂直居中（常用）
- `Alignment.Bottom` - 底部对齐

**注意事项**：
- Dialog 必须使用此修饰符，不要用 fillMaxHeight
- 适合内容动态变化的场景
- unbounded = true 时，内容可以超出父容器的最大高度限制
- 在 Column 中使用时，高度会根据子元素自动计算

---

### wrapContentWidth()
**作用**：让组件宽度自适应内容，不会撑满父容器。

**使用场景**：
- 按钮（根据文字长度调整）
- 标签/徽章（内容决定宽度）
- 弹出菜单（根据选项文字调整）

**参数说明**：
- `align: Alignment.Horizontal` - 当内容宽度小于父容器时的对齐方式（Start/CenterHorizontally/End）
- `unbounded: Boolean` - 是否忽略父容器的最大宽度约束，默认 false

**注意事项**：
- 内容过长时可能超出屏幕，需配合 widthIn 限制
- unbounded = true 时，内容可以超出父容器的最大宽度限制

---

### wrapContentSize()
**作用**：让组件的宽度和高度都自适应内容，不会撑满父容器。相当于同时应用 wrapContentWidth 和 wrapContentHeight。

**使用场景**：
- 浮动提示框（Tooltip）
- 弹出菜单（内容决定尺寸）
- 徽章/标签（宽高都由内容决定）
- 需要居中显示且尺寸自适应的内容

**参数说明**：
- `align: Alignment` - 当内容尺寸小于父容器时的对齐方式（如 Alignment.Center、Alignment.TopStart 等）
- `unbounded: Boolean` - 是否忽略父容器的最大尺寸约束，默认 false

**常用对齐方式**：
- `Alignment.Center` - 居中对齐（最常用）
- `Alignment.TopStart` - 左上角对齐
- `Alignment.TopCenter` - 顶部居中
- `Alignment.TopEnd` - 右上角对齐
- `Alignment.CenterStart` - 左侧居中
- `Alignment.CenterEnd` - 右侧居中
- `Alignment.BottomStart` - 左下角对齐
- `Alignment.BottomCenter` - 底部居中
- `Alignment.BottomEnd` - 右下角对齐

**与其他修饰符的区别**：
- `wrapContentSize()` = `wrapContentWidth()` + `wrapContentHeight()`
- 适合需要同时控制宽高自适应的场景
- 提供了统一的对齐控制

**注意事项**：
- unbounded = true 时，内容可以超出父容器的最大尺寸限制
- 在 Box 中使用时，可以配合 align 参数实现灵活的内容定位
- 如果只需要控制单一方向，优先使用 wrapContentWidth 或 wrapContentHeight

---

### fillMaxSize()
**作用**：让组件同时填满父容器的宽度和高度。

**使用场景**：
- 全屏页面根容器
- 占满整个屏幕的背景
- 需要铺满父容器的内容区

**参数说明**：
- `fraction: Float` - 填充比例，范围 0.0 到 1.0，默认 1.0（完全填满）
  - `fillMaxSize(0.5f)` - 填充父容器的 50% 宽度和高度
  - `fillMaxSize(1.0f)` - 填充父容器的 100% 宽度和高度（默认）

**工作原理**：
- 将组件的最小宽度和最大宽度都设置为父容器最大宽度 × fraction
- 将组件的最小高度和最大高度都设置为父容器最大高度 × fraction
- 相当于同时应用 `fillMaxWidth(fraction)` 和 `fillMaxHeight(fraction)`

**注意事项**：
- Dialog 顶部容器不要使用，会导致布局异常
- 嵌套使用时注意父容器是否有明确尺寸
- 如果父容器使用 wrapContent，fillMaxSize 可能不会生效

---

### fillMaxWidth()
**作用**：让组件宽度填满父容器，高度保持原样。

**使用场景**：
- 输入框（横向占满）
- 列表项（宽度统一）
- 分割线（横向贯穿）
- 按钮（需要占满宽度时）

**参数说明**：
- `fraction: Float` - 填充比例，范围 0.0 到 1.0，默认 1.0（完全填满）
  - `fillMaxWidth(0.5f)` - 填充父容器的 50% 宽度
  - `fillMaxWidth(0.8f)` - 填充父容器的 80% 宽度
  - `fillMaxWidth(1.0f)` - 填充父容器的 100% 宽度（默认）

**工作原理**：
- 将组件的最小宽度和最大宽度都设置为父容器最大宽度 × fraction
- 高度不受影响，由内容或其他修饰符决定

**注意事项**：
- 最常用的修饰符之一
- 可配合 padding 控制实际显示宽度
- 在 Row 中使用时，会占据所有可用宽度
- 如果父容器使用 wrapContentWidth，fillMaxWidth 可能不会生效

---

### fillMaxHeight()
**作用**：让组件高度填满父容器，宽度保持原样。

**使用场景**：
- 侧边栏（纵向占满）
- 分割线（竖向贯穿）
- 需要占满父容器高度的垂直布局

**参数说明**：
- `fraction: Float` - 填充比例，范围 0.0 到 1.0，默认 1.0（完全填满）
  - `fillMaxHeight(0.5f)` - 填充父容器的 50% 高度
  - `fillMaxHeight(0.8f)` - 填充父容器的 80% 高度
  - `fillMaxHeight(1.0f)` - 填充父容器的 100% 高度（默认）

**工作原理**：
- 将组件的最小高度和最大高度都设置为父容器最大高度 × fraction
- 宽度不受影响，由内容或其他修饰符决定

**注意事项**：
- Dialog 禁止使用，会导致空白过多
- 使用前确保父容器有明确高度
- 在 Column 中使用时，会占据所有可用高度
- 如果父容器使用 wrapContentHeight，fillMaxHeight 可能不会生效
- 在 Row 中使用时，需要 Row 有明确的高度约束

---

### widthIn(min, max)
**作用**：限制组件宽度在指定范围内。

**使用场景**：
- Dialog 宽度限制（如 widthIn(min = 280.dp, max = 400.dp)）
- 响应式布局（适配不同屏幕）
- 防止内容过窄或过宽

**参数说明**：
- `min: Dp` - 最小宽度，默认 Dp.Unspecified（不限制）
- `max: Dp` - 最大宽度，默认 Dp.Unspecified（不限制）

**工作原理**：
- 设置组件的最小宽度约束（如果指定了 min）
- 设置组件的最大宽度约束（如果指定了 max）
- 实际宽度会在 min 和 max 之间，由内容和其他约束共同决定

**常用组合**：
- `widthIn(max = 400.dp).fillMaxWidth()` - 最大 400dp，小屏幕时占满
- `widthIn(min = 200.dp)` - 至少 200dp 宽
- `widthIn(min = 280.dp, max = 600.dp)` - 宽度在 280dp 到 600dp 之间

**注意事项**：
- 可以只指定 min 或只指定 max
- 如果 min > max，会使用 min 作为固定宽度
- 配合 fillMaxWidth 使用时，会在约束范围内填满

---

### heightIn(min, max)
**作用**：限制组件高度在指定范围内。

**使用场景**：
- 输入框最小高度（如 heightIn(min = 48.dp)）
- 列表项统一高度（如 heightIn(min = 38.dp)）
- 滚动区域最大高度限制

**参数说明**：
- `min: Dp` - 最小高度，默认 Dp.Unspecified（不限制）
- `max: Dp` - 最大高度，默认 Dp.Unspecified（不限制）

**工作原理**：
- 设置组件的最小高度约束（如果指定了 min）
- 设置组件的最大高度约束（如果指定了 max）
- 实际高度会在 min 和 max 之间，由内容和其他约束共同决定

**常用组合**：
- `heightIn(min = 38.dp).wrapContentHeight()` - 至少 38dp，内容多时自动增高
- `heightIn(max = 200.dp)` - 最高 200dp，超出时需要滚动
- `heightIn(min = 48.dp, max = 300.dp)` - 高度在 48dp 到 300dp 之间

**注意事项**：
- 可以只指定 min 或只指定 max
- 如果 min > max，会使用 min 作为固定高度
- 配合 wrapContentHeight 使用时，会在约束范围内自适应
- 常用于确保触摸目标的最小尺寸（Material Design 推荐 48dp）

---

### size(width, height)
**作用**：同时指定组件的固定宽度和高度。

**使用场景**：
- 图标（如 size(24.dp)）
- 头像（如 size(48.dp)）
- 正方形按钮
- 固定尺寸的占位符

**参数说明**：
- 单参数形式：`size(value: Dp)` - 宽高都是 value
- 双参数形式：`size(width: Dp, height: Dp)` - 分别指定宽高
- DpSize 形式：`size(size: DpSize)` - 使用 DpSize 对象

**工作原理**：
- 将组件的最小宽度、最大宽度、最小高度、最大高度都设置为指定值
- 强制组件使用固定尺寸，不受内容影响

**简写形式**：
- `size(24.dp)` - 宽高都是 24dp（正方形）
- `size(width = 100.dp, height = 50.dp)` - 宽 100dp，高 50dp（矩形）
- `size(DpSize(100.dp, 50.dp))` - 使用 DpSize 对象

**与其他修饰符的关系**：
- `size(w, h)` = `width(w).height(h)`
- 如果需要响应式尺寸，使用 fillMax 或 wrapContent 系列
- 如果需要尺寸范围，使用 sizeIn、widthIn、heightIn

**注意事项**：
- 固定尺寸不会响应内容变化
- 内容超出时会被裁剪（除非使用 clip 修饰符）
- 优先考虑 wrapContent 或 fillMax，除非确实需要固定尺寸

---

### width(value) / height(value)
**作用**：指定组件的固定宽度或高度。

**使用场景**：
- 固定宽度的侧边栏（如 width(200.dp)）
- 固定高度的标题栏（如 height(56.dp)）
- 需要精确控制单一维度尺寸的场景

**参数说明**：
- `width(width: Dp)` - 设置固定宽度
- `height(height: Dp)` - 设置固定高度

**工作原理**：
- `width(w)` 将组件的最小宽度和最大宽度都设置为 w
- `height(h)` 将组件的最小高度和最大高度都设置为 h
- 另一个维度不受影响，由内容或其他修饰符决定

**与 size 的区别**：
- `width(100.dp)` - 只固定宽度，高度自适应
- `height(50.dp)` - 只固定高度，宽度自适应
- `size(100.dp, 50.dp)` - 同时固定宽高

**注意事项**：
- 固定尺寸不会响应内容变化
- 优先考虑 wrapContent 或 fillMax
- 如果需要尺寸范围，使用 widthIn 或 heightIn
- 可以与其他尺寸修饰符组合使用

---

### aspectRatio(ratio, matchHeightConstraintsFirst)
**作用**：按照指定的宽高比调整组件尺寸。

**使用场景**：
- 图片保持宽高比（如 16:9 视频封面）
- 正方形组件（如 aspectRatio(1f)）
- 需要固定宽高比的卡片或容器

**参数说明**：
- `ratio: Float` - 宽高比，计算方式为 width / height
  - `aspectRatio(1f)` - 正方形（1:1）
  - `aspectRatio(16f / 9f)` - 16:9 宽屏比例
  - `aspectRatio(4f / 3f)` - 4:3 传统比例
  - `aspectRatio(9f / 16f)` - 9:16 竖屏比例
- `matchHeightConstraintsFirst: Boolean` - 优先匹配高度约束还是宽度约束，默认 false（优先宽度）

**工作原理**：
- 默认（matchHeightConstraintsFirst = false）：优先尝试匹配父容器的宽度约束，然后根据比例计算高度
- matchHeightConstraintsFirst = true：优先尝试匹配父容器的高度约束，然后根据比例计算宽度
- 匹配顺序：maxWidth → maxHeight → minWidth → minHeight（或相反）

**常见宽高比**：
- `1f` - 正方形（1:1）
- `16f / 9f ≈ 1.778f` - 宽屏视频（16:9）
- `4f / 3f ≈ 1.333f` - 传统屏幕（4:3）
- `3f / 2f = 1.5f` - 照片常用比例（3:2）
- `9f / 16f ≈ 0.563f` - 竖屏视频（9:16）
- `2f / 3f ≈ 0.667f` - 竖向照片（2:3）

**与其他修饰符的配合**：
- `fillMaxWidth().aspectRatio(16f / 9f)` - 宽度占满，高度按比例
- `fillMaxHeight().aspectRatio(9f / 16f, true)` - 高度占满，宽度按比例
- `size(100.dp).aspectRatio(1f)` - 固定尺寸后再应用比例（通常不需要）

**注意事项**：
- 修饰符顺序很重要：通常先设置 fillMax，再设置 aspectRatio
- 如果父容器没有明确约束，aspectRatio 可能不会生效
- 内容可能会被裁剪，需要配合 contentScale 使用（针对 Image）

---

### defaultMinSize(minWidth, minHeight)
**作用**：设置默认最小尺寸，仅在父容器没有提供最小约束时生效。

**使用场景**：
- 确保触摸目标的最小尺寸（Material Design 推荐 48dp）
- 为没有固有尺寸的组件提供默认尺寸
- 防止组件过小而难以交互

**参数说明**：
- `minWidth: Dp` - 默认最小宽度，默认 Dp.Unspecified
- `minHeight: Dp` - 默认最小高度，默认 Dp.Unspecified

**工作原理**：
- 只有当父容器的最小约束为 0 时，才应用这些最小尺寸
- 如果父容器已经提供了最小约束，则使用父容器的约束
- 这是一个"软约束"，不会覆盖父容器的要求

**与 size/sizeIn 的区别**：
- `defaultMinSize` - 仅在无约束时生效（软约束）
- `sizeIn` - 总是生效，会与父约束合并（硬约束）
- `size` - 强制固定尺寸，忽略父约束

**常用场景**：
- `defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)` - 确保可点击区域足够大
- `defaultMinSize(minWidth = 64.dp)` - 确保按钮最小宽度

**注意事项**：
- 这是一个条件性修饰符，行为取决于父容器
- 通常用于可交互组件，确保可访问性
- Material 组件内部通常已经使用了此修饰符

---

### requiredSize / requiredWidth / requiredHeight / requiredSizeIn / requiredWidthIn / requiredHeightIn
**作用**：强制设置尺寸，忽略父容器的约束。

**使用场景**：
- 需要突破父容器限制的特殊场景
- 调试布局问题
- 创建固定尺寸的覆盖层

**与普通尺寸修饰符的区别**：
- `size(100.dp)` - 尝试设置为 100dp，但会受父容器约束限制
- `requiredSize(100.dp)` - 强制设置为 100dp，忽略父容器约束

**参数说明**：
- `requiredSize(size: Dp)` - 强制宽高都为 size
- `requiredSize(width: Dp, height: Dp)` - 强制指定宽高
- `requiredWidth(width: Dp)` - 强制宽度
- `requiredHeight(height: Dp)` - 强制高度
- `requiredSizeIn(minWidth, minHeight, maxWidth, maxHeight)` - 强制尺寸范围
- `requiredWidthIn(min, max)` - 强制宽度范围
- `requiredHeightIn(min, max)` - 强制高度范围

**注意事项**：
- 谨慎使用，可能导致内容超出父容器或被裁剪
- 通常只在特殊情况下使用
- 可能破坏响应式布局
- 优先考虑使用普通的尺寸修饰符

---

## 圆角修饰符

### clip(shape)
**作用**：裁剪组件为指定形状，常用于圆角。

**使用场景**：
- 圆角卡片（如 clip(RoundedCornerShape(12.dp))）
- 圆形头像（如 clip(CircleShape)）
- 圆角图片

**常用形状**：
- `RoundedCornerShape(12.dp)` - 四角统一圆角
- `RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)` - 仅顶部圆角
- `CircleShape` - 圆形

**注意事项**：
- 必须在 background 之前使用才能看到效果
- 会裁剪超出边界的内容

---

### border(width, color, shape)
**作用**：为组件添加边框，可配合圆角。

**使用场景**：
- 带边框的输入框
- 选中状态的卡片
- 按钮描边

**常用组合**：
```
.border(1.dp, Color.Gray, RoundedCornerShape(8.dp))
.clip(RoundedCornerShape(8.dp))
```

---

## 内边距修饰符

### padding(all)
**作用**：为组件四周添加统一的内边距。

**使用场景**：
- 卡片内容留白（如 padding(16.dp)）
- 按钮文字与边缘距离
- Dialog 内容区域

**参数说明**：
- `all: Dp` - 四周统一的内边距值

**工作原理**：
- 在组件的内容区域四周添加空白空间
- 会增加组件的实际占用空间
- 影响子组件的可用空间

**注意事项**：
- 会增加组件实际占用空间
- 影响子组件的可用空间
- padding 的位置会影响背景和边框的显示范围

---

### padding(horizontal, vertical)
**作用**：分别设置水平和垂直方向的内边距。

**使用场景**：
- 按钮（如 padding(horizontal = 16.dp, vertical = 8.dp)）
- 列表项（左右留白多，上下留白少）

**参数说明**：
- `horizontal: Dp` - 左右两侧的内边距（start + end）
- `vertical: Dp` - 上下两侧的内边距（top + bottom）

**工作原理**：
- horizontal 同时设置 start 和 end 的内边距
- vertical 同时设置 top 和 bottom 的内边距

**常用场景**：
- `padding(horizontal = 16.dp, vertical = 8.dp)` - 按钮常用内边距
- `padding(horizontal = 24.dp, vertical = 12.dp)` - 卡片内容留白

---

### padding(start, top, end, bottom)
**作用**：分别设置四个方向的内边距。

**使用场景**：
- 不对称布局（如顶部多留白）
- 精细控制间距

**参数说明**：
- `start: Dp` - 起始边（LTR 时为左，RTL 时为右）
- `top: Dp` - 顶部
- `end: Dp` - 结束边（LTR 时为右，RTL 时为左）
- `bottom: Dp` - 底部

**工作原理**：
- start/end 会根据布局方向（LTR/RTL）自动调整
- 支持国际化和从右到左的语言

**注意事项**：
- start/end 会根据语言方向自动调整（RTL 支持）
- 优先使用 start/end 而不是 left/right
- 如果需要绝对定位，使用 absolutePadding

---

### absolutePadding(left, top, right, bottom)
**作用**：设置绝对方向的内边距，不受布局方向影响。

**使用场景**：
- 需要固定左右方向的特殊场景
- 不需要 RTL 支持的情况

**参数说明**：
- `left: Dp` - 左侧（绝对位置）
- `top: Dp` - 顶部
- `right: Dp` - 右侧（绝对位置）
- `bottom: Dp` - 底部

**与 padding 的区别**：
- `padding(start, top, end, bottom)` - 支持 RTL，start/end 会自动调整
- `absolutePadding(left, top, right, bottom)` - 不支持 RTL，left/right 固定

**注意事项**：
- 不支持 RTL 布局
- 除非有特殊需求，否则优先使用 padding

---

### padding(paddingValues)
**作用**：使用 PaddingValues 对象设置内边距。

**使用场景**：
- Scaffold 的 contentPadding
- LazyColumn 的 contentPadding
- 复用相同的内边距配置

**参数说明**：
- `paddingValues: PaddingValues` - 包含四个方向内边距的对象

**工作原理**：
- PaddingValues 可以通过多种方式创建：
  - `PaddingValues(all = 16.dp)` - 四周统一
  - `PaddingValues(horizontal = 16.dp, vertical = 8.dp)` - 水平垂直
  - `PaddingValues(start = 16.dp, top = 8.dp, end = 16.dp, bottom = 8.dp)` - 分别指定

**常用场景**：
- 在 Scaffold 中传递系统栏的内边距
- 在多个组件间共享相同的内边距配置

---

### paddingFrom(alignmentLine, before, after)
**作用**：根据对齐线（如文本基线）设置内边距。

**使用场景**：
- 精确控制文本与其他元素的对齐
- 实现设计规范中基于基线的间距

**参数说明**：
- `alignmentLine: AlignmentLine` - 对齐线（如 FirstBaseline、LastBaseline）
- `before: Dp` 或 `before: TextUnit` - 对齐线之前的距离
- `after: Dp` 或 `after: TextUnit` - 对齐线之后的距离

**工作原理**：
- 根据内容的对齐线位置计算内边距
- 确保对齐线距离边界的距离符合指定值

**注意事项**：
- 主要用于文本组件
- 需要内容有明确的对齐线

---

### paddingFromBaseline(top, bottom)
**作用**：根据文本基线设置内边距，确保基线到边界的距离。

**使用场景**：
- 实现 Material Design 的文本间距规范
- 精确控制文本行之间的视觉间距

**参数说明**：
- `top: Dp` 或 `top: TextUnit` - 从布局顶部到第一行文本基线的距离
- `bottom: Dp` 或 `bottom: TextUnit` - 从最后一行文本基线到布局底部的距离

**工作原理**：
- 测量文本的第一行和最后一行基线位置
- 调整内边距使基线距离边界符合指定值

**常用场景**：
- `paddingFromBaseline(top = 24.dp)` - 确保标题基线距顶部 24dp
- `paddingFromBaseline(top = 32.dp, bottom = 16.dp)` - 同时控制上下间距

**注意事项**：
- 只对包含文本的组件有效
- 使用 TextUnit 时会根据字体大小自动调整

---

## 修饰符使用顺序

**推荐顺序**（从内到外）：
1. **尺寸** - size/width/height/fillMax/wrapContent
2. **内边距** - padding
3. **边框** - border
4. **背景** - background
5. **圆角裁剪** - clip
6. **外边距** - padding（外层）
7. **点击** - clickable

**示例顺序**：
```
Modifier
    .fillMaxWidth()           // 1. 尺寸
    .padding(16.dp)           // 2. 内边距
    .border(...)              // 3. 边框
    .background(...)          // 4. 背景
    .clip(...)                // 5. 圆角
    .clickable { }            // 6. 点击
```

---

## 项目常用组合

### Dialog 容器
```
Modifier
    .widthIn(min = 280.dp, max = 400.dp)
    .fillMaxWidth()
    .wrapContentHeight()
    .clip(RoundedCornerShape(12.dp))
    .background(Color.White)
```

### 列表项
```
Modifier
    .fillMaxWidth()
    .heightIn(min = 38.dp)
    .padding(horizontal = 16.dp, vertical = 8.dp)
    .clickable { }
```

### 输入框
```
Modifier
    .fillMaxWidth()
    .heightIn(min = 48.dp)
    .padding(horizontal = 12.dp, vertical = 8.dp)
    .background(Color.LightGray, RoundedCornerShape(8.dp))
```

### 圆角卡片
```
Modifier
    .fillMaxWidth()
    .wrapContentHeight()
    .padding(16.dp)
    .clip(RoundedCornerShape(12.dp))
    .background(Color.White)
    .border(1.dp, Color.Gray, RoundedCornerShape(12.dp))
```

---

## 常见错误

### ❌ Dialog 使用 fillMaxHeight
```
// 错误：会导致大量空白
Dialog {
    Column(Modifier.fillMaxHeight()) { }
}
```

### ✅ Dialog 使用 wrapContentHeight
```
// 正确：高度自适应内容
Dialog {
    Column(Modifier.wrapContentHeight()) { }
}
```

---

### ❌ 圆角在 background 之后
```
// 错误：看不到圆角效果
Modifier
    .background(Color.White)
    .clip(RoundedCornerShape(12.dp))
```

### ✅ 圆角在 background 之前
```
// 正确：先裁剪再填充背景
Modifier
    .clip(RoundedCornerShape(12.dp))
    .background(Color.White)
```

---

### ❌ padding 顺序错误
```
// 错误：padding 在 background 之前，背景不会覆盖 padding 区域
Modifier
    .padding(16.dp)
    .background(Color.White)
```

### ✅ padding 顺序正确
```
// 正确：先背景再 padding，内容与背景边缘有距离
Modifier
    .background(Color.White)
    .padding(16.dp)
```

---

## 响应式布局技巧

### 小屏占满，大屏限宽
```
Modifier
    .widthIn(max = 600.dp)
    .fillMaxWidth()
```

### 最小高度，内容多时自动增高
```
Modifier
    .heightIn(min = 48.dp)
    .wrapContentHeight()
```

### 固定宽高比
```
Modifier
    .fillMaxWidth()
    .aspectRatio(16f / 9f)
```
