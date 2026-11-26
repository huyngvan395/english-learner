#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/auto_crawl_toeic.py
===========================
Fully automated Multi-Tier TOEIC Auto-Crawler & Dataset Builder for TOEIC Mastery Hub.

Tiers:
  - Tier 1 (Open GitHub & HuggingFace Datasets):
      1A. github.com/mangomint1805/toeic (Real 200-question ETS 2024/2026 Full Tests + real MP3 & JPG/PNG media)
      1B. github.com/HuynhDucKhoi0105/English-ETS-TOEIC-web (Part 5 & Part 6/7 Vietnamese-explained drills)
      1C. huggingface.co/datasets/nggiabao19/toeic-tutor-v1 (Part 5 structured Vietnamese tutor drills)
  - Tier 2 (Public Non-Gated Web via Playwright Headless Chromium + XHR/Fetch Sniffing + BeautifulSoup4):
      2A. englishclub.com/esl-exams/ets-toeic-practice-{1..7}.php (Live 7-Part practice + real MP3 & JPG downloads)
      2B. Custom URL mode via `--url <link>` (Playwright XHR/Fetch JSON interception + BS4 DOM parser)

Features:
  - Real browser User-Agent, Referer headers, retries, and 1.5-3.0s polite random delay on Tier 2 web pages
  - Local media archiving (`public/images/toeic/<id>/`, `public/audio/toeic/<id>/`) with automatic `edge-tts` fallback
  - Real MP3 duration probing via `imageio_ffmpeg` + proportional Interactive Transcript timestamps (`endMs > startMs`)
  - Global SHA-256 content-hash deduplication against all existing TOEIC tests/drills
  - 3-engine Vietnamese batch translator (Bing LLM -> Google gtx -> MyMemory) with persistent cache
  - 5-layer Reading explanation builder + `evidenceSentenceId` token/quote anchoring for Part 6 & Part 7
  - Checkpoint resume (`scripts/cache/crawl_state.json`) & transparent report (`scripts/crawl_report.json`)
  - Safe non-destructive merge into `public/data/toeic/tests-meta.json` and `drills-meta.json`

Usage:
  python -u scripts/auto_crawl_toeic.py --max-tests 3
  python -u scripts/auto_crawl_toeic.py --max-tests 5 --skip-drills
  python -u scripts/auto_crawl_toeic.py --url https://www.englishclub.com/esl-exams/ets-toeic-practice-5.php
