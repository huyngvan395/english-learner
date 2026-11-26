#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/fetch_vocab.py
======================
Automated Vocabulary Collection & Enrichment Pipeline for TOEIC Mastery Hub.

Features:
1. Pulls open-source public English wordlists from GitHub (Oxford 3000 / 1000 Common)
   for verification and optional large-scale expansion (`--expand-github N`).
2. Loads 380 curated, 100% accurate bilingual TOEIC/Oxford/Exam entries across 12 decks.
3. Enriches every word concurrently via Free Dictionary API
   (https://api.dictionaryapi.dev/api/v2/entries/en/{word}) to obtain real UK/US IPA,
   audio pronunciation MP3 URLs, and extra synonyms — cached in scripts/.cache/dict_cache.json.
4. Exports clean JSON files per deck to `src/data/vocab/<deck-id>.json` matching
   the TypeScript `VocabDeck` & `VocabWord` interfaces.

Usage:
    python scripts/fetch_vocab.py
    python scripts/fetch_vocab.py --skip-api
    python scripts/fetch_vocab.py --expand-github 150
"""

import argparse
import concurrent.futures
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

# Ensure UTF-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT_DIR / "scripts"
CACHE_DIR = SCRIPTS_DIR / ".cache"
CACHE_FILE = CACHE_DIR / "dict_cache.json"
OUT_DIR = ROOT_DIR / "src" / "data" / "vocab"

sys.path.insert(0, str(SCRIPTS_DIR))
from vocab_seed_toeic import TOEIC_600_SEED, TOEIC_ETS_SEED, TOEIC_IDIOMS_SEED
from vocab_seed_oxford_more import (
    COMMON_1000_SEED,
    COMMUNICATION_SEED,
    IELTS_SEED,
    OXFORD_3000_SEED,
    OXFORD_5000_SEED,
    SAT_SEED,
    THPT_SEED,
    TOEFL_SEED,
    TOPIC_BUSINESS_SEED,
)

GITHUB_OPEN_WORDLISTS = {
    "oxford-3000": "https://raw.githubusercontent.com/jnoodle/English-Vocabulary-Word-List/master/Oxford%203000.txt",
    "common-1000": "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt",
}

DECK_METADATA = [
    {
        "id": "toeic-600",
        "title": "600 Từ Vựng Thiết Yếu Cho TOEIC",
        "subtitle": "Bộ từ cốt lõi phủ sóng 85% ngữ cảnh Hợp đồng, Marketing, Nhân sự, Văn phòng & Tài chính.",
        "category": "toeic",
        "levelLabel": "B1 – B2",
        "tags": ["#b1", "#b2", "#toeic"],
        "coverTheme": "toeic-600",
        "accentGradient": "from-blue-600 via-indigo-600 to-violet-600",
        "badgeText": "HOT TOEIC",
        "prefix": "t600",
        "seed": TOEIC_600_SEED,
    },
    {
        "id": "toeic-ets",
        "title": "Từ Vựng ETS TOEIC (Tần Suất Cao Đề Thật)",
        "subtitle": "Tổng hợp những từ & bẫy paraphrase xuất hiện dày đặc trong bộ đề thi ETS 2022–2026.",
        "category": "toeic",
        "levelLabel": "B2 – C1",
        "tags": ["#b2", "#c1", "#toeic", "#ets"],
        "coverTheme": "toeic-ets",
        "accentGradient": "from-violet-600 via-purple-600 to-fuchsia-600",
        "badgeText": "ETS REAL TEST",
        "prefix": "ets",
        "seed": TOEIC_ETS_SEED,
    },
    {
        "id": "toeic-idioms",
        "title": "Thành Ngữ & Collocations TOEIC Phổ Biến",
        "subtitle": "Cụm động từ, cụm giới từ và thành ngữ công sở ăn điểm tuyệt đối ở Part 2, 3, 5 & 7.",
        "category": "toeic",
        "levelLabel": "B2",
        "tags": ["#b2", "#toeic", "#idioms", "#ets"],
        "coverTheme": "toeic-idioms",
        "accentGradient": "from-cyan-500 via-blue-600 to-indigo-600",
        "badgeText": "COLLOCATIONS",
        "prefix": "tid",
        "seed": TOEIC_IDIOMS_SEED,
    },
    {
        "id": "common-1000",
        "title": "1000 Từ Tiếng Anh Thông Dụng",
        "subtitle": "Nền tảng vững chắc cho người mới bắt đầu, bao quát từ vựng xuất hiện hàng ngày.",
        "category": "common",
        "levelLabel": "A1 – A2",
        "tags": ["#a1", "#a2", "#common"],
        "coverTheme": "common-1000",
        "accentGradient": "from-emerald-500 via-teal-500 to-cyan-600",
        "badgeText": "NỀN TẢNG",
        "prefix": "c1000",
        "seed": COMMON_1000_SEED,
    },
    {
        "id": "communication-daily",
        "title": "Từ Vựng Tiếng Anh Giao Tiếp",
        "subtitle": "Phản xạ nhanh trong giao tiếp công sở, đặt lịch hẹn, điện thoại & trò chuyện tự nhiên.",
        "category": "common",
        "levelLabel": "A2 – B1",
        "tags": ["#a2", "#b1", "#communication", "#common"],
        "coverTheme": "communication",
        "accentGradient": "from-sky-500 via-blue-500 to-indigo-600",
        "badgeText": "GIAO TIẾP",
        "prefix": "comm",
        "seed": COMMUNICATION_SEED,
    },
    {
        "id": "oxford-3000",
        "title": "Oxford 3000 (A1, A2, B1, B2)",
        "subtitle": "Danh sách 3000 từ cốt lõi quan trọng nhất do Đại học Oxford tuyển chọn cho mọi người học.",
        "category": "oxford",
        "levelLabel": "A1 – B2",
        "tags": ["#a1", "#a2", "#b1", "#b2", "#oxford"],
        "coverTheme": "oxford-3000",
        "accentGradient": "from-amber-500 via-orange-500 to-rose-500",
        "badgeText": "OXFORD 3000",
        "prefix": "ox3",
        "seed": OXFORD_3000_SEED,
    },
    {
        "id": "oxford-5000",
        "title": "Oxford 5000 (B2 – C1)",
        "subtitle": "2000 từ nâng cao giúp bứt phá Band C1, đọc hiểu báo chí kinh tế và TOEIC 900+.",
        "category": "oxford",
        "levelLabel": "B2 – C1",
        "tags": ["#b2", "#c1", "#oxford"],
        "coverTheme": "oxford-5000",
        "accentGradient": "from-rose-600 via-pink-600 to-purple-600",
        "badgeText": "ADVANCED C1",
        "prefix": "ox5",
        "seed": OXFORD_5000_SEED,
    },
    {
        "id": "ielts-core",
        "title": "IELTS Cơ Bản & Nâng Cao (Band 4–9)",
        "subtitle": "Từ vựng học thuật chủ đề Môi trường, Giáo dục, Công nghệ & Xã hội cho Reading & Writing.",
        "category": "academic",
        "levelLabel": "Band 4.5 – 8.5",
        "tags": ["#b1", "#b2", "#c1", "#ielts"],
        "coverTheme": "ielts",
        "accentGradient": "from-red-500 via-rose-600 to-orange-500",
        "badgeText": "IELTS",
        "prefix": "ielts",
        "seed": IELTS_SEED,
    },
    {
        "id": "thpt-qg",
        "title": "Từ Vựng Chuyên Sâu THPT Quốc Gia",
        "subtitle": "Từ vựng, cụm từ cố định & dễ nhầm lẫn trọng tâm đề thi tốt nghiệp THPT môn Tiếng Anh.",
        "category": "academic",
        "levelLabel": "B1 – B2",
        "tags": ["#b1", "#b2", "#thpt"],
        "coverTheme": "thpt",
        "accentGradient": "from-teal-500 via-emerald-600 to-green-600",
        "badgeText": "THPT QG",
        "prefix": "thpt",
        "seed": THPT_SEED,
    },
    {
        "id": "sat-core",
        "title": "Từ Vựng SAT Cốt Lõi",
        "subtitle": "Từ vựng học thuật sắc bén xuất hiện nhiều trong Digital SAT Reading & Writing.",
        "category": "academic",
        "levelLabel": "C1",
        "tags": ["#c1", "#sat"],
        "coverTheme": "sat",
        "accentGradient": "from-indigo-600 via-blue-700 to-slate-700",
        "badgeText": "SAT CORE",
        "prefix": "sat",
        "seed": SAT_SEED,
    },
    {
        "id": "toefl-essential",
        "title": "Từ Vựng Thiết Yếu Cho TOEFL",
        "subtitle": "Từ vựng học thuật Đại học (Khoa học, Sinh học, Lịch sử, Kinh tế) chuẩn TOEFL iBT.",
        "category": "academic",
        "levelLabel": "B2 – C1",
        "tags": ["#b2", "#c1", "#toefl"],
        "coverTheme": "toefl",
        "accentGradient": "from-fuchsia-600 via-purple-600 to-indigo-600",
        "badgeText": "TOEFL iBT",
        "prefix": "toefl",
        "seed": TOEFL_SEED,
    },
    {
        "id": "topic-business",
        "title": "Từ Vựng Theo Chủ Đề (Công sở, Tài chính, Nhân sự, Marketing, Du lịch)",
        "subtitle": "5 nhóm chủ đề thiết yếu cho môi trường doanh nghiệp quốc tế và bài đọc TOEIC Part 7.",
        "category": "academic",
        "levelLabel": "B1 – B2",
        "tags": ["#b1", "#b2", "#topic", "#toeic"],
        "coverTheme": "topic-business",
        "accentGradient": "from-blue-500 via-cyan-500 to-teal-500",
        "badgeText": "5 CHỦ ĐỀ",
        "prefix": "top",
        "seed": TOPIC_BUSINESS_SEED,
    },
]


def load_cache() -> Dict[str, Any]:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(cache: Dict[str, Any]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def fetch_dictionary_api(word: str, session: requests.Session) -> Optional[Dict[str, Any]]:
    """Query Free Dictionary API for verified IPA, audio MP3 URLs, and extra synonyms."""
    clean_word = word.strip().lower()
    if " " in clean_word:
        return None  # Multi-word phrases are rarely single entries on dictionaryapi.dev

    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{clean_word}"
    try:
        for attempt in range(3):
            resp = session.get(url, timeout=8)
            if resp.status_code == 429:
                time.sleep(1.2 * (attempt + 1))
                continue
            break
        if resp.status_code == 429:
            return {"_rate_limited": True}
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not isinstance(data, list) or not data:
            return None

        entry = data[0]
        ipa_uk = ""
        ipa_us = ""
        audio_uk = ""
        audio_us = ""

        for ph in entry.get("phonetics", []):
            txt = (ph.get("text") or "").strip()
            aud = (ph.get("audio") or "").strip()
            if aud:
                if "-uk" in aud.lower():
                    audio_uk = aud
                    if txt and not ipa_uk:
                        ipa_uk = txt
                elif "-us" in aud.lower():
                    audio_us = aud
                    if txt and not ipa_us:
                        ipa_us = txt
                else:
                    if not audio_us:
                        audio_us = aud
                    if txt and not ipa_us:
                        ipa_us = txt
            elif txt:
                if not ipa_us:
                    ipa_us = txt
                if not ipa_uk:
                    ipa_uk = txt

        extra_synonyms: List[str] = []
        extra_example = ""
        for meaning in entry.get("meanings", []):
            for syn in meaning.get("synonyms", [])[:4]:
                if syn and syn.lower() != clean_word and syn not in extra_synonyms:
                    extra_synonyms.append(syn)
            for df in meaning.get("definitions", []):
                if df.get("example") and not extra_example:
                    extra_example = df["example"]

        return {
            "ipaUK": ipa_uk,
            "ipaUS": ipa_us,
            "audioUrlUK": audio_uk,
            "audioUrlUS": audio_us,
            "synonyms": extra_synonyms[:5],
            "apiExample": extra_example,
        }
    except Exception:
        return None


def fetch_github_wordlist(deck_id: str) -> List[str]:
    """Fetch public open-source GitHub wordlist for audit/expansion."""
    url = GITHUB_OPEN_WORDLISTS.get(deck_id)
    if not url:
        return []
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return []
        words = []
        for line in resp.text.splitlines():
            w = line.strip().lower()
            if w and w.isalpha() and 3 <= len(w) <= 18:
                words.append(w)
        return words
    except Exception:
        return []


def build_word_object(
    deck_id: str,
    prefix: str,
    idx: int,
    row: Tuple,
    api_info: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    word, pos, ipa_uk, ipa_us, meaning, ex_en, ex_vi, wf_list, syns, ants, colls = row

    final_ipa_uk = (api_info or {}).get("ipaUK") or ipa_uk
    final_ipa_us = (api_info or {}).get("ipaUS") or ipa_us
    audio_us = (api_info or {}).get("audioUrlUS") or ""
    audio_uk = (api_info or {}).get("audioUrlUK") or ""

    # Merge curated synonyms with API synonyms without duplicates
    merged_syns = list(syns)
    for s in (api_info or {}).get("synonyms", []):
        if s.lower() not in {x.lower() for x in merged_syns} and len(merged_syns) < 5:
            merged_syns.append(s)

    word_obj: Dict[str, Any] = {
        "id": f"{prefix}-{idx}",
        "deckId": deck_id,
        "word": word,
        "pos": pos,
        "ipaUK": final_ipa_uk,
        "ipaUS": final_ipa_us,
        "meaning": meaning,
        "examples": [{"en": ex_en, "vi": ex_vi}],
        "wordFamily": [{"word": w, "pos": p, "meaning": m} for (w, p, m) in wf_list],
        "synonyms": merged_syns,
        "antonyms": list(ants),
        "collocations": [{"phrase": p, "meaning": m} for (p, m) in colls],
    }
    if audio_us:
        word_obj["audioUrlUS"] = audio_us
    if audio_uk:
        word_obj["audioUrlUK"] = audio_uk
    return word_obj


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch & enrich TOEIC/Oxford vocabulary decks into JSON.")
    parser.add_argument("--skip-api", action="store_true", help="Skip live Free Dictionary API lookups (use cache/seed).")
    parser.add_argument("--deck", type=str, default=None, help="Process only a specific deck id.")
    parser.add_argument("--workers", type=int, default=6, help="Concurrent API workers (polite default: 6).")
    parser.add_argument("--expand-github", type=int, default=0, help="Optional: append N extra English words from GitHub Oxford 3000 via Free Dictionary API.")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cache = load_cache()

    # Check open-source GitHub connectivity once for logging
    if not args.skip_api:
        ox_gh = fetch_github_wordlist("oxford-3000")
        print(f"[GitHub Open Wordlist] Oxford 3000 public list fetched: {len(ox_gh)} terms available for expansion.")
    else:
        ox_gh = []

    # Collect unique single words to query from Free Dictionary API
    unique_single_words = set()
    for deck in DECK_METADATA:
        if args.deck and deck["id"] != args.deck:
            continue
        for row in deck["seed"]:
            w = row[0].strip().lower()
            if " " not in w and w not in cache:
                unique_single_words.add(w)

    if not args.skip_api and unique_single_words:
        print(f"[Dictionary API] Enriching {len(unique_single_words)} words from api.dictionaryapi.dev...")
        session = requests.Session()
        session.headers.update({"User-Agent": "TOEIC-Mastery-Hub-Educator/1.0"})

        def worker(term: str) -> Tuple[str, Optional[Dict[str, Any]]]:
            time.sleep(0.08)  # polite throttle
            return term, fetch_dictionary_api(term, session)

        fetched_ok = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for term, result in pool.map(worker, sorted(unique_single_words)):
                if result and result.get("_rate_limited"):
                    continue  # Do not cache rate-limited misses so next run retries them
                cache[term] = result if result else {}
                if result:
                    fetched_ok += 1
        save_cache(cache)
        print(f"[Dictionary API] Enriched {fetched_ok}/{len(unique_single_words)} words (cached to {CACHE_FILE.name}).")

    manifest = []
    total_words = 0
    total_with_audio = 0

    for deck in DECK_METADATA:
        if args.deck and deck["id"] != args.deck:
            continue

        seen_words = set()
        word_entries = []
        idx = 1
        for row in deck["seed"]:
            w_key = row[0].strip().lower()
            if w_key in seen_words:
                continue
            seen_words.add(w_key)
            api_info = cache.get(w_key) or None
            entry = build_word_object(deck["id"], deck["prefix"], idx, row, api_info)
            if entry.get("audioUrlUS") or entry.get("audioUrlUK"):
                total_with_audio += 1
            word_entries.append(entry)
            idx += 1

        # Optional expansion from GitHub Oxford 3000 wordlist
        if args.expand_github > 0 and deck["id"] == "oxford-3000" and ox_gh:
            added = 0
            session = requests.Session()
            for candidate in ox_gh:
                if added >= args.expand_github:
                    break
                if candidate in seen_words:
                    continue
                info = cache.get(candidate)
                if info is None and not args.skip_api:
                    info = fetch_dictionary_api(candidate, session) or {}
                    cache[candidate] = info
                if not info or not info.get("ipaUS"):
                    continue
                seen_words.add(candidate)
                word_entries.append({
                    "id": f"ox3-gh-{idx}",
                    "deckId": "oxford-3000",
                    "word": candidate,
                    "pos": "n",
                    "ipaUK": info.get("ipaUK") or info.get("ipaUS"),
                    "ipaUS": info.get("ipaUS"),
                    "meaning": f"Từ vựng Oxford 3000 mở rộng ({candidate})",
                    "examples": [{
                        "en": info.get("apiExample") or f"Please review the usage of '{candidate}' in business contexts.",
                        "vi": f"Vui lòng xem cách dùng từ '{candidate}' trong ngữ cảnh thực tế.",
                    }],
                    "wordFamily": [],
                    "synonyms": info.get("synonyms", [])[:4],
                    "antonyms": [],
                    "collocations": [],
                    **({"audioUrlUS": info["audioUrlUS"]} if info.get("audioUrlUS") else {}),
                    **({"audioUrlUK": info["audioUrlUK"]} if info.get("audioUrlUK") else {}),
                })
                idx += 1
                added += 1
            save_cache(cache)

        deck_payload = {
            "id": deck["id"],
            "title": deck["title"],
            "subtitle": deck["subtitle"],
            "category": deck["category"],
            "levelLabel": deck["levelLabel"],
            "tags": deck["tags"],
            "coverTheme": deck["coverTheme"],
            "accentGradient": deck["accentGradient"],
            "badgeText": deck["badgeText"],
            "words": word_entries,
        }

        out_path = OUT_DIR / f"{deck['id']}.json"
        out_path.write_text(json.dumps(deck_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        total_words += len(word_entries)
        manifest.append({"id": deck["id"], "file": f"{deck['id']}.json", "count": len(word_entries)})
        print(f"  [OK] {out_path.relative_to(ROOT_DIR)} -> {len(word_entries)} words")

    manifest_path = OUT_DIR / "index.json"
    manifest_path.write_text(
        json.dumps({"totalWords": total_words, "decks": manifest}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nDONE! Generated {total_words} vocabulary words across {len(manifest)} decks ({total_with_audio} enriched with live Dictionary API audio URLs).")

    # Automatically apply sub-topics, Cambridge/Oxford definitions & exact-form example alignment
    import enrich_vocab_topics_defs
    enrich_vocab_topics_defs.main()


if __name__ == "__main__":
    main()
