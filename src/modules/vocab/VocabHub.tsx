import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Filter,
  Loader2,
  Play,
  Search,
  Sparkles,
  Unlock,
} from 'lucide-react';
import {
  DECK_CATEGORY_META,
  TOTAL_VOCAB_COUNT,
  VOCAB_DECKS_META,
  VOCAB_TAGS,
} from '../../data/vocabDecksMeta';
import { VocabDeck, VocabDeckMeta, VocabTag } from '../../types';
import { useApp } from '../../context/AppContext';
import { loadVocabDeck } from '../../utils/vocabLoader';
import { DeckCoverArt } from '../../components/DeckCoverArt';
import { DeckStudyView } from './DeckStudyView';

export const VocabHub: React.FC = () => {
  const { vocabProgress, getDeckStats } = useApp();
  const [selectedTag, setSelectedTag] = useState<'all' | VocabTag>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDeck, setActiveDeck] = useState<VocabDeck | null>(null);
  const [loadingDeckId, setLoadingDeckId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const filteredDecks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return VOCAB_DECKS_META.filter((deck) => {
      const matchTag = selectedTag === 'all' || deck.tags.includes(selectedTag);
      const matchSearch =
        !q ||
        deck.title.toLowerCase().includes(q) ||
        deck.subtitle.toLowerCase().includes(q) ||
        deck.levelLabel.toLowerCase().includes(q) ||
        deck.tags.some((t) => t.includes(q));
      return matchTag && matchSearch;
    });
  }, [selectedTag, searchTerm]);

  const handleOpenDeck = async (meta: VocabDeckMeta) => {
    setLoadError(null);
    setLoadingDeckId(meta.id);
    try {
      const fullDeck = await loadVocabDeck(meta.id);
      setActiveDeck(fullDeck);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Lỗi tải bộ thẻ từ vựng.');
    } finally {
      setLoadingDeckId(null);
    }
  };

  if (activeDeck) {
    return <DeckStudyView deck={activeDeck} onBack={() => setActiveDeck(null)} />;
  }

  const totalMastered = Object.values(vocabProgress).filter((p) => p.status === 'mastered').length;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-6 sm:p-8 shadow-card">
        <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
              <Unlock className="h-3.5 w-3.5" />
              Mở khóa miễn phí 100% • Tải siêu tốc Lazy Loading
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Kho Từ Vựng Đa Chiều Chuẩn Parroto &amp; TOEIC 990
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              16 bộ thẻ phân tách đầy đủ Oxford A1–C1 &amp; TOEIC chuyên sâu. Gõ từ chủ động Active Recall,
              gợi ý từng chữ cái, lặp lại ngắt quãng SRS và phát âm US/UK mượt mà.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 px-5 py-3.5">
              <p className="text-[11px] font-semibold uppercase text-slate-400">Tổng kho từ</p>
              <p className="mt-1 text-2xl font-extrabold text-white">
                {TOTAL_VOCAB_COUNT.toLocaleString('vi-VN')} từ
              </p>
              <p className="text-[11px] text-indigo-400">{VOCAB_DECKS_META.length} bộ thẻ độc lập</p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 px-5 py-3.5">
              <p className="text-[11px] font-semibold uppercase text-slate-400">Đã thuộc</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-400">{totalMastered}</p>
              <p className="text-[11px] text-slate-400">
                {Math.round((totalMastered / Math.max(1, TOTAL_VOCAB_COUNT)) * 100)}% hoàn thành
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Load error toast if any */}
      {loadError && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Multi-dimensional Filter Bar: Search + Tags */}
      <div className="rounded-2xl border border-slate-800 bg-[#111827]/90 p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Filter className="h-4 w-4 text-indigo-400" />
            <span>Lọc bộ thẻ theo Tag &amp; Trình độ CEFR</span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên bộ thẻ (VD: Oxford A1, ETS...)"
              className="w-full rounded-xl border border-slate-700/70 bg-slate-900 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedTag('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              selectedTag === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Tất cả ({VOCAB_DECKS_META.length})
          </button>
          {VOCAB_TAGS.map((tag) => {
            const active = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm'
                    : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-100 border border-slate-700/50'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Categorized Deck Sections */}
      {filteredDecks.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 text-center">
          <p className="text-base font-bold text-slate-200">Không tìm thấy bộ thẻ phù hợp</p>
          <p className="mt-1 text-sm text-slate-400">
            Hãy thử chọn lại Tag &ldquo;Tất cả&rdquo; hoặc xóa từ khóa tìm kiếm.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedTag('all');
              setSearchTerm('');
            }}
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {DECK_CATEGORY_META.map((cat) => {
            const catDecks = filteredDecks.filter((d) => d.category === cat.key);
            if (catDecks.length === 0) return null;

            return (
              <section key={cat.key} className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-extrabold text-white">{cat.title}</h3>
                      <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 text-[11px] font-bold text-indigo-300">
                        {cat.badge}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs sm:text-sm text-slate-400">{cat.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {catDecks.map((deck) => {
                    const { studiedCount, masteredCount } = getDeckStats(deck.id);
                    const pct = Math.round((masteredCount / Math.max(1, deck.wordCount)) * 100);
                    const isInProgress = studiedCount > 0;
                    const isLoading = loadingDeckId === deck.id;

                    return (
                      <div
                        key={deck.id}
                        className={`group relative flex flex-col rounded-2xl border bg-[#1E293B] shadow-card hover:-translate-y-0.5 transition-all duration-200 overflow-hidden ${
                          isInProgress
                            ? 'border-sky-500/60 hover:border-sky-400'
                            : 'border-slate-700/70 hover:border-indigo-500/60'
                        }`}
                      >
                        <div className="relative">
                          <DeckCoverArt
                            theme={deck.coverTheme}
                            gradient={deck.accentGradient}
                            badgeText={deck.badgeText}
                            levelLabel={deck.levelLabel}
                          />
                          {isInProgress && (
                            <span className="absolute bottom-3 left-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-sky-500/95 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-950 shadow-md">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-950 animate-pulse" />
                              ĐANG HỌC
                            </span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col p-5">
                          <h4 className="text-base font-extrabold text-white group-hover:text-sky-300 transition line-clamp-2">
                            {deck.title}
                          </h4>
                          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed line-clamp-2">
                            {deck.subtitle}
                          </p>

                          {/* Tags */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {deck.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md bg-slate-900/90 border border-slate-700/70 px-2 py-0.5 text-[10px] font-semibold text-slate-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* Progress bar */}
                          <div className="mt-auto pt-4">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                                <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                                {deck.topicCount} chủ đề • {deck.wordCount.toLocaleString('vi-VN')} thẻ
                              </span>
                              {isInProgress ? (
                                <span className="inline-flex items-center gap-1 font-bold text-sky-300">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  Đã học {studiedCount} từ ({pct}%)
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-500">0%</span>
                              )}
                            </div>

                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isInProgress
                                    ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-emerald-400'
                                    : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            <button
                              type="button"
                              disabled={loadingDeckId !== null}
                              onClick={() => handleOpenDeck(deck)}
                              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60 ${
                                isInProgress
                                  ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:shadow-glow hover:from-sky-400 hover:to-indigo-500'
                                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:shadow-glow hover:from-blue-500 hover:to-violet-500'
                              }`}
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Đang tải bộ thẻ...
                                </>
                              ) : isInProgress ? (
                                <>
                                  <Play className="h-4 w-4 fill-white" />
                                  TIẾP TỤC HỌC
                                  <ArrowRight className="h-4 w-4" />
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4" />
                                  Bắt đầu học
                                  <ArrowRight className="h-4 w-4" />
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
