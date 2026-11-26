# 🎯 TOEIC Mastery Hub

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Gemini API](https://img.shields.io/badge/Google_Gemini_API-BYOK-4285F4?style=flat-square&logo=google&logoColor=white)

**TOEIC Mastery Hub** là ứng dụng web ôn luyện Tiếng Anh và luyện thi TOEIC toàn diện theo phong cách Modern Dark Mode, chạy hoàn toàn phía Client với kiến trúc **Lazy Loading** tối ưu cho kho dữ liệu lớn (hơn 10.000 từ vựng, hàng chục bộ đề thi và kho bài tập chuyên sâu 4 kỹ năng).

---

## ✨ Tính năng nổi bật

### 1. 📚 Ôn luyện Từ vựng chủ động & SRS (Chuẩn Active Recall)
- **Kho từ vựng đa dạng (16+ bộ thẻ):** Chia rõ theo mục tiêu và trình độ CEFR gồm **600 Từ vựng thiết yếu TOEIC**, **Từ vựng ETS TOEIC**, **Thành ngữ & Collocations TOEIC**, **6 bộ Oxford tách cấp độ** (`Oxford 3000 A1/A2/B1/B2`, `Oxford 5000 B2/C1`), **1000 Từ thông dụng**, **Giao tiếp**, **IELTS**, **THPT Quốc gia**, **SAT**, **TOEFL** và **Theo chủ đề**.
- **Giao diện học 2 cột theo chủ đề:** Cột trái theo dõi tiến độ từng nhóm học (`x/y thẻ`, `%`, trạng thái hoàn thành); cột phải luyện gõ từ chủ động với định nghĩa Anh–Việt và câu ví dụ tự động che từ khóa bằng dấu `*`.
- **Gợi ý thông minh & mở khóa phát âm:** Hé lộ ký tự ở vị trí ngẫu nhiên qua mỗi lượt gợi ý; tới ngưỡng gần cuối tự động hiển thị phiên âm **IPA (US/UK)** và chuyển nút gợi ý sang **Phát âm** để hỗ trợ đoán từ.
- **Thẻ lật 4 mức SRS:** Khi xem đáp án hoặc bấm *Không biết*, thẻ lật sang mặt chi tiết (IPA, loa US/UK, Word Family, Synonyms/Antonyms, Collocations) kèm 4 mức lặp lại ngắt quãng: **Học lại (10 phút)**, **Khó (1–3 ngày)**, **Tốt (1–4 ngày)**, **Dễ (1–7 ngày)**.
- **Tra từ điển tức thì & Cá nhân hóa:** Thanh tìm kiếm toàn kho từ qua chỉ mục nhẹ `search-index.json`, lưu từ vào **Từ vựng của tôi** và viết **Ghi chú cá nhân** trên từng thẻ.

### 2. 📝 Trung tâm Luyện thi TOEIC (Full Test & Mini Test)
- **Phân loại trực quan theo năm (2021–2026):** Thanh lọc nhanh theo năm, tự động sắp xếp `Test 1 → Test 10`.
- **Chế độ thi linh hoạt:** Làm **Full Test** (bấm giờ phòng thi), **Mini Test** hoặc chọn riêng lẻ từng Part bất kỳ (Part 1–7).
- **Chấm điểm thang TOEIC 990:** Tự động quy đổi điểm **Listening (/495)**, **Reading (/495)**, tổng điểm **/990**, thống kê tỷ lệ đúng từng Part và gom tự động các câu làm sai vào mục **Làm lại câu sai**.

### 3. 📖 TOEIC Reading Chuyên sâu (Part 5, 6, 7)
- **Khung Bản chất chuyên đề (Cheat Sheet):** Tổng hợp bản chất ngữ pháp, công thức nhận diện nhanh trong 5 giây và các bẫy phổ biến ngay trên từng chuyên đề lọc.
- **Đầy đủ định dạng đề thi:** Part 5 (chia theo chuyên đề ngữ pháp & từ vựng + 3 mức độ khó), Part 6 (đủ thể loại văn bản & dạng *Sentence Insertion*), Part 7 (giao diện **Split-Screen** hỗ trợ *Single / Double / Triple Passage* và công cụ highlight văn bản).
- **Hệ thống giải thích sư phạm 5 lớp:**
  1. Phân loại dạng bài, dấu hiệu nhận biết & phân tích khung câu (`S / V / O`).
  2. Dịch song ngữ đầy đủ câu hỏi, 4 phương án và toàn bộ đoạn văn.
  3. Chứng minh đáp án đúng kèm nút **Xem dẫn chứng trên bài đọc** (tự động cuộn và highlight đúng câu chứa thông tin).
  4. Phân tích loại trừ chi tiết 3 đáp án sai.
  5. Công thức áp dụng nhanh, bảng **Paraphrase** và logic liên kết đa đoạn (`crossPassageLogic`).

### 4. 🎧 TOEIC Listening Chuyên sâu (Part 1, 2, 3, 4)
- **Trình phát MP3 đồng bộ Interactive Transcript:** Tự động highlight câu đang đọc theo mốc thời gian `startMs` / `endMs`, bấm trực tiếp vào từng dòng lời thoại để tua tới đúng câu đó.
- **Hỗ trợ luyện nghe sâu:** Chỉnh tốc độ (`0.8x` / `1.0x` / `1.2x`), chế độ **Lặp 1 câu (Shadowing)** và đa dạng giọng đọc Mỹ / Anh / Úc.
- **Bóc tách bẫy nghe:** Chỉ rõ bẫy từ gần âm, bẫy lặp từ khóa, bẫy đổi ý và trả lời gián tiếp Part 2, đi kèm danh sách từ vựng trọng tâm có nút lưu nhanh vào kho từ cá nhân.

### 5. ✍️ AI Writing Studio (Google Gemini API — BYOK)
- **4 chế độ luyện viết:**
  1. **Dịch & Viết đoạn văn (Việt → Anh):** 30 đoạn chia 3 cấp độ (*Cơ bản / Trung bình / Nâng cao*) kèm gợi ý từ vựng và checklist ý chính.
  2. **TOEIC Writing — Phản hồi Email (Questions 6–7):** Bối cảnh công sở chuẩn format kèm nhiệm vụ cụ thể.
  3. **Viết Quan điểm & Tóm tắt (Question 8 & Paraphrase).**
  4. **Tự tạo đề riêng (Custom Passage):** Tự dán bất kỳ đoạn văn nào để luyện viết và chấm điểm.
- **Chấm bài chuyên sâu bằng Gemini API:** Đánh giá thang 10 + quy đổi CEFR/TOEIC Writing, 4 thanh tiêu chí (Ngữ pháp, Từ vựng, Mạch lạc, Sát nghĩa), sửa lỗi chi tiết từng câu (gạch đỏ → sửa xanh kèm giải thích), đề xuất **2 bản tham khảo (Band B1/B2 & Band C1)** và trích xuất từ vựng ăn điểm để lưu vào kho từ.
- **An toàn API Key (BYOK):** Nhập Gemini API Key miễn phí từ Google AI Studio trực tiếp trên giao diện (lưu cục bộ trên `localStorage`, không hardcode vào mã nguồn).

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ |
| :--- | :--- |
| **Frontend Framework** | React, TypeScript, Vite |
| **Styling & Icons** | Tailwind CSS, Lucide React |
| **AI Integration** | Google Gemini REST API (`gemini-2.5-flash` / `gemini-2.0-flash`) |
| **Audio & Speech** | HTML5 Audio (Synced MP3), Web Speech API (Fallback) |
| **Lưu trữ phía Client** | `localStorage` (SRS, Streak, XP, Ghi chú, Lịch sử thi & bản nháp Writing) |
| **Data & Media Pipeline** | Python 3, `ffmpeg` (nén MP3 mono 48kbps), `edge-tts`, `nltk`, `deep-translator`, `Playwright` |

---

## 📂 Cấu trúc thư mục

```text
english-learner/
├── public/
│   ├── audio/                # File MP3 Listening đã nén chuẩn giọng nói (48kbps mono)
│   ├── images/               # Ảnh minh họa Part 1, bảng biểu Part 3/4 và Part 7
│   └── data/                 # Dữ liệu JSON tĩnh tải Lazy Loading
│       ├── vocab/            # 16+ file JSON từng bộ thẻ + search-index.json
│       ├── reading/          # Dữ liệu chuyên đề Part 5, 6, 7 + reading-meta.json
│       ├── toeic/            # Bộ đề thi tổng hợp (tests/) & chuyên đề (drills/)
│       └── writing/          # Bộ đề Writing (dịch đoạn, email, quan điểm)
├── scripts/                  # Pipeline Python tạo, chuẩn hóa và kiểm định dữ liệu
│   ├── build_full_vocab.py   # Xây dựng & làm giàu kho từ vựng + search index
│   ├── validate_data.py      # Kiểm định toàn bộ schema JSON, đường dẫn ảnh/MP3/dẫn chứng
│   └── ...                   # Các script hỗ trợ chuẩn hóa đề thi và media
├── src/
│   ├── components/           # Các thành phần UI (Vocab, Reading, Listening, Writing, AudioPlayer...)
│   ├── data/                 # Metadata nhẹ (vocabDecksMeta.ts) & kiểu dữ liệu
│   ├── types/                # TypeScript Interfaces cho toàn bộ ứng dụng
│   └── utils/                # Helper SRS, Gemini API client, quản lý localStorage
├── index.html
├── tailwind.config.js
├── vite.config.ts
└── vercel.json
```

---

## 🚀 Cài đặt & Chạy cục bộ

### Yêu cầu môi trường
- **Node.js** `>= 18.x`
- **Python** `>= 3.10` và **FFmpeg** *(chỉ cần khi chạy các script kiểm định/xử lý dữ liệu trong `scripts/`)*

### Các bước chạy ứng dụng

```bash
# 1. Clone repository
git clone [https://github.com/huyngvan395/english-learner.git](https://github.com/huyngvan395/english-learner.git)
cd english-learner

# 2. Cài đặt dependencies
npm install

# 3. Chạy môi trường phát triển
npm run dev
```

Mở trình duyệt tại `http://localhost:5173/`.

### Cấu hình Google Gemini API Key cho AI Writing Studio
- **Cách 1 (Khuyên dùng):** Mở mục **Writing & AI Chấm bài** trên web → bấm **⚙ Cài đặt Gemini API** → dán API Key miễn phí lấy từ [Google AI Studio](https://aistudio.google.com/apikey) → bấm **Kiểm tra kết nối**.
- **Cách 2 (Biến môi trường cục bộ):** Tạo file `.env.local` ở thư mục gốc dự án:
  ```env
  VITE_GEMINI_API_KEY=your_gemini_api_key_here
  ```

### Kiểm định dữ liệu & Build Production

```bash
# Kiểm tra 100% tính toàn vẹn của JSON, đường dẫn ảnh, MP3 và dẫn chứng
python -u scripts/validate_data.py

# Build production
npm run build
npm run preview
```

---

## ☁️ Lưu ý khi Deploy (Vercel / GitHub)
- File `.gitignore` đã loại trừ `.env.local` và thư mục cache phiên cục bộ (`scripts/cache/`) để tránh lộ thông tin cá nhân.
- Nếu kho audio trong `public/audio/` vượt quá giới hạn dung lượng khuyên dùng của GitHub/Vercel (~100–150 MB), nên chuyển thư mục `public/audio/` sang lưu trữ tĩnh bên ngoài (như Cloudflare R2 hoặc Supabase Storage) và cấu hình base URL tương ứng.

---

## 📄 Ghi chú
Dự án được xây dựng nhằm phục vụ mục đích học tập và tự ôn luyện cá nhân. Các tài liệu luyện tập chỉ sử dụng trong phạm vi nghiên cứu và tự học.