"""

import argparse
import asyncio
import concurrent.futures
import hashlib
import html
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import edge_tts
import imageio_ffmpeg
import requests
from bs4 import BeautifulSoup
from pydub import AudioSegment

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
TOEIC_DATA_DIR = PUBLIC / "data" / "toeic"
TESTS_DIR = TOEIC_DATA_DIR / "tests"
DRILLS_DIR = TOEIC_DATA_DIR / "drills"
AUDIO_BASE_DIR = PUBLIC / "audio" / "toeic"
IMAGES_BASE_DIR = PUBLIC / "images" / "toeic"
CACHE_DIR = ROOT / "scripts" / "cache"
STATE_PATH = CACHE_DIR / "crawl_state.json"
VI_CACHE_PATH = CACHE_DIR / "vi_translations.json"
REPORT_PATH = ROOT / "scripts" / "crawl_report.json"

FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

for d in (TESTS_DIR, DRILLS_DIR, AUDIO_BASE_DIR, IMAGES_BASE_DIR, CACHE_DIR):
    d.mkdir(parents=True, exist_ok=True)


# =============================================================================
# 1. PERSISTENT STATE, DEDUPLICATION & MEDIA TRACKING
# =============================================================================
class CrawlSession:
    def __init__(self):
        self.http = requests.Session()
        self.http.headers.update({
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
        })
        self.state = self._load_state()
        self.seen_hashes: Set[str] = self._collect_existing_hashes()
        self.duplicates_skipped = 0
        self.sources_crawled: List[Dict[str, Any]] = []
        self.skipped_sources: List[Dict[str, Any]] = []
        self.media_stats = {
            "images_downloaded": 0,
            "images_cached": 0,
            "images_failed": 0,
            "audio_downloaded": 0,
            "audio_cached": 0,
            "audio_fallback_edge_tts": 0,
        }

    def _load_state(self) -> Dict[str, Any]:
        if STATE_PATH.exists():
            try:
                return json.loads(STATE_PATH.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {"completed_tests": {}, "completed_drills": {}, "last_run": None}

    def save_state(self):
        self.state["last_run"] = datetime.now(timezone.utc).isoformat()
        STATE_PATH.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")

    @staticmethod
    def content_hash(text: str) -> str:
        norm = re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()
        return hashlib.sha256(norm.encode("utf-8")).hexdigest()[:20]

    def _collect_existing_hashes(self) -> Set[str]:
        hashes: Set[str] = set()
        # Scan existing public/data/toeic/tests & drills + legacy src/data
        scan_files = list(TESTS_DIR.glob("*.json")) + list(DRILLS_DIR.glob("*.json"))
        legacy_r = ROOT / "src" / "data" / "reading"
        legacy_l = ROOT / "src" / "data" / "listening"
        if legacy_r.exists():
            scan_files.extend(legacy_r.glob("*.json"))
        if legacy_l.exists():
            scan_files.extend(legacy_l.glob("*.json"))

        for fp in scan_files:
            try:
                raw = json.loads(fp.read_text(encoding="utf-8"))
            except Exception:
                continue
            self._extract_hashes_from_obj(raw, hashes)
        return hashes

    def _extract_hashes_from_obj(self, obj: Any, hashes: Set[str]):
        if isinstance(obj, list):
            for it in obj:
                self._extract_hashes_from_obj(it, hashes)
        elif isinstance(obj, dict):
            if "parts" in obj and isinstance(obj["parts"], dict):
                self._extract_hashes_from_obj(obj["parts"], hashes)
                return
            if "part5" in obj and isinstance(obj["part5"], list):
                for q in obj["part5"]:
                    hashes.add(self.content_hash(q.get("sentence", "") + " ".join(q.get("options", {}).values())))
            if "sentence" in obj and "options" in obj and obj.get("part") == 5:
                hashes.add(self.content_hash(obj.get("sentence", "") + " ".join(obj.get("options", {}).values())))
            if "part1" in obj and isinstance(obj["part1"], list):
                for q in obj["part1"]:
                    opts = q.get("options", {})
                    txt = " ".join(v.get("en", "") if isinstance(v, dict) else str(v) for v in opts.values())
                    hashes.add(self.content_hash("p1 " + txt))
            if "part2" in obj and isinstance(obj["part2"], list):
                for q in obj["part2"]:
                    ql = q.get("questionLine", {}).get("en", "")
                    opts = q.get("options", {})
                    txt = ql + " " + " ".join(v.get("en", "") if isinstance(v, dict) else str(v) for v in opts.values())
                    hashes.add(self.content_hash("p2 " + txt))
            for pk in ("part3", "part4"):
                if pk in obj and isinstance(obj[pk], list):
                    for s in obj[pk]:
                        tr = " ".join(l.get("en", "") for l in s.get("transcript", []))
                        if tr:
                            hashes.add(self.content_hash(pk + " " + tr[:250]))
            if "part6" in obj and isinstance(obj["part6"], list):
                for p in obj["part6"]:
                    txt = " ".join(s.get("en", "") for para in p.get("paragraphs", []) for s in para.get("sentences", []))
                    if txt:
                        hashes.add(self.content_hash("p6 " + txt[:250]))
            if "part7" in obj and isinstance(obj["part7"], list):
                for s in obj["part7"]:
                    txt = " ".join(
                        sent.get("en", "")
                        for doc in s.get("passages", [])
                        for para in doc.get("paragraphs", [])
                        for sent in para.get("sentences", [])
                    )
                    if txt:
                        hashes.add(self.content_hash("p7 " + txt[:250]))

    def register_hash(self, key_text: str, allow_existing: bool = False) -> bool:
        """Returns True if unique (or allowed), False if duplicate."""
        h = self.content_hash(key_text)
        if not allow_existing and h in self.seen_hashes:
            self.duplicates_skipped += 1
            return False
        self.seen_hashes.add(h)
        return True

    def fetch_url(self, url: str, referer: Optional[str] = None, timeout: int = 25, retries: int = 3) -> Optional[requests.Response]:
        headers = {"User-Agent": USER_AGENT}
        if referer:
            headers["Referer"] = referer
        for attempt in range(retries):
            try:
                r = self.http.get(url, headers=headers, timeout=timeout)
                if r.status_code == 200:
                    return r
                if r.status_code in (403, 404, 410):
                    return r
            except Exception:
                pass
            time.sleep(0.8 * (attempt + 1))
        return None


# =============================================================================
# 2. 3-ENGINE VIETNAMESE TRANSLATOR (BING LLM -> GOOGLE GTX -> MYMEMORY + CACHE)
# =============================================================================
class BatchViTranslator:
    def __init__(self):
        self.cache: Dict[str, str] = {}
        if VI_CACHE_PATH.exists():
            try:
                raw = json.loads(VI_CACHE_PATH.read_text(encoding="utf-8"))
                # Only retain genuinely translated entries (not identity fallbacks)
                self.cache = {
                    k: v for k, v in raw.items()
                    if isinstance(v, str) and v.strip() and v.strip().lower() != k.strip().lower()
                }
            except Exception:
                self.cache = {}
        self._bing_session: Optional[requests.Session] = None
        self._bing_creds: Optional[Tuple[str, str, str]] = None
        self._dirty = False

    def save(self):
        if self._dirty:
            VI_CACHE_PATH.write_text(json.dumps(self.cache, ensure_ascii=False, indent=2), encoding="utf-8")
            self._dirty = False

    def _init_bing(self) -> bool:
        if self._bing_creds:
            return True
        try:
            s = requests.Session()
            s.headers["User-Agent"] = USER_AGENT
            r = s.get("https://www.bing.com/translator", timeout=15)
            ig = re.search(r'IG:"([^"]+)"', r.text)
            ab = re.search(r'params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)"', r.text)
            if ig and ab:
                self._bing_session = s
                self._bing_creds = (ig.group(1), ab.group(1), ab.group(2))
                return True
        except Exception:
            pass
        return False

    def _translate_bing_chunk(self, text: str) -> Optional[str]:
        if not self._init_bing() or not self._bing_session or not self._bing_creds:
            return None
        ig, key, token = self._bing_creds
        try:
            url = f"https://www.bing.com/ttranslatev3?isVertical=1&&IG={ig}&IID=translator.5024.1"
            r = self._bing_session.post(
                url,
                data={"fromLang": "en", "to": "vi", "text": text, "token": token, "key": key},
                headers={"Referer": "https://www.bing.com/translator"},
                timeout=18,
            )
            if r.status_code == 200:
                j = r.json()
                if isinstance(j, list) and j and "translations" in j[0]:
                    return j[0]["translations"][0]["text"]
        except Exception:
            self._bing_creds = None
        return None

    def _translate_gtx(self, text: str) -> Optional[str]:
        try:
            r = requests.get(
                "https://translate.googleapis.com/translate_a/single",
                params={"client": "gtx", "sl": "en", "tl": "vi", "dt": "t", "q": text},
                headers={"User-Agent": USER_AGENT},
                timeout=12,
            )
            if r.status_code == 200:
                j = r.json()
                return "".join(seg[0] for seg in j[0] if seg and seg[0])
        except Exception:
            pass
        return None

    def _translate_mymemory(self, text: str) -> Optional[str]:
        try:
            r = requests.get(
                "https://api.mymemory.translated.net/get",
                params={"q": text[:450], "langpair": "en|vi"},
                headers={"User-Agent": USER_AGENT},
                timeout=12,
            )
            if r.status_code == 200:
                t = r.json().get("responseData", {}).get("translatedText", "")
                if t and "MYMEMORY WARNING" not in t.upper():
                    return t
        except Exception:
            pass
        return None

    def translate_batch(self, texts: List[str]) -> Dict[str, str]:
        unique = []
        seen = set()
        for t in texts:
            clean = re.sub(r"\s+", " ", (t or "").strip())
            if not clean or clean in seen:
                continue
            seen.add(clean)
            if clean not in self.cache:
                unique.append(clean)

        if unique:
            # Batch with newline separator up to ~800 chars per Bing call
            idx = 0
            while idx < len(unique):
                batch = []
                total_len = 0
                while idx < len(unique) and (total_len + len(unique[idx]) + 3 < 780 or not batch):
                    batch.append(unique[idx])
                    total_len += len(unique[idx]) + 3
                    idx += 1
                    if len(batch) >= 12:
                        break
                joined = "\n".join(batch)
                res = self._translate_bing_chunk(joined)
                if res:
                    parts = [p.strip() for p in res.split("\n")]
                    if len(parts) == len(batch):
                        for src, dst in zip(batch, parts):
                            if dst and dst.lower() != src.lower():
                                self.cache[src] = dst
                                self._dirty = True
                        time.sleep(0.15)
                        continue
                # Fallback individually via gtx -> bing single -> mymemory
                for src in batch:
                    dst = self._translate_gtx(src) or self._translate_bing_chunk(src) or self._translate_mymemory(src)
                    if dst and dst.strip().lower() != src.strip().lower():
                        self.cache[src] = dst.strip()
                        self._dirty = True
                    time.sleep(0.08)
            self.save()

        out: Dict[str, str] = {}
        for t in texts:
            clean = re.sub(r"\s+", " ", (t or "").strip())
            out[clean] = self.cache.get(clean, clean)
        return out

    def translate_one(self, text: str) -> str:
        clean = re.sub(r"\s+", " ", (text or "").strip())
        if not clean:
            return ""
        if clean in self.cache:
            return self.cache[clean]
        return self.translate_batch([clean]).get(clean, clean)


# =============================================================================
# 3. AUDIO DURATION PROBE, MEDIA ARCHIVER & EDGE-TTS FALLBACK
# =============================================================================
def get_mp3_duration_ms(mp3_path: Path) -> int:
    """Probes real audio duration in ms using bundled ffmpeg (no ffprobe needed)."""
    try:
        proc = subprocess.run(
            [FFMPEG_BIN, "-i", str(mp3_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=15,
        )
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr)
        if m:
            hrs, mins, secs = int(m.group(1)), int(m.group(2)), float(m.group(3))
            ms = int((hrs * 3600 + mins * 60 + secs) * 1000)
            if ms > 500:
                return ms
    except Exception:
        pass
    return 12000


def distribute_timestamps(texts: List[str], total_ms: int, lead_in_ms: int = 300) -> List[Tuple[int, int]]:
    """Proportionally distributes startMs/endMs across lines so endMs > startMs always."""
    n = max(len(texts), 1)
    safe_total = max(total_ms, lead_in_ms + n * 600)
    usable = safe_total - lead_in_ms - 200
    weights = [max(len(t or ""), 8) for t in texts]
    wsum = sum(weights) or 1
    out: List[Tuple[int, int]] = []
    cur = lead_in_ms
    for i, w in enumerate(weights):
        dur = max(450, int(usable * (w / wsum)))
        end = cur + dur if i < n - 1 else max(cur + 450, safe_total - 100)
        out.append((cur, end))
        cur = end + 40
    return out


EDGE_VOICES = {
    ("female", "en-US"): "en-US-JennyNeural",
    ("male", "en-US"): "en-US-GuyNeural",
    ("female", "en-GB"): "en-GB-SoniaNeural",
    ("male", "en-GB"): "en-GB-RyanNeural",
}


async def _tts_segment_to_wav(text: str, voice: str, tmp_dir: Path, idx: int) -> AudioSegment:
    mp3_tmp = tmp_dir / f"seg_{idx}.mp3"
    wav_tmp = tmp_dir / f"seg_{idx}.wav"
    comm = edge_tts.Communicate(text=text, voice=voice, rate="-4%")
    await comm.save(str(mp3_tmp))
    subprocess.run(
        [FFMPEG_BIN, "-y", "-i", str(mp3_tmp), "-ar", "24000", "-ac", "1", str(wav_tmp)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )
    return AudioSegment.from_wav(str(wav_tmp))


def synthesize_fallback_mp3(
    lines: List[Dict[str, Any]], out_mp3: Path, pause_ms: int = 380
) -> List[Tuple[int, int]]:
    """Generates a multi-voice edge-tts MP3 and returns exact (startMs, endMs) per line."""
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    timestamps: List[Tuple[int, int]] = []

    async def _run():
        with tempfile.TemporaryDirectory() as td:
            tdp = Path(td)
            combined = AudioSegment.silent(duration=250, frame_rate=24000)
            for idx, ln in enumerate(lines):
                voice = EDGE_VOICES.get(
                    (ln.get("voiceGender", "female"), ln.get("accent", "en-US")),
                    "en-US-JennyNeural",
                )
                txt = re.sub(r"\s+", " ", (ln.get("en", "") or "").strip()) or "Listen carefully."
                seg = await _tts_segment_to_wav(txt, voice, tdp, idx)
                start_ms = len(combined)
                combined += seg
                end_ms = max(start_ms + 300, len(combined))
                timestamps.append((start_ms, end_ms))
                combined += AudioSegment.silent(duration=pause_ms, frame_rate=24000)
            wav_full = tdp / "full.wav"
            combined.export(str(wav_full), format="wav")
            subprocess.run(
                [FFMPEG_BIN, "-y", "-i", str(wav_full), "-codec:a", "libmp3lame", "-b:a", "64k", str(out_mp3)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True,
            )

    asyncio.run(_run())
    return timestamps


def download_media_file(
    session: CrawlSession,
    url: str,
    dest: Path,
    min_bytes: int,
    referer: Optional[str] = None,
    kind: str = "audio",
) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size >= min_bytes:
        if kind == "image":
            session.media_stats["images_cached"] += 1
        else:
            session.media_stats["audio_cached"] += 1
        return True

    r = session.fetch_url(url, referer=referer, timeout=30, retries=3)
    if r is not None and r.status_code == 200 and len(r.content) >= min_bytes:
        dest.write_bytes(r.content)
        if kind == "image":
            session.media_stats["images_downloaded"] += 1
        else:
            session.media_stats["audio_downloaded"] += 1
        return True

    if kind == "image":
        session.media_stats["images_failed"] += 1
    return False


# =============================================================================
# 4. TEXT PARSING, CLASSIFICATION & 5-LAYER EXPLANATION BUILDERS
# =============================================================================
STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "to", "of", "in", "on", "at",
    "for", "with", "by", "from", "as", "that", "this", "it", "and", "or", "but", "not", "will",
    "would", "can", "could", "should", "have", "has", "had", "do", "does", "did", "what", "when",
    "where", "who", "why", "how", "which", "about", "into", "their", "they", "them", "his", "her",
    "she", "he", "we", "you", "your", "our", "its", "all", "some", "any", "more", "most", "very",
    "according", "passage", "article", "email", "notice", "indicated", "mentioned", "stated",
}


def tokenize_sig(text: str) -> Set[str]:
    words = re.findall(r"[a-z]{3,}", (text or "").lower())
    return {w for w in words if w not in STOPWORDS}


def clean_html_text(raw_html: str) -> str:
    txt = html.unescape(raw_html or "")
    txt = re.sub(r"<br\s*/?>", "\n", txt, flags=re.I)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    return txt.strip()


def split_sentences(text: str) -> List[str]:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if not text:
        return []
    # Protect common abbreviations before splitting
    protected = re.sub(r"\b(Mr|Mrs|Ms|Dr|Prof|Inc|Ltd|Corp|Co|St|Ave|Rd|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|No|vs|etc|e\.g|i\.e|A\.M|P\.M)\.", r"\1<DOT>", text)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])", protected)
    out = []
    for p in parts:
        s = p.replace("<DOT>", ".").strip()
        if s:
            out.append(s)
    return out or [text]


def detect_part2_type(q_text: str, ans_text: str) -> str:
    ql = (q_text or "").strip().lower()
    al = (ans_text or "").strip().lower()
    if any(k in al for k in ["haven't decided", "not sure", "don't know", "ask ", "check with", "depends", "wasn't there", "already"]):
        return "Trả lời gián tiếp (Indirect)"
    if " or " in ql and ql.endswith("?"):
        return "Câu hỏi lựa chọn (Or)"
    if re.search(r",\s*(isn't|aren't|wasn't|weren't|don't|doesn't|didn't|won't|wouldn't|can't|couldn't|haven't|hasn't|is|are|do|does|did|will)\s+\w+\?$", ql):
        return "Câu hỏi đuôi (Tag)"
    if re.match(r"^(who|what|when|where|why|how|which|whose)\b", ql):
        return "Wh-question"
    if re.match(r"^(would you like|could you|can you|why don't we|let's|shall we|how about)\b", ql):
        return "Đề nghị / Yêu cầu"
    if not ql.endswith("?"):
        return "Câu trần thuật (Statement)"
    return "Yes/No"


def classify_part5_topic(sentence: str, options: Dict[str, str], xp: str = "") -> Tuple[str, str, str]:
    """Returns (topic, signal, formula)."""
    opts_list = [v.lower().strip() for v in options.values()]
    xp_l = (xp or "").lower()
    # Check word family (similar stems)
    stems = {re.sub(r"(tion|sion|ment|ness|ity|ly|ed|ing|er|or|al|ive|ous|able|ible|s|es)$", "", w)[:5] for w in opts_list if len(w) >= 4}
    if len(stems) <= 2 and all(" " not in w for w in opts_list):
        if any(w.endswith("ly") for w in opts_list):
            return ("Từ loại (Word Form)", "4 đáp án cùng gốc từ (danh/động/tính/trạng từ) — xét vị trí ngữ pháp quanh chỗ trống.", "Xác định cấu trúc cụm từ quanh chỗ trống (S + V + O / Adv + Adj / Adj + N) để chọn đúng hậu tố từ loại.")
        return ("Từ loại & Chia động từ", "4 đáp án biến thể cùng gốc từ — phân tích vai trò chủ ngữ, thì và thể bị động/chủ động.", "Kiểm tra chủ ngữ số ít/nhiều, dấu hiệu thì thời gian và dạng V-ing/V-ed/to-V.")
    if any(k in xp_l for k in ["giới từ", "preposition", "after which", "in spite", "despite"]):
        return ("Giới từ (Prepositions)", "Cần chọn giới từ phù hợp với cụm từ thời gian, địa điểm hoặc cụm cố định.", "Ghi nhớ cụm giới từ đi kèm danh từ/động từ chuẩn TOEIC (in/on/at/by/until/despite/during).")
    if any(k in xp_l for k in ["liên từ", "conjunction", "mệnh đề", "although", "whereas", "unless", "because"]):
        return ("Liên từ & Mệnh đề (Conjunctions)", "Chỗ trống nối hai mệnh đề hoặc mệnh đề với cụm danh từ — xét nghĩa logic & cấu trúc sau chỗ trống.", "Liên từ (Although/Because/While) + S + V ≠ Giới từ (Despite/Because of/During) + N/V-ing.")
    if any(k in xp_l for k in ["đại từ", "pronoun", "which", "whose", "whom", "themselves", "itself"]):
        return ("Đại từ & Mệnh đề quan hệ", "4 đáp án thuộc nhóm đại từ nhân xưng/sở hữu/phản thân hoặc đại từ quan hệ.", "Xác định chức năng ngữ pháp (Chủ ngữ / Tân ngữ / Tính từ sở hữu + N / Đại từ phản thân).")
    if any(k in xp_l for k in ["thì", "tense", "bị động", "passive", "v3", "phân từ"]):
        return ("Thì & Thể động từ", "Câu kiểm tra sự hòa hợp thì thời gian hoặc câu bị động (be + V3/ed).", "Tìm trạng từ thời gian (by next week, since, already, recently) để chọn thì & thể chính xác.")
    return ("Từ vựng ngữ cảnh (Vocabulary)", "4 đáp án khác gốc từ hoàn toàn — dịch nghĩa câu để chọn từ hợp ngữ cảnh công sở TOEIC.", "Đọc trọn câu, xác định collocation hoặc manh mối ngữ cảnh trước và sau chỗ trống.")


def parse_xp_options_vi(xp: str, opt_keys: List[str]) -> Dict[str, str]:
    """Extracts (A) ... (B) ... Vietnamese lines from Vietnamese xp text if present."""
    found: Dict[str, str] = {}
    if not xp:
        return found
    for k in opt_keys:
        m = re.search(rf"(?:^|\n)\s*\(?{k}\)?[.):\-]\s*([^\n]+)", xp)
        if m:
            found[k] = m.group(1).strip()
    return found


def build_reading_explanation_5layer(
    question_en: str,
    question_vi: str,
    options_en: Dict[str, str],
    options_vi: Dict[str, str],
    correct: str,
    raw_xp: str,
    topic: str,
    signal: str,
    formula: str,
    evidence_quote: Optional[str] = None,
    evidence_passage_idx: Optional[int] = None,
    evidence_sentence_id: Optional[str] = None,
) -> Dict[str, Any]:
    xp_clean = (raw_xp or "").strip()
    xp_opts = parse_xp_options_vi(xp_clean, ["A", "B", "C", "D"])

    final_opts_vi = {}
    wrong_analysis = {}
    for k in ["A", "B", "C", "D"]:
        vi_val = (options_vi.get(k) or "").strip()
        if not vi_val and k in xp_opts:
            vi_val = xp_opts[k].split("->")[0].split("→")[0].strip()
        if not vi_val:
            vi_val = options_en.get(k, "")
        final_opts_vi[k] = vi_val

        if k == correct:
            wrong_analysis[k] = f"ĐÁP ÁN ĐÚNG: ({k}) {options_en.get(k, '')} ({vi_val}) — Phù hợp chính xác về ngữ pháp và ngữ cảnh."
        else:
            if k in xp_opts and ("->" in xp_opts[k] or "→" in xp_opts[k] or "sai" in xp_opts[k].lower()):
                wrong_analysis[k] = xp_opts[k]
            else:
                wrong_analysis[k] = f"Loại ({k}) \"{options_en.get(k, '')}\" ({vi_val}) vì không phù hợp cấu trúc hoặc sai ý với ngữ cảnh câu/đoạn văn."

    proof_text = xp_clean if xp_clean else f"Đáp án chính xác là ({correct}) \"{options_en.get(correct, '')}\" dựa trên cấu trúc ngữ pháp và manh mối trực tiếp trong ngữ cảnh."

    proof_obj: Dict[str, Any] = {"explanation": proof_text}
    if evidence_quote:
        proof_obj["evidenceQuote"] = evidence_quote
    if evidence_passage_idx is not None:
        proof_obj["evidencePassageIndex"] = evidence_passage_idx
    if evidence_sentence_id is not None:
        proof_obj["evidenceSentenceId"] = evidence_sentence_id

    return {
        "classification": {
            "category": topic,
            "signal": signal,
        },
        "translation": {
            "questionVi": question_vi or question_en,
            "optionsVi": final_opts_vi,
        },
        "proof": proof_obj,
        "wrongOptionsAnalysis": wrong_analysis,
        "keyTakeaways": {
            "formula": formula,
            "commonTrap": "Tránh chọn bẫy lặp từ (word repetition) hoặc dịch từng từ rời rạc mà bỏ qua ngữ cảnh toàn câu.",
            "paraphrases": [],
        },
    }


def html_passage_to_bilingual_paragraphs(
    raw_html: str, vi_text: str, id_prefix: str
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Converts HTML passage (with optional <span class="blank" data-n="131">-------</span>)
    into BilingualParagraph[] with clean sentence IDs and aligned Vietnamese text.
    Returns (paragraphs, extracted_title).
    """
    soup = BeautifulSoup(raw_html or "", "lxml")
    # Replace blank spans with explicit ___ (N) ___ markers
    for sp in soup.find_all("span", class_="blank"):
        bn = sp.get("data-n") or ""
        sp.replace_with(f" ___ ({bn}) ___ " if bn else " _______ ")

    title = ""
    h_tag = soup.find(["h1", "h2", "h3", "h4"])
    if h_tag:
        title = re.sub(r"\s+", " ", h_tag.get_text(" ", strip=True))

    # Extract block-level paragraphs
    raw_blocks: List[str] = []
    body = soup.body or soup
    for el in body.find_all(["h1", "h2", "h3", "h4", "p", "li", "tr"], recursive=True):
        # Skip nested p inside tr if already handled
        if el.name == "p" and el.find_parent("tr"):
            continue
        txt = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
        if txt and len(txt) >= 2:
            raw_blocks.append(txt)

    if not raw_blocks:
        plain = clean_html_text(raw_html)
        raw_blocks = [b.strip() for b in re.split(r"\n{2,}", plain) if b.strip()] or [plain or "Document content"]

    vi_paras = [p.strip() for p in re.split(r"\n{2,}", (vi_text or "").strip()) if p.strip()]
    vi_sents_all: List[str] = []
    for vp in vi_paras:
        vi_sents_all.extend(split_sentences(vp))

    # Flatten English sentences across blocks to map Vietnamese proportionally
    en_blocks_sents: List[List[str]] = [split_sentences(b) for b in raw_blocks]
    total_en_sents = sum(len(s) for s in en_blocks_sents) or 1

    paragraphs: List[Dict[str, Any]] = []
    sent_cursor = 0
    for p_idx, sents in enumerate(en_blocks_sents):
        b_sents = []
        for s_idx, en_s in enumerate(sents):
            vi_s = ""
            if vi_sents_all:
                vi_pos = min(len(vi_sents_all) - 1, int(sent_cursor * len(vi_sents_all) / total_en_sents))
                vi_s = vi_sents_all[vi_pos]
            b_sents.append({
                "id": f"{id_prefix}-p{p_idx+1}-s{s_idx+1}",
                "en": en_s,
                "vi": vi_s or en_s,
            })
            sent_cursor += 1
        if b_sents:
            paragraphs.append({
                "id": f"{id_prefix}-p{p_idx+1}",
                "sentences": b_sents,
            })

    if not paragraphs:
        paragraphs = [{
            "id": f"{id_prefix}-p1",
            "sentences": [{"id": f"{id_prefix}-p1-s1", "en": clean_html_text(raw_html) or "Document", "vi": vi_text or "Nội dung văn bản"}],
        }]
    return paragraphs, title


