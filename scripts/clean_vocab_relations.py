#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/clean_vocab_relations.py
================================
Scans all 16 vocab deck JSON files in public/data/vocab/ and search-index.json to:
1. Fix headword meanings that repeat the English word verbatim or have off-context TOEIC meanings.
2. Clean & translate all wordFamily[].meaning entries from raw English/WordNet prose into concise Vietnamese.
3. Build clean Vietnamese glosses (`relationMeanings`) for 100% of `synonyms` and `antonyms`,
   prioritizing internal TOEIC/Oxford decks first and translating missing terms via deep-translator
   with persistent caching in scripts/cache/vi_gloss_cache.json.
4. Remove any unresolvable junk entries so 100% of relations have clean, natural Vietnamese meanings.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
VOCAB_DIR = ROOT / "public" / "data" / "vocab"
CACHE_DIR = ROOT / "scripts" / "cache"
CACHE_PATH = CACHE_DIR / "vi_gloss_cache.json"

VI_DIACRITIC_RE = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
    re.I,
)

# Priority order when sourcing clean Vietnamese meanings from our internal 10,996-word bank
DECK_PRIORITY = [
    "toeic-600",
    "toeic-ets",
    "topic-business",
    "toeic-idioms",
    "common-1000",
    "communication-daily",
    "oxford-3000-a1",
    "oxford-3000-a2",
    "oxford-3000-b1",
    "oxford-3000-b2",
    "oxford-5000-b2",
    "oxford-5000-c1",
    "ielts-core",
    "toefl-essential",
    "sat-core",
    "thpt-qg",
]

