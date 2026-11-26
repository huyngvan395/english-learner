import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eraser,
  Filter,
  Highlighter,
  Languages,
  Layers,
  Loader2,
  RotateCcw,
  Send,
} from 'lucide-react';
import { OptionKey, ReadingMeta, ReadingPart7Set } from '../../types';
import { useApp } from '../../context/AppContext';
import { loadPart7ByType } from '../../utils/readingLoader';
import { PART7_STRATEGY_CHEAT_SHEET } from '../../data/readingCheatSheets';
import { ReadingCheatSheetBox } from './ReadingCheatSheetBox';
import { ReadingExplanationCard } from './ReadingExplanationCard';

interface ReadingPart7ViewProps {
  mode: 'practice' | 'exam';
  meta?: ReadingMeta | null;
}

type PassageCountFilter = 'all' | 'single' | 'double' | 'triple';
type Part7GenreFilter =
  | 'all'
  | 'Email'
  | 'Memo/Notice'
  | 'Quảng cáo'
  | 'Bài báo'
  | 'Tin nhắn Chat'
  | 'Biểu mẫu/Hóa đơn';

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

const COUNT_FILTERS: { key: PassageCountFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả số đoạn' },
  { key: 'single', label: 'Đoạn đơn (Single)' },
  { key: 'double', label: 'Đoạn kép (Double)' },
  { key: 'triple', label: 'Đoạn ba (Triple)' },
];

const GENRE_FILTERS: { key: Part7GenreFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả thể loại' },
  { key: 'Email', label: 'Email' },
  { key: 'Memo/Notice', label: 'Memo / Notice' },
  { key: 'Quảng cáo', label: 'Quảng cáo / Tuyển dụng' },
  { key: 'Bài báo', label: 'Bài báo' },
  { key: 'Tin nhắn Chat', label: 'Tin nhắn Chat' },
  { key: 'Biểu mẫu/Hóa đơn', label: 'Biểu mẫu / Hóa đơn / Lịch' },
];

function matchesPart7Genre(set: ReadingPart7Set, filter: Part7GenreFilter): boolean {
  if (filter === 'all') return true;
  const genres = set.passages.map((p) => p.genre);
  if (filter === 'Email') return genres.includes('Email') || genres.includes('Letter');
  if (filter === 'Memo/Notice') return genres.includes('Notice') || genres.includes('Memo');
  if (filter === 'Quảng cáo')
    return genres.includes('Job Posting') || genres.includes('Advertisement') || genres.includes('Web Page');
  if (filter === 'Bài báo') return genres.includes('Article');
  if (filter === 'Tin nhắn Chat') return genres.includes('Text Message Chain');
  if (filter === 'Biểu mẫu/Hóa đơn') return genres.includes('Invoice / Form') || genres.includes('Schedule');
  return true;
}