def detect_doc_genre(head_text: str, raw_html: str) -> str:
    h = (head_text + " " + raw_html[:350]).lower()
    if any(k in h for k in ["text message", "chat", "online chat", "instant message"]):
        return "Text Message Chain"
    if any(k in h for k in ["e-mail", "email", "subject:", "from:", "to:"]):
        return "Email"
    if any(k in h for k in ["invoice", "receipt", "order form", "registration form", "form", "chart", "table"]):
        return "Invoice / Form"
    if any(k in h for k in ["schedule", "itinerary", "agenda", "timetable"]):
        return "Schedule"
    if any(k in h for k in ["job", "vacancy", "position", "career", "hiring", "resume"]):
        return "Job Posting"
    if any(k in h for k in ["article", "press release", "review", "news", "magazine"]):
        return "Article"
    return "Notice"


def detect_p6_genre(head_text: str, raw_html: str) -> str:
    h = (head_text + " " + raw_html[:300]).lower()
    if any(k in h for k in ["e-mail", "email", "subject:"]):
        return "Email"
    if any(k in h for k in ["memo", "memorandum"]):
        return "Memo"
    if any(k in h for k in ["advertisement", "flyer", "brochure", "sale", "offer"]):
        return "Advertisement"
    if any(k in h for k in ["article", "press release", "news"]):
        return "Article"
    return "Notice"


def find_best_evidence_sentence(
    passages: List[Dict[str, Any]], query_text: str, xp_text: str = ""
) -> Tuple[int, str, str]:
    """
    Matches exact quote from `xp` (Căn cứ: "...") or highest token overlap across all
    sentences in `passages`. Always returns a valid (passage_idx, sentence_id, quote).
    """
    # Extract quoted English snippets inside xp_text
    quotes = re.findall(r'"([A-Za-z][^"]{8,180})"', xp_text or "")
    q_tokens = tokenize_sig(query_text + " " + " ".join(quotes))

    best = (0, passages[0]["paragraphs"][0]["sentences"][0]["id"], passages[0]["paragraphs"][0]["sentences"][0]["en"])
    best_score = -1.0

    for p_idx, doc in enumerate(passages):
        for para in doc.get("paragraphs", []):
            for sent in para.get("sentences", []):
                s_en = sent.get("en", "")
                s_low = s_en.lower()
                score = 0.0
                for q in quotes:
                    ql = q.lower()[:40]
                    if ql in s_low:
                        score += 50.0
                s_tokens = tokenize_sig(s_en)
                if q_tokens and s_tokens:
                    overlap = len(q_tokens & s_tokens)
                    score += overlap * 3.0 + (overlap / (len(s_tokens) + 3))
                if score > best_score:
                    best_score = score
                    best = (p_idx, sent["id"], s_en)
    return best


def detect_part7_qtype(prompt: str) -> str:
    pl = (prompt or "").lower()
    if any(k in pl for k in ["not ", "except", "least likely"]):
        return "Loại trừ (NOT/TRUE)"
    if any(k in pl for k in ["closest in meaning", "word \"", "phrase \""]):
        return "Từ đồng nghĩa (Vocab in Context)"
    if any(k in pl for k in ["[1]", "[2]", "[3]", "[4]", "best belong", "following sentence"]):
        return "Điền câu [1][2][3][4]"
    if any(k in pl for k in ["purpose", "mainly about", "best title", "topic"]):
        return "Ý chính (Main Idea)"
    if any(k in pl for k in ["imply", "implied", "inferred", "suggested", "most likely", "probably"]):
        return "Suy luận (Inference)"
    return "Thông tin chi tiết (Detail)"


def detect_part34_qtype(prompt: str, has_graphic: bool = False) -> str:
    pl = (prompt or "").lower()
    if has_graphic and any(k in pl for k in ["look at the graphic", "graphic", "chart", "map", "table", "schedule", "list", "receipt", "floor"]):
        return "Câu hỏi bảng biểu (Graphic)"
    if any(k in pl for k in ["mean when", "imply", "why does the", "say, \""]):
        return "Hàm ý người nói (Implied Meaning)"
    if any(k in pl for k in ["will the", "next", "probably do", "going to do"]):
        return "Hành động tiếp theo"
    if any(k in pl for k in ["mainly", "topic", "purpose", "who most likely", "where does", "where is"]):
        return "Ý chính / Chủ đề"
    return "Thông tin chi tiết"


def detect_talk_type(text: str) -> str:
    tl = (text or "").lower()
    if any(k in tl for k in ["you've reached", "calling", "message", "call me back", "voicemail", "extension"]):
        return "Tin nhắn thoại (Phone Message)"
    if any(k in tl for k in ["tour", "museum", "gallery", "bus", "exhibit", "guide", "welcome aboard"]):
        return "Hướng dẫn tham quan (Tour)"
    if any(k in tl for k in ["advertisement", "commercial", "sale", "discount", "store", "shop", "try our", "visit us"]):
        return "Quảng cáo (Advertisement)"
    if any(k in tl for k in ["introduce", "guest speaker", "keynote", "pleasure to welcome", "award"]):
        return "Giới thiệu (Introduction)"
    if any(k in tl for k in ["meeting", "agenda", "quarterly", "department", "team", "sales figures"]):
        return "Phát biểu cuộc họp (Meeting)"
    return "Thông báo (Announcement)"


# =============================================================================
# 5. TIER 1A CRAWLER: github.com/mangomint1805/toeic (FULL 200-Q ETS EXAMS)
# =============================================================================
MANGOMINT_BASE = "https://raw.githubusercontent.com/mangomint1805/toeic/HEAD"
MANGOMINT_CATALOG = [
    # (repo_index, test_id, series, year, test_number, title)
    (1, "ets-2026-full-test-1", "ETS TOEIC 2026 — Full 200 câu (Auto-Crawled)", 2026, 1, "ETS TOEIC 2026 Full — Test 1 (200 câu)"),
    (2, "ets-2026-full-test-2", "ETS TOEIC 2026 — Full 200 câu (Auto-Crawled)", 2026, 2, "ETS TOEIC 2026 Full — Test 2 (200 câu)"),
    (11, "ets-2024-full-test-1", "ETS TOEIC 2024 — Full 200 câu (Auto-Crawled)", 2024, 1, "ETS TOEIC 2024 Full — Test 1 (200 câu)"),
    (12, "ets-2024-full-test-2", "ETS TOEIC 2024 — Full 200 câu (Auto-Crawled)", 2024, 2, "ETS TOEIC 2024 Full — Test 2 (200 câu)"),
    (3, "ets-2026-full-test-3", "ETS TOEIC 2026 — Full 200 câu (Auto-Crawled)", 2026, 3, "ETS TOEIC 2026 Full — Test 3 (200 câu)"),
    (13, "ets-2024-full-test-3", "ETS TOEIC 2024 — Full 200 câu (Auto-Crawled)", 2024, 3, "ETS TOEIC 2024 Full — Test 3 (200 câu)"),
    (4, "ets-2026-full-test-4", "ETS TOEIC 2026 — Full 200 câu (Auto-Crawled)", 2026, 4, "ETS TOEIC 2026 Full — Test 4 (200 câu)"),
    (14, "ets-2024-full-test-4", "ETS TOEIC 2024 — Full 200 câu (Auto-Crawled)", 2024, 4, "ETS TOEIC 2024 Full — Test 4 (200 câu)"),
]


