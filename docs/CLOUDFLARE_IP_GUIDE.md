# Cloudflare 出口 IP 配置指南

> **核心原则**：所有 API 调用必须经过 Cloudflare Pages Functions，出口 IP 自动为 Cloudflare 的 IP

---

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        你的本地网络                              │
│                                                                 │
│   浏览器                                                         │
│      │                                                          │
│      │  POST /api/gemini  (公网传输，HTTPS加密)                 │
│      │  ────────────────────────────────────────────────────────>│
│      │                                                         │
│      │                            Cloudflare 全球网络             │
│      │                                   │                       │
│      │                            Pages Functions                 │
│      │                                   │                       │
│      │                            Gemini API 调用                 │
│      │                                   │                       │
│      │                            Cloudflare 出口 IP             │
│      │                                   │                       │
│      │                                   ▼                       │
│      │                            ┌──────────────────┐           │
│      │                            │  Gemini API      │           │
│      │                            │  (看到的是       │           │
│      │                            │   Cloudflare IP) │           │
│      │                            └──────────────────┘           │
│      │                                                         │
└─────────────────────────────────────────────────────────────────┘

✅ 客户端 → Cloudflare → Gemini
✅ 出口 IP = Cloudflare 的 IP
✅ 敏感信息（API Key、Prompt）永不暴露
```

---

## 为什么能保证 Cloudflare 出口 IP？

| 组件 | 出口 IP | 说明 |
|------|---------|------|
| 本地浏览器 | 你的本地 IP | 只发送到 Cloudflare |
| Cloudflare Functions | Cloudflare IP | 由 Cloudflare 网络分配 |
| Gemini 看到 | Cloudflare IP | 看不到你的真实 IP |

---

## 验证方法

### 1. 检查 Cloudflare Functions 是否生效

```bash
# 访问你的 Functions 端点
curl https://your-project.pages.dev/api/gemini \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"test"}'

# 响应应该是 JSON（即使有错误）
{"error":"PROCESSING_ERROR"}
```

### 2. 在 Gemini 后台查看访问 IP

在 Google AI Studio 的 "Settings" → "Usage" 中可以看到：
- 访问 IP：Cloudflare 的 IP 地址段
- 不是你的本地 IP

### 3. Cloudflare IP 范围

Cloudflare 使用的 IP 段：
```
172.64.0.0/12
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
```

---

## 配置检查清单

### Cloudflare Pages 后台

- [ ] **Environment variables** 中配置了 `GEMINI_API_KEY`
- [ ] **Functions** 已启用
- [ ] **Functions directory** 设置为 `functions/`
- [ ] **Compatibility date** 设置为最新日期

### 本地 `.env` 文件

```bash
# 不需要配置 API Key（已在 Cloudflare 后台配置）
VITE_API_URL=/api/gemini
```

---

## 常见问题

### Q: 本地开发时出口 IP 是哪个？

**A**: 本地开发时直接调用 API Key，出口 IP 是你的本地网络。

**解决方案**：
1. 开发时使用 `.env` 配置 API Key
2. 生产环境使用 Cloudflare Pages Functions
3. 或者使用 Cloudflare Workers 进行本地代理

### Q: 如何让本地开发也使用 Cloudflare 出口？

**A**: 使用 Cloudflare Tunnel (cloudflared)

```bash
# 安装 cloudflared
brew install cloudflared

# 创建隧道
cloudflared tunnel --url http://localhost:3000

# 然后访问生成的 URL，所有请求都会经过 Cloudflare
```

### Q: Cloudflare Functions 有调用限制吗？

**A**: 有免费额度：

| 限制 | 免费版 | Pro 版 |
|------|--------|--------|
| 请求次数 | 100,000/天 | 无限制 |
| CPU 时间 | 10ms/请求 | 50ms/请求 |
| 内存 | 128MB | 128MB |

对于个人使用，免费版足够。

---

## 安全优势

```
┌─────────────────────────────────────────────────────────────┐
│                    安全层级                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: 客户端 → Cloudflare (HTTPS)                       │
│           敏感信息：❌ 无                                    │
│           API Key：❌ 无                                    │
│           Prompts：❌ 无                                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 2: Cloudflare Functions                              │
│           API Key：✅ 仅存于此                               │
│           Prompts：✅ 仅存于此                               │
│           专家知识库：✅ 仅存于此                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 3: Gemini API                                        │
│           看到的是：Cloudflare IP                           │
│           敏感信息：❌ 无                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 快速测试

```bash
# 1. 部署到 Cloudflare Pages
npm run build
npx wrangler pages deploy ./dist

# 2. 测试 Functions 端点
curl https://your-project.pages.dev/api/gemini \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"analyze","image":"test"}'

# 3. 在 Gemini 后台验证访问 IP
# 访问 https://aistudio.google.com/app/apikey
# 查看 Usage 记录的 IP 地址
```

---

## 总结

| 问题 | 答案 |
|------|------|
| 出口 IP 是谁？ | Cloudflare 的 IP |
| 如何保证？ | 所有请求经过 Cloudflare Functions |
| 敏感信息会暴露吗？ | 不会，全部在 Functions 中处理 |
| 需要额外配置吗？ | 不需要，这是 Cloudflare 的默认行为 |
