#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/generate_listening_audio.py
===================================
Generates authentic TOEIC Listening Test #1 JSON datasets + REAL multi-voice MP3 files!

Features:
1. Uses `edge-tts` (free Microsoft Neural voices — zero API key required) across
   US (Guy, Jenny), UK (Ryan, Sonia), and Australian (William, Natasha) accents.
2. Uses `pydub` + bundled `imageio-ffmpeg` to stitch multi-speaker Part 1, 2, 3, 4 audio
   with natural pauses (400ms between Part 3/4 turns; 650ms between Part 1/2 options).
3. Records exact `startMs` and `endMs` timestamps for EVERY transcript line so the web UI's
   Interactive Transcript seeks directly inside the real MP3 file (including 1-line Loop!).
4. Ensures royalty-free Part 1 photographs exist in `public/images/part1/`.
5. Outputs clean JSON datasets to `src/data/listening/test1_part{1,2,3,4}.json`.
"""

import asyncio
import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Tuple

import edge_tts
import imageio_ffmpeg
import requests
from pydub import AudioSegment

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Bundled static ffmpeg binary from imageio-ffmpeg (no system ffmpeg/ffprobe needed!)
FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()

ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT_DIR / "scripts"
AUDIO_OUT_DIR = ROOT_DIR / "public" / "audio" / "listening"
IMAGES_OUT_DIR = ROOT_DIR / "public" / "images" / "part1"
DATA_OUT_DIR = ROOT_DIR / "src" / "data" / "listening"

sys.path.insert(0, str(SCRIPTS_DIR))
from listening_test1_bank import (
    PART1_IMAGE_SOURCES,
    PART1_TEST1_BANK,
    PART2_TEST1_BANK,
    PART3_TEST1_BANK,
    PART4_TEST1_BANK,
)


def ensure_part1_images() -> None:
    IMAGES_OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, url in PART1_IMAGE_SOURCES.items():
        target = IMAGES_OUT_DIR / filename
        if target.exists() and target.stat().st_size > 10_000:
            continue
        print(f"  [Photo] Downloading {filename}...")
        resp = requests.get(url, timeout=20)
        if resp.status_code == 200 and len(resp.content) > 10_000:
            target.write_bytes(resp.content)
        else:
            raise RuntimeError(f"Failed to download Part 1 photo {filename}: HTTP {resp.status_code}")


async def synth_segment_to_file(text: str, voice: str, out_file: Path) -> None:
    communicate = edge_tts.Communicate(text=text, voice=voice, rate="+0%")
    await communicate.save(str(out_file))


async def render_stitched_mp3(
    segments: List[Tuple[str, str, str]],  # (line_id, text, voice)
    output_mp3: Path,
    pause_ms: int = 400,
) -> Dict[str, Tuple[int, int]]:
    """
    Renders each (line_id, text, voice) with edge-tts, stitches them with `pause_ms`
    silence between turns via pydub, exports to `output_mp3`, and returns exact
    {line_id: (startMs, endMs)} timings!
    """
    output_mp3.parent.mkdir(parents=True, exist_ok=True)
    silence = AudioSegment.silent(duration=pause_ms)
    lead_silence = AudioSegment.silent(duration=250)

    combined = lead_silence
    timings: Dict[str, Tuple[int, int]] = {}

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        for idx, (line_id, text, voice) in enumerate(segments):
            seg_mp3 = tmp_path / f"seg_{idx}.mp3"
            seg_wav = tmp_path / f"seg_{idx}.wav"
            # Retry once on transient edge-tts network blip
            for attempt in range(2):
                try:
                    await synth_segment_to_file(text, voice, seg_mp3)
                    break
                except Exception:
                    if attempt == 1:
                        raise
                    await asyncio.sleep(0.8)

            # Decode MP3 -> WAV using bundled ffmpeg (avoids needing ffprobe on Windows)
            subprocess.run(
                [FFMPEG_BIN, "-y", "-loglevel", "error", "-i", str(seg_mp3), "-ar", "24000", "-ac", "1", str(seg_wav)],
                check=True,
            )
            clip = AudioSegment.from_wav(str(seg_wav))
            start_ms = len(combined)
            combined += clip
            end_ms = len(combined)
            timings[line_id] = (start_ms, end_ms)

            if idx + 1 < len(segments):
                combined += silence

        combined += AudioSegment.silent(duration=300)
        combined_wav = tmp_path / "combined.wav"
        combined.export(str(combined_wav), format="wav")
        subprocess.run(
            [FFMPEG_BIN, "-y", "-loglevel", "error", "-i", str(combined_wav), "-codec:a", "libmp3lame", "-b:a", "96k", str(output_mp3)],
            check=True,
        )
    return timings


async def build_all() -> None:
    ensure_part1_images()
    AUDIO_OUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_OUT_DIR.mkdir(parents=True, exist_ok=True)

    # ---------- PART 1 ----------
    print("\n[Part 1] Rendering 6 real MP3 tracks...")
    p1_out = []
    for item in copy.deepcopy(PART1_TEST1_BANK):
        mp3_name = item.pop("audioFile")
        mp3_path = AUDIO_OUT_DIR / mp3_name
        segs = [(t["id"], t["en"], t["voice"]) for t in item["transcript"]]
        timings = await render_stitched_mp3(segs, mp3_path, pause_ms=650)
        item["audioUrl"] = f"/audio/listening/{mp3_name}"
        for t in item["transcript"]:
            t.pop("voice", None)
            s_ms, e_ms = timings[t["id"]]
            t["startMs"] = s_ms
            t["endMs"] = e_ms
        p1_out.append(item)
        print(f"  [OK] {mp3_name} ({mp3_path.stat().st_size // 1024} KB)")

    # ---------- PART 2 ----------
    print("\n[Part 2] Rendering 10 real MP3 tracks...")
    p2_out = []
    for item in copy.deepcopy(PART2_TEST1_BANK):
        mp3_name = item.pop("audioFile")
        mp3_path = AUDIO_OUT_DIR / mp3_name
        qline = item["questionLine"]
        segs = [(qline["id"], qline["en"], qline["voice"])]
        for k in ["A", "B", "C"]:
            opt = item["options"][k]
            segs.append((f"{item['id']}-opt-{k}", f"{k}. {opt['en']}", opt["voice"]))
        timings = await render_stitched_mp3(segs, mp3_path, pause_ms=650)
        item["audioUrl"] = f"/audio/listening/{mp3_name}"
        qline.pop("voice", None)
        qline["startMs"], qline["endMs"] = timings[qline["id"]]
        for k in ["A", "B", "C"]:
            opt = item["options"][k]
            opt.pop("voice", None)
            opt["startMs"], opt["endMs"] = timings[f"{item['id']}-opt-{k}"]
        p2_out.append(item)
        print(f"  [OK] {mp3_name} ({mp3_path.stat().st_size // 1024} KB)")

    # ---------- PART 3 ----------
    print("\n[Part 3] Rendering 3 multi-speaker MP3 conversations (400ms natural turn pauses)...")
    p3_out = []
    for item in copy.deepcopy(PART3_TEST1_BANK):
        mp3_name = item.pop("audioFile")
        mp3_path = AUDIO_OUT_DIR / mp3_name
        segs = [(t["id"], t["en"], t["voice"]) for t in item["transcript"]]
        timings = await render_stitched_mp3(segs, mp3_path, pause_ms=400)
        item["audioUrl"] = f"/audio/listening/{mp3_name}"
        for t in item["transcript"]:
            t.pop("voice", None)
            t["startMs"], t["endMs"] = timings[t["id"]]
        p3_out.append(item)
        print(f"  [OK] {mp3_name} ({mp3_path.stat().st_size // 1024} KB)")

    # ---------- PART 4 ----------
    print("\n[Part 4] Rendering 3 short-talk MP3 tracks (US / UK / AU voices)...")
    p4_out = []
    for item in copy.deepcopy(PART4_TEST1_BANK):
        mp3_name = item.pop("audioFile")
        mp3_path = AUDIO_OUT_DIR / mp3_name
        segs = [(t["id"], t["en"], t["voice"]) for t in item["transcript"]]
        timings = await render_stitched_mp3(segs, mp3_path, pause_ms=400)
        item["audioUrl"] = f"/audio/listening/{mp3_name}"
        for t in item["transcript"]:
            t.pop("voice", None)
            t["startMs"], t["endMs"] = timings[t["id"]]
        p4_out.append(item)
        print(f"  [OK] {mp3_name} ({mp3_path.stat().st_size // 1024} KB)")

    # Save JSON files
    (DATA_OUT_DIR / "test1_part1.json").write_text(json.dumps(p1_out, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA_OUT_DIR / "test1_part2.json").write_text(json.dumps(p2_out, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA_OUT_DIR / "test1_part3.json").write_text(json.dumps(p3_out, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA_OUT_DIR / "test1_part4.json").write_text(json.dumps(p4_out, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = {
        "testId": "ets-listening-test-1",
        "title": "Bộ đề mẫu số 1 — TOEIC Listening MP3 chuẩn phòng thi ETS",
        "counts": {
            "part1": len(p1_out),
            "part2": len(p2_out),
            "part3Sets": len(p3_out),
            "part3Questions": sum(len(s["questions"]) for s in p3_out),
            "part4Sets": len(p4_out),
            "part4Questions": sum(len(s["questions"]) for s in p4_out),
            "totalAudioFiles": len(p1_out) + len(p2_out) + len(p3_out) + len(p4_out),
        },
    }
    (DATA_OUT_DIR / "index.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nDONE! Rendered {manifest['counts']['totalAudioFiles']} real MP3 files & 4 Listening JSON datasets.")


if __name__ == "__main__":
    asyncio.run(build_all())
