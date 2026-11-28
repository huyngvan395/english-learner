import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { OptionKey, ReadingMeta, ReadingPart5Question } from '../../types';
import { useApp } from '../../context/AppContext';
import { loadPart5All } from '../../utils/readingLoader';
import { findPart5CheatSheet } from '../../data/readingCheatSheets';
import { ReadingCheatSheetBox } from './ReadingCheatSheetBox';
import { ReadingExplanationCard } from './ReadingExplanationCard';

interface ReadingPart5ViewProps {
  mode: 'practice' | 'exam';
  meta?: ReadingMeta | null;
}

type DifficultyFilter = 'all' | 'Cơ bản' | 'Trung bình' | 'Nâng cao 800+';
type StatusFilter = 'all' | 'unanswered' | 'wrong';

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];
const PAGE_SIZE = 10;

function matchesDifficulty(qDiff: string, filter: DifficultyFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'Nâng cao 800+') return qDiff.includes('Nâng cao');
  return qDiff === filter;
}

export const ReadingPart5View: React.FC<ReadingPart5ViewProps> = ({ mode, meta }) => {
  const { recordAttempt, readingProgress, recordReadingResult } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [questions, setQuestions] = useState<ReadingPart5Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTopic, setSelectedTopicState] = useState<string>(
    () => searchParams.get('topic') || 'Tất cả'
  );
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const p = Number(searchParams.get('page') || '1');
    return Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1;
  });

  const setSelectedTopic = (nextTopic: string) => {
    setSelectedTopicState(nextTopic);
    setCurrentPage(1);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextTopic === 'Tất cả') next.delete('topic');
        else next.set('topic', nextTopic);
        next.delete('page');
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    const desired = currentPage <= 1 ? null : String(currentPage);
    if (searchParams.get('page') !== desired) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!desired) next.delete('page');
          else next.set('page', desired);
          return next;
        },
        { replace: true }
      );
    }
  }, [currentPage]);

  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(12 * 60);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    loadPart5All(meta || undefined)
      .then((data) => {
        if (mounted) setQuestions(data);
      })
      .catch((err) => {
        if (mounted) setLoadError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu Part 5');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [meta]);

  const topicStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) {
      counts.set(q.topic, (counts.get(q.topic) || 0) + 1);
    }
    return [
      { topic: 'Tất cả', count: questions.length },
      ...Array.from(counts.entries()).map(([topic, count]) => ({ topic, count })),
    ];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (selectedTopic !== 'Tất cả' && q.topic !== selectedTopic) return false;
      if (!matchesDifficulty(q.difficulty, difficultyFilter)) return false;
      const prog = readingProgress[q.id];
      if (statusFilter === 'unanswered' && prog) return false;
      if (statusFilter === 'wrong' && prog?.status !== 'wrong') return false;
      return true;
    });
  }, [questions, selectedTopic, difficultyFilter, statusFilter, readingProgress]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pageQuestions = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, safePage]);

  const activeCheatSheet = useMemo(
    () => findPart5CheatSheet(selectedTopic),
    [selectedTopic]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [difficultyFilter, statusFilter]);

  useEffect(() => {
    setAnswers({});
    setRevealedIds({});
    setExamSubmitted(false);
    setTimeLeft(Math.max(5, Math.ceil(filteredQuestions.length * 0.4)) * 60);
  }, [mode, selectedTopic, difficultyFilter, statusFilter]);

  useEffect(() => {
    if (mode !== 'exam' || examSubmitted || filteredQuestions.length === 0) return;
    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleExamSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [mode, examSubmitted, answers, filteredQuestions]);

  const handleChoose = (qId: string, opt: OptionKey) => {
    if (mode === 'exam' && examSubmitted) return;
    if (mode === 'practice' && revealedIds[qId]) return;
    setAnswers((prev) => ({ ...prev, [qId]: opt }));
  };

  const handleCheckPractice = (qId: string) => {
    const q = questions.find((item) => item.id === qId);
    if (!q || !answers[qId]) return;
    const isCorrect = answers[qId] === q.correctAnswer;
    setRevealedIds((prev) => ({ ...prev, [qId]: true }));
    recordReadingResult(q.id, answers[qId], isCorrect);
    recordAttempt({
      module: 'reading',
      partLabel: 'Part 5',
      correctCount: isCorrect ? 1 : 0,
      totalCount: 1,
      topics: [{ topic: q.topic, correct: isCorrect }],
    });
  };

  const handleExamSubmit = () => {
    if (examSubmitted || filteredQuestions.length === 0) return;
    setExamSubmitted(true);
    let correct = 0;
    const topicLog: { topic: string; correct: boolean }[] = [];
    for (const q of filteredQuestions) {
      const chosen = answers[q.id];
      const ok = chosen === q.correctAnswer;
      if (ok) correct += 1;
      if (chosen) {
        recordReadingResult(q.id, chosen, ok);
      }
      topicLog.push({ topic: q.topic, correct: ok });
    }
    recordAttempt({
      module: 'reading',
      partLabel: 'Part 5',
      correctCount: correct,
      totalCount: filteredQuestions.length,
      topics: topicLog,
    });
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const examScore = useMemo(() => {
    return filteredQuestions.filter((q) => answers[q.id] === q.correctAnswer).length;
  }, [filteredQuestions, answers]);

  const jumpToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  const renderPaginationBar = () => {
    if (filteredQuestions.length <= PAGE_SIZE) return null;
    const startNum = (safePage - 1) * PAGE_SIZE + 1;
    const endNum = Math.min(filteredQuestions.length, safePage * PAGE_SIZE);
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#111827] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-400">
          Hiển thị câu <b className="text-white">{startNum}–{endNum}</b> / <b className="text-sky-300">{filteredQuestions.length}</b> câu (10 câu/trang)
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => jumpToPage(safePage - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Trước
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => jumpToPage(p)}
              className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-extrabold transition ${
                p === safePage
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => jumpToPage(safePage + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            Sau
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 flex items-center justify-center gap-3 text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        Đang tải kho câu hỏi Part 5...
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

  const unansweredCount = questions.filter((q) => !readingProgress[q.id]).length;
  const wrongCount = questions.filter((q) => readingProgress[q.id]?.status === 'wrong').length;

  return (
    <div className="space-y-5">
      {/* Multi-Filter Toolbar: Topic + Difficulty + Status + Exam Controls */}
      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 space-y-3.5">
        {/* Row 1: Topic Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              <Filter className="h-3.5 w-3.5 text-indigo-400" />
              Chọn chuyên đề ngữ pháp / từ vựng (bấm vào chuyên đề để mở Công thức bản chất 5 giây)
            </span>
            {mode === 'exam' && (
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-mono font-bold text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(timeLeft)}
                </div>
                {!examSubmitted ? (
                  <button
                    type="button"
                    onClick={handleExamSubmit}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:from-emerald-500 hover:to-teal-500 transition"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Nộp bài ({Object.keys(answers).length}/{filteredQuestions.length})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAnswers({});
                      setExamSubmitted(false);
                      setTimeLeft(Math.max(5, Math.ceil(filteredQuestions.length * 0.4)) * 60);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Làm lại
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap gap-1.5 pb-0.5 sm:pb-0">
            {topicStats.map(({ topic, count }) => (
              <button
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  selectedTopic === topic
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/85 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50'
                }`}
              >
                <span>{topic}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${selectedTopic === topic ? 'bg-black/25' : 'bg-slate-950/70 text-sky-300'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Difficulty & Status Filters */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3 border-t border-slate-800/90 pt-3">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5">
            <span className="shrink-0 text-[11px] font-bold text-slate-400 mr-1">Độ khó:</span>
            {(['all', 'Cơ bản', 'Trung bình', 'Nâng cao 800+'] as DifficultyFilter[]).map((df) => (
              <button
                key={df}
                type="button"
                onClick={() => setDifficultyFilter(df)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 sm:py-1 text-xs font-bold transition ${
                  difficultyFilter === df
                    ? 'bg-amber-500/20 border border-amber-400/50 text-amber-200'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {df === 'all' ? 'Tất cả độ khó' : df}
              </button>
            ))}
          </div>

          <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5">
            <span className="shrink-0 text-[11px] font-bold text-slate-400 mr-1">Trạng thái:</span>
            {(
              [
                { key: 'all', label: `Tất cả (${questions.length})` },
                { key: 'unanswered', label: `Chưa làm (${unansweredCount})` },
                { key: 'wrong', label: `Làm sai (${wrongCount})` },
              ] as { key: StatusFilter; label: string }[]
            ).map((sf) => (
              <button
                key={sf.key}
                type="button"
                onClick={() => setStatusFilter(sf.key)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 sm:py-1 text-xs font-bold transition ${
                  statusFilter === sf.key
                    ? sf.key === 'wrong'
                      ? 'bg-rose-500/20 border border-rose-400/50 text-rose-200'
                      : 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Collapsible Topic Cheat Sheet (appears whenever user picks a specific topic) */}
      {activeCheatSheet && (
        <ReadingCheatSheetBox key={activeCheatSheet.id} sheet={activeCheatSheet} defaultOpen={true} />
      )}

      {/* Exam Navigator & Score Summary */}
      {mode === 'exam' && filteredQuestions.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Bảng điều hướng câu hỏi Part 5 ({filteredQuestions.length} câu)
            </span>
            {examSubmitted && (
              <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-extrabold text-emerald-300">
                Kết quả: {examScore}/{filteredQuestions.length} câu đúng (
                {Math.round((examScore / Math.max(1, filteredQuestions.length)) * 100)}%)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filteredQuestions.map((q, i) => {
              const answered = Boolean(answers[q.id]);
              const ok = answers[q.id] === q.correctAnswer;
              const targetPage = Math.floor(i / PAGE_SIZE) + 1;
              let cls = 'border-slate-700 bg-slate-900 text-slate-400';
              if (examSubmitted) {
                cls = ok
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                  : 'border-rose-500 bg-rose-500/20 text-rose-200';
              } else if (answered) {
                cls = 'border-indigo-500 bg-indigo-500/25 text-white';
              }
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setCurrentPage(targetPage);
                    window.setTimeout(() => {
                      document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition ${cls}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {renderPaginationBar()}

      {/* Empty Filter State */}
      {pageQuestions.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-10 text-center space-y-3">
          <p className="text-base font-bold text-white">Không có câu hỏi nào khớp với bộ lọc hiện tại</p>
          <p className="text-xs text-slate-400">
            Thử đặt lại bộ lọc độ khó hoặc trạng thái để xem toàn bộ câu hỏi trong chuyên đề này.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedTopic('Tất cả');
              setDifficultyFilter('all');
              setStatusFilter('all');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {pageQuestions.map((q, localIdx) => {
            const globalIdx = (safePage - 1) * PAGE_SIZE + localIdx;
            const userChoice = answers[q.id];
            const isRevealed = mode === 'practice' ? Boolean(revealedIds[q.id]) : examSubmitted;
            const savedProg = readingProgress[q.id];

            return (
              <div
                key={q.id}
                id={`q-${q.id}`}
                className="rounded-2xl border border-slate-700/75 bg-[#1E293B] p-4 sm:p-6 shadow-card scroll-mt-20"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
                      Câu {globalIdx + 101}
                    </span>
                    <span className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300">
                      {q.topic}
                    </span>
                    {savedProg && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          savedProg.status === 'correct'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {savedProg.status === 'correct' ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Đã làm đúng
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" /> Từng làm sai
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      q.difficulty === 'Cơ bản'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : q.difficulty === 'Trung bình'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {q.difficulty === 'Nâng cao' ? 'Nâng cao 800+' : q.difficulty}
                  </span>
                </div>

                <p className="text-base sm:text-lg font-semibold text-white leading-relaxed">
                  {q.sentence}
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {OPTION_KEYS.map((k) => {
                    const selected = userChoice === k;
                    const right = k === q.correctAnswer;
                    let cls =
                      'border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-indigo-500/60 hover:bg-slate-800/80';
                    if (isRevealed) {
                      if (right) {
                        cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
                      } else if (selected) {
                        cls = 'border-rose-500 bg-rose-500/15 text-rose-100';
                      } else {
                        cls = 'border-slate-800 bg-slate-900/40 text-slate-500';
                      }
                    } else if (selected) {
                      cls = 'border-indigo-400 bg-indigo-500/20 text-white ring-2 ring-indigo-500/30';
                    }

                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleChoose(q.id, k)}
                        className={`min-h-[46px] flex items-center gap-3 rounded-xl border px-3.5 sm:px-4 py-3 text-left text-sm font-medium transition ${cls}`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold">
                          {k}
                        </span>
                        <span>{q.options[k]}</span>
                      </button>
                    );
                  })}
                </div>

                {mode === 'practice' && !isRevealed && (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={!userChoice}
                      onClick={() => handleCheckPractice(q.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:from-blue-500 hover:to-indigo-500 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Nộp câu &amp; Xem giải thích 5 bước
                    </button>
                  </div>
                )}

                {isRevealed && (
                  <ReadingExplanationCard
                    questionId={q.id}
                    questionLabel={`Reading Part 5 — Câu ${globalIdx + 101} (${q.topic})`}
                    correctAnswer={q.correctAnswer}
                    userAnswer={userChoice}
                    explanation={q.explanation}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {renderPaginationBar()}
    </div>
  );
};
