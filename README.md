# Scrcpy Mobile

Scrcpy Mobile 是一个运行在 Android 设备上的远程控制应用，围绕 `scrcpy`、ADB、管理页工具和 Android 本地交互做了一体化整合。

## 主要入口

- [Wiki 首页](https://github.com/XRSec/scrcpy-mobile/wiki)
- [用户使用文档](https://github.com/XRSec/scrcpy-mobile/wiki/%E7%94%A8%E6%88%B7%E4%BD%BF%E7%94%A8%E6%96%87%E6%A1%A3)
- [开发文档](https://github.com/XRSec/scrcpy-mobile/wiki/%E5%BC%80%E5%8F%91%E6%96%87%E6%A1%A3)

## 项目能力

- 管理多台设备和多组会话配置
- 通过 USB、TCP、Wireless Debugging 建立 ADB 连接
- 查看远端画面并发送触摸、按键和文本输入
- 查看设备信息、管理文件、应用、进程和命令
- 支持 `scrcpy 4.0` 当前主线协议适配

## 目录说明

```text
.
├── scrcpy-mobile/   Android 主工程
├── external/dadb/   ADB 协议与 Android 运行时能力
├── docs/            仓库内参考文档
└── wiki/            GitHub Wiki 页面源
```

## 文档说明

- `wiki/` 是当前文档主入口
- `docs/` 保留仓库内参考资料，部分内容可能是阶段性材料
