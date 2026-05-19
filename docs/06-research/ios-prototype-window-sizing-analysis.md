# iOS Prototype Window And Sizing Analysis

## 目的

这份文档解决的不是“某一个编辑会话页面长什么样”，而是更上层的几个问题：

1. 原型里哪些尺寸是作者自己定义的固定常量。
2. 这些尺寸在小屏上会不会自动缩小。
3. 原型的页面和窗口是怎么一层层打开的。
4. 你们当前 Android/Compose 工程里，哪些窗口已经共享同一套尺寸系统。

## 先给结论

### 1. 原型里的 `40pt` 是固定常量，不是按屏幕尺寸缩放的

从原型代码看，输入框高度是直接写死在页面代码里的：

- `ViewController.m` 里多个 `ScrcpyTextField` 都是 `.size(CGSizeMake(0, 40))`
- `PairViewController.m` 里配对输入框也是 `.size(CGSizeMake(0, 40))`
- `VNCViewController.m` 里也是同样写法

这说明“40”不是根据屏幕宽高计算出来的，也没有看到：

- `UIFontMetrics`
- `preferredFontForTextStyle`
- `adjustsFontForContentSizeCategory`
- size class 分支
- 小屏单独布局分支

所以高置信结论是：

- 逻辑尺寸就是固定 `40pt`
- 小屏不会自动缩成 `36pt` 或 `34pt`
- 适配策略不是“缩控件”，而是“缩宽度 + 允许滚动”

### 2. 小屏适配主要靠 3 件事

#### 宽度跟着容器变

主表单容器普遍是：

- `.widthAnchor(self.view.widthAnchor, -30)`

也就是：

- 内容宽度 = 父容器宽度减 `30pt`
- 左右边距各约 `15pt`

所以屏幕变窄时：

- 控件高度不变
- 控件宽度会跟着变窄

#### 页面本身是 `UIScrollView`

主配置页、配对页、密钥页都不是普通 `UIView`，而是直接把根视图换成了 `UIScrollView`：

- `ViewController.m`
- `PairViewController.m`
- `KeysViewController.m`

而且在 `viewDidLayoutSubviews` 里把 `contentSize` 设成第一个子视图的实际尺寸。

这意味着：

- 小屏放不下时不会压缩控件
- 而是直接滚动

#### 键盘弹出时做滚动避让

`ViewController.m` 和 `PairViewController.m` 都监听了：

- `UIKeyboardDidShowNotification`
- `UIKeyboardWillHideNotification`

然后根据正在编辑的文本框位置，主动调整 `contentOffset`。

所以原型的小屏策略非常明确：

- 固定控件高度
- 页面允许纵向滚动
- 键盘挡住输入框时滚上去

### 3. 原型里“系统窗口”和“自定义窗口”要分开看

原型里不是所有窗口尺寸都由作者自己控制。

#### 作者自己定义的

- 输入框 `40pt`
- 按钮 `45pt`
- 输入框圆角 `5pt`
- 按钮圆角 `6pt`
- 主表单左右边距 `15pt`
- 表单垂直间距 `12pt` 或 `15pt`
- 远控底部操作栏高度 `80pt`
- 长按引导条高度 `60pt`
- 密钥文本框高度 `200pt`
- HUD 最小尺寸 `130 x 130`

#### 系统自己管理的

- `UIAlertController`
- `UIDocumentPickerViewController`
- `UIActivityViewController`

这些不是作者自己写固定宽高的，最终外观由 iOS 系统组件决定。

所以后续做 Android 对标时，要先区分：

- 哪些是原型的设计 token
- 哪些只是调用系统弹窗

## 设计规律总表

这一节把前面的分析再压缩成一套更适合直接落地到工程里的规则。

### 1. 布局哲学

- 固定控件高度，不做按机型缩放
- 宽度跟父容器走，不固定输入框宽度
- 小屏靠滚动和键盘避让，不靠压缩组件
- 远程页面的工具层使用覆盖式浮层，不参与主表单排版

### 2. 页面骨架

- 配置类页面：全屏导航页 + `UIScrollView` + 垂直 `UIStackView`
- 二级功能页：模态弹出新的 `UINavigationController`
- 系统功能窗：`Alert / DocumentPicker / ShareSheet`
- 远程页面操作层：底部提示条 + 底部菜单栏

### 3. 间距与尺寸节奏

- 水平主 gutter：左右各约 `15pt`
- 表单主间距：`12pt` 或 `15pt`
- 输入框高度：`40pt`
- 按钮高度：`45pt`
- 远程底栏高度：`80pt`
- 长按提示条高度：`60pt`
- 密钥大文本框高度：`200pt`

### 4. 文字层级

- 主标签 / 输入内容：`16pt`
- 说明标题 / 二级标题：`15pt`
- 辅助说明 / 菜单底栏标签：`13pt`

