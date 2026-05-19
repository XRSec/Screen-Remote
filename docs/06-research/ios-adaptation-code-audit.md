# iOS Adaptation Code Audit

相关文档：

- [Android AI 重构规范](/Users/xr/IDEA.localized/scrcpy-mobile/docs/07-steering/ai-refactor.md)
- [架构原则](/Users/xr/IDEA.localized/scrcpy-mobile/docs/02-architecture/principles.md)

## 目的

这份文档不是讨论单个页面，而是回答一个更工程化的问题：

- 现在项目里“适配 iOS 风格”的代码分散到了什么程度
- 哪些是必须保留的 Android 约束
- 哪些才是真正导致维护成本高的问题
- 应该优先从哪里收口

这篇文档只负责 iOS 风格适配和样式维护成本审计。

如果结论涉及代码结构调整，应服从主规范：

- 不为了样式统一继续机械细拆
- 不默认新增包装层
- 优先在现有边界内收口 token 和骨架

## 结论

当前项目已经有一层 iOS 风格设计系统，但还没有真正“闭环”。

现状更像：

1. 已经有公共 token
2. 但大量页面和组件仍然直接写死 `dp`、圆角、padding、背景
3. 结果是“看起来像统一”，实际上维护点还是很多

也就是说，问题不在于“完全没抽象”，而在于：

- 抽象层存在
- 但没有成为唯一事实来源

## 代码证据

### 1. 已经存在的公共入口

项目不是完全没有基础层，至少已经有这些：

- 尺寸常量：[AppDimens.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/common/constants/AppDimens.kt)
- 颜色常量：[AppColors.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/common/constants/AppColors.kt)
- 文字大小常量：[AppTextSizes.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/common/constants/AppTextSizes.kt)
- Typography 主题：[Typography.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/designsystem/theme/Typography.kt)
- Dialog 骨架：[CommonDialogComponents.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/designsystem/component/CommonDialogComponents.kt)
- Settings 骨架：[SettingsComponents.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/settings/ui/SettingsComponents.kt)
- 会话表单 row 骨架：[SessionDialogRows.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/component/SessionDialogRows.kt)
- 会话表单输入骨架：[SessionDialogTextFields.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/component/SessionDialogTextFields.kt)

所以问题不是“没有 design system”，而是“design system 没被完全执行”。

### 2. 最大的维护热点是一个超大页面

按 `*.dp` 字面量数量统计，最大的热点是：

- [SessionManagementScreen.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/SessionManagementScreen.kt)  
  约 `7643` 行，包含 `309` 个 `dp` 字面量

这已经不是单纯样式问题，而是：

- 页面职责过大
- token 难以统一替换
- 小修小补容易继续复制硬编码

这说明后续任何“统一 iOS 风格”的改造，都不能再继续依赖散落在页面里的裸字面量。

但这里的首要动作不是继续把页面切成更多小文件，而是先把样式入口收口。

### 3. 38dp 并不只是一个值的问题，而是“值和语义没绑定”

当前公共常量里有：

- `AppDimens.listItemHeight = 38.dp`

但代码里仍然存在很多直接写死的：

- `38.dp`
- `12.dp`
- `16.dp`
- `50.dp`

这说明当前项目的真实问题不是某个值对不对，而是：

- 同一个视觉语义
- 同时以“语义 token”和“裸字面量”两种方式存在

这会导致：

- 改一处不生效
- 新页面继续复制旧值
- 无法批量升级到新的 iOS token

### 4. Typography 也有重复来源

项目里同时存在：

- [AppTextSizes.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/common/constants/AppTextSizes.kt)
- [Typography.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/designsystem/theme/Typography.kt)

这两个文件都在定义字体尺度：

- `body = 15sp`
- `caption = 13sp`
- `title = 17sp`

问题不在于它们数值冲突，而在于：

- 文字系统有两个入口
- 页面作者可以任选其一

这会直接削弱统一性。

### 5. Dialog / Card / Row 已经有公共骨架，但仍被大量局部覆写

例如：

- [CommonDialogComponents.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/designsystem/component/CommonDialogComponents.kt)
- [SettingsComponents.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/settings/ui/SettingsComponents.kt)

这些文件已经有：

- dialog header
- dialog container
- card shape
- divider
- row 高度

但同时全局仍存在大量：

- `RoundedCornerShape(12.dp)`
- `padding(horizontal = 16.dp)`
- `Arrangement.spacedBy(12.dp)`

这意味着公共骨架只统一了“结构”，还没有统一“细粒度 token”。

### 6. 下划线不是主要问题

你提到“有大量下划线”，这个要分清。

像这些资源名：

- `ic_toolbar_home.xml`
- `ic_action_dump_ui_layouts.xml`
- `floating_menu_bg.xml`

它们在 Android 里本来就必须用小写加下划线，这是资源系统约束，不是维护问题本身。

真正的问题不是“有下划线”，而是：

- 命名是否有稳定前缀
- 语义是否集中
- 同类资源是否有统一分组

目前资源目录里这部分其实还算可控：

- `ic_toolbar_*`
- `ic_action_*`

所以这块不是当前最高优先级。

## 哪些是正常约束，哪些是真问题

### 正常约束