# Curated high-priority TOEIC / Business English Vietnamese glosses
# Overrides notoriously ambiguous/mistranslated words (e.g. deal != "Chia bài")
CURATED_TOEIC_GLOSSES: Dict[str, str] = {
    "agreement": "hợp đồng, thỏa thuận",
    "contract": "hợp đồng, giao kèo",
    "accord": "hiệp định, sự đồng thuận",
    "deal": "thỏa thuận, giao dịch; giải quyết",
    "settlement": "sự thỏa thuận, giải quyết; thanh toán",
    "concurrence": "sự đồng thuận, nhất trí",
    "dispute": "tranh chấp, bất đồng",
    "disagreement": "sự bất đồng, bất hòa",
    "comply with": "tuân thủ theo",
    "adhere to": "tuân theo, bám sát",
    "obey": "tuân lệnh, tuân thủ",
    "violate": "vi phạm",
    "breach": "vi phạm (hợp đồng, quy định)",
    "assurance": "sự cam đoan, bảo đảm",
    "guarantee": "sự bảo hành, bảo đảm",
    "pledge": "lời cam kết, hứa hẹn",
    "promise": "lời hứa, cam kết",
    "doubt": "sự nghi ngờ",
    "uncertainty": "sự không chắc chắn",
    "cancellation": "sự hủy bỏ",
    "termination": "sự chấm dứt (hợp đồng)",
    "revocation": "sự thu hồi, hủy bỏ",
    "confirmation": "sự xác nhận",
    "booking": "việc đặt chỗ, đặt trước",
    "interest": "lãi suất; lợi ích; sự quan tâm",
    "bill": "hóa đơn; dự luật",
    "charge": "phí, mức giá; tính phí; phụ trách",
    "issue": "vấn đề; phát hành, cấp phát",
    "order": "đơn đặt hàng; mệnh lệnh; trật tự",
    "plant": "nhà máy, phân xưởng; cây trồng",
    "stock": "hàng tồn kho; cổ phiếu",
    "balance": "số dư tài khoản; sự cân bằng",
    "branch": "chi nhánh; nhánh",
    "file": "hồ sơ, tệp; nộp (đơn, hồ sơ)",
    "firm": "công ty, hãng; vững chắc, kiên quyết",
    "launch": "ra mắt, tung ra (sản phẩm)",
    "lead": "dẫn dắt, dẫn đầu; khách hàng tiềm năng",
    "minute": "phút; biên bản cuộc họp (minutes)",
    "minutes": "biên bản cuộc họp",
    "board": "hội đồng quản trị; bảng; lên (tàu/máy bay)",
    "chair": "chủ tọa, chủ tịch; ghế",
    "draft": "bản thảo, bản nháp; soạn thảo",
    "post": "chức vụ, vị trí; đăng tải; bưu điện",
    "quote": "báo giá; trích dẫn",
    "rate": "mức giá, tỷ lệ; đánh giá",
    "raise": "sự tăng lương; nâng lên, huy động (vốn)",
    "share": "cổ phần, thị phần; chia sẻ",
    "ship": "vận chuyển, giao hàng; con tàu",
    "shift": "ca làm việc; sự chuyển dịch",
    "store": "cửa hàng; lưu trữ, cất giữ",
    "term": "điều khoản; thời hạn, nhiệm kỳ",
    "track": "theo dõi, giám sát; đường ray",
    "yield": "lợi suất, sản lượng; mang lại",
    "account": "tài khoản; bản báo cáo; giải thích",
    "address": "giải quyết (vấn đề); địa chỉ; phát biểu",
    "check": "kiểm tra; tấm séc; hóa đơn",
    "claim": "yêu cầu bồi thường; tuyên bố, khẳng định",
    "cover": "chi trả, bao gồm; trang bìa",
    "credit": "tín dụng; ghi nhận công lao",
    "custom": "phong tục; tùy chỉnh theo yêu cầu",
    "customs": "hải quan",
    "deposit": "tiền đặt cọc, tiền gửi; đặt cọc",
    "due": "đến hạn (thanh toán, nộp bài)",
    "engage": "thu hút, tham gia; thuê mướn",
    "execute": "thực thi, triển khai (kế hoạch/hợp đồng)",
    "facility": "cơ sở vật chất, nhà máy, tiện nghi",
    "figure": "con số, số liệu; nhân vật",
    "fine": "tiền phạt; phạt tiền; tốt đẹp",
    "forward": "chuyển tiếp; hướng về phía trước",
    "fund": "quỹ, nguồn vốn; tài trợ",
    "grant": "khoản trợ cấp; cấp cho, chấp thuận",
    "handle": "xử lý, phụ trách",
    "hold": "tổ chức (sự kiện); nắm giữ; chờ máy",
    "lease": "hợp đồng thuê; cho thuê / thuê",
    "leave": "kỳ nghỉ phép; rời đi",
    "line": "dòng sản phẩm; đường dây; hàng ngũ",
    "lot": "lô hàng, bãi đỗ xe; rất nhiều",
    "margin": "biên lợi nhuận; lề",
    "match": "khớp, phù hợp; đối xứng",
    "matter": "vấn đề, sự việc; quan trọng",
    "means": "phương tiện, nguồn lực tài chính",
    "meet": "đáp ứng (yêu cầu, hạn chót); gặp gỡ",
    "note": "ghi chú; lưu ý, nhận thấy",
    "notice": "thông báo; sự chú ý, nhận thấy",
    "offer": "đề nghị, ưu đãi; cung cấp",
    "outlet": "cửa hàng đại lý; ổ cắm điện",
    "overhead": "chi phí vận hành cố định",
    "party": "bên (tham gia hợp đồng); bữa tiệc",
    "pitch": "bài chào hàng, thuyết trình gọi vốn",
    "premium": "phí bảo hiểm; cao cấp, thượng hạng",
    "press": "báo chí, truyền thông; nhấn, thúc ép",
    "proceeds": "tiền thu được (từ bán hàng/sự kiện)",
    "provision": "điều khoản; sự cung cấp",
    "quarter": "quý (3 tháng tài chính); một phần tư",
    "receipt": "biên lai, hóa đơn; sự tiếp nhận",
    "record": "hồ sơ, kỷ lục; ghi chép, ghi âm",
    "refer": "giới thiệu, tham khảo, đề cập đến",
    "refund": "tiền hoàn lại; hoàn tiền",
    "release": "phát hành, công bố; sự giải phóng",
    "remit": "chuyển tiền thanh toán",
    "reserve": "đặt trước; khoản dự trữ",
    "resolve": "giải quyết dứt điểm; nghị quyết",
    "retain": "giữ chân (nhân sự/khách hàng), duy trì",
    "return": "lợi nhuận thu về; sự trở lại, trả hàng",
    "revenue": "doanh thu",
    "run": "vận hành, điều hành; chạy",
    "scale": "quy mô; mở rộng quy mô",
    "schedule": "lịch trình; lên lịch",
    "secure": "đạt được, bảo đảm; an toàn",
    "settle": "giải quyết, thanh toán, dàn xếp",
    "shortage": "sự thiếu hụt",
    "spot": "địa điểm, vị trí; phát hiện ra",
    "staff": "đội ngũ nhân viên; bố trí nhân sự",
    "stake": "cổ phần, quyền lợi liên quan",
    "stand": "gian hàng triển lãm; đứng vững",
    "statement": "bản sao kê, bản tuyên bố",
    "subject": "chủ đề; chịu sự chi phối của (subject to)",
    "submit": "nộp, đệ trình",
    "suit": "phù hợp; bộ vest; vụ kiện",
    "supply": "nguồn cung, vật tư; cung cấp",
    "surplus": "thặng dư, lượng dư thừa",
    "suspend": "tạm đình chỉ, tạm hoãn",
    "tender": "hồ sơ dự thầu; đề xuất chính thức",
    "turnover": "doanh số; tỷ lệ luân chuyển nhân sự",
    "utility": "dịch vụ tiện ích (điện, nước, gas)",
    "venture": "dự án liên doanh, dự án mạo hiểm",
    "venue": "địa điểm tổ chức sự kiện",
    "voucher": "phiếu giảm giá, chứng từ thanh toán",
    "waive": "miễn trừ (phí, điều kiện)",
    "warranty": "giấy bảo hành, chế độ bảo hành",
    "wholesale": "bán buôn, bán sỉ",
    "withdraw": "rút tiền; rút lui, thu hồi",
}

