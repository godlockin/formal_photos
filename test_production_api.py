#!/usr/bin/env python3
"""
生产环境 API 测试脚本 - 诊断 "Failed to fetch" 问题
"""

import os
import sys
import json
import base64
import time
import requests
from pathlib import Path

# 配置
PRODUCTION_URL = os.getenv("PRODUCTION_URL", "https://your-domain.pages.dev")
API_ENDPOINT = f"{PRODUCTION_URL}/api/gemini"
INVITE_CODE = os.getenv("INVITE_CODE", "PHOTO2026")
TEST_IMAGE_PATH = sys.argv[1] if len(sys.argv) > 1 else "test_image.jpg"

def log(msg, icon="ℹ️"):
    print(f"{icon} {msg}")

def encode_image_to_base64(image_path: str) -> str:
    """将图片编码为 base64 data URL"""
    with open(image_path, "rb") as f:
        data = f.read()
    mime = "image/jpeg" if image_path.lower().endswith(".jpg") or image_path.lower().endswith(".jpeg") else "image/png"
    b64 = base64.b64encode(data).decode('utf-8')
    return f"data:{mime};base64,{b64}"

def test_api_with_timeout(endpoint: str, payload: dict, timeout: int = 300):
    """测试 API 调用，记录详细诊断信息"""
    headers = {
        "Content-Type": "application/json",
        "X-Timestamp": str(int(time.time() * 1000))
    }

    start_time = time.time()
    log(f"发送请求到 {endpoint}", "📤")
    log(f"Payload 大小: {len(json.dumps(payload)) / 1024:.1f} KB", "📊")

    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers=headers,
            timeout=timeout,
            stream=True  # 使用流式接收来调试大响应
        )
        elapsed = time.time() - start_time
        log(f"收到响应: HTTP {response.status_code}, 耗时: {elapsed:.1f}s", "📥")
        log(f"响应大小: {len(response.content) / 1024:.1f} KB", "📊")
        log(f"响应头: {dict(response.headers)}", "📋")

        # 尝试解析 JSON
        try:
            data = response.json()
            log(f"响应 JSON 解析成功", "✅")
            return data
        except json.JSONDecodeError as e:
            log(f"响应 JSON 解析失败: {e}", "❌")
            log(f"原始响应前 500 字符: {response.text[:500]}", "📝")
            return None

    except requests.exceptions.Timeout:
        log(f"请求超时 (>{timeout}s)", "⏱️")
        return None
    except requests.exceptions.ConnectionError as e:
        log(f"连接错误: {e}", "❌")
        return None
    except requests.exceptions.RequestException as e:
        log(f"请求异常: {e}", "❌")
        return None

def main():
    log("=" * 60, "🧪")
    log("生产环境 API 诊断测试", "🚀")
    log("=" * 60, "🧪")

    # 检查测试图片
    if not os.path.exists(TEST_IMAGE_PATH):
        log(f"测试图片不存在: {TEST_IMAGE_PATH}", "❌")
        log("使用方法: python test_production_api.py <图片路径>", "💡")
        sys.exit(1)

    # 编码图片
    log(f"加载测试图片: {TEST_IMAGE_PATH}", "🖼️")
    image_data = encode_image_to_base64(TEST_IMAGE_PATH)
    log(f"图片 Base64 大小: {len(image_data) / 1024:.1f} KB", "📊")

    # 测试 1: analyze 接口
    log("\n" + "=" * 60, "🧪")
    log("测试 1: analyze 接口", "1️⃣")
    log("=" * 60, "🧪")

    analyze_payload = {
        "code": INVITE_CODE,
        "action": "analyze",
        "image": image_data,
        "data": {}
    }

    result = test_api_with_timeout(API_ENDPOINT, analyze_payload, timeout=60)
    if result and "result" in result:
        log("analyze 接口测试通过", "✅")
        person = result["result"]
        log(f"分析结果: {person.get('gender', 'N/A')}, {person.get('age', 'N/A')}", "📋")
    else:
        log("analyze 接口测试失败", "❌")
        sys.exit(1)

    # 测试 2: processPose 接口（最耗时的操作）
    log("\n" + "=" * 60, "🧪")
    log("测试 2: processPose 接口 (完整生成流程)", "2️⃣")
    log("注意: 此接口可能需要 30-120 秒", "⏱️")
    log("=" * 60, "🧪")

    process_payload = {
        "code": INVITE_CODE,
        "action": "processPose",
        "image": None,
        "data": {
            "originalImage": image_data,
            "photoType": "正面头像",
            "person": person
        }
    }

    # 使用更长的超时时间
    result = test_api_with_timeout(API_ENDPOINT, process_payload, timeout=300)
    if result and "result" in result:
        log("processPose 接口测试通过", "✅")
        review = result["result"].get("review", {})
        log(f"生成评分: {review.get('overallScore', 'N/A')}", "📊")
        log(f"Prompt 迭代次数: {result['result'].get('promptIterations', 0)}", "📊")
        log(f"生成迭代次数: {result['result'].get('generationIterations', 0)}", "📊")
    else:
        log("processPose 接口测试失败", "❌")
        log("这是 'Failed to fetch' 最可能发生的地方", "💡")

    log("\n" + "=" * 60, "🧪")
    log("诊断完成", "🎉")
    log("=" * 60, "🧪")

if __name__ == "__main__":
    main()
