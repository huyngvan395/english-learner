import React, { useEffect, useState } from 'react';
import { BookOpen, FileText, GraduationCap, Layers, Timer } from 'lucide-react';
import { ReadingMeta } from '../../types';
import { loadReadingMeta } from '../../utils/readingLoader';
import { ReadingPart5View } from './ReadingPart5View';
import { ReadingPart6View } from './ReadingPart6View';
import { ReadingPart7View } from './ReadingPart7View';

export const ReadingHub: React.FC = () => {
  const [part, setPart] = useState<5 | 6 | 7>(5);
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');
  const [meta, setMeta] = useState<ReadingMeta | null>(null);

  useEffect(() => {
    let mounted = true;
    loadReadingMeta()
      .then((m) => {
        if (mounted) setMeta(m);
      })
      .catch(() => {
        // Handled per-view if needed
      });
    return () => {
      mounted = false;
    };
  }, []);

  const partMeta = [
    {
      id: 5 as const,
      label: 'Part 5: Incomplete Sentences',
      sub: meta
        ? `${meta.part5.totalQuestions} câu • ${meta.part5.topics.length} chuyên đề • Phân trang 10 câu/trang`
        : 'Đang tải kho câu hỏi Part 5...',
    },
    {
      id: 6 as const,
      label: 'Part 6: Text Completion',
      sub: meta
        ? `${meta.part6.totalPassages} đoạn văn (${meta.part6.totalQuestions} câu) • Đủ dạng Điền câu`
        : 'Đang tải kho đoạn văn Part 6...',
    },
    {
      id: 7 as const,
      label: 'Part 7: Reading Comprehension',
      sub: meta
        ? `${meta.part7.totalSets} bộ (${meta.part7.singleCount} Single, ${meta.part7.doubleCount} Double, ${meta.part7.tripleCount} Triple • ${meta.part7.totalQuestions} câu)`
        : 'Đang tải kho bài đọc Part 7...',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-6 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-xs font-bold text-indigo-300">
              <FileText className="h-3.5 w-3.5" />
              TOEIC Reading Mastery — Hiểu bản chất &amp; Áp dụng thực chiến
            </div>
            <h2 className="mt-2.5 text-2xl font-extrabold text-white">
              Luyện Thi TOEIC Reading (Part 5, 6, 7)
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Tải lười theo lô siêu mượt, khung công thức bản chất chuyên đề 5 giây, giải thích 5 bước kèm phân tích khung câu, cầu nối ngữ cảnh &amp; liên kết chéo Double/Triple Passage.
            </p>
          </div>

          {/* Mode Toggle: Practice vs Exam */}
          <div className="flex items-center rounded-2xl bg-slate-900/90 p-1.5 border border-slate-700/70 shrink-0 self-start lg:self-center">
            <button
              type="button"
              onClick={() => setMode('practice')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
                mode === 'practice'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Chế độ Luyện tập
            </button>
            <button
              type="button"
              onClick={() => setMode('exam')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
                mode === 'exam'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Timer className="h-4 w-4" />
              Chế độ Thi thử
            </button>
          </div>
        </div>

        {/* Part Switcher Cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {partMeta.map((p) => {
            const active = part === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPart(p.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-indigo-500/60 bg-indigo-600/20 shadow-glow'
                    : 'border-slate-800 bg-slate-900/75 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  {p.id === 5 ? (
                    <BookOpen className="h-4 w-4 text-cyan-400" />
                  ) : p.id === 6 ? (
                    <Layers className="h-4 w-4 text-indigo-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-violet-400" />
                  )}
                  <span className="text-sm font-extrabold text-white">{p.label}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{p.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {part === 5 && <ReadingPart5View mode={mode} meta={meta} />}
      {part === 6 && <ReadingPart6View mode={mode} meta={meta} />}
      {part === 7 && <ReadingPart7View mode={mode} meta={meta} />}
    </div>
  );
};
