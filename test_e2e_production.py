#!/usr/bin/env python3
"""
生产环境端到端测试 - 验证异步轮询和图片压缩功能
使用方法: python test_e2e_production.py [production_url] [invite_code]
"""

import os
import sys
import json
import base64
import time
import requests
from pathlib import Path

# 配置
PRODUCTION_URL = sys.argv[1] if len(sys.argv) > 1 else os.getenv("PRODUCTION_URL", "https://formal-photos.pages.dev")
INVITE_CODE = sys.argv[2] if len(sys.argv) > 2 else os.getenv("INVITE_CODE", "AID1234")
API_ENDPOINT = f"{PRODUCTION_URL}/api/gemini"
TEST_IMAGE_PATH = sys.argv[3] if len(sys.argv) > 3 else None

def log(msg, icon="ℹ️"):
    print(f"{icon} {msg}")

def create_test_image():
    """创建一个简单的测试图片 (1x1 像素的红色 PNG)"""
    # 最简单的 PNG 图片 (Base64 编码的 1x1 红色像素)
    png_data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
    return f"data:image/png;base64,{png_data}"

def test_api(endpoint, payload, timeout=30):
    """测试 API 调用"""
    headers = {
        "Content-Type": "application/json",
        "X-Timestamp": str(int(time.time() * 1000))
    }

    try:
        response = requests.post(endpoint, json=payload, headers=headers, timeout=timeout)
        if response.status_code != 200:
            log(f"HTTP {response.status_code}: {response.text[:200]}", "❌")
            return None
        return response.json()
    except requests.exceptions.Timeout:
        log(f"请求超时 (>{timeout}s)", "⏱️")
        return None
    except Exception as e:
        log(f"请求失败: {e}", "❌")
        return None

def test_analyze(image_data):
    """测试人脸分析接口"""
    log("\n测试 analyze 接口", "1️⃣")

    payload = {
        "code": INVITE_CODE,
        "action": "analyze",
        "image": image_data,
        "data": {}
    }

    result = test_api(API_ENDPOINT, payload, timeout=60)
    if result and "result" in result:
        log("analyze 接口测试通过", "✅")
        return result["result"]
    else:
        log("analyze 接口测试失败", "❌")
        return None

def test_submit_job(image_data, photo_type="正面头像", person=None):
    """测试提交异步任务"""
    log(f"\n测试 submitJob 接口 (姿势: {photo_type})", "2️⃣")

    payload = {
        "code": INVITE_CODE,
        "action": "submitJob",
        "data": {
            "action": "processPose",
            "data": {
                "originalImage": image_data,
                "photoType": photo_type,
                "person": person
            }
        }
    }

    result = test_api(API_ENDPOINT, payload, timeout=30)
    if result and "result" in result:
        job_id = result["result"].get("jobId")
        log(f"任务已提交: {job_id}", "✅")
        return job_id
    else:
        log("submitJob 接口测试失败", "❌")
        return None

def test_get_job_status(job_id):
    """测试获取任务状态"""
    payload = {
        "code": INVITE_CODE,
        "action": "getJobStatus",
        "data": { "jobId": job_id }
    }

    result = test_api(API_ENDPOINT, payload, timeout=30)
    if result and "result" in result:
        return result["result"]
    return None

def poll_job_until_complete(job_id, max_attempts=100, interval=3):
    """轮询任务直到完成"""
    log(f"\n轮询任务状态 (最多 {max_attempts} 次, 间隔 {interval}s)", "3️⃣")

    for attempt in range(max_attempts):
        status = test_get_job_status(job_id)
        if not status:
            log(f"第 {attempt + 1} 次查询失败", "⚠️")
            time.sleep(interval)
            continue

        current_status = status.get("status")
        log(f"第 {attempt + 1} 次查询: {current_status}")

        if current_status == "completed":
            log("任务完成!", "✅")
            return status.get("result")

        if current_status == "failed":
            error = status.get("error", "Unknown error")
            log(f"任务失败: {error}", "❌")
            return None

        time.sleep(interval)

    log("轮询超时", "⏱️")
    return None

def main():
    log("=" * 60, "🧪")
    log("生产环境端到端测试", "🚀")
    log("=" * 60, "🧪")
    log(f"测试地址: {PRODUCTION_URL}")
    log(f"邀请码: {INVITE_CODE}")

    # 准备测试图片
    if TEST_IMAGE_PATH and os.path.exists(TEST_IMAGE_PATH):
        log(f"\n使用测试图片: {TEST_IMAGE_PATH}", "🖼️")
        with open(TEST_IMAGE_PATH, "rb") as f:
            mime = "image/jpeg" if TEST_IMAGE_PATH.lower().endswith((".jpg", ".jpeg")) else "image/png"
            image_data = f"data:{mime};base64,{base64.b64encode(f.read()).decode()}"
    else:
        log("\n使用内置测试图片", "🖼️")
        image_data = create_test_image()

    # 测试 1: 分析图片
    person = test_analyze(image_data)
    if not person:
        log("\n测试中止：analyze 接口失败", "❌")
        sys.exit(1)

    log(f"\n分析结果: {person.get('gender', 'N/A')}, {person.get('age', 'N/A')}", "📋")

    # 测试 2: 提交异步任务 (只测试一个姿势)
    job_id = test_submit_job(image_data, "正面头像", person)
    if not job_id:
        log("\n测试中止：submitJob 接口失败", "❌")
        sys.exit(1)

    # 测试 3: 轮询任务状态
    result = poll_job_until_complete(job_id, max_attempts=60, interval=3)

    if result:
        log("\n" + "=" * 60, "🎉")
        log("测试成功！", "✅")
        log("=" * 60, "🎉")
        log(f"\n生成结果:")
        log(f"  - Prompt 迭代次数: {result.get('promptIterations', 0)}")
        log(f"  - 生成迭代次数: {result.get('generationIterations', 0)}")
        review = result.get('review', {})
        log(f"  - 评分: {review.get('overallScore', 'N/A')}")
        log(f"  - 状态: {'通过' if review.get('approved') else '需优化'}")

        # 保存生成的图片
        image_data_result = result.get('image', '')
        if image_data_result:
            output_file = "test_output.jpg"
            if image_data_result.startswith('data:'):
                image_data_result = image_data_result.split(',')[1]
            with open(output_file, "wb") as f:
                f.write(base64.b64decode(image_data_result))
            log(f"\n生成图片已保存: {output_file}", "💾")

        return 0
    else:
        log("\n" + "=" * 60, "❌")
        log("测试失败", "❌")
        log("=" * 60, "❌")
        return 1

if __name__ == "__main__":
    sys.exit(main())
