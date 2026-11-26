import { DeckCategory, VocabDeckMeta, VocabTag } from '../types';

export const VOCAB_TAGS: VocabTag[] = [
  '#a1',
  '#a2',
  '#b1',
  '#b2',
  '#c1',
  '#common',
  '#communication',
  '#oxford',
  '#toeic',
  '#ets',
  '#idioms',
  '#ielts',
  '#thpt',
  '#sat',
  '#toefl',
  '#topic',
];

export const DECK_CATEGORY_META: {
  key: DeckCategory;
  title: string;
  description: string;
  badge: string;
}[] = [
  {
    key: 'toeic',
    title: 'Từ Vựng TOEIC Chuyên Sâu',
    description: 'Ưu tiên nội dung phong phú nhất — bám sát cấu trúc đề thi thật ETS & bẫy Paraphrase.',
    badge: 'Trọng tâm 990',
  },
  {
    key: 'oxford',
    title: 'Từ Vựng Chuẩn Oxford (Phân cấp CEFR A1 – C1)',
    description: 'Tách riêng 6 bộ thẻ chuẩn Oxford 3000 & Oxford 5000 theo đúng cấp độ từ A1 đến C1.',
    badge: '6 Bộ CEFR',
  },
  {
    key: 'common',
    title: 'Từ Vựng Tiếng Anh Thông Dụng',
    description: 'Bộ từ nền tảng giúp giao tiếp tự tin và đọc hiểu trôi chảy mỗi ngày.',
    badge: 'Cơ bản – Giao tiếp',
  },
  {
    key: 'academic',
    title: 'Từ Vựng Học Thuật & Kỳ Thi Khác',
    description: 'Mở rộng vốn từ cho IELTS, THPT Quốc gia, SAT, TOEFL và 5 chủ đề doanh nghiệp.',
    badge: 'Học thuật & Chuyên ngành',
  },
];