### 5. 颜色层级

- 页面背景：浅色白，深色 `rgb(0.1, 0.1, 0.1)`
- 输入框边框：浅色 `rgba(0,0,0,0.3)`，深色白
- 远程画面背景：纯黑
- 远程菜单栏背景：`rgba(0,0,0,0.85)`
- 长按提示条背景：`rgba(255,255,255,0.3)`
- 主体视觉几乎只用黑 / 白 / 灰，强调色极少

### 6. 视觉风格关键词

- 工具型
- 低饱和
- 轻装饰
- 靠边框和透明度分层
- 优先可读性和操作密度

## 对当前 Android 项目的直接指导

你们当前项目不是缺一个页面，而是缺一层“统一的 iOS token 收口”。

### 1. 最应该统一的共享 token

- `AppDimens.listItemHeight`
- `AppDimens.paddingStandard`
- `AppDimens.windowCornerRadius`
- `CommonDialogComponents.kt` 的 `DialogHeader` / `DialogContainer`
- `SessionDialogRows.kt`
- `SessionDialogTextFields.kt`
- `SettingsComponents.kt`

### 2. 推荐目标值

- 核心表单行高：从 `38dp` 收到 `40dp`
- 按钮高度：统一到 `45dp`
- 输入框圆角：`5dp`
- 按钮圆角：`6dp`
- 主要水平 gutter：接近 `15dp`
- 说明文字：`13sp`
- 远程底部菜单背景：`rgba(0,0,0,0.85)`

### 3. 当前最值得优先优化的地方

- Dialog header 的灰阶层级过于“自定义组件”，和原型的导航栏感不完全一致
- 卡片 section 比原型更重，需要减轻背景和 divider 存在感
- 帮助 icon 当前视觉权重偏高，容易抢主标题注意力
- 横向 row 的 padding 规则还不够统一，容易让页面左右边距不稳定

### 4. 最稳的迁移策略

不要先重做结构，先重做 token。

建议顺序：

1. 先统一颜色、圆角、间距、行高
2. 再统一编辑会话和设置页的共享 row / card / dialog 骨架
3. 最后才考虑是否把某些 dialog 改成更接近原型的完整页面

## 原型的窗口树

## 1. 根入口

原型在 `main.m` 里根据模式切换根页面：

- `adb` 模式：进入 `ViewController`
- `vnc` 模式：进入 `VNCViewController`

根控制器外面统一包了一个 `UINavigationController`。

这说明原型最外层不是弹窗 app，而是导航栈 app。

## 2. ADB 主配置页能继续打开什么

`ViewController.m` 的右上角 `More` 按钮会先弹出一个系统 `ActionSheet`，再继续打开：

- `PairViewController`
- `KeysViewController`
- `LogsViewController`
- GitHub issue 链接

这里 `Pair`、`Keys`、`Logs` 都不是 push，而是：

- 新建各自页面
- 再包一个新的 `UINavigationController`
- 用 `presentViewController` 模态弹出

所以原型的层级是：

1. 根导航页
2. ActionSheet
3. 二级导航页模态
4. 二级导航页内部再继续弹系统窗口

## 3. Pair 配对页还能继续打开什么

`PairViewController` 自己是一个滚动表单页，还会打开：

- HUD
- Alert

它没有再开更多自定义子页面。

## 4. Keys 密钥页还能继续打开什么

`KeysViewController` 本身也是滚动表单页，但它内部还会再打开：

- 导出 `UIDocumentPickerViewController`
- 导入 `UIDocumentPickerViewController`
- 多个确认/提示 `UIAlertController`
- HUD / 文本 HUD

所以这是原型里最典型的“页面里再套系统窗口”的例子。

## 5. Logs 日志页还能继续打开什么

`LogsViewController` 是全文本查看页，还能再打开：

- `UIActivityViewController` 分享面板

## 6. 远控会话页还能继续打开什么

远控显示页不是 `ViewController`，而是 `SDL_uikitviewcontroller+Extend.m` 扩展出来的远程画面页。

这部分会继续弹：

- 一条底部引导条，固定高 `60pt`
- `MenubarViewController` 自定义底部菜单，固定高 `80pt`

`MenubarViewController` 不是系统 action sheet，而是作者自己写的全屏透明覆盖层 + 底部黑色工具条。

## 原型的尺寸系统

## 1. 页面容器

### 主配置页 `ViewController`

- 根视图：`UIScrollView`
- 内容主列：`UIStackView`
- 宽度：`self.view.width - 30`
- 顶部：`topAnchor(self.view.topAnchor, 0)`
- 垂直间距：`12pt`

### Pair 配对页

- 根视图：`UIScrollView`
- 内容宽度：`self.view.width - 30`
- 垂直间距：`15pt`

