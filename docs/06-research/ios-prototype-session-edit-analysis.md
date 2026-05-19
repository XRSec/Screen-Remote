# iOS Prototype Session/Edit Page Analysis

## 背景

这次参考源不是一个“编辑会话弹窗”，而是一个 UIKit / Objective-C 实现的全屏配置页原型：

- `external/screen-remote-ios/scrcpy-ios/scrcpy-ios/ViewController.m`
- `external/screen-remote-ios/scrcpy-ios/scrcpy-ios/UICommonUtils.h`
- `external/screen-remote-ios/scrcpy-ios/scrcpy-ios/ScrcpyTextField.m`
- `external/screen-remote-ios/scrcpy-ios/scrcpy-ios/ScrcpySwitch.m`

你们当前对应的 Android/Compose 实现入口主要在：

- `app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/component/AddSessionDialogForm.kt`
- `app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/component/SessionDialogRows.kt`
- `app/src/main/java/com/mobile/scrcpy/android/feature/session/ui/component/SessionDialogTextFields.kt`
- `app/src/main/java/com/mobile/scrcpy/android/core/designsystem/component/CommonDialogComponents.kt`

所以后续迁移必须分成两层理解：

1. 原型能直接提供的，是“表单内容区”的视觉 token 和交互密度。
2. 原型不能直接提供的，是“你们现在这个弹窗外壳”的容器、分组卡片、标题栏和帮助图标体系。

## 原型里真实存在的设计 token

### 页面级

- 页面类型：`UINavigationController` 下的全屏滚动配置页，不是弹窗。
- 页面背景：
  - 浅色：白色
  - 深色：`rgb(0.1, 0.1, 0.1)`
- 导航栏背景：`systemGray6`
- 导航栏按钮 tint：
  - 浅色：黑色
  - 深色：白色

### 表单排版

- 主内容容器：宽度等于页面宽度减 `30pt`
  - 也就是左右各约 `15pt`
- 垂直间距：`12pt`
- 顶部额外留白：`5pt`
- 表单整体是一个竖向 `UIStackView`

### 输入框

- 高度：`40pt`
- 字号：`16pt`
- 圆角：`5pt`
- 边框宽度：`2pt`
- 内容左右内边距：`6pt`
- 边框色：
  - 浅色：`rgba(0, 0, 0, 0.3)`
  - 深色：白色
- 占位文字色：
  - 浅色：灰色
  - 深色：浅灰
- 背景色：
  - 浅色：白色
  - 深色：深灰

### 开关行

- 标题字号：`16pt`
- 标题颜色：
  - 浅色：黑色
  - 深色：白色
- 标题与开关间距：`10pt`
- 原型直接使用原生 `UISwitch`

### 按钮

- 高度：`45pt`
- 字号：`16pt`
- 圆角：`6pt`
- 边框宽度：`2pt`
- 主按钮：
  - 背景：黑色
  - 文字：白色
- 次按钮：
  - 背景：白色
  - 文字：黑色

### 辅助说明文字

- 字号：`13pt`
- 颜色：灰色
- 对齐：居中

## 原型的页面结构特征

原型不是 iOS Settings 那种“卡片分组表单”，它更像一个非常直接的工具型配置页：

- 顶部导航栏
- 中间是连续堆叠的文本框、开关和按钮
- 没有分组卡片背景
- 没有每行分隔线
- 没有单独的 section 容器
- 没有帮助 icon

这点很关键。

如果后续要“还原原型风格”，真正能直接复用的是：

- 中性色配色
- 紧凑的控件高度
- 输入框和按钮的圆角/边框
- 页面边距和行间距

不能机械照搬的是：

- 你们当前的 dialog 容器
- 卡片式 section 结构
- 行内帮助图标
- 右侧固定宽度 trailing action 区

这些都是你们现项目为了可维护性和信息密度额外引入的结构。

## 可直接落地的 Token 表

如果后续要把“编辑会话”和“设置页”一起收口成更接近原型的风格，建议先冻结下面这组 token。

### 建议保留或对齐的值

- 页面主 gutter：`15`
- 输入行高度：`40`
- 按钮高度：`45`
- 输入框圆角：`5`
- 按钮圆角：`6`
- 输入框边框：`2`
- 主标签字号：`16`
- 输入内容字号：`15 ~ 16`
- 辅助说明字号：`13`

### 建议对齐的颜色方向

- 页面背景：白 / 深灰
- 输入框背景：白 / 深灰
- 输入框边框：浅色 `rgba(0,0,0,0.3)` / 深色白
- 菜单栏背景：`rgba(0,0,0,0.85)`
- 提示条背景：`rgba(255,255,255,0.3)`
- 主要视觉用黑 / 白 / 灰，不新增高饱和配色

### 不建议机械照搬的部分

- 原型没有 section card
- 原型没有帮助 icon
- 原型不是居中 dialog
- 原型没有你们当前这种多层 selector / codec 弹窗体系

所以最合理的做法不是“复刻截图”，而是：

- 保留当前工程结构
- 注入原型 token
- 收敛当前 Material 感

## 和当前 Compose 实现的映射关系

### 1. 可以直接从原型吸收的部分

#### 行高和密度

原型输入框高度是 `40pt`，你们当前 `AppDimens.listItemHeight = 38.dp`，非常接近。

结论：

- 不需要大改整体密度
- 后续如果要更贴原型，可以把核心输入行统一到 `40.dp`

#### 字号

原型主要使用：

