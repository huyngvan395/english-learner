#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/translate_missing_vi.py
===============================
Audits all 16 vocab deck JSON files in public/data/vocab/ and translates 100% of
untranslated English fields (`meaning`, `definitionVi`, `examples[].vi`,
`relationMeanings`, `wordFamily[].meaning`, `collocations[].meaning`) into natural
Vietnamese with batched concurrent execution and resumable caching in:
    scripts/cache/full_vi_translation_cache.json

Provider cascade:
  1. `deep_translator.GoogleTranslator` (auto-disabled temporarily if HTTP 429)
  2. Mozhi Neural Translator (`duckduckgo` / Azure Neural) with ` ||| ` batching
  3. `deep_translator.MyMemoryTranslator` single-item fallback

Also syncs `public/data/vocab/search-index.json` cleanly after updating all decks.
"""

from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from deep_translator import GoogleTranslator, MyMemoryTranslator

ROOT = Path(__file__).resolve().parent.parent
VOCAB_DIR = ROOT / "public" / "data" / "vocab"
CACHE_DIR = ROOT / "scripts" / "cache"
CACHE_PATH = CACHE_DIR / "full_vi_translation_cache.json"
LEGACY_TRANS_CACHE = CACHE_DIR / "vi_translations.json"
LEGACY_GLOSS_CACHE = CACHE_DIR / "vi_gloss_cache.json"

VI_DIACRITIC_RE = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
    re.I,
)
ASCII_WORD_RE = re.compile(r"[A-Za-z]{2,}")

VALID_VI_NO_DIACRITIC = {
    "anh", "em", "ba", "cha", "con", "nha", "xe", "ban", "nam", "tay", "tai",
    "cao", "to", "nho", "xanh", "den", "trang", "vang", "do", "tim", "cam",
    "an", "uong", "di", "ra", "vao", "len", "xuong", "qua", "lai", "cho",
    "mua", "lam", "xem", "nghe", "noi", "viet", "doc", "hoc", "choi", "ngu",
    "tin", "tuc", "hang", "hoa", "phim", "nhac", "sach", "bao", "thu", "may",
    "com", "canh", "ca", "thit", "rau", "qua", "cay", "co", "la",
    "san", "bay", "tau", "buyt", "ga", "ben", "cang", "kho",
    "phong", "ghe", "cua", "tuong", "tran", "mai", "vuon",
    "ngay", "dem", "sang", "trua", "chieu", "toi", "tuan", "thang",
    "luon", "moi", "cu", "nhanh", "cham", "xa", "gan", "trong", "ngoai",
    "tren", "duoi", "truoc", "sau", "giua", "canh", "xung", "quanh",
    "khong", "hay", "hoac", "nhung", "vi", "nen", "neu", "thi", "ma",
    "ai", "gi", "nao", "sao", "dau", "bao", "nhieu", "tu", "den",
    "ong", "chu", "bac", "chau", "be", "nguoi", "dan", "quan",
    "cong", "ty", "ngan", "truong", "lop", "khoa", "nganh", "nghe",
    "viec", "luong", "thuong", "thue", "phi", "gia", "von", "lai", "lo",
    "hop", "dong", "don", "bien", "phieu",
    "ke", "hoach", "du", "an", "muc", "tieu", "ket", "van", "de",
    "giai", "phap", "phuong", "quy", "trinh", "he", "thong", "mang",
    "web", "email", "internet", "video", "radio", "taxi", "hotel", "menu",
    "bar", "cafe", "golf", "tennis", "piano", "guitar", "jazz", "rock", "pop",
}

ENGLISH_STOPWORDS = {
    "the", "a", "an", "of", "to", "in", "on", "for", "with", "that", "this",
    "from", "by", "as", "at", "be", "is", "are", "was", "were", "have", "has",
    "something", "someone", "somebody", "person", "thing", "used", "about",
    "which", "who", "when", "where", "your", "their", "our", "his", "her",
    "into", "over", "under", "between", "through", "after", "before", "during",
    "without", "within", "against", "especially", "usually", "often", "very",
}

LOANWORDS_OK = {
    "email", "internet", "video", "radio", "taxi", "menu", "golf", "tennis",
    "piano", "guitar", "jazz", "rock", "pop", "web", "wifi", "laptop", "robot",
    "laser", "radar", "cafe", "bar", "hotel", "album", "camera", "sofa", "visa",
    "euro", "dollar", "logic", "virus", "yoga", "studio", "poster", "clip",
}

google_available = True
google_lock = threading.Lock()


def normalize_compare(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


def is_untranslated_vi(vi: str, en: str = "", strict_short: bool = False) -> bool:
    v = (vi or "").strip()
    e = (en or "").strip()
    if not v:
        return bool(e)

    v_norm = normalize_compare(v).rstrip(".")
    e_norm = normalize_compare(e).rstrip(".")

    if e_norm and v_norm == e_norm:
        if strict_short and v_norm in LOANWORDS_OK:
            return False
        return True

    if VI_DIACRITIC_RE.search(v):
        return False

    ascii_words = [w.lower() for w in ASCII_WORD_RE.findall(v)]
    if len(ascii_words) > 2:
        non_vi = [w for w in ascii_words if w not in VALID_VI_NO_DIACRITIC]
        if len(non_vi) >= 2 or any(w in ENGLISH_STOPWORDS for w in ascii_words):
            return True
        if len(ascii_words) >= 4 and len(non_vi) >= 1:
            return True

    if len(ascii_words) == 2 and any(w in ENGLISH_STOPWORDS for w in ascii_words):
        return True

    if strict_short and len(ascii_words) >= 1:
        if e_norm and v_norm == e_norm and len(v_norm) >= 3 and v_norm not in LOANWORDS_OK:
            return True
        if (
            len(ascii_words) == 1
            and ascii_words[0] not in VALID_VI_NO_DIACRITIC
            and ascii_words[0] not in LOANWORDS_OK
            and len(ascii_words[0]) >= 4
        ):
            if e_norm and ascii_words[0] in e_norm:
                return True

    return False


def clean_dictionary_source(text: str) -> str:
    s = re.sub(r"\s+", " ", (text or "").strip())
    s = s.replace("|||", "-")
    s = re.sub(r"\bsb\b", "someone", s)
    s = re.sub(r"\bsth\b", "something", s)
    return s


def postprocess_vi(text: str, original_en: str) -> str:
    s = re.sub(r"\s+", " ", (text or "").strip())
    if not s:
        return s
    if original_en and original_en[0].isupper() and s[0].islower():
        s = s[0].upper() + s[1:]
    return s


def load_cache() -> Dict[str, str]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache: Dict[str, str] = {}

    for legacy_path in (LEGACY_TRANS_CACHE, LEGACY_GLOSS_CACHE):
        if legacy_path.exists():
            try:
                raw = json.loads(legacy_path.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    for k, v in raw.items():
                        if isinstance(k, str) and isinstance(v, str) and v.strip():
                            if not is_untranslated_vi(v, k):
                                cache[k] = v.strip()
            except Exception:
                pass

    if CACHE_PATH.exists():
        try:
            raw = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                for k, v in raw.items():
                    if isinstance(k, str) and isinstance(v, str) and v.strip():
                        cache[k] = v.strip()
        except Exception:
            pass

    return cache


def save_cache(cache: Dict[str, str]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = CACHE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CACHE_PATH)


def probe_google_once() -> bool:
    global google_available
    try:
        tr = GoogleTranslator(source="en", target="vi").translate("Hello world")
        google_available = bool(tr and tr.strip())
    except Exception:
        google_available = False
    return google_available


def mozhi_translate_text(payload: str, timeout: int = 18) -> Optional[str]:
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


def translate_single(text: str) -> Optional[str]:
    global google_available
    cleaned = clean_dictionary_source(text)
    if not cleaned:
        return ""

    # 1. GoogleTranslator if currently unthrottled
    if google_available:
        try:
            tr = GoogleTranslator(source="en", target="vi").translate(cleaned)
            if tr and tr.strip():
                return postprocess_vi(tr.strip(), text)
        except Exception as e:
            if "TooManyRequests" in type(e).__name__ or "429" in str(e):
                with google_lock:
                    google_available = False

    # 2. Mozhi Neural Translator (duckduckgo / Azure Neural)
    for attempt in range(3):
        try:
            tr = mozhi_translate_text(cleaned, timeout=16)
            if tr:
                res = postprocess_vi(tr, text)
                if (
                    normalize_compare(res).rstrip(".") == normalize_compare(text).rstrip(".")
                    and len(cleaned.split()) >= 2
                ):
                    alt = cleaned[0].lower() + cleaned[1:]
                    alt = re.sub(r"^([a-zA-Z\-]+)\s*\(([^)]+)\),\s*", r"\1 (\2): ", alt)
                    tr2 = mozhi_translate_text(alt, timeout=16)
                    if tr2:
                        res2 = postprocess_vi(tr2, text)
                        if normalize_compare(res2).rstrip(".") != normalize_compare(text).rstrip("."):
                            return res2
                return res
        except Exception:
            time.sleep(0.5 * (attempt + 1))

    # 3. MyMemory fallback
    try:
        tr = MyMemoryTranslator(source="en-GB", target="vi-VN").translate(cleaned)
        if tr and tr.strip():
            return postprocess_vi(tr.strip(), text)
    except Exception:
        pass

    return None


def translate_batch_chunk(items: List[str]) -> Dict[str, str]:
    global google_available
    if not items:
        return {}
    if len(items) == 1:
        res = translate_single(items[0])
        return {items[0]: res} if res else {}

    cleaned_items = [clean_dictionary_source(x) for x in items]

    # Try GoogleTranslator newline-joined if available
    if google_available:
        try:
            tr_blob = GoogleTranslator(source="en", target="vi").translate("\n".join(cleaned_items))
            if tr_blob:
                lines = [ln.strip() for ln in tr_blob.split("\n")]
                if len(lines) == len(items):
                    out: Dict[str, str] = {}
                    for orig, tr in zip(items, lines):
                        proc = postprocess_vi(tr, orig)
                        if proc and normalize_compare(proc).rstrip(".") != normalize_compare(orig).rstrip("."):
                            out[orig] = proc
                    if len(out) == len(items):
                        return out
        except Exception as e:
            if "TooManyRequests" in type(e).__name__ or "429" in str(e):
                with google_lock:
                    google_available = False

    # Primary fast path: Mozhi Neural with ` ||| ` delimiter
    payload = " ||| ".join(cleaned_items)
    for attempt in range(3):
        try:
            tr_blob = mozhi_translate_text(payload, timeout=20)
            if tr_blob:
                parts = [p.strip() for p in tr_blob.split("|||")]
                if len(parts) == len(items):
                    out = {}
                    retries: List[str] = []
                    for orig, tr in zip(items, parts):
                        proc = postprocess_vi(tr, orig)
                        if not proc or (
                            normalize_compare(proc).rstrip(".") == normalize_compare(orig).rstrip(".")
                            and len(orig.split()) >= 2
                        ):
                            retries.append(orig)
                        else:
                            out[orig] = proc
                    for orig in retries:
                        single_res = translate_single(orig)
                        if single_res:
                            out[orig] = single_res
                    return out
            break
        except Exception:
            time.sleep(0.5 * (attempt + 1))

    # Split cleanly in half if delimiter count mismatched
    mid = len(items) // 2
    left = translate_batch_chunk(items[:mid])
    right = translate_batch_chunk(items[mid:])
    left.update(right)
    return left


def make_batches(strings: List[str], max_items: int = 14, max_chars: int = 1250) -> List[List[str]]:
    batches: List[List[str]] = []
    cur: List[str] = []
    cur_len = 0
    for s in strings:
        s_len = len(s) + 5  # room for ' ||| '
        if cur and (len(cur) >= max_items or cur_len + s_len > max_chars):
            batches.append(cur)
            cur = [s]
            cur_len = s_len
        else:
            cur.append(s)
            cur_len += s_len
    if cur:
        batches.append(cur)
    return batches


def main() -> None:
    t0 = time.time()
    deck_files = sorted(
        f for f in VOCAB_DIR.glob("*.json") if f.name not in ("search-index.json", "index.json", "vocab-meta.json")
    )
    print(f"[1/4] Scanning {len(deck_files)} vocab deck files in {VOCAB_DIR}...")

    g_ok = probe_google_once()
    print(f"      Provider status: GoogleTranslator={'OK' if g_ok else '429-cooldown (using Mozhi Neural + MyMemory fallback)'}")

    cache = load_cache()
    print(f"      Loaded {len(cache):,} cached Vietnamese translations.")

    decks_data: List[Tuple[Path, dict]] = []
    to_translate: Set[str] = set()
    detected_counts = {
        "meaning": 0,
        "definitionVi": 0,
        "exampleVi": 0,
        "relationMeanings": 0,
        "wordFamily": 0,
        "collocations": 0,
    }

    for path in deck_files:
        deck = json.loads(path.read_text(encoding="utf-8"))
        decks_data.append((path, deck))
        for topic in deck.get("topics", []):
            for w in topic.get("words", []):
                word_txt = (w.get("word") or "").strip()

                if is_untranslated_vi(w.get("meaning", ""), word_txt, strict_short=True):
                    detected_counts["meaning"] += 1
                    src = f"to {word_txt}" if w.get("pos") == "v" else word_txt
                    if src and src not in cache:
                        to_translate.add(src)

                def_en = (w.get("definitionEn") or "").strip()
                def_vi = (w.get("definitionVi") or "").strip()
                if def_en and is_untranslated_vi(def_vi, def_en):
                    detected_counts["definitionVi"] += 1
                    if def_en not in cache:
                        to_translate.add(def_en)

                for ex in w.get("examples") or []:
                    ex_en = (ex.get("en") or "").strip()
                    ex_vi = (ex.get("vi") or "").strip()
                    if ex_en and is_untranslated_vi(ex_vi, ex_en):
                        detected_counts["exampleVi"] += 1
                        if ex_en not in cache:
                            to_translate.add(ex_en)

                rel_map = w.get("relationMeanings") or {}
                if isinstance(rel_map, dict):
                    for rel_word, rel_vi in rel_map.items():
                        if is_untranslated_vi(rel_vi, rel_word, strict_short=True):
                            detected_counts["relationMeanings"] += 1
                            if rel_word not in cache:
                                to_translate.add(rel_word)

                for wf in w.get("wordFamily") or []:
                    if isinstance(wf, dict):
                        wf_w = (wf.get("word") or "").strip()
                        wf_m = (wf.get("meaning") or "").strip()
                        if wf_w and is_untranslated_vi(wf_m, wf_w, strict_short=True):
                            detected_counts["wordFamily"] += 1
                            src = f"to {wf_w}" if wf.get("pos") == "v" else wf_w
                            if src not in cache:
                                to_translate.add(src)

                for col in w.get("collocations") or []:
                    if isinstance(col, dict):
                        ph = (col.get("phrase") or "").strip()
                        cm = (col.get("meaning") or "").strip()
                        if ph and is_untranslated_vi(cm, ph, strict_short=True):
                            detected_counts["collocations"] += 1
                            if ph not in cache:
                                to_translate.add(ph)

    print(f"      Detected untranslated fields: {detected_counts}")
    missing_list = sorted(to_translate)
    print(f"[2/4] Unique strings needing fresh translation: {len(missing_list):,}")

    if missing_list:
        batches = make_batches(missing_list, max_items=14, max_chars=1200)
        print(f"      Translating {len(missing_list):,} strings in {len(batches)} batches (4 workers)...")
        lock = threading.Lock()
        done_batches = 0
        translated_now = 0

        def worker(batch: List[str]) -> Dict[str, str]:
            res = translate_batch_chunk(batch)
            time.sleep(0.12)
            return res

        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {pool.submit(worker, b): b for b in batches}
            for fut in as_completed(futures):
                batch_res = fut.result()
                with lock:
                    for k, v in batch_res.items():
                        if v and v.strip():
                            cache[k] = v.strip()
                            translated_now += 1
                    done_batches += 1
                    if done_batches % 15 == 0 or done_batches == len(batches):
                        save_cache(cache)
                        elapsed = time.time() - t0
                        print(
                            f"      Progress: {done_batches}/{len(batches)} batches "
                            f"({translated_now:,}/{len(missing_list):,} translated, {elapsed:.1f}s)"
                        )
        save_cache(cache)

    print("[3/4] Writing updated Vietnamese translations back to all 16 decks...")
    applied = {
        "meaning": 0,
        "definitionVi": 0,
        "exampleVi": 0,
        "relationMeanings": 0,
        "wordFamily": 0,
        "collocations": 0,
    }
    remaining = {
        "meaning": 0,
        "definitionVi": 0,
        "exampleVi": 0,
        "relationMeanings": 0,
    }
    search_rows = []
    contender_sample = None

    for path, deck in decks_data:
        deck_modified = False
        for topic in deck.get("topics", []):
            for w in topic.get("words", []):
                word_txt = (w.get("word") or "").strip()

                if is_untranslated_vi(w.get("meaning", ""), word_txt, strict_short=True):
                    src = f"to {word_txt}" if w.get("pos") == "v" else word_txt
                    tr = cache.get(src) or cache.get(word_txt)
                    if tr and not is_untranslated_vi(tr, word_txt, strict_short=True):
                        w["meaning"] = tr
                        applied["meaning"] += 1
                        deck_modified = True
                    else:
                        remaining["meaning"] += 1

                def_en = (w.get("definitionEn") or "").strip()
                def_vi = (w.get("definitionVi") or "").strip()
                if def_en and is_untranslated_vi(def_vi, def_en):
                    tr = cache.get(def_en)
                    if tr and normalize_compare(tr).rstrip(".") != normalize_compare(def_en).rstrip("."):
                        w["definitionVi"] = tr
                        applied["definitionVi"] += 1
                        deck_modified = True
                    else:
                        remaining["definitionVi"] += 1

                for ex in w.get("examples") or []:
                    ex_en = (ex.get("en") or "").strip()
                    ex_vi = (ex.get("vi") or "").strip()
                    if ex_en and is_untranslated_vi(ex_vi, ex_en):
                        tr = cache.get(ex_en)
                        if tr and normalize_compare(tr).rstrip(".") != normalize_compare(ex_en).rstrip("."):
                            ex["vi"] = tr
                            applied["exampleVi"] += 1
                            deck_modified = True
                        else:
                            remaining["exampleVi"] += 1

                rel_map = w.get("relationMeanings") or {}
                if isinstance(rel_map, dict):
                    for rel_word, rel_vi in list(rel_map.items()):
                        if is_untranslated_vi(rel_vi, rel_word, strict_short=True):
                            tr = cache.get(rel_word)
                            if tr and normalize_compare(tr) != normalize_compare(rel_word):
                                rel_map[rel_word] = tr
                                applied["relationMeanings"] += 1
                                deck_modified = True
                            else:
                                remaining["relationMeanings"] += 1

                for wf in w.get("wordFamily") or []:
                    if isinstance(wf, dict):
                        wf_w = (wf.get("word") or "").strip()
                        wf_m = (wf.get("meaning") or "").strip()
                        if wf_w and is_untranslated_vi(wf_m, wf_w, strict_short=True):
                            src = f"to {wf_w}" if wf.get("pos") == "v" else wf_w
                            tr = cache.get(src) or cache.get(wf_w)
                            if tr and normalize_compare(tr) != normalize_compare(wf_w):
                                wf["meaning"] = tr
                                applied["wordFamily"] += 1
                                deck_modified = True

                for col in w.get("collocations") or []:
                    if isinstance(col, dict):
                        ph = (col.get("phrase") or "").strip()
                        cm = (col.get("meaning") or "").strip()
                        if ph and is_untranslated_vi(cm, ph, strict_short=True):
                            tr = cache.get(ph)
                            if tr and normalize_compare(tr) != normalize_compare(ph):
                                col["meaning"] = tr
                                applied["collocations"] += 1
                                deck_modified = True

                if word_txt.lower() == "contender" and contender_sample is None:
                    contender_sample = (path.name, w)

                search_rows.append(
                    {
                        "id": w["id"],
                        "word": w["word"],
                        "meaningVi": w["meaning"],
                        "ipaUS": w.get("ipaUS", ""),
                        "partOfSpeech": w.get("pos", "n"),
                        "deckId": w.get("deckId", deck["id"]),
                    }
                )

        if deck_modified:
            path.write_text(json.dumps(deck, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    search_index_path = VOCAB_DIR / "search-index.json"
    search_index_path.write_text(
        json.dumps(search_rows, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    elapsed = time.time() - t0
    print(f"[4/4] Done in {elapsed:.1f}s!")
    print("      Applied translations:", json.dumps(applied, ensure_ascii=False))
    print("      Remaining untranslated:", json.dumps(remaining, ensure_ascii=False))
    print(f"      Synced search-index.json with {len(search_rows):,} entries.")
    if contender_sample:
        print(f"\n=== SAMPLE VERIFICATION: 'contender' ({contender_sample[0]}) ===")
        print(json.dumps(contender_sample[1], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
