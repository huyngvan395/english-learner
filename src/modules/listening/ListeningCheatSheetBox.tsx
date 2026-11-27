import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Headphones,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';
import { ListeningCheatSheet } from '../../data/listeningCheatSheets';

interface ListeningCheatSheetBoxProps {
  sheet: ListeningCheatSheet;
  defaultOpen?: boolean;
}

export const ListeningCheatSheetBox: React.FC<ListeningCheatSheetBoxProps> = ({
  sheet,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-cyan-500/35 bg-gradient-to-br from-[#12203A] via-[#111B30] to-[#0F172A] shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-white/[0.03] transition"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-400/35 text-cyan-300">
            <Headphones className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-cyan-500/15 border border-cyan-400/35 px-2 py-0.5 text-cyan-300">
                {sheet.badge}
              </span>
              <h3 className="text-xs sm:text-base font-extrabold text-white leading-snug">
                Bản chất &amp; Chiến thuật nghe: {sheet.title}
              </h3>
            </div>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-900/85 border border-slate-700/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 shrink-0">
          {open ? (
            <>
              <span className="hidden sm:inline">Thu gọn</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Mở chiến thuật</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-800/80 px-4 sm:px-5 py-4 space-y-4">
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

          {/* 2. Quy trình nghe thực chiến */}
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
              <Zap className="h-3.5 w-3.5" />
              2. Chiến thuật làm bài thực chiến
            </div>
            <ul className="mt-2 space-y-1.5">
              {sheet.tactics.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-emerald-100/95">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/25 text-[10px] font-extrabold text-emerald-300">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Bảng tra cứu nhanh (Sound traps / Indirect responses / Graphic & Implied) */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
              <Volume2 className="h-3.5 w-3.5" />
              3. {sheet.highlightSectionTitle}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sheet.highlightItems.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1"
                >
                  <span className="inline-block rounded-md bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-xs font-extrabold text-indigo-200">
                    {item.label}
                  </span>
                  <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Top 3 bẫy ETS */}
          <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              4. Top 3 bẫy ETS hay gài nhất &amp; Ví dụ nhận diện
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
