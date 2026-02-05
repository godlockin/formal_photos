# Cloudflare Pages 环境变量配置指南

> 所有参数都可以通过 Cloudflare 后台配置，无需修改代码

---

## 必需配置

| 变量名 | 值 | 说明 |
|---------|-----|------|
| `GEMINI_API_KEY` | 你的 Gemini API Key | **[必须]** 调用 Gemini API |

**获取方式**：
1. 访问 https://aistudio.google.com/app/apikey
2. 创建新的 API Key
3. 复制到下方配置

---

## 可选配置

### 1. 邀请码配置

| 变量名 | 默认值 | 说明 |
|---------|---------|------|
| `INVITE_CODES` | `PHOTO2026,VIP001,EARLY2026` | 邀请码列表，逗号分隔 |
| `INVITE_CODE_MAX_USES` | `100,50,200` | 每个邀请码的最大使用次数 |

**示例**：
```
INVITE_CODES=MYCODE1,MYCODE2,MYCODE3
INVITE_CODE_MAX_USES=50,100,200
```

---

### 2. 模型配置

| 变量名 | 默认值 | 说明 |
|---------|---------|------|
| `ANALYSIS_MODEL` | `gemini-3-pro-preview` | 图片分析模型 |
| `GENERATE_MODEL` | `gemini-3-pro-image-preview` | 图片生成模型 |

**注意**：如需更改模型，请确保你有对应的 API 访问权限。

---

### 3. 评审阈值配置

| 变量名 | 默认值 | 说明 |
|---------|---------|------|
| `REVIEW_PASS_THRESHOLD` | `80` | Prompt 评审通过分数 (0-100) |
| `PHOTO_APPROVAL_THRESHOLD` | `80` | 照片审核通过分数 (0-100) |

---

### 4. 功能开关

| 变量名 | 默认值 | 说明 |
|---------|---------|------|
| `ENABLE_ANALYZE` | `true` | 启用人物分析功能 |
| `ENABLE_GENERATE` | `true` | 启用照片生成功能 |
| `ENABLE_REVIEW` | `true` | 启用专家评审功能 |

**示例**（关闭某个功能）：
```
ENABLE_ANALYZE=false
```

---

### 5. 速率限制

| 变量名 | 默认值 | 说明 |
|---------|---------|------|
| `ENABLE_RATE_LIMIT` | `true` | 启用速率限制 |
| `RATE_LIMIT_REQUESTS` | `10` | 每窗口期最大请求数 |
| `RATE_LIMIT_WINDOW` | `60000` | 窗口期时间（毫秒） |

**示例**（更严格的限制）：
```
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=5
RATE_LIMIT_WINDOW=60000
```

---

## Cloudflare 后台配置步骤

### 步骤 1：进入项目设置

```
1. 登录 Cloudflare Dashboard
2. 进入 Pages → 你的项目
3. 点击 "Settings" 标签
```

### 步骤 2：添加环境变量

```
Settings → Environment variables → Add → Production
```

### 步骤 3：添加必需变量

| 名称 | 值 | Add to |
|------|-----|--------|
| `GEMINI_API_KEY` | `你的API Key` | Production |

### 步骤 4：添加可选变量（按需）

| 名称 | 值 | Add to |
|------|-----|--------|
| `INVITE_CODES` | `PHOTO2026,VIP001` | Production |
| `INVITE_CODE_MAX_USES` | `100,50` | Production |
| `REVIEW_PASS_THRESHOLD` | `80` | Production |
| `ENABLE_ANALYZE` | `true` | Production |

### 步骤 5：重新部署

```
1. 点击 "Deployments" 标签
2. 点击 "Retry deployment"
3. 等待部署完成
```

---

## 完整配置示例

```
# 必需
GEMINI_API_KEY=AIzaxxxxxxxxxxxxx

# 邀请码
INVITE_CODES=PHOTO2026,VIP001,ENTERPRISE
INVITE_CODE_MAX_USES=100,50,500

# 模型（通常不需要修改）
ANALYSIS_MODEL=gemini-3-pro-preview
GENERATE_MODEL=gemini-3-pro-image-preview

# 评审
REVIEW_PASS_THRESHOLD=80
PHOTO_APPROVAL_THRESHOLD=80

# 功能开关
ENABLE_ANALYZE=true
ENABLE_GENERATE=true
ENABLE_REVIEW=true

# 速率限制
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW=60000
```

---

## 配置验证

部署后，在浏览器控制台测试：

```javascript
// 测试 API 是否正常工作
fetch('/api/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'PHOTO2026',
    action: 'analyze',
    image: 'test'
  })
}).then(r => r.json()).then(console.log);
```

---

## 常见问题

### Q: 变量修改后需要重新部署吗？

**A**: 需要。Cloudflare Pages 环境变量修改后必须重新部署才能生效。

### Q: 可以为不同环境设置不同变量吗？

**A**: 可以。Cloudflare 支持为 Production、Preview、Production 添加不同的变量值。

### Q: 邀请码使用次数会重置吗？

**A**: 由于 Cloudflare Functions 是无状态的，服务器重启后使用次数会重置。如需持久化，需要使用 KV 存储。

### Q: 如何查看当前配置？

**A**: 目前没有 API 查看配置，只能通过查看部署日志或错误信息推断。
