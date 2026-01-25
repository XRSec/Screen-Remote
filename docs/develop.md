## 低延迟优化

### **1. 编码器选择保存功能** ✅

- SessionData 添加 `videoEncoder` 字段
- 会话配置可保存用户选择的编码器
- 连接时正确传递编码器参数

### **2. 解码器根据编码格式自动选择** ✅

- 支持 h264/h265/av1 自动映射到对应 MIME 类型
- 使用 `findDecoderForFormat` 自动选择最优硬件解码器

### **3. 极致低延迟优化** ✅

**解码端：**
- ✅ 硬件解码器优先
- ✅ Surface 零拷贝渲染
- ✅ `KEY_LOW_LATENCY` + `KEY_OPERATING_RATE`
- ✅ 立即渲染，不缓冲
- ✅ 同步 API，单线程

**编码端：**
- ✅ Baseline Profile（`profile=1`）
- ✅ 禁用 B 帧
- ✅ 禁用 intra-refresh

### **4. 状态管理修复** ✅

- ✅ 只在解码器配置完成后才 drain output
- ✅ 修复 ByteBuffer 读取逻辑
- ✅ 正确处理 MediaCodec 状态机

