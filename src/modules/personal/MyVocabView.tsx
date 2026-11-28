import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Keyboard,
  Layers,
  Loader2,
  Star,
  Volume2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SearchIndexEntry, VocabTopic, VocabWord } from '../../types';
import { loadVocabDeck } from '../../utils/vocabLoader';
import { speakText } from '../../utils/speech';
import { FlashcardMode } from '../vocab/FlashcardMode';
import { ActiveRecallMode } from '../vocab/ActiveRecallMode';

type FilterKey = 'all' | 'srs-due' | 'starred' | 'mastered';
type StudySessionMode = 'flashcard' | 'active-recall';

const CUSTOM_DECK_IDS = new Set(['listening-saved', 'writing-saved', 'reading-saved', 'vocab-saved']);

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Tất cả từ đã học',
  'srs-due': 'Cần ôn SRS',
  starred: 'Từ đã gắn sao',
  mastered: 'Từ đã thuộc',
};

function parseFilterParam(raw: string | null): FilterKey {
  if (raw === 'srs' || raw === 'srs-due') return 'srs-due';
  if (raw === 'starred') return 'starred';
  if (raw === 'mastered') return 'mastered';
  return 'all';
}

function serializeFilterParam(key: FilterKey): string {
  return key === 'srs-due' ? 'srs' : key;
}

function parseModeParam(raw: string | null): StudySessionMode | null {
  if (raw === 'typing' || raw === 'active-recall') return 'active-recall';
  if (raw === 'flashcard') return 'flashcard';
  return null;
}