### Keys 密钥页

- 根视图：`UIScrollView`
- 内容宽度：`self.view.width - 30`
- 顶底都锚定到父视图
- 垂直间距：`15pt`

### Logs 页

- 不是 stack 表单
- 文本视图四边分别留 `5pt`

## 2. 表单控件

### 输入框

统一风格来自：

- `ViewController.m`
- `PairViewController.m`
- `UICommonUtils.h`
- `ScrcpyTextField.m`

稳定 token：

- 高度：`40pt`
- 字号：`16pt`
- 圆角：`5pt`
- 边框：`2pt`
- 内容左右 inset：`6pt`

颜色：

- 浅色边框：`rgba(0, 0, 0, 0.3)`
- 深色边框：白色
- 浅色背景：白色
- 深色背景：深灰
- 占位色：浅色灰 / 深色浅灰

### 开关行

来自 `CreateScrcpySwitch`：

- 标题字号：`16pt`
- 标题和开关间距：`10pt`
- 标题颜色随深浅色切换

### 按钮

来自 `CreateDarkButton` / `CreateLightButton`：

- 高度：`45pt`
- 字号：`16pt`
- 圆角：`6pt`
- 边框：`2pt`

### 辅助文字

主配置页底部说明文案：

- 字号：`13pt`
- 灰色
- 居中

### 多行文本区

密钥页文本框：

- 高度：`200pt`
- 字号：`15pt`
- 圆角：`5pt`
- 边框：`1pt`

## 3. 远控会话覆盖层

### 底部长按引导条

来自 `SDL_uikitviewcontroller+Extend.m`：

- 固定贴底 `60pt`
- 宽度铺满
- 背景是半透明白
- 内部图标 `30 x 30`
- 提示文案粗体 `15pt`

### 底部菜单栏

来自 `MenubarViewController.m`：

- 高度：`80pt`
- 宽度：全宽
- 背景：`rgba(0, 0, 0, 0.85)`
- 图标标题字号：`13pt`
- 菜单项内部有 `70 x 10` 的顶部占位

## 4. HUD

来自 `ViewController.m` / `PairViewController.m`：

- `MBProgressHUD`
- 最小尺寸：`130 x 130`
- 主配置页 HUD 标签字号：粗体 `14pt`

## 原型有没有真正做响应式

从代码层面看，原型没有现代意义上的响应式系统。

没有发现：

- 根据屏幕宽度切换不同 token
- 根据 iPhone 小屏单独降高度
- 根据 Dynamic Type 自动放大缩小字号
- 使用 safe area 做复杂重排
- 使用 size class 走不同布局

它的布局哲学更接近：

1. 固定常量定义控件高度
2. 宽度跟着父容器走
3. 放不下就滚
4. 系统弹窗交给系统

所以如果你问：

> 小尺寸的屏幕也是 40pt 吗？

答案是：

- 在原型现有实现里，是的，仍然是 `40pt`
- 变化的是可用宽度，不是输入框高度

## `CVCreate.size(CGSizeMake(0, 40))` 到底怎么理解

仓库里没有找到 `CVCreate` 源码，所以这里要区分“实证”和“高置信推断”。

### 已能实证的部分

- 它被大量用于输入框、按钮、菜单栏等固定高度组件
- 同一个链式 API 同时还存在 `widthAnchor(...)`、`heightAnchor(...)`
- 页面容器经常另外再补 `widthAnchor(self.view.widthAnchor, -30)`

### 高置信推断

`CGSizeMake(0, 40)` 的语义大概率是：

- 宽度 `0` 表示不在这里额外设固定宽
- 高度 `40` 表示直接给出固定高度约束

为什么可以这样推断：

- 这些控件后面都会跟随父容器宽度拉伸
- 如果这里同时把宽也固定死，就会和后面的 `widthAnchor(...)` 使用模式冲突
- 代码里所有表单控件都重复这个模式，行为非常一致

如果后面需要百分百落地到你们项目的设计 token，这个推断已经足够用了。

## 当前 Android 项目的共享窗口体系

## 1. 当前项目已经有统一的窗口常量

`AppDimens.kt` 已经定义了共享窗口和控件尺寸：

- `WINDOW_WIDTH_RATIO = 0.95f`
- `WINDOW_MAX_HEIGHT_RATIO = 0.8f`
- `windowCornerRadius = 8.dp`
- `sectionTitleHeight = 35.dp`
- `listItemHeight = 38.dp`
- `themeOptionHeight = 43.dp`
- 标准 padding / spacing 基本是 `10.dp`

这说明你们当前项目已经不是“每个页面自己写尺寸”了，而是有基础设计系统。

## 2. 当前项目的主 Dialog 外壳

`CommonDialogComponents.kt` 里：

