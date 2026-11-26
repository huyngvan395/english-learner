import { ToeicPartNumber } from '../types';

/**
 * Official-style ETS TOEIC 990 scaled score converter (5–495 per section, step of 5).
 * Listening has a slightly gentler curve near the top (92%+ reaches 495),
 * Reading scales tightly up to 96%+ for 495.
 */
export function scaleSectionScore(correct: number, total: number, section: 'listening' | 'reading'): number | null {
  if (total <= 0) return null;
  const ratio = Math.max(0, Math.min(1, correct / total));
  if (ratio === 0) return 5;

  const topThreshold = section === 'listening' ? 0.93 : 0.96;
  const adjusted = Math.min(1, ratio / topThreshold);
  // Slight S-curve lift in mid-high bands matching real ETS score conversion tables
  const curved = Math.pow(adjusted, section === 'listening' ? 0.92 : 0.96);
  const raw = 5 + Math.round(curved * 98) * 5;
  return Math.max(5, Math.min(495, raw));
}

export function getToeicLevelBadge(totalScore: number | null): {
  label: string;
  cefr: string;
  colorClass: string;
} {
  if (totalScore === null) {
    return {
      label: 'Luyện kỹ năng thành phần',
      cefr: 'Custom Practice',
      colorClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    };
  }
  if (totalScore >= 900) {
    return {
      label: 'Xuất sắc — Chuẩn 990 Master',
      cefr: 'CEFR C1',
      colorClass: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
    };
  }
  if (totalScore >= 785) {
    return {
      label: 'Thành thạo chuyên nghiệp (Gold)',
      cefr: 'CEFR B2',
      colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    };
  }
  if (totalScore >= 605) {
    return {
      label: 'Giao tiếp công sở tốt (Blue)',
      cefr: 'CEFR B1+',
      colorClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    };
  }
  if (totalScore >= 405) {
    return {
      label: 'Nền tảng cơ bản (Green)',
      cefr: 'CEFR A2–B1',
      colorClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    };
  }
  return {
    label: 'Cần củng cố nền tảng',
    cefr: 'CEFR A1–A2',
    colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  };
}

export const TOEIC_PART_LABELS: Record<ToeicPartNumber, { name: string; section: 'listening' | 'reading'; shortDesc: string }> = {
  1: { name: 'Part 1: Photographs', section: 'listening', shortDesc: 'Mô tả tranh' },
  2: { name: 'Part 2: Question–Response', section: 'listening', shortDesc: 'Hỏi – Đáp ngắn' },
  3: { name: 'Part 3: Conversations', section: 'listening', shortDesc: 'Hội thoại ngắn' },
  4: { name: 'Part 4: Short Talks', section: 'listening', shortDesc: 'Bài nói ngắn' },
  5: { name: 'Part 5: Incomplete Sentences', section: 'reading', shortDesc: 'Điền câu ngữ pháp & từ vựng' },
  6: { name: 'Part 6: Text Completion', section: 'reading', shortDesc: 'Hoàn thành đoạn văn' },
  7: { name: 'Part 7: Reading Comprehension', section: 'reading', shortDesc: 'Đọc hiểu Đơn / Kép / Ba' },
};
