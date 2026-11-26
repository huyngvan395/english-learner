#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/validate_data.py
========================
Automated integrity validator for TOEIC Mastery Hub JSON datasets,
Part 1 photographs, Reading evidence anchors, and Listening MP3 files.
"""

import json
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
DATA = ROOT / "src" / "data"

errors = []
warnings = []


def check(cond: bool, msg: str):
    if not cond:
        errors.append(msg)


def validate_vocab():
    vdir = PUBLIC / "data" / "vocab"
    search_idx_path = vdir / "search-index.json"
    check(search_idx_path.exists(), f"Missing search-index.json at {search_idx_path}")
    search_rows = json.loads(search_idx_path.read_text(encoding="utf-8"))

    deck_files = sorted(f for f in vdir.glob("*.json") if f.name not in ("index.json", "search-index.json"))
    check(len(deck_files) == 16, f"Expected 16 deck JSON files (incl. 6 Oxford CEFR), found {len(deck_files)}")

    total = 0
    seen_ids = set()
    for p in deck_files:
        deck = json.loads(p.read_text(encoding="utf-8"))
        for k in ["id", "title", "subtitle", "category", "levelLabel", "tags", "topics"]:
            check(k in deck and deck[k], f"Deck {p.stem} missing field {k}")
        words = [w for t in deck.get("topics", []) for w in t.get("words", [])]
        check(len(words) == deck.get("wordCount", len(words)), f"Deck {p.stem} wordCount mismatch")
        for t in deck.get("topics", []):
            check(bool(t.get("id")) and bool(t.get("name")) and bool(t.get("words")), f"Deck {p.stem} has invalid topic {t.get('id')}")
        for w in words:
            total += 1
            check(w["id"] not in seen_ids, f"Duplicate word id: {w['id']}")
            seen_ids.add(w["id"])
            for fk in ["id", "deckId", "word", "pos", "ipaUK", "ipaUS", "meaning", "definitionEn", "definitionVi", "examples"]:
                check(fk in w and bool(w[fk]), f"Word {w.get('id')} missing {fk}")
            check(len(w["examples"]) >= 1 and w["examples"][0]["en"] and w["examples"][0]["vi"], f"Word {w['id']} incomplete bilingual example")
            pattern = r"(?i)(?<!\w)" + re.escape(w["word"]) + r"(?!\w)"
            check(bool(re.search(pattern, w["examples"][0]["en"])), f"Word {w['id']} ('{w['word']}') not matched verbatim in exampleEn: {w['examples'][0]['en']}")

    check(len(search_rows) == total, f"search-index.json count ({len(search_rows)}) != total vocab words ({total})")
    print(f"[Vocab Audit] Checked {len(deck_files)} lazy-loaded decks in public/data/vocab/, {total} words, and search-index.json.")


def validate_reading():
    rdir = DATA / "reading"
    p5 = json.loads((rdir / "test1_part5.json").read_text(encoding="utf-8"))
    p6 = json.loads((rdir / "test1_part6.json").read_text(encoding="utf-8"))
    p7 = json.loads((rdir / "test1_part7.json").read_text(encoding="utf-8"))

    check(len(p5) >= 30, f"Expected >= 30 Part 5 questions, got {len(p5)}")
    for q in p5:
        exp = q["explanation"]
        check(bool(exp["classification"]["category"]) and bool(exp["classification"]["signal"]), f"P5 {q['id']} missing layer 1")
        check(bool(exp["translation"]["questionVi"]) and len(exp["translation"]["optionsVi"]) == 4, f"P5 {q['id']} missing layer 2")
        check(bool(exp["proof"]["explanation"]), f"P5 {q['id']} missing layer 3")
        check(len(exp["wrongOptionsAnalysis"]) == 4, f"P5 {q['id']} missing layer 4")
        check(bool(exp["keyTakeaways"]["formula"]) and bool(exp["keyTakeaways"]["commonTrap"]), f"P5 {q['id']} missing layer 5")

    check(len(p6) >= 4, f"Expected >= 4 Part 6 passages, got {len(p6)}")
    for passage in p6:
        sids = {s["id"] for para in passage["paragraphs"] for s in para["sentences"]}
        for q in passage["questions"]:
            ev_id = q["explanation"]["proof"].get("evidenceSentenceId")
            check(ev_id in sids, f"P6 {q['id']} invalid evidenceSentenceId '{ev_id}'")

    check(len(p7) >= 5, f"Expected >= 5 Part 7 sets, got {len(p7)}")
    for s in p7:
        for q in s["questions"]:
            p_idx = q["explanation"]["proof"].get("evidencePassageIndex", 0)
            ev_id = q["explanation"]["proof"].get("evidenceSentenceId")
            check(0 <= p_idx < len(s["passages"]), f"P7 {q['id']} out-of-range evidencePassageIndex {p_idx}")
            doc = s["passages"][p_idx]
            valid_ids = set()
            for para in doc.get("paragraphs", []):
                for sent in para.get("sentences", []):
                    valid_ids.add(sent["id"])
            for msg in doc.get("chatMessages", []):
                valid_ids.add(msg["id"])
            check(ev_id in valid_ids, f"P7 {q['id']} evidenceSentenceId '{ev_id}' not found in passage {p_idx}")

    print(f"[Reading Audit] Checked {len(p5)} P5, {len(p6)} P6 passages ({sum(len(x['questions']) for x in p6)} Qs), {len(p7)} P7 sets ({sum(len(x['questions']) for x in p7)} Qs).")

    # Also validate lazy-loaded public/data/reading/ batches & reading-meta.json
    pub_rdir = PUBLIC / "data" / "reading"
    rmeta_p = pub_rdir / "reading-meta.json"
    check(rmeta_p.exists(), f"Missing lazy-loaded reading-meta.json at {rmeta_p}")
    if rmeta_p.exists():
        rmeta = json.loads(rmeta_p.read_text(encoding="utf-8"))
        pub_p5, pub_p6, pub_p7 = [], [], []
        for b in rmeta.get("part5", {}).get("batches", []):
            bp = pub_rdir / b["file"]
            check(bp.exists(), f"Missing public reading P5 batch: {bp}")
            if bp.exists():
                rows = json.loads(bp.read_text(encoding="utf-8"))
                check(len(rows) == b["count"], f"Public P5 batch {b['file']} count mismatch")
                pub_p5.extend(rows)
        for b in rmeta.get("part6", {}).get("batches", []):
            bp = pub_rdir / b["file"]
            check(bp.exists(), f"Missing public reading P6 batch: {bp}")
            if bp.exists():
                rows = json.loads(bp.read_text(encoding="utf-8"))
                check(len(rows) == b["passageCount"], f"Public P6 batch {b['file']} passageCount mismatch")
                pub_p6.extend(rows)
        for b in rmeta.get("part7", {}).get("batches", []):
            bp = pub_rdir / b["file"]
            check(bp.exists(), f"Missing public reading P7 batch: {bp}")
            if bp.exists():
                rows = json.loads(bp.read_text(encoding="utf-8"))
                check(len(rows) == b["setCount"], f"Public P7 batch {b['file']} setCount mismatch")
                pub_p7.extend(rows)
        _validate_toeic_reading_items("public/reading", pub_p5, pub_p6, pub_p7)
        check(len(pub_p5) == rmeta["part5"]["totalQuestions"], "reading-meta part5 totalQuestions mismatch")
        check(len(pub_p6) == rmeta["part6"]["totalPassages"], "reading-meta part6 totalPassages mismatch")
        check(len(pub_p7) == rmeta["part7"]["totalSets"], "reading-meta part7 totalSets mismatch")
        print(
            f"[Public Reading Lazy Audit] Checked {len(pub_p5)} P5, {len(pub_p6)} P6 passages "
            f"({sum(len(x['questions']) for x in pub_p6)} Qs), {len(pub_p7)} P7 sets ({sum(len(x['questions']) for x in pub_p7)} Qs)."
        )


def validate_listening():
    ldir = DATA / "listening"
    p1 = json.loads((ldir / "test1_part1.json").read_text(encoding="utf-8"))
    p2 = json.loads((ldir / "test1_part2.json").read_text(encoding="utf-8"))
    p3 = json.loads((ldir / "test1_part3.json").read_text(encoding="utf-8"))
    p4 = json.loads((ldir / "test1_part4.json").read_text(encoding="utf-8"))

    for item in p1:
        img = PUBLIC / item["imageUrl"].lstrip("/")
        aud = PUBLIC / item["audioUrl"].lstrip("/")
        check(img.exists() and img.stat().st_size > 10_000, f"P1 {item['id']} missing/small image: {img}")
        check(aud.exists() and aud.stat().st_size > 5_000, f"P1 {item['id']} missing/small audio: {aud}")
        for line in item["transcript"]:
            check(line["endMs"] > line["startMs"], f"P1 {line['id']} invalid timestamps")

    for item in p2:
        aud = PUBLIC / item["audioUrl"].lstrip("/")
        check(aud.exists() and aud.stat().st_size > 5_000, f"P2 {item['id']} missing/small audio: {aud}")
        check(item["questionLine"]["endMs"] > item["questionLine"]["startMs"], f"P2 {item['id']} invalid Q timestamps")
        for k in ["A", "B", "C"]:
            check(item["options"][k]["endMs"] > item["options"][k]["startMs"], f"P2 {item['id']} opt {k} invalid timestamps")

    for group_name, group in [("P3", p3), ("P4", p4)]:
        for s in group:
            aud = PUBLIC / s["audioUrl"].lstrip("/")
            check(aud.exists() and aud.stat().st_size > 10_000, f"{group_name} {s['id']} missing/small audio: {aud}")
            for line in s["transcript"]:
                check(line["endMs"] > line["startMs"], f"{group_name} {line['id']} invalid timestamps")

    print(f"[Listening Audit] Checked {len(p1)} P1, {len(p2)} P2, {len(p3)} P3 sets, {len(p4)} P4 sets — all MP3 & photo paths verified.")


def _validate_toeic_reading_items(prefix: str, p5: list, p6: list, p7: list):
    for q in p5:
        exp = q["explanation"]
        check(bool(exp["classification"]["category"]) and bool(exp["classification"]["signal"]), f"{prefix} P5 {q['id']} missing layer 1")
        check(bool(exp["translation"]["questionVi"]) and len(exp["translation"]["optionsVi"]) == 4, f"{prefix} P5 {q['id']} missing layer 2")
        check(bool(exp["proof"]["explanation"]), f"{prefix} P5 {q['id']} missing layer 3")
        check(len(exp["wrongOptionsAnalysis"]) == 4, f"{prefix} P5 {q['id']} missing layer 4")
        check(bool(exp["keyTakeaways"]["formula"]) and bool(exp["keyTakeaways"]["commonTrap"]), f"{prefix} P5 {q['id']} missing layer 5")

    for passage in p6:
        sids = {s["id"] for para in passage["paragraphs"] for s in para["sentences"]}
        for q in passage["questions"]:
            ev_id = q["explanation"]["proof"].get("evidenceSentenceId")
            check(ev_id in sids, f"{prefix} P6 {q['id']} invalid evidenceSentenceId '{ev_id}'")

    for s in p7:
        for q in s["questions"]:
            p_idx = q["explanation"]["proof"].get("evidencePassageIndex", 0)
            ev_id = q["explanation"]["proof"].get("evidenceSentenceId")
            check(0 <= p_idx < len(s["passages"]), f"{prefix} P7 {q['id']} out-of-range evidencePassageIndex {p_idx}")
            doc = s["passages"][p_idx]
            valid_ids = set()
            for para in doc.get("paragraphs", []):
                for sent in para.get("sentences", []):
                    valid_ids.add(sent["id"])
            for msg in doc.get("chatMessages", []):
                valid_ids.add(msg["id"])
            check(ev_id in valid_ids, f"{prefix} P7 {q['id']} evidenceSentenceId '{ev_id}' not found in passage {p_idx}")


def _validate_toeic_listening_items(prefix: str, p1: list, p2: list, p3: list, p4: list):
    for item in p1:
        img = PUBLIC / item["imageUrl"].lstrip("/")
        aud = PUBLIC / item["audioUrl"].lstrip("/")
        check(img.exists() and img.stat().st_size > 10_000, f"{prefix} P1 {item['id']} missing/small image: {img}")
        check(aud.exists() and aud.stat().st_size > 5_000, f"{prefix} P1 {item['id']} missing/small audio: {aud}")
        for line in item["transcript"]:
            check(line["endMs"] > line["startMs"], f"{prefix} P1 {line['id']} invalid timestamps")

    for item in p2:
        aud = PUBLIC / item["audioUrl"].lstrip("/")
        check(aud.exists() and aud.stat().st_size > 5_000, f"{prefix} P2 {item['id']} missing/small audio: {aud}")
        check(item["questionLine"]["endMs"] > item["questionLine"]["startMs"], f"{prefix} P2 {item['id']} invalid Q timestamps")
        for k in ["A", "B", "C"]:
            check(item["options"][k]["endMs"] > item["options"][k]["startMs"], f"{prefix} P2 {item['id']} opt {k} invalid timestamps")

    for gname, group in [("P3", p3), ("P4", p4)]:
        for s in group:
            aud = PUBLIC / s["audioUrl"].lstrip("/")
            check(aud.exists() and aud.stat().st_size > 10_000, f"{prefix} {gname} {s['id']} missing/small audio: {aud}")
            for line in s["transcript"]:
                check(line["endMs"] > line["startMs"], f"{prefix} {gname} {line['id']} invalid timestamps")


def validate_toeic_bank():
    tdir = PUBLIC / "data" / "toeic"
    tmeta_p = tdir / "tests-meta.json"
    dmeta_p = tdir / "drills-meta.json"
    check(tmeta_p.exists(), f"Missing {tmeta_p}")
    check(dmeta_p.exists(), f"Missing {dmeta_p}")
    if not (tmeta_p.exists() and dmeta_p.exists()):
        return

    tmeta = json.loads(tmeta_p.read_text(encoding="utf-8"))
    dmeta = json.loads(dmeta_p.read_text(encoding="utf-8"))
    ready_tests = [t for t in tmeta if t.get("status") == "ready"]
    check(len(ready_tests) >= 3, f"Expected >= 3 ready ETS tests, got {len(ready_tests)}")

    total_test_qs = 0
    for tm in ready_tests:
        tp = tdir / "tests" / f"{tm['id']}.json"
        check(tp.exists(), f"Missing ETS test JSON: {tp}")
        if not tp.exists():
            continue
        data = json.loads(tp.read_text(encoding="utf-8"))
        parts = data["parts"]
        _validate_toeic_listening_items(tm["id"], parts["part1"], parts["part2"], parts["part3"], parts["part4"])
        _validate_toeic_reading_items(tm["id"], parts["part5"], parts["part6"], parts["part7"])
        qcnt = (
            len(parts["part1"]) + len(parts["part2"])
            + sum(len(s["questions"]) for s in parts["part3"])
            + sum(len(s["questions"]) for s in parts["part4"])
            + len(parts["part5"])
            + sum(len(p["questions"]) for p in parts["part6"])
            + sum(len(s["questions"]) for s in parts["part7"])
        )
        check(qcnt == tm["questionCount"], f"Test {tm['id']} count mismatch {qcnt} != {tm['questionCount']}")
        total_test_qs += qcnt

    total_drill_qs = 0
    for dm in dmeta:
        dp = tdir / "drills" / f"{dm['id']}.json"
        check(dp.exists(), f"Missing drill JSON: {dp}")
        if not dp.exists():
            continue
        data = json.loads(dp.read_text(encoding="utf-8"))
        _validate_toeic_listening_items(dm["id"], data.get("part1", []), data.get("part2", []), data.get("part3", []), data.get("part4", []))
        _validate_toeic_reading_items(dm["id"], data.get("part5", []), data.get("part6", []), data.get("part7", []))
        qcnt = (
            len(data.get("part1", [])) + len(data.get("part2", []))
            + sum(len(s["questions"]) for s in data.get("part3", []))
            + sum(len(s["questions"]) for s in data.get("part4", []))
            + len(data.get("part5", []))
            + sum(len(p["questions"]) for p in data.get("part6", []))
            + sum(len(s["questions"]) for s in data.get("part7", []))
        )
        check(qcnt == dm["questionCount"], f"Drill {dm['id']} count mismatch {qcnt} != {dm['questionCount']}")
        total_drill_qs += qcnt

    print(f"[TOEIC Bank Audit] Checked {len(ready_tests)} ETS tests ({total_test_qs} Qs) + {len(dmeta)} 7-Part drills ({total_drill_qs} Qs) — all MP3s, photos, 5-layer explanations & evidence anchors verified!")


def main():
    validate_vocab()
    validate_reading()
    validate_listening()
    validate_toeic_bank()

    if warnings:
        print("\nWARNINGS:")
        for w in warnings:
            print("  -", w)

    if errors:
        print(f"\nFAILED with {len(errors)} error(s):")
        for e in errors:
            print("  [ERR]", e)
        sys.exit(1)

    print("\nALL VALIDATIONS PASSED 100% — Zero schema, anchor, image, or MP3 path errors!")


if __name__ == "__main__":
    main()
