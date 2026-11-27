import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Filter,
  LayoutGrid,
  RotateCcw,
  XCircle,
} from 'lucide-react';

export type ListeningItemStatus = 'unanswered' | 'correct' | 'wrong';
export type ListeningStatusFilter = 'all' | 'unanswered' | 'correct' | 'wrong';

export interface ListeningNavFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface ListeningNavEntry {
  id: string;
  shortLabel: string;
  title: string;
  subLabel?: string;
  status: ListeningItemStatus;
}

interface ListeningItemNavigatorProps {
  unitLabel: string; // e.g., "Tranh", "Câu", "Hội thoại", "Bài nói"
  filterHeading: string;
  categoryFilters: ListeningNavFilterOption[];
  selectedCategory: string;
  onSelectCategory: (val: string) => void;
  statusFilter: ListeningStatusFilter;
  onSelectStatusFilter: (val: ListeningStatusFilter) => void;
  statusCounts: { all: number; unanswered: number; correct: number; wrong: number };
  items: ListeningNavEntry[];
  activeIndex: number;
  onSelectIndex: (idx: number) => void;
  onResetCurrent?: () => void;
  showResetButton?: boolean;
}

export const ListeningItemNavigator: React.FC<ListeningItemNavigatorProps> = ({
  unitLabel,
  filterHeading,
  categoryFilters,
  selectedCategory,
  onSelectCategory,
  statusFilter,
  onSelectStatusFilter,
  statusCounts,
  items,
  activeIndex,
  onSelectIndex,
  onResetCurrent,
  showResetButton = false,
}) => {
  const [gridOpen, setGridOpen] = useState(false);

  const safeIdx = items.length > 0 ? Math.min(activeIndex, items.length - 1) : 0;
  const activeItem = items[safeIdx];
  const canPrev = safeIdx > 0;
  const canNext = safeIdx < items.length - 1;

  const statusMeta = (st: ListeningItemStatus) => {
    if (st === 'correct') {
      return {
        label: 'Đúng',
        pillCls: 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300',
        dotCls: 'text-emerald-400',
      };
    }
    if (st === 'wrong') {
      return {
        label: 'Sai',
        pillCls: 'border-rose-500/45 bg-rose-500/15 text-rose-300',
        dotCls: 'text-rose-400',
      };
    }
    return {
      label: 'Chưa làm',
      pillCls: 'border-slate-700 bg-slate-800/80 text-slate-400',
      dotCls: 'text-slate-500',
    };
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] p-3.5 sm:p-4 space-y-3">
      {/* Row 1: Category / Scene / Question Type Filter */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5">
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5">
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 mr-1">
            <Filter className="h-3.5 w-3.5 text-cyan-400" />
            {filterHeading}:
          </span>
          {categoryFilters.map((cf) => (
            <button
              key={cf.value}
              type="button"
              onClick={() => onSelectCategory(cf.value)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 sm:py-1 text-xs font-bold transition ${
                selectedCategory === cf.value
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>{cf.label}</span>
              <span className="text-[10px] opacity-80">({cf.count})</span>
            </button>
          ))}
        </div>

        {/* Row 1b: Status Filter */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'all', label: `Tất cả (${statusCounts.all})` },
              { key: 'unanswered', label: `Chưa làm (${statusCounts.unanswered})` },
              { key: 'correct', label: `Đúng (${statusCounts.correct})` },
              { key: 'wrong', label: `Sai (${statusCounts.wrong})` },
            ] as { key: ListeningStatusFilter; label: string }[]
          ).map((sf) => (
            <button
              key={sf.key}
              type="button"
              onClick={() => onSelectStatusFilter(sf.key)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 sm:py-1 text-[11px] font-bold transition ${
                statusFilter === sf.key
                  ? sf.key === 'wrong'
                    ? 'bg-rose-500/20 border border-rose-400/50 text-rose-200'
                    : sf.key === 'correct'
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200'
                    : 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Compact Prev / Quick Dropdown-Grid Picker / Next + Retry */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-800/85">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => onSelectIndex(safeIdx - 1)}
            className="min-h-[40px] shrink-0 inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 disabled:opacity-35 px-2.5 sm:px-3 py-2 text-xs font-bold text-slate-200 transition active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{unitLabel} trước</span>
          </button>

          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => setGridOpen((v) => !v)}
            className="min-h-[40px] flex-1 min-w-0 flex items-center justify-between gap-2 rounded-xl border border-indigo-500/40 bg-slate-900/95 hover:border-indigo-400/70 px-3 py-2 text-left transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <LayoutGrid className="h-4 w-4 text-indigo-400 shrink-0" />
              {activeItem ? (
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-white shrink-0">
                    {activeItem.shortLabel}{' '}
                    <span className="text-slate-400 font-semibold">
                      ({safeIdx + 1}/{items.length})
                    </span>
                  </span>
                  <span className="hidden md:inline truncate text-xs text-slate-400">
                    — {activeItem.title}
                  </span>
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                      statusMeta(activeItem.status).pillCls
                    }`}
                  >
                    {statusMeta(activeItem.status).label}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">Không có bài phù hợp</span>
              )}
            </div>
            {gridOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            )}
          </button>

          <button
            type="button"
            disabled={!canNext}
            onClick={() => onSelectIndex(safeIdx + 1)}
            className="min-h-[40px] shrink-0 inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 disabled:opacity-35 px-2.5 sm:px-3 py-2 text-xs font-bold text-slate-200 transition active:scale-95"
          >
            <span className="hidden sm:inline">{unitLabel} sau</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {showResetButton && onResetCurrent && (
          <button
            type="button"
            onClick={onResetCurrent}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:text-white transition shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Làm lại
          </button>
        )}
      </div>

      {/* Collapsible Quick-Jump Grid (scales effortlessly to 60+ items) */}
      {gridOpen && items.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="font-bold text-slate-300">
              Chọn nhanh {unitLabel.toLowerCase()} ({items.length} mục khớp bộ lọc)
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Circle className="h-3 w-3 text-slate-500" /> Chưa làm
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Đúng
              </span>
              <span className="inline-flex items-center gap-1 text-rose-300">
                <XCircle className="h-3 w-3" /> Sai
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-0.5">
            {items.map((item, i) => {
              const isCurrent = i === safeIdx;
              let cls =
                'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-600 hover:text-white';
              if (isCurrent) {
                cls =
                  'border-indigo-400 bg-gradient-to-r from-blue-600/35 to-indigo-600/35 text-white ring-1 ring-indigo-400/50';
              } else if (item.status === 'correct') {
                cls =
                  'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20';
              } else if (item.status === 'wrong') {
                cls = 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20';
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectIndex(i);
                    setGridOpen(false);
                  }}
                  className={`rounded-xl border px-2.5 py-2 text-left transition ${cls}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold truncate">{item.shortLabel}</span>
                    {item.status === 'correct' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : item.status === 'wrong' ? (
                      <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 text-slate-600 shrink-0" />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] opacity-80">
                    {item.subLabel || item.title}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface ListeningBottomNavBarProps {
  unitLabel: string;
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
}

export const ListeningBottomNavBar: React.FC<ListeningBottomNavBarProps> = ({
  unitLabel,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
}) => {
  if (totalCount <= 1) return null;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < totalCount - 1;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] px-3.5 sm:px-4 py-3 flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => {
          onPrev();
          window.scrollTo({ top: 140, behavior: 'smooth' });
        }}
        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-35 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-slate-200 transition active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
        {unitLabel} trước
      </button>

      <span className="text-xs sm:text-sm font-extrabold text-slate-300">
        {unitLabel} <span className="text-sky-300">{currentIndex + 1}</span> / {totalCount}
      </span>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => {
          onNext();
          window.scrollTo({ top: 140, behavior: 'smooth' });
        }}
        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-35 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition active:scale-95"
      >
        {unitLabel} sau
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
