import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Languages,
  Lightbulb,
  Loader2,
  PenLine,
  RotateCcw,
  Send,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import { GrammarCatalogItem, GrammarExercise, GrammarTopicDetail } from '../../types';
import { useApp } from '../../context/AppContext';
import { loadGrammarTopic } from '../../utils/grammarLoader';
import { playComplete, playCorrect, playWrong } from '../../lib/soundEffects';
import { GRAMMAR_LEVEL_STYLES } from './GrammarHub';

interface GrammarTopicViewProps {
  topicId: string;
  catalog: GrammarCatalogItem[];
}

type GrammarTab = 'theory' | 'practice';
type PracticeGradingMode = 'instant' | 'exam';

/** Render lightweight inline **bold** segments cleanly for grammar emphasis. */
function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong
          key={idx}
          className="font-extrabold text-indigo-700 dark:text-sky-300 bg-indigo-50/90 dark:bg-sky-500/15 px-1 rounded"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/** Highlight [A], [B], [C], [D] markers cleanly inside error-correction prompts. */
function renderPromptText(ex: GrammarExercise): React.ReactNode {
  if (ex.type === 'error-correction') {
    const parts = ex.prompt.split(/(\[[A-D]\])/g);
    return parts.map((part, idx) => {
      if (/^\[[A-D]\]$/.test(part)) {
        return (
          <span
            key={idx}
            className="mx-0.5 inline-flex items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-500/25 border border-indigo-300 dark:border-indigo-400/40 px-1.5 py-0.5 text-[11px] font-extrabold text-indigo-800 dark:text-indigo-200 align-middle"
          >
            {part.slice(1, 2)}
          </span>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  }

  const blankParts = ex.prompt.split('____');
  return blankParts.map((part, idx, arr) => (
    <React.Fragment key={idx}>
      {part}
      {idx < arr.length - 1 && (
        <span className="mx-1 inline-block min-w-[64px] border-b-2 border-dashed border-indigo-500 dark:border-sky-400 text-center font-mono text-indigo-600 dark:text-sky-300">
          ____
        </span>
      )}
    </React.Fragment>
  ));
}

function isExerciseCorrect(ex: GrammarExercise, answer: string | undefined): boolean {
  if (!answer || !answer.trim()) return false;
  if (ex.type === 'fill-blank') {
    const norm = answer.trim().replace(/\s+/g, ' ').toLowerCase();
    const accepted = (ex.acceptedAnswers && ex.acceptedAnswers.length > 0
      ? ex.acceptedAnswers
      : [ex.correctAnswer]
    ).map((a) => a.trim().replace(/\s+/g, ' ').toLowerCase());
    return accepted.includes(norm);
  }
  return answer.trim().toUpperCase() === ex.correctAnswer.trim().toUpperCase();
}

export const GrammarTopicView: React.FC<GrammarTopicViewProps> = ({ topicId, catalog }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { grammarProgress, markGrammarTheoryRead, recordGrammarQuizResult } = useApp();

  const rawTab = searchParams.get('tab');
  const activeTab: GrammarTab = rawTab === 'practice' ? 'practice' : 'theory';

  const setActiveTab = (tab: GrammarTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true }
    );
  };

  const [topic, setTopic] = useState<GrammarTopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Practice state
  const [gradingMode, setGradingMode] = useState<PracticeGradingMode>('instant');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [recordedCurrentRun, setRecordedCurrentRun] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setAnswers({});
    setCheckedMap({});
    setExamSubmitted(false);
    setRecordedCurrentRun(false);

    loadGrammarTopic(topicId)
      .then((data) => {
        if (!mounted) return;
        setTopic(data);
        markGrammarTheoryRead(data.id, data.exercises.length);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Không thể tải chuyên đề.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [topicId]);

  const nextTopic = useMemo(() => {
    if (!topic || catalog.length === 0) return null;
    const idx = catalog.findIndex((c) => c.id === topic.id);
    if (idx >= 0 && idx + 1 < catalog.length) return catalog[idx + 1];
    return null;
  }, [topic, catalog]);

  const exercises = topic?.exercises || [];

  const scoreSummary = useMemo(() => {
    let correct = 0;
    let graded = 0;
    for (const ex of exercises) {
      const isGraded = gradingMode === 'exam' ? examSubmitted : Boolean(checkedMap[ex.id]);
      if (isGraded) {
        graded += 1;
        if (isExerciseCorrect(ex, answers[ex.id])) correct += 1;
      }
    }
    return {
      correct,
      graded,
      total: exercises.length,
      allGraded: exercises.length > 0 && graded === exercises.length,
    };
  }, [exercises, gradingMode, examSubmitted, checkedMap, answers]);

  // Auto-record score & celebrate once all 12 questions are graded in instant mode
  useEffect(() => {
    if (!topic || recordedCurrentRun || !scoreSummary.allGraded) return;
    setRecordedCurrentRun(true);
    recordGrammarQuizResult(topic.id, scoreSummary.correct, scoreSummary.total);
    window.setTimeout(() => playComplete(), 250);
  }, [topic, recordedCurrentRun, scoreSummary, recordGrammarQuizResult]);

  const handleSelectOption = (ex: GrammarExercise, optionKey: string) => {
    if (gradingMode === 'exam' && examSubmitted) return;
    if (gradingMode === 'instant' && checkedMap[ex.id]) return;

    setAnswers((prev) => ({ ...prev, [ex.id]: optionKey }));

    if (gradingMode === 'instant') {
      const ok = isExerciseCorrect(ex, optionKey);
      if (ok) playCorrect();
      else playWrong();
      setCheckedMap((prev) => ({ ...prev, [ex.id]: true }));
    }
  };

  const handleCheckFillBlank = (ex: GrammarExercise) => {
    const val = answers[ex.id] || '';
    if (!val.trim()) return;
    const ok = isExerciseCorrect(ex, val);
    if (ok) playCorrect();
    else playWrong();
    setCheckedMap((prev) => ({ ...prev, [ex.id]: true }));
  };

  const handleSubmitExam = () => {
    if (!topic || examSubmitted) return;
    setExamSubmitted(true);
    let correct = 0;
    for (const ex of exercises) {
      if (isExerciseCorrect(ex, answers[ex.id])) correct += 1;
    }
    setRecordedCurrentRun(true);
    recordGrammarQuizResult(topic.id, correct, exercises.length);
    playComplete();
    window.scrollTo({ top: 140, behavior: 'smooth' });
  };

  const handleResetPractice = () => {
    setAnswers({});
    setCheckedMap({});
    setExamSubmitted(false);
    setRecordedCurrentRun(false);
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 flex items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        Đang tải chuyên đề ngữ pháp...
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="rounded-3xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 p-8 text-center space-y-3">
        <p className="text-sm font-bold text-rose-700 dark:text-rose-200">
          {error || 'Không tìm thấy chuyên đề ngữ pháp.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/grammar')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Lộ trình Ngữ pháp
        </button>
      </div>
    );
  }

  const prog = grammarProgress[topic.id];
  const answeredCount = exercises.filter((ex) => Boolean((answers[ex.id] || '').trim())).length;

  return (
    <div className="space-y-5">
      {/* ================= TOP HEADER & 2-TAB SWITCHER ================= */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/grammar')}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-indigo-400 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Lộ trình Ngữ pháp
              </button>

              <span className="rounded-lg bg-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                Chuyên đề #{String(topic.order).padStart(2, '0')}
              </span>

              <span
                className={`rounded-lg border px-2 py-0.5 text-[11px] font-extrabold ${
                  GRAMMAR_LEVEL_STYLES[topic.level]
                }`}
              >
                {topic.levelLabel}
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">
              {topic.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{topic.subtitle}</p>
          </div>

          {prog && prog.attemptsCount > 0 && (
            <div className="shrink-0 rounded-2xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-950/25 px-3.5 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Điểm cao nhất
              </p>
              <p className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                {prog.bestScore}/{prog.totalQuestions} ({prog.bestAccuracy}%)
              </p>
            </div>
          )}
        </div>

        {/* 2-Tab Bar */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('theory')}
            className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs sm:text-sm font-extrabold transition ${
              activeTab === 'theory'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">Lý thuyết &amp; Mẹo ETS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('practice')}
            className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs sm:text-sm font-extrabold transition ${
              activeTab === 'practice'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PenLine className="h-4 w-4 shrink-0" />
            <span className="truncate">Bài tập thực hành ({exercises.length} câu)</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: LÝ THUYẾT TRỌNG TÂM & MẸO ETS ================= */}
      {activeTab === 'theory' && (
        <div className="space-y-5">
          {/* 1. Core Essence Summary */}
          <section className="rounded-2xl sm:rounded-3xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/60 dark:bg-[#111D34] p-4 sm:p-6 shadow-card space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              <Sparkles className="h-4 w-4" />
              1. Tóm tắt bản chất cốt lõi
            </div>
            <p className="text-sm sm:text-[15px] text-slate-800 dark:text-slate-100 leading-relaxed">
              {topic.summaryVi}
            </p>
            <ul className="space-y-2 pt-1">
              {topic.keyTakeaways.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-600 text-[11px] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 2. Quick 3-Second Signals */}
          <section className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-6 shadow-card space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <Zap className="h-4 w-4" />
              2. Dấu hiệu nhận biết 3 giây (ETS Speed Scan)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topic.quickSignals.map((sig, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-emerald-200/80 dark:border-emerald-500/25 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 sm:p-4 space-y-1.5"
                >
                  <p className="font-mono text-xs sm:text-[13px] font-extrabold text-emerald-800 dark:text-emerald-300">
                    {sig.signal}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    {sig.rule}
                  </p>
                  <p className="text-xs italic text-slate-600 dark:text-slate-400 border-t border-emerald-200/60 dark:border-emerald-500/20 pt-1.5">
                    VD: {sig.example}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Formula Tables */}
          {topic.formulaTables.map((table, ti) => (
            <section
              key={ti}
              className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-6 shadow-card space-y-3"
            >
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-500 shrink-0" />
                {table.title}
              </h3>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[540px] text-left text-xs sm:text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 uppercase text-[11px]">
                    <tr>
                      {table.headers.map((h, hi) => (
                        <th key={hi} className="px-3.5 py-2.5 font-extrabold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#0F172A]/60">
                    {table.rows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={`px-3.5 py-2.5 align-top leading-relaxed whitespace-pre-line ${
                              ci === 0
                                ? 'font-bold text-indigo-700 dark:text-sky-300'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {renderFormattedText(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {/* 4. Classic ETS Traps */}
          <section className="rounded-2xl sm:rounded-3xl border border-amber-300/80 dark:border-amber-500/35 bg-amber-50/60 dark:bg-amber-950/15 p-4 sm:p-6 shadow-card space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Các bẫy kinh điển ETS hay ra thi
            </div>

            <div className="space-y-3">
              {topic.etsTraps.map((trap, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-amber-200 dark:border-slate-800 bg-white dark:bg-[#111827]/95 p-4 space-y-2"
                >
                  <h4 className="text-xs sm:text-sm font-extrabold text-amber-900 dark:text-amber-200">
                    {trap.title}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/25 px-3 py-2 text-rose-800 dark:text-rose-200">
                      <span className="font-extrabold">✗ Sai: </span>
                      <span className="line-through opacity-85">{trap.wrongExample}</span>
                    </div>
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/25 px-3 py-2 text-emerald-800 dark:text-emerald-200">
                      <span className="font-extrabold">✓ Đúng: </span>
                      <span>{trap.correctExample}</span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {trap.explanationVi}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Bilingual Office Examples (compatible with TextSelectionLookup) */}
          <section className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-6 shadow-card space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                <Languages className="h-4 w-4" />
                Ví dụ song ngữ chuẩn bối cảnh công sở
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Bôi đen bất kỳ từ tiếng Anh nào để tra nghĩa &amp; lưu SRS
              </span>
            </div>

            <div className="space-y-3">
              {topic.bilingualExamples.map((ex, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0B1120]/70 p-4 space-y-1.5 select-text"
                >
                  <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
                    {renderFormattedText(ex.en)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 italic">
                    {ex.vi}
                  </p>
                  {ex.noteVi && (
                    <p className="text-[11px] font-semibold text-indigo-700 dark:text-cyan-300 pt-1">
                      💡 {ex.noteVi}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Bottom CTA to Practice Tab */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('practice');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full sm:w-auto min-h-[50px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-7 py-3 text-sm font-extrabold text-white shadow-glow hover:brightness-110 transition active:scale-95"
            >
              Làm bài tập áp dụng ngay ({exercises.length} câu)
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 2: BÀI TẬP THỰC HÀNH (12 CÂU) ================= */}
      {activeTab === 'practice' && (
        <div className="space-y-4">
          {/* Practice Control Bar */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-3.5 shadow-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setGradingMode('instant');
                  handleResetPractice();
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  gradingMode === 'instant'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Chấm ngay từng câu
              </button>
              <button
                type="button"
                onClick={() => {
                  setGradingMode('exam');
                  handleResetPractice();
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  gradingMode === 'exam'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Nộp cả bài ({exercises.length} câu)
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Đã làm: <b className="text-indigo-600 dark:text-sky-300">{answeredCount}/{exercises.length}</b>
              </span>

              {gradingMode === 'exam' && !examSubmitted && (
                <button
                  type="button"
                  disabled={answeredCount === 0}
                  onClick={handleSubmitExam}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 text-xs font-extrabold text-white transition"
                >
                  <Send className="h-3.5 w-3.5" />
                  Nộp bài &amp; Chấm điểm
                </button>
              )}

              {(scoreSummary.graded > 0 || examSubmitted) && (
                <button
                  type="button"
                  onClick={handleResetPractice}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Làm lại
                </button>
              )}
            </div>
          </div>

          {/* Completion Summary Banner */}
          {scoreSummary.allGraded && (
            <div className="rounded-2xl sm:rounded-3xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-gradient-to-r dark:from-emerald-950/50 dark:via-[#111827] dark:to-indigo-950/40 p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Kết quả chuyên đề #{String(topic.order).padStart(2, '0')}
                </p>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  Đúng {scoreSummary.correct}/{scoreSummary.total} câu (
                  {Math.round((scoreSummary.correct / Math.max(1, scoreSummary.total)) * 100)}%)
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {scoreSummary.correct / Math.max(1, scoreSummary.total) >= 0.75
                    ? 'Xuất sắc! Chuyên đề đã được đánh dấu Hoàn thành và đồng bộ Cloud.'
                    : 'Đạt từ 75% trở lên (9/12 câu) để đánh dấu Hoàn thành chuyên đề này.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetPractice}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Làm lại
                </button>
                {nextTopic && (
                  <button
                    type="button"
                    onClick={() => navigate(`/grammar/${encodeURIComponent(nextTopic.id)}?tab=theory`)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:brightness-110"
                  >
                    Chuyên đề tiếp: {nextTopic.title}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Exercise List */}
          <div className="space-y-4">
            {exercises.map((ex, idx) => {
              const userVal = answers[ex.id] || '';
              const isRevealed = gradingMode === 'exam' ? examSubmitted : Boolean(checkedMap[ex.id]);
              const correct = isRevealed && isExerciseCorrect(ex, userVal);

              const typeBadge =
                ex.type === 'mcq'
                  ? { label: 'Trắc nghiệm Part 5', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' }
                  : ex.type === 'fill-blank'
                  ? { label: 'Điền dạng đúng của từ', cls: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300' }
                  : { label: 'Tìm & sửa lỗi sai', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' };

              return (
                <div
                  key={ex.id}
                  className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-card space-y-3.5"
                >
                  {/* Question Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-extrabold text-slate-800 dark:text-slate-100">
                        Câu {idx + 1}/{exercises.length}
                      </span>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${typeBadge.cls}`}>
                        {typeBadge.label}
                      </span>
                    </div>

                    {isRevealed && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                          correct
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                        }`}
                      >
                        {correct ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Chính xác
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5" />
                            Chưa đúng
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Prompt */}
                  <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed select-text">
                    {renderPromptText(ex)}
                  </p>

                  {/* Input / Options Area */}
                  {ex.type === 'fill-blank' ? (
                    <div className="space-y-2.5">
                      {ex.baseWord && (
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Gợi ý từ gốc:{' '}
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono font-bold text-indigo-700 dark:text-sky-300">
                            ({ex.baseWord})
                          </span>
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          disabled={isRevealed}
                          value={userVal}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [ex.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && gradingMode === 'instant' && !isRevealed) {
                              e.preventDefault();
                              handleCheckFillBlank(ex);
                            }
                          }}
                          placeholder="Gõ dạng đúng của từ / động từ..."
                          className={`flex-1 rounded-xl border-2 px-3.5 py-2.5 text-base sm:text-sm font-bold transition focus:outline-none ${
                            isRevealed
                              ? correct
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100'
                                : 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100'
                              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white focus:border-indigo-500'
                          }`}
                        />

                        {gradingMode === 'instant' && !isRevealed && (
                          <button
                            type="button"
                            disabled={!userVal.trim()}
                            onClick={() => handleCheckFillBlank(ex)}
                            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 px-4 py-2 text-xs font-extrabold text-white transition active:scale-95"
                          >
                            <Check className="h-4 w-4 stroke-[3]" />
                            Kiểm tra
                          </button>
                        )}
                      </div>

                      {isRevealed && !correct && (
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          Đáp án đúng:{' '}
                          <span className="rounded bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 font-mono">
                            {ex.correctAnswer}
                          </span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(ex.options || []).map((opt) => {
                        const selected = userVal === opt.key;
                        const isRightOpt = opt.key === ex.correctAnswer;
                        let cls =
                          'border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 hover:border-indigo-400';
                        if (isRevealed) {
                          if (isRightOpt) {
                            cls =
                              'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100';
                          } else if (selected) {
                            cls =
                              'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100';
                          } else {
                            cls =
                              'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/35 text-slate-400';
                          }
                        } else if (selected) {
                          cls =
                            'border-indigo-500 bg-indigo-50 text-indigo-950 dark:bg-indigo-500/20 dark:text-white ring-2 ring-indigo-500/25';
                        }

                        return (
                          <button
                            key={opt.key}
                            type="button"
                            disabled={isRevealed}
                            onClick={() => handleSelectOption(ex, opt.key)}
                            className={`min-h-[46px] flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition active:scale-[0.98] ${cls}`}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-extrabold">
                              {opt.key}
                            </span>
                            <span className="leading-snug">{opt.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 3-Layer Explanation Box */}
                  {isRevealed && (
                    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-[#0B1120]/85 p-3.5 sm:p-4 space-y-2 text-xs sm:text-sm">
                      {ex.type === 'error-correction' && ex.correctionText && (
                        <p className="font-extrabold text-emerald-700 dark:text-emerald-300">
                          ✓ Sửa lỗi sai [{ex.correctAnswer}] thành:{' '}
                          <span className="rounded bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 font-mono">
                            {ex.correctionText}
                          </span>
                        </p>
                      )}
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          <b className="text-indigo-800 dark:text-sky-300">1. Dấu hiệu nhận biết: </b>
                          {ex.explanation.signalVi}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          <b className="text-emerald-800 dark:text-emerald-300">2. Công thức &amp; Loại trừ: </b>
                          {ex.explanation.formulaAndEliminationVi}
                        </p>
                      </div>
                      <div className="flex items-start gap-2 pt-1 border-t border-indigo-200/70 dark:border-slate-800">
                        <Languages className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
                        <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed">
                          <b className="not-italic text-slate-700 dark:text-slate-300">3. Dịch nghĩa: </b>
                          {ex.explanation.translationVi}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Exam Submit CTA */}
          {gradingMode === 'exam' && !examSubmitted && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={answeredCount === 0}
                onClick={handleSubmitExam}
                className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-40 px-8 py-3 text-sm font-extrabold text-white shadow-glow hover:brightness-110 transition active:scale-95"
              >
                <Send className="h-4 w-4" />
                Nộp bài &amp; Xem giải thích 3 lớp ({answeredCount}/{exercises.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
