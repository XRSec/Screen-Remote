# 远程 UI 布局分析规则

相关代码：

- `scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/remote/presentation/RemoteUiLayoutParser.kt`
- `scrcpy-mobile/app/src/main/java/com/mobile/scrcpy/android/feature/remote/ui/internal/RemoteLayoutInspectorUi.kt`
- `scrcpy-mobile/app/src/test/java/com/mobile/scrcpy/android/feature/remote/presentation/RemoteUiLayoutParserTest.kt`

## 这份文档解决什么问题

这份文档回答：

- 当前远程 UI 布局分析到底依赖什么数据
- 节点是怎么从 `uiautomator dump` 变成屏幕上的覆盖层的
- 为什么有些控件能识别类型但读不出状态
- 现有启发式规则覆盖了哪些控件，边界在哪里

## 主链路

远程布局分析的主链路是：

1. 目标设备执行 `uiautomator dump`
2. 解析 XML，生成 `RemoteUiLayoutSnapshot`
3. 从快照中过滤、分类、去重得到 `RemoteUiLayoutNode`
4. 覆盖层按节点 bounds 和类型绘制框、标签和控件指示器

这套机制的输入不是截图，而是无障碍树。

这意味着它擅长读取：

- bounds
- class
- resource-id
- text
- content-desc
- clickable/focusable/checkable/checked

它不擅长读取：

- 自绘控件的真实视觉细节
- 没有暴露到无障碍树里的选中状态
- 纯视觉存在但语义缺失的装饰元素

## 解析层规则

### 节点基础模型

解析器会为每个 XML 节点记录：

- `bounds`
- `className`
- `resourceId`
- `text`
- `contentDescription`
- `clickable`
- `focusable`
- `checkable`
- `checked`
- `scrollable`
- `visibleToUser`

同时还会派生：

- `kind`
- `label`
- `componentKey`
- descendant 摘要信息，如是否含输入框、文本、按钮、勾选指示器

### 分类规则

当前分类为：

- `INPUT`
- `BUTTON`
- `TEXT`
- `TOGGLE`
- `IMAGE`
- `CONTAINER`
- `OTHER`

主要规则如下。

#### 1. 原生输入控件

以下类名优先识别为 `INPUT`：

- `EditText`
- `TextInput`
- `AutoComplete`

#### 2. 原生开关类

以下类名优先识别为 `TOGGLE`：

- `CompoundButton`
- `CheckBox`
- `Switch`
- `Toggle`
- `RadioButton`

这条规则解决了真实开关此前被普通 `Button` 规则误吞的问题。

#### 3. 普通按钮

以下类名识别为 `BUTTON`：

- `Button`
- `Chip`

#### 4. 文本和图片

- `Image*` 识别为 `IMAGE`
- `TextView` 或类名含 `Text` 识别为 `TEXT`

#### 5. 自绘小方块勾选项

为了兼容一些应用里不是原生 `CheckBox/RadioButton` 的自绘控件，当前增加了自定义 `TOGGLE` 启发式。

命中条件：

- 类名是 `android.view.View`
- `clickable=true` 或 `focusable=true`
- `checkable=false`
- `resource-id` 命中以下关键词之一：
  - `scb_`
  - `check`
  - `toggle`
  - `switch`
  - `radio`
- bounds 尺寸较小，当前限制为 `16..96`
- 宽高比例不能太极端，避免把整行容器错判成 toggle

这条规则主要覆盖：

- `scb_call_type*`
- `scb_cancel_app_notify`
- `scb_not_user_present`
- `scb_load_user_app`
- `scb_load_system_app`

#### 6. 容器类

以下类名识别为 `CONTAINER`：

- `*Layout`
- `ViewGroup`
- `RecyclerView`
- `ListView`
- `ScrollView`
- `WebView`

#### 7. 其余节点

未命中上述规则的节点归类为 `OTHER`。

### 标签规则

节点标签按优先级生成：

1. `text`
2. `content-desc`
3. `resource-id` 人类化
4. 密码输入框 fallback 为 `Password`

`resource-id` fallback 只对部分类型启用，避免大量无意义标签污染覆盖层。

同时会过滤掉明显无意义的标签，例如：

- `icon`
- `image`
- `layout`
- `container`
- 过短的可疑英文短码

### 过滤规则

不是所有节点都会进入覆盖层。

会优先过滤：

- `visibleToUser=false`
- 没有面积的节点
- 状态栏和导航栏背景
- 纯装饰性小图标

会优先保留：

- 输入框
- 文本、按钮、开关这类有语义的叶子节点
- 小尺寸可交互图片
- 含输入或文本的语义容器
- 有明确标签的交互容器

### 去重与合并

解析后会做一轮去重，目标是避免：

