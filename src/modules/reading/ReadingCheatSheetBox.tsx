import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ReadingCheatSheet } from '../../data/readingCheatSheets';

interface ReadingCheatSheetBoxProps {
  sheet: ReadingCheatSheet;
  defaultOpen?: boolean;
}

export const ReadingCheatSheetBox: React.FC<ReadingCheatSheetBoxProps> = ({
  sheet,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-indigo-500/35 bg-gradient-to-br from-[#16213E] via-[#131C33] to-[#0F172A] shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-white/[0.03] transition"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-400/35 text-indigo-300">
            <BookOpenCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-amber-500/15 border border-amber-400/35 px-2 py-0.5 text-amber-300">
                {sheet.badge}
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                Bản chất &amp; Công thức áp dụng: {sheet.title}
              </h3>
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-900/80 border border-slate-700/80 px-2.5 py-1 text-[11px] font-bold text-slate-300 shrink-0">
          {open ? (
            <>
              Thu gọn <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Mở công thức <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-800/80 px-5 py-4 space-y-4">
          {/* 1. Bản chất cốt lõi */}
          <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
              <Sparkles className="h-3.5 w-3.5" />
              1. Bản chất cốt lõi
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
              {sheet.coreEssence}
            </p>
          </div>

          {/* 2. Công thức nhận diện nhanh 5 giây */}
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
              <Zap className="h-3.5 w-3.5" />
              2. Công thức nhận diện nhanh trong 5 giây
            </div>
            <ul className="mt-2 space-y-1.5">
              {sheet.fiveSecondFormulas.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-emerald-100/95">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/25 text-[10px] font-extrabold text-emerald-300">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Top 3 bẫy ETS */}
          <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              3. Top 3 bẫy ETS hay lừa nhất &amp; Ví dụ nhanh
            </div>
            <div className="mt-2.5 grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              {sheet.topTraps.map((t, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-800 bg-slate-950/65 p-3 space-y-1.5"
                >
                  <p className="text-xs font-bold text-amber-200 leading-snug">
                    Bẫy #{i + 1}: {t.trap}
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed border-t border-slate-800/80 pt-1.5">
                    <span className="font-semibold text-cyan-300">VD: </span>
                    {t.example}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
