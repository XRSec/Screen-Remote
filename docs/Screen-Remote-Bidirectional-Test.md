# Screen Remote 双向临时测试手册

> 临时文件，不进入 Screen Remote、dadb 或 Wiki 仓库。

## 1. 当前环境

| 角色   | Serial            | 型号与系统                                     | 当前地址                               | App                                               |
|------|-------------------|-------------------------------------------|------------------------------------|---------------------------------------------------|
| 物理设备 | `10AEAG2YZS0020P` | vivo V2403A，Android 16 / API 36，arm64-v8a | Wi-Fi `192.168.5.13`               | `com.screen.remote.android.debug`，`4.4.3.8-debug` |
| 模拟器  | `emulator-5554`   | Android SDK 可能是 23/21 系统                  | 通过 socat 转发到  `192.168.5.13:15555` | `com.screen.remote.android.debug`，`4.4.3.8-debug` |

正向测试：vivo 控制 emulator，Screen Remote 会话名为 `emulator`。当前保存地址通过主机
`192.168.5.14:15555` relay 到模拟器 ADB。

本轮正向测试目标系统为 Android SDK 23，测试范围包括：

- 非兼容模式：`maxSize=720`、`maxSize=1920`。
- 兼容模式：`maxSize=720`、`maxSize=1920`。
- 全部七个管理页面：设备概览、实用工具、文件管理、应用管理、进程管理、端口转发和 Shell 命令。

反向测试：`emulator-5554` 控制 vivo。建议会话名为 `vivo`，目标地址使用 `192.168.5.13:5555`；测试前必须确认
vivo 的无线 ADB endpoint 已启用且模拟器能够访问。

> **Shell 命令页限制：**通过
> `screen-remote://session/{session}/manage/command?command=...` 打开页面时，URL 只负责进入 Shell
> 命令页并预填命令，
> **不会自动执行命令**。测试人员必须在页面中人工点击执行按钮，并核对终端输出和退出状态。

## 2. MCP 与命令行边界

只在以下场景使用 Android Studio MCP：

1. 调用 `get_run_configurations` 获取真实配置名。
2. 代码变更后需要编译、安装并运行新 App 时，调用 `execute_run_configuration`。
3. 需要持续观察 IDE Logcat 时使用 Studio Logcat 能力。

以下操作不要使用 MCP，直接使用 ADB 或本地命令，速度更快：

- 打开 `screen-remote://` URL。
- 判断当前 Activity、当前页面和连接状态。
- 清理或一次性筛选 Logcat。
- 检查 helper/scrcpy 目标进程。
- 验证 IP、端口和本地 ADB 命令。

禁止使用 `adb install`。App 安装和新版本运行必须由 Android Studio 完成。

## 3. 快速状态判断

### 3.1 两台设备是否在线

```bash
adb devices -l
```

必须同时看到：

```text
10AEAG2YZS0020P device
emulator-5554   device
```

### 3.2 当前前台 Activity

```bash
adb -s 10AEAG2YZS0020P shell dumpsys activity activities \
  | grep -m 1 -E 'topResumedActivity|mResumedActivity'
```

Screen Remote Debug 应包含：

```text
com.screen.remote.android.debug/com.screen.remote.android.app.MainActivity
```

### 3.3 当前是否在主页

不要先 dump 再读取整份 XML。直接 dump 后 grep，并只输出关键文字：

```bash
adb -s 10AEAG2YZS0020P shell '
uiautomator dump /sdcard/window.xml >/dev/null 2>&1
grep -o "text=\"[^\"]*\"" /sdcard/window.xml \
  | grep -E "主页|Home|会话|Sessions|点击连接|Tap to connect" \
  | head -n 12'
```

只需要机器判断时：

```bash
adb -s 10AEAG2YZS0020P shell '
uiautomator dump /sdcard/window.xml >/dev/null 2>&1
if grep -Eq "text=\"(主页|Home|会话|Scrcpy Sessions)\"" /sdcard/window.xml; then
  echo HOME
else
  echo NOT_HOME
fi'
```