- `res/drawable` 文件名必须小写下划线
- SVG / VectorDrawable 本身会有很多路径数据
- 某些 icon 文件名较长是正常的语义化命名

这些不用优先动。

### 真问题

- 大量 `dp` 字面量绕过公共常量
- 字体尺寸系统有双入口
- Card / Row / Dialog 已有骨架，但缺少统一的“细 token”
- 超大页面文件持续复制样式
- iOS 风格 token 没有形成单独命名空间
- 为了适配风格而继续长出低信息量样式包装层

## 最应该优先做的优化

### 1. 把“值常量”升级成“语义 token”

不要继续只保留：

- `listItemHeight`
- `paddingStandard`
- `cardCornerRadius`

建议改成更有语义的一层，比如：

- `IosFormRowHeight`
- `IosDialogHeaderHeight`
- `IosCardCorner`
- `IosHorizontalGutter`
- `IosSectionSpacing`
- `IosDividerInset`
- `IosToolbarHeight`

关键不是换名字，而是让调用者知道：

- 这个值是“iOS 表单 token”
- 不是“随手一个 12dp”

### 2. 统一字体入口

建议只保留一种主要入口：

- 要么只保留 `MaterialTheme.typography`
- 要么只保留 `AppTextSizes` 作为补充

但不能两套都作为一线入口长期并存。

更稳的做法是：

- 主入口统一用 `MaterialTheme.typography`
- `AppTextSizes` 仅保留极少数特殊值，或者完全移除

### 3. 把 row / card / divider 的细粒度参数抽出来

当前最值得抽的是：

- `12.dp` 间距
- `16.dp` 水平 padding
- `10.dp` 会话表单行 padding
- `12.dp` 圆角
- `8.dp` 圆角
- `50.dp` header / 特殊按钮高度

这些不应该散落在页面里，而应该集中到：

- `DialogTokens`
- `FormTokens`
- `SettingsTokens`
- `RemoteMenuTokens`

### 4. 先在 `SessionManagementScreen.kt` 收口样式入口

[SessionManagementScreen.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/SessionManagementScreen.kt) 仍然是当前最大的样式维护热点，但这篇文档不建议把“继续拆页面”当成默认动作。

更合适的顺序是：

- 先替换裸 `dp` / `sp` / 圆角字面量
- 先让它优先走现有 dialog、row、form 骨架
- 先删掉只有一层视觉包装意义的局部 helper
- 先把重复样式提炼到已有共享组件或明确 token

只有在完成以上收口后，某一块仍然明显独立、且提炼出来能减少阅读成本时，才做局部提炼，例如：

- 提炼稳定的 item block
- 提炼稳定的 dialog section
- 提炼稳定的 toolbar content

不建议为了 iOS 风格适配再把它拆成一串 30 到 50 行的中转文件。

### 5. 给 iOS 风格单独命名空间

当前项目虽然有 `AppColors.iOSBlue`、`IOSSwitch` 这类命名，但还是不够系统。

建议增加一层明确的 iOS 风格入口，例如：

- `IosColors`
- `IosMetrics`
- `IosShapes`
- `IosDialogs`
- `IosRows`

这样以后：

- 改 iOS 风格时只改这一层
- 不会影响非 iOS 风格页面
- 团队成员也更清楚哪些值不能随手改

## 推荐改造顺序

### 第一步：冻结设计 token

先把当前最常见的这些值收口：

- `38 / 40 / 45 / 50`
- `8 / 10 / 12 / 16`
- 常用圆角
- 常用 divider alpha
- dialog header 高度

### 第二步：统一共享骨架

优先改这些文件：

- [CommonDialogComponents.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/designsystem/component/CommonDialogComponents.kt)
- [SettingsComponents.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/settings/ui/SettingsComponents.kt)
- [SessionDialogRows.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/component/SessionDialogRows.kt)
- [SessionDialogTextFields.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/component/SessionDialogTextFields.kt)

### 第三步：在热点页面做去硬编码清理

优先清理：

- [SessionManagementScreen.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/SessionManagementScreen.kt)
- [AboutScreen.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/settings/ui/AboutScreen.kt)
- [LogViewerContent.kt](/Users/xr/IDEA.localized/scrcpy-mobile/scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/core/designsystem/component/LogViewerContent.kt)

这里优先做的是：

- 把裸字面量替换成 token
- 删除只做视觉转发的局部包装
- 优先复用已有骨架

不是先发起一轮新的目录级拆分。

### 第四步：资源命名只做增量规范

资源名不需要大清洗，只需要以后坚持：

- 工具栏：`ic_toolbar_*`
- 操作项：`ic_action_*`
- 背景：`bg_*` 或 `*_bg`

## 一句话结论

现在项目的主要维护成本，不是“有很多下划线”，而是：

- iOS 风格 token 没有成为唯一事实来源
- 公共骨架存在，但细节尺寸还散在各个页面里
- 超大页面文件持续复制硬编码
- 样式适配还没有完全收口到现有公共入口

要省维护成本，最有效的不是继续修某个 `38dp`，而是：

- 先建立语义 token
- 再统一共享骨架
- 再在热点页面做去硬编码清理
- 最后只对真正独立的局部做提炼，而不是继续细拆
