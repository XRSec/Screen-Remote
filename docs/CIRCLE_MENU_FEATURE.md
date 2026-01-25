# 圆环菜单功能实现

## 功能概述
实现了一个全新的圆环式浮动菜单，提供更直观的交互体验。

## 核心特性

### 1. 三种状态
- **静置状态**：三层同心圆，带呼吸动画效果
- **拖动状态**：显示"滑动"提示，可自由移动位置
- **展开状态**：点击后展开成 6 个彩色功能按钮

### 2. 视觉设计
- 三层同心圆：外层深色、中层灰色、内层浅色
- 呼吸动画：静置时透明度渐变（0.6-0.9）
- 彩色按钮：每个功能按钮有独特颜色标识
- 圆形分布：按钮从顶部开始顺时针均匀分布

### 3. 功能按钮（6个）
1. **主页**（绿色）- Home 键
2. **返回**（蓝色）- Back 键
3. **任务**（橙色）- Recent Apps
4. **键盘**（紫色）- 显示/隐藏键盘
5. **音量+**（紫红色）- 音量增加
6. **关闭**（红色）- 断开连接

### 4. 交互体验
- 点击：展开/收起菜单
- 拖动：移动菜单位置
- 震动反馈：所有操作都有触觉反馈
- 弹性动画：展开/收起使用弹簧动画

## 技术实现

### 文件结构
```
ui/components/
  ├── FloatingCircleMenu.kt    # 新增圆环菜单
  └── FloatingControlBar.kt    # 原有横条菜单

ui/screens/
  └── RemoteDisplayScreen.kt   # 集成两种菜单

common/
  └── Constants.kt             # 新增圆环菜单常量
```

### 关键常量
```kotlin
// ScrcpyConstants
CIRCLE_MENU_SIZE = 60              // 圆环大小
CIRCLE_MENU_EXPAND_RADIUS = 100    // 展开半径
CIRCLE_MENU_BUTTON_COUNT = 6       // 按钮数量
CIRCLE_MENU_ANIMATION_DURATION = 300L  // 动画时长

// LogTags
CIRCLE_MENU = "CircleMenu"         // 日志标签

// UITexts
SWITCH_USE_CIRCLE_MENU = "使用圆环菜单"  // UI 文本
```

### 使用方式
在 `RemoteDisplayScreen` 中根据会话配置自动选择：
```kotlin
val useCircleMenu = sessionData?.multiFunctionMenu ?: false

if (useCircleMenu) {
    FloatingCircleMenu(...)
} else {
    FloatingControlBar(...)
}
```

## 设计亮点

1. **视觉层次**：三层圆环营造深度感
2. **呼吸动画**：静置时更有生命力
3. **彩色编码**：功能按钮颜色区分，易于识别
4. **弹性动画**：展开/收起更自然流畅
5. **触觉反馈**：每个操作都有震动反馈

## 后续优化方向

1. 支持自定义按钮配置
2. 添加长按菜单项的二级功能
3. 支持更多手势（如双击、长按）
4. 添加菜单项标签显示
5. 支持主题色自定义

## 兼容性
- Android 8.0+
- 支持横竖屏切换
- 自动适配不同屏幕尺寸
