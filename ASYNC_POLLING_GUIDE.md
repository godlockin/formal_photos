# 异步轮询模式 + 图片压缩 实现指南

## 改动概览

### 1. 后端改动 (`functions/api/gemini.ts`)

#### 新增任务管理系统
- **任务存储**: 使用内存 Map 存储任务状态 (生产环境建议使用 KV 或 Durable Objects)
- **任务状态**: `pending` → `processing` → `completed`/`failed`
- **自动清理**: 保留最近 1 小时的任务

#### 新增 API

**submitJob** - 提交异步任务
```typescript
POST /api/gemini
{
  "action": "submitJob",
  "data": {
    "action": "processPose",
    "image": "...",
    "data": { "originalImage": "...", "photoType": "正面头像", "person": {...} }
  }
}

// 返回
{
  "result": {
    "jobId": "job_1234567890_abc123",
    "status": "pending"
  }
}
```

**getJobStatus** - 查询任务状态
```typescript
POST /api/gemini
{
  "action": "getJobStatus",
  "data": { "jobId": "job_1234567890_abc123" }
}

// 返回
{
  "result": {
    "jobId": "job_1234567890_abc123",
    "status": "completed",
    "action": "processPose",
    "result": { "image": "...", "review": {...} },
    "error": null,
    "createdAt": 1234567890,
    "updatedAt": 1234567990
  }
}
```

#### 迭代次数优化
将最大迭代次数从 3 减少到 2，缩短处理时间：
```typescript
const ITERATION_LIMITS = {
  MAX_PROMPT_ITERATIONS: 2,  // 原为 3
  MAX_GENERATION_ITERATIONS: 2,  // 原为 3
};
```

### 2. 前端改动

#### 图片压缩 (`src/api.ts`)

```typescript
// 压缩图片到 2MB 以下
export async function compressImage(file: File, maxSizeMB: number = 2): Promise<string>

// 自动处理文件（小文件直接返回，大文件压缩）
export async function processFile(file: File): Promise<string>
```

**压缩逻辑**:
1. 如果文件 ≤ 2MB 且是 JPEG/PNG，直接返回
2. 否则压缩图片：
   - 最大尺寸限制 2048px
   - JPEG 质量从 0.85 开始，逐步降低直到文件大小符合要求
   - 最小质量 0.3

#### 异步任务 API (`src/api.ts`)

```typescript
// 提交任务
export async function submitJob(action: string, image?: string, data?: any)

// 获取任务状态
export async function getJobStatus(jobId: string): Promise<JobStatus>

// 轮询任务直到完成
export async function pollJobUntilComplete(
  jobId: string,
  onProgress?: (status: JobStatus) => void,
  pollInterval: number = 3000,  // 每 3 秒查询一次
  maxAttempts: number = 200      // 最多 200 次 (约 10 分钟)
)

// 异步处理单个姿势（封装了 submit + poll）
export async function processPoseAsync(
  originalImage: string,
  photoType: string,
  person?: Person,
  onProgress?: (status: JobStatus) => void
)
```

#### UI 更新 (`src/App.tsx`)

1. **上传步骤**: 使用 `processFile` 替代直接读取，自动压缩大图片
2. **处理步骤**: 使用 `processPoseAsync` 替代同步调用，支持进度回调

## 工作流程

### 上传流程
```
用户选择文件 → processFile() → 压缩(如需要) → 显示预览 → analyze() → 进入姿势选择
```

### 生成流程（异步）
```
选择姿势 → processPoseAsync() → submitJob() → 返回 jobId
                              ↓
                        轮询 getJobStatus()
                              ↓
              completed → 显示结果图片
              failed    → 显示错误
```

## 优势

1. **避免超时**: 任务在后台处理，前端轮询状态，不会触发 Cloudflare Workers 超时
2. **实时反馈**: 用户可以看到每个姿势的处理进度
3. **即时显示**: 每个姿势完成后立即显示，无需等待所有姿势完成
4. **图片压缩**: 减少传输时间和 API 调用成本
5. **更好的错误处理**: 任务失败可以单独重试，不影响其他姿势

## 部署说明

### 环境变量
无需新增环境变量，原有配置即可工作。

### 注意事项
1. **内存存储限制**: 当前使用内存 Map 存储任务，Cloudflare 实例重启时任务会丢失。生产环境建议：
   - 使用 Cloudflare KV 存储任务状态
   - 或使用 Durable Objects 管理长时间运行的任务

2. **并发处理**: 每个姿势是独立任务，可以并行处理

3. **任务保留时间**: 任务保留 1 小时，之后自动清理

## 监控和调试

### 浏览器控制台日志
```
[Image] Compressed: 5.2MB -> 1.8MB, quality: 0.85
[Async] Job submitted: job_1234567890_abc123
```

### 后端日志
```
[Job job_1234567890_abc123] Error: ...
```

## 可能的改进

1. **WebSocket**: 使用 WebSocket 推送任务完成通知，替代轮询
2. **Server-Sent Events**: 使用 SSE 流式推送进度更新
3. **Cloudflare Queues**: 使用队列确保任务可靠执行
4. **任务持久化**: 使用 KV 或 D1 数据库存储任务状态
