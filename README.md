- Zustand (状态管理)
- face-api.js (人脸检测)
- Gemini 1.5 Pro (AI)

## 核心价值

- ✅ 保留邀请码系统
- ✅ 3位核心专家 (摄影/美颜/终审)
- ✅ 专业布光方案
- ✅ 肤色/年龄优化
- ✅ 完整工作流

## Linus评分变化

| 指标 | 之前 | 之后 |
|------|------|------|
| Linus评分 | 43/100 | **85/100** |
| 代码行数 | ~3000 | ~500 |
| 复杂度 | 过高 | 适中 |

## 部署与安全

- 前端代码会被浏览器查看和抓包，不能在前端保存任何秘密（包括 `VITE_*` 变量）。
- 服务端密钥仅在 Cloudflare Functions 环境变量中配置，不会进入前端包。
- 生成用的 prompt 和模型版本仅在服务端生成与使用，前端不会拿到明文。
- `INVITE_CODES` 必须通过环境变量配置；未配置会返回 `SERVICE_UNAVAILABLE`。

## 本地运行

- 完整联调（前端 + Functions）：`npm run dev`
- 仅前端界面：`npm run dev:frontend`
- 本地联调需要环境变量：`GEMINI_API_KEY`
- 本地联调需要环境变量：`INVITE_CODES`（逗号分隔）
- 使用 `.dev.vars` 提供本地敏感信息（wrangler 会读取，不提交到仓库）