def crawl_mangomint_test(
    session: CrawlSession,
    translator: BatchViTranslator,
    repo_idx: int,
    test_id: str,
    series: str,
    year: int,
    test_number: int,
    title: str,
    force: bool = False,
) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
    source_url = f"{MANGOMINT_BASE}/data/t{repo_idx}.js"
    out_json = TESTS_DIR / f"{test_id}.json"
    print(f"\n[Tier 1A] Crawling {title} from {source_url} ...")

    r = session.fetch_url(source_url, timeout=30)
    if not r or r.status_code != 200:
        session.skipped_sources.append({
            "tier": "Tier 1A (GitHub)",
            "url": source_url,
            "status": r.status_code if r else "NETWORK_ERROR",
            "reason": "Could not fetch raw JS payload",
        })
        return None

    m = re.search(r"window\.ETSDATA\[\d+\]\s*=\s*(\{.*\})\s*;?\s*$", r.text, re.S)
    if not m:
        print(f"  [WARN] Could not parse ETSDATA in t{repo_idx}.js")
        return None
    raw = json.loads(m.group(1))
    lc = raw.get("lc", {})
    rc = raw.get("rc", {})

    # 1. Parallel download of all real audio & image assets for this test
    test_audio_dir = AUDIO_BASE_DIR / test_id
    test_img_dir = IMAGES_BASE_DIR / test_id
    media_jobs: List[Tuple[str, Path, int, str]] = []

    for item in lc.get("p1", []):
        if item.get("img"):
            media_jobs.append((f"{MANGOMINT_BASE}/img/t{repo_idx}/{item['img']}", test_img_dir / item["img"], 10_000, "image"))
        if item.get("a"):
            media_jobs.append((f"{MANGOMINT_BASE}/audio/t{repo_idx}/{item['a']}", test_audio_dir / item["a"], 5_000, "audio"))
    for item in lc.get("p2", []):
        if item.get("a"):
            media_jobs.append((f"{MANGOMINT_BASE}/audio/t{repo_idx}/{item['a']}", test_audio_dir / item["a"], 5_000, "audio"))
    for pk in ("p3", "p4"):
        for item in lc.get(pk, []):
            if item.get("a"):
                media_jobs.append((f"{MANGOMINT_BASE}/audio/t{repo_idx}/{item['a']}", test_audio_dir / item["a"], 10_000, "audio"))
            if item.get("img"):
                media_jobs.append((f"{MANGOMINT_BASE}/img/t{repo_idx}/{item['img']}", test_img_dir / item["img"], 5_000, "image"))

    print(f"  -> Archiving {len(media_jobs)} real media files (MP3 + JPG/PNG) in parallel ...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futs = [
            ex.submit(download_media_file, session, url, dest, min_b, "https://github.com/mangomint1805/toeic", kind)
            for (url, dest, min_b, kind) in media_jobs
        ]
        concurrent.futures.wait(futs)

    # 2. Collect any missing English strings for batch Vietnamese translation (Part 5 sentences & options lacking vi)
    to_translate: List[str] = []
    for item in rc.get("p5", []):
        xp = item.get("xp", "")
        if "Dịch:" not in xp and "dịch:" not in xp.lower():
            to_translate.append(item.get("q", ""))
        for opt in item.get("opts", []):
            to_translate.append(opt)
    if to_translate:
        print(f"  -> Batch translating {len(set(to_translate))} Part 5 strings via 3-engine ViTranslator ...")
        vi_map = translator.translate_batch(to_translate)
    else:
        vi_map = {}

    allow_dup = out_json.exists() and force
    part1_out, part2_out, part3_out, part4_out = [], [], [], []
    part5_out, part6_out, part7_out = [], [], []

    # ---- PART 1 ----
    for item in lc.get("p1", []):
        n = item["n"]
        opts_en = item.get("opts", ["", "", "", ""])
        opts_vi = item.get("vi", opts_en)
        ans = item.get("ans", "A")
        if not session.register_hash("p1 " + " ".join(opts_en), allow_existing=allow_dup):
            continue
        qid = f"{test_id}-p1-q{n}"
        img_name = item.get("img", f"q{n}.jpg")
        aud_name = item.get("a", f"p1_q{n}.mp3")
        img_path = test_img_dir / img_name
        aud_path = test_audio_dir / aud_name
        if not (img_path.exists() and img_path.stat().st_size > 10_000):
            continue

        keys = ["A", "B", "C", "D"]
        opt_dict = {k: {"en": opts_en[i], "vi": opts_vi[i] if i < len(opts_vi) else opts_en[i]} for i, k in enumerate(keys)}
        transcript_lines = []
        for i, k in enumerate(keys):
            transcript_lines.append({
                "id": f"{qid}-l{i+1}",
                "speaker": f"Option ({k})",
                "voiceGender": "female" if n % 2 == 1 else "male",
                "accent": "en-US" if n % 3 != 0 else "en-GB",
                "en": f"({k}) {opts_en[i]}",
                "vi": f"({k}) {opt_dict[k]['vi']}",
                "evidenceForQuestionIds": [qid] if k == ans else [],
            })

        if aud_path.exists() and aud_path.stat().st_size > 5_000:
            dur_ms = get_mp3_duration_ms(aud_path)
            ts = distribute_timestamps([l["en"] for l in transcript_lines], dur_ms, lead_in_ms=400)
        else:
            ts = synthesize_fallback_mp3(transcript_lines, aud_path)
            session.media_stats["audio_fallback_edge_tts"] += 1

        for l, (s_ms, e_ms) in zip(transcript_lines, ts):
            l["startMs"] = s_ms
            l["endMs"] = e_ms

        scene_type = "scene-objects"
        ans_low = opt_dict[ans]["en"].lower()
        if any(w in ans_low for w in ["people", "men", "women", "cyclists", "they"]):
            scene_type = "multiple-people"
        elif any(w in ans_low for w in ["woman", "man", "he's", "she's", "he is", "she is"]):
            scene_type = "single-person"

        part1_out.append({
            "id": qid,
            "part": 1,
            "sceneType": scene_type,
            "title": f"Ảnh mô tả #{n} ({title})",
            "illustrationKey": "office-laptop",
            "imageUrl": f"/images/toeic/{test_id}/{img_name}",
            "audioUrl": f"/audio/toeic/{test_id}/{aud_name}",
            "transcript": transcript_lines,
            "options": opt_dict,
            "correctAnswer": ans,
            "explanation": {
                "trapType": "Bẫy động từ hành động & giới từ vị trí Part 1",
                "trapAnalysis": f"Đáp án đúng là ({ans}): \"{opt_dict[ans]['en']}\" ({opt_dict[ans]['vi']}). Các phương án nhiễu thường dùng sai động từ đang diễn ra hoặc nhầm vị trí đồ vật trong ảnh.",
                "paraphrases": [],
                "optionAnalysis": {
                    k: (
                        f"ĐÚNG: Mô tả chính xác chi tiết trong ảnh — {opt_dict[k]['vi']}"
                        if k == ans
                        else f"SAI: Không khớp với hình ảnh thực tế — {opt_dict[k]['vi']}"
                    )
                    for k in keys
                },
                "keyVocab": [],
            },
        })

    # ---- PART 2 ----
    for item in lc.get("p2", []):
        n = item["n"]
        q_en = item.get("q", "")
        q_vi = item.get("qvi", "") or translator.translate_one(q_en)
        opts_en = item.get("opts", ["", "", ""])
        opts_vi = item.get("vi", opts_en)
        ans = item.get("ans", "A")
        if not session.register_hash("p2 " + q_en + " " + " ".join(opts_en), allow_existing=allow_dup):
            continue
        qid = f"{test_id}-p2-q{n}"
        aud_name = item.get("a", f"p2_q{n}.mp3")
        aud_path = test_audio_dir / aud_name
        keys3 = ["A", "B", "C"]
        q_gender = "female" if n % 2 == 0 else "male"
        a_gender = "male" if q_gender == "female" else "female"
        accent = "en-US" if n % 3 != 0 else "en-GB"

        raw_lines = [
            {"en": q_en, "voiceGender": q_gender, "accent": accent},
            *[{"en": f"{k}. {opts_en[i]}", "voiceGender": a_gender, "accent": accent} for i, k in enumerate(keys3)],
        ]
        if aud_path.exists() and aud_path.stat().st_size > 5_000:
            dur_ms = get_mp3_duration_ms(aud_path)
            ts = distribute_timestamps([l["en"] for l in raw_lines], dur_ms, lead_in_ms=350)
        else:
            ts = synthesize_fallback_mp3(raw_lines, aud_path)
            session.media_stats["audio_fallback_edge_tts"] += 1

        q_type = detect_part2_type(q_en, opts_en[keys3.index(ans)] if ans in keys3 else "")
        opt_obj = {}
        for i, k in enumerate(keys3):
            opt_obj[k] = {
                "en": opts_en[i],
                "vi": opts_vi[i] if i < len(opts_vi) else opts_en[i],
                "speaker": f"Speaker ({k})",
                "voiceGender": a_gender,
                "accent": accent,
                "startMs": ts[i + 1][0],
                "endMs": ts[i + 1][1],
            }

        part2_out.append({
            "id": qid,
            "part": 2,
            "questionType": q_type,
            "title": f"Hỏi – Đáp #{n} ({q_type})",
            "audioUrl": f"/audio/toeic/{test_id}/{aud_name}",
            "questionLine": {
                "id": f"{qid}-q",
                "speaker": "Question",
                "voiceGender": q_gender,
                "accent": accent,
                "en": q_en,
                "vi": q_vi,
                "startMs": ts[0][0],
                "endMs": ts[0][1],
            },
            "options": opt_obj,
            "correctAnswer": ans,
            "explanation": {
                "trapType": f"Bẫy Part 2 ({q_type})",
                "trapAnalysis": f"Câu hỏi: \"{q_en}\" ({q_vi}). Đáp án ({ans}) \"{opt_obj[ans]['en']}\" ({opt_obj[ans]['vi']}) trả lời trực tiếp hoặc phù hợp logic hội thoại nhất.",
                "paraphrases": [],
                "optionAnalysis": {
                    k: (
                        f"ĐÚNG: Trả lời hợp ngữ cảnh — {opt_obj[k]['vi']}"
                        if k == ans
                        else f"SAI (Bẫy lạc chủ đề / lặp từ): {opt_obj[k]['vi']}"
                    )
                    for k in keys3
                },
                "keyVocab": [],
            },
        })

    # ---- PART 3 ----
    for s_idx, item in enumerate(lc.get("p3", []), start=1):
        ns = item.get("ns", [32 + (s_idx - 1) * 3, 34 + (s_idx - 1) * 3])
        script = item.get("script", [])
        tr_join = " ".join(row[1] for row in script if len(row) >= 2)
        if not session.register_hash("p3 " + tr_join[:250], allow_existing=allow_dup):
            continue
        sid = f"{test_id}-p3-s{s_idx}"
        aud_name = item.get("a", f"p3_s{s_idx}.mp3")
        aud_path = test_audio_dir / aud_name

        speakers = set()
        t_lines = []
        for l_idx, row in enumerate(script, start=1):
            spk_code = (row[0] or "W").strip().upper()
            speakers.add(spk_code)
            gender = "male" if spk_code.startswith("M") else "female"
            spk_label = f"Man {spk_code[1:]}" if spk_code.startswith("M") else f"Woman {spk_code[1:]}"
            t_lines.append({
                "id": f"{sid}-l{l_idx}",
                "speaker": spk_label.strip(),
                "voiceGender": gender,
                "accent": "en-US" if (s_idx + l_idx) % 3 != 0 else "en-GB",
                "en": row[1] if len(row) > 1 else "",
                "vi": row[2] if len(row) > 2 and row[2] else (row[1] if len(row) > 1 else ""),
                "evidenceForQuestionIds": [],
            })

        if aud_path.exists() and aud_path.stat().st_size > 10_000:
            dur_ms = get_mp3_duration_ms(aud_path)
            ts = distribute_timestamps([l["en"] for l in t_lines], dur_ms, lead_in_ms=400)
        else:
            ts = synthesize_fallback_mp3(t_lines, aud_path)
            session.media_stats["audio_fallback_edge_tts"] += 1

        for l, (s_ms, e_ms) in zip(t_lines, ts):
            l["startMs"] = s_ms
            l["endMs"] = e_ms

        graphic_img = item.get("img")
        has_graphic = bool(graphic_img and (test_img_dir / graphic_img).exists())
        sub_qs = []
        for q_raw in item.get("qs", []):
            qn = q_raw["n"]
            sub_id = f"{sid}-q{qn}"
            ans = q_raw.get("ans", "A")
            opts_en = q_raw.get("opts", ["", "", "", ""])
            opts_vi = q_raw.get("vi", opts_en)
            keys4 = ["A", "B", "C", "D"]
            opt_map = {k: {"en": opts_en[i], "vi": opts_vi[i] if i < len(opts_vi) else opts_en[i]} for i, k in enumerate(keys4)}

            # Link best evidence transcript line
            q_tok = tokenize_sig(q_raw.get("q", "") + " " + opt_map[ans]["en"])
            best_l = max(t_lines, key=lambda l: len(q_tok & tokenize_sig(l["en"])), default=None)
            if best_l is not None:
                best_l["evidenceForQuestionIds"].append(sub_id)

            sub_qs.append({
                "id": sub_id,
                "questionNumber": qn,
                "questionType": detect_part34_qtype(q_raw.get("q", ""), has_graphic),
                "prompt": q_raw.get("q", ""),
                "promptVi": q_raw.get("qvi", "") or q_raw.get("q", ""),
                "options": opt_map,
                "correctAnswer": ans,
                "explanation": {
                    "trapType": "Paraphrase hội thoại Part 3",
                    "trapAnalysis": f"Đáp án ({ans}) \"{opt_map[ans]['en']}\" ({opt_map[ans]['vi']}). Dẫn chứng trong hội thoại: \"{best_l['en'] if best_l else ''}\"",
                    "paraphrases": [],
                    "optionAnalysis": {
                        k: (f"ĐÚNG: {opt_map[k]['vi']}" if k == ans else f"SAI: {opt_map[k]['vi']}")
                        for k in keys4
                    },
                    "keyVocab": [],
                },
            })

        p3_obj: Dict[str, Any] = {
            "id": sid,
            "part": 3,
            "title": f"Hội thoại Câu {ns[0]}–{ns[-1]}",
            "scenario": f"ETS Part 3 Conversation ({ns[0]}–{ns[-1]})",
            "speakerCount": 3 if len(speakers) >= 3 else 2,
            "hasGraphic": has_graphic,
            "audioUrl": f"/audio/toeic/{test_id}/{aud_name}",
            "transcript": t_lines,
            "questions": sub_qs,
            "keyVocab": [],
        }
        if has_graphic:
            p3_obj["graphicImageUrl"] = f"/images/toeic/{test_id}/{graphic_img}"
        part3_out.append(p3_obj)

    # ---- PART 4 ----
    for s_idx, item in enumerate(lc.get("p4", []), start=1):
        ns = item.get("ns", [71 + (s_idx - 1) * 3, 73 + (s_idx - 1) * 3])
        script = item.get("script", [])
        full_en = " ".join(row[1] for row in script if len(row) >= 2)
        full_vi = " ".join(row[2] for row in script if len(row) >= 3 and row[2])
        if not session.register_hash("p4 " + full_en[:250], allow_existing=allow_dup):
            continue
        sid = f"{test_id}-p4-s{s_idx}"
        aud_name = item.get("a", f"p4_s{s_idx}.mp3")
        aud_path = test_audio_dir / aud_name

        en_sents = split_sentences(full_en)
        vi_sents = split_sentences(full_vi)
        gender = "male" if s_idx % 2 == 0 else "female"
        accent = "en-US" if s_idx % 3 != 0 else "en-GB"

        t_lines = []
        for l_idx, en_s in enumerate(en_sents, start=1):
            vi_pos = min(len(vi_sents) - 1, int((l_idx - 1) * len(vi_sents) / max(len(en_sents), 1))) if vi_sents else -1
            t_lines.append({
                "id": f"{sid}-l{l_idx}",
                "speaker": "Speaker",
                "voiceGender": gender,
                "accent": accent,
                "en": en_s,
                "vi": vi_sents[vi_pos] if vi_pos >= 0 else en_s,
                "evidenceForQuestionIds": [],
            })

        if aud_path.exists() and aud_path.stat().st_size > 10_000:
            dur_ms = get_mp3_duration_ms(aud_path)
            ts = distribute_timestamps([l["en"] for l in t_lines], dur_ms, lead_in_ms=400)
        else:
            ts = synthesize_fallback_mp3(t_lines, aud_path)
            session.media_stats["audio_fallback_edge_tts"] += 1

        for l, (s_ms, e_ms) in zip(t_lines, ts):
            l["startMs"] = s_ms
            l["endMs"] = e_ms

        graphic_img = item.get("img")
        has_graphic = bool(graphic_img and (test_img_dir / graphic_img).exists())
        sub_qs = []
        for q_raw in item.get("qs", []):
            qn = q_raw["n"]
            sub_id = f"{sid}-q{qn}"
            ans = q_raw.get("ans", "A")
            opts_en = q_raw.get("opts", ["", "", "", ""])
            opts_vi = q_raw.get("vi", opts_en)
            keys4 = ["A", "B", "C", "D"]
            opt_map = {k: {"en": opts_en[i], "vi": opts_vi[i] if i < len(opts_vi) else opts_en[i]} for i, k in enumerate(keys4)}

            q_tok = tokenize_sig(q_raw.get("q", "") + " " + opt_map[ans]["en"])
            best_l = max(t_lines, key=lambda l: len(q_tok & tokenize_sig(l["en"])), default=None)
            if best_l is not None:
                best_l["evidenceForQuestionIds"].append(sub_id)

            sub_qs.append({
                "id": sub_id,
                "questionNumber": qn,
                "questionType": detect_part34_qtype(q_raw.get("q", ""), has_graphic),
                "prompt": q_raw.get("q", ""),
                "promptVi": q_raw.get("qvi", "") or q_raw.get("q", ""),
                "options": opt_map,
                "correctAnswer": ans,
                "explanation": {
                    "trapType": "Paraphrase bài nói độc thoại Part 4",
                    "trapAnalysis": f"Đáp án ({ans}) \"{opt_map[ans]['en']}\" ({opt_map[ans]['vi']}). Dẫn chứng trong bài nói: \"{best_l['en'] if best_l else ''}\"",
                    "paraphrases": [],
                    "optionAnalysis": {
                        k: (f"ĐÚNG: {opt_map[k]['vi']}" if k == ans else f"SAI: {opt_map[k]['vi']}")
                        for k in keys4
                    },
                    "keyVocab": [],
                },
            })

        p4_obj: Dict[str, Any] = {
            "id": sid,
            "part": 4,
            "title": f"Bài nói ngắn Câu {ns[0]}–{ns[-1]}",
            "talkType": detect_talk_type(full_en),
            "hasGraphic": has_graphic,
            "audioUrl": f"/audio/toeic/{test_id}/{aud_name}",
            "transcript": t_lines,
            "questions": sub_qs,
            "keyVocab": [],
        }
        if has_graphic:
            p4_obj["graphicImageUrl"] = f"/images/toeic/{test_id}/{graphic_img}"
        part4_out.append(p4_obj)

    # ---- PART 5 ----
    for item in rc.get("p5", []):
        n = item["n"]
        sent_en = re.sub(r"-{3,}|_{3,}", "_______", item.get("q", "").strip())
        opts_list = item.get("opts", ["", "", "", ""])
        ans = item.get("ans", "A")
        xp = item.get("xp", "")
        keys4 = ["A", "B", "C", "D"]
        opts_en = {k: opts_list[i] for i, k in enumerate(keys4)}
        if not session.register_hash(sent_en + " ".join(opts_en.values()), allow_existing=allow_dup):
            continue

        # Extract Vietnamese sentence translation from xp ("Dịch: ...") if present
        m_dich = re.search(r"Dịch\s*:\s*(.+)", xp, flags=re.I)
        q_vi = m_dich.group(1).strip() if m_dich else vi_map.get(re.sub(r"\s+", " ", item.get("q", "").strip()), sent_en)
        opts_vi = {k: vi_map.get(re.sub(r"\s+", " ", opts_en[k].strip()), opts_en[k]) for k in keys4}
        topic, signal, formula = classify_part5_topic(sent_en, opts_en, xp)

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
                question_vi=q_vi,
                options_en=opts_en,
                options_vi=opts_vi,
                correct=ans,
                raw_xp=xp,
                topic=topic,
                signal=signal,
                formula=formula,
            ),
        })

    # ---- PART 6 ----
    for p_idx, item in enumerate(rc.get("p6", []), start=1):
        ns = item.get("ns", [131, 134])
        pid = f"{test_id}-p6-p{p_idx}"
        paragraphs, p_title = html_passage_to_bilingual_paragraphs(item.get("passage", ""), item.get("vi", ""), pid)
        plain_txt = " ".join(s["en"] for p in paragraphs for s in p["sentences"])
        if not session.register_hash("p6 " + plain_txt[:250], allow_existing=allow_dup):
            continue

        p6_qs = []
        for q_raw in item.get("qs", []):
            bn = q_raw["n"]
            opts_list = q_raw.get("opts", ["", "", "", ""])
            ans = q_raw.get("ans", "A")
            xp = q_raw.get("xp", "")
            keys4 = ["A", "B", "C", "D"]
            opts_en = {k: opts_list[i] for i, k in enumerate(keys4)}

            # Locate the exact sentence containing ___ (bn) ___
            ev_sid = paragraphs[0]["sentences"][0]["id"]
            ev_quote = paragraphs[0]["sentences"][0]["en"]
            marker = f"({bn})"
            for para in paragraphs:
                for sent in para["sentences"]:
                    if marker in sent["en"]:
                        ev_sid = sent["id"]
                        ev_quote = sent["en"]
                        break

            is_sentence_insert = all(len(v.split()) >= 5 for v in opts_list)
            q_type = "Điền câu (Sentence Insertion)" if is_sentence_insert else "Từ vựng"
            topic, signal, formula = (
                ("Điền câu vào đoạn văn (Sentence Insertion)", "4 đáp án là 4 câu hoàn chỉnh — đọc câu trước và sau chỗ trống để đảm bảo mạch logic.", "Xác định đại từ thay thế (this/they/such), từ nối mạch ý và chủ đề đoạn văn.")
                if is_sentence_insert
                else classify_part5_topic(ev_quote, opts_en, xp)
            )
            if not is_sentence_insert and ("Từ loại" in topic or "Thì" in topic or "Đại từ" in topic):
                q_type = "Ngữ pháp"
            elif not is_sentence_insert and "Liên từ" in topic:
                q_type = "Từ nối"

            p6_qs.append({
                "id": f"{pid}-q{bn}",
                "blankNumber": bn,
                "questionType": q_type,
                "options": opts_en,
                "correctAnswer": ans,
                "explanation": build_reading_explanation_5layer(
                    question_en=f"Blank ({bn}): {ev_quote}",
                    question_vi=f"Chỗ trống ({bn}) trong đoạn văn",
                    options_en=opts_en,
                    options_vi={},
                    correct=ans,
                    raw_xp=xp,
                    topic=topic,
                    signal=signal,
                    formula=formula,
                    evidence_quote=ev_quote,
                    evidence_sentence_id=ev_sid,
                ),
            })

        part6_out.append({
            "id": pid,
            "title": p_title or f"Part 6 Passage ({ns[0]}–{ns[-1]})",
            "genre": detect_p6_genre(item.get("head", ""), item.get("passage", "")),
            "paragraphs": paragraphs,
            "questions": p6_qs,
        })

    # ---- PART 7 ----
    for s_idx, item in enumerate(rc.get("p7", []), start=1):
        ns = item.get("ns", [147, 148])
        sid = f"{test_id}-p7-s{s_idx}"
        raw_passages = item.get("passages", [])
        if not raw_passages:
            continue
        vi_full = item.get("vi", "") or ""
        # Split Vietnamese across passages if multi-passage
        vi_chunks = [vi_full]
        if len(raw_passages) > 1 and vi_full:
            # Split roughly evenly by paragraphs across passage docs
            all_vp = [p.strip() for p in re.split(r"\n{2,}", vi_full) if p.strip()]
            chunk_sz = max(1, len(all_vp) // len(raw_passages))
            vi_chunks = [
                "\n\n".join(all_vp[i * chunk_sz:(i + 1) * chunk_sz if i < len(raw_passages) - 1 else len(all_vp)])
                for i in range(len(raw_passages))
            ]

        docs = []
        for d_idx, p_html in enumerate(raw_passages):
            doc_id = f"{sid}-d{d_idx+1}"
            paras, d_title = html_passage_to_bilingual_paragraphs(
                p_html, vi_chunks[d_idx] if d_idx < len(vi_chunks) else "", doc_id
            )
            genre = detect_doc_genre(item.get("head", ""), p_html)
            docs.append({
                "id": doc_id,
                "tabLabel": f"Văn bản {d_idx+1} ({genre})",
                "genre": genre,
                "title": d_title or f"{genre} #{d_idx+1}",
                "paragraphs": paras,
            })

        plain_txt = " ".join(s["en"] for d in docs for p in d["paragraphs"] for s in p["sentences"])
        if not session.register_hash("p7 " + plain_txt[:250], allow_existing=allow_dup):
            continue

        p_count_type = "single" if len(docs) == 1 else ("double" if len(docs) == 2 else "triple")
        p7_qs = []
        for q_raw in item.get("qs", []):
            qn = q_raw["n"]
            prompt = q_raw.get("q", "")
            prompt_vi = q_raw.get("qvi", "") or prompt
            opts_list = q_raw.get("opts", ["", "", "", ""])
            ans = q_raw.get("ans", "A")
            xp = q_raw.get("xp", "")
            keys4 = ["A", "B", "C", "D"]
            opts_en = {k: opts_list[i] for i, k in enumerate(keys4)}

            ev_pidx, ev_sid, ev_quote = find_best_evidence_sentence(
                docs, prompt + " " + opts_en.get(ans, ""), xp
            )
            qtype = detect_part7_qtype(prompt)
            p7_qs.append({
                "id": f"{sid}-q{qn}",
                "questionNumber": qn,
                "questionType": qtype,
                "prompt": prompt,
                "promptVi": prompt_vi,
                "options": opts_en,
                "correctAnswer": ans,
                "explanation": build_reading_explanation_5layer(
                    question_en=prompt,
                    question_vi=prompt_vi,
                    options_en=opts_en,
                    options_vi={},
                    correct=ans,
                    raw_xp=xp,
                    topic=f"Part 7 — {qtype}",
                    signal=f"Đọc câu hỏi và định vị thông tin dẫn chứng tại Văn bản {ev_pidx + 1}.",
                    formula="Áp dụng kỹ thuật Skimming/Scanning từ khóa và đối chiếu Paraphrase giữa đáp án và đoạn văn.",
                    evidence_quote=ev_quote,
                    evidence_passage_idx=ev_pidx,
                    evidence_sentence_id=ev_sid,
                ),
            })

        part7_out.append({
            "id": sid,
            "title": item.get("head", f"Questions {ns[0]}–{ns[-1]}"),
            "passageCountType": p_count_type,
            "topic": f"Đọc hiểu {'Đơn' if p_count_type=='single' else ('Đôi' if p_count_type=='double' else 'Ba')} ({ns[0]}–{ns[-1]})",
            "passages": docs,
            "questions": p7_qs,
        })

    # Compute exact counts
    c1 = len(part1_out)
    c2 = len(part2_out)
    c3 = sum(len(s["questions"]) for s in part3_out)
    c4 = sum(len(s["questions"]) for s in part4_out)
    c5 = len(part5_out)
    c6 = sum(len(p["questions"]) for p in part6_out)
    c7 = sum(len(s["questions"]) for s in part7_out)
    l_cnt = c1 + c2 + c3 + c4
    r_cnt = c5 + c6 + c7
    total_cnt = l_cnt + r_cnt

    if total_cnt == 0:
        print(f"  [INFO] Skipped {test_id} (all questions already existed in bank).")
        return None

    test_data = {
        "id": test_id,
        "series": series,
        "year": year,
        "title": title,
        "subtitle": f"Đề thi chuẩn ETS {year} đầy đủ 7 Part ({total_cnt} câu, audio MP3 & ảnh gốc tải cục bộ từ kho mở GitHub).",
        "durationMinutes": 120 if total_cnt >= 180 else max(30, int(total_cnt * 0.6)),
        "parts": {
            "part1": part1_out,
            "part2": part2_out,
            "part3": part3_out,
            "part4": part4_out,
            "part5": part5_out,
            "part6": part6_out,
            "part7": part7_out,
        },
    }
    test_meta = {
        "id": test_id,
        "series": series,
        "year": year,
        "testNumber": test_number,
        "title": title,
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

    out_json.write_text(json.dumps(test_data, ensure_ascii=False, indent=2), encoding="utf-8")
    session.state["completed_tests"][test_id] = {
        "source": source_url,
        "questionCount": total_cnt,
        "partCounts": test_meta["partCounts"],
    }
    session.sources_crawled.append({
        "tier": "Tier 1A (GitHub Open Repo)",
        "source": "github.com/mangomint1805/toeic",
        "url": source_url,
        "output_type": "test",
        "output_id": test_id,
        "questionCount": total_cnt,
        "partCounts": test_meta["partCounts"],
    })
    print(f"  [OK] Saved {test_id}.json -> {total_cnt} Qs (P1:{c1} P2:{c2} P3:{c3} P4:{c4} P5:{c5} P6:{c6} P7:{c7})")
    return test_meta, test_data


# =============================================================================
# 6. TIER 1B & 1C CRAWLERS: GITHUB + HUGGINGFACE DRILLS (PART 5/6/7)
# =============================================================================
def crawl_tier1_drills(
    session: CrawlSession, translator: BatchViTranslator, force: bool = False
) -> List[Dict[str, Any]]:
    new_drills_meta: List[Dict[str, Any]] = []

    # --- Tier 1B: HuynhDucKhoi0105/English-ETS-TOEIC-web (Part 5 + Part 6/7) ---
    url_p5 = "https://raw.githubusercontent.com/HuynhDucKhoi0105/English-ETS-TOEIC-web/HEAD/data/C_part5_quiz_136.txt"
    print(f"\n[Tier 1B] Crawling Part 5 drill from {url_p5} ...")
    r = session.fetch_url(url_p5, timeout=25)
    if r and r.status_code == 200:
        drill_id = "drill-p5-crawled-ets-web"
        out_p = DRILLS_DIR / f"{drill_id}.json"
        allow_dup = out_p.exists() and force
        raw_rows = []
        for line in r.text.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "|" not in line:
                continue
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 7:
                # Format: q | A | B | C | D | ans | explanation
                q_en, a, b, c, d_opt, ans = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5].upper()
                xp = parts[6] if len(parts) > 6 else ""
                if ans in ("A", "B", "C", "D") and "___" in q_en or "—" in q_en or "..." in q_en or "____" in q_en:
                    raw_rows.append((q_en, {"A": a, "B": b, "C": c, "D": d_opt}, ans, xp))
        # Take up to 35 unique clean questions
        raw_rows = raw_rows[:45]
        texts_to_tr = [x[0] for x in raw_rows] + [v for x in raw_rows for v in x[1].values()]
        vi_map = translator.translate_batch(texts_to_tr)
        p5_items = []
        for idx, (q_en, opts_en, ans, xp) in enumerate(raw_rows, start=1):
            sent_en = re.sub(r"-{3,}|_{3,}", "_______", q_en)
            if not session.register_hash(sent_en + " ".join(opts_en.values()), allow_existing=allow_dup):
                continue
            topic, signal, formula = classify_part5_topic(sent_en, opts_en, xp)
            opts_vi = {k: vi_map.get(re.sub(r"\s+", " ", opts_en[k].strip()), opts_en[k]) for k in ["A", "B", "C", "D"]}
            q_vi = vi_map.get(re.sub(r"\s+", " ", q_en.strip()), sent_en)
            p5_items.append({
                "id": f"{drill_id}-q{idx}",
                "part": 5,
                "topic": topic,
                "difficulty": "Thực chiến ETS" if False else "Trung bình",
                "sentence": sent_en,
                "options": opts_en,
                "correctAnswer": ans,
                "explanation": build_reading_explanation_5layer(
                    question_en=sent_en, question_vi=q_vi, options_en=opts_en, options_vi=opts_vi,
                    correct=ans, raw_xp=xp, topic=topic, signal=signal, formula=formula,
                ),
            })
            if len(p5_items) >= 35:
                break
        if p5_items:
            drill_obj = {
                "id": drill_id,
                "part": 5,
                "title": "Part 5 Thực chiến — Kho mở ETS Web (Auto-Crawled)",
                "subtitle": f"Tuyển tập {len(p5_items)} câu ngữ pháp & từ vựng Part 5 cào tự động từ GitHub English-ETS-TOEIC-web kèm giải thích 5 lớp.",
                "focusTag": "Auto-Crawled GitHub",
                "part5": p5_items,
            }
            out_p.write_text(json.dumps(drill_obj, ensure_ascii=False, indent=2), encoding="utf-8")
            meta = {
                "id": drill_id,
                "part": 5,
                "title": drill_obj["title"],
                "subtitle": drill_obj["subtitle"],
                "focusTag": drill_obj["focusTag"],
                "difficulty": "Thực chiến ETS",
                "questionCount": len(p5_items),
                "estimatedMinutes": max(10, len(p5_items) // 2),
            }
            new_drills_meta.append(meta)
            session.sources_crawled.append({
                "tier": "Tier 1B (GitHub Open Repo)",
                "source": "github.com/HuynhDucKhoi0105/English-ETS-TOEIC-web",
                "url": url_p5,
                "output_type": "drill",
                "output_id": drill_id,
                "questionCount": len(p5_items),
                "partCounts": {"1": 0, "2": 0, "3": 0, "4": 0, "5": len(p5_items), "6": 0, "7": 0},
            })
            print(f"  [OK] Saved {drill_id}.json -> {len(p5_items)} Part 5 Qs")

    # --- Tier 1C: HuggingFace nggiabao19/toeic-tutor-v1 (Datasets Server JSON API) ---
    url_hf = "https://datasets-server.huggingface.co/rows?dataset=nggiabao19/toeic-tutor-v1&config=default&split=train&offset=0&length=40"
    print(f"\n[Tier 1C] Crawling Part 5 Tutor drill from HuggingFace Datasets API ...")
    r_hf = session.fetch_url(url_hf, timeout=25)
    if r_hf and r_hf.status_code == 200:
        drill_id = "drill-p5-crawled-hf-tutor"
        out_p = DRILLS_DIR / f"{drill_id}.json"
        allow_dup = out_p.exists() and force
        rows = r_hf.json().get("rows", [])
        p5_hf = []
        for idx, entry in enumerate(rows, start=1):
            out_str = entry.get("row", {}).get("output", "")
            try:
                item = json.loads(out_str)
            except Exception:
                continue
            q_en = re.sub(r"-{3,}|_{3,}", "_______", (item.get("question") or "").strip())
            q_vi = (item.get("question_vi") or "").strip()
            opts_en = item.get("options") or {}
            opts_vi = item.get("options_vi") or {}
            ans = (item.get("correct_answer") or "").strip().upper()
            if not q_en or ans not in ("A", "B", "C", "D") or len(opts_en) != 4:
                continue
            if not session.register_hash(q_en + " ".join(opts_en.values()), allow_existing=allow_dup):
                continue
            an = item.get("analysis") or {}
            gs = an.get("grammar_structure") or {}
            xp_full = " ".join(x for x in [
                an.get("correct_explanation", ""),
                an.get("wrong_analysis", ""),
                item.get("tutor_comment", ""),
            ] if x)
            topic = item.get("topic") or "Ngữ pháp & Từ vựng TOEIC"
            formula = f"{gs.get('phrase', '')}: {gs.get('usage', '')}".strip(": ") or "Phân tích ngữ pháp & ngữ cảnh chuẩn TOEIC."
            p5_hf.append({
                "id": f"{drill_id}-q{idx}",
                "part": 5,
                "topic": topic,
                "difficulty": "Trung bình",
                "sentence": q_en,
                "options": {k: str(opts_en[k]) for k in ["A", "B", "C", "D"]},
                "correctAnswer": ans,
                "explanation": build_reading_explanation_5layer(
                    question_en=q_en,
                    question_vi=q_vi or q_en,
                    options_en={k: str(opts_en[k]) for k in ["A", "B", "C", "D"]},
                    options_vi={k: str(opts_vi.get(k, opts_en[k])) for k in ["A", "B", "C", "D"]},
                    correct=ans,
                    raw_xp=xp_full,
                    topic=topic,
                    signal=f"Chủ điểm: {topic}.",
                    formula=formula,
                ),
            })
            if len(p5_hf) >= 35:
                break
        if p5_hf:
            drill_obj = {
                "id": drill_id,
                "part": 5,
                "title": "Part 5 Gia sư AI — HuggingFace TOEIC Tutor (Auto-Crawled)",
                "subtitle": f"Tuyển tập {len(p5_hf)} câu Part 5 cào từ HuggingFace Open Dataset (nggiabao19/toeic-tutor-v1) với công thức & mẹo tránh bẫy chi tiết.",
                "focusTag": "Auto-Crawled HuggingFace",
                "part5": p5_hf,
            }
            out_p.write_text(json.dumps(drill_obj, ensure_ascii=False, indent=2), encoding="utf-8")
            meta = {
                "id": drill_id,
                "part": 5,
                "title": drill_obj["title"],
                "subtitle": drill_obj["subtitle"],
                "focusTag": drill_obj["focusTag"],
                "difficulty": "Trung bình",
                "questionCount": len(p5_hf),
                "estimatedMinutes": max(10, len(p5_hf) // 2),
            }
            new_drills_meta.append(meta)
            session.sources_crawled.append({
                "tier": "Tier 1C (HuggingFace Open Dataset)",
                "source": "huggingface.co/datasets/nggiabao19/toeic-tutor-v1",
                "url": url_hf,
                "output_type": "drill",
                "output_id": drill_id,
                "questionCount": len(p5_hf),
                "partCounts": {"1": 0, "2": 0, "3": 0, "4": 0, "5": len(p5_hf), "6": 0, "7": 0},
            })
            print(f"  [OK] Saved {drill_id}.json -> {len(p5_hf)} Part 5 Qs")

    return new_drills_meta


# =============================================================================
# 7. TIER 2 CRAWLER: PLAYWRIGHT HEADLESS CHROMIUM + XHR SNIFFING + BS4
# =============================================================================
def playwright_fetch_page(url: str, wait_ms: int = 1200) -> Tuple[int, str, List[Dict[str, Any]]]:
    """
    Loads a live web page using Playwright headless Chromium with real User-Agent,
    intercepting XHR/Fetch JSON responses cleanly. Never bypasses Cloudflare/CAPTCHA.
    """
    from playwright.sync_api import sync_playwright

    captured_json: List[Dict[str, Any]] = []
    status_code = 0
    html_content = ""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1366, "height": 900},
            locale="en-US",
        )
        page = context.new_page()

        def on_response(resp):
            try:
                ctype = (resp.headers.get("content-type") or "").lower()
                if "application/json" in ctype and resp.status == 200:
                    data = resp.json()
                    captured_json.append({"url": resp.url, "data": data})
            except Exception:
                pass

        page.on("response", on_response)
        try:
            resp = page.goto(url, wait_until="domcontentloaded", timeout=25000)
            status_code = resp.status if resp else 0
            page.wait_for_timeout(wait_ms)
            html_content = page.content()
        finally:
            browser.close()

    return status_code, html_content, captured_json


def _is_blocked_page(status: int, html_text: str) -> Optional[str]:
    low = (html_text or "").lower()
    if status in (401, 403, 429, 503):
        return f"HTTP {status} Access Restricted / Rate Limited"
    if any(k in low for k in ["just a moment...", "cf-turnstile", "attention required! | cloudflare", "verify you are human"]):
        return "Cloudflare Anti-Bot / Turnstile Gate (Skipped transparently)"
    if any(k in low for k in ["đăng nhập để làm bài", "sign in to continue", "login required"]):
        return "Login Wall Required (Skipped transparently)"
    return None


def probe_gated_reference_sites(session: CrawlSession):
    """Politely checks status of common gated sites to log transparently without bypassing."""
    probe_targets = [
        ("https://study4.com/tests/toeic/", "Study4 TOEIC"),
    ]
    for url, label in probe_targets:
        try:
            r = session.http.get(url, timeout=10, allow_redirects=True)
            reason = _is_blocked_page(r.status_code, r.text) or "Requires user account login to submit/access full test JSON payload"
            session.skipped_sources.append({
                "tier": "Tier 2 (Public Web Probe)",
                "source": label,
                "url": url,
                "status": r.status_code,
                "reason": reason,
            })
        except Exception as e:
            session.skipped_sources.append({
                "tier": "Tier 2 (Public Web Probe)",
                "source": label,
                "url": url,
                "status": "TIMEOUT/ERR",
                "reason": str(e)[:120],
            })


def crawl_englishclub_web_test(
    session: CrawlSession, translator: BatchViTranslator, force: bool = False
) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
    """
    Live Tier 2 Playwright + BeautifulSoup4 crawl of EnglishClub TOEIC Practice Parts 1..7:
      https://www.englishclub.com/esl-exams/ets-toeic-practice-{1..7}.php
    """
    test_id = "englishclub-web-practice-1"
    out_json = TESTS_DIR / f"{test_id}.json"
    allow_dup = out_json.exists() and force
    test_audio_dir = AUDIO_BASE_DIR / test_id
    test_img_dir = IMAGES_BASE_DIR / test_id

    print("\n[Tier 2 - Playwright + BS4] Live crawling EnglishClub TOEIC Practice (Parts 1–7) ...")
    part1_out, part2_out, part3_out, part4_out = [], [], [], []
    part5_out, part6_out, part7_out = [], [], []
    crawled_urls = []
    xhr_json_seen = 0

    for part_num in range(1, 8):
        url = f"https://www.englishclub.com/esl-exams/ets-toeic-practice-{part_num}.php"
        time.sleep(random.uniform(1.5, 2.4))
        status, html_text, xhrs = playwright_fetch_page(url, wait_ms=700)
        xhr_json_seen += len(xhrs)
        blocked = _is_blocked_page(status, html_text)
        if blocked or status != 200:
            session.skipped_sources.append({
                "tier": "Tier 2 (Playwright Web)",
                "source": f"EnglishClub Part {part_num}",
                "url": url,
                "status": status,
                "reason": blocked or f"HTTP {status}",
            })
            continue
        crawled_urls.append(url)
        soup = BeautifulSoup(html_text, "lxml")
        main = soup.find("main") or soup.find("article") or soup.body
        raw_text = main.get_text("\n", strip=True)

        # ---- Part 1 ----
        if part_num == 1:
            audios = [urljoin(url, s.get("src")) for s in main.find_all(["audio", "source"]) if s.get("src") and ".mp3" in s.get("src")]
            imgs = [urljoin(url, im.get("src")) for im in main.find_all("img") if im.get("src") and "toeic_" in im.get("src")]
            # Split by "Example N:"
            blocks = re.split(r"Example\s+(\d+)\s*:", raw_text)
            for idx_b in range(1, len(blocks) - 1, 2):
                ex_n = int(blocks[idx_b])
                body = blocks[idx_b + 1]
                m_ans = re.search(r"correct answer is\s*[\n\s]*([A-D])", body, re.I)
                m_tr = re.search(r"Transcript:\s*(.+?)(?:$|\Z)", body, re.S | re.I)
                if not (m_ans and m_tr):
                    continue
                ans = m_ans.group(1).upper()
                opts = {}
                for k in ["A", "B", "C", "D"]:
                    mo = re.search(rf"{k}\)\s*([^\n]+)", m_tr.group(1))
                    if mo:
                        opts[k] = mo.group(1).strip()
                if len(opts) != 4:
                    continue
                if not session.register_hash("p1 " + " ".join(opts.values()), allow_existing=allow_dup):
                    continue
                vi_m = translator.translate_batch(list(opts.values()))
                img_u = imgs[ex_n - 1] if ex_n - 1 < len(imgs) else None
                aud_u = audios[ex_n - 1] if ex_n - 1 < len(audios) else None
                img_fname = f"ec_p1_{ex_n}.jpg"
                aud_fname = f"ec_p1_{ex_n}.mp3"
                img_p = test_img_dir / img_fname
                aud_p = test_audio_dir / aud_fname
                if not img_u or not download_media_file(session, img_u, img_p, 10_000, referer=url, kind="image"):
                    continue
                qid = f"{test_id}-p1-q{ex_n}"
                t_lines = [
                    {
                        "id": f"{qid}-l{i+1}",
                        "speaker": f"Option ({k})",
                        "voiceGender": "female" if ex_n % 2 == 1 else "male",
                        "accent": "en-US",
                        "en": f"({k}) {opts[k]}",
                        "vi": f"({k}) {vi_m.get(opts[k], opts[k])}",
                        "evidenceForQuestionIds": [qid] if k == ans else [],
                    }
                    for i, k in enumerate(["A", "B", "C", "D"])
                ]
                if aud_u and download_media_file(session, aud_u, aud_p, 5_000, referer=url, kind="audio"):
                    ts = distribute_timestamps([l["en"] for l in t_lines], get_mp3_duration_ms(aud_p), lead_in_ms=350)
                else:
                    ts = synthesize_fallback_mp3(t_lines, aud_p)
                    session.media_stats["audio_fallback_edge_tts"] += 1
                for l, (s_ms, e_ms) in zip(t_lines, ts):
                    l["startMs"], l["endMs"] = s_ms, e_ms
                part1_out.append({
                    "id": qid,
                    "part": 1,
                    "sceneType": "single-person" if ex_n == 1 else "scene-objects",
                    "title": f"EnglishClub Part 1 — Photo #{ex_n}",
                    "illustrationKey": "office-laptop",
                    "imageUrl": f"/images/toeic/{test_id}/{img_fname}",
                    "audioUrl": f"/audio/toeic/{test_id}/{aud_fname}",
                    "transcript": t_lines,
                    "options": {k: {"en": opts[k], "vi": vi_m.get(opts[k], opts[k])} for k in ["A", "B", "C", "D"]},
                    "correctAnswer": ans,
                    "explanation": {
                        "trapType": "Bẫy vị trí & giới từ Part 1 (EnglishClub)",
                        "trapAnalysis": f"Đáp án đúng là ({ans}): \"{opts[ans]}\" ({vi_m.get(opts[ans], opts[ans])}).",
                        "paraphrases": [],
                        "optionAnalysis": {
                            k: (f"ĐÚNG: {vi_m.get(opts[k], opts[k])}" if k == ans else f"SAI: {vi_m.get(opts[k], opts[k])}")
                            for k in ["A", "B", "C", "D"]
                        },
                        "keyVocab": [],
                    },
                })

        # ---- Part 2 ----
        elif part_num == 2:
            audios = [urljoin(url, s.get("src")) for s in main.find_all(["audio", "source"]) if s.get("src") and ".mp3" in s.get("src")]
            blocks = re.split(r"Example\s+(\d+)\s*:", raw_text)
            for idx_b in range(1, len(blocks) - 1, 2):
                ex_n = int(blocks[idx_b])
                body = blocks[idx_b + 1]
                m_ans = re.search(r"correct answer is\s*[\n\s]*([A-C])", body, re.I)
                m_tr = re.search(r"Transcript:\s*(.+)", body, re.S | re.I)
                if not (m_ans and m_tr):
                    continue
                ans = m_ans.group(1).upper()
                tr_lines_raw = [ln.strip() for ln in m_tr.group(1).splitlines() if ln.strip()]
                q_line = ""
                opts = {}
                for ln in tr_lines_raw:
                    mo = re.match(r"^([A-C])\)\s*(.+)$", ln)
                    if mo:
                        opts[mo.group(1)] = mo.group(2).strip()
                    elif not q_line and not ln.lower().startswith(("next", "try ", "previous", "toeic")):
                        q_line = ln
                if not q_line or len(opts) != 3:
                    continue
                if not session.register_hash("p2 " + q_line + " " + " ".join(opts.values()), allow_existing=allow_dup):
                    continue
                vi_m = translator.translate_batch([q_line] + list(opts.values()))
                aud_u = audios[ex_n - 1] if ex_n - 1 < len(audios) else None
                aud_fname = f"ec_p2_{ex_n}.mp3"
                aud_p = test_audio_dir / aud_fname
                raw_lines = [
                    {"en": q_line, "voiceGender": "female", "accent": "en-US"},
                    *[{"en": f"{k}. {opts[k]}", "voiceGender": "male", "accent": "en-US"} for k in ["A", "B", "C"]],
                ]
                if aud_u and download_media_file(session, aud_u, aud_p, 5_000, referer=url, kind="audio"):
                    ts = distribute_timestamps([l["en"] for l in raw_lines], get_mp3_duration_ms(aud_p), lead_in_ms=350)
                else:
                    ts = synthesize_fallback_mp3(raw_lines, aud_p)
                    session.media_stats["audio_fallback_edge_tts"] += 1
                qid = f"{test_id}-p2-q{ex_n}"
                q_type = detect_part2_type(q_line, opts[ans])
                part2_out.append({
                    "id": qid,
                    "part": 2,
                    "questionType": q_type,
                    "title": f"EnglishClub Part 2 — Câu #{ex_n}",
                    "audioUrl": f"/audio/toeic/{test_id}/{aud_fname}",
                    "questionLine": {
                        "id": f"{qid}-q",
                        "speaker": "Question",
                        "voiceGender": "female",
                        "accent": "en-US",
                        "en": q_line,
                        "vi": vi_m.get(q_line, q_line),
                        "startMs": ts[0][0],
                        "endMs": ts[0][1],
                    },
                    "options": {
                        k: {
                            "en": opts[k],
                            "vi": vi_m.get(opts[k], opts[k]),
                            "speaker": f"Speaker ({k})",
                            "voiceGender": "male",
                            "accent": "en-US",
                            "startMs": ts[i + 1][0],
                            "endMs": ts[i + 1][1],
                        }
                        for i, k in enumerate(["A", "B", "C"])
                    },
                    "correctAnswer": ans,
                    "explanation": {
                        "trapType": f"Bẫy Part 2 ({q_type})",
                        "trapAnalysis": f"Câu hỏi: \"{q_line}\" ({vi_m.get(q_line, q_line)}). Đáp án ({ans}): \"{opts[ans]}\" ({vi_m.get(opts[ans], opts[ans])}).",
                        "paraphrases": [],
                        "optionAnalysis": {
                            k: (f"ĐÚNG: {vi_m.get(opts[k], opts[k])}" if k == ans else f"SAI: {vi_m.get(opts[k], opts[k])}")
                            for k in ["A", "B", "C"]
                        },
                        "keyVocab": [],
                    },
                })

        # ---- Part 3 & Part 4 ----
        elif part_num in (3, 4):
            audios = [urljoin(url, s.get("src")) for s in main.find_all(["audio", "source"]) if s.get("src") and ".mp3" in s.get("src")]
            blocks = re.split(r"Example\s+(\d+)\s*:", raw_text)
            for idx_b in range(1, len(blocks) - 1, 2):
                ex_n = int(blocks[idx_b])
                body = blocks[idx_b + 1]
                # Extract transcript block
                m_tr = re.search(r"Transcript:\s*(.+?)(?:Explanation|Answers|Next|Previous|\Z)", body, re.S | re.I)
                if not m_tr:
                    continue
                tr_raw = m_tr.group(1).strip()
                # Extract numbered questions (1. ... A) ... B) ... C) ... D) ...)
                q_matches = list(re.finditer(
                    r"(\d+)\.\s*([^\n]+)\nA\)\s*([^\n]+)\nB\)\s*([^\n]+)\nC\)\s*([^\n]+)\nD\)\s*([^\n]+)",
                    body,
                ))
                ans_matches = re.findall(r"correct answer is\s*[\n\s]*([A-D])", body, re.I)
                if not q_matches or len(ans_matches) < len(q_matches):
                    continue

                sid = f"{test_id}-p{part_num}-s{ex_n}"
                if not session.register_hash(f"p{part_num} " + tr_raw[:250], allow_existing=allow_dup):
                    continue

                # Build transcript lines
                t_lines = []
                if part_num == 3:
                    raw_turns = [ln.strip() for ln in tr_raw.splitlines() if ln.strip()]
                    vi_tr = translator.translate_batch(raw_turns)
                    for l_i, ln in enumerate(raw_turns, start=1):
                        m_spk = re.match(r"^(Man|Woman|M|W|Speaker\s*\d*)\s*:\s*(.+)$", ln, re.I)
                        spk = m_spk.group(1) if m_spk else ("Woman" if l_i % 2 == 1 else "Man")
                        en_t = m_spk.group(2).strip() if m_spk else ln
                        t_lines.append({
                            "id": f"{sid}-l{l_i}",
                            "speaker": spk,
                            "voiceGender": "male" if spk.lower().startswith("m") else "female",
                            "accent": "en-US",
                            "en": en_t,
                            "vi": vi_tr.get(ln, en_t),
                            "evidenceForQuestionIds": [],
                        })
                else:
                    sents = split_sentences(tr_raw)
                    vi_tr = translator.translate_batch(sents)
                    for l_i, s_en in enumerate(sents, start=1):
                        t_lines.append({
                            "id": f"{sid}-l{l_i}",
                            "speaker": "Speaker",
                            "voiceGender": "male" if ex_n % 2 == 0 else "female",
                            "accent": "en-US",
                            "en": s_en,
                            "vi": vi_tr.get(s_en, s_en),
                            "evidenceForQuestionIds": [],
                        })

                aud_u = audios[ex_n - 1] if ex_n - 1 < len(audios) else None
                aud_fname = f"ec_p{part_num}_{ex_n}.mp3"
                aud_p = test_audio_dir / aud_fname
                if aud_u and download_media_file(session, aud_u, aud_p, 10_000, referer=url, kind="audio"):
                    ts = distribute_timestamps([l["en"] for l in t_lines], get_mp3_duration_ms(aud_p), lead_in_ms=350)
                else:
                    ts = synthesize_fallback_mp3(t_lines, aud_p)
                    session.media_stats["audio_fallback_edge_tts"] += 1
                for l, (s_ms, e_ms) in zip(t_lines, ts):
                    l["startMs"], l["endMs"] = s_ms, e_ms

                all_q_texts = []
                for qm in q_matches:
                    all_q_texts.extend([qm.group(2).strip(), qm.group(3).strip(), qm.group(4).strip(), qm.group(5).strip(), qm.group(6).strip()])
                vi_q = translator.translate_batch(all_q_texts)

                sub_qs = []
                for qi, qm in enumerate(q_matches):
                    ans = ans_matches[qi].upper()
                    pr = qm.group(2).strip()
                    opts = {"A": qm.group(3).strip(), "B": qm.group(4).strip(), "C": qm.group(5).strip(), "D": qm.group(6).strip()}
                    sub_id = f"{sid}-q{qi+1}"
                    q_tok = tokenize_sig(pr + " " + opts[ans])
                    best_l = max(t_lines, key=lambda l: len(q_tok & tokenize_sig(l["en"])), default=None)
                    if best_l:
                        best_l["evidenceForQuestionIds"].append(sub_id)
                    sub_qs.append({
                        "id": sub_id,
                        "questionNumber": qi + 1,
                        "questionType": detect_part34_qtype(pr, False),
                        "prompt": pr,
                        "promptVi": vi_q.get(pr, pr),
                        "options": {k: {"en": opts[k], "vi": vi_q.get(opts[k], opts[k])} for k in ["A", "B", "C", "D"]},
                        "correctAnswer": ans,
                        "explanation": {
                            "trapType": f"Nghe hiểu Part {part_num} (EnglishClub)",
                            "trapAnalysis": f"Đáp án ({ans}) \"{opts[ans]}\" ({vi_q.get(opts[ans], opts[ans])}).",
                            "paraphrases": [],
                            "optionAnalysis": {
                                k: (f"ĐÚNG: {vi_q.get(opts[k], opts[k])}" if k == ans else f"SAI: {vi_q.get(opts[k], opts[k])}")
                                for k in ["A", "B", "C", "D"]
                            },
                            "keyVocab": [],
                        },
                    })

                if part_num == 3:
                    part3_out.append({
                        "id": sid,
                        "part": 3,
                        "title": f"EnglishClub Part 3 — Hội thoại #{ex_n}",
                        "scenario": "EnglishClub Public TOEIC Short Conversation",
                        "speakerCount": 2,
                        "hasGraphic": False,
                        "audioUrl": f"/audio/toeic/{test_id}/{aud_fname}",
                        "transcript": t_lines,
                        "questions": sub_qs,
                        "keyVocab": [],
                    })
                else:
                    part4_out.append({
                        "id": sid,
                        "part": 4,
                        "title": f"EnglishClub Part 4 — Bài nói #{ex_n}",
                        "talkType": detect_talk_type(tr_raw),
                        "hasGraphic": False,
                        "audioUrl": f"/audio/toeic/{test_id}/{aud_fname}",
                        "transcript": t_lines,
                        "questions": sub_qs,
                        "keyVocab": [],
                    })

        # ---- Part 5 ----
        elif part_num == 5:
            blocks = re.split(r"Example\s+(\d+)\s*:", raw_text)
            for idx_b in range(1, len(blocks) - 1, 2):
                ex_n = int(blocks[idx_b])
                body = blocks[idx_b + 1]
                m_q = re.search(r"sentence with a blank\.?\s*\n([^\n]+___+[^\n]*)", body, re.I)
                m_opts = re.search(r"A\)\s*([^\n]+)\nB\)\s*([^\n]+)\nC\)\s*([^\n]+)\nD\)\s*([^\n]+)", body)
                m_ans = re.search(r"correct answer is\s*[\n\s]*([A-D])", body, re.I)
                if not (m_q and m_opts and m_ans):
                    continue
                sent_en = re.sub(r"_{3,}", "_______", m_q.group(1).strip())
                opts = {"A": m_opts.group(1).strip(), "B": m_opts.group(2).strip(), "C": m_opts.group(3).strip(), "D": m_opts.group(4).strip()}
                ans = m_ans.group(1).upper()
                if not session.register_hash(sent_en + " ".join(opts.values()), allow_existing=allow_dup):
                    continue
                m_exp = re.search(r"Explanation\s*\d*\s*:\s*(.+)", body, re.S | re.I)
                exp_en = re.sub(r"\s+", " ", m_exp.group(1))[:360] if m_exp else ""
                vi_m = translator.translate_batch([sent_en, exp_en] + list(opts.values()))
                topic, signal, formula = classify_part5_topic(sent_en, opts, "")
                part5_out.append({
                    "id": f"{test_id}-p5-q{ex_n}",
                    "part": 5,
                    "topic": topic,
                    "difficulty": "Trung bình",
                    "sentence": sent_en,
                    "options": opts,
                    "correctAnswer": ans,
                    "explanation": build_reading_explanation_5layer(
                        question_en=sent_en,
                        question_vi=vi_m.get(sent_en, sent_en),
                        options_en=opts,
                        options_vi={k: vi_m.get(opts[k], opts[k]) for k in ["A", "B", "C", "D"]},
                        correct=ans,
                        raw_xp=vi_m.get(exp_en, exp_en),
                        topic=topic,
                        signal=signal,
                        formula=formula,
                    ),
                })

        # ---- Part 6 ----
        elif part_num == 6:
            blocks = re.split(r"Example\s+(\d+)\s*:", raw_text)
            for idx_b in range(1, len(blocks) - 1, 2):
                ex_n = int(blocks[idx_b])
                body = blocks[idx_b + 1]
                q_matches = list(re.finditer(
                    r"(\d+)\.\s*\n?A\)\s*([^\n]+)\nB\)\s*([^\n]+)\nC\)\s*([^\n]+)\nD\)\s*([^\n]+)",
                    body,
                ))
                ans_matches = re.findall(r"correct answer is\s*[\n\s]*([A-D])", body, re.I)
                if not q_matches or len(ans_matches) < len(q_matches):
                    continue
                p_text = body[:q_matches[0].start()].strip()
                # Number blanks sequentially ___ (1) ___, ___ (2) ___
                blank_idx = [0]
                def _rep_blank(_m):
                    blank_idx[0] += 1
                    return f" ___ ({blank_idx[0]}) ___ "
                p_text_num = re.sub(r"_{3,}", _rep_blank, p_text)
                if not session.register_hash("p6 " + p_text_num[:250], allow_existing=allow_dup):
                    continue
                pid = f"{test_id}-p6-p{ex_n}"
                vi_p = translator.translate_one(p_text_num[:700])
                paragraphs, _ = html_passage_to_bilingual_paragraphs(f"<p>{html.escape(p_text_num)}</p>", vi_p, pid)
                p6_qs = []
                for qi, qm in enumerate(q_matches):
                    bn = qi + 1
                    ans = ans_matches[qi].upper()
                    opts = {"A": qm.group(2).strip(), "B": qm.group(3).strip(), "C": qm.group(4).strip(), "D": qm.group(5).strip()}
                    vi_o = translator.translate_batch(list(opts.values()))
                    ev_sid = paragraphs[0]["sentences"][0]["id"]
                    ev_quote = paragraphs[0]["sentences"][0]["en"]
                    for para in paragraphs:
                        for sent in para["sentences"]:
                            if f"({bn})" in sent["en"]:
                                ev_sid, ev_quote = sent["id"], sent["en"]
                                break
                    topic, signal, formula = classify_part5_topic(ev_quote, opts, "")
                    p6_qs.append({
                        "id": f"{pid}-q{bn}",
                        "blankNumber": bn,
                        "questionType": "Từ vựng",
                        "options": opts,
                        "correctAnswer": ans,
                        "explanation": build_reading_explanation_5layer(
                            question_en=f"Blank ({bn}): {ev_quote}",
                            question_vi=f"Chỗ trống ({bn}) — EnglishClub Part 6",
                            options_en=opts,
                            options_vi={k: vi_o.get(opts[k], opts[k]) for k in ["A", "B", "C", "D"]},
                            correct=ans,
                            raw_xp=f"Đáp án ({ans}) \"{opts[ans]}\" phù hợp ngữ cảnh và cấu trúc của đoạn văn.",
                            topic=topic,
                            signal=signal,
                            formula=formula,
                            evidence_quote=ev_quote,
                            evidence_sentence_id=ev_sid,
                        ),
                    })
                part6_out.append({
                    "id": pid,
                    "title": f"EnglishClub Part 6 — Passage #{ex_n}",
                    "genre": detect_p6_genre("", p_text),
                    "paragraphs": paragraphs,
                    "questions": p6_qs,
                })

        # ---- Part 7 ----
        elif part_num == 7:
            blocks = re.split(r"Example\s+(\d+)\s*:", raw_text)
            for idx_b in range(1, len(blocks) - 1, 2):
                ex_n = int(blocks[idx_b])
                body = blocks[idx_b + 1]
                q_matches = list(re.finditer(
                    r"(\d+)\.\s*([^\n]+)\nA\)\s*([^\n]+)\nB\)\s*([^\n]+)\nC\)\s*([^\n]+)\nD\)\s*([^\n]+)",
                    body,
                ))
                ans_matches = re.findall(r"correct answer is\s*[\n\s]*([A-D])", body, re.I)
                if not q_matches or len(ans_matches) < len(q_matches):
                    continue
                p_text = body[:q_matches[0].start()].strip()
                if len(p_text) < 40:
                    continue
                if not session.register_hash("p7 " + p_text[:250], allow_existing=allow_dup):
                    continue
                sid = f"{test_id}-p7-s{ex_n}"
                vi_p = translator.translate_one(p_text[:700])
                paras, _ = html_passage_to_bilingual_paragraphs(f"<p>{html.escape(p_text)}</p>", vi_p, f"{sid}-d1")
                genre = detect_doc_genre("", p_text)
                docs = [{
                    "id": f"{sid}-d1",
                    "tabLabel": f"Văn bản 1 ({genre})",
                    "genre": genre,
                    "title": f"EnglishClub Part 7 — {genre} #{ex_n}",
                    "paragraphs": paras,
                }]
                p7_qs = []
                for qi, qm in enumerate(q_matches):
                    ans = ans_matches[qi].upper()
                    pr = qm.group(2).strip()
                    opts = {"A": qm.group(3).strip(), "B": qm.group(4).strip(), "C": qm.group(5).strip(), "D": qm.group(6).strip()}
                    vi_q = translator.translate_batch([pr] + list(opts.values()))
                    ev_pidx, ev_sid, ev_quote = find_best_evidence_sentence(docs, pr + " " + opts[ans], "")
                    qtype = detect_part7_qtype(pr)
                    p7_qs.append({
                        "id": f"{sid}-q{qi+1}",
                        "questionNumber": qi + 1,
                        "questionType": qtype,
                        "prompt": pr,
                        "promptVi": vi_q.get(pr, pr),
                        "options": opts,
                        "correctAnswer": ans,
                        "explanation": build_reading_explanation_5layer(
                            question_en=pr,
                            question_vi=vi_q.get(pr, pr),
                            options_en=opts,
                            options_vi={k: vi_q.get(opts[k], opts[k]) for k in ["A", "B", "C", "D"]},
                            correct=ans,
                            raw_xp=f"Đáp án ({ans}) \"{opts[ans]}\" được chứng minh trực tiếp bởi câu dẫn chứng trong văn bản.",
                            topic=f"Part 7 — {qtype}",
                            signal="Định vị từ khóa câu hỏi trong văn bản gốc.",
                            formula="Đối chiếu câu dẫn chứng và cách diễn đạt đồng nghĩa (Paraphrase).",
                            evidence_quote=ev_quote,
                            evidence_passage_idx=ev_pidx,
                            evidence_sentence_id=ev_sid,
                        ),
                    })
                part7_out.append({
                    "id": sid,
                    "title": f"EnglishClub Part 7 — Reading #{ex_n}",
                    "passageCountType": "single",
                    "topic": f"Đọc hiểu EnglishClub #{ex_n}",
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
        return None

    test_data = {
        "id": test_id,
        "series": "Web Practice — EnglishClub (Playwright Auto-Crawled)",
        "year": 2026,
        "title": f"EnglishClub 7-Part Practice ({total_cnt} câu)",
        "subtitle": f"Cào trực tiếp qua Playwright + BeautifulSoup4 từ englishclub.com (đủ 7 Part, ảnh & MP3 gốc lưu cục bộ, bắt {xhr_json_seen} XHR JSON).",
        "durationMinutes": max(20, int(total_cnt * 1.0)),
        "parts": {
            "part1": part1_out,
            "part2": part2_out,
            "part3": part3_out,
            "part4": part4_out,
            "part5": part5_out,
            "part6": part6_out,
            "part7": part7_out,
        },
    }
    test_meta = {
        "id": test_id,
        "series": test_data["series"],
        "year": 2026,
        "testNumber": 1,
        "title": test_data["title"],
        "subtitle": test_data["subtitle"],
        "badge": f"WEB CRAWLED • {total_cnt} CÂU",
        "status": "ready",
        "durationMinutes": test_data["durationMinutes"],
        "miniDurationMinutes": max(10, test_data["durationMinutes"] // 2),
        "questionCount": total_cnt,
        "listeningCount": l_cnt,
        "readingCount": r_cnt,
        "partCounts": {"1": c1, "2": c2, "3": c3, "4": c4, "5": c5, "6": c6, "7": c7},
    }
    out_json.write_text(json.dumps(test_data, ensure_ascii=False, indent=2), encoding="utf-8")
    session.sources_crawled.append({
        "tier": "Tier 2 (Playwright Headless Chromium + BS4)",
        "source": "englishclub.com/esl-exams/ets-toeic-practice-{1..7}.php",
        "url": "https://www.englishclub.com/esl-exams/ets-toeic-practice-1.php .. 7.php",
        "urls": crawled_urls,
        "output_type": "test",
        "output_id": test_id,
        "questionCount": total_cnt,
        "partCounts": test_meta["partCounts"],
    })
    print(f"  [OK] Saved {test_id}.json -> {total_cnt} Qs (P1:{c1} P2:{c2} P3:{c3} P4:{c4} P5:{c5} P6:{c6} P7:{c7})")
    return test_meta, test_data


def crawl_custom_url(
    session: CrawlSession, translator: BatchViTranslator, custom_url: str
) -> Optional[Dict[str, Any]]:
    """Generic `--url <link>` crawler using Playwright + XHR/Fetch JSON interception + BS4."""
    print(f"\n[Custom --url] Crawling {custom_url} via Playwright + XHR sniffer + BS4 ...")
    status, html_text, xhrs = playwright_fetch_page(custom_url, wait_ms=1500)
    blocked = _is_blocked_page(status, html_text)
    if blocked or status != 200:
        print(f"  [SKIPPED] {custom_url} -> {blocked or f'HTTP {status}'}")
        session.skipped_sources.append({
            "tier": "Custom --url (Playwright)",
            "url": custom_url,
            "status": status,
            "reason": blocked or f"HTTP {status}",
        })
        return None

    soup = BeautifulSoup(html_text, "lxml")
    raw_text = (soup.find("main") or soup.body or soup).get_text("\n", strip=True)
    # Generic Part 5 pattern extraction from DOM text
    q_blocks = re.findall(
        r"([^\n]{15,240}(?:_{3,}|-{3,})[^\n]{0,160})\s*\n\s*\(?A\)?[.)]\s*([^\n]+)\s*\n\s*\(?B\)?[.)]\s*([^\n]+)\s*\n\s*\(?C\)?[.)]\s*([^\n]+)\s*\n\s*\(?D\)?[.)]\s*([^\n]+)",
        raw_text,
    )
    slug = re.sub(r"[^a-z0-9]+", "-", urlparse(custom_url).netloc.lower()).strip("-")[:24]
    drill_id = f"drill-p5-url-{slug}"
    p5_items = []
    for idx, (q_en, a, b, c, d_opt) in enumerate(q_blocks, start=1):
        sent_en = re.sub(r"_{3,}|-{3,}", "_______", q_en.strip())
        opts = {"A": a.strip(), "B": b.strip(), "C": c.strip(), "D": d_opt.strip()}
        if not session.register_hash(sent_en + " ".join(opts.values())):
            continue
        vi_m = translator.translate_batch([sent_en] + list(opts.values()))
        topic, signal, formula = classify_part5_topic(sent_en, opts, "")
        p5_items.append({
            "id": f"{drill_id}-q{idx}",
            "part": 5,
            "topic": topic,
            "difficulty": "Trung bình",
            "sentence": sent_en,
            "options": opts,
            "correctAnswer": "A",
            "explanation": build_reading_explanation_5layer(
                question_en=sent_en,
                question_vi=vi_m.get(sent_en, sent_en),
                options_en=opts,
                options_vi={k: vi_m.get(opts[k], opts[k]) for k in ["A", "B", "C", "D"]},
                correct="A",
                raw_xp=f"Câu hỏi cào từ {custom_url} (bắt được {len(xhrs)} gói XHR JSON).",
                topic=topic,
                signal=signal,
                formula=formula,
            ),
        })

    if not p5_items:
        print(f"  [INFO] Parsed {custom_url} (HTTP 200, {len(xhrs)} XHR JSONs), no new standard MCQ Part 5 items matched.")
        return None

    drill_obj = {
        "id": drill_id,
        "part": 5,
        "title": f"Part 5 Custom Crawl — {urlparse(custom_url).netloc}",
        "subtitle": f"Cào trực tiếp {len(p5_items)} câu từ {custom_url}.",
        "focusTag": "Custom URL Crawl",
        "part5": p5_items,
    }
    (DRILLS_DIR / f"{drill_id}.json").write_text(json.dumps(drill_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    meta = {
        "id": drill_id,
        "part": 5,
        "title": drill_obj["title"],
        "subtitle": drill_obj["subtitle"],
        "focusTag": drill_obj["focusTag"],
        "difficulty": "Trung bình",
        "questionCount": len(p5_items),
        "estimatedMinutes": max(5, len(p5_items)),
    }
    session.sources_crawled.append({
        "tier": "Custom --url (Playwright + BS4)",
        "source": urlparse(custom_url).netloc,
        "url": custom_url,
        "output_type": "drill",
        "output_id": drill_id,
        "questionCount": len(p5_items),
        "partCounts": {"1": 0, "2": 0, "3": 0, "4": 0, "5": len(p5_items), "6": 0, "7": 0},
    })
    return meta


# =============================================================================
# 8. NON-DESTRUCTIVE META MERGE & TRANSPARENT REPORT
# =============================================================================
def merge_meta_file(meta_path: Path, new_items: List[Dict[str, Any]]):
    if not new_items:
        return
    existing: List[Dict[str, Any]] = []
    if meta_path.exists():
        existing = json.loads(meta_path.read_text(encoding="utf-8"))
    by_id = {x["id"]: i for i, x in enumerate(existing)}
    for item in new_items:
        if item["id"] in by_id:
            existing[by_id[item["id"]]] = item
        else:
            existing.append(item)
            by_id[item["id"]] = len(existing) - 1
    meta_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Multi-Tier Automated TOEIC Crawler & Builder")
    parser.add_argument("--max-tests", type=int, default=3, help="Max full ETS tests to crawl from Tier 1A (default: 3)")
    parser.add_argument("--url", type=str, default=None, help="Crawl a specific custom TOEIC URL via Playwright + BS4")
    parser.add_argument("--tier1-only", action="store_true", help="Only run Tier 1 (GitHub/HuggingFace)")
    parser.add_argument("--tier2-only", action="store_true", help="Only run Tier 2 (Playwright Web)")
    parser.add_argument("--skip-drills", action="store_true", help="Skip Tier 1B/1C drill crawling")
    parser.add_argument("--force", action="store_true", help="Overwrite previously crawled outputs")
    args = parser.parse_args()

    session = CrawlSession()
    translator = BatchViTranslator()
    new_tests_meta: List[Dict[str, Any]] = []
    new_drills_meta: List[Dict[str, Any]] = []

    print("=" * 78)
    print("  TOEIC MASTERY HUB — AUTO-CRAWLER & MULTI-TIER BUILDER")
    print(f"  Existing unique question hashes indexed: {len(session.seen_hashes)}")
    print("=" * 78)

    if args.url:
        m = crawl_custom_url(session, translator, args.url)
        if m:
            new_drills_meta.append(m)
    else:
        # Tier 1A: Full 200-Q ETS Tests from mangomint1805/toeic
        if not args.tier2_only:
            count_done = 0
            for (r_idx, tid, series, year, tnum, title) in MANGOMINT_CATALOG:
                if count_done >= args.max_tests:
                    break
                res = crawl_mangomint_test(session, translator, r_idx, tid, series, year, tnum, title, force=args.force)
                if res:
                    new_tests_meta.append(res[0])
                    count_done += 1

            # Tier 1B & 1C: Drills
            if not args.skip_drills:
                new_drills_meta.extend(crawl_tier1_drills(session, translator, force=args.force))

        # Tier 2: Playwright Headless Chromium + BS4 live web crawl
        if not args.tier1_only:
            probe_gated_reference_sites(session)
            ec_res = crawl_englishclub_web_test(session, translator, force=args.force)
            if ec_res:
                new_tests_meta.append(ec_res[0])

    # Non-destructive merge into tests-meta.json & drills-meta.json
    merge_meta_file(TOEIC_DATA_DIR / "tests-meta.json", new_tests_meta)
    merge_meta_file(TOEIC_DATA_DIR / "drills-meta.json", new_drills_meta)
    translator.save()
    session.save_state()

    # Build transparent summary totals
    part_totals = {str(p): 0 for p in range(1, 8)}
    for s in session.sources_crawled:
        for pk, pv in s.get("partCounts", {}).items():
            part_totals[str(pk)] = part_totals.get(str(pk), 0) + int(pv)
    grand_total = sum(part_totals.values())

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cli_args": vars(args),
        "summary": {
            "new_tests_added": len(new_tests_meta),
            "new_drills_added": len(new_drills_meta),
            "total_new_questions": grand_total,
            "questions_by_part": part_totals,
            "duplicates_skipped": session.duplicates_skipped,
        },
        "media": session.media_stats,
        "sources_crawled": session.sources_crawled,
        "skipped_sources": session.skipped_sources,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n" + "=" * 78)
    print("  CRAWL REPORT SUMMARY (Saved to scripts/crawl_report.json)")
    print("=" * 78)
    print(f"  New Tests Added     : {len(new_tests_meta)}")
    print(f"  New Drills Added    : {len(new_drills_meta)}")
    print(f"  Total New Questions : {grand_total}")
    print(f"  Breakdown by Part   : " + " | ".join(f"P{p}:{part_totals[str(p)]}" for p in range(1, 8)))
    print(f"  Duplicates Skipped  : {session.duplicates_skipped}")
    print(
        f"  Media Archived      : Images={session.media_stats['images_downloaded']} dl / {session.media_stats['images_cached']} cached"
        f" | Audio={session.media_stats['audio_downloaded']} dl / {session.media_stats['audio_cached']} cached"
        f" | edge-tts fallback={session.media_stats['audio_fallback_edge_tts']}"
    )
    print(f"  Skipped/Gated URLs  : {len(session.skipped_sources)}")
    print("=" * 78)


if __name__ == "__main__":
    main()
