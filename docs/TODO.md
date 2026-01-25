# 任务清单

## 功能层面

- [ ] `Constants.kt` 通用组件 常量 需要丰富
- [ ] Github Action android apk 编译
- [ ] `LogcatCapture.kt` 日志相关需要统一规划 `TAG`
- [ ] `AudioDecoder.kt` 音频编码解码 支持 `opus`
- [ ] `AudioDecoder.kt` 音频编码解码 支持 `flac`
- [ ] `VideoDecoder.kt` 视频编码解码 复测
- [ ] 设备重连逻辑优化
- [ ] 代码中的 部分 api 可能不支持老版本的降级方案
- [ ] 代码中的 部分 变量未使用，不安全修复
- [ ] `SessionDialog.kt` 会话编辑页面 添加开关选项：`多功能菜单键`
- [ ] `RemoteDisplayScreen.kt` > `多功能菜单键`：拖动 `移动`、长按左滑 `返回`、右滑 `任务`、上滑 `桌面`、下滑 `菜单`
- [ ] `RemoteDisplayScreen.kt`多功能菜单键与传统菜单二选一
- [ ] `RemoteDisplayScreen.kt` 传统菜单 三个点 与展开菜单位置逻辑修改，只有在顶部/底部 30% 的时候在菜单下/上位置，其余都在菜单下面
- [ ] `ScreenRemoteApp.kt` 长按会话页面 添加管理功能 复刻甲壳虫App
- [ ] `RemoteDisplayScreen.kt` 控制/被控 设备旋转 需二次确定 宽高比正常
- [ ] `RemoteDisplayScreen.kt` 连接/重连设备 事务 异步执行
- [ ] `RemoteDisplayScreen.kt` 断开会话/连接失败/切换后台 销毁事务 异步执行
- [ ] `SessionDialog.kt` 音频音量滑块 功能实现
- [ ] `SessionDialog.kt` 功能实现
- [ ] `RemoteDisplayScreen.kt` 连接/重连 设备 单次唤醒屏幕
- [ ] `RemoteDisplayScreen.kt` 连接设备视频渲染数据优化
- [ ] `RemoteDisplayScreen.kt` 连接设备音频渲染数据优化
- [ ] `RemoteDisplayScreen.kt` 连接设备 默认参数优化
- [ ] `RemoteDisplayScreen.kt` 日志 TAG 标签分化，音/视频基础 `Encode` `aacEncode` `h264Encode` 方便快速定位日志

## UI 层面

- [x] `TestFloatingButton.kt` 双圆悬浮球交互完善（主/副球体 + 点击/拖动/长按日志）
- [ ] `Constants.kt` 大量使用 类似 `38.dp` 的可以使用此通用组件
- [ ] `UI` 对齐 `iOS` `Scrcpy Remote`
- [ ] 更新 文档 文档预览图

## 推广

- [ ] 视屏推广

- [ ] 软文推广

## 贡献者

- [ ] 贡献者信息记录

## 付费系统

> 由于这个需求是小众群体需要，后期可能会考虑闭源收费，收费金额对照 iOS `Scrcpy Remote` ，但是坚决保护贡献值利益，贡献者未来将赠送 10 个激活码，一个激活码可以登录 10 台设备，后期可能会设计简易登录系统用于移除不需要的设备