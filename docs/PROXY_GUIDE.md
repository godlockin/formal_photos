# 美国出口 IP 配置指南

> Cloudflare Pages 本身无法控制出口 IP，需要通过美国 VPS 反向代理实现

## 方案：DigitalOcean 美国 VPS + 反向代理

### 1. 购买美国 VPS

**推荐服务商**（选择美国地区）：

| 服务商 | 最低配置 | 价格 | 购买链接 |
|--------|----------|------|----------|
| DigitalOcean | 1 vCPU / 1GB | $6/月 | https://digitalocean.com |
| Linode | 1 vCPU / 2GB | $10/月 | https://linode.com |
| AWS Lightsail | 1 vCPU / 512MB | $3.50/月 | https://aws.amazon.com/lightsail |
| Vultr | 1 vCPU / 1GB | $5/月 | https://vultr.com |

**选择地区**：New York / San Francisco / Los Angeles

---

### 2. 安装 Nginx + Certbot

```bash
# 连接 VPS
ssh root@your-vps-ip

# 安装 Nginx
apt update
apt install nginx certbot python3-certbot-nginx -y

# 启动 Nginx
systemctl start nginx
systemctl enable nginx
```

---

### 3. 配置反向代理

```bash
# 创建配置文件
cat > /etc/nginx/sites-available/gemini-proxy << 'EOF'
server {
    listen 443 ssl http2;
    server_name your-proxy-domain.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/your-proxy-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-proxy-domain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # 添加 Header 隐藏代理
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # 代理设置
    location / {
        # Gemini API 端点
        proxy_pass https://generativelanguage.googleapis.com;
        proxy_http_version 1.1;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
        proxy_request_buffering off;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # SSL
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
    }
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/gemini-proxy /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载
systemctl reload nginx
```

---

### 4. 申请 SSL 证书

```bash
# 使用 Certbot 自动申请
certbot --nginx -d your-proxy-domain.com

# 按提示输入邮箱和同意条款
# 证书会自动续期
```

---

### 5. 配置 Cloudflare Pages

在 `.env` 文件中设置：

```bash
# 原来直接调用（IP不固定）
# 不需要配置

# 使用美国代理（IP固定为美国）
PROXY_URL=https://your-proxy-domain.com
```

---

### 6. 验证出口 IP

在 VPS 上运行：

```bash
# 验证 IP
curl ifconfig.me
# 应该显示美国 IP

# 测试代理
curl -I https://your-proxy-domain.com
```

---

## 完整架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                          用户网络                               │
│                                                                 │
│   浏览器                    Cloudflare Pages                      │
│     │                          │                                 │
│     │  请求                    │  安全调用                        │
│     ├─────────────────────────>│                                 │
│     │                          ├─────────────────────────┐       │
│     │                          │   Cloudflare Functions │       │
│     │                          │       (无敏感信息)     │       │
│     │                          └─────────────────────────┘       │
│     │                                    │                        │
│     │                          美国代理 URL                       │
│     │                                  │                        │
└─────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │   美国 VPS      │
                              │  (出口IP固定)   │
                              │                 │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ Gemini API      │
                              │ (需要美国IP)    │
                              └─────────────────┘
```

---

## 成本估算

| 项目 | 费用 |
|------|------|
| Cloudflare Pages | 免费 |
| 美国 VPS | $5-10/月 |
| 域名 | $12/年 |
| **总计** | **≈ $72/年** |

---

## 备选方案

### 方案 B：Cloudflare Workers + WARP（复杂）

```javascript
// Cloudflare Workers
export default {
  async fetch(request, env) {
    // 使用 WARP 实现美国出口
    // 需要额外配置，成本较高
    // 不推荐
  }
};
```

**推荐使用方案 A（美国 VPS）**，更简单、更稳定。

---

## 一键部署脚本

```bash
#!/bin/bash
# deploy-proxy.sh

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
    echo "请使用 root 权限运行"
    exit
fi

echo "开始部署美国反向代理..."

# 安装 Nginx
apt update
apt install nginx certbot python3-certbot-nginx -y

# 创建配置
read -p "输入你的域名: " DOMAIN

cat > /etc/nginx/sites-available/gemini-proxy << EOF
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    
    location / {
        proxy_pass https://generativelanguage.googleapis.com;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
    }
}
EOF

ln -s /etc/nginx/sites-available/gemini-proxy /etc/nginx/sites-enabled/
nginx -t

echo "配置完成！"
echo "下一步："
echo "1. 配置域名 DNS 指向此服务器"
echo "2. 运行: certbot --nginx -d $DOMAIN"
echo "3. 在 Cloudflare Pages 设置 PROXY_URL=https://$DOMAIN"
```

---

## 快速检查

```bash
# 1. 验证 VPS IP 是美国
curl ifconfig.me

# 2. 验证代理工作
curl -I https://your-proxy-domain.com

# 3. 验证 Cloudflare Pages 环境变量
# 在 Cloudflare Dashboard 设置 PROXY_URL
```