OFF_CONTEXT_MEANINGS = {
    "chia bài",
    "chia bai",
}

# Short valid Vietnamese words without diacritics (so we don't falsely flag them as untranslated English)
VALID_ASCII_VI = {
    "phim", "logic", "chung", "trang web", "chia", "vay", "suy ra", "kho", "pin", "ngon",
    "thang", "cabin", "taxi", "video", "radio", "menu", "email", "internet", "online",
    "marketing", "studio", "album", "camera", "sofa", "salad", "pizza", "robot", "radar",
    "laser", "metro", "virus", "vitamin", "piano", "guitar", "cafe", "golf", "tennis",
    "karaoke", "yoga", "spa", "bar", "club", "blog", "app", "web", "wifi", "sim", "usb",
    "xe", "nha", "ban", "cho", "mua", "xem", "nghe", "noi", "lam", "di", "ra", "vao",
    "len", "con", "co", "hay", "nho", "cao", "nhanh", "moi", "tot", "sai", "quen",
    "an", "hoc", "doc", "hat", "vui", "lo", "tin", "can", "nen", "do", "vi", "theo",
    "voi", "trong", "ngoai", "tren", "sau", "ben", "gan", "xa", "nay", "sao", "khi",
    "ngay", "sang", "trua", "toi", "nam", "mua", "xuan", "ha", "thu", "may", "nang",
    "song", "cay", "hoa", "la", "qua", "hat", "nguoi", "phong", "tu", "den", "tau",
    "cho", "cong", "hang", "quan", "the", "gia", "phi", "von", "lai", "so", "don",
    "sach", "bao", "anh", "nhac", "thi", "muc", "phan", "bo", "doi", "nganh", "viec",
    "luat", "le", "quy", "ke", "du", "he", "mang", "bai", "cau", "chu", "cach", "ky",
    "khoa", "y", "giao", "kinh", "tai", "van", "du", "an", "quoc", "cung", "chi", "tra",
    "xin", "thu", "goi", "gui", "nhan", "mo", "dong", "bat", "tat", "tang", "giam",
    "doi", "sua", "xoa", "them", "chon", "loc", "tim", "xep", "chay", "bay", "boi",
    "in", "luu", "tai", "phat", "dung", "tiep", "lui", "quay", "xoay", "keo", "day",
    "nang", "ha", "cat", "dan", "gop", "tach", "chia", "nhan", "cong", "tru", "tinh",
}

