import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  ListChecks,
  RotateCcw,
  Send,
  Trophy,
  X,
} from 'lucide-react';
import {
  OptionKey,
  Part2OptionKey,
  ToeicPartNumber,
  ToeicTestData,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { getToeicLevelBadge, scaleSectionScore, TOEIC_PART_LABELS } from '../../utils/toeicScore';
import {
  Part1QuestionBlock,
  Part2QuestionBlock,
  Part34SetBlock,
  Part5QuestionBlock,
  Part6PassageBlock,
  Part7SetBlock,
} from './ToeicQuestionRenderers';

export interface ToeicExamLaunchConfig {
  mode: 'full' | 'mini' | 'custom';
  selectedParts: ToeicPartNumber[];
  durationMinutes: number;
}

interface ToeicTestRunnerProps {
  test: ToeicTestData;
  config: ToeicExamLaunchConfig;
  onExit: () => void;
}

function sliceHalf<T>(arr: T[]): T[] {
  if (arr.length <= 1) return arr;
  return arr.slice(0, Math.max(1, Math.ceil(arr.length / 2)));
}

export const ToeicTestRunner: React.FC<ToeicTestRunnerProps> = ({ test, config, onExit }) => {
  const { recordAttempt, recordWrongQuestion, recordExamHistory } = useApp();

  // Build active slices based on Full / Mini (50%) / Custom Selected Parts
  const activeData = useMemo(() => {
    const has = (p: ToeicPartNumber) => config.selectedParts.includes(p);
    const isMini = config.mode === 'mini';
    return {
      part1: has(1) ? (isMini ? sliceHalf(test.parts.part1) : test.parts.part1) : [],
      part2: has(2) ? (isMini ? sliceHalf(test.parts.part2) : test.parts.part2) : [],
      part3: has(3) ? (isMini ? sliceHalf(test.parts.part3) : test.parts.part3) : [],
      part4: has(4) ? (isMini ? sliceHalf(test.parts.part4) : test.parts.part4) : [],
      part5: has(5) ? (isMini ? sliceHalf(test.parts.part5) : test.parts.part5) : [],
      part6: has(6) ? (isMini ? sliceHalf(test.parts.part6) : test.parts.part6) : [],
      part7: has(7) ? (isMini ? sliceHalf(test.parts.part7) : test.parts.part7) : [],
    };
  }, [test, config]);

  const orderedParts = useMemo(
    () => ([1, 2, 3, 4, 5, 6, 7] as ToeicPartNumber[]).filter((p) => config.selectedParts.includes(p)),
    [config.selectedParts]
  );

  // Flat list of all questions in order for numbering, navigator, & scoring
  const flatItems = useMemo(() => {
    const list: { id: string; num: number; part: ToeicPartNumber; correct: string; topic: string }[] = [];
    let num = 1;
    activeData.part1.forEach((q) => list.push({ id: q.id, num: num++, part: 1, correct: q.correctAnswer, topic: `Part 1 — ${q.sceneType}` }));
    activeData.part2.forEach((q) => list.push({ id: q.id, num: num++, part: 2, correct: q.correctAnswer, topic: `Part 2 — ${q.questionType}` }));
    activeData.part3.forEach((s) => s.questions.forEach((q) => list.push({ id: q.id, num: num++, part: 3, correct: q.correctAnswer, topic: `Part 3 — ${q.questionType}` })));
    activeData.part4.forEach((s) => s.questions.forEach((q) => list.push({ id: q.id, num: num++, part: 4, correct: q.correctAnswer, topic: `Part 4 — ${q.questionType}` })));
    activeData.part5.forEach((q) => list.push({ id: q.id, num: num++, part: 5, correct: q.correctAnswer, topic: `Part 5 — ${q.topic}` }));
    activeData.part6.forEach((p) => p.questions.forEach((q) => list.push({ id: q.id, num: num++, part: 6, correct: q.correctAnswer, topic: `Part 6 — ${q.questionType}` })));
    activeData.part7.forEach((s) => s.questions.forEach((q) => list.push({ id: q.id, num: num++, part: 7, correct: q.correctAnswer, topic: `Part 7 — ${q.questionType}` })));
    return list;
  }, [activeData]);

  const questionNumById = useMemo(() => {
    const m = new Map<string, number>();
    flatItems.forEach((x) => m.set(x.id, x.num));
    return m;
  }, [flatItems]);

  const [activePart, setActivePart] = useState<ToeicPartNumber>(orderedParts[0] || 1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'correct'>('all');
  const [showPalette, setShowPalette] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  // Lock background scroll while mobile Question Palette Bottom Sheet is open
  useEffect(() => {
    if (!mobilePaletteOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobilePaletteOpen]);

  const jumpToQuestion = useCallback((part: ToeicPartNumber, qId: string) => {
    setActivePart(part);
    setShowPalette(false);
    setMobilePaletteOpen(false);
    window.setTimeout(() => {
      const el = document.getElementById(`exam-q-${qId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 120, behavior: 'smooth' });
      }
    }, 80);
  }, []);

  const initialSeconds = Math.max(60, config.durationMinutes * 60);
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const submittedRef = useRef(false);

  const computeScoreSummary = useCallback(
    (ansMap: Record<string, string>) => {
      const partBreakdown = orderedParts.map((part) => {
        const items = flatItems.filter((x) => x.part === part);
        const correct = items.filter((x) => ansMap[x.id] === x.correct).length;
        return { part, correct, total: items.length };
      });
      const listeningItems = flatItems.filter((x) => x.part <= 4);
      const readingItems = flatItems.filter((x) => x.part >= 5);
      const listeningCorrect = listeningItems.filter((x) => ansMap[x.id] === x.correct).length;
      const readingCorrect = readingItems.filter((x) => ansMap[x.id] === x.correct).length;
      const listeningScore = scaleSectionScore(listeningCorrect, listeningItems.length, 'listening');
      const readingScore = scaleSectionScore(readingCorrect, readingItems.length, 'reading');
      const totalScore =
        listeningScore !== null && readingScore !== null ? listeningScore + readingScore : null;
      return {
        partBreakdown,
        listeningCorrect,
        listeningTotal: listeningItems.length,
        readingCorrect,
        readingTotal: readingItems.length,
        listeningScore,
        readingScore,
        totalScore,
      };
    },
    [flatItems, orderedParts]
  );

  const handleSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);

    const summary = computeScoreSummary(answers);
    const elapsedSeconds = Math.max(1, initialSeconds - timeLeft);

    // Record analytics attempts per section
    if (summary.listeningTotal > 0) {
      const lItems = flatItems.filter((x) => x.part <= 4);
      recordAttempt({
        module: 'listening',
        partLabel: config.mode === 'full' ? 'ETS Full Test' : 'ETS Listening',
        correctCount: summary.listeningCorrect,
        totalCount: summary.listeningTotal,
        topics: lItems.map((x) => ({ topic: x.topic, correct: answers[x.id] === x.correct })),
      });
    }
    if (summary.readingTotal > 0) {
      const rItems = flatItems.filter((x) => x.part >= 5);
      recordAttempt({
        module: 'reading',
        partLabel: config.mode === 'full' ? 'ETS Full Test' : 'ETS Reading',
        correctCount: summary.readingCorrect,
        totalCount: summary.readingTotal,
        topics: rItems.map((x) => ({ topic: x.topic, correct: answers[x.id] === x.correct })),
      });
    }

    // Record full exam history with 990 scaled score
    recordExamHistory({
      testId: test.id,
      testTitle: test.title,
      mode: config.mode,
      selectedParts: orderedParts,
      elapsedSeconds,
      ...summary,
    });

    // Save EVERY wrong answer into "Sổ tay câu sai"
    activeData.part1.forEach((item) => {
      if (answers[item.id] !== item.correctAnswer) {
        recordWrongQuestion({
          id: item.id,
          part: 1,
          sourceTitle: test.title,
          topicLabel: item.title,
          userWrongAnswer: answers[item.id] || 'Chưa chọn',
          correctAnswer: item.correctAnswer,
          payload: { kind: 'part1', item },
        });
      }
    });
    activeData.part2.forEach((item) => {
      if (answers[item.id] !== item.correctAnswer) {
        recordWrongQuestion({
          id: item.id,
          part: 2,
          sourceTitle: test.title,
          topicLabel: item.title,
          userWrongAnswer: answers[item.id] || 'Chưa chọn',
          correctAnswer: item.correctAnswer,
          payload: { kind: 'part2', item },
        });
      }
    });
    activeData.part3.forEach((set) => {
      set.questions.forEach((q) => {
        if (answers[q.id] !== q.correctAnswer) {
          recordWrongQuestion({
            id: q.id,
            part: 3,
            sourceTitle: test.title,
            topicLabel: `${set.title} — ${q.questionType}`,
            userWrongAnswer: answers[q.id] || 'Chưa chọn',
            correctAnswer: q.correctAnswer,
            payload: { kind: 'part3', set, questionId: q.id },
          });
        }
      });
    });
    activeData.part4.forEach((set) => {
      set.questions.forEach((q) => {
        if (answers[q.id] !== q.correctAnswer) {
          recordWrongQuestion({
            id: q.id,
            part: 4,
            sourceTitle: test.title,
            topicLabel: `${set.title} — ${q.questionType}`,
            userWrongAnswer: answers[q.id] || 'Chưa chọn',
            correctAnswer: q.correctAnswer,
            payload: { kind: 'part4', set, questionId: q.id },
          });
        }
      });
    });
    activeData.part5.forEach((item) => {
      if (answers[item.id] !== item.correctAnswer) {
        recordWrongQuestion({
          id: item.id,
          part: 5,
          sourceTitle: test.title,
          topicLabel: item.topic,
          userWrongAnswer: answers[item.id] || 'Chưa chọn',
          correctAnswer: item.correctAnswer,
          payload: { kind: 'part5', item },
        });
      }
    });
    activeData.part6.forEach((passage) => {
      passage.questions.forEach((q) => {
        if (answers[q.id] !== q.correctAnswer) {
          recordWrongQuestion({
            id: q.id,
            part: 6,
            sourceTitle: test.title,
            topicLabel: `${passage.title} — ${q.questionType}`,
            userWrongAnswer: answers[q.id] || 'Chưa chọn',
            correctAnswer: q.correctAnswer,
            payload: { kind: 'part6', passage, questionId: q.id },
          });
        }
      });
    });
    activeData.part7.forEach((set) => {
      set.questions.forEach((q) => {
        if (answers[q.id] !== q.correctAnswer) {
          recordWrongQuestion({
            id: q.id,
            part: 7,
            sourceTitle: test.title,
            topicLabel: `${set.title} — ${q.questionType}`,
            userWrongAnswer: answers[q.id] || 'Chưa chọn',
            correctAnswer: q.correctAnswer,
            payload: { kind: 'part7', set, questionId: q.id },
          });
        }
      });
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [
    activeData,
    answers,
    computeScoreSummary,
    config.mode,
    flatItems,
    initialSeconds,
    orderedParts,
    recordAttempt,
    recordExamHistory,
    recordWrongQuestion,
    test.id,
    test.title,
    timeLeft,
  ]);

  // Countdown timer
  useEffect(() => {
    if (submitted) return;
    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [submitted, handleSubmit]);

  const summary = useMemo(() => computeScoreSummary(answers), [answers, computeScoreSummary]);
  const levelBadge = getToeicLevelBadge(summary.totalScore);
  const answeredCount = flatItems.filter((x) => Boolean(answers[x.id])).length;
  const wrongItems = useMemo(
    () => flatItems.filter((x) => answers[x.id] !== x.correct),
    [flatItems, answers]
  );

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleRetake = () => {
    submittedRef.current = false;
    setAnswers({});
    setSubmitted(false);
    setReviewFilter('all');
    setTimeLeft(initialSeconds);
    setActivePart(orderedParts[0] || 1);
  };

  const matchesReviewFilter = (qIds: string[]) => {
    if (!submitted || reviewFilter === 'all') return true;
    if (reviewFilter === 'wrong') return qIds.some((id) => {
      const item = flatItems.find((f) => f.id === id);
      return item ? answers[id] !== item.correct : false;
    });
    return qIds.some((id) => {
      const item = flatItems.find((f) => f.id === id);
      return item ? answers[id] === item.correct : false;
    });
  };

  const activePartIdx = orderedParts.indexOf(activePart);
  const canGoPrevPart = activePartIdx > 0;
  const canGoNextPart = activePartIdx >= 0 && activePartIdx < orderedParts.length - 1;

  return (
    <div className="space-y-4 sm:space-y-5 pb-24 lg:pb-0">
      {/* Sticky Exam Top Bar */}
      <div className="sticky top-14 md:top-16 z-20 rounded-2xl border border-slate-700/80 bg-[#0F172A]/95 backdrop-blur-md p-3 sm:p-4 shadow-card space-y-2.5 sm:space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 sm:px-3 py-2 text-xs font-bold text-slate-200 transition shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Thoát đề</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold text-indigo-300 uppercase">
                  {config.mode === 'full' ? 'Full Test' : config.mode === 'mini' ? 'Mini Test (50%)' : 'Chọn Part'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {answeredCount}/{flatItems.length} câu đã làm
                </span>
              </div>
              <h3 className="truncate text-xs sm:text-base font-extrabold text-white">{test.title}</h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {!submitted && (
              <div
                className={`hidden lg:inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-xs sm:text-sm font-extrabold ${
                  timeLeft < 180
                    ? 'border-rose-500/60 bg-rose-950/50 text-rose-300 animate-pulse'
                    : 'border-slate-700 bg-slate-900 text-sky-300'
                }`}
              >
                <Clock className="h-4 w-4" />
                {formatTime(timeLeft)}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowPalette((v) => !v)}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition"
            >
              <ListChecks className="h-4 w-4 text-sky-400" />
              Bảng câu hỏi
            </button>

            {!submitted ? (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 px-3 sm:px-4 py-2 text-xs sm:text-sm font-extrabold text-white shadow-glow transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span className="sm:hidden">Nộp bài</span>
                <span className="hidden sm:inline">Nộp bài &amp; Chấm điểm 990</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 px-3 sm:px-4 py-2 text-xs font-bold text-indigo-200 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Làm lại
              </button>
            )}
          </div>
        </div>

        {/* Part Switcher Pills (horizontal swipe on mobile, wrap on sm+) */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-800/80">
          {orderedParts.map((part) => {
            const items = flatItems.filter((x) => x.part === part);
            const done = items.filter((x) => Boolean(answers[x.id])).length;
            const correct = submitted ? items.filter((x) => answers[x.id] === x.correct).length : 0;
            const active = activePart === part;
            return (
              <button
                key={part}
                type="button"
                onClick={() => setActivePart(part)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
              >
                Part {part}{' '}
                <span className="opacity-80">
                  ({submitted ? `${correct}/${items.length}` : `${done}/${items.length}`})
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop Collapsible Question Navigator Grid */}
        {showPalette && (
          <div className="hidden lg:flex rounded-xl border border-slate-800 bg-slate-950/80 p-3 flex-wrap gap-1.5 max-h-56 overflow-y-auto">
            {flatItems.map((item) => {
              const answered = Boolean(answers[item.id]);
              const ok = submitted && answers[item.id] === item.correct;
              let cls = 'bg-slate-800 text-slate-400 border-slate-700';
              if (submitted) {
                cls = ok
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/50';
              } else if (answered) {
                cls = 'bg-sky-500/25 text-sky-200 border-sky-400/50';
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => jumpToQuestion(item.part, item.id)}
                  title={`Câu ${item.num} (Part ${item.part})`}
                  className={`h-8 w-8 rounded-lg border text-xs font-extrabold transition ${cls}`}
                >
                  {item.num}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= POST-SUBMISSION TOEIC 990 SCORE DASHBOARD ================= */}
      {submitted && (
        <div className="rounded-3xl border border-indigo-500/40 bg-gradient-to-br from-[#16223D] via-[#131C30] to-[#0F172A] p-6 shadow-card space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 px-3 py-1 text-xs font-extrabold text-amber-300">
                  <Trophy className="h-3.5 w-3.5" />
                  KẾT QUẢ QUY ĐỔI THANG ĐIỂM TOEIC 990
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${levelBadge.colorClass}`}>
                  {levelBadge.label} ({levelBadge.cefr})
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">{test.title}</h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Tổng câu đúng:{' '}
                <b className="text-emerald-300">
                  {summary.listeningCorrect + summary.readingCorrect}/{flatItems.length}
                </b>{' '}
                • Thời gian làm bài: <b className="text-white">{formatTime(Math.max(1, initialSeconds - timeLeft))}</b>
                {wrongItems.length > 0 && (
                  <>
                    {' '}• Đã tự động lưu <b className="text-rose-300">{wrongItems.length} câu sai</b> vào <b>Sổ tay câu sai</b>!
                  </>
                )}
              </p>
            </div>

            {/* 3 Score Cards: Total /990, Listening /495, Reading /495 */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="rounded-2xl border border-indigo-500/40 bg-slate-900/90 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase text-indigo-300">Tổng điểm</p>
                <p className="mt-1 text-2xl sm:text-3xl font-black bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  {summary.totalScore !== null ? summary.totalScore : '—'}
                </p>
                <p className="text-[11px] text-slate-400">/ 990</p>
              </div>
              <div className="rounded-2xl border border-cyan-500/35 bg-slate-900/90 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase text-cyan-300">Listening</p>
                <p className="mt-1 text-2xl sm:text-3xl font-black text-cyan-300">
                  {summary.listeningScore !== null ? summary.listeningScore : '—'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {summary.listeningTotal > 0 ? `${summary.listeningCorrect}/${summary.listeningTotal} câu` : 'Không chọn'}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/35 bg-slate-900/90 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase text-emerald-300">Reading</p>
                <p className="mt-1 text-2xl sm:text-3xl font-black text-emerald-300">
                  {summary.readingScore !== null ? summary.readingScore : '—'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {summary.readingTotal > 0 ? `${summary.readingCorrect}/${summary.readingTotal} câu` : 'Không chọn'}
                </p>
              </div>
            </div>
          </div>

          {/* Per-Part Accuracy Bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
            {summary.partBreakdown.map((pb) => {
              const pct = Math.round((pb.correct / Math.max(1, pb.total)) * 100);
              return (
                <button
                  key={pb.part}
                  type="button"
                  onClick={() => setActivePart(pb.part)}
                  className="rounded-xl border border-slate-800 bg-slate-900/75 hover:border-indigo-500/50 p-3 text-left transition"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white">Part {pb.part}</span>
                    <span className={pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                      {pb.correct}/{pb.total} ({pct}%)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{TOEIC_PART_LABELS[pb.part].shortDesc}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Jump to Wrong Questions + Review Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-300">Lọc xem giải thích:</span>
              {[
                { id: 'all' as const, label: `Tất cả (${flatItems.length})` },
                { id: 'wrong' as const, label: `Chỉ câu sai (${wrongItems.length})` },
                { id: 'correct' as const, label: `Câu đúng (${flatItems.length - wrongItems.length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setReviewFilter(f.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    reviewFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {wrongItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Nhảy tới câu sai:
                </span>
                {wrongItems.slice(0, 12).map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setActivePart(w.part);
                      setReviewFilter('wrong');
                    }}
                    className="rounded-md border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-rose-200 transition"
                  >
                    #{w.num} (P{w.part})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= ACTIVE PART QUESTION LIST ================= */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-extrabold text-white">{TOEIC_PART_LABELS[activePart].name}</h4>
            <p className="text-xs text-slate-400">{TOEIC_PART_LABELS[activePart].shortDesc}</p>
          </div>
          {orderedParts.indexOf(activePart) < orderedParts.length - 1 && (
            <button
              type="button"
              onClick={() => setActivePart(orderedParts[orderedParts.indexOf(activePart) + 1])}
              className="rounded-xl border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 px-3.5 py-2 text-xs font-bold text-indigo-200 transition"
            >
              Sang Part {orderedParts[orderedParts.indexOf(activePart) + 1]} →
            </button>
          )}
        </div>

        {activePart === 1 &&
          activeData.part1
            .filter((item) => matchesReviewFilter([item.id]))
            .map((item) => (
              <div key={item.id} id={`exam-q-${item.id}`} className="scroll-mt-36">
                <Part1QuestionBlock
                  item={item}
                  displayNumber={questionNumById.get(item.id) || 1}
                  selected={answers[item.id] as OptionKey | undefined}
                  onSelect={(opt) => setAnswers((p) => ({ ...p, [item.id]: opt }))}
                  showExplanation={submitted}
                />
              </div>
            ))}

        {activePart === 2 &&
          activeData.part2
            .filter((item) => matchesReviewFilter([item.id]))
            .map((item) => (
              <div key={item.id} id={`exam-q-${item.id}`} className="scroll-mt-36">
                <Part2QuestionBlock
                  item={item}
                  displayNumber={questionNumById.get(item.id) || 1}
                  selected={answers[item.id] as Part2OptionKey | undefined}
                  onSelect={(opt) => setAnswers((p) => ({ ...p, [item.id]: opt }))}
                  showExplanation={submitted}
                />
              </div>
            ))}

        {activePart === 3 &&
          activeData.part3
            .filter((s) => matchesReviewFilter(s.questions.map((q) => q.id)))
            .map((set) => (
              <div key={set.id} id={`exam-q-${set.questions[0]?.id || set.id}`} className="scroll-mt-36">
                <Part34SetBlock
                  set={set}
                  startQuestionNumber={questionNumById.get(set.questions[0]?.id) || 1}
                  answers={answers as Record<string, OptionKey>}
                  onSelect={(qId, opt) => setAnswers((p) => ({ ...p, [qId]: opt }))}
                  showExplanation={submitted}
                />
              </div>
            ))}

        {activePart === 4 &&
          activeData.part4
            .filter((s) => matchesReviewFilter(s.questions.map((q) => q.id)))
            .map((set) => (
              <div key={set.id} id={`exam-q-${set.questions[0]?.id || set.id}`} className="scroll-mt-36">
                <Part34SetBlock
                  set={set}
                  startQuestionNumber={questionNumById.get(set.questions[0]?.id) || 1}
                  answers={answers as Record<string, OptionKey>}
                  onSelect={(qId, opt) => setAnswers((p) => ({ ...p, [qId]: opt }))}
                  showExplanation={submitted}
                />
              </div>
            ))}

        {activePart === 5 &&
          activeData.part5
            .filter((item) => matchesReviewFilter([item.id]))
            .map((item) => (
              <div key={item.id} id={`exam-q-${item.id}`} className="scroll-mt-36">
                <Part5QuestionBlock
                  item={item}
                  displayNumber={questionNumById.get(item.id) || 1}
                  selected={answers[item.id] as OptionKey | undefined}
                  onSelect={(opt) => setAnswers((p) => ({ ...p, [item.id]: opt }))}
                  showExplanation={submitted}
                />
              </div>
            ))}

        {activePart === 6 &&
          activeData.part6
            .filter((p) => matchesReviewFilter(p.questions.map((q) => q.id)))
            .map((passage) => (
              <div key={passage.id} id={`exam-q-${passage.questions[0]?.id || passage.id}`} className="scroll-mt-36">
                <Part6PassageBlock
                  passage={passage}
                  startQuestionNumber={questionNumById.get(passage.questions[0]?.id) || 1}
                  answers={answers as Record<string, OptionKey>}
                  onSelect={(qId, opt) => setAnswers((p) => ({ ...p, [qId]: opt }))}
                  showExplanation={submitted}
                />
              </div>
            ))}

        {activePart === 7 &&
          activeData.part7
            .filter((s) => matchesReviewFilter(s.questions.map((q) => q.id)))
            .map((set) => (
              <div key={set.id} id={`exam-q-${set.questions[0]?.id || set.id}`} className="scroll-mt-36">
                <Part7SetBlock
                  set={set}
                  startQuestionNumber={questionNumById.get(set.questions[0]?.id) || 1}
                  answers={answers as Record<string, OptionKey>}
                  onSelect={(qId, opt) => setAnswers((p) => ({ ...p, [qId]: opt }))}
                  showExplanation={submitted}
                />
              </div>
            ))}
      </div>

      {/* Bottom Submit CTA */}
      {!submitted && (
        <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
            <Award className="h-5 w-5 text-indigo-400 shrink-0" />
            <span>
              Đã hoàn thành <b className="text-white">{answeredCount}/{flatItems.length}</b> câu hỏi.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 px-6 py-3 text-sm font-extrabold text-white shadow-glow transition"
          >
            <CheckCircle2 className="h-4 w-4" />
            Nộp bài &amp; Quy đổi điểm TOEIC 990
          </button>
        </div>
      )}

      {/* ================= STICKY MOBILE BOTTOM BAR (< lg) ================= */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-700/90 bg-[#0F172A]/95 backdrop-blur-md px-3 pt-2.5 pb-safe shadow-2xl">
        <div className="flex items-center justify-between gap-2 max-w-xl mx-auto">
          {/* Progress + Countdown */}
          <div className="flex items-center gap-2 min-w-0">
            {!submitted ? (
              <span
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 font-mono text-xs font-extrabold shrink-0 ${
                  timeLeft < 180
                    ? 'border-rose-500/60 bg-rose-950/60 text-rose-300 animate-pulse'
                    : 'border-slate-700 bg-slate-900 text-sky-300'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {formatTime(timeLeft)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-2 text-xs font-extrabold text-emerald-300 shrink-0">
                <Trophy className="h-3.5 w-3.5" />
                {summary.totalScore ?? `${summary.listeningCorrect + summary.readingCorrect}/${flatItems.length}`}
              </span>
            )}
            <span className="text-[11px] font-bold text-slate-300 truncate">
              {answeredCount}/{flatItems.length}
            </span>
          </div>

          {/* Prev / Next Part + Palette Bottom Sheet Trigger */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!canGoPrevPart}
              onClick={() => {
                if (canGoPrevPart) {
                  setActivePart(orderedParts[activePartIdx - 1]);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              aria-label="Part trước"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200 disabled:opacity-35 active:scale-95 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setMobilePaletteOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-indigo-500/50 bg-indigo-600/25 px-3 text-xs font-extrabold text-indigo-100 active:scale-95 transition"
            >
              <ListChecks className="h-4 w-4 text-sky-300" />
              <span>Bảng câu</span>
            </button>

            <button
              type="button"
              disabled={!canGoNextPart}
              onClick={() => {
                if (canGoNextPart) {
                  setActivePart(orderedParts[activePartIdx + 1]);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              aria-label="Part tiếp theo"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200 disabled:opacity-35 active:scale-95 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= MOBILE QUESTION PALETTE BOTTOM SHEET (< lg) ================= */}
      {mobilePaletteOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setMobilePaletteOpen(false)}
        >
          <div
            className="w-full max-h-[78dvh] flex flex-col rounded-t-3xl border-t border-slate-700/80 bg-[#0F172A] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3.5 shrink-0">
              <div>
                <h4 className="text-sm font-extrabold text-white">
                  Bảng câu hỏi ({answeredCount}/{flatItems.length} đã làm)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Bấm số câu để nhảy nhanh đến đúng Part và câu hỏi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(false)}
                aria-label="Đóng bảng câu hỏi"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 pb-safe overflow-y-auto flex-1 space-y-4">
              {orderedParts.map((part) => {
                const pItems = flatItems.filter((x) => x.part === part);
                return (
                  <div key={part} className="space-y-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                      Part {part} ({pItems.filter((x) => Boolean(answers[x.id])).length}/{pItems.length})
                    </p>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                      {pItems.map((item) => {
                        const answered = Boolean(answers[item.id]);
                        const ok = submitted && answers[item.id] === item.correct;
                        let cls = 'bg-slate-800 text-slate-300 border-slate-700';
                        if (submitted) {
                          cls = ok
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/50';
                        } else if (answered) {
                          cls = 'bg-sky-500/25 text-sky-200 border-sky-400/50';
                        }
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => jumpToQuestion(item.part, item.id)}
                            className={`h-10 rounded-xl border text-xs font-extrabold transition active:scale-95 ${cls}`}
                          >
                            {item.num}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
