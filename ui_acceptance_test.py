#!/usr/bin/env python3
"""
UI 端到端验收测试
测试完整的工作流程：邀请码 -> 上传 -> 处理 -> 结果
"""

import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, expect
except ImportError:
    print("Installing Playwright...")
    os.system("pip install playwright -q")
    os.system("playwright install chromium -q")
    from playwright.sync_api import sync_playwright, expect

# 配置
IMAGE_DIR = "sys_init"
OUTPUT_DIR = "output"
BASE_URL = "http://localhost:3000"
INVITE_CODE = "PHOTO2026"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def log(msg, icon="ℹ️"):
    print(f"{icon} {msg}")

def _collect_test_images():
    supported_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"}
    image_dir = Path(IMAGE_DIR)
    if not image_dir.exists():
        raise FileNotFoundError(f"图片目录不存在: {IMAGE_DIR}")
    images = [p for p in image_dir.iterdir() if p.is_file() and p.suffix.lower() in supported_exts]
    if not images:
        raise FileNotFoundError(f"目录中没有可用图片: {IMAGE_DIR}")
    return sorted(images)

def _safe_name(path: Path, index: int) -> str:
    import re
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", path.stem).strip("_")
    return f"{index:02d}_{base or 'image'}"

def run_ui_test(test_image: Path, output_dir: Path):
    """运行完整UI测试"""
    log("=" * 60, "🧪")
    log("开始 UI 端到端验收测试", "🚀")
    log("=" * 60, "🧪")
    log(f"测试图片: {test_image}", "🖼️")
    
    results = {
        "start_time": str(datetime.now()),
        "steps": [],
        "success": False,
        "screenshots": []
    }
    
    with sync_playwright() as p:
        # 启动浏览器（非无头模式便于观察）
        browser = p.chromium.launch(headless=False, slow_mo=300)
        context = browser.new_context(
            viewport={"width": 1400, "height": 900},
            record_video_dir=str(output_dir / "videos")
        )
        page = context.new_page()
        
        try:
            # Step 1: 访问首页
            log("\n步骤 1: 访问应用首页", "1️⃣")
            page.goto(BASE_URL, wait_until="networkidle")
            page.wait_for_timeout(1000)
            page.screenshot(path=str(output_dir / "01_homepage.png"))
            results["screenshots"].append("01_homepage.png")
            
            # 验证首页元素
            assert page.locator("label:has-text('邀请码')").is_visible()
            assert page.locator("input[placeholder='输入邀请码']").is_visible()
            log("✓ 首页加载成功", "✅")
            results["steps"].append({"name": "访问首页", "status": "passed"})
            
            # Step 2: 输入邀请码
            log("\n步骤 2: 输入邀请码", "2️⃣")
            page.locator("input[placeholder='输入邀请码']").fill(INVITE_CODE)
            page.screenshot(path=str(output_dir / "02_invite_code.png"))
            results["screenshots"].append("02_invite_code.png")
            
            page.locator("button:has-text('开始使用')").click()
            page.wait_for_load_state("networkidle")
            log("✓ 邀请码输入成功", "✅")
            results["steps"].append({"name": "输入邀请码", "status": "passed"})
            
            # Step 3: 同意协议
            log("\n步骤 3: 同意使用协议", "3️⃣")
            page.wait_for_selector("text=使用协议", timeout=5000)
            page.screenshot(path=str(output_dir / "03_consent.png"))
            results["screenshots"].append("03_consent.png")
            
            page.locator("input[type='checkbox']").check()
            page.screenshot(path=str(output_dir / "04_consent_checked.png"))
            results["screenshots"].append("04_consent_checked.png")
            
            page.locator("button:has-text('同意并继续')").click()
            page.wait_for_load_state("networkidle")
            log("✓ 协议已同意", "✅")
            results["steps"].append({"name": "同意协议", "status": "passed"})
            
            # Step 4: 上传照片
            log("\n步骤 4: 上传测试照片", "4️⃣")
            page.wait_for_selector("text=上传照片", timeout=5000)
            page.screenshot(path=str(output_dir / "05_upload.png"))
            results["screenshots"].append("05_upload.png")
            
            # 上传文件
            input_file = page.locator("input[type='file']")
            input_file.set_input_files(str(test_image.resolve()))
            
            log(f"   上传文件: {test_image}", "📤")
            page.wait_for_timeout(3000)
            page.screenshot(path=str(output_dir / "06_uploaded.png"))
            results["screenshots"].append("06_uploaded.png")
            log("✓ 照片上传成功", "✅")
            results["steps"].append({"name": "上传照片", "status": "passed"})
            
            # Step 5: 等待AI处理
            log("\n步骤 5: 等待AI处理完成", "5️⃣")
            log("   处理中，请稍候...", "⏳")
            
            # 等待处理页面出现
            page.wait_for_selector("text=AI 正在处理", timeout=10000)
            
            # 等待处理完成（最长10分钟）
            max_wait = 600  # 10分钟
            for i in range(max_wait):
                try:
                    # 检查是否完成
                    if page.locator("text=专业形象照已完成").is_visible(timeout=1000):
                        log("✓ AI处理完成", "✅")
                        break
                except:
                    pass
                
                # 每10秒截图
                if i % 10 == 0:
                    try:
                        page.screenshot(path=str(output_dir / f"processing_{i//10:02d}.png"))
                    except:
                        pass
                    # 获取进度
                    try:
                        progress = page.locator("text=/[0-9]+%/").text_content(timeout=500)
                        log(f"   处理进度: {progress}", "📊")
                    except:
                        pass
                
                page.wait_for_timeout(1000)
            else:
                raise TimeoutError("AI处理超时（超过10分钟）")
            
            page.screenshot(path=str(output_dir / "07_result.png"))
            results["screenshots"].append("07_result.png")
            results["steps"].append({"name": "AI处理", "status": "passed"})
            
            # Step 6: 验证结果
            log("\n步骤 6: 验证生成结果", "6️⃣")
            
            # 获取所有生成的照片
            photos = page.locator("img[alt]").all()
            log(f"✓ 找到 {len(photos)} 张照片", "📸")
            
            # 验证照片类型
            expected_types = ["正面头像", "侧面头像", "肖像照", "半身照", "全身照"]
            found_types = []
            
            for i, photo in enumerate(photos):
                alt_text = photo.get_attribute("alt")
                found_types.append(alt_text)
                log(f"   照片 {i+1}: {alt_text}", "📷")
            
            # 检查是否包含所有期望的类型
            coverage = len([t for t in expected_types if t in found_types])
            log(f"✓ 姿势覆盖: {coverage}/{len(expected_types)}", "✅" if coverage == len(expected_types) else "⚠️")
            
            results["steps"].append({
                "name": "验证结果",
                "status": "passed",
                "photos_count": len(photos),
                "coverage": f"{coverage}/{len(expected_types)}"
            })
            
            # Step 7: 下载照片
            log("\n步骤 7: 测试下载功能", "7️⃣")
            
            # 点击第一个下载按钮
            with page.expect_download() as download_info:
                page.locator("button:has-text('下载')").first.click()
            
            download = download_info.value
            download_path = output_dir / f"downloaded_{download.suggested_filename}"
            download.save_as(download_path)
            
            log(f"✓ 照片已下载: {download_path}", "✅")
            results["steps"].append({"name": "下载照片", "status": "passed"})
            
            # 成功完成
            results["success"] = True
            results["end_time"] = str(datetime.now())
            
            browser.close()
            
        except Exception as e:
            log(f"❌ 测试失败: {e}", "❌")
            results["error"] = str(e)
            results["end_time"] = str(datetime.now())
            
            try:
                page.screenshot(path=str(output_dir / "error_screenshot.png"))
                results["screenshots"].append("error_screenshot.png")
            except:
                pass
            
            browser.close()
            return False
    
    # 生成测试报告
    report_path = output_dir / "ui_test_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # 打印总结
    print("\n" + "=" * 60)
    log("UI 端到端测试完成！", "🎉")
    print("=" * 60)
    print(f"\n测试状态: {'✅ 通过' if results['success'] else '❌ 失败'}")
    print(f"完成步骤: {len(results['steps'])}/7")
    print(f"生成照片: {results['steps'][-2]['photos_count'] if len(results['steps']) > 1 else 0} 张")
    print(f"姿势覆盖: {results['steps'][-2].get('coverage', 'N/A')}")
    print(f"\n截图文件:")
    for s in results["screenshots"]:
        print(f"  📸 {output_dir}/{s}")
    print(f"\n测试报告: {report_path}")
    print("=" * 60 + "\n")
    
    return results["success"]

if __name__ == "__main__":
    images = _collect_test_images()
    all_success = True
    for idx, image_path in enumerate(images, start=1):
        run_dir = Path(OUTPUT_DIR) / _safe_name(image_path, idx)
        run_dir.mkdir(parents=True, exist_ok=True)
        success = run_ui_test(image_path, run_dir)
        all_success = all_success and success
    sys.exit(0 if all_success else 1)
