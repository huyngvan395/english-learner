import React, { useState } from 'react';
import { Headphones, Image, MessageCircle, Mic, Users } from 'lucide-react';
import { ListeningPart1View } from './ListeningPart1View';
import { ListeningPart2View } from './ListeningPart2View';
import { ListeningPart34View } from './ListeningPart34View';

export const ListeningHub: React.FC = () => {
  const [part, setPart] = useState<1 | 2 | 3 | 4>(1);

  const parts = [
    { id: 1 as const, label: 'Part 1: Photographs', sub: '6 ảnh thực tế + MP3 • Ẩn chữ chuẩn thi', icon: Image },
    { id: 2 as const, label: 'Part 2: Q & Response', sub: '10 câu + MP3 • Trả lời gián tiếp & bẫy âm', icon: MessageCircle },
    { id: 3 as const, label: 'Part 3: Conversations', sub: '3 hội thoại (9 câu) + MP3 • Mỹ/Anh/Úc', icon: Users },
    { id: 4 as const, label: 'Part 4: Short Talks', sub: '3 bài nói (9 câu) + MP3 • Bảng biểu & Hàm ý', icon: Mic },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-6 shadow-card">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-300">
          <Headphones className="h-3.5 w-3.5" />
          TOEIC Listening Studio — Giọng AI đa vai Nam/Nữ (US/UK) + Sẵn sàng MP3
        </div>
        <h2 className="mt-2.5 text-2xl font-extrabold text-white">
          Luyện Thi TOEIC Listening (Part 1, 2, 3, 4)
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Interactive Transcript bấm nghe lại từng câu, chế độ lặp 1 câu Shadowing, bản đồ Paraphrase, bóc tách bẫy âm thanh &amp; lưu từ vựng ngay tức thì.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {parts.map((p) => {
            const Icon = p.icon;
            const active = part === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPart(p.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-cyan-500/60 bg-indigo-600/20 shadow-glow'
                    : 'border-slate-800 bg-slate-900/75 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className="text-sm font-extrabold text-white">{p.label}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{p.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {part === 1 && <ListeningPart1View />}
      {part === 2 && <ListeningPart2View />}
      {part === 3 && <ListeningPart34View key="part3" part={3} />}
      {part === 4 && <ListeningPart34View key="part4" part={4} />}
    </div>
  );
};
