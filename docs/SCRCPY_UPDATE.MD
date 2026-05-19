`scrcpy` 这次从主仓记录的 `v3.3.4-5-g247a37d` 更新到 `v4.0 / 2322868`。整体规模：`182 files changed, 5928 insertions, 3251 deletions`。

主要变化：

- 从 SDL2 迁移到 SDL3
- 新增 flex display 支持
- 新增相机 torch/zoom 支持
- 窗口默认锁定宽高比，并新增 `--no-window-aspect-ratio-lock`
- 新增 `--keep-active`
- 新增 `--background-color`，默认背景色改为深灰
- 新增 `--render-fit`，包括 stretched 等渲染适配模式
- 新增 `--min-size-alignment`，并优化视频尺寸对齐逻辑
- 默认 `audio-output-buffer` 改为 `10ms`
- 断开前显示 disconnected 图标
- 新增快捷键：`F11` 全屏，`Mod+q` 退出
- 修复 Meta Quest 闪烁、方形屏旋转、虚拟显示尺寸/右键开启等问题
- 修复 rooted 设备复制粘贴、OPUS 静音导致高 CPU、颜色空间转换、Windows 参数/UTF-8 控制台、序列号带空格等问题
- 依赖升级：platform-tools/adb `37.0.0`、FFmpeg `8.1.1`、SDL `3.4.8`、dav1d `1.5.3`

当前主仓状态还有这些子模块指针变更未提交：`external/ScrcpyForAndroid`、`external/ScrcpyForAndroid-Miuzarte`、`external/scrcpy`。我没有 staging/commit。
