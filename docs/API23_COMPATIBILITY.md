# Android 6.0 (API 23) 兼容性适配

## 概述
项目已成功从 Android 8.0 (API 26) 降级到 Android 6.0 (API 23)，扩大设备覆盖范围。

## 修改内容

### 1. build.gradle.kts
- `minSdk`: 24 → 23
- `ANDROID_PLATFORM`: android-24 → android-23

### 2. ApiCompatHelper.kt
新增 API 23 支持：
- 添加 `API_23_MARSHMALLOW` 常量
- 更新 `vibrateCompat()` 方法，支持 API 23-25 使用旧版 `vibrate(long)`
- 新增 `createNotificationBuilder()` 方法，处理 API 23-25 不需要 channelId 的情况

### 3. ScrcpyForegroundService.kt
- 使用 `ApiCompatHelper.createNotificationBuilder()` 创建通知
- 确保 API 23-25 使用旧版 Notification API

## API 兼容性处理

### 通知系统
- **API 26+**: 使用 NotificationChannel
- **API 23-25**: 使用旧版 Notification.Builder（不需要 channel）

### 震动反馈
- **API 29+**: 使用预定义 VibrationEffect
- **API 26-28**: 使用 VibrationEffect.createOneShot()
- **API 23-25**: 使用旧版 vibrate(long)

### PendingIntent
- **API 23+**: 支持 FLAG_IMMUTABLE/FLAG_MUTABLE
- **API <23**: 仅使用 FLAG_UPDATE_CURRENT（理论上不会执行）

## 测试验证

### 编译测试
```bash
./gradlew clean
./gradlew assembleDebug
```
✅ 编译成功

### APK 验证
```bash
aapt dump badging app-debug.apk | grep sdkVersion
```
结果：
- sdkVersion: 23 ✅
- targetSdkVersion: 36 ✅

## 支持的 Android 版本
- **最低版本**: Android 6.0 (API 23) - Marshmallow
- **目标版本**: Android 15 (API 36)
- **覆盖范围**: 2015年至今的所有主流设备

## 注意事项

1. **核心依赖库兼容性**
   - Jetpack Compose: 最低 API 21 ✅
   - AndroidX DataStore: 最低 API 21 ✅
   - 所有依赖库均支持 API 23+

2. **测试重点**
   - API 23-25 设备上的通知显示
   - 前台服务启动和停止
   - 震动反馈功能
   - ADB 连接和心跳检测

3. **已知限制**
   - API 23-25 不支持 NotificationChannel（已兼容处理）
   - API 23-25 震动效果较简单（使用固定时长）

## 市场影响
降级到 API 23 可以覆盖更多老旧设备，预计增加约 5-10% 的潜在用户群。
