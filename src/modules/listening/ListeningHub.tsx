import React, { useEffect, useState } from 'react';
import { Headphones, Image, MessageCircle, Mic, Users } from 'lucide-react';
import { ListeningMeta } from '../../types';
import { loadListeningMeta } from '../../utils/listeningLoader';
import { ListeningPart1View } from './ListeningPart1View';
import { ListeningPart2View } from './ListeningPart2View';
import { ListeningPart34View } from './ListeningPart34View';

export const ListeningHub: React.FC = () => {
  const [part, setPart] = useState<1 | 2 | 3 | 4>(1);
  const [meta, setMeta] = useState<ListeningMeta | null>(null);

  useEffect(() => {
    let mounted = true;
    loadListeningMeta()
      .then((m) => {
        if (mounted) setMeta(m);
      })
      .catch(() => {
        // Handled per-view if fetch fails
      });
    return () => {
      mounted = false;
    };
  }, []);

  const parts = [
    {
      id: 1 as const,
      label: 'Part 1: Photographs',
      sub: meta
        ? `${meta.part1.totalQuestions} ảnh thực tế + MP3 • Ẩn chữ chuẩn thi`
        : 'Đang tải kho ảnh Part 1...',
      icon: Image,
    },
    {
      id: 2 as const,
      label: 'Part 2: Q & Response',
      sub: meta
        ? `${meta.part2.totalQuestions} câu + MP3 • Trả lời gián tiếp & bẫy âm`
        : 'Đang tải kho câu hỏi Part 2...',
      icon: MessageCircle,
    },
    {
      id: 3 as const,
      label: 'Part 3: Conversations',
      sub: meta
        ? `${meta.part3.totalSets} hội thoại (${meta.part3.totalQuestions} câu) • Mỹ/Anh/Úc`
        : 'Đang tải kho hội thoại Part 3...',
      icon: Users,
    },
    {
      id: 4 as const,
      label: 'Part 4: Short Talks',
      sub: meta
        ? `${meta.part4.totalSets} bài nói (${meta.part4.totalQuestions} câu) • Bảng biểu & Hàm ý`
        : 'Đang tải kho bài nói Part 4...',
      icon: Mic,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-5 sm:p-6 shadow-card">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-300">
          <Headphones className="h-3.5 w-3.5" />
          TOEIC Listening Studio — Tải lười theo lô • Chiến thuật nghe sâu chuẩn ETS
        </div>
        <h2 className="mt-2.5 text-xl sm:text-2xl font-extrabold text-white">
          Luyện Thi TOEIC Listening (Part 1, 2, 3, 4)
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Khung bản chất &amp; chiến thuật nghe theo từng Part, Interactive Transcript bấm nghe lại từng câu, chế độ lặp 1 câu Shadowing, bóc tách bẫy âm thanh &amp; mẹo bắt từ khóa trong 2 giây.
        </p>

        <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
          {parts.map((p) => {
            const Icon = p.icon;
            const active = part === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPart(p.id)}
                className={`rounded-2xl border p-3.5 sm:p-4 text-left transition ${
                  active
                    ? 'border-indigo-400 bg-indigo-50 shadow-sm dark:border-cyan-400/50 dark:bg-indigo-500/15 dark:shadow-glow'
                    : 'border-slate-200 bg-white/90 hover:border-slate-300 dark:border-slate-800/90 dark:bg-[#1E293B]/60 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={`h-4 w-4 ${
                      active
                        ? 'text-indigo-600 dark:text-cyan-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                  <span
                    className={`text-sm font-extrabold ${
                      active ? 'text-indigo-900 dark:text-white' : 'text-slate-800 dark:text-white'
                    }`}
                  >
                    {p.label}
                  </span>
                </div>
                <p
                  className={`mt-1 text-xs ${
                    active ? 'text-indigo-700/80 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {p.sub}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {part === 1 && <ListeningPart1View meta={meta} />}
      {part === 2 && <ListeningPart2View meta={meta} />}
      {part === 3 && <ListeningPart34View key="part3" part={3} meta={meta} />}
      {part === 4 && <ListeningPart34View key="part4" part={4} meta={meta} />}
    </div>
  );
};
