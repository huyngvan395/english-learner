# -*- coding: utf-8 -*-
"""
Shared clean schema builders for TOEIC Mastery Hub question banks.
Guarantees 100% compliance with src/types/index.ts for Reading (5-layer)
and Listening (Interactive Transcript + Paraphrase + Trap + Key Vocab).
"""
from typing import Any, Dict, List, Optional, Tuple

VOICES_US_M = "en-US-GuyNeural"
VOICES_US_F = "en-US-JennyNeural"
VOICES_UK_M = "en-GB-RyanNeural"
VOICES_UK_F = "en-GB-SoniaNeural"
VOICES_AU_M = "en-AU-WilliamNeural"
VOICES_AU_F = "en-AU-NatashaNeural"


def make_p5(
    qid: str,
    topic: str,
    difficulty: str,
    sentence: str,
    options: Dict[str, str],
    ans: str,
    category: str,
    signal: str,
    q_vi: str,
    opts_vi: Dict[str, str],
    proof: str,
    wrong: Dict[str, str],
    formula: str,
    trap: str,
    paraphrases: Optional[List[Tuple[str, str, str]]] = None,
) -> Dict[str, Any]:
    return {
        "id": qid,
        "part": 5,
        "topic": topic,
        "difficulty": difficulty,
        "sentence": sentence,
        "options": options,
        "correctAnswer": ans,
        "explanation": {
            "classification": {"category": category, "signal": signal},
            "translation": {"questionVi": q_vi, "optionsVi": opts_vi},
            "proof": {"explanation": proof},
            "wrongOptionsAnalysis": wrong,
            "keyTakeaways": {
                "formula": formula,
                "commonTrap": trap,
                "paraphrases": [
                    {"textInPassage": a, "textInAnswer": b, "meaningVi": c}
                    for (a, b, c) in (paraphrases or [])
                ],
            },
        },
    }


def make_p1(
    qid: str,
    scene_type: str,
    title: str,
    image_file: str,
    illus_key: str,
    options: Dict[str, Tuple[str, str]],  # {A: (en, vi), ...}
    ans: str,
    trap_type: str,
    trap_analysis: str,
    opt_analysis: Dict[str, str],
    paraphrases: List[Tuple[str, str, str]],
    key_vocab: List[Tuple[str, str, str, str, str, str, str]],  # (word, pos, uk, us, vi, exEn, exVi)
    voice: str = VOICES_US_M,
    accent: str = "en-US",
    gender: str = "male",
) -> Dict[str, Any]:
    transcript = []
    opts_out = {}
    for k in ["A", "B", "C", "D"]:
        en, vi = options[k]
        opts_out[k] = {"en": en, "vi": vi}
        transcript.append({
            "id": f"{qid}-opt-{k}",
            "speaker": f"Statement ({k})",
            "voiceGender": gender,
            "accent": accent,
            "voice": voice,
            "en": f"{k}. {en}",
            "vi": f"{k}. {vi}",
            "evidenceForQuestionIds": [qid] if k == ans else [],
        })
    return {
        "id": qid,
        "part": 1,
        "sceneType": scene_type,
        "title": title,
        "illustrationKey": illus_key,
        "imageUrl": f"/images/part1/{image_file}",
        "audioFile": f"{qid}.mp3",
        "transcript": transcript,
        "options": opts_out,
        "correctAnswer": ans,
        "explanation": {
            "trapType": trap_type,
            "trapAnalysis": trap_analysis,
            "paraphrases": [
                {"audioPhrase": a, "answerPhrase": b, "meaningVi": c}
                for (a, b, c) in paraphrases
            ],
            "optionAnalysis": opt_analysis,
            "keyVocab": [
                {
                    "id": f"{qid}-v{idx+1}",
                    "word": w,
                    "pos": pos,
                    "ipaUK": uk,
                    "ipaUS": us,
                    "meaning": vi,
                    "exampleEn": ex_en,
                    "exampleVi": ex_vi,
                }
                for idx, (w, pos, uk, us, vi, ex_en, ex_vi) in enumerate(key_vocab)
            ],
        },
    }


def make_p2(
    qid: str,
    qtype: str,
    title: str,
    q_en: str,
    q_vi: str,
    options: Dict[str, Tuple[str, str]],  # {A: (en, vi), B: ..., C: ...}
    ans: str,
    trap_type: str,
    trap_analysis: str,
    opt_analysis: Dict[str, str],
    paraphrases: List[Tuple[str, str, str]],
    key_vocab: List[Tuple[str, str, str, str, str, str, str]],
    q_voice: str = VOICES_US_F,
    q_gender: str = "female",
    q_accent: str = "en-US",
    a_voice: str = VOICES_UK_M,
    a_gender: str = "male",
    a_accent: str = "en-GB",
) -> Dict[str, Any]:
    return {
        "id": qid,
        "part": 2,
        "questionType": qtype,
        "title": title,
        "audioFile": f"{qid}.mp3",
        "questionLine": {
            "id": f"{qid}-q",
            "speaker": "Speaker A",
            "voiceGender": q_gender,
            "accent": q_accent,
            "voice": q_voice,
            "en": q_en,
            "vi": q_vi,
        },
        "options": {
            k: {
                "en": options[k][0],
                "vi": options[k][1],
                "speaker": "Speaker B",
                "voiceGender": a_gender,
                "accent": a_accent,
                "voice": a_voice,
            }
            for k in ["A", "B", "C"]
        },
        "correctAnswer": ans,
        "explanation": {
            "trapType": trap_type,
            "trapAnalysis": trap_analysis,
            "paraphrases": [
                {"audioPhrase": a, "answerPhrase": b, "meaningVi": c}
                for (a, b, c) in paraphrases
            ],
            "optionAnalysis": opt_analysis,
            "keyVocab": [
                {
                    "id": f"{qid}-v{idx+1}",
                    "word": w,
                    "pos": pos,
                    "ipaUK": uk,
                    "ipaUS": us,
                    "meaning": vi,
                    "exampleEn": ex_en,
                    "exampleVi": ex_vi,
                }
                for idx, (w, pos, uk, us, vi, ex_en, ex_vi) in enumerate(key_vocab)
            ],
        },
    }