把 serial 换成 `emulator-5554` 即可检查反向测试控制端。

### 3.4 只看当前页面关键文字

```bash
CONTROL=10AEAG2YZS0020P
adb -s "$CONTROL" shell '
uiautomator dump /sdcard/window.xml >/dev/null 2>&1
grep -o "text=\"[^\"]*\"" /sdcard/window.xml \
  | grep -v "text=\"\"" \
  | head -n 25'
```

### 3.5 快速检查本轮错误

```bash
CONTROL=10AEAG2YZS0020P
PACKAGE=com.screen.remote.android.debug
PID=$(adb -s "$CONTROL" shell pidof "$PACKAGE" | tr -d '\r')
adb -s "$CONTROL" logcat -d --pid="$PID" -v brief \
  | grep -Ei 'failed|error|exception|Dashboard helper|icon batch|ServerFailed'
```

### 3.6 连续保存 Logcat

高帧率投屏、兼容模式 JPEG 解码和厂商图形日志可能很快挤掉 Logcat 环形缓冲中的启动记录。
不要只在一分钟后执行 `logcat -d`；应在发送连接 URL 前开始连续采集。本测试只以 Logcat
作为应用日志证据，不读取 App 私有日志文件替代 Logcat。

```bash
start_case_logcat() {
  name=$1
  adb -s "$CONTROL" logcat -c
  PID=$(adb -s "$CONTROL" shell pidof "$PACKAGE" | tr -d '\r')
  adb -s "$CONTROL" logcat --pid="$PID" -v threadtime '*:V' \
    > "/tmp/screen-remote-$name.log" &
  CASE_LOGCAT_PID=$!
}

stop_case_logcat() {
  kill "$CASE_LOGCAT_PID" 2>/dev/null || true
  wait "$CASE_LOGCAT_PID" 2>/dev/null || true
}
```

如果测试期间 App PID 发生变化，应单独记录为进程重启，不得悄然换 PID 后继续拼接成一个通过用例。

## 4. 如何运行 App

### 4.1 vivo 作为控制端

1. Android Studio 选择 `10AEAG2YZS0020P`（vivo V2403A）。
2. 通过 Android Studio MCP 调用 `get_run_configurations`。
3. 执行返回的 `Screen-Remote.app` 配置。
4. App 打开后，后续 URL 和页面判断直接用 ADB，不再等待 MCP 进程回执。

### 4.2 emulator 作为控制端

1. Android Studio 临时把运行设备切换为 `emulator-5554`。
2. 通过 Android Studio MCP 执行 `Screen-Remote.app`。
3. 禁止为了省时间改用 `adb install`。

## 5. 通用测试函数

正向测试变量：

```bash
CONTROL=10AEAG2YZS0020P
TARGET=emulator-5554
SESSION=emulator
PACKAGE=com.screen.remote.android.debug
```

反向测试改成：

```bash
CONTROL=emulator-5554
TARGET=10AEAG2YZS0020P
SESSION=vivo
PACKAGE=com.screen.remote.android.debug
```

URL、断开和日志函数：

```bash
open_url() {
  adb -s "$CONTROL" shell \
    "am start -W -a android.intent.action.VIEW -d '$1' -p $PACKAGE"
}

disconnect_session() {
  open_url 'screen-remote://remote/disconnect'
  sleep 5

  adb -s "$CONTROL" shell '
  uiautomator dump /sdcard/window.xml >/dev/null 2>&1
  grep -o "text=\"[^\"]*\"" /sdcard/window.xml \
    | grep -E "主页|Home|会话|Sessions|点击连接|Tap to connect" \
    | head -n 12'
}

enable_logs() {
  for setting in debugmode activitylog eventlog shelllog managementlog videolog audiolog controllog; do
    open_url "screen-remote://setting/$setting/on" >/dev/null
    sleep 1
  done
}

save_logcat() {
  name=$1
  PID=$(adb -s "$CONTROL" shell pidof "$PACKAGE" | tr -d '\r')
  adb -s "$CONTROL" logcat -d --pid="$PID" -v threadtime \
    > "/tmp/screen-remote-$name.log"
}
```

