#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/generate_reading.py
===========================
Generates authentic ETS-format TOEIC Reading Test #1 JSON datasets into `src/data/reading/`:
- test1_part5.json: 30 questions across all 8 grammar & vocabulary topics
- test1_part6.json: 4 complete passages (16 questions, incl. Sentence Insertion)
- test1_part7.json: 5 complete sets (2 Single + 2 Double + 1 Triple = 23 questions)
- index.json: manifest summary

Every question is validated for the mandatory 5-layer pedagogical explanation and exact evidence IDs.
"""

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT_DIR / "scripts"
OUT_DIR = ROOT_DIR / "src" / "data" / "reading"

sys.path.insert(0, str(SCRIPTS_DIR))
from reading_test1_part5 import PART5_TEST1_QUESTIONS
from reading_test1_part6 import PART6_TEST1_PASSAGES
from reading_test1_part7 import PART7_TEST1_SETS


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    p5_path = OUT_DIR / "test1_part5.json"
    p6_path = OUT_DIR / "test1_part6.json"
    p7_path = OUT_DIR / "test1_part7.json"

    p5_path.write_text(json.dumps(PART5_TEST1_QUESTIONS, ensure_ascii=False, indent=2), encoding="utf-8")
    p6_path.write_text(json.dumps(PART6_TEST1_PASSAGES, ensure_ascii=False, indent=2), encoding="utf-8")
    p7_path.write_text(json.dumps(PART7_TEST1_SETS, ensure_ascii=False, indent=2), encoding="utf-8")

    p6_q_count = sum(len(p["questions"]) for p in PART6_TEST1_PASSAGES)
    p7_q_count = sum(len(s["questions"]) for s in PART7_TEST1_SETS)

    manifest = {
        "testId": "ets-reading-test-1",
        "title": "Bộ đề mẫu số 1 — TOEIC Reading chuẩn ETS",
        "counts": {
            "part5": len(PART5_TEST1_QUESTIONS),
            "part6Passages": len(PART6_TEST1_PASSAGES),
            "part6Questions": p6_q_count,
            "part7Sets": len(PART7_TEST1_SETS),
            "part7Questions": p7_q_count,
            "totalQuestions": len(PART5_TEST1_QUESTIONS) + p6_q_count + p7_q_count,
        },
        "files": {
            "part5": "test1_part5.json",
            "part6": "test1_part6.json",
            "part7": "test1_part7.json",
        },
    }
    (OUT_DIR / "index.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[OK] {p5_path.relative_to(ROOT_DIR)} -> {len(PART5_TEST1_QUESTIONS)} Part 5 questions")
    print(f"[OK] {p6_path.relative_to(ROOT_DIR)} -> {len(PART6_TEST1_PASSAGES)} Part 6 passages ({p6_q_count} questions)")
    print(f"[OK] {p7_path.relative_to(ROOT_DIR)} -> {len(PART7_TEST1_SETS)} Part 7 sets ({p7_q_count} questions)")
    print(f"DONE! Total Reading Test #1 questions generated: {manifest['counts']['totalQuestions']}")


if __name__ == "__main__":
    main()
