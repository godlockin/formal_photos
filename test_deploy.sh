#!/bin/bash

echo "🔍 部署前检查..."
echo ""

# 1. 检查必需文件
echo "1️⃣ 检查必需文件..."
if [ -f "functions/api/gemini.ts" ]; then
    echo "✅ functions/api/gemini.ts 存在"
else
    echo "❌ functions/api/gemini.ts 不存在"
    exit 1
fi

if [ -f "functions/api/[[path]].ts" ]; then
    echo "✅ functions/api/[[path]].ts 存在"
else
    echo "❌ functions/api/[[path]].ts 不存在"
    exit 1
fi

# 2. 检查是否可以构建
echo ""
echo "2️⃣ 检查构建..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ 构建成功"
else
    echo "❌ 构建失败"
    exit 1
fi

# 3. 检查dist目录
echo ""
echo "3️⃣ 检查构建输出..."
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "✅ dist/ 目录正确生成"
else
    echo "❌ dist/ 目录生成失败"
    exit 1
fi

echo ""
echo "✅ 所有检查通过！可以部署。"
echo ""
echo "下一步："
echo "1. npx wrangler pages deploy dist --project-name=formal-photos"
echo "2. npx wrangler pages secret put GEMINI_API_KEY"
echo ""
