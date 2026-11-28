#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/collect_youtube_videos.py
=================================
Automated pipeline to collect English-learning YouTube videos via yt-dlp +
youtube-transcript-api, normalize fragmented captions into dictation-ready
complete sentences, translate titles & sentences into Vietnamese with a
persistent cache (deep-translator), auto-classify CEFR levels (A1-C1) using
WPM + local Oxford A1-C1 vocab decks + channel/title priors, generate
listening fill-in-the-blank quiz items, and emit lazy-load JSON datasets
under public/data/videos/.
"""

import argparse
import hashlib
import html
import json
import math
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
PUBLIC_VOCAB_DIR = ROOT / "public" / "data" / "vocab"
OUTPUT_DIR = ROOT / "public" / "data" / "videos"
ITEMS_DIR = OUTPUT_DIR / "items"
CACHE_DIR = ROOT / "scripts" / "cache"
VI_CACHE_PATH = CACHE_DIR / "yt_vi_cache.json"
TRANSCRIPT_CACHE_PATH = CACHE_DIR / "yt_transcripts_cache.json"

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

# Promotional / non-lesson titles to filter out
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

# Curated multi-level YouTube learning sources (10 buckets across 9 distinct channels)
SOURCE_BUCKETS: List[Dict[str, Any]] = [
    # ---- A1 - A2 (Beginner / Slow / Daily Conversation) ----
    {
        "name": "BBC Real Easy English (A1-A2)",
        "channel_display": "BBC Learning English",
        "channel_slug": "bbc-learning-english",
        "match_channels": ["bbc learning english"],
        "allow_empty_channel_if_title_matches": True,
        "prior_level": "A1",
        "prior_score": 1.35,
        "default_topic": "Giao tiếp hàng ngày",
        "min_sec": 120,
        "max_sec": 540,
        "target_count": 5,
        "urls": [
            "ytsearch20:BBC Learning English Real Easy English",
        ],
        "require_title_any": ["real easy english"],
    },
    {
        "name": "English Speaking Course / A1 Slow Listening (A1)",
        "channel_display": "English Speaking Course",
        "channel_slug": "english-speaking-course",
        "match_channels": ["english speaking course", "english easy practice", "english listening", "listen in english", "daily english"],
        "allow_empty_channel_if_title_matches": True,
        "prior_level": "A1",
        "prior_score": 1.30,
        "default_topic": "Giao tiếp hàng ngày",
        "min_sec": 120,
        "max_sec": 660,
        "target_count": 5,
        "urls": [
            "ytsearch20:A1 English Listening Practice slow conversation",
            "ytsearch20:English Easy Practice A1 English Podcast beginner",
        ],
        "require_title_any": ["a1", "beginner", "slow english", "daily"],
    },
    {
        "name": "Speak English With Vanessa (A2)",
        "channel_display": "Speak English With Vanessa",
        "channel_slug": "speak-english-with-vanessa",
        "match_channels": ["speak english with vanessa"],
        "prior_level": "A2",
        "prior_score": 2.10,
        "default_topic": "Giao tiếp hàng ngày",
        "min_sec": 120,
        "max_sec": 720,
        "target_count": 4,
        "urls": [
            "ytsearch25:Speak English With Vanessa daily English conversation",
            "https://www.youtube.com/@SpeakEnglishWithVanessa/videos",
        ],
    },
    {
        "name": "English with Lucy (A2-B1)",
        "channel_display": "English with Lucy",
        "channel_slug": "english-with-lucy",
        "match_channels": ["english with lucy"],
        "prior_level": "B1",
        "prior_score": 2.85,
        "default_topic": "Kỹ năng & Phát triển",
        "min_sec": 150,
        "max_sec": 720,
        "target_count": 5,
        "urls": [
            "ytsearch25:English with Lucy vocabulary pronunciation intermediate",
            "https://www.youtube.com/@EnglishwithLucy/videos",
        ],
    },
    # ---- B1 (Intermediate / TOEIC 600-750 Core) ----
    {
        "name": "BBC 6 Minute English (B1)",
        "channel_display": "BBC Learning English",
        "channel_slug": "bbc-learning-english",
        "match_channels": ["bbc learning english"],
        "allow_empty_channel_if_title_matches": True,
        "prior_level": "B1",
        "prior_score": 3.00,
        "default_topic": "Tin tức & Văn hóa",
        "min_sec": 240,
        "max_sec": 540,
        "target_count": 6,
        "urls": [
            "ytsearch25:BBC Learning English 6 Minute English",
        ],
        "require_title_any": ["6 minute english"],
    },
    # ---- B2 - C1 (Upper-Intermediate / Business / Academic / Native Speed) ----
    {
        "name": "TED-Ed (B2)",
        "channel_display": "TED-Ed",
        "channel_slug": "ted-ed",
        "match_channels": ["ted-ed"],
        "prior_level": "B2",
        "prior_score": 3.85,
        "default_topic": "Khoa học & Công nghệ",
        "min_sec": 180,
        "max_sec": 540,
        "target_count": 6,
        "urls": [
            "https://www.youtube.com/@TEDEd/videos",
        ],
    },
    {
        "name": "Kurzgesagt – In a Nutshell (B2-C1)",
        "channel_display": "Kurzgesagt – In a Nutshell",
        "channel_slug": "kurzgesagt",
        "match_channels": ["kurzgesagt"],
        "prior_level": "B2",
        "prior_score": 4.00,
        "default_topic": "Khoa học & Công nghệ",
        "min_sec": 240,
        "max_sec": 720,
        "target_count": 4,
        "urls": [
            "https://www.youtube.com/@kurzgesagt/videos",
        ],
    },
    {
        "name": "Business Insider (B2 Business)",
        "channel_display": "Business Insider",
        "channel_slug": "business-insider",
        "match_channels": ["business insider"],
        "prior_level": "B2",
        "prior_score": 3.75,
        "default_topic": "Công sở & Kinh doanh",
        "min_sec": 180,
        "max_sec": 720,
        "target_count": 4,
        "urls": [
            "https://www.youtube.com/@BusinessInsider/videos",
        ],
    },
    {
        "name": "Harvard Business Review (B2-C1 Business)",
        "channel_display": "Harvard Business Review",
        "channel_slug": "harvard-business-review",
        "match_channels": ["harvard business review"],
        "allow_empty_channel_if_title_matches": True,
        "prior_level": "C1",
        "prior_score": 4.45,
        "default_topic": "Công sở & Kinh doanh",
        "min_sec": 120,
        "max_sec": 720,
        "target_count": 5,
        "urls": [
            "ytsearch20:Harvard Business Review explainer leadership management",
            "https://www.youtube.com/@HarvardBusinessReview/videos",
        ],
    },
    {
        "name": "TED Short Talks (C1)",
        "channel_display": "TED",
        "channel_slug": "ted",
        "match_channels": ["ted"],
        "exact_channel_match": True,
        "prior_level": "C1",
        "prior_score": 4.55,
        "default_topic": "Kỹ năng & Phát triển",
        "min_sec": 240,
        "max_sec": 720,
        "target_count": 5,
        "urls": [
            "https://www.youtube.com/@TED/videos",
        ],
    },
]

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
    """Generate simple base-form candidates for inflectional lookup."""
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
    """
    Load Oxford A1-C1 CEFR ranks and rich metadata from public/data/vocab/.
    Returns:
      - word_cefr: lowercase word -> lowest CEFR numeric rank (1=A1 .. 5=C1)
      - vocab_meta: lowercase word -> {word, pos, ipa, meaningVi, cefr, cefrNum, isToeic}
    """
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
                inferred_level = word_cefr.get(key, 3)  # default B1 for TOEIC core
                register_word(w.get("word", ""), inferred_level, meta=w, is_toeic=True)

    return word_cefr, vocab_meta


# ---------------------------------------------------------------------------
# 2. Persistent Caches & Batched Vietnamese Translation
# ---------------------------------------------------------------------------

def load_json_cache(path: Path) -> Dict[str, Any]:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_json_cache(path: Path, data: Dict[str, Any]):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


class ViTranslator:
    """
    Cached, batched EN -> VI translator with resilient provider cascade:
      1) deep_translator.GoogleTranslator (auto-disabled if HTTP 429)
      2) Mozhi Neural Translator (duckduckgo / Azure Neural) with ` ||| ` batching
      3) deep_translator.MyMemoryTranslator single-item fallback
    """

    def __init__(self, cache_path: Path):
        self.cache_path = cache_path
        self.cache: Dict[str, str] = load_json_cache(cache_path)
        self.lock = threading.Lock()
        self.dirty = False
        self.google_available = self._probe_google()
        print(f"      Translator ready (Google={'ON' if self.google_available else '429-bypass -> Mozhi Neural'}).")

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
        clean_src = text.strip().replace("|||", "-")
        if not clean_src:
            return ""
        with self.lock:
            cached = self.cache.get(text.strip())
            if cached and cached.strip():
                return cached.strip()

        # 1) GoogleTranslator if unthrottled
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

        # 2) Mozhi Neural
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

        # 3) MyMemory fallback
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

        cleaned = [t.strip().replace("|||", "-") for t in texts]

        # 1) GoogleTranslator newline batch if available
        if self.google_available:
            try:
                blob = GoogleTranslator(source="en", target="vi").translate("\n".join(cleaned))
                if blob:
                    lines = [ln.strip() for ln in blob.split("\n")]
                    if len(lines) == len(texts) and all(lines):
                        out = {orig: self._postprocess(tr, orig) for orig, tr in zip(texts, lines)}
                        with self.lock:
                            self.cache.update(out)
                            self.dirty = True
                        return out
            except Exception as e:
                if "TooManyRequests" in type(e).__name__ or "429" in str(e):
                    self.google_available = False

        # 2) Mozhi Neural ` ||| ` batch
        payload = " ||| ".join(cleaned)
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
            # Build ~850-char chunks (safe for Mozhi GET URL length)
            chunks: List[List[str]] = []
            cur_chunk: List[str] = []
            cur_len = 0
            for item in unique_missing:
                if cur_chunk and (cur_len + len(item) + 5 > 850 or len(cur_chunk) >= 10):
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
                save_json_cache(self.cache_path, self.cache)
                self.dirty = False


# ---------------------------------------------------------------------------
# 3. Transcript Fetching & Sentence Normalization
# ---------------------------------------------------------------------------

def clean_caption_text(raw: str) -> str:
    txt = html.unescape(raw or "")
    txt = txt.replace("\n", " ").replace("\r", " ")
    # Remove music notes & stage directions like [Music], (Applause), [Laughter]
    txt = re.sub(r"♪[^♪]*♪", " ", txt)
    txt = txt.replace("♪", " ")
    txt = re.sub(r"\[[^\]]{1,40}\]", " ", txt)
    txt = re.sub(r"\((?:music|applause|laughter|cheering|sighs|clears throat|inaudible|bell|chime|ding|intro)[^)]*\)", " ", txt, flags=re.I)
    # Remove leading speaker markers like ">> " or "- " or "NARRATOR: "
    txt = re.sub(r"^\s*>>+\s*", "", txt)
    txt = re.sub(r"^\s*[A-Z][A-Z0-9\s]{1,18}:\s+", "", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def is_valid_english_text(text: str) -> bool:
    if not text:
        return False
    letters = re.findall(r"[A-Za-z]", text)
    if len(letters) < 2:
        return False
    return True


def _split_at_sentence_boundaries(text: str, start: float, end: float) -> List[Tuple[str, float, float]]:
    """Split a snippet containing multiple internal sentences with proportional timestamps."""
    # Find candidate sentence ends (. ? !) followed by whitespace and uppercase/quote
    spans: List[str] = []
    cur = []
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
    """Split unpunctuated or overly long clauses into dictation-friendly chunks (<= ~18-20 words)."""
    words = text.split()
    if len(words) <= max_words:
        return [(text, start, end)]

    # Try splitting near midpoint at natural clause boundaries
    chunks: List[str] = []
    remaining = words[:]
    while len(remaining) > max_words:
        target = min(16, len(remaining) // 2 + 2)
        best_idx = None
        # Search for comma/semicolon or conjunction in [8..max_words]
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
        # Avoid tiny 1-3 word trailing fragment
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
    """
    Merge fragmented YouTube captions into clean complete sentences ending in .?!
    (or max ~18 words / ~8s per sentence for comfortable dictation), with accurate
    non-overlapping start/end timestamps.
    """
    # Step 1: Clean and split multi-sentence raw snippets
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

    # Step 2: Merge atoms into complete sentences
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
            # Flush before adding if long pause or exceeding dictation threshold
            if (gap >= 1.6 and buf_words >= 4) or (
                buf_words >= 6 and (projected_words > 18 or projected_dur > 8.5)
            ):
                flush()

        if buf_start is None:
            buf_start = st
        buf_texts.append(txt)
        buf_end = max(buf_end, en)
        buf_words += wcnt

        # Check if current atom ends a complete sentence
        last_tok = txt.split()[-1]
        clean_last = last_tok.strip("\"'”’)")
        is_end_punct = bool(re.search(r"[.!?][\"'”’)\]]*$", last_tok))
        is_abbrev = clean_last.lower() in ABBREVIATIONS or bool(re.fullmatch(r"[A-Za-z]\.", clean_last))
        is_decimal = bool(re.search(r"\d\.$", clean_last))
        if (is_end_punct and not is_abbrev and not is_decimal and buf_words >= 3) or buf_words >= 18 or (buf_end - buf_start) >= 8.2:
            flush()

    flush()

    # Step 3: Post-process formatting, capitalization, and monotonic timestamps
    sentences: List[Dict[str, Any]] = []
    for i, (txt, st, en) in enumerate(merged):
        txt = re.sub(r"\s+", " ", txt).strip()
        # Capitalize first letter if lowercase
        if txt and txt[0].islower():
            txt = txt[0].upper() + txt[1:]
        # Only add terminal period if sentence ends with a word/digit (never after , : ; -)
        if txt and txt[-1].isalnum():
            txt = txt + "."
        # Clamp end cleanly against next sentence's start if strongly overlapping
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
    rate_limit_state: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[List[Dict[str, Any]]], bool]:
    """
    Fetch English transcript (preferring human-created captions over auto-generated).
    Returns (raw_snippets, is_manual).
    """
    if youtube_id in transcript_cache:
        entry = transcript_cache[youtube_id]
        if entry is None:
            return None, False
        return entry.get("snippets"), bool(entry.get("isManual", False))

    if rate_limit_state and rate_limit_state.get("blocked"):
        return None, False

    for attempt in range(2):
        time.sleep(2.2 if attempt == 0 else 8.0)
        try:
            tlist = api.list(youtube_id)
            chosen = None
            is_manual = False

            # Prefer manual English transcripts
            for t in tlist:
                code = (t.language_code or "").lower()
                if (code == "en" or code.startswith("en-")) and not t.is_generated:
                    chosen = t
                    is_manual = True
                    break

            # Fallback to auto-generated English transcript
            if chosen is None:
                for t in tlist:
                    code = (t.language_code or "").lower()
                    if (code == "en" or code.startswith("en-")) and t.is_generated:
                        chosen = t
                        is_manual = False
                        break

            if chosen is None:
                transcript_cache[youtube_id] = None
                return None, False

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
            if rate_limit_state is not None:
                rate_limit_state["consecutive_blocks"] = 0
            return snippets, is_manual
        except Exception as ex:
            ename = type(ex).__name__
            if ename in ("TranscriptsDisabled", "NoTranscriptFound", "VideoUnavailable"):
                transcript_cache[youtube_id] = None
                return None, False
            if ename in ("RequestBlocked", "IpBlocked", "TooManyRequests"):
                print(f"      [RATE-LIMIT] {ename} on {youtube_id} (attempt {attempt + 1}/2)...")
                if rate_limit_state is not None:
                    rate_limit_state["consecutive_blocks"] = rate_limit_state.get("consecutive_blocks", 0) + 1
                    if rate_limit_state["consecutive_blocks"] >= 3:
                        rate_limit_state["blocked"] = True
                        print("      [RATE-LIMIT] YouTube timedtext IP cooldown active — pausing new remote fetches and preserving cached videos.")
                        return None, False
                continue
            return None, False
    return None, False


# ---------------------------------------------------------------------------
# 4. CEFR Auto-Classifier, Topic Tagger & Quiz Extractor
# ---------------------------------------------------------------------------

def classify_cefr(
    title_en: str,
    sentences: List[Dict[str, Any]],
    duration_sec: int,
    word_cefr: Dict[str, int],
    prior_score: float,
) -> Tuple[str, int, Dict[str, float]]:
    """
    Combine 3 signals:
      1) Speaking speed (WPM)
      2) Hard vocabulary ratio against local Oxford A1-C1 decks
      3) Channel & title keyword prior
    Returns (cefr_label, wpm, debug_metrics).
    """
    all_text = " ".join(s["textEn"] for s in sentences)
    tokens = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", all_text)
    total_words = len(tokens)

    # Effective speaking span to compute realistic WPM (excluding long intro/outro silence)
    span_sec = sentences[-1]["end"] - sentences[0]["start"] + 4.0 if sentences else float(duration_sec)
    effective_sec = max(30.0, min(float(duration_sec), span_sec))
    wpm = int(round(total_words / (effective_sec / 60.0)))
    wpm = max(60, min(250, wpm))

    # Signal 1: WPM score (1.0 .. 5.0)
    if wpm < 100:
        wpm_score = 1.2
    elif wpm < 120:
        wpm_score = 1.2 + (wpm - 100) / 20.0 * 0.9  # 1.2 -> 2.1
    elif wpm < 145:
        wpm_score = 2.1 + (wpm - 120) / 25.0 * 1.0  # 2.1 -> 3.1
    elif wpm < 170:
        wpm_score = 3.1 + (wpm - 145) / 25.0 * 1.0  # 3.1 -> 4.1
    else:
        wpm_score = min(5.0, 4.1 + (wpm - 170) / 30.0 * 0.9)

    # Signal 2: Oxford A1-C1 lexical difficulty score (1.0 .. 5.0)
    level_counts = Counter()
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

    # Calibrated against typical English video transcripts:
    # A1: hard_ratio ~0.02-0.06, mid_plus ~0.08-0.18
    # A2: hard_ratio ~0.06-0.11, mid_plus ~0.18-0.28
    # B1: hard_ratio ~0.11-0.18, mid_plus ~0.28-0.38
    # B2: hard_ratio ~0.18-0.27, mid_plus ~0.38-0.50
    # C1: hard_ratio ~0.27+,     mid_plus ~0.50+
    vocab_score = 1.0 + min(4.0, (hard_ratio * 10.5) + (mid_plus_ratio * 2.4))
    vocab_score = max(1.0, min(5.0, vocab_score))

    # Signal 3: Channel & Title prior (1.0 .. 5.0)
    t_low = title_en.lower()
    title_adj = 0.0
    if any(k in t_low for k in ["a1", "beginner", "starter", "basic english", "let's learn english", "slow english"]):
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

    # Weighted blend
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
    scores[default_topic] += 2.5  # gentle channel prior

    for topic, kws in TOPIC_KEYWORDS.items():
        for kw in kws:
            pat = r"(?<!\w)" + re.escape(kw) + r"(?!\w)"
            if re.search(pat, t_low):
                scores[topic] += 3.0
            hits = len(re.findall(pat, sample_text))
            if hits:
                scores[topic] += min(4.0, hits * 0.7)

    best_topic = max(TOPICS, key=lambda t: scores[t])
    return best_topic


def generate_quiz_items(
    youtube_id: str,
    sentences: List[Dict[str, Any]],
    vocab_meta: Dict[str, Dict[str, Any]],
    target_min: int = 6,
    target_max: int = 10,
) -> List[Dict[str, Any]]:
    """
    Extract 6-10 listening fill-in-the-blank multiple-choice quiz items from the
    video's own sentences, prioritizing Oxford B1-C1 and TOEIC keywords.
    """
    rng = random.Random(int(hashlib.md5(youtube_id.encode("utf-8")).hexdigest()[:8], 16))

    # Pre-index distractor pool by POS
    pool_by_pos: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    all_pool: List[Dict[str, Any]] = []
    for meta in vocab_meta.values():
        w = meta["word"].lower()
        if len(w) >= 4 and w.isalpha() and meta.get("meaningVi"):
            pool_by_pos[meta["pos"]].append(meta)
            all_pool.append(meta)

    # Score candidate (sentence, token, meta) pairs
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
            # Prefer exact dictionary form so distractors match inflection naturally
            meta = vocab_meta.get(low)
            if not meta:
                continue
            if not meta.get("meaningVi"):
                continue
            # Rank: B1-C1 and TOEIC get highest priority
            cefr_num = meta["cefrNum"]
            score = 0.0
            if cefr_num >= 3:
                score += 10.0 + cefr_num * 2.0
            elif cefr_num == 2:
                score += 5.0
            else:
                score += 1.5
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

    # Sort by score desc, pick unique target words distributed across timeline
    candidates.sort(key=lambda x: (-x[0], x[1]))
    desired = min(target_max, max(target_min, min(8, len(sentences) // 5)))

    chosen: List[Tuple[int, str, Dict[str, Any]]] = []
    used_words: Set[str] = set()
    used_sent_idx: Set[int] = set()

    # First pass: encourage spacing >= 2 sentences apart
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

    # Second pass if still under target_min
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

    # Sort selected quiz items chronologically
    chosen.sort(key=lambda x: x[0])

    sent_map = {s["index"]: s for s in sentences}
    quiz_items: List[Dict[str, Any]] = []

    for q_idx, (s_idx, tok, meta) in enumerate(chosen, start=1):
        sent = sent_map[s_idx]
        # Replace exact word occurrence with ____
        pat = re.compile(r"\b" + re.escape(tok) + r"\b")
        prompt = pat.sub("____", sent["textEn"], count=1)
        if "____" not in prompt:
            continue

        # Build 3 plausible distractors (same POS, similar length & CEFR level)
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
            distractor_cands = [
                m["word"].lower()
                for m in all_pool
                if m["word"].lower() != ans_low
            ]
        # Deduplicate while preserving deterministic sample
        unique_distractors = sorted(set(distractor_cands))
        rng.shuffle(unique_distractors)
        wrong_opts = unique_distractors[:3]

        # Match capitalization if answer was capitalized at sentence start
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
# 5. Candidate Video Discovery via yt-dlp
# ---------------------------------------------------------------------------

def should_skip_title(title: str) -> bool:
    t_low = title.lower()
    # Skip non-English titles (Vietnamese diacritics, CJK, Cyrillic, Arabic, Korean)
    if re.search(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\u0400-\u04ff]", t_low):
        return True
    for pat in SKIP_TITLE_PATTERNS:
        if re.search(pat, t_low):
            return True
    return False


def discover_candidates_for_bucket(bucket: Dict[str, Any], seen_yt_ids: Set[str]) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    local_seen: Set[str] = set()
    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlistend": 60,
        "ignoreerrors": True,
    }

    match_channels = [c.lower() for c in bucket["match_channels"]]
    exact_match = bool(bucket.get("exact_channel_match", False))
    allow_empty_ch = bool(bucket.get("allow_empty_channel_if_title_matches", False))
    req_title = [k.lower() for k in bucket.get("require_title_any", [])]
    exc_title = [k.lower() for k in bucket.get("exclude_title_any", [])]
    min_sec = int(bucket.get("min_sec", 60))
    max_sec = int(bucket.get("max_sec", 720))

    with yt_dlp.YoutubeDL(opts) as ydl:
        for url in bucket["urls"]:
            try:
                info = ydl.extract_info(url, download=False)
                if not info:
                    continue
                parent_channel = (info.get("channel") or info.get("uploader") or "").strip()
                entries = [e for e in (info.get("entries") or []) if e]
                for e in entries:
                    yt_id = (e.get("id") or "").strip()
                    if not yt_id or len(yt_id) != 11 or yt_id in seen_yt_ids or yt_id in local_seen:
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

                    t_low = title.lower()
                    if req_title and not any(k in t_low for k in req_title):
                        continue
                    if exc_title and any(k in t_low for k in exc_title):
                        continue

                    ch_raw = (e.get("channel") or e.get("uploader") or parent_channel or "").strip()
                    ch_low = ch_raw.lower()
                    if not ch_low:
                        if not allow_empty_ch:
                            continue
                    elif exact_match:
                        if ch_low not in match_channels:
                            continue
                    else:
                        if not any(mc in ch_low for mc in match_channels):
                            continue

                    local_seen.add(yt_id)
                    candidates.append({
                        "youtubeId": yt_id,
                        "titleEn": title,
                        "durationSec": dur_int,
                        "channelRaw": ch_raw or bucket["channel_display"],
                        "thumbnail": f"https://i.ytimg.com/vi/{yt_id}/hqdefault.jpg",
                    })
            except Exception as ex:
                print(f"  [WARN] Failed to scan {url}: {str(ex)[:90]}")

    return candidates


# ---------------------------------------------------------------------------
# 6. Main Pipeline
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Collect and process YouTube English learning videos.")
    parser.add_argument("--max-videos", type=int, default=48, help="Maximum total videos to collect (default: 48)")
    parser.add_argument("--cache-only", action="store_true", help="Re-process existing cached videos without hitting YouTube API")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    print("[1/5] Loading Oxford A1-C1 & TOEIC vocabulary decks from public/data/vocab/...")
    word_cefr, vocab_meta = load_oxford_and_toeic_vocab()
    print(f"      Loaded {len(word_cefr)} CEFR-ranked words and {len(vocab_meta)} rich quiz-ready entries.")

    translator = ViTranslator(VI_CACHE_PATH)
    transcript_cache = load_json_cache(TRANSCRIPT_CACHE_PATH)

    proxy_url = os.environ.get("YT_PROXY_URL", "").strip()
    if proxy_url:
        print("      Using YT_PROXY_URL for YouTubeTranscriptApi.")
        yt_api = YouTubeTranscriptApi(proxy_config=GenericProxyConfig(http_url=proxy_url, https_url=proxy_url))
    else:
        yt_api = YouTubeTranscriptApi()

    rate_limit_state: Dict[str, Any] = {"blocked": args.cache_only, "consecutive_blocks": 0}
    catalog: List[Dict[str, Any]] = []
    seen_yt_ids: Set[str] = set()
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Preserve & re-process any previously collected videos whose transcripts are cached
    existing_catalog_path = OUTPUT_DIR / "catalog.json"
    existing_by_yt: Dict[str, Dict[str, Any]] = {}
    if existing_catalog_path.exists():
        try:
            for row in json.loads(existing_catalog_path.read_text(encoding="utf-8")):
                if row.get("youtubeId") in transcript_cache and transcript_cache[row["youtubeId"]]:
                    existing_by_yt[row["youtubeId"]] = row
        except Exception:
            pass

    def process_and_save_video(
        yt_id: str,
        title_en: str,
        duration_sec: int,
        channel_display: str,
        channel_slug: str,
        prior_score: float,
        default_topic: str,
        thumbnail: str,
        raw_snippets: List[Dict[str, Any]],
        is_manual: bool,
        created_at: str,
    ) -> Optional[Dict[str, Any]]:
        sentences = normalize_sentences(raw_snippets)
        total_words = sum(s["wordCount"] for s in sentences)
        if len(sentences) < 12 or total_words < 90:
            return None

        level, wpm, cefr_dbg = classify_cefr(title_en, sentences, duration_sec, word_cefr, prior_score)
        topic = classify_topic(title_en, sentences, default_topic)

        to_translate = [title_en] + [s["textEn"] for s in sentences]
        translated = translator.translate_many(to_translate)
        title_vi = translated[0]
        for s, vi in zip(sentences, translated[1:]):
            s["textVi"] = vi

        translator.flush()
        save_json_cache(TRANSCRIPT_CACHE_PATH, transcript_cache)

        quiz_items = generate_quiz_items(yt_id, sentences, vocab_meta, target_min=6, target_max=10)
        if len(quiz_items) < 4:
            return None

        video_id = f"yt-{yt_id}"
        meta_row = {
            "id": video_id,
            "youtubeId": yt_id,
            "titleEn": title_en,
            "titleVi": title_vi,
            "channel": channel_display,
            "channelSlug": channel_slug,
            "durationSec": duration_sec,
            "level": level,
            "topic": topic,
            "sentenceCount": len(sentences),
            "wpm": wpm,
            "thumbnail": thumbnail,
            "featured": False,
            "createdAt": created_at,
        }
        detail_payload = {
            **meta_row,
            "isManualCaption": is_manual,
            "cefrMetrics": cefr_dbg,
            "sentences": sentences,
            "quizItems": quiz_items,
        }
        (ITEMS_DIR / f"{video_id}.json").write_text(
            json.dumps(detail_payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return meta_row

    # First re-process existing cached videos so nothing is ever lost on partial runs
    if existing_by_yt:
        print(f"\n      Re-processing {len(existing_by_yt)} previously collected cached videos...")
        bucket_prior_by_slug = {b["channel_slug"]: (b["prior_score"], b["default_topic"]) for b in SOURCE_BUCKETS}
        for yt_id, old_row in existing_by_yt.items():
            entry = transcript_cache.get(yt_id)
            if not entry or not entry.get("snippets"):
                continue
            default_prior, default_topic = bucket_prior_by_slug.get(
                old_row["channelSlug"], (CEFR_TO_NUM.get(old_row.get("level", "B1"), 3), old_row.get("topic", "Giao tiếp hàng ngày"))
            )
            # Keep original level's prior closely if channel has multiple levels
            if old_row["channelSlug"] == "bbc-learning-english" and "6 minute english" in old_row["titleEn"].lower():
                default_prior = 3.0
            meta_row = process_and_save_video(
                yt_id=yt_id,
                title_en=old_row["titleEn"],
                duration_sec=int(old_row["durationSec"]),
                channel_display=old_row["channel"],
                channel_slug=old_row["channelSlug"],
                prior_score=default_prior,
                default_topic=old_row.get("topic", default_topic),
                thumbnail=old_row["thumbnail"],
                raw_snippets=entry["snippets"],
                is_manual=bool(entry.get("isManual", False)),
                created_at=old_row.get("createdAt", now_iso),
            )
            if meta_row:
                catalog.append(meta_row)
                seen_yt_ids.add(yt_id)

    if not args.cache_only:
        print(f"\n[2/5] Discovering & processing new videos across {len(SOURCE_BUCKETS)} curated buckets...")
        for b_idx, bucket in enumerate(SOURCE_BUCKETS, start=1):
            if len(catalog) >= args.max_videos or rate_limit_state["blocked"]:
                break
            already_in_ch = sum(1 for r in catalog if r["channelSlug"] == bucket["channel_slug"])
            if already_in_ch >= bucket["target_count"] and bucket["channel_slug"] != "bbc-learning-english":
                print(f"\n  Bucket {b_idx}/{len(SOURCE_BUCKETS)}: {bucket['name']} — already have {already_in_ch}, skipping.")
                continue
            print(f"\n  Bucket {b_idx}/{len(SOURCE_BUCKETS)}: {bucket['name']} (target={bucket['target_count']})")
            candidates = discover_candidates_for_bucket(bucket, seen_yt_ids)
            print(f"    -> Found {len(candidates)} candidate videos matching channel & duration ({bucket['min_sec']}-{bucket['max_sec']}s)")

            collected_in_bucket = 0
            for cand in candidates:
                if collected_in_bucket >= bucket["target_count"] or len(catalog) >= args.max_videos or rate_limit_state["blocked"]:
                    break

                yt_id = cand["youtubeId"]
                raw_snippets, is_manual = fetch_english_transcript(yt_api, yt_id, transcript_cache, rate_limit_state)
                if not raw_snippets:
                    continue

                meta_row = process_and_save_video(
                    yt_id=yt_id,
                    title_en=cand["titleEn"],
                    duration_sec=cand["durationSec"],
                    channel_display=bucket["channel_display"],
                    channel_slug=bucket["channel_slug"],
                    prior_score=bucket["prior_score"],
                    default_topic=bucket["default_topic"],
                    thumbnail=cand["thumbnail"],
                    raw_snippets=raw_snippets,
                    is_manual=is_manual,
                    created_at=now_iso,
                )
                if not meta_row:
                    continue

                seen_yt_ids.add(yt_id)
                catalog.append(meta_row)
                collected_in_bucket += 1
                cap_tag = "MANUAL" if is_manual else "AUTO"
                print(
                    f"    + [{len(catalog):02d}] {meta_row['id']} | {meta_row['level']} | {meta_row['wpm']:3d} WPM | "
                    f"{meta_row['sentenceCount']:3d} sents | {cap_tag} | {cand['titleEn'][:52]}"
                )

    # Mark balanced featured videos (up to 10: ~2 per CEFR level across diverse channels)
    print("\n[3/5] Selecting featured highlights & building channels.json...")
    featured_ids: Set[str] = set()
    used_featured_channels: Counter = Counter()
    for lvl in CEFR_LEVELS:
        lvl_rows = [v for v in catalog if v["level"] == lvl]
        lvl_rows.sort(key=lambda r: (used_featured_channels[r["channelSlug"]], -r["sentenceCount"]))
        for row in lvl_rows[:2]:
            row["featured"] = True
            featured_ids.add(row["id"])
            used_featured_channels[row["channelSlug"]] += 1

    # Sync featured flag into detail item files
    for row in catalog:
        if row["id"] in featured_ids:
            ip = ITEMS_DIR / f"{row['id']}.json"
            detail = json.loads(ip.read_text(encoding="utf-8"))
            detail["featured"] = True
            ip.write_text(json.dumps(detail, ensure_ascii=False, indent=2), encoding="utf-8")

    # Remove stale item files not in current catalog
    valid_item_names = {f"{r['id']}.json" for r in catalog}
    for old_f in ITEMS_DIR.glob("*.json"):
        if old_f.name not in valid_item_names:
            old_f.unlink()

    # Build channels.json
    by_channel: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in catalog:
        by_channel[row["channelSlug"]].append(row)

    channels_out: List[Dict[str, Any]] = []
    for slug, rows in sorted(by_channel.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        lvl_counter = Counter(r["level"] for r in rows)
        dominant_level = max(lvl_counter.items(), key=lambda kv: (kv[1], -CEFR_TO_NUM[kv[0]]))[0]
        avg_dur = int(round(sum(r["durationSec"] for r in rows) / max(1, len(rows))))
        avg_wpm = int(round(sum(r["wpm"] for r in rows) / max(1, len(rows))))
        channels_out.append({
            "slug": slug,
            "name": rows[0]["channel"],
            "videoCount": len(rows),
            "avgDurationSec": avg_dur,
            "avgWpm": avg_wpm,
            "dominantLevel": dominant_level,
            "levels": sorted(lvl_counter.keys(), key=lambda lv: CEFR_TO_NUM[lv]),
            "topics": sorted({r["topic"] for r in rows}),
            "sampleThumbnail": rows[0]["thumbnail"],
        })

    # Write catalog.json & channels.json
    print("[4/5] Writing public/data/videos/catalog.json & channels.json...")
    (OUTPUT_DIR / "catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUTPUT_DIR / "channels.json").write_text(
        json.dumps(channels_out, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Print formatted statistics table
    print("\n[5/5] COLLECTION SUMMARY")
    print("=" * 68)
    print(f"Total videos collected : {len(catalog)}")
    print(f"Total unique channels  : {len(channels_out)}")
    print(f"Total sentences        : {sum(r['sentenceCount'] for r in catalog)}")
    print(f"Featured videos        : {len(featured_ids)}")

    print("\n--- Breakdown by CEFR Level ---")
    print(f"{'Level':<8} | {'Count':>5} | {'Avg WPM':>7} | {'Avg Dur':>8}")
    print("-" * 40)
    for lvl in CEFR_LEVELS:
        rows = [r for r in catalog if r["level"] == lvl]
        cnt = len(rows)
        avg_w = int(round(sum(r["wpm"] for r in rows) / cnt)) if cnt else 0
        avg_d = int(round(sum(r["durationSec"] for r in rows) / cnt)) if cnt else 0
        print(f"{lvl:<8} | {cnt:>5} | {avg_w:>7} | {avg_d:>6}s")

    print("\n--- Breakdown by Channel ---")
    print(f"{'Channel':<30} | {'Count':>5} | {'Avg Dur':>7} | {'Dominant':>8} | Levels")
    print("-" * 74)
    for ch in channels_out:
        print(
            f"{ch['name']:<30} | {ch['videoCount']:>5} | {ch['avgDurationSec']:>5}s  | "
            f"{ch['dominantLevel']:>8} | {', '.join(ch['levels'])}"
        )

    print("\n--- Breakdown by Topic ---")
    topic_counts = Counter(r["topic"] for r in catalog)
    for tp in TOPICS:
        print(f"  {tp:<26}: {topic_counts.get(tp, 0)}")
    print("=" * 68)


if __name__ == "__main__":
    main()
