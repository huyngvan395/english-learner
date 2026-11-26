# TOEIC Mastery Hub — Automated Data & Audio Pipeline

Thư mục `scripts/` chứa bộ công cụ Python tự động hóa hoàn toàn việc thu thập, làm giàu từ vựng, tạo đề thi TOEIC Reading/Listening chuẩn ETS và render âm thanh MP3 đa giọng đọc phòng thi (Mỹ/Anh/Úc).

## Cài đặt môi trường

```bash
pip install -r scripts/requirements.txt
```

> `imageio-ffmpeg` tự động cung cấp binary `ffmpeg` nên `pydub` hoạt động ngay trên Windows/macOS/Linux mà không cần cài thêm FFmpeg hệ thống.

## 1. Bơm từ vựng tốc độ cao & Lazy Loading (`build_full_vocab.py`)

```bash
# Chuyển toàn bộ dữ liệu biên soạn chất lượng cao sang public/data/vocab/ (không ghi đè)
python scripts/build_full_vocab.py --migrate-only

# Bơm đầy đủ 1 bộ cụ thể (VD: Oxford 3000 A1, 600 TOEIC) bằng NLTK offline + Batch Translation
python scripts/build_full_vocab.py --deck oxford-3000-a1
python scripts/build_full_vocab.py --deck toeic-600

# Bơm theo nhóm bộ thẻ (oxford | toeic | common | academic | all)
python scripts/build_full_vocab.py --group oxford --batch-size 35
python scripts/build_full_vocab.py --group all --batch-size 35
```

> Tất cả dữ liệu đã biên soạn sẵn đều được bảo toàn ở độ ưu tiên cao nhất. Sau mỗi lần chạy, script tự động cập nhật số lượng thẻ thực tế trong `src/data/vocabDecksMeta.ts` và tái tạo `public/data/vocab/search-index.json`.

## 2. Tạo dữ liệu TOEIC Reading chuẩn ETS (`generate_reading.py`)

```bash
# Xuất Bộ đề số 1 đầy đủ (30 câu Part 5, 4 bài Part 6 = 16 câu, 5 bài Part 7) vào src/data/reading/
python scripts/generate_reading.py
```

## 3. Tạo dữ liệu TOEIC Listening + Render Audio MP3 thật + Tải ảnh Part 1 (`generate_listening_audio.py`)

```bash
# Tải ảnh công khai vào public/images/part1/, render MP3 bằng edge-tts + pydub vào public/audio/listening/
# và xuất JSON chuẩn hóa kèm timestamp từng câu vào src/data/listening/
python scripts/generate_listening_audio.py
```

## 4. Kiểm tra toàn vẹn dữ liệu (`validate_data.py`)

```bash
# Kiểm tra schema JSON, dẫn chứng Reading, đường dẫn ảnh Part 1 và dung lượng file MP3
python scripts/validate_data.py
```
