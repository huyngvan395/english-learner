# Âm thanh hiệu ứng tùy chỉnh (SFX) — TOEIC Mastery Hub

Thư mục này dùng để chứa **5 file âm thanh thật (MP3)** cho hệ thống phản hồi gamification (được nạp trước và giải mã vào `AudioBuffer` của Web Audio API để phát với **độ trễ 0ms** và hỗ trợ chồng âm mượt mà).

## Danh sách 5 file chuẩn

| Tên file | Sự kiện kích hoạt | Gợi ý độ dài |
| :--- | :--- | :--- |
| `correct.mp3` | Gõ đúng từ / chọn đúng đáp án (tự tăng `playbackRate` theo chuỗi Combo) | `150ms – 300ms` |
| `wrong.mp3` | Gõ sai từ / chọn sai đáp án (đặt lại Combo về 0) | `150ms – 250ms` |
| `complete.mp3` | Hoàn thành chủ đề, nộp bài thi / Writing, đạt Mục tiêu ngày, hoặc chạm mốc Combo 5 / 10 câu | `400ms – 700ms` |
| `save.mp3` | Lưu từ vào *Từ vựng của tôi* / gắn sao | `100ms – 200ms` |
| `flip.mp3` | Lật thẻ Flashcard 3D / bấm mở gợi ý chữ cái | `50ms – 120ms` |

## Cơ chế Fallback tự động

- Chỉ cần thả 1 hoặc cả 5 file `.mp3` đúng tên trên vào `public/audio/sfx/`, ứng dụng sẽ tự nhận diện và ưu tiên phát file thật.
- Nếu file nào chưa có trong thư mục này, `src/lib/soundEffects.ts` sẽ tự động chuyển mượt sang **bộ tổng hợp nhạc cụ ấm (Marimba / Kalimba / Glockenspiel)** qua Web Audio API mà không gây lỗi.
