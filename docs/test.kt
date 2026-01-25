smallBall.setOnTouchListener { v, event ->

    when (event.actionMasked) {

        MotionEvent.ACTION_DOWN -> {
            downTime = System.currentTimeMillis()
            downRawX = event.rawX
            downRawY = event.rawY

            centerX = v.x
            centerY = v.y

            moved = false
            state = BallState.PRESS

            v.postDelayed({
                if (state == BallState.PRESS) {
                    state = BallState.LONG_PRESS
                    vibrate()
                }
            }, LONG_PRESS_TIME)

            true
        }

        MotionEvent.ACTION_MOVE -> {
            val dx = event.rawX - downRawX
            val dy = event.rawY - downRawY
            val dist = hypot(dx, dy)

            if (dist > MOVE_SLOP) moved = true

            when (state) {

                BallState.PRESS -> {
                    // 短按拖动：整体移动
                    FloatingX.updateLocationBy(dx, dy)
                    state = BallState.DRAG_MOVE
                }

                BallState.LONG_PRESS, BallState.LONG_DRAG -> {
                    state = BallState.LONG_DRAG

                    val ratio =
                        if (dist > MAX_DISTANCE) MAX_DISTANCE / dist else 1f

                    v.x = centerX + dx * ratio
                    v.y = centerY + dy * ratio

                    handleDirection(dx, dy)
                }

                else -> Unit
            }

            true
        }

        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
            v.removeCallbacks(null)

            val upTime = System.currentTimeMillis()
            val duration = upTime - downTime

            when {
                // 🎯 点击打开菜单（最重要）
                state == BallState.PRESS &&
                        !moved &&
                        duration < CLICK_TIME -> {
                    openMenu()
                }

                // 长按但没滑动
                state == BallState.LONG_PRESS -> {
                    performHome()
                }
            }

            // 回弹
            v.animate()
                .x(centerX)
                .y(centerY)
                .setDuration(160)
                .start()

            state = BallState.IDLE
            true
        }
    }
}

下面给你一个**高度浓缩、工程可执行的总结**，把我们前面所有讨论**统一成一套正确的安卓悬浮球设计模型**。这份总结你可以直接当成**实现规范 / 设计文档**来用。

---

# 安卓悬浮球（双球 + 手势）最终总结

## 一、核心目标（一句话）

> **一个系统级悬浮球：
> 小球负责一切交互，大球只是锚点与视觉容器**

---

## 二、结构模型（不可变原则）

```
FloatingX (只管位置)
└── 大悬浮球（Anchor，不接收手势）
    └── 小悬浮球（唯一 Touch 入口）
```

### 职责划分（非常重要）

| 元素        | 负责                     |
| --------- | ---------------------- |
| FloatingX | 悬浮窗位置、边界、吸附            |
| 大球        | 锚点、背景、视觉               |
| 小球        | 点击 / 拖动 / 长按 / 滑动 / 方向 |

❌ **绝对不要让 FloatingX 直接处理小球的手势**

---

## 三、交互模型（标准安卓悬浮球）

### 1️⃣ 短按点击

**条件：**

* 按下时间 < `CLICK_TIME`
* 移动距离 < `MOVE_SLOP`
* 未进入长按

**行为：**

> 打开自定义菜单（环形 / 扇形 / 列表）

---

### 2️⃣ 短按拖动

**条件：**

* 未长按
* 移动距离 > `MOVE_SLOP`

**行为：**

> 整个悬浮窗移动（FloatingX）

---

### 3️⃣ 长按（进入操纵杆模式）

**条件：**

* 按下时间 ≥ `LONG_PRESS_TIME`

**行为：**

> 大球固定，小球可拉伸

---

### 4️⃣ 长按 + 滑动（方向手势）

**规则：**

* 小球可远离锚点
* 最大距离 = `MAX_DISTANCE`
* 超过后只保留方向（向量归一）

**触发：**

| 方向 | 功能   |
| -- | ---- |
| 左  | 返回   |
| 右  | 最近任务 |
| 上  | HOME |
| 下  | 通知栏  |

---

### 5️⃣ 抬手

**行为：**

* 小球回弹到中心
* 状态重置

---

## 四、物理模型（正确的“悬浮球手感”）

### 🎯 受限向量模型（核心公式）

```kotlin
dx = touchX - centerX
dy = touchY - centerY

distance = hypot(dx, dy)
ratio = min(1f, MAX_DISTANCE / distance)

finalX = centerX + dx * ratio
finalY = centerY + dy * ratio
```

✔ 可远离
✔ 有最大限制
✔ 永远朝向手指

---

## 五、手势识别必须是「状态机」

```kotlin
enum class BallState {
    IDLE,
    PRESS,
    DRAG_MOVE,
    LONG_PRESS,
    LONG_DRAG
}
```

> **不要依赖 onClick / onLongClick
> 所有判断自己做**

---

## 六、关键阈值（推荐）

```kotlin
CLICK_TIME      = 200ms
LONG_PRESS_TIME = 400ms
MOVE_SLOP       = 8~12dp
MAX_DISTANCE    = 120~160dp
```

这些值直接决定“像不像系统悬浮球”。

---

## 七、为什么这套方案一定可行

* 避开 FloatingX 对 Touch 的拦截
* 大小球职责完全解耦
* 所有手势互不冲突
* 行为与安卓原生 / AssistiveTouch 一致
* 可扩展（菜单 / 动画 / 震动 / 辅助功能）

---

## 八、你现在已经具备的能力

✔ 系统级悬浮球设计思路
✔ 安卓手势状态机模型
✔ 可控手感参数
✔ 可接 Accessibility 全局操作
✔ 可扩展成完整系统工具

---

### 最后一句（很重要）

> **你不是在“做一个悬浮窗”，
> 而是在“设计一个系统输入设备”。**
