import React, { useMemo, useState } from 'react';
import {
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  Star,
  Volume2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SearchIndexEntry, VocabWord } from '../../types';
import { loadVocabDeck } from '../../utils/vocabLoader';
import { speakText } from '../../utils/speech';
import { FlashcardMode } from '../vocab/FlashcardMode';

type FilterKey = 'all' | 'srs-due' | 'starred' | 'mastered';

export const MyVocabView: React.FC = () => {
  const { searchIndex, customWords, vocabProgress, toggleSaveWord, markWordStatus } = useApp();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [studyWords, setStudyWords] = useState<VocabWord[] | null>(null);
  const [loadingFlashcards, setLoadingFlashcards] = useState(false);

  const trackedEntries = useMemo(() => {
    return searchIndex.filter((w) => {
      const p = vocabProgress[w.id];
      if (!p) return false;
      return p.saved || p.status !== 'new';
    });
  }, [searchIndex, vocabProgress]);

  const filteredEntries = useMemo(() => {
    const now = Date.now();
    return trackedEntries.filter((w) => {
      const p = vocabProgress[w.id];
      if (!p) return false;
      if (filter === 'starred') return p.saved;
      if (filter === 'mastered') return p.status === 'mastered';
      if (filter === 'srs-due') {
        if (p.permanentlyMastered) return false;
        return (
          p.status === 'forgotten' ||
          p.status === 'vague' ||
          (p.nextReviewAt > 0 && p.nextReviewAt <= now)
        );
      }
      return true;
    });
  }, [trackedEntries, vocabProgress, filter]);

  const dueCount = useMemo(() => {
    const now = Date.now();
    return trackedEntries.filter((w) => {
      const p = vocabProgress[w.id];
      if (!p || p.permanentlyMastered) return false;
      return p.status === 'forgotten' || p.status === 'vague' || (p.nextReviewAt > 0 && p.nextReviewAt <= now);
    }).length;
  }, [trackedEntries, vocabProgress]);

  const handleStartSrsFlashcards = async (entries: SearchIndexEntry[]) => {
    if (entries.length === 0) return;
    setLoadingFlashcards(true);
    try {
      const uniqueDeckIds = Array.from(
        new Set(
          entries
            .map((e) => e.deckId)
            .filter((id) => id && id !== 'listening-saved' && id !== 'writing-saved')
        )
      );
      const loadedDecks = await Promise.all(
        uniqueDeckIds.map((id) => loadVocabDeck(id).catch(() => null))
      );

      const fullWordMap = new Map<string, VocabWord>();
      for (const cw of customWords) fullWordMap.set(cw.id, cw);
      for (const deck of loadedDecks) {
        if (!deck) continue;
        for (const w of deck.words) fullWordMap.set(w.id, w);
      }

      const resolved: VocabWord[] = entries
        .map((e) => fullWordMap.get(e.id))
        .filter((w): w is VocabWord => Boolean(w));
      setStudyWords(resolved);
    } finally {
      setLoadingFlashcards(false);
    }
  };

  if (studyWords && studyWords.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-white">
            Ôn tập Flashcard SRS ({studyWords.length} từ)
          </h2>
          <button
            type="button"
            onClick={() => setStudyWords(null)}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:text-white"
          >
            Quay lại danh sách
          </button>
        </div>
        <FlashcardMode words={studyWords} deckTitle="Từ vựng của tôi (SRS)" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300">
            <BookmarkCheck className="h-3.5 w-3.5" />
            Hệ thống lặp lại ngắt quãng SRS
          </div>
          <h2 className="mt-2 text-2xl font-extrabold text-white">Từ Vựng Của Tôi</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Quản lý từ đã đánh dấu sao, từ lưu từ bài nghe Listening và danh sách từ cần ôn lại theo SRS.
          </p>
        </div>

        <button
          type="button"
          disabled={filteredEntries.length === 0 || loadingFlashcards}
          onClick={() => handleStartSrsFlashcards(filteredEntries)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 disabled:opacity-40 px-5 py-3 text-sm font-bold text-white shadow-glow hover:from-blue-500 hover:to-violet-500 transition shrink-0"
        >
          {loadingFlashcards ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải thẻ ôn tập...
            </>
          ) : (
            <>
              <Layers className="h-4 w-4" />
              Ôn Flashcard ngay ({filteredEntries.length} từ)
            </>
          )}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all' as const, label: `Tất cả (${trackedEntries.length})` },
          { id: 'srs-due' as const, label: `Cần ôn SRS (${dueCount})` },
          {
            id: 'starred' as const,
            label: `Đã gắn sao (${trackedEntries.filter((w) => vocabProgress[w.id]?.saved).length})`,
          },
          {
            id: 'mastered' as const,
            label: `Đã thuộc (${trackedEntries.filter((w) => vocabProgress[w.id]?.status === 'mastered').length})`,
          },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
              filter === t.id
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Word Grid */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 text-center space-y-2">
          <BookmarkCheck className="mx-auto h-10 w-10 text-slate-500" />
          <p className="text-base font-bold text-slate-200">Chưa có từ vựng nào trong mục này</p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Hãy học các bộ thẻ ở mục <b>Từ vựng</b>, gắn sao từ khó hoặc bấm <b>&ldquo;Lưu vào Từ vựng của tôi&rdquo;</b> trong phần giải thích <b>TOEIC Listening</b>!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((w) => {
            const p = vocabProgress[w.id];
            const status = p?.status || 'new';
            return (
              <div
                key={w.id}
                className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 sm:p-5 shadow-card flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-extrabold text-white">{w.word}</h3>
                      <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                        {w.partOfSpeech}
                      </span>
                      <span className="font-mono text-xs text-slate-400">{w.ipaUS}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-sky-300">{w.meaningVi}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => speakText(w.word, { accent: 'en-US' })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-cyan-400 hover:bg-indigo-600 hover:text-white transition"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSaveWord(w.id, w.deckId)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                        p?.saved
                          ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                          : 'border-slate-700 bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Star className={`h-4 w-4 ${p?.saved ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/60 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    Đã ôn {p?.reviewCount || 0} lần
                    {p?.permanentlyMastered ? (
                      <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        Thành thạo
                      </span>
                    ) : p?.nextReviewAt && p.nextReviewAt > Date.now() ? (
                      <span className="rounded-md bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                        Ôn sau{' '}
                        {p.nextReviewAt - Date.now() < 1000 * 60 * 60
                          ? `${Math.max(1, Math.round((p.nextReviewAt - Date.now()) / 60000))} phút`
                          : `${Math.max(1, Math.round((p.nextReviewAt - Date.now()) / (1000 * 60 * 60 * 24)))} ngày`}
                      </span>
                    ) : p && p.status !== 'new' ? (
                      <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        Đến hạn ôn
                      </span>
                    ) : null}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => markWordStatus(w.id, 'forgotten', w.deckId)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                        status === 'forgotten'
                          ? 'bg-rose-500/25 text-rose-200 border border-rose-500/50'
                          : 'bg-slate-800 text-slate-400 hover:text-rose-300'
                      }`}
                    >
                      Chưa nhớ
                    </button>
                    <button
                      type="button"
                      onClick={() => markWordStatus(w.id, 'vague', w.deckId)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                        status === 'vague'
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 hover:text-amber-300'
                      }`}
                    >
                      Mơ hồ
                    </button>
                    <button
                      type="button"
                      onClick={() => markWordStatus(w.id, 'mastered', w.deckId)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                        status === 'mastered'
                          ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/50'
                          : 'bg-slate-800 text-slate-400 hover:text-emerald-300'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Thuộc
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
