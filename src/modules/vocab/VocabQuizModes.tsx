import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Headphones,
  HelpCircle,
  Keyboard,
  Puzzle,
  RotateCcw,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react';
import { VocabWord } from '../../types';
import { useApp } from '../../context/AppContext';
import { speakText } from '../../utils/speech';
import { playCorrect, playFlip, playSuccess, playWrong } from '../../lib/soundEffects';

export type QuizModeType = 'meaning' | 'listening' | 'cloze' | 'matching';

interface VocabQuizModesProps {
  words: VocabWord[];
  mode: QuizModeType;
  deckTitle: string;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const VocabQuizModes: React.FC<VocabQuizModesProps> = ({ words, mode, deckTitle }) => {
  const { markWordStatus, recordAttempt, addXp } = useApp();

  // Mode 1 direction: en-vi or vi-en
  const [direction, setDirection] = useState<'en-vi' | 'vi-en'>('en-vi');

  // Shared quiz session state (for Modes 1, 2, 3)
  const [sessionKey, setSessionKey] = useState(0);
  const quizItems = useMemo(() => shuffle(words).slice(0, Math.min(10, words.length)), [words, sessionKey, mode]);
  const [qIdx, setQIdx] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [clozeInput, setClozeInput] = useState('');
  const [clozeResult, setClozeResult] = useState<'correct' | 'wrong' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  // Mode 4: Matching Game state
  const matchingPairs = useMemo(() => shuffle(words).slice(0, Math.min(6, words.length)), [words, sessionKey, mode]);
  const [leftCards, setLeftCards] = useState<VocabWord[]>([]);
  const [rightCards, setRightCards] = useState<VocabWord[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [matchingMistakes, setMatchingMistakes] = useState(0);

  useEffect(() => {
    setQIdx(0);
    setSelectedOptionId(null);
    setClozeInput('');
    setClozeResult(null);
    setShowHint(false);
    setCorrectCount(0);
    setFinished(false);

    setLeftCards(shuffle(matchingPairs));
    setRightCards(shuffle(matchingPairs));
    setSelectedLeft(null);
    setSelectedRight(null);
    setMatchedIds([]);
    setWrongPair(null);
    setElapsedSec(0);
    setMatchingMistakes(0);
  }, [mode, sessionKey, words]);

  // Live timer for Matching game
  useEffect(() => {
    if (mode !== 'matching' || finished || matchingPairs.length === 0) return;
    const timer = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, finished, matchingPairs.length]);

  const currentWord = quizItems[qIdx];

  // Auto-speak in Listening quiz mode
  useEffect(() => {
    if (mode === 'listening' && currentWord && !finished) {
      speakText(currentWord.word, { accent: 'en-US', rate: 0.95 });
    }
  }, [mode, qIdx, currentWord?.id, finished]);

  const options = useMemo(() => {
    if (!currentWord) return [];
    const distractors = shuffle(words.filter((w) => w.id !== currentWord.id)).slice(0, 3);
    return shuffle([currentWord, ...distractors]);
  }, [currentWord?.id, words, sessionKey]);

  const handleRestart = () => {
    setSessionKey((k) => k + 1);
  };

  // --- Mode 1 & 2 Option Selection ---
  const handleSelectOption = (opt: VocabWord) => {
    if (selectedOptionId || !currentWord) return;
    setSelectedOptionId(opt.id);
    const isCorrect = opt.id === currentWord.id;
    if (isCorrect) {
      playCorrect();
      setCorrectCount((c) => c + 1);
      markWordStatus(currentWord.id, 'mastered');
    } else {
      playWrong();
      markWordStatus(currentWord.id, 'forgotten');
    }
  };

  // --- Mode 3 Cloze Check ---
  const clozeSentence = useMemo(() => {
    if (!currentWord) return '';
    const ex = currentWord.examples[0]?.en || `Please use "${currentWord.word}" in context.`;
    const escaped = currentWord.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stem = currentWord.word.length > 5 ? escaped.slice(0, -1) : escaped;
    const regex = new RegExp(`\\b${stem}[a-zA-Z]*\\b`, 'i');
    if (regex.test(ex)) {
      return ex.replace(regex, '___________');
    }
    return ex.replace(new RegExp(escaped, 'i'), '___________');
  }, [currentWord?.id]);

  const handleCheckCloze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWord || clozeResult) return;
    const normalized = clozeInput.trim().toLowerCase();
    const target = currentWord.word.toLowerCase();
    const stemMatch =
      normalized === target ||
      (target.length > 5 && normalized.startsWith(target.slice(0, -1)) && Math.abs(normalized.length - target.length) <= 3);

    if (stemMatch) {
      playCorrect();
      setClozeResult('correct');
      setCorrectCount((c) => c + 1);
      markWordStatus(currentWord.id, 'mastered');
    } else {
      playWrong();
      setClozeResult('wrong');
      markWordStatus(currentWord.id, 'forgotten');
    }
  };