ENGLISH_STOPWORDS = {
    "the", "of", "to", "a", "an", "in", "on", "for", "with", "that", "which", "who",
    "someone", "something", "relating", "having", "capable", "being", "act", "quality",
    "state", "person", "place", "process", "make", "become", "cause", "without", "not",
    "or", "and", "from", "into", "by", "as", "is", "are", "be", "used", "using",
}


def normalize_key(word: str) -> str:
    return re.sub(r"\s+", " ", (word or "").strip().lower())


def is_english_definition_or_repeat(meaning: str, word: str) -> bool:
    """Return True if `meaning` is empty, repeats `word`, is off-context, or looks like English prose."""
    m = (meaning or "").strip()
    w = normalize_key(word)
    if not m:
        return True
    ml = normalize_key(m)
    if ml in OFF_CONTEXT_MEANINGS:
        return True
    # Direct repeat of English word (ignoring simple punctuation/brackets)
    clean_ml = re.sub(r"[^a-z0-9\s-]", "", ml).strip()
    clean_w = re.sub(r"[^a-z0-9\s-]", "", w).strip()
    if clean_ml == clean_w and clean_ml not in VALID_ASCII_VI:
        return True
    # Strip optional POS prefix like "[n] ..."
    m_no_pos = re.sub(r"^\[[^\]]+\]\s*", "", m).strip()
    if normalize_key(m_no_pos) == w and normalize_key(m_no_pos) not in VALID_ASCII_VI:
        return True

    # If it has Vietnamese diacritics, it's Vietnamese (unless mixed with huge English WordNet text)
    if VI_DIACRITIC_RE.search(m):
        return False

    # Pure ASCII without Vietnamese diacritics:
    # Check if it's a known valid short ASCII Vietnamese word/phrase
    tokens = re.findall(r"[a-z]+", ml)
    if not tokens:
        return True
    if ml in VALID_ASCII_VI:
        return False
    # If >= 2 tokens and contains English stopwords or matches word root -> definitely English WordNet def!
    if any(t in ENGLISH_STOPWORDS for t in tokens):
        return True
    # Single ASCII word not in VALID_ASCII_VI -> very likely untranslated English word
    if len(tokens) == 1 and tokens[0] not in VALID_ASCII_VI:
        return True
    # Multi-word ASCII phrase where words aren't known Vietnamese words
    vi_token_hits = sum(1 for t in tokens if t in VALID_ASCII_VI)
    if vi_token_hits < max(1, len(tokens) * 0.6):
        return True
    return False


def clean_gloss_text(text: str) -> str:
    t = re.sub(r"\s+", " ", (text or "").strip())
    # Strip trailing period and stray quotes
    t = t.strip(" \"'“”‘’.")
    # Strip common contextual wrapper artifacts from fallback translations
    for prefix in [
        "khái niệm về ",
        "khái niệm ",
        "nghĩa của ",
        "ý nghĩa của ",
        "từ ",
        "một ",
        "rất ",
        "hành động ",
    ]:
        if t.lower().startswith(prefix) and len(t) > len(prefix) + 2:
            t = t[len(prefix):].strip()
    # Lowercase first letter for natural glossary consistency (unless proper noun/acronym)
    if len(t) >= 2 and t[0].isupper() and t[1].islower():
        t = t[0].lower() + t[1:]
    return t


