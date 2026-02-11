# "Failed to fetch" 错误分析与修复

## 问题描述
部署到 Cloudflare Pages 后，上传图片进行生成时经常出现 "Failed to fetch" 错误。

## 根本原因分析

### 1. **Cloudflare Workers 超时限制** (最可能的原因)
- Cloudflare Workers 有执行时间限制（免费版 50ms，付费版最高 30 秒）
- `processPose` 函数需要执行多次 Gemini API 调用：
  - Prompt 评审（最多 3 次迭代）
  - 图像生成（最多 3 次迭代）
  - 结果评审
- 每次 Gemini 图像生成可能需要 10-30 秒，总时间可能超过 Workers 限制

### 2. **请求体大小限制**
- Base64 编码的图片在 JSON 中会膨胀 33%
- 一张 5MB 的图片变成 Base64 后约 6.6MB
- 加上其他 JSON 字段，可能接近或超过限制

### 3. **前端错误处理不完善**
- 错误响应解析假设总是 JSON，但超时或网关错误返回的是 HTML
- 导致二次错误，显示 "Failed to fetch" 而非真实错误信息

## 已实施的修复

### 1. 前端 API 错误处理改进 (`src/api.ts`)
```typescript
// 添加超时控制
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

// 改进错误解析
const contentType = res.headers.get('content-type') || '';
const responseText = await res.text();
if (contentType.includes('application/json')) {
  err = JSON.parse(responseText);
} else {
  // 非 JSON 响应（可能是 Cloudflare 错误页面）
  err = { error: `服务暂时不可用 (HTTP ${res.status})` };
}
```

### 2. 添加请求超时
- `processPose`: 180 秒超时
- `processAll`: 300 秒超时
- 其他请求: 默认 300 秒

### 3. 后端错误处理改进 (`functions/api/gemini.ts`)
- 统一使用 `jsonResponse` 函数确保所有响应都是 JSON
- 添加双层 try-catch 捕获配置错误和处理错误
- 改进错误日志记录

## 建议的进一步修复

### 1. **实现流式响应/后台处理** (推荐)
对于长时间运行的 AI 生成任务，应该：
1. 立即返回一个 job ID
2. 使用 Cloudflare Durable Objects 或队列在后台处理
3. 客户端轮询状态

### 2. **减少迭代次数**
```typescript
const ITERATION_LIMITS = {
  MAX_PROMPT_ITERATIONS: 2,  // 从 3 减少到 2
  MAX_GENERATION_ITERATIONS: 2,  // 从 3 减少到 2
};
```

### 3. **图片压缩**
在上传前压缩图片：
```typescript
// 在 src/App.tsx 的 handleFile 中
if (file.size > 2 * 1024 * 1024) {
  // 压缩图片到 2MB 以下
  const compressed = await compressImage(file, 2);
}
```

### 4. **分片生成**
不要一次生成所有姿势，而是逐个生成：
```typescript
// 不要调用 processAll，而是逐个调用 processPose
for (const pose of selectedPoses) {
  await processPose(image, pose, person);
  // 显示进度
}
```

## 诊断测试

使用提供的测试脚本测试生产环境：

```bash
# 安装依赖
pip install requests

# 运行测试
export PRODUCTION_URL="https://your-domain.pages.dev"
export INVITE_CODE="PHOTO2026"
python test_production_api.py test_image.jpg
```

## 部署后验证

1. 上传一张小图片（< 1MB）测试基本功能
2. 检查浏览器 DevTools Network 面板：
   - 查看请求是否超时
   - 查看响应状态码
   - 查看响应内容类型
3. 检查 Cloudflare Dashboard Workers 日志：
   - 查看是否有异常退出
   - 查看 CPU 时间使用情况

## 相关 Cloudflare 限制

| 限制项 | 免费版 | 付费版 |
|--------|--------|--------|
| CPU 时间 | 50ms | 30s |
| 请求体大小 | 100MB | 500MB |
| 响应体大小 | 无限制 | 无限制 |

## 结论

"Failed to fetch" 最可能的原因是 **Cloudflare Workers 超时**。建议：
1. 升级到 Workers Paid 计划以获得 30 秒执行时间
2. 或者实现异步处理模式（job + 轮询）
3. 或者减少迭代次数以缩短处理时间
