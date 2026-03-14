# 模块地图

相关文档：

- [架构原则](principles.md)
- [目标态与迁移计划](evolution-plan.md)
- [运行时主链路](runtime.md)
- [工程规则](../07-steering/engineering.md)

## 文档目的

这一篇回答两个问题：

1. 代码按什么维度组织
2. 不同目录各自应该放什么

## 总体分层

当前项目推荐用五层理解：

- `core`
- `infrastructure`
- `feature`
- `service`
- `app`

依赖方向应保持单向：

- `core -> infrastructure -> feature -> service -> app`

更准确地说，是高层可以依赖低层能力，低层不应反向依赖高层业务细节。

## `app`

职责：

- 应用入口
- 全局装配
- 导航与顶层生命周期

不应承担：

- 具体设备建链逻辑
- 复杂媒体或协议实现

## `feature`

职责：

- 组织业务功能
- 承接 ViewModel 与 Compose UI
- 面向用户功能而不是面向底层技术

当前重点 feature 包括：

- `session`
- `remote`
- `device`
- `settings`
- `codec`

### `feature/session`

更关注：

- 会话列表
- 会话编辑
- 会话配置回显

### `feature/remote`

更关注：

- 远控界面
- 连接发起
- 手势与控制交互

### `feature/device`

更关注：

- 设备发现
- ADB key / pairing 相关界面

### `feature/settings`

更关注：

- 应用级配置
- 日志、备份、配对入口

### `feature/codec`

更关注：

- 编解码器选择
- 编解码器测试和回显

## `infrastructure`

职责：

- 实现具体技术能力
- 把外部协议、系统 API、native 交互收敛成稳定接口

当前最关键的子域有：

- `adb`
- `scrcpy`
- `media`

### `infrastructure/adb`

主要包括：

- 连接管理
- transport / dadb 接入
- pairing
- key 管理
- shell 命令

### `infrastructure/scrcpy`

主要包括：

- server 启动
- socket 建链
- 会话运行时
- session 事件和资源

### `infrastructure/media`

主要包括：

- 视频解码
- 音频解码
- 渲染和播放链路

## `core`

职责：

- 通用模型
- 常量
- 设计系统
- 数据基础设施
- 国际化
- 通用事件能力

当前最关键的子域有：

- `common`
- `designsystem`
- `data`
- `domain`
- `i18n`

## `service`

职责：

- 前台服务
- 保活
- 生命周期协同

它更像系统级协作者，而不是业务主入口。

## 目录放置规则

### 应该放在 `feature`

- 直接面向用户的 UI
- ViewModel
- 页面状态协调

### 应该放在 `infrastructure`

- 连接器
- 协议实现
- transport
- server / socket / decoder 的技术逻辑

### 应该放在 `core`

- 可复用模型
- 常量
- 文本资源对象
- 通用工具

## 常见错误放置方式

### 错误一

把运行时管理器塞进 UI 目录。

### 错误二

把本来只服务某个功能的逻辑过早放进 `core`。

### 错误三

把会话主链路拆散到太多技术目录里，导致阅读一条链路要来回跳转。

## 新增代码时的判断顺序

新增一段代码时，建议依次问：

1. 这是用户功能，还是技术实现
2. 它是否依赖设备、协议、transport 细节
3. 它是否可被多个 feature 复用
4. 它是否属于会话运行时主链路

## 一句话总结

模块地图真正要解决的，不是目录看上去整齐，而是让任何一个功能都能沿着“UI -> 会话 -> 连接 -> socket -> 媒体”的主链路被稳定追踪。