- 同一块区域被多个等价节点重复覆盖
- 容器与其内部语义节点同时以相似标签出现
- 资源名 fallback 抢走真实文本节点的优先级

所以最终展示的是“去重后的语义节点集合”，不是原始 XML 全量节点。

## 覆盖层规则

### 基本绘制

覆盖层使用节点 `bounds` 与当前 viewport 做缩放映射，然后绘制：

- 边框
- 半透明背景
- 节点标签
- 特定控件的状态指示器

不同类型会使用不同边框颜色：

- `INPUT` 绿色
- `BUTTON` 蓝色
- `TEXT` 黄色
- `TOGGLE` 橙色
- `IMAGE` 紫色
- `CONTAINER` 灰蓝色
- `OTHER` 浅灰色

### 开关与勾选项的视觉规则

当前 `TOGGLE` 不再只在选中时才有反馈，而是始终显示控件类型。

覆盖层会区分三种视觉样式：

- `CHECKBOX`
- `RADIO`
- `SWITCH`

样式判断主要依赖：

- `className`
- `resource-id`

例如：

- `rb_*` 或类名含 `radio`，按 `RADIO`
- `sb_*`、类名含 `switch`、或 `CompoundButton` 且不像 radio/checkbox，按 `SWITCH`
- 其余 toggle 默认按 `CHECKBOX`

### 已选中与未选中的显示

当前规则如下：

- 已选中 `checkbox` 显示绿色底和白色勾
- 未选中 `checkbox` 显示灰色底和灰色勾
- 已选中 `radio` 显示绿色圆环和绿色圆点
- 未选中 `radio` 显示灰色圆环和灰色圆点
- 已开启 `switch` 显示绿色轨道和白色 thumb
- 已关闭 `switch` 显示灰色轨道和浅灰 thumb

这套策略的目标不是模拟目标应用的真实视觉，而是明确表达：

- 这是什么控件
- 它当前是否被判定为开启

### 左侧锚定规则

带文本的横向 `checkable` 项，例如 `RadioButton`，如果把状态图标画在控件几何中心，容易压住文字。

因此当前对这类节点使用左侧锚定：

- 必须是 `checkable`
- 必须有内联文字或可作为标签的文本
- 必须是横向项，宽度明显大于高度

命中后，状态指示器贴到控件左侧而不是中心。

## 当前测试覆盖

当前测试已覆盖：

- 文本和输入框基础解析
- 不可见节点过滤
- `CompoundButton` 识别为 `TOGGLE`
- `scb_*` 小尺寸可点击 `View` 识别为 `TOGGLE`
- 大尺寸 `switch_container` 不会误判为 `TOGGLE`

这些测试只能证明解析规则成立，不能证明所有目标应用的视觉状态都能被正确读取。

## 已知边界

### 1. 自绘勾选项可能识别出类型，但读不出状态

这是当前最重要的边界。

有些应用会把勾选框画成一个小 `android.view.View`，XML 里只有：

- `clickable=true`
- `focusable=true`
- `checkable=false`
- `checked=false`

这种情况下：

- 我们能靠资源名和尺寸推断“它像一个 toggle”
- 但无法从无障碍树直接知道“它到底勾上没有”

也就是说：

- 类型识别可以做
- 真实状态读取未必能做

### 2. 覆盖层是语义可视化，不是真实像素复刻

覆盖层里的 `checkbox/radio/switch` 只是统一语义表达。

它表达的是：

- 当前节点被识别成什么控件
- 当前解析到的状态是什么

它不承诺与目标应用原始 UI 完全一致。

### 3. 资源名启发式有泛化边界

`check / toggle / switch / radio / scb_` 这类关键词启发式能覆盖很多场景，但一定存在：

- 资源名命中但并非 toggle
- 真实 toggle 资源名完全不带任何语义

因此这条规则只能尽量保守，不能无限放宽。

## 如果后面要继续增强

优先级最高的增强方向有两个。

### 1. 针对自绘 toggle 做状态补全

可选路线：

- 根据 bounds 裁剪截图，按像素判断是否已勾选
- 做点击前后对比，观察视觉变化

这已经不是纯 XML 解析，而是“XML + 图像”的混合方案。

### 2. 为不同应用增加更细粒度适配

例如：

- 按 `resource-id` 前缀做应用级 toggle 规则
- 为特定页面加更稳定的状态识别
- 为自绘组件补充状态判断插件

## 一句话总结

当前远程 UI 布局分析已经能稳定做三件事：

- 从 `uiautomator dump` 中提取有语义的节点
- 把原生开关和一部分自绘小方块识别成 `TOGGLE`
- 用统一覆盖层把文本、输入、按钮、勾选框、单选框、开关可视化出来

但对于没有在无障碍树里暴露状态的自绘控件，系统目前只能可靠识别“它像一个勾选项”，不能保证读出“它当前是开还是关”。
