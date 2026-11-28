import React, { useEffect, useMemo, useState } from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Sparkles,
  Table2,
  Users,
  Volume2,
} from 'lucide-react';
import {
  ListeningMeta,
  ListeningPart3Set,
  ListeningPart4Set,
  OptionKey,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { loadListeningPart3All, loadListeningPart4All } from '../../utils/listeningLoader';
import { LISTENING_CHEAT_SHEETS } from '../../data/listeningCheatSheets';
import { SmartAudioPlayer } from '../../components/SmartAudioPlayer';
import { ZoomableImage } from '../../components/ImageLightbox';
import { ListeningCheatSheetBox } from './ListeningCheatSheetBox';
import {
  ListeningBottomNavBar,
  ListeningItemNavigator,
  ListeningItemStatus,
  ListeningNavEntry,
  ListeningStatusFilter,
} from './ListeningItemNavigator';
import { ListeningAnalysisPanel } from './ListeningAnalysisPanel';
import { speakText } from '../../utils/speech';

interface ListeningPart34ViewProps {
  part: 3 | 4;
  meta?: ListeningMeta | null;
}

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

export const ListeningPart34View: React.FC<ListeningPart34ViewProps> = ({ part, meta }) => {
  const {
    recordAttempt,
    saveListeningVocab,
    isWordSaved,
    listeningProgress,
    recordListeningResult,
  } = useApp();

  const [sets, setSets] = useState<(ListeningPart3Set | ListeningPart4Set)[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<ListeningStatusFilter>('all');
  const [setIdx, setSetIdx] = useState(0);

  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [submittedSets, setSubmittedSets] = useState<Record<string, boolean>>({});
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null);
  const [externalPlay, setExternalPlay] = useState<{ index: number; token: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    const loader = part === 3 ? loadListeningPart3All : loadListeningPart4All;
    loader(meta || undefined)
      .then((data) => {
        if (mounted) setSets(data);
      })
      .catch((err) => {
        if (mounted) {
          setLoadError(err instanceof Error ? err.message : `Lỗi tải dữ liệu Part ${part}`);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [part, meta]);

  const getSetStatus = (s: ListeningPart3Set | ListeningPart4Set): ListeningItemStatus => {
    if (submittedSets[s.id]) {
      const allRight = s.questions.every((q) => answers[q.id] === q.correctAnswer);
      return allRight ? 'correct' : 'wrong';
    }
    const doneQs = s.questions.filter((q) => Boolean(listeningProgress[q.id]));
    if (doneQs.length === 0) return 'unanswered';
    const allRight =
      doneQs.length === s.questions.length &&
      doneQs.every((q) => listeningProgress[q.id]?.status === 'correct');
    return allRight ? 'correct' : 'wrong';
  };

  const categoryFilters = useMemo(() => {
    if (part === 3) {
      const p3 = sets as ListeningPart3Set[];
      return [
        { value: 'all', label: 'Tất cả hội thoại', count: p3.length },
        { value: '2-speakers', label: '2 người nói', count: p3.filter((s) => s.speakerCount === 2).length },
        { value: '3-speakers', label: '3 người nói', count: p3.filter((s) => s.speakerCount === 3).length },
        { value: 'graphic', label: 'Có bảng biểu (Graphic)', count: p3.filter((s) => Boolean(s.hasGraphic)).length },
      ];
    }
    const p4 = sets as ListeningPart4Set[];
    const talkCounts = new Map<string, number>();
    for (const s of p4) {
      talkCounts.set(s.talkType, (talkCounts.get(s.talkType) || 0) + 1);
    }
    return [
      { value: 'all', label: 'Tất cả bài nói', count: p4.length },
      { value: 'graphic', label: 'Có bảng biểu (Graphic)', count: p4.filter((s) => Boolean(s.hasGraphic)).length },
      ...Array.from(talkCounts.entries()).map(([tt, count]) => ({
        value: tt,
        label: tt,
        count,
      })),
    ];
  }, [sets, part]);

  const categoryMatched = useMemo(() => {
    if (categoryFilter === 'all') return sets;
    if (categoryFilter === 'graphic') return sets.filter((s) => Boolean(s.hasGraphic));
    if (part === 3) {
      if (categoryFilter === '2-speakers') {
        return (sets as ListeningPart3Set[]).filter((s) => s.speakerCount === 2);
      }
      if (categoryFilter === '3-speakers') {
        return (sets as ListeningPart3Set[]).filter((s) => s.speakerCount === 3);
      }
      return sets;
    }
    return (sets as ListeningPart4Set[]).filter((s) => s.talkType === categoryFilter);
  }, [sets, categoryFilter, part]);

  const statusCounts = useMemo(() => {
    let unanswered = 0;
    let correct = 0;
    let wrong = 0;
    for (const s of categoryMatched) {
      const st = getSetStatus(s);
      if (st === 'correct') correct += 1;
      else if (st === 'wrong') wrong += 1;
      else unanswered += 1;
    }
    return { all: categoryMatched.length, unanswered, correct, wrong };
  }, [categoryMatched, submittedSets, answers, listeningProgress]);

  const filteredSets = useMemo(() => {
    if (statusFilter === 'all') return categoryMatched;
    return categoryMatched.filter((s) => getSetStatus(s) === statusFilter);
  }, [categoryMatched, statusFilter, submittedSets, answers, listeningProgress]);

  useEffect(() => {
    setSetIdx(0);
    setActiveLineId(null);
    setHighlightedLineId(null);
  }, [categoryFilter, statusFilter]);

  const handleLocateEvidence = (questionId: string, evidenceLineIndex?: number) => {
    if (!currentSet) return;
    let targetIdx =
      typeof evidenceLineIndex === 'number' &&
      evidenceLineIndex >= 0 &&
      evidenceLineIndex < currentSet.transcript.length
        ? evidenceLineIndex
        : currentSet.transcript.findIndex((t) =>
            t.evidenceForQuestionIds?.includes(questionId)
          );
    if (targetIdx < 0) return;
    const targetLine = currentSet.transcript[targetIdx];
    setHighlightedLineId(targetLine.id);
    setExternalPlay({ index: targetIdx, token: Date.now() });
    const el = document.getElementById(`transcript-line-${targetLine.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    window.setTimeout(() => {
      setHighlightedLineId((curr) => (curr === targetLine.id ? null : curr));
    }, 3200);
  };

  const safeIdx = filteredSets.length > 0 ? Math.min(setIdx, filteredSets.length - 1) : 0;
  const currentSet = filteredSets[safeIdx] || null;
  const globalSetNum = currentSet ? sets.findIndex((s) => s.id === currentSet.id) + 1 : 1;

  const unitLabel = part === 3 ? 'Hội thoại' : 'Bài nói';

  const navEntries: ListeningNavEntry[] = useMemo(
    () =>
      filteredSets.map((s) => {
        const gNum = sets.findIndex((x) => x.id === s.id) + 1;
        const badge =
          s.part === 3
            ? `${s.speakerCount} người${s.hasGraphic ? ' • Graphic' : ''}`
            : `${s.talkType.split(' (')[0]}${s.hasGraphic ? ' • Graphic' : ''}`;
        return {
          id: s.id,
          shortLabel: `${unitLabel} ${gNum}`,
          title: s.title,
          subLabel: badge,
          status: getSetStatus(s),
        };
      }),
    [filteredSets, sets, unitLabel, submittedSets, answers, listeningProgress]
  );

  const isSubmitted = currentSet ? Boolean(submittedSets[currentSet.id]) : false;

  const audioLines = useMemo(
    () =>
      currentSet
        ? currentSet.transcript.map((t) => ({
            id: t.id,
            text: t.en,
            accent: t.accent,
            gender: t.voiceGender,
            startMs: t.startMs,
            endMs: t.endMs,
          }))
        : [],
    [currentSet]
  );

  const allAnswered = currentSet
    ? currentSet.questions.every((q) => Boolean(answers[q.id]))
    : false;

  const handleSubmitSet = () => {
    if (!currentSet || isSubmitted) return;
    setSubmittedSets((prev) => ({ ...prev, [currentSet.id]: true }));
    let correct = 0;
    for (const q of currentSet.questions) {
      const chosen = answers[q.id];
      const ok = chosen === q.correctAnswer;
      if (ok) correct += 1;
      if (chosen) recordListeningResult(q.id, chosen, ok);
    }
    recordAttempt({
      module: 'listening',
      partLabel: `Part ${part}`,
      correctCount: correct,
      totalCount: currentSet.questions.length,
      topics: currentSet.questions.map((q) => ({
        topic: `Part ${part} — ${q.questionType}`,
        correct: answers[q.id] === q.correctAnswer,
      })),
    });
  };

  const handleResetCurrent = () => {
    if (!currentSet) return;
    setSubmittedSets((p) => ({ ...p, [currentSet.id]: false }));
    setAnswers((prev) => {
      const next = { ...prev };
      currentSet.questions.forEach((q) => delete next[q.id]);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 flex items-center justify-center gap-3 text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        Đang tải kho bài nghe TOEIC Listening Part {part}...
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
      <ListeningCheatSheetBox sheet={LISTENING_CHEAT_SHEETS[part]} defaultOpen={false} />

      {/* Compact Scalable Navigator */}
      <ListeningItemNavigator
        unitLabel={unitLabel}
        filterHeading={part === 3 ? 'Dạng hội thoại' : 'Thể loại bài nói'}
        categoryFilters={categoryFilters}
        selectedCategory={categoryFilter}
        onSelectCategory={setCategoryFilter}
        statusFilter={statusFilter}
        onSelectStatusFilter={setStatusFilter}
        statusCounts={statusCounts}
        items={navEntries}
        activeIndex={safeIdx}
        onSelectIndex={(next) => {
          setSetIdx(next);
          setActiveLineId(null);
        }}
        showResetButton={isSubmitted}
        onResetCurrent={handleResetCurrent}
      />

      {!currentSet ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-10 text-center space-y-3">
          <p className="text-base font-bold text-white">
            Không có {unitLabel.toLowerCase()} Part {part} nào khớp bộ lọc hiện tại
          </p>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all');
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
          {/* Sticky Audio Player stays pinned while scrolling Interactive Transcript & Questions */}
          <SmartAudioPlayer
            lines={audioLines}
            audioUrl={currentSet.audioUrl}
            activeLineId={activeLineId}
            onActiveLineChange={(lineId) => setActiveLineId(lineId)}
            externalPlayLineIndex={externalPlay}
            sticky
            label={`Audio Part ${part} — ${unitLabel} ${globalSetNum} (${currentSet.transcript.length} lượt thoại)`}
          />

          {/* Metadata + Graphic Table / Image */}
          <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 sm:p-5 shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-lg bg-cyan-500/20 border border-cyan-400/30 px-2.5 py-0.5 text-xs font-extrabold text-cyan-300">
                    {unitLabel} {globalSetNum}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-bold text-indigo-300">
                    <Users className="h-3.5 w-3.5" />
                    {currentSet.part === 3
                      ? `Hội thoại ${currentSet.speakerCount} người`
                      : currentSet.talkType}
                  </span>
                  {currentSet.hasGraphic && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                      <Table2 className="h-3.5 w-3.5" />
                      Kèm bảng biểu (Graphic Question)
                    </span>
                  )}
                </div>
                <h3 className="mt-1.5 text-base sm:text-lg font-extrabold text-white">
                  {currentSet.title}
                </h3>
              </div>
            </div>

            {/* Graphic Table if present */}
            {currentSet.graphic && (
              <div className="rounded-2xl border border-cyan-500/35 bg-slate-950/75 p-4 space-y-2.5">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-cyan-200">
                    {currentSet.graphic.title}
                  </h4>
                  {currentSet.graphic.subtitle && (
                    <p className="text-xs text-slate-400">{currentSet.graphic.subtitle}</p>
                  )}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-900 text-slate-300 uppercase text-[11px]">
                      <tr>
                        {currentSet.graphic.headers.map((h) => (
                          <th key={h} className="px-3.5 py-2.5 font-bold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-950/60">
                      {currentSet.graphic.rows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-slate-800/40">
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className={`px-3.5 py-2.5 ${
                                ci === 0 ? 'font-bold text-white' : 'text-slate-300'
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {currentSet.graphic.footnote && (
                  <p className="text-[11px] italic text-slate-400">{currentSet.graphic.footnote}</p>
                )}
              </div>
            )}

            {/* Graphic Image fallback if present */}
            {currentSet.graphicImageUrl && !currentSet.graphic && (
              <div className="rounded-2xl border border-cyan-500/35 bg-slate-950/75 p-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 mb-2">
                  Biểu đồ / Bảng biểu đính kèm (Graphic)
                </p>
                <ZoomableImage
                  src={currentSet.graphicImageUrl}
                  alt={`Graphic for ${currentSet.title}`}
                  className="mx-auto max-h-80 max-w-full w-auto h-auto rounded-lg bg-white p-1 object-contain"
                />
              </div>
            )}
          </div>

          {/* Interactive Transcript + Shared Key Vocab (Revealed after submission) */}
          {isSubmitted && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <div className="xl:col-span-7 rounded-2xl border border-indigo-500/35 bg-[#1E293B] p-4 sm:p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-indigo-300 uppercase tracking-wider">
                    <MessageSquareText className="h-4 w-4 shrink-0" />
                    Interactive Transcript song ngữ (Bấm từng câu để nghe lại)
                  </h4>
                </div>
                <div className="space-y-2.5">
                  {currentSet.transcript.map((line, lIdx) => {
                    const isActive = activeLineId === line.id;
                    const isHighlighted = highlightedLineId === line.id;
                    const evQuestionNums = currentSet.questions
                      .filter(
                        (q) =>
                          q.evidenceLineIndex === lIdx ||
                          line.evidenceForQuestionIds?.includes(q.id)
                      )
                      .map((q) => `Câu ${q.questionNumber}`);
                    const hasEv = evQuestionNums.length > 0;
                    return (
                      <button
                        key={line.id}
                        id={`transcript-line-${line.id}`}
                        type="button"
                        onClick={() => setExternalPlay({ index: lIdx, token: Date.now() })}
                        className={`w-full rounded-xl border p-3.5 text-left transition flex items-start justify-between gap-3 ${
                          isHighlighted
                            ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50 shadow-lg'
                            : isActive
                            ? 'border-cyan-400 bg-cyan-500/15'
                            : hasEv
                            ? 'transcript-evidence border-indigo-400/50'
                            : 'border-slate-800 bg-slate-900/75 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-extrabold ${
                                line.voiceGender === 'female' ? 'text-pink-300' : 'text-sky-300'
                              }`}
                            >
                              {line.speaker}
                            </span>
                            {hasEv && (
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                                Dẫn chứng {evQuestionNums.join(', ')}
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-sm leading-relaxed ${
                              isHighlighted ? 'evidence-highlight-active font-semibold' : 'text-white'
                            }`}
                          >
                            {line.en}
                          </p>
                          <p className="text-xs text-slate-400 leading-relaxed">{line.vi}</p>
                        </div>
                        <Volume2 className="h-4 w-4 shrink-0 text-cyan-400 mt-1" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shared Set Key Listening Vocab */}
              <div className="xl:col-span-5 rounded-2xl border border-violet-500/35 bg-[#1E293B] p-4 sm:p-5 shadow-card space-y-3">
                <h4 className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-violet-300 uppercase tracking-wider">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Từ vựng trọng tâm của đoạn nghe
                </h4>
                <div className="space-y-2.5">
                  {currentSet.keyVocab.map((v) => {
                    const saved = isWordSaved(v.id);
                    return (
                      <div
                        key={v.id}
                        className="rounded-xl border border-slate-700/70 bg-slate-900/85 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-white">{v.word}</span>
                            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                              {v.pos}
                            </span>
                            <span className="font-mono text-xs text-slate-400">{v.ipaUS}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => speakText(v.word, { accent: 'en-US' })}
                            className="rounded-lg bg-slate-800 p-1.5 text-cyan-400 hover:bg-indigo-600 hover:text-white"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-xs font-semibold text-emerald-300">{v.meaning}</p>
                        <p className="text-[11px] text-slate-400 italic">{v.exampleEn}</p>
                        <button
                          type="button"
                          onClick={() => saveListeningVocab(v)}
                          disabled={saved}
                          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                            saved
                              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {saved ? (
                            <>
                              <BookmarkCheck className="h-3.5 w-3.5" />
                              Đã lưu vào Từ vựng của tôi
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="h-3.5 w-3.5" />
                              Lưu vào Từ vựng của tôi
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3 Sub-Questions */}
          <div className="space-y-4">
            {currentSet.questions.map((q) => {
              const userChoice = answers[q.id];
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 sm:p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <span className="rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
                      Câu {q.questionNumber}
                    </span>
                    <span className="rounded-md bg-slate-900 border border-slate-700 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                      {q.questionType}
                    </span>
                  </div>

                  <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                    {q.prompt}
                  </p>
                  {isSubmitted && <p className="mt-1 text-xs text-cyan-300">{q.promptVi}</p>}

                  <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: k }))}
                          className={`min-h-[48px] flex items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition ${cls}`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-bold mt-0.5">
                            {k}
                          </span>
                          <div>
                            <p className="font-medium leading-snug">{q.options[k].en}</p>
                            {isSubmitted && (
                              <p className="mt-1 text-xs text-slate-400">{q.options[k].vi}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {isSubmitted && (
                    <ListeningAnalysisPanel
                      questionId={q.id}
                      questionLabel={`Listening Part ${part} — Câu ${q.questionNumber} (${q.questionType})`}
                      correctAnswer={q.correctAnswer}
                      userAnswer={userChoice}
                      optionKeys={OPTION_KEYS}
                      explanation={q.explanation}
                      onLocateTranscriptEvidence={
                        typeof q.evidenceLineIndex === 'number' ||
                        currentSet.transcript.some((t) =>
                          t.evidenceForQuestionIds?.includes(q.id)
                        )
                          ? () => handleLocateEvidence(q.id, q.evidenceLineIndex)
                          : undefined
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>

          {!isSubmitted && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!allAnswered}
                onClick={handleSubmitSet}
                className="min-h-[48px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 disabled:opacity-40 px-7 py-3 text-sm font-bold text-white shadow-glow hover:from-blue-500 hover:to-violet-500 transition"
              >
                <CheckCircle2 className="h-5 w-5" />
                Nộp bài ({currentSet.questions.length} câu) &amp; Mở khóa Interactive Transcript + Phân tích
              </button>
            </div>
          )}

          {/* Bottom Prev / Next Bar */}
          <ListeningBottomNavBar
            unitLabel={unitLabel}
            currentIndex={safeIdx}
            totalCount={filteredSets.length}
            onPrev={() => {
              setSetIdx((v) => Math.max(0, v - 1));
              setActiveLineId(null);
            }}
            onNext={() => {
              setSetIdx((v) => Math.min(filteredSets.length - 1, v + 1));
              setActiveLineId(null);
            }}
          />
        </>
      )}
    </div>
  );
};