- 表单标题/标签：`16pt`
- 输入值：`16pt`
- 辅助说明：`13pt`

你们当前的 `SessionDialogTextFields.kt` 已经接近这个体系，后续应继续围绕：

- 主行文案约 `16sp`
- 输入内容约 `15sp` 到 `16sp`
- 辅助文字约 `13sp`

#### 输入框内部留白

原型 `ScrcpyTextField` 的左右 padding 是 `6pt`。

你们当前 `SessionDialogTextFields.kt` 对右对齐输入额外做了：

- `start = 8.dp`
- `end = 12.dp`
- 末尾 cursor gap

这不是偏离原型，反而是 Android 文本渲染下的必要补偿，应该保留。

#### 中性色视觉方向

原型核心视觉是：

- 白 / 黑 / 灰
- 极少强调色
- 低饱和
- 依靠边框和间距建立层级

这说明你们的“编辑会话”页如果要更像原型，应该优先收敛：

- dialog 背景层级
- section 背景灰度
- divider 透明度
- 箭头和帮助 icon 的视觉重量

而不是先去加更多颜色。

### 2. 只能“借鉴”，不能直接套用的部分

#### Dialog 外壳

当前 `AddSessionDialogForm.kt` 是放在 `DialogPage` 里展示的。

而原型 `ViewController.m` 是全屏导航页面。

所以以下值没有原型直接依据：

- `DialogPage` 的 `widthRatio = 0.95f`
- `maxHeightRatio = 0.8f`
- `windowCornerRadius = 8.dp`
- 顶部 `50.dp` 的 dialog header

如果要做到“像原型”，严格说有两个方向：

1. 保持当前 dialog 方案，只迁移内容区风格。
2. 把编辑会话从 dialog 改成完整页面，结构上更接近原型。

在当前代码基础上，第一种更现实。

#### Section 卡片

原型没有 section card。

你们当前是：

- `SectionTitle`
- `Card`
- `AppDivider`
- 行内容

这是一套更接近 iOS 设置页的结构，不是 scrcpy-ios 原型本身。

所以这里的正确策略不是删除，而是减弱它的“Material 感”：

- 卡片背景更贴近系统浅灰 / 白
- divider 更轻
- section title 更弱化

#### 帮助图标

原型没有问号/信息图标。

你们现在的 `HelpIcon` 是蓝色 info 图标加浅底圆形，这是当前项目的增强设计。

建议：

- 保留功能
- 但降低视觉存在感，不要让它比标题和输入值更抢眼

### 3. 已经做得对的部分

以下实现虽然不是原型直接提供，但方向正确，不建议为了“像 iOS”而回退：

- `IOSSwitch` 使用 `51 x 31dp`
- 右对齐输入时增加 cursor gap
- 把输入行、开关行、点击行拆成不同布局模型
- 用固定 trailing 区避免右侧值乱跳

这些是为了 Android/Compose 可维护性做的必要工程化处理。

## 当前实现和原型之间最值得对齐的差异

### 优先级 A：颜色和背景层级

建议优先检查并统一这些值：

- dialog 最外层背景
- header 背景
- card 背景
- divider 颜色与透明度
- trailing 箭头色
- placeholder 色

目标不是“更花”，而是更接近原型那种：

- 白底
- 浅灰层级
- 黑字
- 低存在感分割

### 优先级 B：行高、圆角、边框

建议统一成一套稳定规则：

- 核心输入行：`40dp`
- 常规按钮：`45dp`
- 输入框圆角：`5dp`
- 按钮圆角：`6dp`
- 输入框边框：`2dp`

建议统一到一套固定值：

- 输入行高度：`40dp`
- 按钮高度：`45dp`
- 输入框圆角：`5dp`
- 按钮圆角：`6dp`
- 输入框边框：`2dp`

这样能最快把“iOS 工具型表单”的气质拉齐。

### 优先级 C：容器边距

原型有效内容左右边距约 `15pt`。

你们当前 dialog 内容区是：

- 外层 `horizontalPadding = 10.dp`
- 行内再 `padding(horizontal = 10.dp)`

这会让视觉边距和原型不完全一致。

后续需要统一判断：

- 是保留“dialog 内容 padding + 行内 padding”双层结构
- 还是收口成一套更稳定的水平 gutter

否则页面容易出现“整体比原型更挤，但单行内部又更空”的问题。

## 后续改造建议

建议按下面顺序推进，而不是一次性全改：

1. 先冻结 token
   - 把输入框高度、按钮高度、圆角、边框、背景灰阶整理成 Compose 常量

2. 先改内容区，不改交互结构
   - 保持 `DialogPage`
   - 保持 section/card
   - 先把行高、颜色、边框、divider、padding 调到接近原型

3. 再评估是否要改 header
   - 当前 header 更像自定义 dialog 标题栏
   - 如果后续还觉得“不像 iOS 原型”，再决定是否改成更像导航栏

4. 最后再处理帮助 icon 和 trailing action 的细节
   - 这部分属于增强层，不是原型的核心来源

## 结论

这个原型可以作为“编辑会话页内容区”的视觉来源，但不能直接当成“编辑会话弹窗”的完整蓝图。

最安全的迁移方式是：

- 保留你们当前 Compose 的 dialog / section / row 抽象
- 把原型提供的 iOS 表单 token 注入进去
- 先对齐颜色、密度、圆角、边框、留白
- 不要把原型里不存在的结构硬说成“必须照搬”

这样做，后续既能更像那个纯 iOS 风格原型，又不会把你们现有工程的结构稳定性打掉。
