# Formal Photos 项目文档

## 项目概览
这是一个“专业形象照生成器”的前后端一体项目：
- 前端使用 React + Vite，提供邀请码、协议、上传、姿势选择、生成进度与结果下载等完整流程。
- 后端使用 Cloudflare Pages Functions 调用 Gemini 模型，完成“人脸分析 → 设计 → 生成 → 评审”的多阶段处理。
- 目标：在保证身份特征一致性的前提下，生成符合商务形象标准的专业照片。

## 技术栈
- 前端：React 18、Vite、TypeScript、Tailwind CSS、Zustand
- 人脸检测：face-api.js（前端可选能力）
- 后端：Cloudflare Pages Functions + @google/generative-ai
- 模型：`gemini-3-pro-preview`（分析/评审）、`gemini-3-pro-image-preview`（生成）

## 核心流程
前端多步骤向导（`src/App.tsx`）：
- 邀请码（Invite）→ 使用协议（Consent）→ 上传（Upload）→ 姿势选择（Pose Select）→ 处理（Processing）→ 结果（Result）

处理流程在前端并行展开（按姿势独立迭代）：
1. `analyze`：分析原图，输出 `Person` 结构
2. `buildPrompt`：构建基础 Prompt
3. `reviewPrompt`：评审 Prompt（不通过会迭代）
4. `generate`：生成图像（不通过会迭代）
5. `reviewResult`：评审生成结果（不通过会迭代，达到上限后强制接受）

迭代上限见 `ITERATION_CONFIG`：Prompt 最多 3 次，生成最多 3 次。

## 前端模块说明
- `src/App.tsx`
  - 负责 UI 与流程编排
  - 维护每个姿势的处理状态与进度
  - 评审/生成循环在前端执行
- `src/store.ts`
  - Zustand 状态管理，维护流程阶段、图片、结果等
- `src/api.ts`
  - API 客户端，统一调用 `/api/gemini`
  - 存储原始图片与解析后的 Person
- `src/api.secure.ts`
  - 具备签名与简单数据混淆的安全版客户端
  - 默认未被 `App.tsx` 引用，可按需切换
- `src/types.ts`
  - 核心类型：`Person`、`Prompt`、`ReviewResult`、`Photo`

## 后端 Functions 概览
- `functions/api/gemini.ts`
  - 处理所有 action：`analyze`、`design`、`generate`、`review`、`reviewPrompt`、`reviewResult`、`processAll`
  - 校验邀请码（`INVITE_CODES`），并调用 Gemini 模型
- `functions/api/gemini.secure.ts`
  - 增加 HMAC 签名验证、请求重放防护
  - 对 `data` 做 base64 混淆，需配合 `src/api.secure.ts`

## API 约定（前端）
默认 URL：`/api/gemini`（可用 `VITE_API_URL` 覆盖）

请求结构：
```json
{
  "code": "INVITE_CODE",
  "action": "analyze|design|generate|review|reviewPrompt|reviewResult|processAll",
  "image": "data:image/jpeg;base64,...",
  "data": { "...": "..." }
}
```

常见错误：
- `INVALID_INVITE_CODE` / `INVITE_CODE_EXHAUSTED`
- `RATE_LIMIT_EXCEEDED`
- `INVALID_SIGNATURE` / `REQUEST_EXPIRED`

## 关键数据结构（简化）
- `Person`：性别、年龄段、肤色、脸型、独特特征、需保留特征等
- `Prompt`：文本 prompt + 技术/风格参数
- `ReviewResult`：评分、建议、是否通过、对比信息
- `Photo`：生成结果、评审结果、是否通过

## 环境变量
前端：
- `VITE_API_URL`：自定义 API 地址（默认 `/api/gemini`）

后端（Cloudflare Pages Functions）：
- `GEMINI_API_KEY`：Gemini API Key
- `INVITE_CODES`：邀请码列表（逗号分隔），默认 `PHOTO2026,VIP001,EARLY2026`
- `API_SECRET`：签名密钥（仅 `gemini.secure.ts` 使用）

## 本地开发与构建
```bash
npm install
npm run dev
```

本地敏感信息建议放在 `.dev.vars`（不会提交），示例见 `/.dev.vars.example`。

常用脚本：
- `npm run dev`：启动 Pages Functions + Vite
- `npm run dev:frontend`：仅启动 Vite
- `npm run build`：TypeScript 编译 + Vite 构建
- `npm run test`：Jest 测试

## 目录结构（简化）
- `src/` 前端应用
- `functions/` Cloudflare Pages Functions
- `public/` 静态资源
- `dist/` 构建产物
- `docs/` 项目文档

## 设计与约束
- 邀请码存在 `localStorage`，并作为 API 请求的身份凭证
- 后端不落地持久化存储（代码中未见写入存储逻辑）
- 评审流程强依赖 Gemini 输出 JSON 的稳定性，存在失败兜底逻辑

## 常见扩展点
- 用 `processAll` 在后端完成批量流程，减少前端迭代复杂度
- 切换到 `api.secure.ts + gemini.secure.ts` 提升安全性
- 引入更细粒度的质量策略（如更严格的通过阈值或多专家投票）
