#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/crawl_study4.py
=======================
Authenticated Study4 TOEIC Auto-Queue Crawler & Builder for TOEIC Mastery Hub.

Supports:
  1) Manual login & local profile save:
     python scripts/crawl_study4.py --login

  2) Automated incremental ETS 2021-2026 queue crawl (live commit, 48k audio,
     image compression, lockfile, safe-stop, progress log):
     python scripts/crawl_study4.py --auto-ets-2021-2026 --per-year 5
     python scripts/crawl_study4.py --auto-ets-2021-2026 --resume
     python scripts/crawl_study4.py --auto-ets-2021-2026 --discover-only
     python scripts/crawl_study4.py --auto-ets-2021-2026 --resume --limit 2

  3) Direct URL / max-tests crawl:
     python scripts/crawl_study4.py --urls https://study4.com/tests/6853/...
     python scripts/crawl_study4.py --max-tests 3
"""

import argparse
import asyncio
import concurrent.futures
import json
import os
import random
import re
import ssl
import subprocess
import sys
import tempfile
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass

import aiohttp
import edge_tts
import edge_tts.communicate as edge_tts_comm
from bs4 import BeautifulSoup
from PIL import Image
from playwright.sync_api import BrowserContext, Page, sync_playwright
from pydub import AudioSegment

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from auto_crawl_toeic import (  # noqa: E402
    AUDIO_BASE_DIR,
    CACHE_DIR,
    EDGE_VOICES,
    FFMPEG_BIN,
    IMAGES_BASE_DIR,
    ROOT,
    TESTS_DIR,
    TOEIC_DATA_DIR,
    BatchViTranslator,
    CrawlSession,
    build_reading_explanation_5layer,
    classify_part5_topic,
    clean_html_text,
    detect_doc_genre,
    detect_p6_genre,
    detect_part2_type,
    detect_part34_qtype,
    detect_part7_qtype,
    detect_talk_type,
    distribute_timestamps,
    download_media_file,
    find_best_evidence_sentence,
    get_mp3_duration_ms,
    html_passage_to_bilingual_paragraphs,
    merge_meta_file,
    split_sentences,
    tokenize_sig,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

STUDY4_BASE = "https://study4.com"
STUDY4_LOGIN_URL = "https://study4.com/login/"
STUDY4_TOEIC_LIST_URL = "https://study4.com/tests/toeic/"
PROFILE_DIR = CACHE_DIR / "study4_profile"
RAW_CACHE_DIR = CACHE_DIR / "study4_raw"
QUEUE_PATH = CACHE_DIR / "ets_queue.json"
LOCK_PATH = CACHE_DIR / "crawler.lock"
LOG_PATH = CACHE_DIR / "crawl_progress.log"

PROFILE_DIR.mkdir(parents=True, exist_ok=True)
RAW_CACHE_DIR.mkdir(parents=True, exist_ok=True)


class SafeStopError(RuntimeError):
    """Raised on login expiry, HTTP 429, or Cloudflare/CAPTCHA block to halt immediately."""


# =============================================================================
# 1. LIVE PROGRESS LOGGER, LOCKFILE & DISK USAGE HELPERS
# =============================================================================
def log_msg(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    try:
        if sys.stdout is not None:
            print(line, flush=True)
    except Exception:
        pass
    try:
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
            f.flush()
    except Exception:
        pass


class _LogStderrTee:
    """Mirrors stderr lines directly into scripts/cache/crawl_progress.log."""
    def __init__(self, orig_stderr):
        self._orig = orig_stderr

    def write(self, data: str):
        if self._orig is not None:
            try:
                self._orig.write(data)
                self._orig.flush()
            except Exception:
                pass
        if data and data.strip():
            # Skip noisy harmless pydub ffmpeg lookup warning from polluting progress log
            if "Couldn't find ffmpeg or avconv" in data:
                return
            try:
                with LOG_PATH.open("a", encoding="utf-8") as f:
                    f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STDERR] {data.rstrip()}\n")
                    f.flush()
            except Exception:
                pass

    def flush(self):
        if self._orig is not None:
            try:
                self._orig.flush()
            except Exception:
                pass


def install_global_exception_logging():
    sys.stderr = _LogStderrTee(sys.stderr)

    def _excepthook(exc_type, exc_value, exc_tb):
        tb_str = "".join(traceback.format_exception(exc_type, exc_value, exc_tb))
        log_msg(f"[UNCAUGHT EXCEPTION]\n{tb_str}")

    sys.excepthook = _excepthook


def get_dir_size_mb(path: Path) -> float:
    total = 0
    if path.exists():
        for p in path.rglob("*"):
            if p.is_file():
                try:
                    total += p.stat().st_size
                except OSError:
                    pass
    return round(total / (1024 * 1024), 2)


def is_pid_running(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        try:
            proc = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=8,
            )
            return str(pid) in proc.stdout
        except Exception:
            return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def acquire_lock() -> bool:
    if LOCK_PATH.exists():
        try:
            info = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
            old_pid = int(info.get("pid", 0))
            if old_pid and old_pid != os.getpid() and is_pid_running(old_pid):
                log_msg(f"[LOCK] Đang có tiến trình crawler khác chạy (PID={old_pid}). Thoát để tránh xung đột profile Chrome.")
                return False
        except Exception:
            pass
    LOCK_PATH.write_text(
        json.dumps({"pid": os.getpid(), "started_at": datetime.now(timezone.utc).isoformat()}, indent=2),
        encoding="utf-8",
    )
    return True


def release_lock():
    try:
        if LOCK_PATH.exists():
            info = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
            if int(info.get("pid", 0)) == os.getpid():
                LOCK_PATH.unlink(missing_ok=True)
    except Exception:
        pass


# =============================================================================
# 2. PERSISTENT REAL CHROME CONTEXT & SAFE-STOP DETECTION
# =============================================================================
def launch_study4_browser(playwright, headless: bool = False, background_window: bool = False) -> BrowserContext:
    args = ["--disable-blink-features=AutomationControlled"]
    if background_window and not headless:
        # Keep real Chrome (avoids Cloudflare/headless detection) positioned cleanly off-screen
        args.append("--window-position=-32000,-32000")
        args.append("--window-size=1280,900")
    else:
        args.append("--start-maximized")

    launch_kwargs: Dict[str, Any] = {
        "user_data_dir": str(PROFILE_DIR),
        "headless": headless,
        "locale": "vi-VN",
        "args": args,
    }
    if not background_window:
        launch_kwargs["no_viewport"] = True
    else:
        launch_kwargs["viewport"] = {"width": 1280, "height": 900}

    try:
        ctx = playwright.chromium.launch_persistent_context(channel="chrome", **launch_kwargs)
        log_msg(f"[Browser] Đã mở Google Chrome thật (profile={PROFILE_DIR}, bg={background_window}, headless={headless})")
        return ctx
    except Exception as exc:
        log_msg(f"[Browser] Fallback sang Playwright Chromium ({exc})")
        return playwright.chromium.launch_persistent_context(**launch_kwargs)


def configure_page_guards(page: Page) -> Page:
    """Applies hard 30s/45s timeouts and auto-accepts JS confirmation dialogs."""
    page.set_default_timeout(30000)
    page.set_default_navigation_timeout(45000)
    page.on("dialog", lambda d: d.accept())
    return page


def reset_browser_tab(ctx: BrowserContext, old_page: Optional[Page]) -> Page:
    """Closes a stuck/errored tab and opens a fresh guarded tab."""
    new_page = configure_page_guards(ctx.new_page())
    if old_page is not None:
        try:
            old_page.close()
        except Exception:
            pass
    return new_page


def polite_delay(min_s: float = 2.0, max_s: float = 4.0):
    time.sleep(random.uniform(min_s, max_s))


def check_logged_in(page: Page) -> bool:
    try:
        html_low = page.content().lower()
        if "/login" in page.url.lower():
            return False
        return any(k in html_low for k in ['href="/logout/"', "/my-account/", "đăng xuất", "kết quả luyện thi"])
    except Exception:
        return False


def check_safe_stop(page: Page, status_code: Optional[int] = None, interactive: bool = False, context_label: str = ""):
    """
    Detects session expiry (/login/), HTTP 429 rate-limit, or Cloudflare/CAPTCHA block.
    In automated mode (interactive=False), raises SafeStopError IMMEDIATELY to protect account.
    """
    if status_code == 429:
        raise SafeStopError(f"HTTP 429 Too Many Requests tại {page.url} ({context_label})")
    if status_code == 403:
        raise SafeStopError(f"HTTP 403 Forbidden tại {page.url} ({context_label})")

    try:
        body_low = (page.content() or "").lower()
        url_low = page.url.lower()
    except Exception:
        return

    reason = None
    if "/login" in url_low or "/accounts/login" in url_low:
        reason = f"Hết phiên đăng nhập (redirect tới {page.url}) — hãy chạy lại `python scripts/crawl_study4.py --login`"
    elif any(k in body_low for k in ["cf-turnstile", "just a moment...", "attention required! | cloudflare", "verify you are human", "g-recaptcha"]):
        reason = f"Phát hiện Cloudflare / CAPTCHA tại {page.url} — dừng an toàn để bảo vệ tài khoản"
    elif "429 too many requests" in body_low:
        reason = f"Phát hiện giới hạn tốc độ 429 tại {page.url}"

    if reason:
        if interactive:
            print("\n" + "!" * 76)
            print(f"  [CẦN THAO TÁC THỦ CÔNG] {context_label}: {reason}")
            print("  Hãy tự xử lý trên cửa sổ Chrome đang mở rồi nhấn [Enter] tại đây.")
            print("!" * 76)
            input("  >>> Nhấn Enter sau khi hoàn tất: ")
            polite_delay(1.5, 2.5)
        else:
            raise SafeStopError(reason)


def run_login_mode():
    print("=" * 76)
    print("  STUDY4 MANUAL LOGIN — LƯU PHIÊN ĐĂNG NHẬP CỤC BỘ")
    print(f"  Profile: {PROFILE_DIR} (đã chặn bởi .gitignore)")
    print("=" * 76)
    with sync_playwright() as p:
        ctx = launch_study4_browser(p, headless=False, background_window=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(STUDY4_LOGIN_URL, wait_until="domcontentloaded", timeout=35000)
        print("\n>>> Hãy tự đăng nhập Study4 trên cửa sổ Chrome vừa mở, sau đó quay lại đây nhấn [Enter].\n")
        input("Nhấn [Enter] sau khi đã đăng nhập thành công trên Chrome... ")
        try:
            page.goto(STUDY4_TOEIC_LIST_URL, wait_until="domcontentloaded", timeout=25000)
            polite_delay(1.5, 2.5)
            cookies = ctx.cookies(STUDY4_BASE)
            if check_logged_in(page):
                print(f"[OK] Đã xác nhận phiên đăng nhập Study4 ({len(cookies)} cookies đã lưu)!")
            else:
                print(f"[LƯU Ý] Đã lưu {len(cookies)} cookies. Nếu khi cào báo chưa đăng nhập, hãy chạy lại --login.")
        finally:
            ctx.close()


# =============================================================================
# 3. AUTO-DISCOVERY & QUEUE MANAGEMENT (2021 -> 2026)
# =============================================================================
def slugify_test_id(url: str, title: str) -> str:
    m_id = re.search(r"/tests/(\d+)/([^/]+)", url)
    if m_id:
        slug = re.sub(r"[^a-z0-9]+", "-", m_id.group(2).lower()).strip("-")[:40]
        return f"study4-{m_id.group(1)}-{slug}"
    base = re.sub(r"[^a-z0-9]+", "-", (title or "study4-test").lower()).strip("-")[:40]
    return f"study4-{base}"


def infer_study4_year_and_testnum(url: str, title: str) -> Tuple[Optional[int], int]:
    """
    Maps Study4 New-Format TOEIC Full Test collections to years 2021..2026:
      - Explicit year in title/slug (2021..2026) -> exact year
      - Study4 renamed ETS collections:
          * sample-toeic-test-N         -> 2021 (New Format Core)
          * toeic-lr-collection-4-test-N -> 2022
          * toeic-lr-collection-3-test-N -> 2023
          * toeic-lr-collection-1-test-N -> 2024
          * toeic-lr-collection-2-test-N -> 2025
          * toeic-lr-collection-5-test-N -> 2026
      - Skips old-format-sample-toeic (returns year=None)
    """
    low = f"{url} {title}".lower()
    if "old-format" in low or "old format" in low:
        return None, 0

    m_tnum = re.search(r"test[\s\-]*(\d+)", low)
    tnum = int(m_tnum.group(1)) if m_tnum else 1

    m_yr = re.search(r"\b(202[1-6])\b", low)
    if m_yr:
        return int(m_yr.group(1)), tnum
    if "collection-5" in low or "collection 5" in low:
        return 2026, tnum
    if "collection-2" in low or "collection 2" in low:
        return 2025, tnum
    if "collection-1" in low or "collection 1" in low:
        return 2024, tnum
    if "collection-3" in low or "collection 3" in low:
        return 2023, tnum
    if "collection-4" in low or "collection 4" in low:
        return 2022, tnum
    if "sample-toeic" in low or "sample toeic" in low:
        return 2021, tnum
    return None, tnum


def discover_ets_2021_2026_queue(
    page: Page, per_year: int = 5, interactive: bool = False
) -> Dict[str, Any]:
    """
    Scans Study4 `/tests/toeic/?page=1..N`, filters New-Format Full Tests (2021-2026),
    sorts ascending by year (2021->2026) then testNumber (1->10), reconciles with
    `public/data/toeic/tests-meta.json` and any prior queue failures, and writes
    `scripts/cache/ets_queue.json`.
    """
    log_msg(f"[Discovery] Bắt đầu quét danh sách Full Test TOEIC (2021–2026, per_year={per_year}) trên Study4 ...")

    meta_path = TOEIC_DATA_DIR / "tests-meta.json"
    existing_ready_ids = set()
    if meta_path.exists():
        for m in json.loads(meta_path.read_text(encoding="utf-8")):
            if m.get("status") == "ready":
                existing_ready_ids.add(m["id"])

    prev_statuses: Dict[str, Dict[str, Any]] = {}
    if QUEUE_PATH.exists():
        try:
            old_q = json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
            for item in old_q.get("items", []):
                prev_statuses[item["test_id"]] = item
        except Exception:
            pass

    discovered: List[Dict[str, Any]] = []
    seen_urls = set()
    prev_page_urls = set()

    for pg in range(1, 10):
        url = f"{STUDY4_TOEIC_LIST_URL}?page={pg}"
        resp = page.goto(url, wait_until="domcontentloaded", timeout=30000)
        polite_delay(1.8, 2.8)
        check_safe_stop(page, resp.status if resp else None, interactive=interactive, context_label=f"Discovery page {pg}")

        soup = BeautifulSoup(page.content(), "lxml")
        cur_page_urls = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not re.match(r"^/tests/\d+/[^/]+/?$", href):
                continue
            full_url = urljoin(STUDY4_BASE, href)
            cur_page_urls.add(full_url)
            if full_url in seen_urls:
                continue
            seen_urls.add(full_url)
            raw_title = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
            # Trim trailing metadata like "120 phút | 691383..."
            clean_title = re.split(r"\s+\d+\s*phút|\s+7\s*phần thi", raw_title, maxsplit=1)[0].strip()
            yr, tnum = infer_study4_year_and_testnum(full_url, clean_title)
            if yr is None or not (2021 <= yr <= 2026):
                continue
            tid = slugify_test_id(full_url, clean_title)
            discovered.append({
                "test_id": tid,
                "url": full_url,
                "title": clean_title,
                "year": yr,
                "test_number": tnum,
            })

        if not cur_page_urls or cur_page_urls == prev_page_urls:
            break
        prev_page_urls = cur_page_urls

    # Group by year, sort test_number 1..10, apply per_year cap (0 = unlimited)
    by_year: Dict[int, List[Dict[str, Any]]] = {y: [] for y in range(2021, 2027)}
    for item in discovered:
        by_year[item["year"]].append(item)

    queue_items: List[Dict[str, Any]] = []
    year_summary: Dict[str, Dict[str, int]] = {}
    for yr in range(2021, 2027):
        yr_list = sorted(by_year[yr], key=lambda x: (x["test_number"], x["test_id"]))
        selected = yr_list if per_year <= 0 else yr_list[:per_year]
        done_c = 0
        pend_c = 0
        for it in selected:
            tid = it["test_id"]
            if tid in existing_ready_ids and (TESTS_DIR / f"{tid}.json").exists():
                status = "done"
                done_c += 1
            elif tid in prev_statuses and prev_statuses[tid].get("status") == "done" and (TESTS_DIR / f"{tid}.json").exists():
                status = "done"
                done_c += 1
            else:
                status = "pending"
                pend_c += 1
            queue_items.append({
                **it,
                "status": status,
                "error": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        year_summary[str(yr)] = {
            "found_on_study4": len(yr_list),
            "queued": len(selected),
            "done": done_c,
            "pending": pend_c,
        }

    queue_obj = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "per_year": per_year,
        "year_summary": year_summary,
        "items": queue_items,
    }
    QUEUE_PATH.write_text(json.dumps(queue_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    log_msg(f"[Discovery] Đã lưu hàng đợi vào {QUEUE_PATH}: tổng {len(queue_items)} đề ({sum(1 for x in queue_items if x['status']=='done')} done, {sum(1 for x in queue_items if x['status']=='pending')} pending).")
    for yr in range(2021, 2027):
        ys = year_summary[str(yr)]
        log_msg(f"   • ETS {yr}: tìm thấy {ys['found_on_study4']} đề trên Study4 | trong hàng đợi: {ys['queued']} (done={ys['done']}, pending={ys['pending']})")
    return queue_obj


def save_queue(queue_obj: Dict[str, Any]):
    # Refresh counts
    for yr in range(2021, 2027):
        yr_items = [x for x in queue_obj["items"] if x["year"] == yr]
        ys = queue_obj["year_summary"].setdefault(str(yr), {"found_on_study4": len(yr_items), "queued": len(yr_items), "done": 0, "pending": 0})
        ys["done"] = sum(1 for x in yr_items if x["status"] == "done")
        ys["pending"] = sum(1 for x in yr_items if x["status"] == "pending")
        ys["failed"] = sum(1 for x in yr_items if x["status"] == "failed")
    queue_obj["updated_at"] = datetime.now(timezone.utc).isoformat()
    QUEUE_PATH.write_text(json.dumps(queue_obj, ensure_ascii=False, indent=2), encoding="utf-8")


# =============================================================================
# 4. NAVIGATION TO STUDY4 `/details/` PAGE
# =============================================================================
def _dismiss_blocking_overlays(page: Page):
    """Closes random promotional/notification modals without touching test-confirmation."""
    try:
        page.evaluate(
            """() => {
                document.querySelectorAll('.modal.show:not(.test-confirmation) .close, .modal.show:not(.test-confirmation) [data-dismiss="modal"], .swal2-close').forEach(el => {
                    try { el.click(); } catch (e) {}
                });
            }"""
        )
    except Exception:
        pass


def _safe_scroll_and_click(page: Page, locator, label: str, retries: int = 2):
    """Dismisses overlays, scrolls target into view, and retries click up to `retries` times."""
    last_err = None
    for attempt in range(retries + 1):
        try:
            _dismiss_blocking_overlays(page)
            locator.wait_for(state="visible", timeout=15000)
            locator.scroll_into_view_if_needed(timeout=10000)
            time.sleep(0.35)
            locator.click(timeout=20000)
            return
        except Exception as exc:
            last_err = exc
            log_msg(f"  [Retry {attempt + 1}/{retries + 1}] Click '{label}' gặp lỗi ({str(exc).splitlines()[0][:120]}), thử lại ...")
            _dismiss_blocking_overlays(page)
            time.sleep(1.2)
            if attempt == retries:
                try:
                    locator.click(force=True, timeout=15000)
                    return
                except Exception as exc2:
                    last_err = exc2
    raise last_err


def _run_full_test_submit_flow(page: Page, intro_url: str, interactive: bool = False):
    """Starts a fresh Full Test (all 7 Parts) from `intro_url`, submits it, and waits for `/details` link."""
    if page.url.rstrip("/") != intro_url.rstrip("/"):
        r0 = page.goto(intro_url, wait_until="domcontentloaded", timeout=45000)
        polite_delay(2.0, 3.2)
        check_safe_stop(page, r0.status if r0 else None, interactive=interactive, context_label="Quay lại trang đề thi")

    log_msg("  -> Chọn 'Làm full test' (đủ 7 Part) → 'BẮT ĐẦU THI' → 'NỘP BÀI' ...")
    _dismiss_blocking_overlays(page)

    ft = page.locator('a[href="#nav-taketest"]').first
    if ft.count() > 0:
        _safe_scroll_and_click(page, ft, "Tab Làm full test", retries=2)
        time.sleep(0.8)

    sb = page.locator('#nav-taketest button[type="submit"], form[action*="/start"] button[type="submit"]').first
    if sb.count() == 0:
        log_msg("  -> Không thấy tab Full Test, chuyển sang tab 'Luyện tập' và tích chọn đủ 7 Part ...")
        prac_tab = page.locator('a[href="#nav-practice"], a:has-text("Luyện tập")').first
        if prac_tab.count() > 0:
            _safe_scroll_and_click(page, prac_tab, "Tab Luyện tập", retries=2)
            time.sleep(0.8)
        for cb in page.locator('#nav-practice input[type="checkbox"][name="part"]').all():
            try:
                if not cb.is_checked():
                    cb.check(force=True)
            except Exception:
                pass
        sb = page.locator('#nav-practice button[type="submit"], button:has-text("LUYỆN TẬP")').first
    if sb.count() == 0:
        raise RuntimeError(f"Không tìm thấy nút BẮT ĐẦU THI / LUYỆN TẬP trên {page.url}")

    log_msg("  -> Bấm BẮT ĐẦU THI ...")
    _safe_scroll_and_click(page, sb, "BẮT ĐẦU THI", retries=2)
    page.wait_for_load_state("domcontentloaded", timeout=45000)
    polite_delay(2.2, 3.6)
    check_safe_stop(page, None, interactive=interactive, context_label="Vào phòng thi Study4")

    # Verify we actually entered the test page (#submit-test present); retry form submit once if still on intro
    if page.locator("#submit-test").count() == 0:
        log_msg("  -> Chưa thấy #submit-test sau khi bấm BẮT ĐẦU THI, thử submit form trực tiếp ...")
        page.evaluate(
            """() => {
                const f = document.querySelector('#nav-taketest form, form[action*="/start"]');
                if (f) f.submit();
            }"""
        )
        page.wait_for_load_state("domcontentloaded", timeout=45000)
        polite_delay(2.2, 3.5)
        check_safe_stop(page, None, interactive=interactive, context_label="Vào phòng thi Study4 (retry)")

    # Tick Q1 option A so Study4 never rejects an all-blank submission
    r1 = page.locator('input[type="radio"][data-type="question-answer"]').first
    if r1.count() > 0:
        try:
            r1.scroll_into_view_if_needed(timeout=8000)
            r1.check(force=True)
            time.sleep(0.4)
        except Exception:
            pass

    log_msg("  -> Bấm NỘP BÀI và xác nhận modal ...")
    submit_btn = page.locator("#submit-test").first
    _safe_scroll_and_click(page, submit_btn, "NỘP BÀI (#submit-test)", retries=2)
    time.sleep(1.2)
    dlg_btn = page.locator('dialog.test-confirmation[open] button.btn-primary, dialog.test-confirmation button:has-text("Nộp bài")').first
    if dlg_btn.count() > 0:
        _safe_scroll_and_click(page, dlg_btn, "Xác nhận Nộp bài", retries=2)
    else:
        page.evaluate("() => { const f = document.querySelector('form.test-form'); if (f) f.submit(); }")

    log_msg("  -> Chờ trang kết quả hiển thị nút Xem chi tiết đáp án ...")
    page.wait_for_selector('a[href*="/details"]', timeout=45000)
    polite_delay(2.0, 3.2)
    check_safe_stop(page, None, interactive=interactive, context_label="Sau khi nộp bài")


def navigate_to_details_page(page: Page, url: str, interactive: bool = False) -> Tuple[str, str]:
    log_msg(f"[Navigate] Mở URL: {url}")
    resp = page.goto(url, wait_until="domcontentloaded", timeout=45000)
    polite_delay(2.0, 3.5)
    check_safe_stop(page, resp.status if resp else None, interactive=interactive, context_label=f"Mở đề {url}")
    _dismiss_blocking_overlays(page)

    title = ""
    try:
        h1 = page.locator("h1").first
        if h1.count() > 0:
            title = re.sub(r"\s+", " ", h1.inner_text().strip())
    except Exception:
        pass

    if "/details" in page.url:
        return page.url, title

    used_history = False
    soup0 = BeautifulSoup(page.content(), "lxml")
    res_hrefs = [a["href"] for a in soup0.find_all("a", href=True) if "/results/" in a["href"]]
    if res_hrefs:
        chosen = next((h for h in res_hrefs if "/details" in h), res_hrefs[0])
        target = urljoin(STUDY4_BASE, chosen)
        log_msg(f"  -> Dùng sẵn lịch sử bài làm: {target}")
        polite_delay(2.0, 3.2)
        r2 = page.goto(target, wait_until="domcontentloaded", timeout=45000)
        polite_delay(2.0, 3.5)
        check_safe_stop(page, r2.status if r2 else None, interactive=interactive, context_label="Mở lịch sử bài làm")
        used_history = True
    else:
        _run_full_test_submit_flow(page, url, interactive=interactive)

    # Open `/details/`
    if "/details" not in page.url:
        det_a = page.locator('a[href*="/details"]').first
        if det_a.count() == 0:
            raise RuntimeError(f"Không tìm thấy nút Xem chi tiết đáp án trên {page.url}")
        det_url = urljoin(STUDY4_BASE, det_a.get_attribute("href"))
        log_msg(f"  -> Mở trang Xem chi tiết đáp án: {det_url}")
        r3 = page.goto(det_url, wait_until="domcontentloaded", timeout=45000)
        polite_delay(2.5, 4.0)
        check_safe_stop(page, r3.status if r3 else None, interactive=interactive, context_label="Trang chi tiết đáp án")

    # Guard against partial (1-Part / Practice) history results: if panes < 7, auto-run Full Test!
    pane_count = len(BeautifulSoup(page.content(), "lxml").select('[id^="partcontent-"]'))
    if pane_count < 7 and used_history:
        log_msg(f"  -> [Partial History] Lịch sử cũ chỉ có {pane_count}/7 Part (luyện tập lẻ). Quay lại trang đề thi để nộp Full Test đủ 7 Part ...")
        _run_full_test_submit_flow(page, url, interactive=interactive)
        det_a = page.locator('a[href*="/details"]').first
        if det_a.count() == 0:
            raise RuntimeError(f"Không tìm thấy nút Xem chi tiết đáp án sau khi nộp Full Test trên {page.url}")
        det_url = urljoin(STUDY4_BASE, det_a.get_attribute("href"))
        log_msg(f"  -> Mở trang Xem chi tiết đáp án Full 7 Part: {det_url}")
        r4 = page.goto(det_url, wait_until="domcontentloaded", timeout=45000)
        polite_delay(2.5, 4.0)
        check_safe_stop(page, r4.status if r4 else None, interactive=interactive, context_label="Trang chi tiết Full 7 Part")

    return page.url, title


# =============================================================================
# 5. EXACT STUDY4 `/details/` PARSER (ALL 7 PARTS + TRANSCRIPTS + EXPLANATIONS)
# =============================================================================
def _parse_dich_nghia_block(raw_text: str) -> Dict[str, Any]:
    txt = (raw_text or "").replace("\r\n", "\n").strip()
    out: Dict[str, Any] = {
        "question_vi": "",
        "options_vi": {},
        "explanation_vi": "",
        "evidence_quote": "",
        "raw": txt,
    }
    if not txt:
        return out

    m_ev = re.search(r"Vị trí đáp án\s*:\s*(.+)$", txt, re.S | re.I)
    if m_ev:
        out["evidence_quote"] = re.sub(r"\s+", " ", m_ev.group(1)).strip()
        txt_no_ev = txt[:m_ev.start()].strip()
    else:
        txt_no_ev = txt

    m_gt = re.search(r"Giải thích\s*:\s*(.+)$", txt_no_ev, re.S | re.I)
    if m_gt:
        out["explanation_vi"] = re.sub(r"\s+", " ", m_gt.group(1)).strip()
        txt_dich = txt_no_ev[:m_gt.start()].strip()
    else:
        txt_dich = txt_no_ev

    txt_dich = re.sub(r"^Dịch nghĩa\s*:\s*", "", txt_dich, flags=re.I).strip()
    lines = [ln.strip() for ln in txt_dich.splitlines() if ln.strip()]
    q_lines = []
    for ln in lines:
        mo = re.match(r"^\(?([A-D])\)?[.)]\s*(.+)$", ln)
        if mo:
            out["options_vi"][mo.group(1).upper()] = mo.group(2).strip()
        else:
            q_lines.append(ln)
    if q_lines:
        out["question_vi"] = " ".join(q_lines).strip()
    return out


def _extract_q_answer(qwrapper) -> str:
    m_ans = re.search(r"Đáp án đúng\s*:\s*([A-D])\b", qwrapper.get_text(" ", strip=True), re.I)
    if m_ans:
        return m_ans.group(1).upper()
    inp = qwrapper.select_one("input.form-check-input.correct")
    if inp and inp.get("value"):
        val = inp.get("value").strip().upper()
        if val in ("A", "B", "C", "D"):
            return val
    return "A"


def _extract_item_question(item_wrapper) -> Optional[Dict[str, Any]]:
    qw = item_wrapper.select_one(".question-wrapper")
    if not qw:
        return None
    num_el = qw.select_one(".question-number strong, .question-number")
    m_n = re.search(r"\b(\d{1,3})\b", num_el.get_text(" ", strip=True) if num_el else "")
    if not m_n:
        return None
    qnum = int(m_n.group(1))

    qtxt_el = qw.select_one(".question-text")
    q_text = re.sub(r"\s+", " ", qtxt_el.get_text(" ", strip=True)) if qtxt_el else ""

    opts: Dict[str, str] = {}
    for fc in qw.select(".question-answers .form-check"):
        lbl = fc.select_one("label")
        if not lbl:
            continue
        t = re.sub(r"\s+", " ", lbl.get_text(" ", strip=True))
        mo = re.match(r"^([A-D])[.)]\s*(.*)$", t)
        if mo:
            opts[mo.group(1).upper()] = mo.group(2).strip()

    correct = _extract_q_answer(qw)

    exp_el = item_wrapper.select_one(".question-explanation-wrapper .collapse")
    exp_txt = exp_el.get_text("\n", strip=True) if exp_el else ""

    tr_el = item_wrapper.select_one(".context-transcript .collapse")
    tr_txt = tr_el.get_text("\n", strip=True) if tr_el else ""

    img_el = item_wrapper.select_one(".context-image img, .context-content:not(.context-transcript) img")
    img_url = (img_el.get("data-src") or img_el.get("src")) if img_el else None

    aud_el = item_wrapper.select_one("audio source, audio")
    aud_url = aud_el.get("src") if aud_el and aud_el.get("src") and ".mp3" in aud_el.get("src").lower() else None

    return {
        "n": qnum,
        "question": q_text,
        "options": opts,
        "correct": correct,
        "explanation_parsed": _parse_dich_nghia_block(exp_txt),
        "transcript": tr_txt,
        "image": img_url,
        "audio": aud_url,
    }


def _split_en_vi_transcript(tr_text: str) -> Tuple[List[str], List[str]]:
    txt = (tr_text or "").replace("\r\n", "\n").strip()
    parts = re.split(r"\n\s*Dịch nghĩa\s*:\s*\n?", txt, maxsplit=1, flags=re.I)
    en_lines = [ln.strip() for ln in parts[0].splitlines() if ln.strip()]
    vi_lines = [ln.strip() for ln in parts[1].splitlines() if ln.strip()] if len(parts) > 1 else []
    return en_lines, vi_lines


def _split_study4_multi_passages(html_str: str) -> List[str]:
    chunks = re.split(r"<p[^>]*>\s*-{5,}\s*</p>|<hr\s*/?>", html_str or "", flags=re.I)
    out = [c.strip() for c in chunks if len(clean_html_text(c)) >= 25]
    return out or [html_str]


def _split_study4_vi_passages(vi_str: str, expected_count: int) -> List[str]:
    txt = re.sub(r"^Dịch nghĩa\s*:\s*", "", (vi_str or "").strip(), flags=re.I)
    chunks = re.split(r"\n\s*-{5,}\s*\n", txt)
    chunks = [c.strip() for c in chunks if c.strip()]
    if len(chunks) == expected_count:
        return chunks
    if expected_count <= 1:
        return [txt]
    paras = [p.strip() for p in re.split(r"\n{2,}", txt) if p.strip()]
    sz = max(1, len(paras) // expected_count)
    return [
        "\n\n".join(paras[i * sz:(i + 1) * sz if i < expected_count - 1 else len(paras)])
        for i in range(expected_count)
    ]


def extract_study4_details_html(html_text: str, details_url: str, fallback_title: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html_text, "lxml")
    h1 = soup.find("h1")
    title = re.sub(r"\s+", " ", h1.get_text(" ", strip=True)) if h1 else fallback_title
    title = re.sub(r"^(Đáp án chi tiết|Kết quả thi)\s*[:\-]?\s*", "", title, flags=re.I).strip()
    title = re.sub(r"\s*-\s*STUDY4\s*$", "", title, flags=re.I).strip() or fallback_title

    panes = soup.select('[id^="partcontent-"]')
    if len(panes) < 7:
        raise RuntimeError(f"Expected 7 [id^='partcontent-'] panes on {details_url}, found {len(panes)}")

    raw: Dict[str, Any] = {
        "source_url": details_url,
        "title": title,
        "crawled_at": datetime.now(timezone.utc).isoformat(),
        "part1": [],
        "part2": [],
        "part3": [],
        "part4": [],
        "part5": [],
        "part6": [],
        "part7": [],
    }

    for pane_idx, key in [(0, "part1"), (1, "part2"), (4, "part5")]:
        for iw in panes[pane_idx].select(".question-item-wrapper"):
            item = _extract_item_question(iw)
            if item:
                if item.get("image"):
                    item["image"] = urljoin(details_url, item["image"])
                if item.get("audio"):
                    item["audio"] = urljoin(details_url, item["audio"])
                raw[key].append(item)

    for pane_idx, key in [(2, "part3"), (3, "part4")]:
        for gw in panes[pane_idx].select(".question-group-wrapper"):
            tr_el = gw.select_one(".context-transcript .collapse")
            tr_txt = tr_el.get_text("\n", strip=True) if tr_el else ""
            img_el = gw.select_one(".context-image img, .context-content:not(.context-transcript) img")
            img_u = urljoin(details_url, img_el.get("data-src") or img_el.get("src")) if img_el else None
            aud_el = gw.select_one("audio source, audio")
            aud_u = urljoin(details_url, aud_el.get("src")) if aud_el and aud_el.get("src") and ".mp3" in aud_el.get("src").lower() else None
            qs = []
            for iw in gw.select(".question-item-wrapper"):
                q = _extract_item_question(iw)
                if q:
                    qs.append(q)
            if qs:
                raw[key].append({
                    "transcript": tr_txt,
                    "image": img_u,
                    "audio": aud_u,
                    "questions": qs,
                })

    for pane_idx, key in [(5, "part6"), (6, "part7")]:
        for gw in panes[pane_idx].select(".question-group-wrapper"):
            # Collect ALL passage content containers (handles both text & image-based older passages)
            ctx_els = gw.select(".context-content:not(.context-transcript):not(.context-image)")
            passage_html = "\n<hr/>\n".join(str(c) for c in ctx_els if len(clean_html_text(str(c))) >= 15)
            # Also collect passage images in case an older Study4 test uses images for Part 6/7 passages
            p_imgs = [
                urljoin(details_url, im.get("data-src") or im.get("src"))
                for im in gw.select(".context-image img, .context-content:not(.context-transcript) img")
                if (im.get("data-src") or im.get("src"))
            ]
            tr_el = gw.select_one(".context-transcript .collapse")
            vi_text = tr_el.get_text("\n", strip=True) if tr_el else ""
            qs = []
            for iw in gw.select(".question-item-wrapper"):
                q = _extract_item_question(iw)
                if q:
                    qs.append(q)
            if qs:
                raw[key].append({
                    "passage_html": passage_html,
                    "passage_images": p_imgs,
                    "vi_text": vi_text,
                    "questions": qs,
                })

    total = (
        len(raw["part1"]) + len(raw["part2"])
        + sum(len(g["questions"]) for g in raw["part3"])
        + sum(len(g["questions"]) for g in raw["part4"])
        + len(raw["part5"])
        + sum(len(g["questions"]) for g in raw["part6"])
        + sum(len(g["questions"]) for g in raw["part7"])
    )
    raw["total_extracted"] = total
    return raw


# =============================================================================
# 6. MEDIA COMPRESSION (IMAGES >500KB -> JPEG 80%, MP3 -> MONO 48K SPEECH)
# =============================================================================
def compress_image_if_large(img_path: Path, max_bytes: int = 500_000):
    if not img_path.exists() or img_path.stat().st_size <= max_bytes:
        return
    try:
        with Image.open(img_path) as im:
            im = im.convert("RGB")
            if im.width > 1600:
                ratio = 1600 / float(im.width)
                im = im.resize((1600, max(1, int(im.height * ratio))), Image.Resampling.LANCZOS)
            im.save(img_path, format="JPEG", quality=80, optimize=True)
    except Exception:
        pass


def compress_mp3_speech_48k(mp3_path: Path):
    """Compresses an existing MP3 to mono 48kbps speech (`-ac 1 -ar 22050 -b:a 48k`)."""
    if not mp3_path.exists():
        return
    tmp_out = mp3_path.with_suffix(".tmp48k.mp3")
    try:
        subprocess.run(
            [FFMPEG_BIN, "-y", "-i", str(mp3_path), "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "48k", str(tmp_out)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        if tmp_out.exists() and tmp_out.stat().st_size > 5_000:
            tmp_out.replace(mp3_path)
    except Exception:
        tmp_out.unlink(missing_ok=True)


_TTS_SSL_RELAXED = False
_TTS_USE_OFFLINE_SAPI = False


def _enable_relaxed_tts_ssl():
    """
    Fallback when a local Windows antivirus/corporate proxy intercepts speech.platform.bing.com
    with a self-signed certificate despite truststore system-store injection.
    """
    global _TTS_SSL_RELAXED
    if not _TTS_SSL_RELAXED:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        if hasattr(edge_tts_comm, "_SSL_CTX"):
            edge_tts_comm._SSL_CTX = ctx
        _TTS_SSL_RELAXED = True
        log_msg("  [SSL Fallback] Thử SSL relaxed connector cho edge-tts ...")


def _render_mp3_offline_windows_sapi(
    lines: List[Dict[str, Any]], out_mp3: Path, pause_ms: int = 340
) -> List[Tuple[int, int]]:
    """
    100% offline Windows System.Speech SAPI5 multi-voice synthesizer
    (Male=Microsoft David Desktop, Female=Microsoft Zira Desktop) -> mono 48k MP3.
    Used automatically when speech.platform.bing.com is blocked/intercepted by local proxy/SSL.
    """
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    timestamps: List[Tuple[int, int]] = []
    with tempfile.TemporaryDirectory() as td:
        tdp = Path(td)
        manifest = []
        for idx, ln in enumerate(lines):
            txt = re.sub(r"\s+", " ", (ln.get("en", "") or "").strip()) or "Listen carefully."
            voice_name = "Microsoft David Desktop" if ln.get("voiceGender") == "male" else "Microsoft Zira Desktop"
            wav_p = tdp / f"s_{idx}.wav"
            manifest.append({"text": txt, "voice": voice_name, "wav": str(wav_p)})

        man_p = tdp / "manifest.json"
        man_p.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        ps_code = (
            "Add-Type -AssemblyName System.Speech; "
            "$items = Get-Content -Raw -Encoding UTF8 '" + str(man_p).replace("'", "''") + "' | ConvertFrom-Json; "
            "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "$s.Rate = 0; "
            "foreach ($it in $items) { "
            "  try { $s.SelectVoice($it.voice) } catch {} "
            "  $s.SetOutputToWaveFile($it.wav); "
            "  $s.Speak($it.text); "
            "} "
            "$s.Dispose();"
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_code],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
            timeout=90,
        )
        combined = AudioSegment.silent(duration=220, frame_rate=22050)
        for idx in range(len(lines)):
            wav_p = tdp / f"s_{idx}.wav"
            seg = AudioSegment.from_wav(str(wav_p)).set_channels(1).set_frame_rate(22050)
            start_ms = len(combined)
            combined += seg
            end_ms = max(start_ms + 300, len(combined))
            timestamps.append((start_ms, end_ms))
            combined += AudioSegment.silent(duration=pause_ms, frame_rate=22050)

        wav_full = tdp / "full.wav"
        combined.export(str(wav_full), format="wav")
        subprocess.run(
            [FFMPEG_BIN, "-y", "-i", str(wav_full), "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "48k", str(out_mp3)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
    return timestamps


async def _render_one_mp3_48k(
    sem: asyncio.Semaphore,
    lines: List[Dict[str, Any]],
    out_mp3: Path,
    pause_ms: int = 340,
) -> List[Tuple[int, int]]:
    global _TTS_USE_OFFLINE_SAPI
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    if out_mp3.exists() and out_mp3.stat().st_size > 5_000:
        dur = get_mp3_duration_ms(out_mp3)
        return distribute_timestamps([l.get("en", "") for l in lines], dur, lead_in_ms=250)

    if _TTS_USE_OFFLINE_SAPI and os.name == "nt":
        async with sem:
            return await asyncio.to_thread(_render_mp3_offline_windows_sapi, lines, out_mp3, pause_ms)

    async with sem:
        timestamps: List[Tuple[int, int]] = []
        try:
            with tempfile.TemporaryDirectory() as td:
                tdp = Path(td)
                combined = AudioSegment.silent(duration=220, frame_rate=22050)
                for idx, ln in enumerate(lines):
                    voice = EDGE_VOICES.get(
                        (ln.get("voiceGender", "female"), ln.get("accent", "en-US")),
                        "en-US-JennyNeural",
                    )
                    txt = re.sub(r"\s+", " ", (ln.get("en", "") or "").strip()) or "Listen carefully."
                    mp3_tmp = tdp / f"s_{idx}.mp3"
                    wav_tmp = tdp / f"s_{idx}.wav"
                    for attempt in range(3):
                        connector = aiohttp.TCPConnector(ssl=False) if _TTS_SSL_RELAXED else None
                        try:
                            await edge_tts.Communicate(
                                text=txt, voice=voice, rate="-3%", connector=connector
                            ).save(str(mp3_tmp))
                            break
                        except (aiohttp.ClientConnectorCertificateError, ssl.SSLCertVerificationError):
                            _enable_relaxed_tts_ssl()
                            if attempt == 2:
                                raise
                            await asyncio.sleep(0.5)
                        except Exception as exc:
                            if "CERTIFICATE_VERIFY_FAILED" in str(exc) or "self-signed certificate" in str(exc).lower():
                                _enable_relaxed_tts_ssl()
                            if attempt == 2:
                                raise
                            await asyncio.sleep(1.0 * (attempt + 1))
                        finally:
                            if connector is not None:
                                await connector.close()
                    subprocess.run(
                        [FFMPEG_BIN, "-y", "-i", str(mp3_tmp), "-ar", "22050", "-ac", "1", str(wav_tmp)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        check=True,
                    )
                    seg = AudioSegment.from_wav(str(wav_tmp))
                    start_ms = len(combined)
                    combined += seg
                    end_ms = max(start_ms + 300, len(combined))
                    timestamps.append((start_ms, end_ms))
                    combined += AudioSegment.silent(duration=pause_ms, frame_rate=22050)
                wav_full = tdp / "full.wav"
                combined.export(str(wav_full), format="wav")
                subprocess.run(
                    [FFMPEG_BIN, "-y", "-i", str(wav_full), "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "48k", str(out_mp3)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=True,
                )
            return timestamps
        except Exception as exc:
            if os.name == "nt":
                if not _TTS_USE_OFFLINE_SAPI:
                    _TTS_USE_OFFLINE_SAPI = True
                    log_msg(f"  [TTS Offline Fallback] edge-tts bị lỗi mạng/SSL ({str(exc)[:100]}) → tự chuyển sang Windows SAPI5 offline (David/Zira) nén 48k!")
                return await asyncio.to_thread(_render_mp3_offline_windows_sapi, lines, out_mp3, pause_ms)
            raise


def render_mp3_batch_48k(jobs: List[Tuple[List[Dict[str, Any]], Path]]) -> List[List[Tuple[int, int]]]:
    async def _run_all():
        sem = asyncio.Semaphore(6)
        tasks = [_render_one_mp3_48k(sem, lines, path) for lines, path in jobs]
        return await asyncio.gather(*tasks)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        return ex.submit(asyncio.run, _run_all()).result()


# =============================================================================
# 7. PER-TEST INLINE VALIDATOR (MATCHES scripts/validate_data.py 100%)
# =============================================================================
def validate_single_test(test_data: Dict[str, Any], test_meta: Dict[str, Any]) -> List[str]:
    errs: List[str] = []
    pub = ROOT / "public"
    parts = test_data.get("parts", {})

    for item in parts.get("part1", []):
        img = pub / item["imageUrl"].lstrip("/")
        aud = pub / item["audioUrl"].lstrip("/")
        if not (img.exists() and img.stat().st_size > 10_000):
            errs.append(f"P1 {item['id']} missing/small image: {img}")
        if not (aud.exists() and aud.stat().st_size > 5_000):
            errs.append(f"P1 {item['id']} missing/small audio: {aud}")
        for ln in item.get("transcript", []):
            if not (ln.get("endMs", 0) > ln.get("startMs", 0)):
                errs.append(f"P1 {ln.get('id')} invalid timestamps")

    for item in parts.get("part2", []):
        aud = pub / item["audioUrl"].lstrip("/")
        if not (aud.exists() and aud.stat().st_size > 5_000):
            errs.append(f"P2 {item['id']} missing/small audio: {aud}")
        if not (item["questionLine"].get("endMs", 0) > item["questionLine"].get("startMs", 0)):
            errs.append(f"P2 {item['id']} invalid Q timestamps")
        for k in ["A", "B", "C"]:
            if not (item["options"][k].get("endMs", 0) > item["options"][k].get("startMs", 0)):
                errs.append(f"P2 {item['id']} opt {k} invalid timestamps")

    for pk in ("part3", "part4"):
        for s in parts.get(pk, []):
            aud = pub / s["audioUrl"].lstrip("/")
            if not (aud.exists() and aud.stat().st_size > 10_000):
                errs.append(f"{pk} {s['id']} missing/small audio: {aud}")
            for ln in s.get("transcript", []):
                if not (ln.get("endMs", 0) > ln.get("startMs", 0)):
                    errs.append(f"{pk} {ln.get('id')} invalid timestamps")

    for q in parts.get("part5", []):
        exp = q.get("explanation", {})
        if not (exp.get("classification", {}).get("category") and exp.get("classification", {}).get("signal")):
            errs.append(f"P5 {q['id']} missing layer 1")
        if not (exp.get("translation", {}).get("questionVi") and len(exp.get("translation", {}).get("optionsVi", {})) == 4):
            errs.append(f"P5 {q['id']} missing layer 2")
        if not exp.get("proof", {}).get("explanation"):
            errs.append(f"P5 {q['id']} missing layer 3")
        if len(exp.get("wrongOptionsAnalysis", {})) != 4:
            errs.append(f"P5 {q['id']} missing layer 4")
        if not (exp.get("keyTakeaways", {}).get("formula") and exp.get("keyTakeaways", {}).get("commonTrap")):
            errs.append(f"P5 {q['id']} missing layer 5")

    for p in parts.get("part6", []):
        sids = {s["id"] for para in p.get("paragraphs", []) for s in para.get("sentences", [])}
        for q in p.get("questions", []):
            if q.get("explanation", {}).get("proof", {}).get("evidenceSentenceId") not in sids:
                errs.append(f"P6 {q['id']} invalid evidenceSentenceId")

    for s in parts.get("part7", []):
        for q in s.get("questions", []):
            p_idx = q.get("explanation", {}).get("proof", {}).get("evidencePassageIndex", 0)
            ev_id = q.get("explanation", {}).get("proof", {}).get("evidenceSentenceId")
            if not (0 <= p_idx < len(s.get("passages", []))):
                errs.append(f"P7 {q['id']} out-of-range evidencePassageIndex")
                continue
            doc = s["passages"][p_idx]
            valid_ids = {sent["id"] for para in doc.get("paragraphs", []) for sent in para.get("sentences", [])}
            valid_ids.update(msg["id"] for msg in doc.get("chatMessages", []))
            if ev_id not in valid_ids:
                errs.append(f"P7 {q['id']} invalid evidenceSentenceId")

    qcnt = (
        len(parts.get("part1", []))
        + len(parts.get("part2", []))
        + sum(len(s["questions"]) for s in parts.get("part3", []))
        + sum(len(s["questions"]) for s in parts.get("part4", []))
        + len(parts.get("part5", []))
        + sum(len(p["questions"]) for p in parts.get("part6", []))
        + sum(len(s["questions"]) for s in parts.get("part7", []))
    )
    if qcnt != test_meta.get("questionCount"):
        errs.append(f"questionCount mismatch: {qcnt} != {test_meta.get('questionCount')}")
    return errs


# =============================================================================
# 8. BUILD & LIVE-COMMIT ONE STUDY4 TEST
# =============================================================================
def build_and_commit_study4_test(
    session: CrawlSession,
    translator: BatchViTranslator,
    raw: Dict[str, Any],
    origin_url: str,
    browser_cookies: List[Dict[str, Any]],
    override_year: Optional[int] = None,
    override_test_num: Optional[int] = None,
    force: bool = False,
) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    for c in browser_cookies:
        try:
            session.http.cookies.set(c["name"], c["value"], domain=c.get("domain", ".study4.com"))
        except Exception:
            pass

    title = raw.get("title") or "Study4 TOEIC Test"
    test_id = slugify_test_id(origin_url, title)
    out_json = TESTS_DIR / f"{test_id}.json"
    allow_dup = out_json.exists() and force
    test_audio_dir = AUDIO_BASE_DIR / test_id
    test_img_dir = IMAGES_BASE_DIR / test_id

    # 1. Parallel download + compress images (>500KB -> JPEG 80%)
    img_jobs: List[Tuple[str, Path]] = []
    img_url_to_local: Dict[str, str] = {}
    for q in raw["part1"]:
        if q.get("image") and q["image"] not in img_url_to_local:
            ext = ".png" if ".png" in q["image"].lower() else ".jpg"
            fname = f"p1_q{q['n']}{ext}"
            img_jobs.append((q["image"], test_img_dir / fname))
            img_url_to_local[q["image"]] = f"/images/toeic/{test_id}/{fname}"
    for key in ("part3", "part4"):
        for g_i, g in enumerate(raw[key], 1):
            if g.get("image") and g["image"] not in img_url_to_local:
                ext = ".png" if ".png" in g["image"].lower() else ".jpg"
                fname = f"{key}_g{g_i}{ext}"
                img_jobs.append((g["image"], test_img_dir / fname))
                img_url_to_local[g["image"]] = f"/images/toeic/{test_id}/{fname}"

    if img_jobs:
        log_msg(f"  -> Tải {len(img_jobs)} ảnh Study4 CDN & tối ưu dung lượng (>500KB nén JPEG 80%) ...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
            futs = [
                ex.submit(download_media_file, session, u, dest, 10_000, STUDY4_BASE + "/", "image")
                for u, dest in img_jobs
            ]
            concurrent.futures.wait(futs)
        for _, dest in img_jobs:
            compress_image_if_large(dest, max_bytes=500_000)

    # Check for any English strings lacking Study4 native Vietnamese translation (older tests like Sample TOEIC)
    missing_vi_pool: List[str] = []
    for q in raw["part1"]:
        ep = q["explanation_parsed"]
        if len(ep["options_vi"]) < 4:
            tr_lns = [ln.strip() for ln in (q.get("transcript") or "").splitlines() if ln.strip()]
            for k in ["A", "B", "C", "D"]:
                for ln in tr_lns:
                    mo = re.match(rf"^\(?{k}\)?[.)]\s*(.+)$", ln)
                    if mo:
                        missing_vi_pool.append(mo.group(1).strip())
                        break
    for q in raw["part5"]:
        ep = q["explanation_parsed"]
        if not ep["question_vi"] and q.get("question"):
            missing_vi_pool.append(q["question"])
        if len(ep["options_vi"]) < 4:
            missing_vi_pool.extend([v for v in q.get("options", {}).values() if v])
    vi_fallback = translator.translate_batch(missing_vi_pool) if missing_vi_pool else {}

    tts_jobs: List[Tuple[List[Dict[str, Any]], Path]] = []
    tts_bindings: List[Tuple[str, Any]] = []
    part1_out, part2_out, part3_out, part4_out = [], [], [], []
    part5_out, part6_out, part7_out = [], [], []

    # ---- PART 1 ----
    for q in raw["part1"]:
        n = q["n"]
        ans = q["correct"]
        tr_lines = [ln.strip() for ln in (q.get("transcript") or "").splitlines() if ln.strip()]
        opts_en = {}
        for k in ["A", "B", "C", "D"]:
            found = ""
            for ln in tr_lines:
                mo = re.match(rf"^\(?{k}\)?[.)]\s*(.+)$", ln)
                if mo:
                    found = mo.group(1).strip()
                    break
            opts_en[k] = found or q["options"].get(k) or f"Statement ({k})"

        if not session.register_hash("p1 " + " ".join(opts_en.values()), allow_existing=allow_dup):
            continue
        img_local = img_url_to_local.get(q.get("image", ""), "")
        if not img_local or not (ROOT / "public" / img_local.lstrip("/")).exists():
            continue

        exp_p = q["explanation_parsed"]
        opts_vi = {k: exp_p["options_vi"].get(k) or vi_fallback.get(opts_en[k], opts_en[k]) for k in ["A", "B", "C", "D"]}
        qid = f"{test_id}-p1-q{n}"
        t_lines = [
            {
                "id": f"{qid}-l{i+1}",
                "speaker": f"Option ({k})",
                "voiceGender": "female" if n % 2 == 1 else "male",
                "accent": "en-US" if n % 3 != 0 else "en-GB",
                "en": f"({k}) {opts_en[k]}",
                "vi": f"({k}) {opts_vi[k]}",
                "evidenceForQuestionIds": [qid] if k == ans else [],
            }
            for i, k in enumerate(["A", "B", "C", "D"])
        ]
        aud_fname = f"p1_q{n:02d}.mp3"
        aud_path = test_audio_dir / aud_fname
        item = {
            "id": qid,
            "part": 1,
            "sceneType": "single-person" if any(w in opts_en[ans].lower() for w in ["woman", "man", "he ", "she "]) else "scene-objects",
            "title": f"Part 1 Câu {n} — {title}",
            "illustrationKey": "office-laptop",
            "imageUrl": img_local,
            "audioUrl": f"/audio/toeic/{test_id}/{aud_fname}",
            "transcript": t_lines,
            "options": {k: {"en": opts_en[k], "vi": opts_vi[k]} for k in ["A", "B", "C", "D"]},
            "correctAnswer": ans,
            "explanation": {
                "trapType": "Bẫy mô tả tranh & vị trí đồ vật Part 1",
                "trapAnalysis": exp_p["explanation_vi"] or f"Đáp án đúng ({ans}): \"{opts_en[ans]}\" ({opts_vi[ans]}).",
                "paraphrases": [],
                "optionAnalysis": {k: (f"ĐÚNG: {opts_vi[k]}" if k == ans else f"SAI: {opts_vi[k]}") for k in ["A", "B", "C", "D"]},
                "keyVocab": [],
            },
        }
        part1_out.append(item)
        tts_jobs.append((t_lines, aud_path))
        tts_bindings.append(("p1", item))

    # ---- PART 2 ----
    for q in raw["part2"]:
        n = q["n"]
        ans = q["correct"] if q["correct"] in ("A", "B", "C") else "A"
        tr_lines = [ln.strip() for ln in (q.get("transcript") or "").splitlines() if ln.strip()]
        q_en = ""
        opts_en = {}
        for ln in tr_lines:
            mo = re.match(r"^\(?([A-C])\)?[.)]\s*(.+)$", ln)
            if mo:
                opts_en[mo.group(1).upper()] = mo.group(2).strip()
            elif not q_en:
                q_en = ln
        q_en = q_en or q["question"] or f"Question {n}"
        for k in ["A", "B", "C"]:
            opts_en.setdefault(k, q["options"].get(k) or f"Response ({k})")

        if not session.register_hash("p2 " + q_en + " " + " ".join(opts_en.values()), allow_existing=allow_dup):
            continue
        exp_p = q["explanation_parsed"]
        q_vi = exp_p["question_vi"] or q_en
        opts_vi = {k: exp_p["options_vi"].get(k) or opts_en[k] for k in ["A", "B", "C"]}

        qid = f"{test_id}-p2-q{n}"
        q_gender = "female" if n % 2 == 0 else "male"
        a_gender = "male" if q_gender == "female" else "female"
        accent = "en-US" if n % 3 != 0 else "en-GB"
        tts_lines = [
            {"en": q_en, "voiceGender": q_gender, "accent": accent},
            *[{"en": f"{k}. {opts_en[k]}", "voiceGender": a_gender, "accent": accent} for k in ["A", "B", "C"]],
        ]
        aud_fname = f"p2_q{n:02d}.mp3"
        aud_path = test_audio_dir / aud_fname
        q_type = detect_part2_type(q_en, opts_en[ans])
        item = {
            "id": qid,
            "part": 2,
            "questionType": q_type,
            "title": f"Part 2 Câu {n} ({q_type})",
            "audioUrl": f"/audio/toeic/{test_id}/{aud_fname}",
            "questionLine": {"id": f"{qid}-q", "speaker": "Question", "voiceGender": q_gender, "accent": accent, "en": q_en, "vi": q_vi},
            "options": {
                k: {"en": opts_en[k], "vi": opts_vi[k], "speaker": f"Speaker ({k})", "voiceGender": a_gender, "accent": accent}
                for k in ["A", "B", "C"]
            },
            "correctAnswer": ans,
            "explanation": {
                "trapType": f"Bẫy Part 2 ({q_type})",
                "trapAnalysis": exp_p["explanation_vi"] or f"Câu hỏi: \"{q_en}\" ({q_vi}). Đáp án ({ans}): \"{opts_en[ans]}\" ({opts_vi[ans]}).",
                "paraphrases": [],
                "optionAnalysis": {k: (f"ĐÚNG: {opts_vi[k]}" if k == ans else f"SAI (Bẫy lạc đề/đồng âm): {opts_vi[k]}") for k in ["A", "B", "C"]},
                "keyVocab": [],
            },
        }
        part2_out.append(item)
        tts_jobs.append((tts_lines, aud_path))
        tts_bindings.append(("p2", item))

    # ---- PART 3 & PART 4 ----
    for part_num, key, target_list in [(3, "part3", part3_out), (4, "part4", part4_out)]:
        for s_idx, g in enumerate(raw[key], 1):
            en_lines, vi_lines = _split_en_vi_transcript(g.get("transcript", ""))
            en_joined = " ".join(en_lines)
            hash_basis = en_joined[:250] if en_joined else " ".join(q.get("question", "") for q in g["questions"])
            if not session.register_hash(f"p{part_num} " + hash_basis, allow_existing=allow_dup):
                continue
            sid = f"{test_id}-p{part_num}-s{s_idx:02d}"
            t_lines = []
            speakers = set()
            if part_num == 3 and en_lines:
                for l_i, en_ln in enumerate(en_lines, 1):
                    m_spk = re.match(r"^(M\d*|W\d*|Man\s*\d*|Woman\s*\d*)\s*:\s*(.+)$", en_ln, re.I)
                    spk = m_spk.group(1) if m_spk else ("Woman" if l_i % 2 == 1 else "Man")
                    en_txt = m_spk.group(2).strip() if m_spk else en_ln
                    speakers.add(spk.upper())
                    vi_ln = vi_lines[l_i - 1] if l_i - 1 < len(vi_lines) else en_txt
                    vi_ln = re.sub(r"^(M\d*|W\d*|Man\s*\d*|Woman\s*\d*)\s*:\s*", "", vi_ln, flags=re.I).strip()
                    t_lines.append({
                        "id": f"{sid}-l{l_i}",
                        "speaker": spk,
                        "voiceGender": "male" if spk.lower().startswith("m") else "female",
                        "accent": "en-US" if (s_idx + l_i) % 3 != 0 else "en-GB",
                        "en": en_txt,
                        "vi": vi_ln or en_txt,
                        "evidenceForQuestionIds": [],
                    })
            elif en_joined:
                en_sents = split_sentences(en_joined)
                vi_sents = split_sentences(" ".join(vi_lines))
                gender = "male" if s_idx % 2 == 0 else "female"
                accent = "en-US" if s_idx % 3 != 0 else "en-GB"
                for l_i, s_en in enumerate(en_sents, 1):
                    vp = min(len(vi_sents) - 1, int((l_i - 1) * len(vi_sents) / max(len(en_sents), 1))) if vi_sents else -1
                    t_lines.append({
                        "id": f"{sid}-l{l_i}",
                        "speaker": "Speaker",
                        "voiceGender": gender,
                        "accent": accent,
                        "en": s_en,
                        "vi": vi_sents[vp] if vp >= 0 else s_en,
                        "evidenceForQuestionIds": [],
                    })

            if not t_lines:
                t_lines = [{"id": f"{sid}-l1", "speaker": "Speaker", "voiceGender": "female", "accent": "en-US", "en": "Please listen to the following audio recording and answer the questions.", "vi": "Hãy lắng nghe đoạn ghi âm và trả lời các câu hỏi.", "evidenceForQuestionIds": []}]

            img_local = img_url_to_local.get(g.get("image", ""), "")
            has_graphic = bool(img_local and (ROOT / "public" / img_local.lstrip("/")).exists())

            sub_qs = []
            for q in g["questions"]:
                qn = q["n"]
                sub_id = f"{sid}-q{qn}"
                ans = q["correct"]
                exp_p = q["explanation_parsed"]
                opts_en = {k: q["options"].get(k) or f"Option {k}" for k in ["A", "B", "C", "D"]}
                opts_vi = {k: exp_p["options_vi"].get(k) or opts_en[k] for k in ["A", "B", "C", "D"]}
                ev_q = exp_p["evidence_quote"]
                best_l = None
                if ev_q:
                    ev_low = ev_q.lower()[:45]
                    best_l = next((l for l in t_lines if ev_low in l["en"].lower()), None)
                if not best_l:
                    q_tok = tokenize_sig(q["question"] + " " + opts_en[ans] + " " + ev_q)
                    best_l = max(t_lines, key=lambda l: len(q_tok & tokenize_sig(l["en"])), default=None)
                if best_l:
                    best_l["evidenceForQuestionIds"].append(sub_id)

                sub_qs.append({
                    "id": sub_id,
                    "questionNumber": qn,
                    "questionType": detect_part34_qtype(q["question"], has_graphic),
                    "prompt": q["question"],
                    "promptVi": exp_p["question_vi"] or q["question"],
                    "options": {k: {"en": opts_en[k], "vi": opts_vi[k]} for k in ["A", "B", "C", "D"]},
                    "correctAnswer": ans,
                    "explanation": {
                        "trapType": f"Paraphrase & Dẫn chứng Part {part_num} (Study4)",
                        "trapAnalysis": (exp_p["explanation_vi"] + " " if exp_p["explanation_vi"] else "")
                        + f"Đáp án ({ans}) \"{opts_en[ans]}\" ({opts_vi[ans]})."
                        + (f" Dẫn chứng: \"{ev_q}\"" if ev_q else ""),
                        "paraphrases": [],
                        "optionAnalysis": {k: (f"ĐÚNG: {opts_vi[k]}" if k == ans else f"SAI: {opts_vi[k]}") for k in ["A", "B", "C", "D"]},
                        "keyVocab": [],
                    },
                })

            aud_fname = f"p{part_num}_s{s_idx:02d}.mp3"
            aud_path = test_audio_dir / aud_fname
            q_start, q_end = g["questions"][0]["n"], g["questions"][-1]["n"]
            if part_num == 3:
                obj: Dict[str, Any] = {
                    "id": sid, "part": 3, "title": f"Hội thoại Câu {q_start}–{q_end}",
                    "scenario": f"Study4 Part 3 ({q_start}–{q_end})",
                    "speakerCount": 3 if len(speakers) >= 3 else 2, "hasGraphic": has_graphic,
                    "audioUrl": f"/audio/toeic/{test_id}/{aud_fname}",
                    "transcript": t_lines, "questions": sub_qs, "keyVocab": [],
                }
            else:
                obj = {
                    "id": sid, "part": 4, "title": f"Bài nói Câu {q_start}–{q_end}",
                    "talkType": detect_talk_type(en_joined), "hasGraphic": has_graphic,
                    "audioUrl": f"/audio/toeic/{test_id}/{aud_fname}",
                    "transcript": t_lines, "questions": sub_qs, "keyVocab": [],
                }
            if has_graphic:
                obj["graphicImageUrl"] = img_local
            target_list.append(obj)
            tts_jobs.append((t_lines, aud_path))
            tts_bindings.append(("p34", obj))

    if tts_jobs:
        log_msg(f"  -> Tạo {len(tts_jobs)} file MP3 nén chuẩn giọng nói (-ac 1 -b:a 48k) ...")
        all_ts = render_mp3_batch_48k(tts_jobs)
        for (kind, ref), ts in zip(tts_bindings, all_ts):
            if kind in ("p1", "p34"):
                for l, (s_ms, e_ms) in zip(ref["transcript"], ts):
                    l["startMs"], l["endMs"] = s_ms, e_ms
            elif kind == "p2":
                ref["questionLine"]["startMs"], ref["questionLine"]["endMs"] = ts[0]
                for i, k in enumerate(["A", "B", "C"]):
                    ref["options"][k]["startMs"], ref["options"][k]["endMs"] = ts[i + 1]
        session.media_stats["audio_fallback_edge_tts"] += len(tts_jobs)

    # ---- PART 5 ----
    for q in raw["part5"]:
        n = q["n"]
        sent_en = re.sub(r"-{3,}|_{3,}", "_______", q["question"].strip())
        opts_en = {k: q["options"].get(k, "") for k in ["A", "B", "C", "D"]}
        ans = q["correct"]
        if not sent_en or not session.register_hash(sent_en + " ".join(opts_en.values()), allow_existing=allow_dup):
            continue
        exp_p = q["explanation_parsed"]
        topic, signal, formula = classify_part5_topic(sent_en, opts_en, exp_p["explanation_vi"])
        part5_out.append({
            "id": f"{test_id}-p5-q{n}",
            "part": 5,
            "topic": topic,
            "difficulty": "Trung bình" if n <= 118 else "Nâng cao",
            "sentence": sent_en,
            "options": opts_en,
            "correctAnswer": ans,
            "explanation": build_reading_explanation_5layer(
                question_en=sent_en,
                question_vi=exp_p["question_vi"] or vi_fallback.get(q["question"], sent_en),
                options_en=opts_en,
                options_vi={k: exp_p["options_vi"].get(k) or vi_fallback.get(opts_en[k], opts_en[k]) for k in ["A", "B", "C", "D"]},
                correct=ans,
                raw_xp=exp_p["explanation_vi"] or exp_p["raw"],
                topic=topic,
                signal=signal,
                formula=formula,
            ),
        })

    # ---- PART 6 ----
    for p_i, g in enumerate(raw["part6"], 1):
        pid = f"{test_id}-p6-p{p_i}"
        p_html = re.sub(r"--\s*\((\d+)\)\s*--", r" ___ (\1) ___ ", g.get("passage_html") or "")
        if not clean_html_text(p_html):
            p_html = f"<p>Passage for Questions {g['questions'][0]['n']}–{g['questions'][-1]['n']}.</p>"
        vi_clean = re.sub(r"^Dịch nghĩa\s*:\s*", "", (g.get("vi_text") or "").strip(), flags=re.I)
        paragraphs, p_title = html_passage_to_bilingual_paragraphs(p_html, vi_clean, pid)
        plain_txt = " ".join(s["en"] for p in paragraphs for s in p["sentences"])
        if not session.register_hash("p6 " + plain_txt[:250] + str(g["questions"][0]["n"]), allow_existing=allow_dup):
            continue

        p6_qs = []
        for q in g["questions"]:
            bn = q["n"]
            ans = q["correct"]
            opts_en = {k: q["options"].get(k, "") for k in ["A", "B", "C", "D"]}
            exp_p = q["explanation_parsed"]

            ev_sid = paragraphs[0]["sentences"][0]["id"]
            ev_quote = paragraphs[0]["sentences"][0]["en"]
            for para in paragraphs:
                for sent in para["sentences"]:
                    if f"({bn})" in sent["en"] or f"{bn}." in sent["en"]:
                        ev_sid, ev_quote = sent["id"], sent["en"]
                        break

            is_ins = all(len(v.split()) >= 5 for v in opts_en.values())
            topic, signal, formula = (
                ("Điền câu vào đoạn văn (Sentence Insertion)", "4 phương án là 4 câu hoàn chỉnh — bám mạch ý câu trước và sau chỗ trống.", "Kiểm tra đại từ thay thế, thì động từ và tính liên kết ngữ cảnh.")
                if is_ins
                else classify_part5_topic(ev_quote, opts_en, exp_p["explanation_vi"])
            )
            p6_qs.append({
                "id": f"{pid}-q{bn}",
                "blankNumber": bn,
                "questionType": "Điền câu (Sentence Insertion)" if is_ins else ("Ngữ pháp" if "Từ loại" in topic or "Thì" in topic else "Từ vựng"),
                "options": opts_en,
                "correctAnswer": ans,
                "explanation": build_reading_explanation_5layer(
                    question_en=f"Blank ({bn}): {ev_quote}",
                    question_vi=f"Chỗ trống ({bn}) trong đoạn văn",
                    options_en=opts_en,
                    options_vi={k: exp_p["options_vi"].get(k) or opts_en[k] for k in ["A", "B", "C", "D"]},
                    correct=ans,
                    raw_xp=exp_p["explanation_vi"] or exp_p["raw"],
                    topic=topic,
                    signal=signal,
                    formula=formula,
                    evidence_quote=exp_p["evidence_quote"] or ev_quote,
                    evidence_sentence_id=ev_sid,
                ),
            })

        part6_out.append({
            "id": pid,
            "title": p_title or f"Part 6 Passage ({g['questions'][0]['n']}–{g['questions'][-1]['n']})",
            "genre": detect_p6_genre("", p_html),
            "paragraphs": paragraphs,
            "questions": p6_qs,
        })

    # ---- PART 7 ----
    for s_i, g in enumerate(raw["part7"], 1):
        sid = f"{test_id}-p7-s{s_i}"
        raw_p_html = g.get("passage_html") or ""
        if not clean_html_text(raw_p_html):
            raw_p_html = f"<p>Reading comprehension passage for Questions {g['questions'][0]['n']}–{g['questions'][-1]['n']}.</p>"
        html_chunks = _split_study4_multi_passages(raw_p_html)
        vi_chunks = _split_study4_vi_passages(g.get("vi_text", ""), len(html_chunks))
        docs = []
        for d_i, p_html in enumerate(html_chunks, 1):
            doc_id = f"{sid}-d{d_i}"
            paras, d_title = html_passage_to_bilingual_paragraphs(
                p_html, vi_chunks[d_i - 1] if d_i - 1 < len(vi_chunks) else "", doc_id
            )
            genre = detect_doc_genre("", p_html)
            docs.append({
                "id": doc_id,
                "tabLabel": f"Văn bản {d_i} ({genre})",
                "genre": genre,
                "title": d_title or f"{genre} #{d_i}",
                "paragraphs": paras,
            })

        plain_txt = " ".join(s["en"] for d in docs for p in d["paragraphs"] for s in p["sentences"])
        if not session.register_hash("p7 " + plain_txt[:250] + str(g["questions"][0]["n"]), allow_existing=allow_dup):
            continue

        p7_qs = []
        for q in g["questions"]:
            qn = q["n"]
            pr = q["question"] or f"Question {qn}"
            ans = q["correct"]
            opts_en = {k: q["options"].get(k, "") for k in ["A", "B", "C", "D"]}
            exp_p = q["explanation_parsed"]
            ev_hint = f'"{exp_p["evidence_quote"]}"' if exp_p["evidence_quote"] else ""
            ev_pidx, ev_sid, ev_quote = find_best_evidence_sentence(
                docs, pr + " " + opts_en.get(ans, ""), ev_hint + " " + exp_p["explanation_vi"]
            )
            qtype = detect_part7_qtype(pr)
            p7_qs.append({
                "id": f"{sid}-q{qn}",
                "questionNumber": qn,
                "questionType": qtype,
                "prompt": pr,
                "promptVi": exp_p["question_vi"] or pr,
                "options": opts_en,
                "correctAnswer": ans,
                "explanation": build_reading_explanation_5layer(
                    question_en=pr,
                    question_vi=exp_p["question_vi"] or pr,
                    options_en=opts_en,
                    options_vi={k: exp_p["options_vi"].get(k) or opts_en[k] for k in ["A", "B", "C", "D"]},
                    correct=ans,
                    raw_xp=exp_p["explanation_vi"] or (f"Đáp án ({ans}) dựa trên dẫn chứng: \"{exp_p['evidence_quote'] or ev_quote}\""),
                    topic=f"Part 7 — {qtype}",
                    signal=f"Định vị thông tin dẫn chứng tại Văn bản {ev_pidx + 1}.",
                    formula="Áp dụng Skimming/Scanning từ khóa và đối chiếu Paraphrase giữa đáp án và văn bản gốc.",
                    evidence_quote=exp_p["evidence_quote"] or ev_quote,
                    evidence_passage_idx=ev_pidx,
                    evidence_sentence_id=ev_sid,
                ),
            })

        p_type = "single" if len(docs) == 1 else ("double" if len(docs) == 2 else "triple")
        part7_out.append({
            "id": sid,
            "title": f"Questions {g['questions'][0]['n']}–{g['questions'][-1]['n']}",
            "passageCountType": p_type,
            "topic": f"Đọc hiểu {'Đơn' if p_type=='single' else ('Đôi' if p_type=='double' else 'Ba')} ({g['questions'][0]['n']}–{g['questions'][-1]['n']})",
            "passages": docs,
            "questions": p7_qs,
        })

    c1, c2 = len(part1_out), len(part2_out)
    c3 = sum(len(s["questions"]) for s in part3_out)
    c4 = sum(len(s["questions"]) for s in part4_out)
    c5 = len(part5_out)
    c6 = sum(len(p["questions"]) for p in part6_out)
    c7 = sum(len(s["questions"]) for s in part7_out)
    l_cnt, r_cnt = c1 + c2 + c3 + c4, c5 + c6 + c7
    total_cnt = l_cnt + r_cnt

    if total_cnt == 0:
        return None, ["No unique questions extracted (all duplicates or empty)"]

    inferred_yr, inferred_tn = infer_study4_year_and_testnum(origin_url, title)
    year = override_year or inferred_yr or 2024
    tnum = override_test_num or inferred_tn or 1

    test_data = {
        "id": test_id,
        "series": f"ETS TOEIC {year} — Study4 Full",
        "year": year,
        "title": f"ETS {year} • {title} (Full {total_cnt} câu)",
        "subtitle": f"Đề Full 7 Part cào tự động từ Study4 ({total_cnt} câu, ảnh tối ưu + MP3 mono 48k đa giọng US/UK + giải thích 5 lớp).",
        "durationMinutes": 120 if total_cnt >= 180 else max(30, int(total_cnt * 0.6)),
        "parts": {
            "part1": part1_out, "part2": part2_out, "part3": part3_out, "part4": part4_out,
            "part5": part5_out, "part6": part6_out, "part7": part7_out,
        },
    }
    test_meta = {
        "id": test_id,
        "series": test_data["series"],
        "year": year,
        "testNumber": tnum,
        "title": test_data["title"],
        "subtitle": test_data["subtitle"],
        "badge": f"ETS {year} • FULL {total_cnt} CÂU",
        "status": "ready",
        "durationMinutes": test_data["durationMinutes"],
        "miniDurationMinutes": max(15, test_data["durationMinutes"] // 2),
        "questionCount": total_cnt,
        "listeningCount": l_cnt,
        "readingCount": r_cnt,
        "partCounts": {"1": c1, "2": c2, "3": c3, "4": c4, "5": c5, "6": c6, "7": c7},
    }

    # Write JSON and immediately validate before live-committing to tests-meta.json!
    out_json.write_text(json.dumps(test_data, ensure_ascii=False, indent=2), encoding="utf-8")
    val_errs = validate_single_test(test_data, test_meta)
    if val_errs:
        out_json.unlink(missing_ok=True)
        return None, val_errs

    # Live commit to tests-meta.json right away!
    meta_path = TOEIC_DATA_DIR / "tests-meta.json"
    merge_meta_file(meta_path, [test_meta])
    remove_planned_placeholders(meta_path)

    session.sources_crawled.append({
        "tier": "Study4 Auto-Queue 2021-2026",
        "source": "study4.com",
        "url": origin_url,
        "output_type": "test",
        "output_id": test_id,
        "year": year,
        "questionCount": total_cnt,
        "partCounts": test_meta["partCounts"],
    })
    return test_meta, []


def remove_planned_placeholders(meta_path: Path):
    if not meta_path.exists():
        return
    items = json.loads(meta_path.read_text(encoding="utf-8"))
    cleaned = [x for x in items if x.get("status") != "planned"]
    if len(cleaned) != len(items):
        meta_path.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")


# =============================================================================
# 9. AUTO-QUEUE ORCHESTRATOR & MAIN CLI
# =============================================================================
def run_auto_ets_2021_2026(args):
    if not acquire_lock():
        sys.exit(2)

    session = CrawlSession()
    translator = BatchViTranslator()
    completed_this_run = 0
    failed_this_run = 0

    try:
        log_msg("=" * 74)
        log_msg(f"BẮT ĐẦU AUTO-ETS-2021-2026 (PID={os.getpid()}, per_year={args.per_year}, resume={args.resume}, limit={args.limit})")
        log_msg("=" * 74)

        with sync_playwright() as p:
            ctx = launch_study4_browser(p, headless=args.headless, background_window=args.background)
            page = configure_page_guards(ctx.pages[0] if ctx.pages else ctx.new_page())
            try:
                # Phase 1: Load or Discover queue
                if args.resume and QUEUE_PATH.exists():
                    queue_obj = json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
                    log_msg(f"[Resume] Đọc hàng đợi hiện có từ {QUEUE_PATH} ({len(queue_obj.get('items', []))} đề).")
                else:
                    queue_obj = discover_ets_2021_2026_queue(page, per_year=args.per_year, interactive=False)

                if args.discover_only:
                    log_msg("[Discover-Only] Hoàn tất quét hàng đợi.")
                    return

                pending_items = [x for x in queue_obj["items"] if x.get("status") == "pending"]
                total_q = len(queue_obj["items"])
                done_so_far = sum(1 for x in queue_obj["items"] if x.get("status") == "done")
                log_msg(f"[Queue] Tổng hàng đợi: {total_q} đề | Đã xong: {done_so_far} | Còn chờ: {len(pending_items)}")

                if args.only_ids:
                    wanted = set(args.only_ids)
                    pending_items = [x for x in pending_items if x["test_id"] in wanted]
                    log_msg(f"[Filter] Chỉ chạy các test_id được chọn: {[x['test_id'] for x in pending_items]}")
                if args.limit > 0:
                    pending_items = pending_items[: args.limit]
                    log_msg(f"[Limit] Giới hạn phiên chạy này: tối đa {len(pending_items)} đề.")

                for idx, q_item in enumerate(pending_items, 1):
                    tid = q_item["test_id"]
                    url = q_item["url"]
                    yr = q_item["year"]
                    tnum = q_item["test_number"]
                    title = q_item["title"]

                    log_msg("-" * 74)
                    log_msg(f"[{done_so_far + completed_this_run + 1}/{total_q}] Đang cào ETS {yr} — {title} ({url})")

                    try:
                        slug_key = re.sub(r"[^a-z0-9]+", "_", urlparse(url).path.lower()).strip("_")[:60]
                        raw_json_p = RAW_CACHE_DIR / f"{slug_key}.json"
                        raw_html_p = RAW_CACHE_DIR / f"{slug_key}_details.html"

                        if raw_json_p.exists() and not args.force:
                            log_msg(f"  -> Tái dùng checkpoint thô: {raw_json_p.name}")
                            raw = json.loads(raw_json_p.read_text(encoding="utf-8"))
                        else:
                            details_url, fb_title = navigate_to_details_page(page, url, interactive=False)
                            html_txt = page.content()
                            raw_html_p.write_text(html_txt, encoding="utf-8")
                            raw = extract_study4_details_html(html_txt, details_url, fb_title or title)
                            raw_json_p.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
                            log_msg(f"  -> Trích xuất thành công {raw['total_extracted']} câu từ Study4 /details/!")

                        cookies = ctx.cookies(STUDY4_BASE)
                        meta, val_errs = build_and_commit_study4_test(
                            session, translator, raw, url, cookies,
                            override_year=yr, override_test_num=tnum, force=args.force,
                        )
                        if meta and not val_errs:
                            q_item["status"] = "done"
                            q_item["error"] = None
                            q_item["question_count"] = meta["questionCount"]
                            q_item["part_counts"] = meta["partCounts"]
                            q_item["updated_at"] = datetime.now(timezone.utc).isoformat()
                            completed_this_run += 1
                            audio_mb = get_dir_size_mb(AUDIO_BASE_DIR)
                            pc = meta["partCounts"]
                            log_msg(
                                f"  [LIVE COMMIT OK] {tid}.json ({meta['questionCount']} câu: "
                                f"P1:{pc['1']} P2:{pc['2']} P3:{pc['3']} P4:{pc['4']} P5:{pc['5']} P6:{pc['6']} P7:{pc['7']}) "
                                f"| Audio tổng: {audio_mb} MB | Tiến độ: {done_so_far + completed_this_run}/{total_q}"
                            )
                        else:
                            q_item["status"] = "failed"
                            q_item["error"] = "; ".join(val_errs[:5])
                            q_item["updated_at"] = datetime.now(timezone.utc).isoformat()
                            failed_this_run += 1
                            log_msg(f"  [FAILED SCHEMA] {tid}: {q_item['error']} -> Bỏ qua và chuyển đề kế tiếp.")

                        save_queue(queue_obj)
                        translator.save()
                        session.save_state()

                    except SafeStopError as sse:
                        try:
                            err_img = CACHE_DIR / f"error_{tid}.png"
                            page.screenshot(path=str(err_img), full_page=False)
                            log_msg(f"  -> Đã chụp màn hình Safe-Stop: {err_img}")
                        except Exception:
                            pass
                        log_msg(f"[SAFE-STOP] DỪNG KHẨN CẤP BẢO VỆ TÀI KHOẢN: {sse}")
                        save_queue(queue_obj)
                        break
                    except Exception as exc:
                        tb_str = traceback.format_exc()
                        err_img = CACHE_DIR / f"error_{tid}.png"
                        try:
                            page.screenshot(path=str(err_img), full_page=False)
                            log_msg(f"  -> Đã chụp màn hình lỗi: {err_img}")
                        except Exception as sc_err:
                            log_msg(f"  -> Không chụp được ảnh lỗi: {sc_err}")
                        q_item["status"] = "failed"
                        q_item["error"] = str(exc)[:300]
                        q_item["updated_at"] = datetime.now(timezone.utc).isoformat()
                        failed_this_run += 1
                        save_queue(queue_obj)
                        log_msg(f"  [FAILED ERROR] {tid}: {exc}\n{tb_str}  -> Mở lại tab mới và chuyển sang đề kế tiếp.")
                        page = reset_browser_tab(ctx, page)

                    # Account-safe cooldown between tests
                    if idx < len(pending_items):
                        if completed_this_run > 0 and completed_this_run % 5 == 0:
                            log_msg("[Cooldown] Đã hoàn thành chẵn 5 đề — nghỉ 60 giây bảo vệ tài khoản Study4 ...")
                            time.sleep(60)
                        else:
                            wait_s = random.uniform(15.0, 25.0)
                            log_msg(f"[Cooldown] Nghỉ {wait_s:.1f} giây trước khi cào đề tiếp theo ...")
                            time.sleep(wait_s)
            finally:
                ctx.close()

        log_msg("=" * 74)
        log_msg(
            f"KẾT THÚC PHIÊN AUTO-ETS: hoàn thành mới={completed_this_run}, lỗi={failed_this_run}, "
            f"Audio tổng={get_dir_size_mb(AUDIO_BASE_DIR)} MB"
        )
        log_msg("=" * 74)
    finally:
        release_lock()


def main():
    install_global_exception_logging()
    parser = argparse.ArgumentParser(description="Study4 Authenticated TOEIC Auto-Queue Crawler")
    parser.add_argument("--login", action="store_true", help="Mở Chrome thật tới study4.com/login/ để tự đăng nhập & lưu phiên")
    parser.add_argument("--auto-ets-2021-2026", action="store_true", help="Tự động quét & cào cuốn chiếu các bộ đề ETS 2021-2026")
    parser.add_argument("--per-year", type=int, default=5, help="Số đề tối đa mỗi năm (mặc định 5; 0 = lấy toàn bộ)")
    parser.add_argument("--discover-only", action="store_true", help="Chỉ quét và lưu scripts/cache/ets_queue.json")
    parser.add_argument("--resume", action="store_true", help="Tiếp tục cào các đề pending trong ets_queue.json")
    parser.add_argument("--limit", type=int, default=0, help="Giới hạn số đề xử lý trong 1 lần chạy (0 = không giới hạn)")
    parser.add_argument("--only-ids", nargs="+", default=None, help="Chỉ cào các test_id cụ thể đang pending trong ets_queue.json")
    parser.add_argument("--background", action="store_true", help="Đẩy cửa sổ Chrome ra ngoài màn hình khi chạy tiến trình nền")
    parser.add_argument("--headless", action="store_true", help="Chạy Chromium headless (không khuyến nghị nếu bị Cloudflare)")
    parser.add_argument("--urls", nargs="+", default=None, help="Danh sách link đề Study4 cụ thể")
    parser.add_argument("--max-tests", type=int, default=0, help="Cào tối đa N đề mới nhất từ Study4")
    parser.add_argument("--force", action="store_true", help="Ghi đè đề đã cào trước đó")
    args = parser.parse_args()

    if args.login:
        run_login_mode()
        return

    if args.auto_ets_2021_2026:
        run_auto_ets_2021_2026(args)
        return

    if not args.urls and args.max_tests <= 0:
        parser.print_help()
        return

    if not acquire_lock():
        sys.exit(2)

    session = CrawlSession()
    translator = BatchViTranslator()
    try:
        with sync_playwright() as p:
            ctx = launch_study4_browser(p, headless=args.headless, background_window=args.background)
            page = configure_page_guards(ctx.pages[0] if ctx.pages else ctx.new_page())
            try:
                if args.urls:
                    targets = list(args.urls)
                else:
                    q_obj = discover_ets_2021_2026_queue(page, per_year=10, interactive=True)
                    targets = [x["url"] for x in q_obj["items"] if x["status"] == "pending"][: args.max_tests]

                for idx, url in enumerate(targets, 1):
                    slug_key = re.sub(r"[^a-z0-9]+", "_", urlparse(url).path.lower()).strip("_")[:60]
                    raw_json_p = RAW_CACHE_DIR / f"{slug_key}.json"
                    raw_html_p = RAW_CACHE_DIR / f"{slug_key}_details.html"
                    if raw_json_p.exists() and not args.force:
                        raw = json.loads(raw_json_p.read_text(encoding="utf-8"))
                    else:
                        det_url, fb_title = navigate_to_details_page(page, url, interactive=True)
                        html_txt = page.content()
                        raw_html_p.write_text(html_txt, encoding="utf-8")
                        raw = extract_study4_details_html(html_txt, det_url, fb_title)
                        raw_json_p.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")

                    cookies = ctx.cookies(STUDY4_BASE)
                    meta, errs = build_and_commit_study4_test(session, translator, raw, url, cookies, force=args.force)
                    if meta:
                        log_msg(f"[OK] Đã xuất & live-commit {meta['id']} ({meta['questionCount']} câu)")
                    else:
                        log_msg(f"[ERR] {url}: {errs}")
                    if idx < len(targets):
                        polite_delay(15.0, 22.0)
            finally:
                ctx.close()
    finally:
        translator.save()
        session.save_state()
        release_lock()


if __name__ == "__main__":
    main()