export const MyVocabView: React.FC = () => {
  const { searchIndex, searchIndexLoading, customWords, vocabProgress, toggleSaveWord, markWordStatus } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = parseFilterParam(searchParams.get('tab'));
  const urlMode = parseModeParam(searchParams.get('mode'));

  const [studyWords, setStudyWords] = useState<VocabWord[] | null>(null);
  const [studyMode, setStudyMode] = useState<StudySessionMode>(urlMode || 'flashcard');
  const [sessionTitle, setSessionTitle] = useState<string>('Từ vựng của tôi');
  const [loadingMode, setLoadingMode] = useState<StudySessionMode | null>(null);
  const autoRestoredKeyRef = useRef<string | null>(null);

  const setFilter = (nextFilter: FilterKey) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextFilter === 'all') next.delete('tab');
        else next.set('tab', serializeFilterParam(nextFilter));
        next.delete('mode');
        next.delete('card');
        return next;
      },
      { replace: true }
    );
  };

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
      return (
        p.status === 'forgotten' ||
        p.status === 'vague' ||
        (p.nextReviewAt > 0 && p.nextReviewAt <= now)
      );
    }).length;
  }, [trackedEntries, vocabProgress]);

  /**
   * Resolve full VocabWord objects for any filtered subset.
   * For sparse custom words saved from Listening/Reading/Writing, automatically look up
   * matching entries in the main searchIndex decks to enrich IPA, definitions, examples,
   * wordFamily, synonyms, antonyms & collocations while preserving the user's tracked word ID.
   */
  const resolveStudyWords = useCallback(async (entries: SearchIndexEntry[]): Promise<VocabWord[]> => {
    const standardWordByText = new Map<string, SearchIndexEntry>();
    for (const row of searchIndex) {
      if (row.deckId && !CUSTOM_DECK_IDS.has(row.deckId)) {
        const key = row.word.trim().toLowerCase();
        if (!standardWordByText.has(key)) {
          standardWordByText.set(key, row);
        }
      }
    }

    const deckIdsToLoad = new Set<string>();
    for (const e of entries) {
      if (e.deckId && !CUSTOM_DECK_IDS.has(e.deckId)) {
        deckIdsToLoad.add(e.deckId);
      } else {
        const enrichedMatch = standardWordByText.get(e.word.trim().toLowerCase());
        if (enrichedMatch?.deckId) {
          deckIdsToLoad.add(enrichedMatch.deckId);
        }
      }
    }

    const loadedDecks = await Promise.all(
      Array.from(deckIdsToLoad).map((id) => loadVocabDeck(id).catch(() => null))
    );

    const fullWordById = new Map<string, VocabWord>();
    const fullWordByText = new Map<string, VocabWord>();

    for (const deck of loadedDecks) {
      if (!deck) continue;
      for (const w of deck.words) {
        fullWordById.set(w.id, w);
        const key = w.word.trim().toLowerCase();
        if (!fullWordByText.has(key)) fullWordByText.set(key, w);
      }
    }

    const customWordById = new Map<string, VocabWord>();
    for (const cw of customWords) customWordById.set(cw.id, cw);

    const resolved: VocabWord[] = [];
    for (const e of entries) {
      const directDeckWord = fullWordById.get(e.id);
      if (directDeckWord) {
        resolved.push(directDeckWord);
        continue;
      }

      const customWord = customWordById.get(e.id);
      const textEnrich = fullWordByText.get(e.word.trim().toLowerCase());

      if (customWord && textEnrich) {
        resolved.push({
          ...textEnrich,
          id: customWord.id,
          deckId: customWord.deckId,
          word: customWord.word,
          meaning: customWord.meaning || textEnrich.meaning,
          ipaUS: customWord.ipaUS && customWord.ipaUS !== '/.../' ? customWord.ipaUS : textEnrich.ipaUS,
          ipaUK: customWord.ipaUK && customWord.ipaUK !== '/.../' ? customWord.ipaUK : textEnrich.ipaUK,
          examples:
            customWord.examples && customWord.examples.length > 0 && customWord.examples[0]?.en
              ? customWord.examples
              : textEnrich.examples,
        });
        continue;
      }

      if (customWord) {
        const isBoilerplateEn =
          customWord.definitionEn?.startsWith('A high-frequency TOEIC listening expression') ||
          customWord.definitionEn?.startsWith('High-value expression extracted from AI Writing');
        const isBoilerplateVi =
          customWord.definitionVi?.startsWith('Từ/cụm từ nghe trọng tâm TOEIC') ||
          customWord.definitionVi?.startsWith('Từ/cụm từ ăn điểm trích từ bài chấm Writing');
        resolved.push({
          ...customWord,
          definitionEn: isBoilerplateEn ? '' : customWord.definitionEn,
          definitionVi: isBoilerplateVi ? '' : customWord.definitionVi,
        });
        continue;
      }

      if (textEnrich) {
        resolved.push({
          ...textEnrich,
          id: e.id,
          deckId: e.deckId,
        });
        continue;
      }

      resolved.push({
        id: e.id,
        deckId: e.deckId,
        word: e.word,
        pos: e.partOfSpeech || 'n',
        ipaUS: e.ipaUS || '',
        ipaUK: e.ipaUS || '',
        meaning: e.meaningVi,
        definitionEn: '',
        definitionVi: '',
        examples: [],
        wordFamily: [],
        synonyms: [],
        antonyms: [],
        collocations: [],
      });
    }

    return resolved;
  }, [searchIndex, customWords]);

  const handleStartReview = useCallback(
    async (entries: SearchIndexEntry[], mode: StudySessionMode, pushHistory = true) => {
      if (entries.length === 0) return;
      setLoadingMode(mode);
      try {
        const resolved = await resolveStudyWords(entries);
        if (resolved.length > 0) {
          setStudyMode(mode);
          setSessionTitle(`Từ vựng của tôi — ${FILTER_LABELS[filter]}`);
          setStudyWords(resolved);
          autoRestoredKeyRef.current = `${filter}:${mode}`;
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              if (filter === 'all') next.delete('tab');
              else next.set('tab', serializeFilterParam(filter));
              next.set('mode', mode === 'active-recall' ? 'typing' : 'flashcard');
              return next;
            },
            { replace: !pushHistory }
          );
        }
      } finally {
        setLoadingMode(null);
      }
    },
    [filter, resolveStudyWords, setSearchParams]
  );

  // Restore ?mode=typing|flashcard automatically on F5 reload after searchIndex finishes loading
  useEffect(() => {
    if (!urlMode) {
      setStudyWords(null);
      autoRestoredKeyRef.current = null;
      return;
    }
    if (searchIndexLoading) return;
    if (studyWords && studyWords.length > 0) {
      if (studyMode !== urlMode) setStudyMode(urlMode);
      return;
    }
    const restoreKey = `${filter}:${urlMode}`;
    if (autoRestoredKeyRef.current === restoreKey) return;
    if (filteredEntries.length === 0) return;
    autoRestoredKeyRef.current = restoreKey;
    handleStartReview(filteredEntries, urlMode, false);
  }, [urlMode, searchIndexLoading, filteredEntries, filter, studyWords, studyMode, handleStartReview]);

  const handleSwitchSessionMode = (nextMode: StudySessionMode) => {
    setStudyMode(nextMode);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('mode', nextMode === 'active-recall' ? 'typing' : 'flashcard');
        next.delete('card');
        return next;
      },
      { replace: true }
    );
  };

  const handleExitSession = () => {
    setStudyWords(null);
    autoRestoredKeyRef.current = null;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('mode');
      next.delete('card');
      return next;
    });
  };

  const activeRecallTopic: VocabTopic | null = useMemo(() => {
    if (!studyWords || studyWords.length === 0) return null;
    return {
      id: `my-vocab-${filter}-${studyWords.length}`,
      name: sessionTitle,
      icon: 'education',
      words: studyWords,
    };
  }, [studyWords, filter, sessionTitle]);

  // Smooth restoring spinner when F5 on /my-vocabulary?mode=typing|flashcard
  if (urlMode && (!studyWords || studyWords.length === 0) && (searchIndexLoading || loadingMode !== null)) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-[#1E293B] p-12 flex flex-col items-center justify-center gap-3 text-slate-300 shadow-card">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        <p className="text-sm font-semibold">
          Đang khôi phục phiên ôn {urlMode === 'active-recall' ? 'Gõ từ chủ động' : 'Flashcard'}...
        </p>
      </div>
    );
  }

  if (studyWords && studyWords.length > 0) {
    if (studyMode === 'active-recall' && activeRecallTopic) {
      return (
        <div className="space-y-4">
          <ActiveRecallMode
            topic={activeRecallTopic}
            topicIndex={0}
            totalTopics={1}
            totalDeckWords={studyWords.length}
            deckTitle="Từ vựng của tôi (SRS)"
            hasNextTopic={false}
            onGoNextTopic={() => {}}
            sessionMode
            sessionLabel={sessionTitle}
            onSwitchToFlashcard={() => handleSwitchSessionMode('flashcard')}
            onExitSession={handleExitSession}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="text-lg sm:text-xl font-extrabold text-white">
            Ôn tập Flashcard SRS ({studyWords.length} từ)
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSwitchSessionMode('active-recall')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/45 bg-emerald-500/15 hover:bg-emerald-500/25 px-3.5 py-2 text-xs font-bold text-emerald-300 transition"
            >
              <Keyboard className="h-3.5 w-3.5" />
              Chuyển sang Gõ từ chủ động
            </button>
            <button
              type="button"
              onClick={handleExitSession}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Quay lại danh sách
            </button>
          </div>
        </div>
        <FlashcardMode words={studyWords} deckTitle={sessionTitle} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-4 sm:p-6 shadow-card flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300">
            <BookmarkCheck className="h-3.5 w-3.5" />
            Hệ thống lặp lại ngắt quãng SRS
          </div>
          <h2 className="mt-2 text-xl sm:text-2xl font-extrabold text-white">Từ Vựng Của Tôi</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Quản lý từ đã đánh dấu sao, từ lưu từ bài nghe Listening / Writing và ôn tập chủ động theo SRS.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex xl:items-center gap-2.5 shrink-0 w-full xl:w-auto">
          <button
            type="button"
            disabled={filteredEntries.length === 0 || loadingMode !== null}
            onClick={() => handleStartReview(filteredEntries, 'active-recall')}
            className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 disabled:opacity-40 px-4 sm:px-5 py-3 text-sm font-extrabold text-white shadow-glow hover:brightness-110 transition active:scale-[0.99]"
          >
            {loadingMode === 'active-recall' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Đang nạp dữ liệu gõ từ...
              </>
            ) : (
              <>
                <Keyboard className="h-4 w-4 shrink-0" />
                <span>Ôn gõ từ chủ động ({filteredEntries.length} từ)</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={filteredEntries.length === 0 || loadingMode !== null}
            onClick={() => handleStartReview(filteredEntries, 'flashcard')}
            className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 disabled:opacity-40 px-4 sm:px-5 py-3 text-sm font-bold text-white shadow-glow hover:from-blue-500 hover:to-violet-500 transition active:scale-[0.99]"
          >
            {loadingMode === 'flashcard' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Đang tải thẻ ôn tập...
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 shrink-0" />
                <span>Ôn Flashcard ngay ({filteredEntries.length} từ)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap gap-2 pb-0.5">
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
            className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold transition ${
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
            Hãy học các bộ thẻ ở mục <b>Từ vựng</b>, gắn sao từ khó hoặc bấm{' '}
            <b>&ldquo;Lưu vào Từ vựng của tôi&rdquo;</b> trong phần giải thích <b>TOEIC Listening / Writing</b>!
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
