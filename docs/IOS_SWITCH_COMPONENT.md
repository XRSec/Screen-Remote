# iOS 风格 Switch 组件

## 概述
全局替换了 Material3 的 Switch 组件为自定义的 iOS 风格 Switch，提供更美观、更流畅的用户体验。

## 设计特点

### 视觉效果
- **iOS 标准绿色**：开启状态使用 `#34C759`（iOS 系统绿色）
- **圆润设计**：更大的圆形滑块（thumb），圆角轨道（track）
- **精致阴影**：滑块带有微妙的阴影效果，增强立体感
- **深色模式适配**：自动适配深色/浅色主题

### 动画效果
- **流畅过渡**：250ms 的缓动动画
- **颜色渐变**：轨道颜色平滑过渡
- **位置滑动**：滑块位置流畅移动

### 尺寸规格
- **默认尺寸**：51dp × 31dp（接近 iOS 标准）
- **滑块内边距**：2dp
- **可自定义**：支持通过参数调整尺寸

## 使用方式

### 基础用法
```kotlin
IOSSwitch(
    checked = isEnabled,
    onCheckedChange = { isEnabled = it }
)
```

### 完整参数
```kotlin
IOSSwitch(
    checked = isEnabled,
    onCheckedChange = { isEnabled = it },
    enabled = true,
    width = 51.dp,
    height = 31.dp,
    thumbPadding = 2.dp
)
```

## 已更新的组件

### 1. SettingsSwitch
位置：`feature/settings/ui/SettingsComponents.kt`
- 设置页面的所有开关已替换为 IOSSwitch
- 保持原有的布局和交互逻辑

### 2. CompactSwitchRow
位置：`feature/session/ui/component/SessionDialogComponents.kt`
- 会话对话框中的开关已替换为 IOSSwitch
- 保持紧凑型布局风格

## 颜色配置

### 浅色模式
- **开启状态**：`#34C759`（iOS 绿色）
- **关闭状态**：`#E5E5EA`（iOS 灰色）
- **滑块颜色**：白色
- **禁用状态**：`#E5E5EA`（轨道）+ `#BDBDBD`（滑块）

### 深色模式
- **开启状态**：`#34C759`（iOS 绿色）
- **关闭状态**：`#39393D`（深灰色）
- **滑块颜色**：白色
- **禁用状态**：`#3A3A3C`（轨道）+ `#BDBDBD`（滑块）

## 技术实现

### 核心文件
- `core/designsystem/component/IOSSwitch.kt` - 主组件实现
- `core/designsystem/component/IOSSwitchPreview.kt` - 预览和示例

### 实现方式
- 使用 `Canvas` 绘制自定义图形
- `animateFloatAsState` 实现滑块位置动画
- `animateColorAsState` 实现颜色过渡动画
- `detectTapGestures` 处理点击交互

### 性能优化
- 使用 Compose 动画 API，性能优异
- 避免不必要的重组
- 支持硬件加速

## 预览效果

在 Android Studio 中打开 `IOSSwitchPreview.kt` 可以查看：
- 浅色/深色模式对比
- 开启/关闭状态
- 启用/禁用状态
- 交互动画效果

## 兼容性

- **最低 API**：23（Android 6.0）
- **推荐 API**：34+
- **Compose 版本**：与项目保持一致

## 未来扩展

可以考虑添加：
- 自定义颜色主题
- 不同尺寸预设（small/medium/large）
- 长按反馈效果
- 无障碍支持增强
