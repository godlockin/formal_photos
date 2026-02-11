# Cloudflare Pages 部署问题排查

## 问题：上传图片报错 "Failed to execute 'json' on 'Response': Unexpected end of JSON input"

### 可能原因和解决方案

#### 1. Cloudflare Function 未正确部署

**症状**：前端返回 JSON 解析错误
**原因**：Functions 目录结构或配置问题
**解决**：

```bash
# 确保 functions 目录结构正确
functions/
├── api/
│   ├── [[path]].ts      # 路由入口
│   ├── gemini.ts        # 主处理函数
│   └── gemini.secure.ts # 安全版本（可选）
├── _headers             # HTTP headers 配置
└── tsconfig.json        # TypeScript 配置

# 重新构建并部署
npm run build
npx wrangler pages deploy dist --project-name=formal-photos
```

#### 2. 环境变量未设置

**症状**：500 错误或无响应
**解决**：

```bash
# 设置必需的环境变量
npx wrangler pages secret put GEMINI_API_KEY
# 输入你的 Gemini API Key

# 可选：设置邀请码
npx wrangler pages secret put INVITE_CODES
# 输入：PHOTO2026,VIP001,EARLY2026
```

#### 3. CORS 问题

**症状**：跨域错误（CORS policy）
**已修复**：已在 gemini.ts 中添加 OPTIONS 处理

#### 4. Function 路由问题

**症状**：404 错误或无法找到 /api/gemini
**解决**：确保 [[path]].ts 存在并正确导出

```typescript
// functions/api/[[path]].ts
export { onRequestPost, onRequestOptions } from './gemini';
```

#### 5. 函数编译错误

**症状**：部署后函数无法启动
**检查**：

```bash
# 本地测试 Functions
npx wrangler pages dev -- npm run dev

# 查看日志
npx wrangler tail
```

## 部署检查清单

### 必需文件

- [x] `functions/api/gemini.ts` - 主 API 处理
- [x] `functions/api/[[path]].ts` - 路由入口  
- [x] `functions/_headers` - Headers 配置
- [x] `wrangler.toml` - Wrangler 配置
- [x] `dist/` - 构建输出目录

### 必需环境变量

- [ ] `GEMINI_API_KEY` - Google Gemini API Key（必需）
- [ ] `INVITE_CODES` - 邀请码列表（可选，默认有）

### 部署步骤

```bash
# 1. 构建项目
npm run build

# 2. 检查 functions 目录结构
ls -la functions/api/

# 3. 本地测试
npx wrangler pages dev -- npm run dev

# 4. 部署
npx wrangler pages deploy dist --project-name=formal-photos

# 5. 设置环境变量
npx wrangler pages secret put GEMINI_API_KEY

# 6. 验证部署
# 访问：https://your-project.pages.dev
```

## 最新修复（2025-02-10）

### 修复内容

1. ✅ 添加 `functions/api/[[path]].ts` 路由入口文件
2. ✅ 添加 `onRequestOptions` 处理 CORS 预检请求
3. ✅ 统一 CORS headers 配置
4. ✅ 确保所有错误都返回 JSON 格式

### 验证方法

```bash
# 本地测试
npm run dev

# 测试 API
curl -X OPTIONS http://localhost:3000/api/gemini
# 应该返回 204

curl -X POST http://localhost:3000/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"code":"PHOTO2026","action":"analyze","image":"data:image/jpeg;base64,/9j/4AAQ..."}'
# 应该返回 JSON 响应
```

## 如果仍有问题

### 检查 Cloudflare Dashboard

1. 登录 Cloudflare Dashboard
2. 进入 Pages 项目
3. 查看 Functions 标签页
4. 检查是否有编译错误

### 查看日志

```bash
# 实时查看函数日志
npx wrangler tail --project-name=formal-photos
```

### 常见错误代码

- `WORKER_EXCEPTION`: 函数代码错误
- `SCRIPT_NOT_FOUND`: Functions 未正确构建
- `UNAUTHORIZED`: 缺少 API Key

## 联系支持

如果以上步骤都无法解决问题：
1. 检查 Cloudflare 状态页面
2. 查看 Functions 日志
3. 尝试重新部署
4. 联系 Cloudflare 支持
