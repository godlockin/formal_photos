# 📋 Cloudflare Pages 可配置参数完整清单

> **核心原则**：所有参数都可以通过 Cloudflare 后台配置，无需修改代码

---

## 一目了然

```
┌─────────────────────────────────────────────────────────────────────┐
│                        配置参数清单                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ 必需配置（1个）                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  │ GEMINI_API_KEY      │ Gemini API Key (必须)                   │ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ⚙️ 可选配置（11个）                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                     │
│  📋 邀请码配置（2个）                                               │
│  ├── INVITE_CODES          │ 邀请码列表                             │
│  └── INVITE_CODE_MAX_USES │ 每个邀请码的最大使用次数               │
│                                                                     │
│  🤖 模型配置（2个）                                                 │
│  ├── ANALYSIS_MODEL        │ 图片分析模型                           │
│  └── GENERATE_MODEL        │ 图片生成模型                           │
│                                                                     │
│  📊 评审配置（2个）                                                 │
│  ├── REVIEW_PASS_THRESHOLD │ Prompt评审通过分数                     │
│  └── PHOTO_APPROVAL_THRESHOLD │ 照片审核通过分数                    │
│                                                                     │
│  🔌 功能开关（3个）                                                 │
│  ├── ENABLE_ANALYZE        │ 启用人物分析功能                       │
│  ├── ENABLE_GENERATE       │ 启用照片生成功能                       │
│  └── ENABLE_REVIEW         │ 启用专家评审功能                       │
│                                                                     │
│  🚦 速率限制（3个）                                                 │
│  ├── ENABLE_RATE_LIMIT     │ 启用速率限制                           │
│  ├── RATE_LIMIT_REQUESTS   │ 每窗口期最大请求数                     │
│  └── RATE_LIMIT_WINDOW    │ 窗口期时间（毫秒）                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 详细配置说明

### 必需配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `GEMINI_API_KEY` | 字符串 | **无** | Gemini API Key，**[必须配置]** |

---

### 可选配置

#### 1. 邀请码配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `INVITE_CODES` | 字符串 | `PHOTO2026,VIP001,EARLY2026` | 邀请码列表，逗号分隔 |
| `INVITE_CODE_MAX_USES` | 字符串 | `100,50,200` | 对应的最大使用次数，逗号分隔 |

**示例**：
```
INVITE_CODES=MYCODE1,MYCODE2,MYCODE3
INVITE_CODE_MAX_USES=50,100,200
```

#### 2. 模型配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ANALYSIS_MODEL` | 字符串 | `gemini-3-pro-preview` | 图片分析模型 |
| `GENERATE_MODEL` | 字符串 | `gemini-3-pro-image-preview` | 图片生成模型 |

#### 3. 评审配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `REVIEW_PASS_THRESHOLD` | 数字字符串 | `80` | Prompt评审通过分数 (0-100) |
| `PHOTO_APPROVAL_THRESHOLD` | 数字字符串 | `80` | 照片审核通过分数 (0-100) |

**示例**：
```
# 提高评审标准
REVIEW_PASS_THRESHOLD=85
PHOTO_APPROVAL_THRESHOLD=85

# 降低评审标准
REVIEW_PASS_THRESHOLD=70
PHOTO_APPROVAL_THRESHOLD=70
```

#### 4. 功能开关

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ENABLE_ANALYZE` | 布尔字符串 | `true` | 启用人物分析功能 |
| `ENABLE_GENERATE` | 布尔字符串 | `true` | 启用照片生成功能 |
| `ENABLE_REVIEW` | 布尔字符串 | `true` | 启用专家评审功能 |

**示例**：
```
# 关闭专家评审
ENABLE_REVIEW=false

# 只保留生成功能
ENABLE_ANALYZE=true
ENABLE_GENERATE=true
ENABLE_REVIEW=false
```

#### 5. 速率限制

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ENABLE_RATE_LIMIT` | 布尔字符串 | `true` | 启用速率限制 |
| `RATE_LIMIT_REQUESTS` | 数字字符串 | `10` | 每窗口期最大请求数 |
| `RATE_LIMIT_WINDOW` | 数字字符串 | `60000` | 窗口期时间（毫秒） |

**示例**：
```
# 更严格的限制
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=5
RATE_LIMIT_WINDOW=60000

# 关闭限制
ENABLE_RATE_LIMIT=false
```

---

## Cloudflare 后台配置步骤

### 步骤 1：进入项目

```
1. 打开 https://dash.cloudflare.com
2. 登录你的账号
3. 进入 Pages → 你的项目名称
4. 点击 "Settings" 标签
```

### 步骤 2：找到环境变量

```
Settings → Environment variables → Add
```

### 步骤 3：添加变量

```
Variable name: GEMINI_API_KEY
Value: AIzaxxxxxxxxxxxxx (你的API Key)
Select environment: Production
Add to production: ✅ 勾选
```

### 步骤 4：添加其他变量（按需）

```
Variable name: INVITE_CODES
Value: PHOTO2026,VIP001,ENTERPRISE
Add to production: ✅
```

### 步骤 5：重新部署

```
1. 点击 "Deployments" 标签
2. 找到最新部署
3. 点击 "Retry deployment"
4. 等待部署完成（通常1-2分钟）
```

---

## 完整配置示例

```bash
# ==================== 必需 ====================
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxx

# ==================== 邀请码 ====================
INVITE_CODES=PHOTO2026,VIP001,ENTERPRISE
INVITE_CODE_MAX_USES=100,50,500

# ==================== 模型 ====================
ANALYSIS_MODEL=gemini-3-pro-preview
GENERATE_MODEL=gemini-3-pro-image-preview

# ==================== 评审 ====================
REVIEW_PASS_THRESHOLD=80
PHOTO_APPROVAL_THRESHOLD=80

# ==================== 功能 ====================
ENABLE_ANALYZE=true
ENABLE_GENERATE=true
ENABLE_REVIEW=true

# ==================== 速率限制 ====================
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW=60000
```

---

## 快速参考卡

```
┌────────────────────────────────────────────────────────────┐
│                    常用配置速查                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  更改邀请码：                                               │
│  INVITE_CODES=NEWCODE1,NEWCODE2                            │
│  INVITE_CODE_MAX_USES=50,100                               │
│                                                             │
│  提高评审标准：                                              │
│  REVIEW_PASS_THRESHOLD=85                                  │
│  PHOTO_APPROVAL_THRESHOLD=85                               │
│                                                             │
│  关闭专家评审：                                              │
│  ENABLE_REVIEW=false                                       │
│                                                             │
│  更改API模型：                                               │
│  ANALYSIS_MODEL=gemini-2.0-flash                          │
│  GENERATE_MODEL=gemini-2.0-flash-exp                      │
│                                                             │
│  严格速率限制：                                              │
│  ENABLE_RATE_LIMIT=true                                    │
│  RATE_LIMIT_REQUESTS=5                                      │
│  RATE_LIMIT_WINDOW=60000                                    │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 配置验证

### 部署前检查

```bash
# 检查环境变量是否设置
echo $GEMINI_API_KEY

# 应该显示你的 API Key
```

### 部署后验证

在浏览器中访问你的应用，检查控制台是否有配置错误。

---

## 注意事项

1. **环境变量修改后必须重新部署**
2. **敏感信息（如 API Key）只在服务端可见**
3. **邀请码使用次数在 Functions 重启后会重置**
4. **速率限制是内存中的，Cloudflare Functions 可能会随时重启**