## 6. 四种投屏测试

每个用例必须先执行 `disconnect_session`，并看到主页/会话列表文字后再继续。不能只发送断开 URL
后立即启动下一个连接。

scrcpy 刚出现画面不能立即判定通过。连接建立后必须保持约 1 分钟，并读取这一分钟内的 Logcat；部分视频或音频
编解码错误会延迟出现。观察期间不要切换用例或主动断开连接。

```bash
run_scrcpy_case() {
  name=$1
  compatibility=$2
  max_size=$3

  disconnect_session
  start_case_logcat "$name"
  open_url \
    "screen-remote://session/$SESSION/scrcpy?compatibilityMode=$compatibility&maxSize=$max_size"
  # 保持连接并累计 1 分钟日志，避免漏掉延迟出现的编解码错误。
  sleep 60
  stop_case_logcat
}

enable_logs
run_scrcpy_case normal-720 off 720
run_scrcpy_case normal-1920 off 1920
run_scrcpy_case compatibility-720 on 720
run_scrcpy_case compatibility-1920 on 1920
```

每个用例保存日志后，立即用一条过滤命令检查连接、编解码和 socket 异常：

```bash
grep -Ei \
  'codec|encoder|decoder|MediaCodec|video|audio|socket|ServerFailed|Connection failed|fatal|exception|error|failed' \
  /tmp/screen-remote-{normal,compatibility}-{720,1920}.log
```

过滤结果不能只按是否出现 `error` 机械判定。结合前后日志确认是否发生初始化重试、持续解码失败、音视频中断、
socket 断开或会话失败；可恢复且随后持续正常渲染的单次编解码探测失败应记录，但与最终连接失败区分开。

### 6.1 普通模式快速通过条件

```bash
grep -Ei 'Accepted Screen Remote URL|height = (720|1920)|first render|ServerFailed|Connection failed' \
  /tmp/screen-remote-normal-*.log
```

通过条件：

- URL 包含正确的 `compatibilityMode=off` 和 `maxSize`。
- decoder 实际高度为 720 或 1920，允许宽高随目标旋转互换。
- 出现 `first render`。
- 连续观察约 1 分钟后画面和控制仍正常，且已检查这段时间的完整 Logcat。
- 不出现 `ServerFailed` 或 `Connection failed`。
- 需要检查 scrcpy 链路时，确认 video、audio、control socket 按顺序建立，禁止并发建链。

### 6.2 兼容模式快速通过条件

目标设备上执行一条过滤命令：

```bash
adb -s "$TARGET" shell '
for path in /proc/[0-9]*/cmdline; do
  command=$(tr "\000" " " < "$path" 2>/dev/null)
  case "$command" in
    *dadb.helper.TouchStreamMain*|*dadb.helper.ScreenshotStreamMain*)
      echo "$path $command"
      ;;
  esac
done'
```

通过条件：

- 同时存在 `TouchStreamMain` 和 `ScreenshotStreamMain`。
- Screenshot 参数包含本轮 720 或 1920。
- 控制端显示目标画面。
- 实际执行一次点击、拖动和返回键，确认触控不是只建立进程。
- 断开后再次检查，不得残留 helper 进程。

### 6.3 SDK 23 快速测试技巧

本轮 SDK 23 正向测试可用以下方式快速判断，但仍需为每个用例保留约 1 分钟观察时间：

- 非兼容模式下，SDK 23 目标端不支持当前音频链路时，启动参数会显示 `audio=false`，预期 socket 数为 2。
  此时必须确认 `video`、`control` 按顺序连接；不要错误地等待不存在的 audio socket。
- `maxSize=720` 的实际视频分辨率可能是 `320x720`，`maxSize=1920` 可能是 `854x1920`；以长边匹配
  `maxSize` 且画面比例正确为准。
