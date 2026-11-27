import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import { ListeningMeta, ListeningPart1Question, OptionKey } from '../../types';
import { useApp } from '../../context/AppContext';
import { loadListeningPart1All } from '../../utils/listeningLoader';
import { LISTENING_CHEAT_SHEETS } from '../../data/listeningCheatSheets';
import { Part1Illustration } from '../../components/Part1Illustrations';
import { ZoomableImage } from '../../components/ImageLightbox';
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

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

const SCENE_LABELS: Record<ListeningPart1Question['sceneType'], string> = {
  'single-person': 'Tả 1 người',
  'multiple-people': 'Tả nhiều người',
  'scene-objects': 'Tả vật / Không người',
};

interface ListeningPart1ViewProps {
  meta?: ListeningMeta | null;
}

export const ListeningPart1View: React.FC<ListeningPart1ViewProps> = ({ meta }) => {
  const { recordAttempt, listeningProgress, recordListeningResult } = useApp();

  const [questions, setQuestions] = useState<ListeningPart1Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sceneFilter, setSceneFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<ListeningStatusFilter>('all');
  const [idx, setIdx] = useState(0);

  const [selected, setSelected] = useState<Record<string, OptionKey>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [externalPlay, setExternalPlay] = useState<{ index: number; token: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    loadListeningPart1All(meta || undefined)
      .then((data) => {
        if (mounted) setQuestions(data);
      })
      .catch((err) => {
        if (mounted) setLoadError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu Part 1');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [meta]);

  const getItemStatus = (item: ListeningPart1Question): ListeningItemStatus => {
    if (submitted[item.id]) {
      return selected[item.id] === item.correctAnswer ? 'correct' : 'wrong';
    }
    const saved = listeningProgress[item.id];
    if (saved) return saved.status;
    return 'unanswered';
  };

  const categoryFilters = useMemo(() => {
    const countOf = (st: ListeningPart1Question['sceneType']) =>
      questions.filter((q) => q.sceneType === st).length;
    return [
      { value: 'all', label: 'Tất cả bối cảnh', count: questions.length },
      { value: 'single-person', label: 'Tả 1 người', count: countOf('single-person') },
      { value: 'multiple-people', label: 'Tả nhiều người', count: countOf('multiple-people') },
      { value: 'scene-objects', label: 'Tả vật / Không người', count: countOf('scene-objects') },
    ];
  }, [questions]);

  const categoryMatched = useMemo(
    () =>
      sceneFilter === 'all'
        ? questions
        : questions.filter((item) => item.sceneType === sceneFilter),
    [questions, sceneFilter]
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
    setIdx(0);
    setActiveLineId(null);
  }, [sceneFilter, statusFilter]);

  const safeIdx = filteredQuestions.length > 0 ? Math.min(idx, filteredQuestions.length - 1) : 0;
  const q = filteredQuestions[safeIdx] || null;
  const globalNumber = q ? questions.findIndex((item) => item.id === q.id) + 1 : 0;

  const navEntries: ListeningNavEntry[] = useMemo(
    () =>
      filteredQuestions.map((item) => {
        const gNum = questions.findIndex((x) => x.id === item.id) + 1;
        return {
          id: item.id,
          shortLabel: `Tranh ${gNum}`,
          title: item.title,
          subLabel: SCENE_LABELS[item.sceneType],
          status: getItemStatus(item),
        };
      }),
    [filteredQuestions, questions, submitted, selected, listeningProgress]
  );

  const isSubmitted = q ? Boolean(submitted[q.id]) : false;
  const userChoice = q ? selected[q.id] : undefined;

  const audioLines = useMemo(
    () =>
      q
        ? q.transcript.map((t) => ({
            id: t.id,
            text: t.en,
            accent: t.accent,
            gender: t.voiceGender,
            startMs: t.startMs,
            endMs: t.endMs,
          }))
        : [],
    [q]
  );

  const handleSubmit = () => {
    if (!q || !userChoice || isSubmitted) return;
    const isCorrect = userChoice === q.correctAnswer;
    setSubmitted((prev) => ({ ...prev, [q.id]: true }));
    recordListeningResult(q.id, userChoice, isCorrect);
    recordAttempt({
      module: 'listening',
      partLabel: 'Part 1',
      correctCount: isCorrect ? 1 : 0,
      totalCount: 1,
      topics: [{ topic: `Part 1 — ${SCENE_LABELS[q.sceneType]}`, correct: isCorrect }],
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
        Đang tải kho ảnh TOEIC Listening Part 1...
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
      <ListeningCheatSheetBox sheet={LISTENING_CHEAT_SHEETS[1]} defaultOpen={false} />

      {/* Compact Scalable Navigator */}
      <ListeningItemNavigator
        unitLabel="Tranh"
        filterHeading="Bối cảnh"
        categoryFilters={categoryFilters}
        selectedCategory={sceneFilter}
        onSelectCategory={setSceneFilter}
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
          <p className="text-base font-bold text-white">Không có câu Part 1 nào khớp bộ lọc hiện tại</p>
          <button
            type="button"
            onClick={() => {
              setSceneFilter('all');
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
          {/* Photograph + Audio + Hidden Options */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="rounded-lg bg-cyan-500/20 border border-cyan-400/30 px-2.5 py-0.5 text-xs font-extrabold text-cyan-300 shrink-0">
                      Tranh {globalNumber}
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                      {q.title}
                    </h3>
                  </div>
                  <span className="rounded-md bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-bold text-indigo-300 shrink-0">
                    {SCENE_LABELS[q.sceneType]}
                  </span>
                </div>

                <div className="aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950 flex items-center justify-center">
                  {q.imageUrl ? (
                    <ZoomableImage
                      src={q.imageUrl}
                      alt={q.title}
                      containerClassName="h-full w-full"
                      className="h-full w-full max-w-full object-cover"
                    />
                  ) : (
                    <Part1Illustration illustrationKey={q.illustrationKey} />
                  )}
                </div>
              </div>

              <SmartAudioPlayer
                lines={audioLines}
                audioUrl={q.audioUrl}
                activeLineId={activeLineId}
                onActiveLineChange={(lineId) => setActiveLineId(lineId)}
                externalPlayLineIndex={externalPlay}
                sticky
                label={`Audio Part 1 — Tranh ${globalNumber} (Nghe 4 câu mô tả A, B, C, D)`}
              />
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 sm:p-5 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-extrabold text-white">Chọn đáp án mô tả đúng bức tranh</h4>
                {!isSubmitted && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    <EyeOff className="h-3 w-3" />
                    Ẩn chữ chuẩn phòng thi
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {OPTION_KEYS.map((k) => {
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
                      className={`min-h-[48px] flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${cls}`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-extrabold">
                        {k}
                      </span>
                      <div className="flex-1">
                        {isSubmitted ? (
                          <>
                            <p className="text-sm font-semibold">{q.options[k].en}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{q.options[k].vi}</p>
                          </>
                        ) : (
                          <p className="text-sm font-semibold text-slate-300 mt-1">
                            Phương án ({k}) — Nghe audio để chọn
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!isSubmitted && (
                <button
                  type="button"
                  disabled={!userChoice}
                  onClick={handleSubmit}
                  className="min-h-[46px] flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 py-3 text-sm font-bold text-white shadow-glow hover:from-blue-500 hover:to-indigo-500 transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Nộp đáp án &amp; Mở khóa Transcript + Giải thích
                </button>
              )}
            </div>
          </div>

          {/* Deep Analysis */}
          {isSubmitted && (
            <ListeningAnalysisPanel
              questionId={q.id}
              questionLabel={`Listening Part 1 — Tranh ${globalNumber}: ${q.title}`}
              correctAnswer={q.correctAnswer}
              userAnswer={userChoice}
              optionKeys={OPTION_KEYS}
              explanation={q.explanation}
              transcript={q.transcript}
              activeLineId={activeLineId}
              onPlayLine={(lineIndex) => setExternalPlay({ index: lineIndex, token: Date.now() })}
            />
          )}

          {/* Bottom Prev / Next Bar */}
          <ListeningBottomNavBar
            unitLabel="Tranh"
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