export const ReadingPart7View: React.FC<ReadingPart7ViewProps> = ({ mode, meta }) => {
  const {
    recordAttempt,
    readingHighlights,
    toggleReadingHighlight,
    clearReadingHighlights,
    readingProgress,
    recordReadingResult,
  } = useApp();

  const [countFilter, setCountFilter] = useState<PassageCountFilter>('all');
  const [genreFilter, setGenreFilter] = useState<Part7GenreFilter>('all');
  const [sets, setSets] = useState<ReadingPart7Set[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(12 * 60);

  // Lazy-load only the requested passageCountType file(s) from public/data/reading/
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    loadPart7ByType(countFilter, meta || undefined)
      .then((data) => {
        if (mounted) {
          setSets(data);
          if (data.length > 0) {
            setSelectedSetId((prev) => (data.some((s) => s.id === prev) ? prev : data[0].id));
          }
        }
      })
      .catch((err) => {
        if (mounted) setLoadError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu Part 7');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [countFilter, meta]);

  const filteredSets = useMemo(
    () => sets.filter((s) => matchesPart7Genre(s, genreFilter)),
    [sets, genreFilter]
  );

  const currentSet = useMemo(() => {
    return filteredSets.find((s) => s.id === selectedSetId) || filteredSets[0] || null;
  }, [filteredSets, selectedSetId]);

  const currentDoc = currentSet ? currentSet.passages[activeDocIdx] || currentSet.passages[0] : null;
  const userMarks = currentDoc ? readingHighlights[currentDoc.id] || [] : [];

  useEffect(() => {
    setActiveDocIdx(0);
    setAnswers({});
    setRevealedIds({});
    setExamSubmitted(false);
    setActiveEvidenceId(null);
    setTimeLeft(12 * 60);
  }, [currentSet?.id, mode]);

  useEffect(() => {
    if (mode !== 'exam' || examSubmitted || !currentSet) return;
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
  }, [mode, examSubmitted, answers, currentSet]);

  const handleLocateEvidence = (passageIndex: number, sentenceId: string) => {
    setActiveDocIdx(passageIndex);
    setActiveEvidenceId(null);
    window.setTimeout(() => {
      setActiveEvidenceId(sentenceId);
      const el = document.getElementById(`ev-${sentenceId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 90);
  };

  const handleCheckPractice = (qId: string) => {
    if (!currentSet) return;
    const q = currentSet.questions.find((x) => x.id === qId);
    if (!q || !answers[qId]) return;
    const ok = answers[qId] === q.correctAnswer;
    setRevealedIds((prev) => ({ ...prev, [qId]: true }));
    recordReadingResult(q.id, answers[qId], ok);
    recordAttempt({
      module: 'reading',
      partLabel: 'Part 7',
      correctCount: ok ? 1 : 0,
      totalCount: 1,
      topics: [{ topic: `Part 7 — ${q.questionType}`, correct: ok }],
    });
  };

  const handleExamSubmit = () => {
    if (examSubmitted || !currentSet) return;
    setExamSubmitted(true);
    let correct = 0;
    for (const q of currentSet.questions) {
      const chosen = answers[q.id];
      const ok = chosen === q.correctAnswer;
      if (ok) correct += 1;
      if (chosen) recordReadingResult(q.id, chosen, ok);
    }
    recordAttempt({
      module: 'reading',
      partLabel: 'Part 7',
      correctCount: correct,
      totalCount: currentSet.questions.length,
      topics: currentSet.questions.map((q) => ({
        topic: `Part 7 — ${q.questionType}`,
        correct: answers[q.id] === q.correctAnswer,
      })),
    });
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      {/* Collapsible Part 7 Strategy Cheat Sheet */}
      <ReadingCheatSheetBox sheet={PART7_STRATEGY_CHEAT_SHEET} defaultOpen={false} />

      {/* Passage Count + Genre Filters + Set Selector */}
      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Passage Count Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 mr-1">
              <Layers className="h-3.5 w-3.5 text-violet-400" />
              Số đoạn:
            </span>
            {COUNT_FILTERS.map((cf) => (
              <button
                key={cf.key}
                type="button"
                onClick={() => setCountFilter(cf.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  countFilter === cf.key
                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cf.label}
              </button>
            ))}
          </div>

          {/* Reading Tools */}
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
              {showTranslation ? 'Đang hiện dịch song ngữ' : 'Dịch song ngữ'}
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
              {highlightMode ? 'Đang bôi vàng' : 'Bôi vàng'}
            </button>

            {currentDoc && userMarks.length > 0 && (
              <button
                type="button"
                onClick={() => clearReadingHighlights(currentDoc.id)}
                className="rounded-xl border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:text-rose-300"
                title="Xóa highlight ở đoạn này"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
            )}

            {mode === 'exam' && currentSet && (
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
                      setTimeLeft(12 * 60);
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

        {/* Genre Filter Row */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 mr-1">
            <Filter className="h-3.5 w-3.5 text-cyan-400" />
            Thể loại văn bản:
          </span>
          {GENRE_FILTERS.map((gf) => {
            const cnt = sets.filter((s) => matchesPart7Genre(s, gf.key)).length;
            return (
              <button
                key={gf.key}
                type="button"
                onClick={() => setGenreFilter(gf.key)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  genreFilter === gf.key
                    ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{gf.label}</span>
                <span className="text-[10px] opacity-80">({cnt})</span>
              </button>
            );
          })}
        </div>

        {/* Set Picker Pills with Progress */}
        {!loading && filteredSets.length > 0 && (
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pt-2 border-t border-slate-800/80">
            {filteredSets.map((s, idx) => {
              const typeBadge =
                s.passageCountType === 'single'
                  ? 'Single'
                  : s.passageCountType === 'double'
                  ? 'Double'
                  : 'Triple';
              const totalQ = s.questions.length;
              const doneQ = s.questions.filter((q) => Boolean(readingProgress[q.id])).length;
              const rightQ = s.questions.filter((q) => readingProgress[q.id]?.status === 'correct').length;
              const isSelected = currentSet?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSetId(s.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                      : 'bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <span>
                    Bài {idx + 1} ({typeBadge}) • {s.passages.map((d) => d.genre).join(' + ')}
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
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 flex items-center justify-center gap-3 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          Đang tải bộ bài đọc Part 7...
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-6 text-sm text-rose-200">
          {loadError}
        </div>
      ) : !currentSet || !currentDoc ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-10 text-center space-y-2">
          <p className="text-base font-bold text-white">Không có bài đọc Part 7 nào khớp bộ lọc</p>
          <button
            type="button"
            onClick={() => {
              setCountFilter('all');
              setGenreFilter('all');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Xem tất cả bài đọc
          </button>
        </div>
      ) : (
        /* Split-Screen Container */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* LEFT PANE: Multi-tab Passages */}
          <div className="xl:col-span-6 xl:sticky xl:top-20 rounded-2xl border border-slate-700/80 bg-[#1E293B] shadow-card overflow-hidden flex flex-col max-h-[82vh]">
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-700/80 bg-slate-900/90 px-4 pt-3 pb-2.5">
              {currentSet.passages.map((doc, idx) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveDocIdx(idx)}
                  className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    activeDocIdx === idx
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {doc.tabLabel}
                </button>
              ))}
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <div>
                <span className="rounded-md bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                  {currentDoc.genre}
                </span>
                <h3 className="mt-1.5 text-lg font-extrabold text-white">{currentDoc.title}</h3>
              </div>

              {currentDoc.headerMeta && (
                <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 text-xs space-y-1">
                  {currentDoc.headerMeta.map((m, i) => (
                    <p key={i}>
                      <span className="font-bold text-slate-400">{m.label}: </span>
                      <span className="text-slate-200">{m.value}</span>
                    </p>
                  ))}
                </div>
              )}

              {highlightMode && (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
                  Bấm trực tiếp vào câu / tin nhắn bất kỳ để bôi vàng đánh dấu từ khóa.
                </p>
              )}

              {/* Text Message Chain UI */}
              {currentDoc.chatMessages && currentDoc.chatMessages.length > 0 && (
                <div className="space-y-3">
                  {currentDoc.chatMessages.map((msg) => {
                    const isEv = activeEvidenceId === msg.id;
                    const isMarked = userMarks.includes(msg.id);
                    return (
                      <div
                        key={msg.id}
                        id={`ev-${msg.id}`}
                        onClick={() => highlightMode && toggleReadingHighlight(currentDoc.id, msg.id)}
                        className={`rounded-2xl border p-3.5 transition ${
                          highlightMode ? 'cursor-pointer hover:border-amber-400/50' : ''
                        } ${
                          isEv
                            ? 'evidence-highlight-active border-amber-400'
                            : isMarked
                            ? 'border-amber-400/60 bg-amber-500/15'
                            : msg.align === 'right'
                            ? 'border-indigo-500/30 bg-indigo-950/40 ml-4'
                            : 'border-slate-700/80 bg-slate-900/80 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-extrabold text-indigo-300">{msg.sender}</span>
                          <span className="font-mono text-slate-400">{msg.time}</span>
                        </div>
                        <p className="text-sm text-slate-100 leading-relaxed">{msg.en}</p>
                        {showTranslation && (
                          <p className="mt-2 pt-2 border-t border-slate-700/60 text-xs text-cyan-200 leading-relaxed">
                            {msg.vi}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Invoice / Table UI */}
              {currentDoc.tableData && (
                <div className="overflow-x-auto rounded-xl border border-slate-700/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-300 uppercase text-[10px]">
                      <tr>
                        {currentDoc.tableData.headers.map((h) => (
                          <th key={h} className="px-3 py-2.5 font-bold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-950/50">
                      {currentDoc.tableData.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-800/40">
                          {row.cells.map((c, ci) => (
                            <td
                              key={ci}
                              className={`px-3 py-2.5 ${ci === 0 ? 'font-mono font-bold text-indigo-300' : 'text-slate-200'}`}
                            >
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {showTranslation && (
                    <div className="border-t border-slate-800 bg-cyan-950/30 p-3 space-y-1 text-xs text-cyan-200">
                      {currentDoc.tableData.rows.map(
                        (r) => r.viNote && <p key={r.id}>• {r.viNote}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Standard Bilingual Paragraphs */}
              {currentDoc.paragraphs.length > 0 && (
                <div className="space-y-4 text-sm sm:text-[15px] leading-relaxed text-slate-200">
                  {currentDoc.paragraphs.map((para) => (
                    <div key={para.id} className="space-y-1.5">
                      <p>
                        {para.sentences.map((s) => {
                          const isEv = activeEvidenceId === s.id;
                          const isMarked = userMarks.includes(s.id);
                          return (
                            <span
                              key={s.id}
                              id={`ev-${s.id}`}
                              onClick={() => highlightMode && toggleReadingHighlight(currentDoc.id, s.id)}
                              className={`transition ${
                                highlightMode ? 'cursor-pointer hover:bg-amber-400/20 rounded' : ''
                              } ${isEv ? 'evidence-highlight-active' : isMarked ? 'user-highlight-mark' : ''}`}
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
              )}
            </div>
          </div>

          {/* RIGHT PANE: Questions */}
          <div className="xl:col-span-6 space-y-4">
            {currentSet.questions.map((q) => {
              const userChoice = answers[q.id];
              const isRevealed = mode === 'practice' ? Boolean(revealedIds[q.id]) : examSubmitted;

              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-slate-700/75 bg-[#1E293B] p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <span className="rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
                      Câu {q.questionNumber}
                    </span>
                    <span className="rounded-md bg-slate-900 border border-slate-700 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                      {q.questionType}
                    </span>
                  </div>

                  <p className="text-sm sm:text-base font-bold text-white leading-relaxed mb-3.5">
                    {q.prompt}
                  </p>

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
                        Kiểm tra &amp; Xem dẫn chứng
                      </button>
                    </div>
                  )}

                  {isRevealed && (
                    <ReadingExplanationCard
                      questionId={q.id}
                      questionLabel={`Reading Part 7 — Câu ${q.questionNumber} (${q.questionType})`}
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
      )}
    </div>
  );
};