- Codec2 的 `BAD_INDEX`、`setOutputSurface()` 和资源查询失败等单次平台日志不能单独判定失败。如果随后出现
  `first render`、解码帧持续输出且没有 `ServerFailed` 或 `Connection failed`，应记录为可恢复平台告警。
- `CCodecConfig config failed => CORRUPTED`与
  `Failed to query component interface for required system resources`
  也必须结合后续日志判断。若同一解码器随后出现 `first render`，不将这两条单独判为用例失败。
- 根据 URL、时间戳和解码尺寸三者确认日志归属。`320x720` 对应 720 用例，`854x1920`
  对应 1920 用例；不要只根据手工标题给日志归类。
- 兼容模式不能只看画面或 helper 进程。必须从控制端画面点击打开目标应用，在可滚动列表执行拖动，并通过控制端
  返回键返回；同时在目标端检查当前窗口或页面文字确实发生变化。
- 使用控制端 ADB 注入返回键测试时，执行 `adb -s "$CONTROL" shell input keyevent KEYCODE_BACK`，该按键应由
  Screen Remote 转发给目标设备；验证目标窗口变化，不能只检查控制端 Activity 仍在前台。
- 控制端与目标端分辨率不同，点击坐标可能经过缩放映射。点击图标后应读取目标端当前窗口或少量关键 UI 文本，
  不要仅凭预估坐标认定点击成功。
- 兼容模式中的 `Image decoding logging dropped!` 是控制端 HWUI 解码诊断日志限流，不等于
  ScreenshotStream 丢帧。应以画面是否持续刷新、helper 是否重启和是否出现捕获中断来判断。
- vivo 控制端的 `/proc/fas/render` SELinux denied、`/proc/vivo_rsc/frame_set_priority` 不存在和
  `qdgralloc BufferManager::ReleaseBuffer` 属厂商图形栈日志，未伴随画面中断时不判为 Screen Remote
  链路失败。
- `A resource failed to call close` 若没有堆栈、helper 重启、连接中断或资源持续增长证据，只记录为待观察告警，
  不单独判失败。

兼容 helper 检查应使用精确的命令前缀，避免把检查命令自身误识别成 helper：

```bash
adb -s "$TARGET" shell '
for path in /proc/[0-9]*/cmdline; do
  command=$(tr "\000" " " < "$path" 2>/dev/null)
  case "$command" in
    "app_process / dadb.helper.TouchStreamMain "*|\
    "app_process / dadb.helper.ScreenshotStreamMain "*)
      echo "$path $command"
      ;;
  esac
done'
```

本轮 SDK 23 的兼容模式参数预期为：

```text
app_process / dadb.helper.TouchStreamMain
app_process / dadb.helper.ScreenshotStreamMain 720 55
app_process / dadb.helper.ScreenshotStreamMain 1920 65
```

四个用例建议固定使用以下日志名，方便一次过滤：

```text
/tmp/screen-remote-normal-720.log
/tmp/screen-remote-normal-1920.log
/tmp/screen-remote-compatibility-720.log
/tmp/screen-remote-compatibility-1920.log
```

```bash
grep -Ei \
  'first render|resolution|socket connected|capture started|TouchStream|ScreenshotStream|ServerFailed|Connection failed|fatal|exception|error|failed' \
  /tmp/screen-remote-{normal,compatibility}-{720,1920}.log
```

## 7. 七个管理页面

先断开投屏并开启管理日志：

```bash
disconnect_session
open_url 'screen-remote://setting/managementlog/on' >/dev/null
open_url 'screen-remote://setting/shelllog/on' >/dev/null
sleep 2
```

逐页打开，不要一次性快速发送全部 URL：

```bash
open_url "screen-remote://session/$SESSION/manage/device"
sleep 5

open_url "screen-remote://session/$SESSION/manage/utility"
sleep 5

open_url "screen-remote://session/$SESSION/manage/file/sdcard"
sleep 5

open_url "screen-remote://session/$SESSION/manage/app"
sleep 5

open_url "screen-remote://session/$SESSION/manage/process"
sleep 5

open_url "screen-remote://session/$SESSION/manage/port-forward"
sleep 5

open_url \
  "screen-remote://session/$SESSION/manage/command?command=getprop%20ro.product.model"
sleep 5
```

