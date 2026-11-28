import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import {
  ListeningMeta,
  ListeningPart2Question,
  Part2OptionKey,
  TranscriptLine,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { loadListeningPart2All } from '../../utils/listeningLoader';
import { playCorrect, playWrong } from '../../lib/soundEffects';
import { LISTENING_CHEAT_SHEETS } from '../../data/listeningCheatSheets';
import { SmartAudioPlayer } from '../../components/SmartAudioPlayer';
import { ListeningCheatSheetBox } from './ListeningCheatSheetBox';
import {
  ListeningBottomNavBar,
  ListeningItemNavigator,
  ListeningItemStatus,
  ListeningNavEntry,
  ListeningStatusFilter,
} from './ListeningItemNavigator';
import { ListeningAnalysisPanel } from './ListeningAnalysisPanel';

const PART2_KEYS: Part2OptionKey[] = ['A', 'B', 'C'];

interface ListeningPart2ViewProps {
  meta?: ListeningMeta | null;
}

export const ListeningPart2View: React.FC<ListeningPart2ViewProps> = ({ meta }) => {
  const { recordAttempt, listeningProgress, recordListeningResult } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const hydratedItemRef = useRef(false);

  const [questions, setQuestions] = useState<ListeningPart2Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<ListeningStatusFilter>('all');
  const [idx, setIdx] = useState(0);

  const [selected, setSelected] = useState<Record<string, Part2OptionKey>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [externalPlay, setExternalPlay] = useState<{ index: number; token: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    loadListeningPart2All(meta || undefined)
      .then((data) => {
        if (mounted) setQuestions(data);
      })
      .catch((err) => {
        if (mounted) setLoadError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu Part 2');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [meta]);

  const getItemStatus = (item: ListeningPart2Question): ListeningItemStatus => {
    if (submitted[item.id]) {
      return selected[item.id] === item.correctAnswer ? 'correct' : 'wrong';
    }
    const saved = listeningProgress[item.id];
    if (saved) return saved.status;
    return 'unanswered';
  };

  const categoryFilters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of questions) {
      counts.set(item.questionType, (counts.get(item.questionType) || 0) + 1);
    }
    return [
      { value: 'all', label: 'Tất cả dạng câu hỏi', count: questions.length },
      ...Array.from(counts.entries()).map(([qt, count]) => ({
        value: qt,
        label: qt,
        count,
      })),
    ];
  }, [questions]);

  const categoryMatched = useMemo(
    () =>
      typeFilter === 'all'
        ? questions
        : questions.filter((item) => item.questionType === typeFilter),
    [questions, typeFilter]
  );

  const statusCounts = useMemo(() => {
    let unanswered = 0;
    let correct = 0;
    let wrong = 0;
    for (const item of categoryMatched) {
      const st = getItemStatus(item);
      if (st === 'correct') correct += 1;
      else if (st === 'wrong') wrong += 1;
      else unanswered += 1;
    }
    return { all: categoryMatched.length, unanswered, correct, wrong };
  }, [categoryMatched, submitted, selected, listeningProgress]);

  const filteredQuestions = useMemo(() => {
    if (statusFilter === 'all') return categoryMatched;
    return categoryMatched.filter((item) => getItemStatus(item) === statusFilter);
  }, [categoryMatched, statusFilter, submitted, selected, listeningProgress]);

  useEffect(() => {
    if (hydratedItemRef.current || questions.length === 0) return;
    hydratedItemRef.current = true;
    const targetId = searchParams.get('item');
    if (targetId) {
      const found = questions.findIndex((item) => item.id === targetId);
      if (found >= 0) setIdx(found);
    }
  }, [questions, searchParams]);

  useEffect(() => {
    if (!hydratedItemRef.current) return;
    setIdx(0);
    setActiveLineId(null);
  }, [typeFilter, statusFilter]);

  const safeIdx = filteredQuestions.length > 0 ? Math.min(idx, filteredQuestions.length - 1) : 0;
  const q = filteredQuestions[safeIdx] || null;

  // Keep ?item=<id> synced in URL so F5 restores exact Part 2 question
  useEffect(() => {
    if (!hydratedItemRef.current || !q) return;
    if (searchParams.get('item') !== q.id) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('item', q.id);
          return next;
        },
        { replace: true }
      );
    }
  }, [q?.id]);
  const globalNum = q ? questions.findIndex((item) => item.id === q.id) + 7 : 7;

  const navEntries: ListeningNavEntry[] = useMemo(
    () =>
      filteredQuestions.map((item) => {
        const gNum = questions.findIndex((x) => x.id === item.id) + 7;
        return {
          id: item.id,
          shortLabel: `Câu ${gNum}`,
          title: item.title,
          subLabel: item.questionType,
          status: getItemStatus(item),
        };
      }),
    [filteredQuestions, questions, submitted, selected, listeningProgress]
  );

  const isSubmitted = q ? Boolean(submitted[q.id]) : false;
  const userChoice = q ? selected[q.id] : undefined;

  const transcriptLines: TranscriptLine[] = useMemo(() => {
    if (!q) return [];
    const qLine: TranscriptLine = { ...q.questionLine, evidenceForQuestionIds: [q.id] };
    const optLines: TranscriptLine[] = PART2_KEYS.map((k) => ({
      id: `${q.id}-opt-${k}`,
      speaker: `Option (${k})`,
      voiceGender: q.options[k].voiceGender,
      accent: q.options[k].accent,
      en: `${k}. ${q.options[k].en}`,
      vi: `${k}. ${q.options[k].vi}`,
      startMs: q.options[k].startMs,
      endMs: q.options[k].endMs,
      evidenceForQuestionIds: k === q.correctAnswer ? [q.id] : undefined,
    }));
    return [qLine, ...optLines];
  }, [q]);

  const audioLines = useMemo(
    () =>
      transcriptLines.map((t) => ({
        id: t.id,
        text: t.en,
        accent: t.accent,
        gender: t.voiceGender,
        startMs: t.startMs,
        endMs: t.endMs,
      })),
    [transcriptLines]
  );

  const handleSubmit = () => {
    if (!q || !userChoice || isSubmitted) return;
    const isCorrect = userChoice === q.correctAnswer;
    if (isCorrect) playCorrect();
    else playWrong();
    setSubmitted((prev) => ({ ...prev, [q.id]: true }));
    recordListeningResult(q.id, userChoice, isCorrect);
    recordAttempt({
      module: 'listening',
      partLabel: 'Part 2',
      correctCount: isCorrect ? 1 : 0,
      totalCount: 1,
      topics: [{ topic: `Part 2 — ${q.questionType}`, correct: isCorrect }],
    });
  };

  const handleResetCurrent = () => {
    if (!q) return;
    setSubmitted((p) => ({ ...p, [q.id]: false }));
    setSelected((p) => {
      const c = { ...p };
      delete c[q.id];
      return c;
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 flex items-center justify-center gap-3 text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        Đang tải kho câu hỏi TOEIC Listening Part 2...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-6 text-sm text-rose-200">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Collapsible Strategy Cheat Sheet (Collapsed by default) */}
      <ListeningCheatSheetBox sheet={LISTENING_CHEAT_SHEETS[2]} defaultOpen={false} />

      {/* Compact Scalable Navigator */}
      <ListeningItemNavigator
        unitLabel="Câu"
        filterHeading="Dạng câu hỏi"
        categoryFilters={categoryFilters}
        selectedCategory={typeFilter}
        onSelectCategory={setTypeFilter}
        statusFilter={statusFilter}
        onSelectStatusFilter={setStatusFilter}
        statusCounts={statusCounts}
        items={navEntries}
        activeIndex={safeIdx}
        onSelectIndex={(next) => {
          setIdx(next);
          setActiveLineId(null);
        }}
        showResetButton={isSubmitted}
        onResetCurrent={handleResetCurrent}
      />

      {!q ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-10 text-center space-y-3">
          <p className="text-base font-bold text-white">Không có câu Part 2 nào khớp bộ lọc hiện tại</p>
          <button
            type="button"
            onClick={() => {
              setTypeFilter('all');
              setStatusFilter('all');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <>
          {/* Sticky Audio Player */}
          <SmartAudioPlayer
            lines={audioLines}
            audioUrl={q.audioUrl}
            activeLineId={activeLineId}
            onActiveLineChange={(lineId) => setActiveLineId(lineId)}
            externalPlayLineIndex={externalPlay}
            sticky
            label={`Audio Part 2 — Câu ${globalNum} (1 Câu hỏi + 3 Hồi đáp A, B, C)`}
          />

          {/* Main Question Card */}
          <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 sm:p-6 shadow-card space-y-4 sm:space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-lg bg-cyan-500/20 border border-cyan-400/30 px-2.5 py-0.5 text-xs font-extrabold text-cyan-300">
                    Câu {globalNum}
                  </span>
                  <span className="rounded-md bg-violet-500/20 border border-violet-500/30 px-2.5 py-0.5 text-[11px] font-bold text-violet-300">
                    {q.questionType}
                  </span>
                </div>
                <h3 className="mt-1.5 text-base sm:text-lg font-extrabold text-white">{q.title}</h3>
              </div>
              {!isSubmitted && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400">
                  <EyeOff className="h-3.5 w-3.5" />
                  Ẩn câu hỏi &amp; đáp án khi đang nghe
                </span>
              )}
            </div>

            {isSubmitted && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5">
                <p className="text-[11px] font-bold uppercase text-indigo-300">Câu hỏi (Question)</p>
                <p className="mt-1 text-sm font-bold text-white">{q.questionLine.en}</p>
                <p className="text-xs text-slate-300 mt-0.5">{q.questionLine.vi}</p>
              </div>
            )}

            {/* 3 Options A / B / C */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PART2_KEYS.map((k) => {
                const chosen = userChoice === k;
                const right = k === q.correctAnswer;
                let cls =
                  'border-slate-700/80 bg-slate-900/75 text-slate-200 hover:border-indigo-500/60';
                if (isSubmitted) {
                  if (right) cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
                  else if (chosen) cls = 'border-rose-500 bg-rose-500/15 text-rose-100';
                  else cls = 'border-slate-800 bg-slate-900/40 text-slate-500';
                } else if (chosen) {
                  cls = 'border-indigo-400 bg-indigo-500/20 text-white ring-2 ring-indigo-500/30';
                }

                return (
                  <button
                    key={k}
                    type="button"
                    disabled={isSubmitted}
                    onClick={() => setSelected((prev) => ({ ...prev, [q.id]: k }))}
                    className={`min-h-[54px] rounded-2xl border p-4 text-left transition flex items-start gap-3 ${cls}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-extrabold">
                      {k}
                    </span>
                    <div className="flex-1 min-w-0">
                      {isSubmitted ? (
                        <>
                          <p className="text-sm font-semibold">{q.options[k].en}</p>
                          <p className="mt-1 text-xs text-slate-400">{q.options[k].vi}</p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-slate-300 mt-1">Hồi đáp ({k})</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {!isSubmitted && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!userChoice}
                  onClick={handleSubmit}
                  className="min-h-[46px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 px-6 py-2.5 text-sm font-bold text-white shadow-glow"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Nộp đáp án &amp; Xem phân tích bẫy
                </button>
              </div>
            )}
          </div>

          {isSubmitted && (
            <ListeningAnalysisPanel
              questionId={q.id}
              questionLabel={`Listening Part 2 — Câu ${globalNum} (${q.questionType})`}
              correctAnswer={q.correctAnswer}
              userAnswer={userChoice}
              optionKeys={PART2_KEYS}
              explanation={q.explanation}
              transcript={transcriptLines}
              activeLineId={activeLineId}
              onPlayLine={(lineIndex) => setExternalPlay({ index: lineIndex, token: Date.now() })}
            />
          )}

          {/* Bottom Prev / Next Bar */}
          <ListeningBottomNavBar
            unitLabel="Câu"
            currentIndex={safeIdx}
            totalCount={filteredQuestions.length}
            onPrev={() => {
              setIdx((v) => Math.max(0, v - 1));
              setActiveLineId(null);
            }}
            onNext={() => {
              setIdx((v) => Math.min(filteredQuestions.length - 1, v + 1));
              setActiveLineId(null);
            }}
          />
        </>
      )}
    </div>
  );
};
