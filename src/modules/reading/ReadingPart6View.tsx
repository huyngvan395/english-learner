import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Eraser,
  Filter,
  HelpCircle,
  Highlighter,
  Languages,
  Loader2,
  RotateCcw,
  Send,
} from 'lucide-react';
import { OptionKey, ReadingMeta, ReadingPart6Passage } from '../../types';
import { useApp } from '../../context/AppContext';
import { loadPart6All } from '../../utils/readingLoader';
import { playCorrect, playSuccess, playWrong } from '../../lib/soundEffects';
import { PART6_STRATEGY_CHEAT_SHEET } from '../../data/readingCheatSheets';
import { ReadingCheatSheetBox } from './ReadingCheatSheetBox';
import { ReadingExplanationCard } from './ReadingExplanationCard';

interface ReadingPart6ViewProps {
  mode: 'practice' | 'exam';
  meta?: ReadingMeta | null;
}

type Part6GenreFilter = 'all' | 'Email' | 'Memo/Notice' | 'Quảng cáo' | 'Bài báo';

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];
const GENRE_FILTERS: { key: Part6GenreFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả thể loại' },
  { key: 'Email', label: 'Email' },
  { key: 'Memo/Notice', label: 'Memo / Notice' },
  { key: 'Quảng cáo', label: 'Quảng cáo' },
  { key: 'Bài báo', label: 'Bài báo' },
];

function matchesPart6Genre(genre: ReadingPart6Passage['genre'], filter: Part6GenreFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'Email') return genre === 'Email';
  if (filter === 'Memo/Notice') return genre === 'Memo' || genre === 'Notice';
  if (filter === 'Quảng cáo') return genre === 'Advertisement';
  if (filter === 'Bài báo') return genre === 'Article';
  return true;
}