每页立即使用第 3.4 节的一条 `dump + grep` 命令判断页面标题和主要内容。不要把整份 XML 读回模型。

Shell 命令页必须按以下流程验证：

1. 打开命令 URL，确认进入 Shell 命令页，且输入框已预填 `getprop ro.product.model`。
2. 人工操作前，确认没有产生这次命令的新终端结果，避免把旧输出误判为本次结果。
3. 测试人员在页面中人工点击执行按钮；URL 本身不会触发执行。
4. 等待命令结束，核对终端输出和退出状态。

开启 debug mode 时，“实时日志”悬浮入口可能与 Shell 页右下角的执行按钮重叠。点击后如果进入“实时日志”
而未执行命令，先返回 Shell 页，再临时通过 `screen-remote://setting/debugmode/off` 关闭悬浮入口后点击真正的
执行按钮。测试结束后按需恢复 debug mode。

正向测试输出预期：

```text
Android SDK built for arm64
```

反向测试预期：

```text
V2403A
```

管理日志快速检查：

```bash
PID=$(adb -s "$CONTROL" shell pidof "$PACKAGE" | tr -d '\r')
adb -s "$CONTROL" logcat -d --pid="$PID" -v brief \
  | grep -E 'DeepLink|MGMT|ADBC|ADBM|Dashboard helper|icon batch|failed|error|Exception'
```

设备概览中的可选数据缺失时应该显示为空，不得出现 `Dashboard helper completed with ... failed fields`。

图标批量请求必须通过 App/dadb 路径判断。主机直接运行 helper 成功，只能证明设备端命令能执行，不能证明
dadb 能完整传输和解析图标大响应。

dadb helper `1.4.1` 及以后允许图标批次为空或只返回部分条目。无图标资源的应用可以被跳过：

```text
BATCH
-
-
```

上述空批次是合法响应，不应出现 `ZipException: No entries`、`unexpected output` 或 App 端完整异常堆栈。
混合批次中某个应用无图标时，helper 应仍返回其他可获取的图标，不得让整批失败。

## 8. 反向测试准备：emulator 控制 vivo

### 8.1 准备 vivo 无线 ADB

当前 vivo Wi-Fi IP 为 `192.168.5.13`。如果本地已经能直接连接并执行命令，先验证：

```bash
adb connect 192.168.5.13:5555
adb -s 192.168.5.13:5555 shell getprop ro.product.model
```

预期输出：

```text
V2403A
```

如果端口尚未启用，只在可信 Wi-Fi 中执行：

```bash
adb -s 10AEAG2YZS0020P tcpip 5555
adb connect 192.168.5.13:5555
adb -s 192.168.5.13:5555 shell getprop ro.product.model
```

### 8.2 建立反向会话

在 emulator 的 Screen Remote 中创建会话：

```text
名称：vivo
地址：192.168.5.13:5555
```

也可用 URL 预填，随后手动保存：

```bash
adb -s emulator-5554 shell \
  "am start -W -a android.intent.action.VIEW \
  -d 'screen-remote://session/new?name=vivo&address=192.168.5.13%3A5555' \
  -p com.screen.remote.android.debug"
```

随后使用：

```bash
CONTROL=emulator-5554
TARGET=10AEAG2YZS0020P
SESSION=vivo
PACKAGE=com.screen.remote.android.debug
```

复用第 6、7 节全部测试。

## 9. 结束与清理

```bash
disconnect_session
```

如果 vivo 的 TCP ADB 只为本轮测试临时启用，并且 USB 仍连接：

```bash
adb -s 10AEAG2YZS0020P usb
adb disconnect 192.168.5.13:5555
```

最后确认没有兼容 helper 残留，并保留 `/tmp/screen-remote-*.log` 供问题定位。