- `DialogContainer` 用 `widthRatio` 和 `maxHeightRatio` 按屏幕比例适配
- `DialogPage` 默认复用这套容器
- `DialogHeader` 高度是 `50.dp`
- header 水平 padding 是 `8.dp`
- 内容区默认水平 padding 是 `10.dp`

这和原型最大的区别是：

- 原型是“全屏导航页 + 滚动表单”
- 当前项目是“居中 dialog + 自定义标题栏 + 卡片式 section”

## 3. 当前项目的 iOS Alert 壳层

`IOSAlertDialog` 又是另一套尺寸系统：

- 默认 `widthRatio = 0.84f`
- `maxHeightRatio = 0.78f`
- 圆角 `22.dp`

所以你们当前工程里至少有两套窗口壳：

1. 常规 `DialogPage`
2. 更像 iOS alert 的 `IOSAlertDialog`

## 4. 编辑会话页当前能继续打开哪些窗口

`SessionDialogState.kt` 和 `AddSessionDialogOverlays.kt` 表明，编辑会话页当前至少能继续打开这 6 类子窗口：

- 视频编码器选择
- 视频解码器选择
- 音频编码器选择
- 音频解码器选择
- USB 设备选择
- 分组选择

也就是说编辑会话不是单窗口，而是一个“母窗口”。

## 5. 设置页当前也不是单窗口

`SettingsScreenContent.kt` 和 `SettingsScreenDialogs.kt` 表明，设置页当前至少包含两层：

### 设置主窗口内部可继续导航到

- Appearance
- Language
- About
- ADB Keys
- Log Management
- Group Management
- Backup Restore

### 设置主窗口内部还能直接再开

- ADB Pairing Dialog
- Clear Logs Alert
- File Path Dialog
- Keep Alive 下拉菜单

所以“编辑会话”和“设置页面”现在都在复用同一套窗口体系，只是打开的子窗口类型不同。

## 6. 编辑会话和设置页确实共享很多尺寸

已经明确共享的有：

- `DialogPage`
- `DialogContainer`
- `DialogHeader`
- `AppDimens.listItemHeight`
- `SectionTitle`
- `IOSSwitch`
- `HelpIcon`

这意味着如果你后面要让“编辑会话”和“设置页”一起更像原型，改造层级应该是：

1. 先改共享 token
2. 再改会话页和设置页的局部差异

而不是分别去每个页面里硬写。

## 该怎么用这些结论指导后续改造

## 1. 先区分 4 类尺寸

后面改 UI 时，建议把尺寸分成四类，而不是全部混在一起。

### A. 原型表单 token

适合从原型迁移：

- 输入框高 `40`
- 按钮高 `45`
- 输入框圆角 `5`
- 按钮圆角 `6`
- 页面左右 gutter `15`
- 表单间距 `12` / `15`
- 辅助文案 `13`

### B. 当前项目窗口壳 token

这是你们自己已有的：

- `DialogPage` 宽高比例
- header 高 `50`
- window radius `8`
- alert radius `22`

### C. 当前项目列表/行 token

- `listItemHeight = 38`
- `sectionTitleHeight = 35`
- 各类 row padding

### D. 系统窗口策略

这些不要误认为“设计稿常量”：

- alert
- document picker
- share sheet

## 2. 如果目标是“更像原型”，优先应该动哪里

推荐顺序：

1. `AppDimens` 和表单行高
2. `DialogPage` 的内容留白和背景层级
3. `SessionDialogRows.kt` / `SessionDialogTextFields.kt`
4. `SettingsComponents.kt`
5. 各子窗口的局部例外

## 3. 不建议直接照搬原型的地方

不建议直接把当前项目改成完全复制原型：

- 原型主页面是全屏导航页，不是居中弹窗
- 原型没有 section card
- 原型没有帮助 icon
- 原型没有你们现在这么多子窗口分层

所以更正确的做法是：

- 保留当前工程的窗口组织结构
- 把原型的表单 token、密度和灰阶层级迁进去

## 最终结论

你刚才强调的点是对的：

- 不能只知道“输入框是 40pt”
- 还必须知道它是“怎么被定义成 40pt 的”
- 以及在小屏上为什么仍然成立

这次分析后的明确结论是：

1. 原型的 `40pt` 是固定逻辑尺寸，不是自适应缩放结果。
2. 原型的小屏策略是“宽度自适应 + 页面滚动 + 键盘避让”，不是“控件缩小”。
3. 原型不是单页面，它本身就有一棵窗口树，主页面、配对页、密钥页、日志页、远控底栏、系统弹窗都要分开分析。
4. 你们当前项目也已经形成了一套共享窗口系统，编辑会话和设置页共用了很多基础尺寸。
5. 真正应该改的是共享 token 层，不是只改一个编辑会话页面。
