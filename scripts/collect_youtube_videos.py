#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/collect_youtube_videos.py
=================================
Resumable, rate-limit-resilient pipeline to collect 1,000+ English-learning
YouTube videos across 24 curated channels (scripts/video_channels_config.json)
via yt-dlp + youtube-transcript-api, normalize captions into dictation-ready
sentences, batch-translate (15-20 sentences/request) into Vietnamese with
persistent caching, auto-classify CEFR levels (A1-C1), extract listening quiz
items, and checkpoint incrementally every 5 videos to public/data/videos/.

Examples:
  python -u scripts/collect_youtube_videos.py --max-per-channel 5
  python -u scripts/collect_youtube_videos.py --tier famous --max-per-channel 30
  python -u scripts/collect_youtube_videos.py --channel bbc-learning-english
  python -u scripts/collect_youtube_videos.py --cache-only
"""

import argparse
import hashlib
import html
import json
import os
import random
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import yt_dlp
from deep_translator import GoogleTranslator, MyMemoryTranslator
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import GenericProxyConfig

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = Path(__file__).resolve().parent / "video_channels_config.json"
PUBLIC_VOCAB_DIR = ROOT / "public" / "data" / "vocab"
OUTPUT_DIR = ROOT / "public" / "data" / "videos"
ITEMS_DIR = OUTPUT_DIR / "items"
CACHE_DIR = ROOT / "scripts" / "cache"
VI_CACHE_PATH = CACHE_DIR / "yt_vi_cache.json"
TRANSCRIPT_CACHE_PATH = CACHE_DIR / "yt_transcripts_cache.json"
CHANNEL_THUMBS_CACHE_PATH = CACHE_DIR / "yt_channel_thumbs.json"

CHECKPOINT_EVERY = 5

CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"]
CEFR_TO_NUM = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5}
NUM_TO_CEFR = {1: "A1", 2: "A2", 3: "B1", 4: "B2", 5: "C1"}

TOPICS = [
    "Giao tiếp hàng ngày",
    "Công sở & Kinh doanh",
    "Khoa học & Công nghệ",
    "Kỹ năng & Phát triển",
    "Tin tức & Văn hóa",
]

SKIP_TITLE_PATTERNS = [
    r"\bblack friday\b",
    r"\bcyber monday\b",
    r"\bcourse sale\b",
    r"\bsave \d+%\b",
    r"\bdiscount\b",
    r"\bgiveaway\b",
    r"\bchannel trailer\b",
    r"\b#shorts\b",
    r"\blive stream\b",
    r"\bcompilation\b",
    r"\b1 hour\b",
    r"\b2 hours\b",
    r"\b3 hours\b",
    r"\bwebinar\b",
    r"\bpromo\b",
    r"\bmerch\b",
    r"\bpatreon\b",
    r"\bannouncement\b",
]

ABBREVIATIONS = {
    "mr.", "mrs.", "ms.", "dr.", "prof.", "st.", "jr.", "sr.", "vs.",
    "etc.", "e.g.", "i.e.", "u.s.", "u.k.", "u.n.", "a.m.", "p.m.",
    "inc.", "ltd.", "corp.", "no.", "fig.", "vol.", "jan.", "feb.",
    "mar.", "apr.", "aug.", "sep.", "sept.", "oct.", "nov.", "dec.",
}

BASIC_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "so", "as", "at", "by", "for",
    "in", "of", "on", "to", "up", "is", "am", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "can", "could", "may", "might", "must", "i", "you", "he", "she",
    "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his",
    "its", "our", "their", "this", "that", "these", "those", "here", "there",
    "who", "what", "when", "where", "why", "how", "which", "not", "no", "yes",
    "yeah", "okay", "ok", "oh", "um", "uh", "well", "just", "very", "too", "also",
    "now", "then", "than", "into", "from", "with", "about", "out", "over", "all",
    "some", "any", "one", "two", "three", "more", "most", "much", "many", "like",
    "get", "got", "go", "going", "went", "make", "made", "know", "think", "say",
    "said", "see", "saw", "come", "came", "take", "took", "want", "look", "use",
    "really", "actually", "right", "good", "great", "new", "first", "time", "way",
    "thing", "things", "people", "man", "woman", "day", "year", "don't", "doesn't",
    "didn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "won't",
    "can't", "couldn't", "wouldn't", "shouldn't", "i'm", "you're", "he's", "she's",
    "it's", "we're", "they're", "i've", "you've", "we've", "they've", "i'll",
    "you'll", "we'll", "they'll", "that's", "there's", "here's", "what's", "let's",
}

TOPIC_KEYWORDS: Dict[str, List[str]] = {
    "Công sở & Kinh doanh": [
        "business", "company", "companies", "career", "job", "office", "workplace",
        "manager", "management", "leadership", "leader", "ceo", "economy", "economic",
        "finance", "financial", "market", "marketing", "strategy", "startup", "corporate",
        "salary", "interview", "negotiation", "client", "customer", "revenue", "profit",
        "employee", "employees", "team", "meeting", "email", "productivity", "hiring",
        "promotion", "entrepreneur", "investment", "supply chain", "innovation", "industry",
    ],
    "Khoa học & Công nghệ": [
        "science", "scientific", "technology", "tech", "ai", "artificial intelligence",
        "brain", "space", "universe", "planet", "physics", "quantum", "biology", "cell",
        "dna", "virus", "bacteria", "immune", "climate", "energy", "earth", "ocean",
        "evolution", "animal", "species", "computer", "software", "robot", "digital",
        "internet", "algorithm", "medicine", "medical", "health", "cancer", "sleep",
        "molecule", "atom", "gravity", "star", "black hole", "mold", "device", "mosquito",
    ],
    "Kỹ năng & Phát triển": [
        "skill", "skills", "habit", "habits", "focus", "motivation", "mindset", "growth",
        "learn", "learning", "study", "memory", "confidence", "communication", "speaking",
        "pronunciation", "vocabulary", "grammar", "fluent", "fluency", "shadowing",
        "thinking", "creative", "creativity", "decision", "psychology", "stress",
        "happiness", "success", "goal", "goals", "time management", "advice", "tips",
    ],
    "Tin tức & Văn hóa": [
        "news", "world", "global", "history", "historical", "culture", "cultural",
        "society", "social", "generation", "gen z", "city", "country", "government",
        "policy", "climate talks", "cop", "media", "tradition", "festival", "art",
        "music", "movie", "book", "sport", "food", "ramen", "travel", "tourism",
        "environment", "population", "education", "school", "university", "modern",
    ],
    "Giao tiếp hàng ngày": [
        "daily", "everyday", "conversation", "greetings", "hello", "welcome", "friend",
        "friends", "family", "shopping", "restaurant", "coffee", "hotel", "airport",
        "weather", "weekend", "morning", "routine", "small talk", "polite", "phrases",
        "expressions", "idiom", "idioms", "dialogue", "meet", "introduce", "order food",
        "doctor", "phone call", "directions", "hobby", "hobbies", "vacation", "trip",
    ],
}


# ---------------------------------------------------------------------------
# 1. Local Oxford A1-C1 & TOEIC Vocabulary Loader
# ---------------------------------------------------------------------------

def _simple_stems(word: str) -> List[str]:
    w = word.lower()
    cands = [w]
    if len(w) > 4 and w.endswith("ies"):
        cands.append(w[:-3] + "y")
    if len(w) > 4 and w.endswith("ied"):
        cands.append(w[:-3] + "y")
    if len(w) > 3 and w.endswith("es"):
        cands.append(w[:-2])
        cands.append(w[:-1])
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        cands.append(w[:-1])
    if len(w) > 4 and w.endswith("ed"):
        cands.append(w[:-2])
        cands.append(w[:-1])
        if len(w) > 5 and w[-3] == w[-4]:
            cands.append(w[:-3])
    if len(w) > 5 and w.endswith("ing"):
        cands.append(w[:-3])
        cands.append(w[:-3] + "e")
        if len(w) > 6 and w[-4] == w[-5]:
            cands.append(w[:-4])
    if len(w) > 4 and w.endswith("ly"):
        cands.append(w[:-2])
    if len(w) > 4 and w.endswith("er"):
        cands.append(w[:-2])
        cands.append(w[:-1])
    if len(w) > 5 and w.endswith("est"):
        cands.append(w[:-3])
        cands.append(w[:-2])
    return cands


def load_oxford_and_toeic_vocab() -> Tuple[Dict[str, int], Dict[str, Dict[str, Any]]]:
    oxford_files = [
        ("oxford-3000-a1.json", 1),
        ("oxford-3000-a2.json", 2),
        ("oxford-3000-b1.json", 3),
        ("oxford-3000-b2.json", 4),
        ("oxford-5000-b2.json", 4),
        ("oxford-5000-c1.json", 5),
    ]
    toeic_files = [
        "toeic-600.json",
        "toeic-ets.json",
        "topic-business.json",
    ]

    word_cefr: Dict[str, int] = {}
    vocab_meta: Dict[str, Dict[str, Any]] = {}

    def register_word(raw_word: str, cefr_num: int, meta: Optional[Dict[str, Any]] = None, is_toeic: bool = False):
        key = raw_word.strip().lower()
        if not key or " " in key or not re.fullmatch(r"[a-z][a-z\-']*[a-z]", key):
            return
        if cefr_num > 0:
            prev = word_cefr.get(key)
            if prev is None or cefr_num < prev:
                word_cefr[key] = cefr_num
        if meta:
            existing = vocab_meta.get(key)
            if existing is None:
                vocab_meta[key] = {
                    "word": meta.get("word", raw_word).strip(),
                    "pos": meta.get("pos", "n"),
                    "ipa": meta.get("ipaUS") or meta.get("ipaUK") or "",
                    "meaningVi": (meta.get("meaning") or "").strip(),
                    "cefrNum": cefr_num if cefr_num > 0 else 3,
                    "cefr": NUM_TO_CEFR.get(cefr_num, "B1"),
                    "isToeic": is_toeic,
                }
            else:
                if is_toeic:
                    existing["isToeic"] = True
                if cefr_num > 0 and cefr_num < existing["cefrNum"]:
                    existing["cefrNum"] = cefr_num
                    existing["cefr"] = NUM_TO_CEFR[cefr_num]
                if not existing["meaningVi"] and meta.get("meaning"):
                    existing["meaningVi"] = meta["meaning"].strip()
                if not existing["ipa"] and (meta.get("ipaUS") or meta.get("ipaUK")):
                    existing["ipa"] = meta.get("ipaUS") or meta.get("ipaUK") or ""

    for fname, level_num in oxford_files:
        fpath = PUBLIC_VOCAB_DIR / fname
        if not fpath.exists():
            continue
        deck = json.loads(fpath.read_text(encoding="utf-8"))
        for topic in deck.get("topics", []):
            for w in topic.get("words", []):
                register_word(w.get("word", ""), level_num, meta=w, is_toeic=False)
                for wf in w.get("wordFamily", []):
                    if isinstance(wf, str):
                        register_word(wf, level_num, meta=None)

    for fname in toeic_files:
        fpath = PUBLIC_VOCAB_DIR / fname
        if not fpath.exists():
            continue
        deck = json.loads(fpath.read_text(encoding="utf-8"))
        for topic in deck.get("topics", []):
            for w in topic.get("words", []):
                key = (w.get("word") or "").strip().lower()
                inferred_level = word_cefr.get(key, 3)
                register_word(w.get("word", ""), inferred_level, meta=w, is_toeic=True)

    return word_cefr, vocab_meta


# ---------------------------------------------------------------------------
# 2. Persistent Caches & Fast Batched Translation (15-20 sentences/request)
# ---------------------------------------------------------------------------

def load_json_cache(path: Path) -> Dict[str, Any]:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_json_atomic(path: Path, data: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


class ViTranslator:
    """
    Cached, batched EN -> VI translator (15-20 sentences/request) with resilient cascade:
      1) deep_translator.GoogleTranslator newline batching (18 sentences/req, auto-bypass on 429)
      2) Mozhi Neural (duckduckgo / Azure Neural) ` ||| ` batching
      3) deep_translator.MyMemoryTranslator fallback
    """

    def __init__(self, cache_path: Path):
        self.cache_path = cache_path
        self.cache: Dict[str, str] = load_json_cache(cache_path)
        self.lock = threading.Lock()
        self.dirty = False
        self.google_available = self._probe_google()
        print(
            f"      Translator ready (Google batch={'ON (18/req)' if self.google_available else '429-bypass -> Mozhi Neural'}, "
            f"cached={len(self.cache)} phrases)."
        )

    @staticmethod
    def _probe_google() -> bool:
        try:
            res = GoogleTranslator(source="en", target="vi").translate("Hello world")
            return bool(res and res.strip())
        except Exception:
            return False

    @staticmethod
    def _mozhi_translate(payload: str, timeout: int = 18) -> Optional[str]:
        url = (
            "https://mozhi.aryak.me/api/translate?engine=duckduckgo&from=en&to=vi&text="
            + urllib.parse.quote(payload)
        )
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            txt = data.get("translated-text", "")
            return txt.strip() if isinstance(txt, str) and txt.strip() else None

    @staticmethod
    def _postprocess(vi: str, orig_en: str) -> str:
        s = re.sub(r"\s+", " ", (vi or "").strip())
        if s and orig_en and orig_en[0].isupper() and s[0].islower():
            s = s[0].upper() + s[1:]
        return s

    def _translate_single(self, text: str) -> str:
        clean_src = text.strip().replace("\n", " ").replace("|||", "-")
        if not clean_src:
            return ""
        with self.lock:
            cached = self.cache.get(text.strip())
            if cached and cached.strip():
                return cached.strip()

        if self.google_available:
            try:
                res = GoogleTranslator(source="en", target="vi").translate(clean_src)
                if res and res.strip():
                    out = self._postprocess(res, text)
                    with self.lock:
                        self.cache[text.strip()] = out
                        self.dirty = True
                    return out
            except Exception as e:
                if "TooManyRequests" in type(e).__name__ or "429" in str(e):
                    self.google_available = False

        for attempt in range(3):
            try:
                res = self._mozhi_translate(clean_src, timeout=16)
                if res:
                    out = self._postprocess(res, text)
                    with self.lock:
                        self.cache[text.strip()] = out
                        self.dirty = True
                    return out
            except Exception:
                time.sleep(0.5 * (attempt + 1))

        try:
            res = MyMemoryTranslator(source="en-GB", target="vi-VN").translate(clean_src)
            if res and res.strip():
                out = self._postprocess(res, text)
                with self.lock:
                    self.cache[text.strip()] = out
                    self.dirty = True
                return out
        except Exception:
            pass

        with self.lock:
            self.cache[text.strip()] = text.strip()
            self.dirty = True
        return text.strip()

    def _translate_batch(self, texts: List[str]) -> Dict[str, str]:
        if not texts:
            return {}
        if len(texts) == 1:
            return {texts[0]: self._translate_single(texts[0])}

        cleaned = [re.sub(r"\s+", " ", t.strip()).replace("|||", "-") for t in texts]

        # 1) GoogleTranslator newline batch (15-20 sentences/request)
        if self.google_available:
            try:
                blob = GoogleTranslator(source="en", target="vi").translate("\n".join(cleaned))
                if blob:
                    lines = [ln.strip() for ln in blob.split("\n") if ln.strip()]
                    if len(lines) == len(texts):
                        out = {orig: self._postprocess(tr, orig) for orig, tr in zip(texts, lines)}
                        with self.lock:
                            self.cache.update(out)
                            self.dirty = True
                        return out
            except Exception as e:
                if "TooManyRequests" in type(e).__name__ or "429" in str(e):
                    self.google_available = False

        # 2) Mozhi Neural ` ||| ` batch (keep URL safely under GET limits)
        payload = " ||| ".join(cleaned)
        if len(payload) <= 1300:
            for attempt in range(3):
                try:
                    blob = self._mozhi_translate(payload, timeout=20)
                    if blob:
                        parts = [p.strip() for p in blob.split("|||")]
                        if len(parts) == len(texts) and all(parts):
                            out = {orig: self._postprocess(tr, orig) for orig, tr in zip(texts, parts)}
                            with self.lock:
                                self.cache.update(out)
                                self.dirty = True
                            return out
                except Exception:
                    time.sleep(0.5 * (attempt + 1))

        # Split in half and retry
        mid = len(texts) // 2
        left = self._translate_batch(texts[:mid])
        right = self._translate_batch(texts[mid:])
        left.update(right)
        return left

    def translate_many(self, texts: List[str]) -> List[str]:
        unique_missing: List[str] = []
        seen: Set[str] = set()
        with self.lock:
            for t in texts:
                clean_t = t.strip()
                if clean_t and clean_t not in self.cache and clean_t not in seen:
                    unique_missing.append(clean_t)
                    seen.add(clean_t)

        if unique_missing:
            max_items = 18 if self.google_available else 12
            max_chars = 3200 if self.google_available else 1100
            chunks: List[List[str]] = []
            cur_chunk: List[str] = []
            cur_len = 0
            for item in unique_missing:
                if cur_chunk and (cur_len + len(item) + 5 > max_chars or len(cur_chunk) >= max_items):
                    chunks.append(cur_chunk)
                    cur_chunk = []
                    cur_len = 0
                cur_chunk.append(item)
                cur_len += len(item) + 5
            if cur_chunk:
                chunks.append(cur_chunk)

            with ThreadPoolExecutor(max_workers=4) as pool:
                futs = [pool.submit(self._translate_batch, ch) for ch in chunks]
                for f in as_completed(futs):
                    f.result()

        results: List[str] = []
        for t in texts:
            key = t.strip()
            with self.lock:
                val = (self.cache.get(key) or "").strip()
            results.append(val if val else self._translate_single(t))
        return results

    def flush(self):
        with self.lock:
            if self.dirty:
                save_json_atomic(self.cache_path, self.cache)
                self.dirty = False


# ---------------------------------------------------------------------------
# 3. Transcript Fetching (Anti-429 Jitter + Backoff) & Sentence Normalization
# ---------------------------------------------------------------------------

def clean_caption_text(raw: str) -> str:
    txt = html.unescape(raw or "")
    txt = txt.replace("\n", " ").replace("\r", " ")
    txt = re.sub(r"♪[^♪]*♪", " ", txt)
    txt = txt.replace("♪", " ")
    txt = re.sub(r"\[[^\]]{1,40}\]", " ", txt)
    txt = re.sub(
        r"\((?:music|applause|laughter|cheering|sighs|clears throat|inaudible|bell|chime|ding|intro)[^)]*\)",
        " ",
        txt,
        flags=re.I,
    )
    txt = re.sub(r"^\s*>>+\s*", "", txt)
    txt = re.sub(r"^\s*[A-Z][A-Z0-9\s]{1,18}:\s+", "", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def is_valid_english_text(text: str) -> bool:
    if not text:
        return False
    return len(re.findall(r"[A-Za-z]", text)) >= 2


def _split_at_sentence_boundaries(text: str, start: float, end: float) -> List[Tuple[str, float, float]]:
    spans: List[str] = []
    cur: List[str] = []
    tokens = text.split(" ")
    for i, tok in enumerate(tokens):
        cur.append(tok)
        clean_tok = tok.strip("\"'”’)")
        low_tok = clean_tok.lower()
        is_end_punct = bool(re.search(r"[.!?][\"'”’)\]]*$", tok))
        is_abbrev = low_tok in ABBREVIATIONS or bool(re.fullmatch(r"[A-Za-z]\.", clean_tok))
        is_decimal = bool(re.search(r"\d\.$", clean_tok))
        if is_end_punct and not is_abbrev and not is_decimal and i < len(tokens) - 1:
            spans.append(" ".join(cur).strip())
            cur = []
    if cur:
        spans.append(" ".join(cur).strip())

    if len(spans) <= 1:
        return [(text, start, end)]

    total_chars = max(1, sum(len(s) for s in spans))
    dur = max(0.4, end - start)
    out: List[Tuple[str, float, float]] = []
    cursor = start
    for idx, s in enumerate(spans):
        frac = len(s) / total_chars
        seg_end = end if idx == len(spans) - 1 else min(end, cursor + dur * frac)
        if seg_end <= cursor:
            seg_end = cursor + 0.3
        out.append((s, cursor, seg_end))
        cursor = seg_end
    return out


def _split_overlong_sentence(text: str, start: float, end: float, max_words: int = 20) -> List[Tuple[str, float, float]]:
    words = text.split()
    if len(words) <= max_words:
        return [(text, start, end)]

    chunks: List[str] = []
    remaining = words[:]
    while len(remaining) > max_words:
        target = min(16, len(remaining) // 2 + 2)
        best_idx = None
        for idx in range(min(max_words, len(remaining) - 4), 7, -1):
            w_prev = remaining[idx - 1]
            w_cur = remaining[idx].lower()
            if w_prev.endswith((",", ";", ":", "—", "-")):
                best_idx = idx
                break
            if w_cur in ("and", "but", "because", "which", "that", "when", "while", "so", "however", "although", "where"):
                if best_idx is None:
                    best_idx = idx
        if best_idx is None:
            best_idx = min(target, max_words)
        chunks.append(" ".join(remaining[:best_idx]).strip())
        remaining = remaining[best_idx:]
    if remaining:
        if len(remaining) <= 3 and chunks:
            chunks[-1] = (chunks[-1] + " " + " ".join(remaining)).strip()
        else:
            chunks.append(" ".join(remaining).strip())

    total_chars = max(1, sum(len(c) for c in chunks))
    dur = max(0.5, end - start)
    out: List[Tuple[str, float, float]] = []
    cursor = start
    for idx, c in enumerate(chunks):
        frac = len(c) / total_chars
        seg_end = end if idx == len(chunks) - 1 else min(end, cursor + dur * frac)
        if seg_end <= cursor:
            seg_end = cursor + 0.3
        out.append((c, cursor, seg_end))
        cursor = seg_end
    return out


def normalize_sentences(raw_snippets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    atoms: List[Tuple[str, float, float]] = []
    for sn in raw_snippets:
        txt = clean_caption_text(sn.get("text", ""))
        if not is_valid_english_text(txt):
            continue
        st = max(0.0, float(sn.get("start", 0.0)))
        dur = max(0.3, float(sn.get("duration", 2.0)))
        en = st + dur
        atoms.extend(_split_at_sentence_boundaries(txt, st, en))

    if not atoms:
        return []

    merged: List[Tuple[str, float, float]] = []
    buf_texts: List[str] = []
    buf_start: Optional[float] = None
    buf_end: float = 0.0
    buf_words: int = 0

    def flush():
        nonlocal buf_texts, buf_start, buf_end, buf_words
        if not buf_texts or buf_start is None:
            return
        combined = re.sub(r"\s+", " ", " ".join(buf_texts)).strip()
        if combined and is_valid_english_text(combined):
            end_ts = max(buf_end, buf_start + 0.4)
            merged.extend(_split_overlong_sentence(combined, buf_start, end_ts, max_words=20))
        buf_texts = []
        buf_start = None
        buf_end = 0.0
        buf_words = 0

    for txt, st, en in atoms:
        wcnt = len(txt.split())
        if buf_start is not None:
            gap = st - buf_end
            projected_words = buf_words + wcnt
            projected_dur = en - buf_start
            if (gap >= 1.6 and buf_words >= 4) or (
                buf_words >= 6 and (projected_words > 18 or projected_dur > 8.5)
            ):
                flush()

        if buf_start is None:
            buf_start = st
        buf_texts.append(txt)
        buf_end = max(buf_end, en)
        buf_words += wcnt

        last_tok = txt.split()[-1]
        clean_last = last_tok.strip("\"'”’)")
        is_end_punct = bool(re.search(r"[.!?][\"'”’)\]]*$", last_tok))
        is_abbrev = clean_last.lower() in ABBREVIATIONS or bool(re.fullmatch(r"[A-Za-z]\.", clean_last))
        is_decimal = bool(re.search(r"\d\.$", clean_last))
        if (is_end_punct and not is_abbrev and not is_decimal and buf_words >= 3) or buf_words >= 18 or (buf_end - buf_start) >= 8.2:
            flush()

    flush()

    sentences: List[Dict[str, Any]] = []
    for i, (txt, st, en) in enumerate(merged):
        txt = re.sub(r"\s+", " ", txt).strip()
        if txt and txt[0].islower():
            txt = txt[0].upper() + txt[1:]
        if txt and txt[-1].isalnum():
            txt = txt + "."
        if i + 1 < len(merged):
            next_st = merged[i + 1][1]
            if en > next_st + 0.15 and next_st > st + 0.4:
                en = next_st
        st_r = round(max(0.0, st), 2)
        if sentences and st_r < sentences[-1]["start"]:
            st_r = round(sentences[-1]["end"], 2)
        en_r = round(max(st_r + 0.35, en), 2)
        wc = len(re.findall(r"[A-Za-z0-9']+", txt))
        if wc < 2:
            continue
        sentences.append({
            "index": len(sentences),
            "start": st_r,
            "end": en_r,
            "textEn": txt,
            "textVi": "",
            "wordCount": wc,
        })

    return sentences


def fetch_english_transcript(
    api: YouTubeTranscriptApi,
    youtube_id: str,
    transcript_cache: Dict[str, Any],
    rate_limit_state: Dict[str, Any],
) -> Tuple[Optional[List[Dict[str, Any]]], bool, str]:
    """
    Fetch English transcript (preferring manual over auto-generated).
    Returns (raw_snippets, is_manual, status) where status in {'ok', 'cached', 'none', 'rate_limited'}.
    """
    if youtube_id in transcript_cache:
        entry = transcript_cache[youtube_id]
        if entry is None:
            return None, False, "none"
        return entry.get("snippets"), bool(entry.get("isManual", False)), "cached"

    if rate_limit_state.get("global_blocked"):
        return None, False, "rate_limited"

    for attempt in range(2):
        # Jittered human-like delay (1.2-2.5s normally; 15-30s backoff after 429)
        if attempt == 0:
            time.sleep(random.uniform(1.2, 2.5))
        else:
            backoff = random.uniform(15.0, 26.0)
            print(f"      [BACKOFF] Cooling down {backoff:.1f}s after rate-limit on {youtube_id}...")
            time.sleep(backoff)

        try:
            tlist = api.list(youtube_id)
            chosen = None
            is_manual = False

            for t in tlist:
                code = (t.language_code or "").lower()
                if (code == "en" or code.startswith("en-")) and not t.is_generated:
                    chosen = t
                    is_manual = True
                    break

            if chosen is None:
                for t in tlist:
                    code = (t.language_code or "").lower()
                    if (code == "en" or code.startswith("en-")) and t.is_generated:
                        chosen = t
                        is_manual = False
                        break

            if chosen is None:
                transcript_cache[youtube_id] = None
                return None, False, "none"

            fetched = chosen.fetch()
            snippets = [
                {
                    "text": getattr(s, "text", s["text"] if isinstance(s, dict) else ""),
                    "start": float(getattr(s, "start", s["start"] if isinstance(s, dict) else 0.0)),
                    "duration": float(getattr(s, "duration", s["duration"] if isinstance(s, dict) else 2.0)),
                }
                for s in fetched
            ]
            transcript_cache[youtube_id] = {"isManual": is_manual, "snippets": snippets}
            rate_limit_state["consecutive_blocks"] = 0
            return snippets, is_manual, "ok"
        except Exception as ex:
            ename = type(ex).__name__
            emsg = str(ex)
            if ename in ("TranscriptsDisabled", "NoTranscriptFound", "VideoUnavailable", "AgeRestricted"):
                transcript_cache[youtube_id] = None
                return None, False, "none"
            if ename in ("RequestBlocked", "IpBlocked", "TooManyRequests") or "429" in emsg:
                rate_limit_state["consecutive_blocks"] = rate_limit_state.get("consecutive_blocks", 0) + 1
                print(f"      [RATE-LIMIT] {ename} on {youtube_id} (attempt {attempt + 1}/2, streak={rate_limit_state['consecutive_blocks']})")
                if attempt == 0:
                    continue
                return None, False, "rate_limited"
            return None, False, "none"
    return None, False, "rate_limited"


# ---------------------------------------------------------------------------
# 4. CEFR Classifier, Topic Tagger & Listening Quiz Extractor
# ---------------------------------------------------------------------------

def classify_cefr(
    title_en: str,
    sentences: List[Dict[str, Any]],
    duration_sec: int,
    word_cefr: Dict[str, int],
    prior_score: float,
) -> Tuple[str, int, Dict[str, float]]:
    all_text = " ".join(s["textEn"] for s in sentences)
    tokens = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", all_text)
    total_words = len(tokens)

    span_sec = sentences[-1]["end"] - sentences[0]["start"] + 4.0 if sentences else float(duration_sec)
    effective_sec = max(30.0, min(float(duration_sec), span_sec))
    wpm = int(round(total_words / (effective_sec / 60.0)))
    wpm = max(60, min(250, wpm))

    if wpm < 100:
        wpm_score = 1.2
    elif wpm < 120:
        wpm_score = 1.2 + (wpm - 100) / 20.0 * 0.9
    elif wpm < 145:
        wpm_score = 2.1 + (wpm - 120) / 25.0 * 1.0
    elif wpm < 170:
        wpm_score = 3.1 + (wpm - 145) / 25.0 * 1.0
    else:
        wpm_score = min(5.0, 4.1 + (wpm - 170) / 30.0 * 0.9)

    level_counts: Counter = Counter()
    content_total = 0
    advanced_unseen = 0
    for tok in tokens:
        low = tok.lower()
        if low in BASIC_STOPWORDS or len(low) <= 2 or "'" in low:
            continue
        matched_lvl = None
        for cand in _simple_stems(low):
            if cand in word_cefr:
                matched_lvl = word_cefr[cand]
                break
        content_total += 1
        if matched_lvl is not None:
            level_counts[matched_lvl] += 1
        elif len(low) >= 7 and not tok[0].isupper():
            advanced_unseen += 1

    denom = max(1, content_total)
    hard_ratio = (level_counts[4] + level_counts[5] * 1.45 + advanced_unseen * 0.65) / denom
    mid_plus_ratio = (level_counts[3] + level_counts[4] + level_counts[5] + advanced_unseen * 0.65) / denom

    vocab_score = max(1.0, min(5.0, 1.0 + min(4.0, (hard_ratio * 10.5) + (mid_plus_ratio * 2.4))))

    t_low = title_en.lower()
    title_adj = 0.0
    if any(k in t_low for k in ["a1", "beginner", "starter", "basic english", "let's learn english", "slow english", "real easy english"]):
        title_adj -= 0.55
    elif any(k in t_low for k in ["a2", "elementary", "english in a minute", "daily life"]):
        title_adj -= 0.25
    elif any(k in t_low for k in ["b1", "intermediate", "6 minute english"]):
        title_adj += 0.0
    elif any(k in t_low for k in ["b2", "upper-intermediate", "upper intermediate"]):
        title_adj += 0.25
    elif any(k in t_low for k in ["c1", "c2", "advanced"]):
        title_adj += 0.55

    adjusted_prior = max(1.0, min(5.0, prior_score + title_adj))
    final_score = 0.30 * wpm_score + 0.35 * vocab_score + 0.35 * adjusted_prior

    if final_score < 2.00:
        cefr = "A1"
    elif final_score < 2.65:
        cefr = "A2"
    elif final_score < 3.40:
        cefr = "B1"
    elif final_score < 4.05:
        cefr = "B2"
    else:
        cefr = "C1"

    return cefr, wpm, {
        "finalScore": round(final_score, 2),
        "wpmScore": round(wpm_score, 2),
        "vocabScore": round(vocab_score, 2),
        "priorScore": round(adjusted_prior, 2),
        "hardRatio": round(hard_ratio, 3),
    }


def classify_topic(title_en: str, sentences: List[Dict[str, Any]], default_topic: str) -> str:
    sample_text = " ".join(s["textEn"] for s in sentences[:35]).lower()
    t_low = title_en.lower()
    scores: Dict[str, float] = {t: 0.0 for t in TOPICS}
    scores[default_topic] += 2.5

    for topic, kws in TOPIC_KEYWORDS.items():
        for kw in kws:
            pat = r"(?<!\w)" + re.escape(kw) + r"(?!\w)"
            if re.search(pat, t_low):
                scores[topic] += 3.0
            hits = len(re.findall(pat, sample_text))
            if hits:
                scores[topic] += min(4.0, hits * 0.7)

    return max(TOPICS, key=lambda t: scores[t])


def generate_quiz_items(
    youtube_id: str,
    sentences: List[Dict[str, Any]],
    vocab_meta: Dict[str, Dict[str, Any]],
    target_min: int = 6,
    target_max: int = 10,
) -> List[Dict[str, Any]]:
    rng = random.Random(int(hashlib.md5(youtube_id.encode("utf-8")).hexdigest()[:8], 16))

    pool_by_pos: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    all_pool: List[Dict[str, Any]] = []
    for meta in vocab_meta.values():
        w = meta["word"].lower()
        if len(w) >= 4 and w.isalpha() and meta.get("meaningVi"):
            pool_by_pos[meta["pos"]].append(meta)
            all_pool.append(meta)

    candidates: List[Tuple[float, int, str, Dict[str, Any]]] = []
    for sent in sentences:
        if sent["wordCount"] < 5 or sent["wordCount"] > 22:
            continue
        words_in_sent = re.findall(r"\b[A-Za-z]{4,}\b", sent["textEn"])
        best_for_sent: Optional[Tuple[float, str, Dict[str, Any]]] = None
        for tok in words_in_sent:
            low = tok.lower()
            if low in BASIC_STOPWORDS or tok.isupper():
                continue
            meta = vocab_meta.get(low)
            if not meta or not meta.get("meaningVi"):
                continue
            cefr_num = meta["cefrNum"]
            score = (10.0 + cefr_num * 2.0) if cefr_num >= 3 else (5.0 if cefr_num == 2 else 1.5)
            if meta["isToeic"]:
                score += 4.5
            if 5 <= len(low) <= 11:
                score += 1.5
            if best_for_sent is None or score > best_for_sent[0]:
                best_for_sent = (score, tok, meta)
        if best_for_sent is not None:
            candidates.append((best_for_sent[0], sent["index"], best_for_sent[1], best_for_sent[2]))

    if not candidates:
        return []

    candidates.sort(key=lambda x: (-x[0], x[1]))
    desired = min(target_max, max(target_min, min(8, len(sentences) // 5)))

    chosen: List[Tuple[int, str, Dict[str, Any]]] = []
    used_words: Set[str] = set()
    used_sent_idx: Set[int] = set()

    for _, s_idx, tok, meta in candidates:
        low = tok.lower()
        if low in used_words or s_idx in used_sent_idx:
            continue
        if any(abs(s_idx - prev_idx) < 2 for prev_idx, _, _ in chosen):
            continue
        chosen.append((s_idx, tok, meta))
        used_words.add(low)
        used_sent_idx.add(s_idx)
        if len(chosen) >= desired:
            break

    if len(chosen) < target_min:
        for _, s_idx, tok, meta in candidates:
            low = tok.lower()
            if low in used_words or s_idx in used_sent_idx:
                continue
            chosen.append((s_idx, tok, meta))
            used_words.add(low)
            used_sent_idx.add(s_idx)
            if len(chosen) >= target_min:
                break

    chosen.sort(key=lambda x: x[0])
    sent_map = {s["index"]: s for s in sentences}
    quiz_items: List[Dict[str, Any]] = []

    for q_idx, (s_idx, tok, meta) in enumerate(chosen, start=1):
        sent = sent_map[s_idx]
        prompt = re.compile(r"\b" + re.escape(tok) + r"\b").sub("____", sent["textEn"], count=1)
        if "____" not in prompt:
            continue

        pos_pool = pool_by_pos.get(meta["pos"], []) or all_pool
        ans_low = tok.lower()
        ans_len = len(ans_low)
        ans_cefr = meta["cefrNum"]

        distractor_cands = [
            m["word"].lower()
            for m in pos_pool
            if m["word"].lower() != ans_low
            and abs(len(m["word"]) - ans_len) <= 3
            and abs(m["cefrNum"] - ans_cefr) <= 1
            and m["word"].lower() not in sent["textEn"].lower()
        ]
        if len(distractor_cands) < 3:
            distractor_cands = [m["word"].lower() for m in all_pool if m["word"].lower() != ans_low]

        unique_distractors = sorted(set(distractor_cands))
        rng.shuffle(unique_distractors)
        wrong_opts = unique_distractors[:3]

        def match_case(w: str) -> str:
            return w[0].upper() + w[1:] if tok[0].isupper() else w

        options = [tok] + [match_case(w) for w in wrong_opts]
        rng.shuffle(options)

        quiz_items.append({
            "id": f"q{q_idx}",
            "sentenceIndex": s_idx,
            "start": sent["start"],
            "end": sent["end"],
            "prompt": prompt,
            "sentenceVi": sent["textVi"],
            "answer": tok,
            "options": options,
            "meaningVi": meta["meaningVi"],
            "cefr": meta["cefr"],
            "ipa": meta["ipa"],
            "pos": meta["pos"],
        })

    return quiz_items


# ---------------------------------------------------------------------------
# 5. Fast Flat-Playlist Candidate Discovery (yt-dlp --flat-playlist)
# ---------------------------------------------------------------------------

def should_skip_title(title: str) -> bool:
    t_low = title.lower()
    if re.search(
        r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\u0400-\u04ff]",
        t_low,
    ):
        return True
    for pat in SKIP_TITLE_PATTERNS:
        if re.search(pat, t_low):
            return True
    return False


def discover_candidates_for_channel(
    ch_cfg: Dict[str, Any],
    effective_target: int,
    seen_yt_ids: Set[str],
) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    local_seen: Set[str] = set()
    playlist_limit = max(60, effective_target * 2)
    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlistend": playlist_limit,
        "ignoreerrors": True,
    }

    min_sec = int(ch_cfg.get("minSec", 60))
    max_sec = int(ch_cfg.get("maxSec", 900))
    match_channels = [c.lower() for c in ch_cfg.get("matchChannels", [])]
    exact_match = bool(ch_cfg.get("exactChannelMatch", False))

    with yt_dlp.YoutubeDL(opts) as ydl:
        for url in ch_cfg["urls"]:
            try:
                info = ydl.extract_info(url, download=False)
                if not info:
                    continue
                parent_channel = (info.get("channel") or info.get("uploader") or ch_cfg["name"]).strip()
                entries = [e for e in (info.get("entries") or []) if e]
                for e in entries:
                    yt_id = (e.get("id") or "").strip()
                    if not yt_id or len(yt_id) != 11 or yt_id in seen_yt_ids or yt_id in local_seen:
                        continue
                    # Skip immediately if item file already exists on disk
                    if (ITEMS_DIR / f"yt-{yt_id}.json").exists():
                        continue
                    title = (e.get("title") or "").strip()
                    if not title or should_skip_title(title):
                        continue
                    dur = e.get("duration")
                    if not isinstance(dur, (int, float)):
                        continue
                    dur_int = int(round(dur))
                    if dur_int < min_sec or dur_int > max_sec:
                        continue
                    if e.get("live_status") in ("is_live", "is_upcoming"):
                        continue

                    ch_raw = (e.get("channel") or e.get("uploader") or parent_channel or "").strip()
                    ch_low = ch_raw.lower()
                    if ch_low and match_channels:
                        if exact_match and ch_low not in match_channels:
                            continue
                        if not exact_match and not any(mc in ch_low for mc in match_channels):
                            continue

                    local_seen.add(yt_id)
                    candidates.append({
                        "youtubeId": yt_id,
                        "titleEn": title,
                        "durationSec": dur_int,
                        "thumbnail": f"https://i.ytimg.com/vi/{yt_id}/hqdefault.jpg",
                    })
            except Exception as ex:
                print(f"    [WARN] Failed to scan {url}: {str(ex)[:90]}")

    return candidates


# ---------------------------------------------------------------------------
# 6. Catalog & Channels Builder (Incremental Checkpoint)
# ---------------------------------------------------------------------------

def load_existing_catalog() -> Dict[str, Dict[str, Any]]:
    """
    Hydrate all valid existing items from public/data/videos/items/*.json so
    partial / resumed / per-channel runs NEVER drop previously collected videos.
    """
    by_id: Dict[str, Dict[str, Any]] = {}
    if not ITEMS_DIR.exists():
        return by_id

    for fp in sorted(ITEMS_DIR.glob("*.json")):
        try:
            d = json.loads(fp.read_text(encoding="utf-8"))
            vid = d.get("id")
            yt_id = d.get("youtubeId")
            sents = d.get("sentences") or []
            quizzes = d.get("quizItems") or []
            if not vid or not yt_id or len(sents) < 12 or len(quizzes) < 4:
                continue
            by_id[vid] = {
                "id": vid,
                "youtubeId": yt_id,
                "titleEn": d["titleEn"],
                "titleVi": d["titleVi"],
                "channel": d["channel"],
                "channelSlug": d["channelSlug"],
                "durationSec": int(d["durationSec"]),
                "level": d["level"],
                "topic": d["topic"],
                "sentenceCount": len(sents),
                "wpm": int(d["wpm"]),
                "thumbnail": d["thumbnail"],
                "featured": bool(d.get("featured", False)),
                "createdAt": d.get("createdAt") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        except Exception:
            continue
    return by_id


def write_catalog_and_channels(
    catalog_by_id: Dict[str, Dict[str, Any]],
    channels_config: List[Dict[str, Any]],
    channel_thumbs: Optional[Dict[str, str]] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    catalog = sorted(
        catalog_by_id.values(),
        key=lambda r: (r.get("createdAt", ""), r.get("id", "")),
    )

    # Reset and assign balanced featured picks (up to 12: ~2-3 per CEFR level across diverse channels)
    for r in catalog:
        r["featured"] = False

    featured_ids: Set[str] = set()
    used_featured_channels: Counter = Counter()
    for lvl in CEFR_LEVELS:
        lvl_rows = [v for v in catalog if v["level"] == lvl]
        lvl_rows.sort(key=lambda r: (used_featured_channels[r["channelSlug"]], -r["sentenceCount"]))
        for row in lvl_rows[:2]:
            row["featured"] = True
            featured_ids.add(row["id"])
            used_featured_channels[row["channelSlug"]] += 1

    # Group catalog by channel slug
    by_channel: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in catalog:
        by_channel[row["channelSlug"]].append(row)

    cfg_by_slug = {c["slug"]: c for c in channels_config}
    channels_out: List[Dict[str, Any]] = []

    # Emit ALL 24 configured channels (plus any extra legacy slugs if present)
    all_slugs = [c["slug"] for c in channels_config] + [s for s in by_channel.keys() if s not in cfg_by_slug]
    for slug in all_slugs:
        cfg = cfg_by_slug.get(slug)
        rows = by_channel.get(slug, [])
        if rows:
            lvl_counter = Counter(r["level"] for r in rows)
            dominant_level = max(lvl_counter.items(), key=lambda kv: (kv[1], -CEFR_TO_NUM[kv[0]]))[0]
            avg_dur = int(round(sum(r["durationSec"] for r in rows) / len(rows)))
            avg_wpm = int(round(sum(r["wpm"] for r in rows) / len(rows)))
            levels = sorted(lvl_counter.keys(), key=lambda lv: CEFR_TO_NUM[lv])
            topics = sorted({r["topic"] for r in rows})
            sample_thumb = rows[0]["thumbnail"]
            name = cfg["name"] if cfg else rows[0]["channel"]
        else:
            dominant_level = cfg["priorLevel"] if cfg else "B1"
            avg_dur = 0
            avg_wpm = 0
            levels = [dominant_level]
            topics = [cfg["defaultTopic"]] if cfg else ["Giao tiếp hàng ngày"]
            sample_thumb = (channel_thumbs or {}).get(slug, "")
            name = cfg["name"] if cfg else slug

        channels_out.append({
            "slug": slug,
            "name": name,
            "tier": cfg.get("tier", "standard") if cfg else "standard",
            "accent": cfg.get("accent", "Mỹ (US)") if cfg else "Mỹ (US)",
            "accentCode": cfg.get("accentCode", "US") if cfg else "US",
            "levelRange": cfg.get("levelRange", dominant_level) if cfg else dominant_level,
            "targetCount": int(cfg.get("targetCount", 30)) if cfg else 30,
            "videoCount": len(rows),
            "avgDurationSec": avg_dur,
            "avgWpm": avg_wpm,
            "dominantLevel": dominant_level,
            "levels": levels,
            "topics": topics,
            "sampleThumbnail": sample_thumb,
        })

    channels_out.sort(key=lambda c: (-c["videoCount"], 0 if c["tier"] == "famous" else 1, c["name"]))

    save_json_atomic(OUTPUT_DIR / "catalog.json", catalog)
    save_json_atomic(OUTPUT_DIR / "channels.json", channels_out)
    return catalog, channels_out


# ---------------------------------------------------------------------------
# 7. Main Pipeline
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Resumable 24-channel YouTube English learning video collector.")
    parser.add_argument("--config", type=str, default=str(CONFIG_PATH), help="Path to video_channels_config.json")
    parser.add_argument("--channel", type=str, default="", help="Only collect specific channel slug(s), comma-separated")
    parser.add_argument("--tier", choices=["famous", "standard", "all"], default="all", help="Channel tier filter")
    parser.add_argument("--max-per-channel", type=int, default=0, help="Override per-channel target count (0 = config default)")
    parser.add_argument("--max-videos", type=int, default=0, help="Optional cap on NEW videos added in this run (0 = unlimited)")
    parser.add_argument("--cache-only", action="store_true", help="Rebuild catalog/channels without remote YouTube fetches")
    parser.add_argument("--verify-channels", action="store_true", help="Verify all selected channel URLs & refresh preview thumbnails without fetching transcripts")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    channels_config: List[Dict[str, Any]] = json.loads(Path(args.config).read_text(encoding="utf-8"))
    print(f"[1/4] Loaded {len(channels_config)} channels from {Path(args.config).name} "
          f"(famous={sum(1 for c in channels_config if c['tier']=='famous')}, "
          f"standard={sum(1 for c in channels_config if c['tier']!='famous')}, "
          f"full target={sum(c['targetCount'] for c in channels_config)} videos).")

    word_cefr, vocab_meta = load_oxford_and_toeic_vocab()
    print(f"      Loaded {len(word_cefr)} Oxford CEFR words and {len(vocab_meta)} TOEIC/Oxford quiz entries.")

    translator = ViTranslator(VI_CACHE_PATH)
    transcript_cache = load_json_cache(TRANSCRIPT_CACHE_PATH)
    channel_thumbs: Dict[str, str] = load_json_cache(CHANNEL_THUMBS_CACHE_PATH)

    proxy_url = os.environ.get("YT_PROXY_URL", "").strip()
    if proxy_url:
        print("      Using YT_PROXY_URL for YouTubeTranscriptApi.")
        yt_api = YouTubeTranscriptApi(proxy_config=GenericProxyConfig(http_url=proxy_url, https_url=proxy_url))
    else:
        yt_api = YouTubeTranscriptApi()

    catalog_by_id = load_existing_catalog()
    seen_yt_ids: Set[str] = {r["youtubeId"] for r in catalog_by_id.values()}
    print(f"      Resuming with {len(catalog_by_id)} existing videos already saved in {ITEMS_DIR.relative_to(ROOT)}.")

    # Filter selected channels
    selected_channels = list(channels_config)
    if args.tier != "all":
        selected_channels = [c for c in selected_channels if c.get("tier") == args.tier]
    if args.channel.strip():
        wanted = {s.strip().lower() for s in args.channel.split(",") if s.strip()}
        selected_channels = [c for c in selected_channels if c["slug"].lower() in wanted]
        if not selected_channels:
            print(f"[ERR] No channel matched --channel={args.channel}. Available slugs: {[c['slug'] for c in channels_config]}")
            sys.exit(1)

    rate_limit_state: Dict[str, Any] = {"global_blocked": args.cache_only or args.verify_channels, "consecutive_blocks": 0}
    new_added_total = 0
    since_checkpoint = 0
    channel_verify_stats: List[Tuple[str, int, int, str]] = []

    def do_checkpoint(reason: str):
        nonlocal since_checkpoint
        translator.flush()
        save_json_atomic(TRANSCRIPT_CACHE_PATH, transcript_cache)
        save_json_atomic(CHANNEL_THUMBS_CACHE_PATH, channel_thumbs)
        write_catalog_and_channels(catalog_by_id, channels_config, channel_thumbs)
        since_checkpoint = 0
        print(f"      [CHECKPOINT] Saved {len(catalog_by_id)} total videos + vi_cache ({len(translator.cache)}) [{reason}]")

    def process_and_save_video(
        yt_id: str,
        title_en: str,
        duration_sec: int,
        ch_cfg: Dict[str, Any],
        thumbnail: str,
        raw_snippets: List[Dict[str, Any]],
        is_manual: bool,
    ) -> Optional[Dict[str, Any]]:
        sentences = normalize_sentences(raw_snippets)
        total_words = sum(s["wordCount"] for s in sentences)
        if len(sentences) < 12 or total_words < 90:
            return None

        level, wpm, cefr_dbg = classify_cefr(title_en, sentences, duration_sec, word_cefr, float(ch_cfg["priorScore"]))
        topic = classify_topic(title_en, sentences, ch_cfg["defaultTopic"])

        to_translate = [title_en] + [s["textEn"] for s in sentences]
        translated = translator.translate_many(to_translate)
        title_vi = translated[0]
        for s, vi in zip(sentences, translated[1:]):
            s["textVi"] = vi

        quiz_items = generate_quiz_items(yt_id, sentences, vocab_meta, target_min=6, target_max=10)
        if len(quiz_items) < 4:
            return None

        video_id = f"yt-{yt_id}"
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        meta_row = {
            "id": video_id,
            "youtubeId": yt_id,
            "titleEn": title_en,
            "titleVi": title_vi,
            "channel": ch_cfg["name"],
            "channelSlug": ch_cfg["slug"],
            "durationSec": duration_sec,
            "level": level,
            "topic": topic,
            "sentenceCount": len(sentences),
            "wpm": wpm,
            "thumbnail": thumbnail,
            "featured": False,
            "createdAt": now_iso,
        }
        detail_payload = {
            **meta_row,
            "isManualCaption": is_manual,
            "cefrMetrics": cefr_dbg,
            "sentences": sentences,
            "quizItems": quiz_items,
        }
        save_json_atomic(ITEMS_DIR / f"{video_id}.json", detail_payload)
        return meta_row

    if not args.cache_only:
        print(f"\n[2/4] Scanning & collecting across {len(selected_channels)} channel(s)...")
        try:
            for c_idx, ch_cfg in enumerate(selected_channels, start=1):
                if args.max_videos > 0 and new_added_total >= args.max_videos:
                    print(f"\n      Reached --max-videos={args.max_videos} cap for this run.")
                    break

                slug = ch_cfg["slug"]
                existing_in_ch = sum(1 for r in catalog_by_id.values() if r["channelSlug"] == slug)
                target = args.max_per_channel if args.max_per_channel > 0 else int(ch_cfg["targetCount"])

                if existing_in_ch >= target:
                    print(f"  [{c_idx:02d}/{len(selected_channels):02d}] {ch_cfg['name']:<28} — already has {existing_in_ch}/{target}, skipping.")
                    channel_verify_stats.append((ch_cfg["name"], existing_in_ch, target, "ALREADY_DONE"))
                    continue

                needed = target - existing_in_ch
                print(
                    f"\n  [{c_idx:02d}/{len(selected_channels):02d}] {ch_cfg['name']} "
                    f"({ch_cfg['tier']} | {ch_cfg['accent']} | {ch_cfg['levelRange']}) — have {existing_in_ch}/{target}, need +{needed}"
                )

                candidates = discover_candidates_for_channel(ch_cfg, target, seen_yt_ids)
                print(f"    -> Discovered {len(candidates)} fresh candidate(s) in {ch_cfg['minSec']}-{ch_cfg['maxSec']}s range")
                if candidates and not channel_thumbs.get(slug):
                    channel_thumbs[slug] = candidates[0]["thumbnail"]
                if not candidates:
                    channel_verify_stats.append((ch_cfg["name"], existing_in_ch, target, "NO_CANDIDATES"))
                    continue

                if rate_limit_state.get("global_blocked"):
                    st_lbl = "VERIFIED" if args.verify_channels else "RATE_LIMITED"
                    channel_verify_stats.append((ch_cfg["name"], existing_in_ch, target, f"URL_OK({len(candidates)})/{st_lbl}"))
                    continue

                added_in_ch = 0
                ch_rate_limit_hits = 0

                for cand in candidates:
                    if added_in_ch >= needed:
                        break
                    if args.max_videos > 0 and new_added_total >= args.max_videos:
                        break

                    yt_id = cand["youtubeId"]
                    raw_snippets, is_manual, status = fetch_english_transcript(
                        yt_api, yt_id, transcript_cache, rate_limit_state
                    )
                    if status == "rate_limited":
                        ch_rate_limit_hits += 1
                        if ch_rate_limit_hits >= 2:
                            print(f"    -> [SKIP CHANNEL] Consecutive 429 on {ch_cfg['name']} — moving to next channel cleanly.")
                            if rate_limit_state.get("consecutive_blocks", 0) >= 6:
                                rate_limit_state["global_blocked"] = True
                                print("    -> [COOLDOWN] YouTube IP rate-limit persistent; remaining channels will verify URLs only and preserve checkpoint.")
                            break
                        continue
                    if not raw_snippets:
                        continue

                    meta_row = process_and_save_video(
                        yt_id=yt_id,
                        title_en=cand["titleEn"],
                        duration_sec=cand["durationSec"],
                        ch_cfg=ch_cfg,
                        thumbnail=cand["thumbnail"],
                        raw_snippets=raw_snippets,
                        is_manual=is_manual,
                    )
                    if not meta_row:
                        continue

                    catalog_by_id[meta_row["id"]] = meta_row
                    seen_yt_ids.add(yt_id)
                    added_in_ch += 1
                    new_added_total += 1
                    since_checkpoint += 1
                    cap_tag = "MANUAL" if is_manual else "AUTO"
                    print(
                        f"    + [{len(catalog_by_id):03d}] {meta_row['id']} | {meta_row['level']} | "
                        f"{meta_row['wpm']:3d} WPM | {meta_row['sentenceCount']:3d} sents | {cap_tag} | {cand['titleEn'][:48]}"
                    )

                    if since_checkpoint >= CHECKPOINT_EVERY:
                        do_checkpoint(f"every {CHECKPOINT_EVERY} videos")

                if since_checkpoint > 0:
                    do_checkpoint(f"end of {slug}")

                status_lbl = "OK" if added_in_ch > 0 else ("RATE_LIMITED" if ch_rate_limit_hits > 0 else "NO_CAPTIONS")
                channel_verify_stats.append((ch_cfg["name"], existing_in_ch + added_in_ch, target, f"URL_OK({len(candidates)})/{status_lbl}"))
        except KeyboardInterrupt:
            print("\n[INTERRUPTED] Saving incremental checkpoint before exit...")
            do_checkpoint("interrupt")

    print("\n[3/4] Writing final catalog.json, channels.json & caches...")
    translator.flush()
    save_json_atomic(TRANSCRIPT_CACHE_PATH, transcript_cache)
    save_json_atomic(CHANNEL_THUMBS_CACHE_PATH, channel_thumbs)
    catalog, channels_out = write_catalog_and_channels(catalog_by_id, channels_config, channel_thumbs)

    print("\n[4/4] COLLECTION SUMMARY")
    print("=" * 84)
    print(f"Total videos in catalog : {len(catalog)} (new this run: +{new_added_total})")
    print(f"Configured channels     : {len(channels_out)} (active with videos: {sum(1 for c in channels_out if c['videoCount'] > 0)})")
    print(f"Total bilingual sents   : {sum(r['sentenceCount'] for r in catalog)}")

    print("\n--- Breakdown by CEFR Level ---")
    print(f"{'Level':<8} | {'Count':>5} | {'Avg WPM':>7} | {'Avg Dur':>8}")
    print("-" * 40)
    for lvl in CEFR_LEVELS:
        rows = [r for r in catalog if r["level"] == lvl]
        cnt = len(rows)
        avg_w = int(round(sum(r["wpm"] for r in rows) / cnt)) if cnt else 0
        avg_d = int(round(sum(r["durationSec"] for r in rows) / cnt)) if cnt else 0
        print(f"{lvl:<8} | {cnt:>5} | {avg_w:>7} | {avg_d:>6}s")

    print("\n--- Breakdown by Channel (24 Curated Channels) ---")
    print(f"{'Channel':<30} | {'Tier':<8} | {'Accent':<15} | {'Have/Target':>11} | {'Dominant':>8}")
    print("-" * 84)
    for ch in channels_out:
        have_t = f"{ch['videoCount']}/{ch['targetCount']}"
        print(
            f"{ch['name']:<30} | {ch['tier']:<8} | {ch['accent']:<15} | {have_t:>11} | {ch['dominantLevel']:>8}"
        )

    if channel_verify_stats:
        print("\n--- Run Verification Status ---")
        for name, have, tgt, st in channel_verify_stats:
            print(f"  {name:<30} | {have:3d}/{tgt:<3d} | {st}")
    print("=" * 84)


if __name__ == "__main__":
    main()