  const handleNextQuestion = () => {
    if (qIdx + 1 >= quizItems.length) {
      playSuccess();
      setFinished(true);
      recordAttempt({
        module: 'vocab',
        partLabel: `Từ vựng (${deckTitle})`,
        correctCount,
        totalCount: quizItems.length,
        topics: [{ topic: deckTitle, correct: correctCount / Math.max(1, quizItems.length) >= 0.7 }],
      });
    } else {
      setQIdx((i) => i + 1);
      setSelectedOptionId(null);
      setClozeInput('');
      setClozeResult(null);
      setShowHint(false);
    }
  };

  // --- Mode 4 Matching Logic ---
  const attemptMatch = (leftId: string | null, rightId: string | null) => {
    if (!leftId || !rightId) return;
    if (leftId === rightId) {
      const nextMatched = [...matchedIds, leftId];
      setMatchedIds(nextMatched);
      setSelectedLeft(null);
      setSelectedRight(null);
      addXp(8);
      if (nextMatched.length === matchingPairs.length) {
        playSuccess();
        setFinished(true);
        recordAttempt({
          module: 'vocab',
          partLabel: `Ghép cặp (${deckTitle})`,
          correctCount: matchingPairs.length,
          totalCount: matchingPairs.length,
          topics: [{ topic: deckTitle, correct: matchingMistakes <= 2 }],
        });
      } else {
        playCorrect();
      }
    } else {
      playWrong();
      setMatchingMistakes((m) => m + 1);
      setWrongPair({ left: leftId, right: rightId });
      window.setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 650);
    }
  };

  // ================= RESULT SCREEN =================
  if (finished) {
    const total = mode === 'matching' ? matchingPairs.length : quizItems.length;
    const score = mode === 'matching' ? matchingPairs.length : correctCount;
    const pct = Math.round((score / Math.max(1, total)) * 100);

    return (
      <div className="rounded-3xl border border-indigo-500/30 bg-[#1E293B] p-8 text-center shadow-card">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-glow">
          <Sparkles className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-2xl font-extrabold text-white">Hoàn thành bài kiểm tra!</h3>
        <p className="mt-1 text-sm text-slate-400">{deckTitle}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {mode === 'matching' ? (
            <>
              <div className="rounded-2xl bg-slate-900/90 border border-slate-700 px-6 py-4">
                <p className="text-xs text-slate-400">Thời gian hoàn thành</p>
                <p className="mt-1 text-3xl font-extrabold text-cyan-400">{elapsedSec}s</p>
              </div>
              <div className="rounded-2xl bg-slate-900/90 border border-slate-700 px-6 py-4">
                <p className="text-xs text-slate-400">Số lần ghép sai</p>
                <p className="mt-1 text-3xl font-extrabold text-amber-400">{matchingMistakes}</p>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-slate-900/90 border border-slate-700 px-8 py-4">
              <p className="text-xs text-slate-400">Độ chính xác</p>
              <p className="mt-1 text-3xl font-extrabold text-emerald-400">
                {score} / {total} ({pct}%)
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleRestart}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-glow hover:from-blue-500 hover:to-violet-500 transition"
        >
          <RotateCcw className="h-4 w-4" />
          Luyện vòng mới
        </button>
      </div>
    );
  }

  // ================= MODE 4: MATCHING GAME =================
  if (mode === 'matching') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-3">
          <div className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-bold text-white">Ghép cặp Từ – Nghĩa ({matchedIds.length}/{matchingPairs.length})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-300">
              <Clock className="h-3.5 w-3.5" />
              {elapsedSec}s
            </span>
            <button
              type="button"
              onClick={handleRestart}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Chơi lại
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* English column */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Tiếng Anh</p>
            {leftCards.map((w) => {
              const isMatched = matchedIds.includes(w.id);
              const isSelected = selectedLeft === w.id;
              const isWrong = wrongPair?.left === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  disabled={isMatched}
                  onClick={() => {
                    speakText(w.word, { accent: 'en-US' });
                    setSelectedLeft(w.id);
                    attemptMatch(w.id, selectedRight);
                  }}
                  className={`w-full rounded-xl border p-4 text-left transition flex items-center justify-between ${
                    isMatched
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 opacity-50 cursor-default'
                      : isWrong
                      ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                      : isSelected
                      ? 'border-indigo-400 bg-indigo-500/25 text-white ring-2 ring-indigo-500/30'
                      : 'border-slate-700/80 bg-[#1E293B] text-slate-100 hover:border-indigo-500/50'
                  }`}
                >
                  <div>
                    <span className="font-bold text-base">{w.word}</span>
                    <span className="ml-2 text-xs text-slate-400">({w.pos})</span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">{w.ipaUS}</span>
                </button>
              );
            })}
          </div>

          {/* Vietnamese column */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Nghĩa Tiếng Việt</p>
            {rightCards.map((w) => {
              const isMatched = matchedIds.includes(w.id);
              const isSelected = selectedRight === w.id;
              const isWrong = wrongPair?.right === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  disabled={isMatched}
                  onClick={() => {
                    setSelectedRight(w.id);
                    attemptMatch(selectedLeft, w.id);
                  }}
                  className={`w-full rounded-xl border p-4 text-left transition text-sm font-medium ${
                    isMatched
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 opacity-50 cursor-default'
                      : isWrong
                      ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                      : isSelected
                      ? 'border-cyan-400 bg-cyan-500/20 text-white ring-2 ring-cyan-500/30'
                      : 'border-slate-700/80 bg-[#1E293B] text-slate-200 hover:border-cyan-500/50'
                  }`}
                >
                  {w.meaning}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!currentWord) return null;

  // ================= MODES 1, 2, 3 =================
  return (
    <div className="rounded-3xl border border-slate-700/80 bg-[#1E293B] p-5 sm:p-8 shadow-card space-y-6">
      {/* Top Quiz Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
            Câu {qIdx + 1} / {quizItems.length}
          </span>
          <span className="rounded-lg bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
            Đúng: {correctCount}
          </span>
        </div>

        {mode === 'meaning' && (
          <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => {
                setDirection('en-vi');
                setSelectedOptionId(null);
              }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                direction === 'en-vi' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Anh → Việt
            </button>
            <button
              type="button"
              onClick={() => {
                setDirection('vi-en');
                setSelectedOptionId(null);
              }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                direction === 'vi-en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Việt → Anh
            </button>
          </div>
        )}
      </div>

      {/* Prompt Area */}
      {mode === 'meaning' && (
        <div className="rounded-2xl bg-slate-900/85 border border-slate-800 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {direction === 'en-vi' ? 'Chọn nghĩa tiếng Việt đúng nhất' : 'Chọn từ tiếng Anh tương ứng'}
          </p>
          <h3 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white">
            {direction === 'en-vi' ? currentWord.word : currentWord.meaning}
          </h3>
          {direction === 'en-vi' && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300 font-bold">
                {currentWord.pos}
              </span>
              <span className="font-mono">{currentWord.ipaUS}</span>
              <button
                type="button"
                onClick={() => speakText(currentWord.word, { accent: 'en-US' })}
                className="rounded-lg bg-slate-800 p-1.5 text-cyan-400 hover:bg-indigo-600 hover:text-white transition"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'listening' && (
        <div className="rounded-2xl bg-slate-900/85 border border-slate-800 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center justify-center gap-1.5">
            <Headphones className="h-4 w-4" />
            Nghe phát âm và chọn từ tiếng Anh chính xác
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => speakText(currentWord.word, { accent: 'en-US', rate: 1.0 })}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-glow hover:from-blue-500 hover:to-indigo-500 transition active:scale-95"
            >
              <Volume2 className="h-5 w-5" />
              Nghe chuẩn (1.0x US)
            </button>
            <button
              type="button"
              onClick={() => speakText(currentWord.word, { accent: 'en-GB', rate: 0.75 })}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3.5 text-sm font-bold text-slate-200 hover:border-cyan-500/50 transition"
            >
              <Volume2 className="h-4 w-4 text-amber-400" />
              Nghe chậm (0.75x UK)
            </button>
          </div>
        </div>
      )}

      {mode === 'cloze' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/85 border border-slate-800 p-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-400">
                <Keyboard className="h-4 w-4" />
                Điền từ vào chỗ trống theo ngữ cảnh
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!showHint) playFlip();
                  setShowHint((h) => !h);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:underline"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {showHint ? 'Ẩn gợi ý' : 'Xem gợi ý'}
              </button>
            </div>
            <p className="text-lg sm:text-xl font-semibold text-white leading-relaxed">
              {clozeSentence}
            </p>
            <p className="mt-2.5 text-sm text-slate-400">
              Nghĩa câu: {currentWord.examples[0]?.vi}
            </p>
            {showHint && (
              <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 text-xs text-amber-200">
                Gợi ý: Loại từ <b>({currentWord.pos})</b> • Nghĩa: <b>{currentWord.meaning}</b> • Bắt đầu bằng chữ{' '}
                <b className="uppercase">{currentWord.word.slice(0, 2)}...</b>
              </div>
            )}
          </div>

          <form onSubmit={handleCheckCloze} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={clozeInput}
              disabled={clozeResult !== null}
              onChange={(e) => setClozeInput(e.target.value)}
              placeholder="Nhập từ tiếng Anh chính xác..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            {clozeResult === null && (
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-glow hover:from-blue-500 hover:to-indigo-500 transition"
              >
                Kiểm tra
              </button>
            )}
          </form>

          {clozeResult && (
            <div
              className={`rounded-2xl border p-4 ${
                clozeResult === 'correct'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {clozeResult === 'correct' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    Chính xác tuyệt đối!
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-rose-400" />
                    Đáp án đúng là: <span className="text-white underline">{currentWord.word}</span> ({currentWord.ipaUS})
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Câu đầy đủ: {currentWord.examples[0]?.en}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Multiple Choice Grid (Modes 1 & 2) */}
      {(mode === 'meaning' || mode === 'listening') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt, idx) => {
            const letter = ['A', 'B', 'C', 'D'][idx];
            const isChosen = selectedOptionId === opt.id;
            const isRight = opt.id === currentWord.id;
            const revealed = selectedOptionId !== null;

            let cardCls =
              'border-slate-700/80 bg-slate-900/75 text-slate-100 hover:border-indigo-500/60 hover:bg-slate-800/80';
            if (revealed) {
              if (isRight) {
                cardCls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
              } else if (isChosen) {
                cardCls = 'border-rose-500 bg-rose-500/15 text-rose-100';
              } else {
                cardCls = 'border-slate-800 bg-slate-900/40 text-slate-500';
              }
            }

            return (
              <button
                key={opt.id}
                type="button"
                disabled={revealed}
                onClick={() => handleSelectOption(opt)}
                className={`rounded-2xl border p-4 text-left transition flex items-start gap-3 ${cardCls}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-300">
                  {letter}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm sm:text-base">
                    {mode === 'listening'
                      ? opt.word
                      : direction === 'en-vi'
                      ? opt.meaning
                      : opt.word}
                  </p>
                  {revealed && (
                    <p className="mt-1 text-xs text-slate-400">
                      {opt.word} ({opt.pos}) — {opt.meaning}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Next Question button */}
      {(selectedOptionId !== null || clozeResult !== null) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleNextQuestion}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-glow hover:from-blue-500 hover:to-violet-500 transition"
          >
            {qIdx + 1 >= quizItems.length ? 'Xem kết quả' : 'Câu tiếp theo'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
