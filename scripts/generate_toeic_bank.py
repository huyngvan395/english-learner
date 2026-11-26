#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/generate_toeic_bank.py
==============================
Automated ETS TOEIC (2024–2026) Exam Bank + 7-Part Topic Drills + Real MP3 Audio Generator.

Outputs (100% Lazy-Loading Architecture):
  - public/data/toeic/tests-meta.json         (All 8 ETS 2024–2026 Test cards)
  - public/data/toeic/tests/<testId>.json     (3 Complete 7-Part ETS Tests: 50 Qs each = 150 Qs)
  - public/data/toeic/drills-meta.json        (37 Topic Drills across Part 1–7)
  - public/data/toeic/drills/<drillId>.json   (208 NEW non-overlapping drill Qs)
  - public/audio/toeic/*.mp3                  (110 real multi-voice US/UK/AU MP3 files via edge-tts)
  - public/images/part1/*.jpg                 (Real high-res Part 1 photographs)

Usage:
    python scripts/generate_toeic_bank.py
    python scripts/generate_toeic_bank.py --concurrency 6
"""

import argparse
import asyncio
import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple

import edge_tts
import imageio_ffmpeg
import requests
from pydub import AudioSegment

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()
ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT_DIR / "scripts"
PUBLIC_DIR = ROOT_DIR / "public"
TOEIC_DATA_DIR = PUBLIC_DIR / "data" / "toeic"
TESTS_DIR = TOEIC_DATA_DIR / "tests"
DRILLS_DIR = TOEIC_DATA_DIR / "drills"
AUDIO_DIR = PUBLIC_DIR / "audio" / "toeic"
IMAGES_DIR = PUBLIC_DIR / "images" / "part1"
TIMINGS_CACHE_PATH = SCRIPTS_DIR / "cache" / "toeic_audio_timings.json"

sys.path.insert(0, str(SCRIPTS_DIR))
from toeic_banks.part1_2_bank import EXTRA_PART1_PHOTOS, PART1_SETS, PART2_SETS
from toeic_banks.part3_4_bank import PART3_SETS, PART4_SETS
from toeic_banks.part5_bank import PART5_SETS
from toeic_banks.part6_7_bank import PART6_SETS, PART7_SETS
from toeic_banks.ets_2025_test2_bank import (
    E25T2_PART1,
    E25T2_PART2,
    E25T2_PART3,
    E25T2_PART4,
    E25T2_PART5,
    E25T2_PART6,
    E25T2_PART7,
)

# Register ETS 2025 Test 2 seamlessly into the master sets
PART1_SETS["ets-2025-test-2"] = E25T2_PART1
PART2_SETS["ets-2025-test-2"] = E25T2_PART2
PART3_SETS["ets-2025-test-2"] = E25T2_PART3
PART4_SETS["ets-2025-test-2"] = E25T2_PART4
PART5_SETS["ets-2025-test-2"] = E25T2_PART5
PART6_SETS["ets-2025-test-2"] = E25T2_PART6
PART7_SETS["ets-2025-test-2"] = E25T2_PART7

# ==============================================================================
# ETS TEST METADATA (ALL 8 TESTS ACROSS 2024, 2025, 2026)
# ==============================================================================
ETS_TEST_BLUEPRINTS: List[Dict[str, Any]] = [
    {
        "id": "ets-2024-test-1",
        "series": "ETS TOEIC 2024",
        "year": 2024,
        "testNumber": 1,
        "title": "ETS TOEIC 2024 — Test 1",
        "subtitle": "Bộ đề chuẩn ETS 2024 đầy đủ 7 Part (Listening MP3 đa giọng US/UK/AU + Reading 5 lớp & Bảng biểu).",
        "badge": "ETS 2024 • READY",
        "status": "ready",
        "durationMinutes": 45,
        "miniDurationMinutes": 22,
    },
    {
        "id": "ets-2024-test-2",
        "series": "ETS TOEIC 2024",
        "year": 2024,
        "testNumber": 2,
        "title": "ETS TOEIC 2024 — Test 2",
        "subtitle": "Tăng cường bẫy câu trả lời gián tiếp Part 2 và đọc hiểu Double/Triple Passage Part 7.",
        "badge": "MỞ RỘNG QUA SCRIPT",
        "status": "planned",
        "durationMinutes": 120,
        "miniDurationMinutes": 60,
    },
    {
        "id": "ets-2024-test-3",
        "series": "ETS TOEIC 2024",
        "year": 2024,
        "testNumber": 3,
        "title": "ETS TOEIC 2024 — Test 3",
        "subtitle": "Đề thực chiến độ khó cao với hội thoại 3 người Part 3 và bẫy Paraphrase tài chính Part 7.",
        "badge": "MỞ RỘNG QUA SCRIPT",
        "status": "planned",
        "durationMinutes": 120,
        "miniDurationMinutes": 60,
    },
    {
        "id": "ets-2025-test-1",
        "series": "ETS TOEIC 2025",
        "year": 2025,
        "testNumber": 1,
        "title": "ETS TOEIC 2025 — Test 1",
        "subtitle": "Đề ETS 2025 mới nhất: Hội thoại 3 người Part 3, Hàm ý người nói, Chuỗi tin nhắn Chat & Double Passage.",
        "badge": "ETS 2025 • HOT",
        "status": "ready",
        "durationMinutes": 45,
        "miniDurationMinutes": 22,
    },
    {
        "id": "ets-2025-test-2",
        "series": "ETS TOEIC 2025",
        "year": 2025,
        "testNumber": 2,
        "title": "ETS TOEIC 2025 — Test 2",
        "subtitle": "Bộ đề mở rộng 72 câu chuẩn 50/50 (36 Listening + 36 Reading): đủ 7 Part, Bảng biểu, Hàm ý, Hội thoại 3 người & Triple Passage.",
        "badge": "ETS 2025 • NEW 72 CÂU",
        "status": "ready",
        "durationMinutes": 60,
        "miniDurationMinutes": 30,
    },
    {
        "id": "ets-2025-test-3",
        "series": "ETS TOEIC 2025",
        "year": 2025,
        "testNumber": 3,
        "title": "ETS TOEIC 2025 — Test 3",
        "subtitle": "Đề mô phỏng độ khó mục tiêu 850–990 với giọng Úc/Anh đan xen tốc độ cao.",
        "badge": "MỞ RỘNG QUA SCRIPT",
        "status": "planned",
        "durationMinutes": 120,
        "miniDurationMinutes": 60,
    },
    {
        "id": "ets-2026-test-1",
        "series": "ETS TOEIC 2026 (New Format Practice)",
        "year": 2026,
        "testNumber": 1,
        "title": "ETS TOEIC 2026 — Test 1 (New Format)",
        "subtitle": "Đề xu hướng mới 2026: Bảng biểu lịch hội thảo, Triple Passage 3 văn bản liên kết & ngữ cảnh AI/Xanh.",
        "badge": "NEW 2026 • READY",
        "status": "ready",
        "durationMinutes": 45,
        "miniDurationMinutes": 22,
    },
    {
        "id": "ets-2026-test-2",
        "series": "ETS TOEIC 2026 (New Format Practice)",
        "year": 2026,
        "testNumber": 2,
        "title": "ETS TOEIC 2026 — Test 2 (New Format)",
        "subtitle": "Luyện tốc độ xử lý đề mới 2026 với bài đọc thương mại điện tử & bẫy suy luận nâng cao.",
        "badge": "MỞ RỘNG QUA SCRIPT",
        "status": "planned",
        "durationMinutes": 120,
        "miniDurationMinutes": 60,
    },
]

# ==============================================================================
# 37 TOPIC DRILLS ACROSS PART 1 -> PART 7 (208 NEW UNIQUE QUESTIONS)
# ==============================================================================
DRILL_BLUEPRINTS: List[Dict[str, Any]] = [
    # Part 1 (4 drills)
    {"id": "drill-p1-single", "part": 1, "title": "Tả 1 người — Hành động & Tư thế", "subtitle": "Luyện nghe chuẩn động từ V-ing & tư thế người tại văn phòng, nhà bếp.", "focusTag": "Single Person", "difficulty": "Cơ bản", "estimatedMinutes": 5},
    {"id": "drill-p1-multiple", "part": 1, "title": "Tả nhiều người — Tương tác công sở", "subtitle": "Phân biệt nhóm người họp hành, thảo luận và hành động bẫy.", "focusTag": "Multiple People", "difficulty": "Trung bình", "estimatedMinutes": 5},
    {"id": "drill-p1-objects", "part": 1, "title": "Tả vật & Khung cảnh (Không người)", "subtitle": "Làm chủ từ vựng trạng thái tĩnh: unoccupied, lined up, display racks.", "focusTag": "Objects & Scenes", "difficulty": "Trung bình", "estimatedMinutes": 5},
    {"id": "drill-p1-passive", "part": 1, "title": "Bẫy Hiện tại tiếp diễn bị động (is being + V3)", "subtitle": "Trị dứt điểm bẫy 'being + V3' kinh điển trong tranh không có người.", "focusTag": "Passive Trap", "difficulty": "Thực chiến ETS", "estimatedMinutes": 6},

    # Part 2 (6 drills)
    {"id": "drill-p2-wh-people", "part": 2, "title": "Câu hỏi Who / Where / When", "subtitle": "Bắt nhanh tên người, phòng ban, vị trí số và mốc thời gian.", "focusTag": "Who / Where / When", "difficulty": "Cơ bản", "estimatedMinutes": 6},
    {"id": "drill-p2-wh-detail", "part": 2, "title": "Câu hỏi What / Which / How / Why", "subtitle": "Phân biệt How much / How often / Why bỏ 'Because' và bẫy lặp từ.", "focusTag": "What / Which / How / Why", "difficulty": "Trung bình", "estimatedMinutes": 7},
    {"id": "drill-p2-yesno-or", "part": 2, "title": "Yes/No & Câu hỏi lựa chọn (Or)", "subtitle": "Thành thạo đáp án không dùng Yes/No và câu trả lời kết hợp cả hai phương án.", "focusTag": "Yes/No & Or", "difficulty": "Trung bình", "estimatedMinutes": 7},
    {"id": "drill-p2-tag-neg", "part": 2, "title": "Câu hỏi đuôi (Tag) & Câu hỏi phủ định", "subtitle": "Không bị lừa bởi 'Didn't/Isn't/Haven't' và luyện đính chính với 'Actually'.", "focusTag": "Tag & Negative", "difficulty": "Nâng cao", "estimatedMinutes": 7},
    {"id": "drill-p2-statements", "part": 2, "title": "Câu trần thuật (Statements)", "subtitle": "Phản xạ đề xuất giải pháp, đồng cảm và tiếp nhận thông báo công sở.", "focusTag": "Statements", "difficulty": "Nâng cao", "estimatedMinutes": 7},
    {"id": "drill-p2-indirect-traps", "part": 2, "title": "Chuyên đề Trả lời gián tiếp & Bẫy đồng âm", "subtitle": "Chinh phục mức 850+: câu hỏi ngược, chuyển người trả lời & bẫy copy/coffee, board, check.", "focusTag": "Indirect & Homophones", "difficulty": "Thực chiến ETS", "estimatedMinutes": 8},

    # Part 3 (5 drills)
    {"id": "drill-p3-office-hr", "part": 3, "title": "Hội thoại Văn phòng & Nhân sự", "subtitle": "Tuyển dụng vòng cuối, giờ làm linh hoạt và phân công dự án.", "focusTag": "Office & HR", "difficulty": "Cơ bản", "estimatedMinutes": 8},
    {"id": "drill-p3-shopping-travel", "part": 3, "title": "Mua sắm, Dịch vụ & Du lịch", "subtitle": "Đổi trả hàng hóa, miễn phí đổi vé tàu và xử lý trễ chuyến bay.", "focusTag": "Shopping & Travel", "difficulty": "Trung bình", "estimatedMinutes": 8},
    {"id": "drill-p3-graphic", "part": 3, "title": "Dạng câu hỏi Bảng biểu / Sơ đồ (Graphic)", "subtitle": "Kết hợp đồng thời 2–3 điều kiện trong audio để loại trừ bảng giá cước & sơ đồ tầng.", "focusTag": "Graphic Table", "difficulty": "Thực chiến ETS", "estimatedMinutes": 9},
    {"id": "drill-p3-implied", "part": 3, "title": "Dạng câu hỏi Hàm ý người nói (Implied Meaning)", "subtitle": "Giải mã thành ngữ và ẩn ý ('at a snail's pace', so sánh chi phí) trong ngữ cảnh.", "focusTag": "Implied Meaning", "difficulty": "Nâng cao", "estimatedMinutes": 9},
    {"id": "drill-p3-three-speakers", "part": 3, "title": "Hội thoại 3 người (3-Speaker Discussions)", "subtitle": "Theo dõi chính xác vai trò từng nhân vật trong họp kỹ thuật và triển lãm.", "focusTag": "3 Speakers", "difficulty": "Thực chiến ETS", "estimatedMinutes": 9},

    # Part 4 (5 drills)
    {"id": "drill-p4-voicemail", "part": 4, "title": "Tin nhắn thoại (Phone Messages)", "subtitle": "Nhắc lịch hẹn y tế, báo giao nhầm vật liệu và yêu cầu gọi lại.", "focusTag": "Phone Messages", "difficulty": "Cơ bản", "estimatedMinutes": 8},
    {"id": "drill-p4-announcement", "part": 4, "title": "Thông báo nội bộ & Giao thông", "subtitle": "Diễn tập PCCC tòa nhà và thông báo trên tàu tốc hành.", "focusTag": "Announcements", "difficulty": "Trung bình", "estimatedMinutes": 8},
    {"id": "drill-p4-advertisement", "part": 4, "title": "Quảng cáo & Radio", "subtitle": "Bắt nhanh ưu đãi dùng thử, mã giảm giá và lợi ích sản phẩm dịch vụ.", "focusTag": "Advertisements", "difficulty": "Trung bình", "estimatedMinutes": 8},
    {"id": "drill-p4-tour-event", "part": 4, "title": "Hướng dẫn tham quan & Sự kiện", "subtitle": "Quy định tham quan nhà kính thực vật và lễ trao giải thiết kế.", "focusTag": "Tours & Events", "difficulty": "Trung bình", "estimatedMinutes": 8},
    {"id": "drill-p4-graphic-implied", "part": 4, "title": "Bài nói có Bảng biểu & Hàm ý người nói", "subtitle": "Kết hợp bảng điều phối xe lạnh & bảng doanh số quý với câu hỏi ẩn ý.", "focusTag": "Graphic & Implied", "difficulty": "Thực chiến ETS", "estimatedMinutes": 10},

    # Part 5 (10 drills)
    {"id": "drill-p5-word-forms", "part": 5, "title": "Chuyên đề 1: Từ loại (Word Forms)", "subtitle": "Phân biệt nhanh Danh/Động/Tính/Trạng từ và cặp dễ nhầm confident/confidential.", "focusTag": "Word Forms", "difficulty": "Cơ bản", "estimatedMinutes": 5},
    {"id": "drill-p5-tenses", "part": 5, "title": "Chuyên đề 2: Thì động từ (Verb Tenses)", "subtitle": "Làm chủ Hiện tại hoàn thành với 'For the past', 'Once' và Quá khứ hoàn thành.", "focusTag": "Verb Tenses", "difficulty": "Cơ bản", "estimatedMinutes": 5},
    {"id": "drill-p5-sva", "part": 5, "title": "Chuyên đề 3: Sự hòa hợp chủ–vị (SVA)", "subtitle": "Tránh bẫy chủ ngữ V-ing, 'along with', 'The number of' và danh từ không đếm được.", "focusTag": "Subject–Verb", "difficulty": "Trung bình", "estimatedMinutes": 6},
    {"id": "drill-p5-passive", "part": 5, "title": "Chuyên đề 4: Thể bị động (Passive Voice)", "subtitle": "Nhận diện bị động sau Modal, 'had to be V3' và trạng từ kẹp giữa 'are automatically V3'.", "focusTag": "Passive Voice", "difficulty": "Trung bình", "estimatedMinutes": 6},
    {"id": "drill-p5-relative", "part": 5, "title": "Chuyên đề 5: Mệnh đề quan hệ & Rút gọn", "subtitle": "Thành thạo rút gọn V-ing/V3, trạng từ 'where' và 'two of which'.", "focusTag": "Relative Clauses", "difficulty": "Nâng cao", "estimatedMinutes": 6},
    {"id": "drill-p5-participles", "part": 5, "title": "Chuyên đề 6: Phân từ V-ing / V-ed", "subtitle": "Phân biệt tính từ cảm xúc, rút gọn đầu câu và 'find + O + V-ing'.", "focusTag": "Participles", "difficulty": "Trung bình", "estimatedMinutes": 6},
    {"id": "drill-p5-prep-conj", "part": 5, "title": "Chuyên đề 7: Giới từ & Liên từ", "subtitle": "Trọn bộ cặp bẫy 'by/until', 'Notwithstanding', 'provided that' và cụm giới từ cố định.", "focusTag": "Prep & Conj", "difficulty": "Thực chiến ETS", "estimatedMinutes": 6},
    {"id": "drill-p5-comp-cond", "part": 5, "title": "Chuyên đề 8: So sánh & Câu điều kiện", "subtitle": "Trạng từ nhấn mạnh so sánh hơn ('significantly') và đảo ngữ 'Were S to V'.", "focusTag": "Comp & Cond", "difficulty": "Nâng cao", "estimatedMinutes": 6},
    {"id": "drill-p5-pronouns", "part": 5, "title": "Chuyên đề 9: Đại từ & Từ hạn định", "subtitle": "Phân biệt phản thân 'itself', 'that/those', 'another/other' và 'Anyone who'.", "focusTag": "Pronouns", "difficulty": "Trung bình", "estimatedMinutes": 5},
    {"id": "drill-p5-collocations", "part": 5, "title": "Chuyên đề 10: Từ vựng & Collocations công sở", "subtitle": "Bộ cụm ăn điểm Part 5: comply with, take into account, go into effect, inclement weather.", "focusTag": "Collocations", "difficulty": "Thực chiến ETS", "estimatedMinutes": 6},

    # Part 6 (3 drills)
    {"id": "drill-p6-email-letter", "part": 6, "title": "Email & Thư thương mại (Sentence Insertion)", "subtitle": "Xử lý khiếu nại giao thiếu hàng & thư mời tài trợ — luyện bắt từ quy chiếu điền câu.", "focusTag": "Email / Letter", "difficulty": "Trung bình", "estimatedMinutes": 10},
    {"id": "drill-p6-memo-notice", "part": 6, "title": "Memo & Thông báo nội bộ (Từ nối ngữ cảnh)", "subtitle": "Quy định đặt phòng họp & bảo trì HVAC — chọn từ nối chuẩn mạch lập luận.", "focusTag": "Memo / Notice", "difficulty": "Trung bình", "estimatedMinutes": 10},
    {"id": "drill-p6-ad-article", "part": 6, "title": "Quảng cáo & Bài báo kinh tế", "subtitle": "Khóa học phân tích dữ liệu & phà điện xanh — luyện phân từ và từ vựng báo chí.", "focusTag": "Ad / Article", "difficulty": "Nâng cao", "estimatedMinutes": 10},

    # Part 7 (4 drills)
    {"id": "drill-p7-single", "part": 7, "title": "Single Passage — Email, Text Chain & Notice", "subtitle": "3 bài đọc đơn chuẩn ETS gồm Email khuyến mãi, Chuỗi chat kỹ thuật và Thông báo tủ nhận hàng.", "focusTag": "Single Passage", "difficulty": "Cơ bản", "estimatedMinutes": 12},
    {"id": "drill-p7-double", "part": 7, "title": "Double Passage — Liên kết 2 văn bản", "subtitle": "2 bộ bài đọc kép rèn kỹ năng tính ngày chính sách vé & đối chiếu bảng giá hợp đồng.", "focusTag": "Double Passage", "difficulty": "Thực chiến ETS", "estimatedMinutes": 14},
    {"id": "drill-p7-triple", "part": 7, "title": "Triple Passage — Tổng hợp 3 văn bản", "subtitle": "Bộ 3 văn bản Lễ hội Sách (Bài báo + Bảng phí + Email) luyện tính tổng chi phí liên kết.", "focusTag": "Triple Passage", "difficulty": "Nâng cao", "estimatedMinutes": 12},
    {"id": "drill-p7-skills", "part": 7, "title": "Chuyên đề Suy luận, NOT/TRUE, Vocab & Điền câu [1-4]", "subtitle": "Luyện riêng các dạng câu hỏi phân loại 850–990 điểm trong Part 7.", "focusTag": "Inference & Skills", "difficulty": "Thực chiến ETS", "estimatedMinutes": 14},
]


def ensure_part1_photos() -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    fallback_photo = IMAGES_DIR / "part1_office_desk.jpg"
    for filename, url in EXTRA_PART1_PHOTOS.items():
        target = IMAGES_DIR / filename
        if target.exists() and target.stat().st_size > 10_000:
            continue
        print(f"  [Photo] Downloading {filename}...", flush=True)
        try:
            resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200 and len(resp.content) > 10_000:
                target.write_bytes(resp.content)
                continue
        except Exception as e:
            print(f"    ! Warning downloading {filename}: {e}", flush=True)
        if fallback_photo.exists():
            target.write_bytes(fallback_photo.read_bytes())


async def synth_segment(text: str, voice: str, out_mp3: Path) -> None:
    comm = edge_tts.Communicate(text=text, voice=voice, rate="+0%")
    await comm.save(str(out_mp3))


async def render_track(
    sem: asyncio.Semaphore,
    track_key: str,
    segments: List[Tuple[str, str, str]],
    output_mp3: Path,
    pause_ms: int,
    timings_cache: Dict[str, Dict[str, List[int]]],
) -> Dict[str, Tuple[int, int]]:
    # Incremental cache: reuse if MP3 exists (>5KB) and all segment keys are cached
    if output_mp3.exists() and output_mp3.stat().st_size > 5_000 and track_key in timings_cache:
        cached = timings_cache[track_key]
        if all(seg[0] in cached for seg in segments):
            return {k: (v[0], v[1]) for k, v in cached.items()}

    async with sem:
        output_mp3.parent.mkdir(parents=True, exist_ok=True)
        silence = AudioSegment.silent(duration=pause_ms)
        combined = AudioSegment.silent(duration=240)
        timings: Dict[str, Tuple[int, int]] = {}

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            for idx, (lid, text, voice) in enumerate(segments):
                seg_mp3 = tmp_path / f"s_{idx}.mp3"
                seg_wav = tmp_path / f"s_{idx}.wav"
                for attempt in range(3):
                    try:
                        await synth_segment(text, voice, seg_mp3)
                        break
                    except Exception:
                        if attempt == 2:
                            raise
                        await asyncio.sleep(0.8 * (attempt + 1))

                subprocess.run(
                    [FFMPEG_BIN, "-y", "-loglevel", "error", "-i", str(seg_mp3), "-ar", "24000", "-ac", "1", str(seg_wav)],
                    check=True,
                )
                clip = AudioSegment.from_wav(str(seg_wav))
                start_ms = len(combined)
                combined += clip
                end_ms = len(combined)
                timings[lid] = (start_ms, end_ms)
                if idx + 1 < len(segments):
                    combined += silence

            combined += AudioSegment.silent(duration=280)
            comb_wav = tmp_path / "comb.wav"
            combined.export(str(comb_wav), format="wav")
            subprocess.run(
                [FFMPEG_BIN, "-y", "-loglevel", "error", "-i", str(comb_wav), "-codec:a", "libmp3lame", "-b:a", "96k", str(output_mp3)],
                check=True,
            )

        timings_cache[track_key] = {k: [v[0], v[1]] for k, v in timings.items()}
        return timings


async def render_listening_collection(
    p1_items: List[Dict[str, Any]],
    p2_items: List[Dict[str, Any]],
    p3_sets: List[Dict[str, Any]],
    p4_sets: List[Dict[str, Any]],
    concurrency: int,
    timings_cache: Dict[str, Dict[str, List[int]]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    sem = asyncio.Semaphore(concurrency)
    p1_out = copy.deepcopy(p1_items)
    p2_out = copy.deepcopy(p2_items)
    p3_out = copy.deepcopy(p3_sets)
    p4_out = copy.deepcopy(p4_sets)

    tasks = []
    done_count = 0
    total_tracks = len(p1_out) + len(p2_out) + len(p3_out) + len(p4_out)

    async def process_p1(item: Dict[str, Any]) -> None:
        nonlocal done_count
        mp3_name = item.pop("audioFile")
        segs = [(t["id"], t["en"], t["voice"]) for t in item["transcript"]]
        timings = await render_track(sem, mp3_name, segs, AUDIO_DIR / mp3_name, 600, timings_cache)
        item["audioUrl"] = f"/audio/toeic/{mp3_name}"
        for t in item["transcript"]:
            t.pop("voice", None)
            t["startMs"], t["endMs"] = timings[t["id"]]
        done_count += 1
        if done_count % 15 == 0 or done_count == total_tracks:
            print(f"  [Audio] {done_count}/{total_tracks} MP3 tracks ready...", flush=True)

    async def process_p2(item: Dict[str, Any]) -> None:
        nonlocal done_count
        mp3_name = item.pop("audioFile")
        qline = item["questionLine"]
        segs = [(qline["id"], qline["en"], qline["voice"])]
        for k in ["A", "B", "C"]:
            opt = item["options"][k]
            segs.append((f"{item['id']}-opt-{k}", f"{k}. {opt['en']}", opt["voice"]))
        timings = await render_track(sem, mp3_name, segs, AUDIO_DIR / mp3_name, 600, timings_cache)
        item["audioUrl"] = f"/audio/toeic/{mp3_name}"
        qline.pop("voice", None)
        qline["startMs"], qline["endMs"] = timings[qline["id"]]
        for k in ["A", "B", "C"]:
            opt = item["options"][k]
            opt.pop("voice", None)
            opt["startMs"], opt["endMs"] = timings[f"{item['id']}-opt-{k}"]
        done_count += 1
        if done_count % 15 == 0 or done_count == total_tracks:
            print(f"  [Audio] {done_count}/{total_tracks} MP3 tracks ready...", flush=True)

    async def process_p34(item: Dict[str, Any]) -> None:
        nonlocal done_count
        mp3_name = item.pop("audioFile")
        segs = [(t["id"], t["en"], t["voice"]) for t in item["transcript"]]
        timings = await render_track(sem, mp3_name, segs, AUDIO_DIR / mp3_name, 380, timings_cache)
        item["audioUrl"] = f"/audio/toeic/{mp3_name}"
        for t in item["transcript"]:
            t.pop("voice", None)
            t["startMs"], t["endMs"] = timings[t["id"]]
        done_count += 1
        if done_count % 15 == 0 or done_count == total_tracks:
            print(f"  [Audio] {done_count}/{total_tracks} MP3 tracks ready...", flush=True)

    for it in p1_out:
        tasks.append(process_p1(it))
    for it in p2_out:
        tasks.append(process_p2(it))
    for it in p3_out:
        tasks.append(process_p34(it))
    for it in p4_out:
        tasks.append(process_p34(it))

    await asyncio.gather(*tasks)
    return p1_out, p2_out, p3_out, p4_out


async def main() -> None:
    parser = argparse.ArgumentParser(description="Generate ETS TOEIC Tests & 7-Part Drills + real MP3 audio.")
    parser.add_argument("--concurrency", type=int, default=6, help="Concurrent edge-tts tracks (default 6)")
    args = parser.parse_args()

    TESTS_DIR.mkdir(parents=True, exist_ok=True)
    DRILLS_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    TIMINGS_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)

    timings_cache: Dict[str, Dict[str, List[int]]] = {}
    if TIMINGS_CACHE_PATH.exists():
        try:
            timings_cache = json.loads(TIMINGS_CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            timings_cache = {}

    print("[1/4] Ensuring all Part 1 photographs exist in public/images/part1/...", flush=True)
    ensure_part1_photos()

    # Collect all listening items across ETS tests and drills for concurrent MP3 rendering
    all_p1: List[Dict[str, Any]] = []
    all_p2: List[Dict[str, Any]] = []
    all_p3: List[Dict[str, Any]] = []
    all_p4: List[Dict[str, Any]] = []
    for k, v in PART1_SETS.items():
        all_p1.extend(v)
    for k, v in PART2_SETS.items():
        all_p2.extend(v)
    for k, v in PART3_SETS.items():
        all_p3.extend(v)
    for k, v in PART4_SETS.items():
        all_p4.extend(v)

    print(
        f"[2/4] Rendering {len(all_p1)+len(all_p2)+len(all_p3)+len(all_p4)} real MP3 tracks "
        f"(P1:{len(all_p1)}, P2:{len(all_p2)}, P3:{len(all_p3)}, P4:{len(all_p4)}) with concurrency={args.concurrency}...",
        flush=True,
    )
    r_p1, r_p2, r_p3, r_p4 = await render_listening_collection(
        all_p1, all_p2, all_p3, all_p4, args.concurrency, timings_cache
    )
    TIMINGS_CACHE_PATH.write_text(json.dumps(timings_cache, ensure_ascii=False), encoding="utf-8")

    # Map rendered items back by ID for clean test & drill assembly
    p1_by_id = {x["id"]: x for x in r_p1}
    p2_by_id = {x["id"]: x for x in r_p2}
    p3_by_id = {x["id"]: x for x in r_p3}
    p4_by_id = {x["id"]: x for x in r_p4}

    print("[3/4] Writing ETS 2024–2026 lazy-loaded Test JSONs & tests-meta.json...", flush=True)
    tests_meta = []
    total_test_qs = 0
    for bp in ETS_TEST_BLUEPRINTS:
        tid = bp["id"]
        if bp["status"] == "ready":
            t_p1 = [p1_by_id[x["id"]] for x in PART1_SETS[tid]]
            t_p2 = [p2_by_id[x["id"]] for x in PART2_SETS[tid]]
            t_p3 = [p3_by_id[x["id"]] for x in PART3_SETS[tid]]
            t_p4 = [p4_by_id[x["id"]] for x in PART4_SETS[tid]]
            t_p5 = copy.deepcopy(PART5_SETS[tid])
            t_p6 = copy.deepcopy(PART6_SETS[tid])
            t_p7 = copy.deepcopy(PART7_SETS[tid])

            c1 = len(t_p1)
            c2 = len(t_p2)
            c3 = sum(len(s["questions"]) for s in t_p3)
            c4 = sum(len(s["questions"]) for s in t_p4)
            c5 = len(t_p5)
            c6 = sum(len(p["questions"]) for p in t_p6)
            c7 = sum(len(s["questions"]) for s in t_p7)
            l_cnt = c1 + c2 + c3 + c4
            r_cnt = c5 + c6 + c7
            q_cnt = l_cnt + r_cnt
            total_test_qs += q_cnt

            test_payload = {
                "id": tid,
                "series": bp["series"],
                "year": bp["year"],
                "title": bp["title"],
                "subtitle": bp["subtitle"],
                "durationMinutes": bp["durationMinutes"],
                "parts": {
                    "part1": t_p1,
                    "part2": t_p2,
                    "part3": t_p3,
                    "part4": t_p4,
                    "part5": t_p5,
                    "part6": t_p6,
                    "part7": t_p7,
                },
            }
            out_p = TESTS_DIR / f"{tid}.json"
            out_p.write_text(json.dumps(test_payload, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  [OK] {out_p.relative_to(ROOT_DIR)} -> {q_cnt} Qs (L:{l_cnt}, R:{r_cnt}) ({out_p.stat().st_size // 1024} KB)")

            tests_meta.append({
                **bp,
                "questionCount": q_cnt,
                "listeningCount": l_cnt,
                "readingCount": r_cnt,
                "partCounts": {"1": c1, "2": c2, "3": c3, "4": c4, "5": c5, "6": c6, "7": c7},
            })
        else:
            tests_meta.append({
                **bp,
                "questionCount": 200,
                "listeningCount": 100,
                "readingCount": 100,
                "partCounts": {"1": 6, "2": 25, "3": 39, "4": 30, "5": 30, "6": 16, "7": 54},
            })

    (TOEIC_DATA_DIR / "tests-meta.json").write_text(json.dumps(tests_meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print("[4/4] Writing 37 lazy-loaded 7-Part Drill JSONs & drills-meta.json...", flush=True)
    drills_meta = []
    total_drill_qs = 0
    for dbp in DRILL_BLUEPRINTS:
        did = dbp["id"]
        part = dbp["part"]
        payload: Dict[str, Any] = {
            "id": did,
            "part": part,
            "title": dbp["title"],
            "subtitle": dbp["subtitle"],
            "focusTag": dbp["focusTag"],
        }
        q_cnt = 0
        if part == 1:
            items = [p1_by_id[x["id"]] for x in PART1_SETS[did]]
            payload["part1"] = items
            q_cnt = len(items)
        elif part == 2:
            items = [p2_by_id[x["id"]] for x in PART2_SETS[did]]
            payload["part2"] = items
            q_cnt = len(items)
        elif part == 3:
            sets = [p3_by_id[x["id"]] for x in PART3_SETS[did]]
            payload["part3"] = sets
            q_cnt = sum(len(s["questions"]) for s in sets)
        elif part == 4:
            sets = [p4_by_id[x["id"]] for x in PART4_SETS[did]]
            payload["part4"] = sets
            q_cnt = sum(len(s["questions"]) for s in sets)
        elif part == 5:
            items = copy.deepcopy(PART5_SETS[did])
            payload["part5"] = items
            q_cnt = len(items)
        elif part == 6:
            passages = copy.deepcopy(PART6_SETS[did])
            payload["part6"] = passages
            q_cnt = sum(len(p["questions"]) for p in passages)
        elif part == 7:
            sets = copy.deepcopy(PART7_SETS[did])
            payload["part7"] = sets
            q_cnt = sum(len(s["questions"]) for s in sets)

        total_drill_qs += q_cnt
        out_d = DRILLS_DIR / f"{did}.json"
        out_d.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        drills_meta.append({**dbp, "questionCount": q_cnt})

    (TOEIC_DATA_DIR / "drills-meta.json").write_text(json.dumps(drills_meta, ensure_ascii=False, indent=2), encoding="utf-8")
    ready_cnt = sum(1 for t in tests_meta if t["status"] == "ready")
    print(f"\nDONE! Generated {ready_cnt} full-7-part ETS tests ({total_test_qs} Qs), {len(drills_meta)} topic drills ({total_drill_qs} Qs), and {len(r_p1)+len(r_p2)+len(r_p3)+len(r_p4)} real MP3 files.")
    print(f"GRAND TOTAL NEW TOEIC QUESTIONS: {total_test_qs + total_drill_qs}")


if __name__ == "__main__":
    asyncio.run(main())