def load_cache() -> Dict[str, str]:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(cache: Dict[str, str]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _gtx_translate_text(text: str) -> str:
    """Fast, polite Google Translate POST request (with deep-translator fallback)."""
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t"
    body = urllib.parse.urlencode({"q": text}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return "".join(seg[0] for seg in payload[0] if seg and seg[0])


def _parse_numbered_lines(translated: str, items: List[str]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for ln in translated.splitlines():
        m = re.match(r"^\s*(\d+)\s*[\.\):\-]\s*(.+?)\s*$", ln)
        if not m:
            continue
        idx = int(m.group(1)) - 1
        if 0 <= idx < len(items):
            out[items[idx]] = clean_gloss_text(m.group(2))
    # Fallback positional match if exact line count matches
    if len(out) < len(items) * 0.8:
        lines = [ln.strip() for ln in translated.splitlines() if ln.strip()]
        if len(lines) == len(items):
            for orig, tr in zip(items, lines):
                tr_clean = re.sub(r"^\s*\d+\s*[\.\):\-]\s*", "", tr)
                out[orig] = clean_gloss_text(tr_clean)
    return out


def translate_chunk(items: List[str], contextual: bool = False) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not items:
        return out

    if not contextual:
        payload = "\n".join(f"{i + 1}. {w}" for i, w in enumerate(items))
    else:
        payload = "\n".join(f"{i + 1}. the concept of {w}" for i, w in enumerate(items))

    for attempt in range(4):
        try:
            res = _gtx_translate_text(payload)
            parsed = _parse_numbered_lines(res, items)
            if parsed:
                if contextual:
                    for k, v in parsed.items():
                        v2 = re.sub(
                            r"\s+(một cái gì đó|cái gì đó|điều gì đó|thứ gì đó)$",
                            "",
                            v,
                            flags=re.I,
                        ).strip()
                        if not is_english_definition_or_repeat(v2, k):
                            out[k] = v2
                else:
                    out.update(parsed)
                time.sleep(0.18)
                return out
        except Exception:
            time.sleep(1.2 * (attempt + 1))

    # Fallback via deep-translator if gtx temporarily throttled
    try:
        from deep_translator import GoogleTranslator

        tr = GoogleTranslator(source="en", target="vi")
        res = tr.translate(payload)
        if res:
            parsed = _parse_numbered_lines(res, items)
            for k, v in parsed.items():
                if not contextual or not is_english_definition_or_repeat(v, k):
                    out[k] = v
    except Exception:
        pass
    return out


def main():
    print("[1/5] Loading all 16 vocab decks and search-index.json...")
    deck_files = sorted(
        p for p in VOCAB_DIR.glob("*.json") if p.name not in ("index.json", "search-index.json")
    )
    decks: Dict[str, Tuple[Path, dict]] = {}
    for p in deck_files:
        decks[p.stem] = (p, json.loads(p.read_text(encoding="utf-8")))

    # Step 1: Build Priority-1 clean internal Vietnamese glossary from our 10,996-word bank
    internal_gloss: Dict[str, str] = dict(CURATED_TOEIC_GLOSSES)
    ordered_deck_ids = [d for d in DECK_PRIORITY if d in decks] + [
        d for d in decks if d not in DECK_PRIORITY
    ]
    for dk in ordered_deck_ids:
        _, data = decks[dk]
        for topic in data.get("topics", []):
            for w in topic.get("words", []):
                key = normalize_key(w.get("word", ""))
                meaning = re.sub(r"^\[[^\]]+\]\s*", "", (w.get("meaning") or "").strip()).strip()
                if key and key not in internal_gloss and not is_english_definition_or_repeat(meaning, key):
                    internal_gloss[key] = meaning

    print(f"    Internal clean Vietnamese glossary (incl. TOEIC curated): {len(internal_gloss)} terms")

    # Step 2: Collect all terms that need translation (headwords, synonyms, antonyms, wordFamily)
    cache = load_cache()
    # Pre-seed clean entries from scripts/cache/vi_translations.json if present
    legacy_cache_path = CACHE_DIR / "vi_translations.json"
    if legacy_cache_path.exists():
        try:
            legacy = json.loads(legacy_cache_path.read_text(encoding="utf-8"))
            if isinstance(legacy, dict):
                for lk, lv in legacy.items():
                    if isinstance(lk, str) and isinstance(lv, str):
                        nk = normalize_key(lk)
                        if len(nk.split()) <= 3 and nk not in cache and not is_english_definition_or_repeat(lv, nk):
                            cache[nk] = clean_gloss_text(lv)
        except Exception:
            pass
    # Apply curated overrides into cache too
    for k, v in CURATED_TOEIC_GLOSSES.items():
        cache[k] = v

    terms_needed: Set[str] = set()
    for dk, (_, data) in decks.items():
        for topic in data.get("topics", []):
            for w in topic.get("words", []):
                hw = normalize_key(w.get("word", ""))
                hm = re.sub(r"^\[[^\]]+\]\s*", "", (w.get("meaning") or "").strip()).strip()
                if hw and (hw in CURATED_TOEIC_GLOSSES or is_english_definition_or_repeat(hm, hw)):
                    if hw not in internal_gloss and (hw not in cache or is_english_definition_or_repeat(cache[hw], hw)):
                        terms_needed.add(hw)

                for rel in list(w.get("synonyms", [])) + list(w.get("antonyms", [])):
                    rk = normalize_key(rel)
                    if rk and rk not in internal_gloss and (rk not in cache or is_english_definition_or_repeat(cache[rk], rk)):
                        terms_needed.add(rk)

                for wf in w.get("wordFamily", []):
                    wk = normalize_key(wf.get("word", ""))
                    wm = (wf.get("meaning") or "").strip()
                    if wk and (wk in CURATED_TOEIC_GLOSSES or is_english_definition_or_repeat(wm, wk)):
                        if wk not in internal_gloss and (wk not in cache or is_english_definition_or_repeat(cache[wk], wk)):
                            terms_needed.add(wk)

    sorted_needed = sorted(terms_needed)
    print(f"[2/5] Unique terms needing translation lookup: {len(sorted_needed)} (cached: {len(cache)})")

    if sorted_needed:
        batch_size = 100
        batches = [sorted_needed[i : i + batch_size] for i in range(0, len(sorted_needed), batch_size)]
        done_batches = 0
        with ThreadPoolExecutor(max_workers=2) as ex:
            futures = {ex.submit(translate_chunk, b, False): b for b in batches}
            for fut in as_completed(futures):
                res = fut.result()
                cache.update(res)
                done_batches += 1
                if done_batches % 10 == 0 or done_batches == len(batches):
                    print(f"    Pass 1 translated {done_batches}/{len(batches)} batches (cache={len(cache)})...")
                    save_cache(cache)

        # Contextual retry pass for any term that came back repeated in English
        retry_terms = [
            t for t in sorted_needed if t not in cache or is_english_definition_or_repeat(cache[t], t)
        ]
        print(f"    Pass 2 (contextual retry) for {len(retry_terms)} stubborn terms...")
        if retry_terms:
            retry_batches = [retry_terms[i : i + 60] for i in range(0, len(retry_terms), 60)]
            done_retry = 0
            with ThreadPoolExecutor(max_workers=2) as ex:
                futures = {ex.submit(translate_chunk, b, True): b for b in retry_batches}
                for fut in as_completed(futures):
                    res = fut.result()
                    cache.update(res)
                    done_retry += 1
                    if done_retry % 10 == 0 or done_retry == len(retry_batches):
                        print(f"    Pass 2 completed {done_retry}/{len(retry_batches)} batches...")
                        save_cache(cache)

        save_cache(cache)

    def resolve_meaning(term: str, current_meaning: str = "") -> Optional[str]:
        k = normalize_key(term)
        if not k:
            return None
        if k in CURATED_TOEIC_GLOSSES:
            return CURATED_TOEIC_GLOSSES[k]
        if k in internal_gloss:
            return internal_gloss[k]
        if current_meaning and not is_english_definition_or_repeat(current_meaning, k):
            return current_meaning.strip()
        cached = cache.get(k, "")
        if cached and not is_english_definition_or_repeat(cached, k):
            return cached
        return None

    # Step 3: Clean all 16 deck JSON files & collect statistics
    print("[3/5] Applying clean Vietnamese meanings across all 16 vocab decks...")
    stats = {
        "headwords_fixed_repeat": 0,
        "headwords_fixed_off_context": 0,
        "wf_fixed_en_or_repeat": 0,
        "wf_removed_junk": 0,
        "rel_meanings_populated": 0,
        "rel_removed_junk": 0,
    }

    search_index_rows: List[dict] = []

    for dk in sorted(decks.keys()):
        p, data = decks[dk]
        for topic in data.get("topics", []):
            for w in topic.get("words", []):
                hw = w["word"]
                hw_key = normalize_key(hw)
                raw_m = (w.get("meaning") or "").strip()
                clean_m_no_pos = re.sub(r"^\[[^\]]+\]\s*", "", raw_m).strip()

                # Fix headword meaning if repeated English or off-context TOEIC
                if hw_key in CURATED_TOEIC_GLOSSES:
                    if normalize_key(clean_m_no_pos) in OFF_CONTEXT_MEANINGS or is_english_definition_or_repeat(clean_m_no_pos, hw):
                        if normalize_key(clean_m_no_pos) in OFF_CONTEXT_MEANINGS:
                            stats["headwords_fixed_off_context"] += 1
                        else:
                            stats["headwords_fixed_repeat"] += 1
                        w["meaning"] = CURATED_TOEIC_GLOSSES[hw_key]
                elif is_english_definition_or_repeat(clean_m_no_pos, hw):
                    resolved_hw = resolve_meaning(hw)
                    if resolved_hw:
                        w["meaning"] = resolved_hw
                        stats["headwords_fixed_repeat"] += 1

                # Clean wordFamily
                new_wf = []
                seen_wf = set()
                for wf in w.get("wordFamily", []):
                    wf_word = (wf.get("word") or "").strip()
                    wf_key = normalize_key(wf_word)
                    if not wf_key or wf_key in seen_wf:
                        continue
                    old_wm = (wf.get("meaning") or "").strip()
                    needs_fix = wf_key in CURATED_TOEIC_GLOSSES or is_english_definition_or_repeat(old_wm, wf_word)
                    if needs_fix:
                        resolved_wf = resolve_meaning(wf_word)
                        if resolved_wf:
                            new_wf.append({
                                "word": wf_word,
                                "pos": (wf.get("pos") or "n").strip(),
                                "meaning": resolved_wf,
                            })
                            seen_wf.add(wf_key)
                            if resolved_wf != old_wm:
                                stats["wf_fixed_en_or_repeat"] += 1
                        else:
                            stats["wf_removed_junk"] += 1
                    else:
                        new_wf.append({
                            "word": wf_word,
                            "pos": (wf.get("pos") or "n").strip(),
                            "meaning": old_wm,
                        })
                        seen_wf.add(wf_key)
                w["wordFamily"] = new_wf

                # Clean synonyms & antonyms + populate relationMeanings
                rel_meanings: Dict[str, str] = {}
                clean_syns: List[str] = []
                seen_syn = set()
                for s in w.get("synonyms", []):
                    if not isinstance(s, str):
                        continue
                    s_clean = s.strip()
                    sk = normalize_key(s_clean)
                    if not sk or sk == hw_key or sk in seen_syn:
                        continue
                    gm = resolve_meaning(s_clean)
                    if gm:
                        clean_syns.append(s_clean)
                        rel_meanings[sk] = gm
                        seen_syn.add(sk)
                        stats["rel_meanings_populated"] += 1
                    else:
                        stats["rel_removed_junk"] += 1

                clean_ants: List[str] = []
                seen_ant = set()
                for a in w.get("antonyms", []):
                    if not isinstance(a, str):
                        continue
                    a_clean = a.strip()
                    ak = normalize_key(a_clean)
                    if not ak or ak == hw_key or ak in seen_ant:
                        continue
                    gm = resolve_meaning(a_clean)
                    if gm:
                        clean_ants.append(a_clean)
                        rel_meanings[ak] = gm
                        seen_ant.add(ak)
                        stats["rel_meanings_populated"] += 1
                    else:
                        stats["rel_removed_junk"] += 1

                w["synonyms"] = clean_syns
                w["antonyms"] = clean_ants
                if rel_meanings:
                    w["relationMeanings"] = rel_meanings
                elif "relationMeanings" in w:
                    del w["relationMeanings"]

                # Collect rebuilt search-index entry
                final_meaning = re.sub(r"^\[[^\]]+\]\s*", "", (w.get("meaning") or "").strip()).strip()
                search_index_rows.append({
                    "id": w["id"],
                    "word": w["word"],
                    "meaningVi": final_meaning,
                    "ipaUS": w.get("ipaUS", ""),
                    "partOfSpeech": w.get("pos", "n"),
                    "deckId": w["deckId"],
                })

        # Keep flat `words` array in sync if present in JSON
        if "words" in data and isinstance(data["words"], list):
            data["words"] = [w for t in data.get("topics", []) for w in t.get("words", [])]

        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Step 4: Write updated search-index.json sorted with TOEIC priority first so lookups prefer TOEIC meanings!
    print("[4/5] Rewriting public/data/vocab/search-index.json with TOEIC priority order...")
    deck_rank = {dk: idx for idx, dk in enumerate(DECK_PRIORITY)}
    search_index_rows.sort(key=lambda r: (deck_rank.get(r["deckId"], 99), r["id"]))
    (VOCAB_DIR / "search-index.json").write_text(
        json.dumps(search_index_rows, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    # Step 5: Print summary statistics & verify `agreement` sample JSON
    print("\n[5/5] CLEANING SUMMARY:")
    print(f"  • Headword meanings fixed (English repeat/empty): {stats['headwords_fixed_repeat']}")
    print(f"  • Headword meanings fixed (off-context TOEIC):    {stats['headwords_fixed_off_context']}")
    print(f"  • Word Family meanings cleaned/translated:        {stats['wf_fixed_en_or_repeat']}")
    print(f"  • Word Family junk removed:                       {stats['wf_removed_junk']}")
    print(f"  • Syn/Ant relationMeanings populated cleanly:     {stats['rel_meanings_populated']}")
    print(f"  • Unresolvable Syn/Ant junk removed:              {stats['rel_removed_junk']}")
    print(f"  • Total search-index.json rows rebuilt:           {len(search_index_rows)}")

    # Print sample `agreement` from toeic-600.json
    t600 = decks["toeic-600"][1]
    for topic in t600.get("topics", []):
        for w in topic.get("words", []):
            if normalize_key(w["word"]) == "agreement":
                print("\n=== SAMPLE VERIFICATION: `agreement` (toeic-600.json) ===")
                print(json.dumps({
                    "id": w["id"],
                    "word": w["word"],
                    "meaning": w["meaning"],
                    "wordFamily": w["wordFamily"],
                    "synonyms": w["synonyms"],
                    "antonyms": w["antonyms"],
                    "relationMeanings": w.get("relationMeanings", {}),
                }, ensure_ascii=False, indent=2))
                break


if __name__ == "__main__":
    main()