export const ReadingPart6View: React.FC<ReadingPart6ViewProps> = ({ mode, meta }) => {
  const {
    recordAttempt,
    readingHighlights,
    toggleReadingHighlight,
    clearReadingHighlights,
    readingProgress,
    recordReadingResult,
  } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const [passages, setPassages] = useState<ReadingPart6Passage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [genreFilter, setGenreFilter] = useState<Part6GenreFilter>('all');
  const [selectedPassageId, setSelectedPassageIdState] = useState<string>(
    () => searchParams.get('item') || ''
  );

  const setSelectedPassageId = (id: string) => {
    setSelectedPassageIdState(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('item', id);
        else next.delete('item');
        return next;
      },
      { replace: true }
    );
  };
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'passage' | 'questions'>('passage');
  const [timeLeft, setTimeLeft] = useState(8 * 60);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    loadPart6All(meta || undefined)
      .then((data) => {
        if (mounted) {
          setPassages(data);
          if (data.length > 0) {
            const fromUrl = searchParams.get('item');
            const initial = fromUrl && data.some((p) => p.id === fromUrl) ? fromUrl : data[0].id;
            setSelectedPassageIdState((prev) => (prev && data.some((p) => p.id === prev) ? prev : initial));
          }
        }
      })
      .catch((err) => {
        if (mounted) setLoadError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu Part 6');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [meta]);

  const filteredPassages = useMemo(
    () => passages.filter((p) => matchesPart6Genre(p.genre, genreFilter)),
    [passages, genreFilter]
  );

  const passage = useMemo(() => {
    return filteredPassages.find((p) => p.id === selectedPassageId) || filteredPassages[0] || null;
  }, [filteredPassages, selectedPassageId]);

  const userMarks = passage ? readingHighlights[passage.id] || [] : [];

  useEffect(() => {
    setAnswers({});
    setRevealedIds({});
    setExamSubmitted(false);
    setActiveEvidenceId(null);
    setTimeLeft(8 * 60);
  }, [passage?.id, mode]);

  useEffect(() => {
    if (mode !== 'exam' || examSubmitted || !passage) return;
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
  }, [mode, examSubmitted, answers, passage]);

  const handleLocateEvidence = (_pIdx: number, sentenceId: string) => {
    setMobileTab('passage');
    setActiveEvidenceId(null);
    window.setTimeout(() => {
      setActiveEvidenceId(sentenceId);
      const el = document.getElementById(`ev-${sentenceId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleCheckPractice = (qId: string) => {
    if (!passage) return;
    const q = passage.questions.find((x) => x.id === qId);
    if (!q || !answers[qId]) return;
    const ok = answers[qId] === q.correctAnswer;
    if (ok) playCorrect();
    else playWrong();
    setRevealedIds((prev) => ({ ...prev, [qId]: true }));
    recordReadingResult(q.id, answers[qId], ok);
    recordAttempt({
      module: 'reading',
      partLabel: 'Part 6',
      correctCount: ok ? 1 : 0,
      totalCount: 1,
      topics: [{ topic: `Part 6 — ${q.questionType}`, correct: ok }],
    });
  };

  const handleExamSubmit = () => {
    if (examSubmitted || !passage) return;
    playSuccess();
    setExamSubmitted(true);
    let correct = 0;
    for (const q of passage.questions) {
      const chosen = answers[q.id];
      const ok = chosen === q.correctAnswer;
      if (ok) correct += 1;
      if (chosen) recordReadingResult(q.id, chosen, ok);
    }
    recordAttempt({
      module: 'reading',
      partLabel: 'Part 6',
      correctCount: correct,
      totalCount: passage.questions.length,
      topics: passage.questions.map((q) => ({
        topic: `Part 6 — ${q.questionType}`,
        correct: answers[q.id] === q.correctAnswer,
      })),
    });
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 flex items-center justify-center gap-3 text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        Đang tải kho đoạn văn Part 6...
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
      {/* Collapsible Strategy Cheat Sheet */}
      <ReadingCheatSheetBox sheet={PART6_STRATEGY_CHEAT_SHEET} defaultOpen={false} />

      {/* Genre Filter + Passage Selector with Progress Badges */}
      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-3.5 sm:p-4 space-y-3.5 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5">
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 mr-1">
              <Filter className="h-3.5 w-3.5 text-indigo-400" />
              Thể loại:
            </span>
            {GENRE_FILTERS.map((gf) => {
              const cnt = passages.filter((p) => matchesPart6Genre(p.genre, gf.key)).length;
              return (
                <button
                  key={gf.key}
                  type="button"
                  onClick={() => setGenreFilter(gf.key)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 sm:py-1 text-xs font-bold transition ${
                    genreFilter === gf.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{gf.label}</span>
                  <span className="text-[10px] opacity-80">({cnt})</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                showTranslation
                  ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              {showTranslation ? 'Đang bật dịch song ngữ' : 'Dịch song ngữ'}
            </button>

            <button
              type="button"
              onClick={() => setHighlightMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                highlightMode
                  ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Highlighter className="h-3.5 w-3.5" />
              {highlightMode ? 'Đang bôi vàng (bấm câu)' : 'Bôi vàng'}
            </button>

            {passage && userMarks.length > 0 && (
              <button
                type="button"
                onClick={() => clearReadingHighlights(passage.id)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-300"
                title="Xóa toàn bộ highlight"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
            )}

            {mode === 'exam' && passage && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-mono font-bold text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(timeLeft)}
                </span>
                {!examSubmitted ? (
                  <button
                    type="button"
                    onClick={handleExamSubmit}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Nộp bài
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAnswers({});
                      setExamSubmitted(false);
                      setTimeLeft(8 * 60);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Làm lại
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Passage Selector Pills with Progress */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap gap-2 sm:max-h-36 sm:overflow-y-auto pt-2 border-t border-slate-800/80">
          {filteredPassages.map((p, idx) => {
            const totalQ = p.questions.length;
            const doneQ = p.questions.filter((q) => Boolean(readingProgress[q.id])).length;
            const rightQ = p.questions.filter((q) => readingProgress[q.id]?.status === 'correct').length;
            const isSelected = passage?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPassageId(p.id)}
                className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  isSelected
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
              >
                <span>
                  Bài {idx + 1}: {p.genre}
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                    doneQ === totalQ
                      ? 'bg-emerald-500/25 text-emerald-200'
                      : doneQ > 0
                      ? 'bg-amber-500/25 text-amber-200'
                      : 'bg-black/25 text-slate-400'
                  }`}
                >
                  {doneQ === totalQ ? `✓ ${rightQ}/${totalQ}` : `${doneQ}/${totalQ}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!passage ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-10 text-center text-sm text-slate-400">
          Chưa có đoạn văn nào thuộc thể loại này.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sticky Mobile Tab Switcher (< xl) */}
          <div className="xl:hidden sticky top-14 md:top-16 z-20 rounded-2xl border border-slate-700/80 bg-[#0F172A]/95 backdrop-blur-md p-1.5 shadow-lg grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setMobileTab('passage')}
              className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                mobileTab === 'passage'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Bài đọc
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('questions')}
              className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                mobileTab === 'questions'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              Câu hỏi ({passage.questions.length})
            </button>
          </div>

          {/* Split-Screen Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Left: Passage */}
            <div
              className={`${
                mobileTab === 'passage' ? 'block' : 'hidden xl:block'
              } xl:col-span-6 xl:sticky xl:top-20 rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 sm:p-6 shadow-card xl:max-h-[82vh] xl:overflow-y-auto space-y-4`}
            >
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/70 pb-3">
              <div>
                <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-300 uppercase">
                  {passage.genre}
                </span>
                <h3 className="mt-1.5 text-lg font-extrabold text-white">{passage.title}</h3>
              </div>
            </div>

            {passage.headerMeta && (
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 text-xs space-y-1">
                {passage.headerMeta.from && (
                  <p><span className="font-bold text-slate-400">From:</span> <span className="text-slate-200">{passage.headerMeta.from}</span></p>
                )}
                {passage.headerMeta.to && (
                  <p><span className="font-bold text-slate-400">To:</span> <span className="text-slate-200">{passage.headerMeta.to}</span></p>
                )}
                {passage.headerMeta.date && (
                  <p><span className="font-bold text-slate-400">Date:</span> <span className="text-slate-200">{passage.headerMeta.date}</span></p>
                )}
                {passage.headerMeta.subject && (
                  <p><span className="font-bold text-slate-400">Subject:</span> <span className="font-semibold text-white">{passage.headerMeta.subject}</span></p>
                )}
              </div>
            )}

            {highlightMode && (
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
                Chế độ bôi vàng đang bật: Bấm trực tiếp vào bất kỳ câu nào bên dưới để đánh dấu từ khóa!
              </p>
            )}

            <div className="space-y-4 text-sm sm:text-[15px] leading-relaxed text-slate-200">
              {passage.paragraphs.map((para) => (
                <div key={para.id} className="space-y-1.5">
                  <p>
                    {para.sentences.map((s) => {
                      const isEv = activeEvidenceId === s.id;
                      const isUserMarked = userMarks.includes(s.id);
                      return (
                        <span
                          key={s.id}
                          id={`ev-${s.id}`}
                          onClick={() => highlightMode && toggleReadingHighlight(passage.id, s.id)}
                          className={`transition ${
                            highlightMode ? 'cursor-pointer hover:bg-amber-400/20 rounded' : ''
                          } ${isEv ? 'evidence-highlight-active' : isUserMarked ? 'user-highlight-mark' : ''}`}
                        >
                          {s.en}{' '}
                        </span>
                      );
                    })}
                  </p>
                  {showTranslation && (
                    <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/25 px-3.5 py-2.5 text-xs sm:text-sm text-cyan-100/90 leading-relaxed">
                      {para.sentences.map((s) => s.vi).join(' ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Questions */}
          <div
            className={`${
              mobileTab === 'questions' ? 'block' : 'hidden xl:block'
            } xl:col-span-6 space-y-4`}
          >
            {passage.questions.map((q) => {
              const userChoice = answers[q.id];
              const isRevealed = mode === 'practice' ? Boolean(revealedIds[q.id]) : examSubmitted;

              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-slate-700/75 bg-[#1E293B] p-4 sm:p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
                      Chỗ trống [{q.blankNumber}]
                    </span>
                    <span
                      className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${
                        q.questionType.includes('Điền câu')
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-slate-900 text-slate-300'
                      }`}
                    >
                      {q.questionType}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {OPTION_KEYS.map((k) => {
                      const selected = userChoice === k;
                      const right = k === q.correctAnswer;
                      let cls =
                        'border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-indigo-500/60';
                      if (isRevealed) {
                        if (right) cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
                        else if (selected) cls = 'border-rose-500 bg-rose-500/15 text-rose-100';
                        else cls = 'border-slate-800 bg-slate-900/40 text-slate-500';
                      } else if (selected) {
                        cls = 'border-indigo-400 bg-indigo-500/20 text-white ring-2 ring-indigo-500/30';
                      }

                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            if (isRevealed) return;
                            setAnswers((prev) => ({ ...prev, [q.id]: k }));
                          }}
                          className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${cls}`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-bold mt-0.5">
                            {k}
                          </span>
                          <span className="leading-snug">{q.options[k]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {mode === 'practice' && !isRevealed && (
                    <div className="mt-3.5 flex justify-end">
                      <button
                        type="button"
                        disabled={!userChoice}
                        onClick={() => handleCheckPractice(q.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 px-4 py-2 text-xs font-bold text-white"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Kiểm tra &amp; Xem giải thích
                      </button>
                    </div>
                  )}

                  {isRevealed && (
                    <ReadingExplanationCard
                      questionId={q.id}
                      questionLabel={`Reading Part 6 — Câu [${q.blankNumber}] (${q.questionType})`}
                      correctAnswer={q.correctAnswer}
                      userAnswer={userChoice}
                      explanation={q.explanation}
                      onLocateEvidence={handleLocateEvidence}
                    />
                  )}
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