// Auto-updated by scripts/build_full_vocab.py — lightweight metadata only (Zero full words bundled in JS!)
export const VOCAB_DECKS_META: VocabDeckMeta[] = [
  {
    "id": "toeic-600",
    "title": "600 Từ Vựng Thiết Yếu Cho TOEIC",
    "subtitle": "Bộ từ cốt lõi phủ sóng 85% ngữ cảnh Hợp đồng, Marketing, Nhân sự, Văn phòng & Tài chính.",
    "category": "toeic",
    "levelLabel": "B1 – B2",
    "tags": [
      "#b1",
      "#b2",
      "#toeic"
    ],
    "coverTheme": "toeic-600",
    "accentGradient": "from-blue-600 via-indigo-600 to-violet-600",
    "badgeText": "HOT TOEIC",
    "topicCount": 24,
    "wordCount": 600
  },
  {
    "id": "toeic-ets",
    "title": "Từ Vựng ETS TOEIC (Tần Suất Cao Đề Thật)",
    "subtitle": "Tổng hợp những từ & bẫy paraphrase xuất hiện dày đặc trong bộ đề thi ETS 2022–2026.",
    "category": "toeic",
    "levelLabel": "B2 – C1",
    "tags": [
      "#b2",
      "#c1",
      "#toeic",
      "#ets"
    ],
    "coverTheme": "toeic-ets",
    "accentGradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "badgeText": "ETS REAL TEST",
    "topicCount": 39,
    "wordCount": 1250
  },
  {
    "id": "toeic-idioms",
    "title": "Thành Ngữ & Collocations TOEIC Phổ Biến",
    "subtitle": "Cụm động từ, cụm giới từ và thành ngữ công sở ăn điểm tuyệt đối ở Part 2, 3, 5 & 7.",
    "category": "toeic",
    "levelLabel": "B2",
    "tags": [
      "#b2",
      "#toeic",
      "#idioms",
      "#ets"
    ],
    "coverTheme": "toeic-idioms",
    "accentGradient": "from-cyan-500 via-blue-600 to-indigo-600",
    "badgeText": "COLLOCATIONS",
    "topicCount": 7,
    "wordCount": 136
  },
  {
    "id": "common-1000",
    "title": "1000 Từ Tiếng Anh Thông Dụng",
    "subtitle": "Nền tảng vững chắc cho người mới bắt đầu, bao quát từ vựng xuất hiện hàng ngày.",
    "category": "common",
    "levelLabel": "A1 – A2",
    "tags": [
      "#a1",
      "#a2",
      "#common"
    ],
    "coverTheme": "common-1000",
    "accentGradient": "from-emerald-500 via-teal-500 to-cyan-600",
    "badgeText": "NỀN TẢNG",
    "topicCount": 31,
    "wordCount": 1000
  },
  {
    "id": "communication-daily",
    "title": "Từ Vựng Tiếng Anh Giao Tiếp",
    "subtitle": "Phản xạ nhanh trong giao tiếp công sở, đặt lịch hẹn, điện thoại & trò chuyện tự nhiên.",
    "category": "common",
    "levelLabel": "A2 – B1",
    "tags": [
      "#a2",
      "#b1",
      "#communication",
      "#common"
    ],
    "coverTheme": "communication",
    "accentGradient": "from-sky-500 via-blue-500 to-indigo-600",
    "badgeText": "GIAO TIẾP",
    "topicCount": 12,
    "wordCount": 320
  },
  {
    "id": "oxford-3000-a1",
    "title": "Từ Vựng Oxford 3000 A1",
    "subtitle": "Nền tảng cốt lõi cấp độ Sơ cấp (A1) trong danh sách chuẩn Oxford 3000.",
    "category": "oxford",
    "levelLabel": "CEFR A1",
    "tags": [
      "#a1",
      "#oxford"
    ],
    "coverTheme": "oxford-3000",
    "accentGradient": "from-emerald-500 via-green-500 to-teal-600",
    "badgeText": "OXFORD A1",
    "topicCount": 27,
    "wordCount": 912
  },
  {
    "id": "oxford-3000-a2",
    "title": "3000 Từ Vựng Oxford A2",
    "subtitle": "Từ vựng giao tiếp & đọc hiểu Sơ trung cấp (A2) chuẩn khung tham chiếu Oxford 3000.",
    "category": "oxford",
    "levelLabel": "CEFR A2",
    "tags": [
      "#a2",
      "#oxford"
    ],
    "coverTheme": "oxford-3000",
    "accentGradient": "from-sky-500 via-blue-500 to-cyan-600",
    "badgeText": "OXFORD A2",
    "topicCount": 26,
    "wordCount": 882
  },
  {
    "id": "oxford-3000-b1",
    "title": "3000 Từ Vựng Oxford B1",
    "subtitle": "Từ vựng Trung cấp (B1) bứt phá đọc hiểu và mục tiêu TOEIC 600–750.",
    "category": "oxford",
    "levelLabel": "CEFR B1",
    "tags": [
      "#b1",
      "#oxford"
    ],
    "coverTheme": "oxford-3000",
    "accentGradient": "from-amber-500 via-orange-500 to-amber-600",
    "badgeText": "OXFORD B1",
    "topicCount": 24,
    "wordCount": 816
  },
  {
    "id": "oxford-3000-b2",
    "title": "3000 Từ Vựng Oxford B2",
    "subtitle": "Nhóm từ Trung cao cấp (B2) quan trọng nhất trong Oxford 3000 cho TOEIC 800+.",
    "category": "oxford",
    "levelLabel": "CEFR B2",
    "tags": [
      "#b2",
      "#oxford"
    ],
    "coverTheme": "oxford-3000",
    "accentGradient": "from-orange-500 via-rose-500 to-red-600",
    "badgeText": "OXFORD B2",
    "topicCount": 22,
    "wordCount": 736
  },
  {
    "id": "oxford-5000-b2",
    "title": "5000 Từ Vựng Oxford B2",
    "subtitle": "Từ vựng mở rộng trình độ B2 trong bộ Oxford 5000 giúp đọc báo chí kinh tế trôi chảy.",
    "category": "oxford",
    "levelLabel": "5000 • B2",
    "tags": [
      "#b2",
      "#oxford"
    ],
    "coverTheme": "oxford-5000",
    "accentGradient": "from-rose-600 via-pink-600 to-fuchsia-600",
    "badgeText": "OXFORD 5000 B2",
    "topicCount": 21,
    "wordCount": 715
  },
  {
    "id": "oxford-5000-c1",
    "title": "5000 Từ Vựng Oxford C1",
    "subtitle": "Tinh hoa học thuật trình độ Cao cấp (C1) của Oxford 5000 cho TOEIC 950+ & IELTS 8.0.",
    "category": "oxford",
    "levelLabel": "5000 • C1",
    "tags": [
      "#c1",
      "#oxford"
    ],
    "coverTheme": "oxford-5000",
    "accentGradient": "from-purple-600 via-violet-600 to-indigo-700",
    "badgeText": "OXFORD 5000 C1",
    "topicCount": 39,
    "wordCount": 1329
  },
  {
    "id": "ielts-core",
    "title": "IELTS Cơ Bản & Nâng Cao (Band 4–9)",
    "subtitle": "Từ vựng học thuật chủ đề Môi trường, Giáo dục, Công nghệ & Xã hội cho Reading & Writing.",
    "category": "academic",
    "levelLabel": "Band 4.5 – 8.5",
    "tags": [
      "#b1",
      "#b2",
      "#c1",
      "#ielts"
    ],
    "coverTheme": "ielts",
    "accentGradient": "from-red-500 via-rose-600 to-orange-500",
    "badgeText": "IELTS",
    "topicCount": 19,
    "wordCount": 600
  },
  {
    "id": "thpt-qg",
    "title": "Từ Vựng Chuyên Sâu THPT Quốc Gia",
    "subtitle": "Từ vựng, cụm từ cố định & dễ nhầm lẫn trọng tâm đề thi tốt nghiệp THPT môn Tiếng Anh.",
    "category": "academic",
    "levelLabel": "B1 – B2",
    "tags": [
      "#b1",
      "#b2",
      "#thpt"
    ],
    "coverTheme": "thpt",
    "accentGradient": "from-teal-500 via-emerald-600 to-green-600",
    "badgeText": "THPT QG",
    "topicCount": 16,
    "wordCount": 500
  },
  {
    "id": "sat-core",
    "title": "Từ Vựng SAT Cốt Lõi",
    "subtitle": "Từ vựng học thuật sắc bén xuất hiện nhiều trong Digital SAT Reading & Writing.",
    "category": "academic",
    "levelLabel": "C1",
    "tags": [
      "#c1",
      "#sat"
    ],
    "coverTheme": "sat",
    "accentGradient": "from-indigo-600 via-blue-700 to-slate-700",
    "badgeText": "SAT CORE",
    "topicCount": 14,
    "wordCount": 400
  },
  {
    "id": "toefl-essential",
    "title": "Từ Vựng Thiết Yếu Cho TOEFL",
    "subtitle": "Từ vựng học thuật Đại học (Khoa học, Sinh học, Lịch sử, Kinh tế) chuẩn TOEFL iBT.",
    "category": "academic",
    "levelLabel": "B2 – C1",
    "tags": [
      "#b2",
      "#c1",
      "#toefl"
    ],
    "coverTheme": "toefl",
    "accentGradient": "from-fuchsia-600 via-purple-600 to-indigo-600",
    "badgeText": "TOEFL iBT",
    "topicCount": 15,
    "wordCount": 450
  },
  {
    "id": "topic-business",
    "title": "Từ Vựng Theo Chủ Đề (Công sở, Tài chính, Nhân sự, Marketing, Du lịch)",
    "subtitle": "5 nhóm chủ đề thiết yếu cho môi trường doanh nghiệp quốc tế và bài đọc TOEIC Part 7.",
    "category": "academic",
    "levelLabel": "B1 – B2",
    "tags": [
      "#b1",
      "#b2",
      "#topic",
      "#toeic"
    ],
    "coverTheme": "topic-business",
    "accentGradient": "from-blue-500 via-cyan-500 to-teal-500",
    "badgeText": "5 CHỦ ĐỀ",
    "topicCount": 15,
    "wordCount": 350
  }
] as VocabDeckMeta[];

export const TOTAL_VOCAB_COUNT: number = VOCAB_DECKS_META.reduce((sum, d) => sum + d.wordCount, 0);
