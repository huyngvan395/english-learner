import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Bookmark,
  Check,
  CheckCircle2,
  Layers,
  Lightbulb,
  NotebookPen,
  PartyPopper,
  RotateCcw,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react';
import { SrsRating, VocabTopic, VocabWord, WordPOS } from '../../types';
import { useApp } from '../../context/AppContext';
import { playWordAudio, speakText } from '../../utils/speech';
import { TopicIllustration } from '../../components/TopicIllustration';
import { QuickNoteBox } from '../../components/QuickNoteBox';
import { VocabExtensionBlock } from '../../components/VocabExtensionBlock';

interface ActiveRecallModeProps {
  topic: VocabTopic;
  topicIndex: number;
  totalTopics: number;
  totalDeckWords: number;
  deckTitle: string;
  hasNextTopic: boolean;
  onGoNextTopic: () => void;
  /** When true (e.g. Từ vựng của tôi review session), includes all words in topic.words and shows session progress bar */
  sessionMode?: boolean;
  sessionLabel?: string;
  onSwitchToFlashcard?: () => void;
  onExitSession?: () => void;
}

const POS_VI_MAP: Record<WordPOS, string> = {
  n: 'Danh từ',
  v: 'Động từ',
  adj: 'Tính từ',
  adv: 'Trạng từ',
  phrase: 'Cụm từ',
};

function isMaskSeparator(ch: string): boolean {
  return ch === ' ' || ch === '-' || ch === "'";
}

/** Fisher-Yates shuffle of all revealable letter indices (skipping spaces, hyphens, apostrophes). */
function buildShuffledLetterIndices(word: string): number[] {
  const indices: number[] = [];
  for (let i = 0; i < word.length; i += 1) {
    if (!isMaskSeparator(word[i])) {
      indices.push(i);
    }
  }
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices;
}

/**
 * Reveal ~55–65% of letters before hitting final audio-unlock threshold,
 * always keeping at least 1–2 '*' hidden for words of 4+ letters
 * (e.g., 5 letters -> max 3 revealed like "g**st"; 10 letters -> max 6 revealed).
 */
function computeMaxHintSteps(totalLetters: number): number {
  if (totalLetters <= 1) return 0;
  if (totalLetters <= 3) return totalLetters - 1;
  return Math.max(1, Math.min(totalLetters - 2, Math.round(totalLetters * 0.6)));
}

function buildRandomHintDisplay(word: string, revealedIndices: Set<number>): string {
  return word
    .split('')
    .map((ch, idx) => {
      if (isMaskSeparator(ch)) return ch;
      return revealedIndices.has(idx) ? ch : '*';
    })
    .join('');
}

function maskWordForExample(word: string): string {
  return word
    .split('')
    .map((ch) => (isMaskSeparator(ch) ? ch : '*'))
    .join('');
}

function playSubtleHintTick() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
  } catch {
    // Ignore audio context block
  }
}

function renderMaskedExample(
  sentence: string,
  targetWord: string,
  mode: 'masked' | 'correct' | 'revealed'
): React.ReactNode {
  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = sentence.split(regex);
  const maskedStr = maskWordForExample(targetWord);

  return parts.map((part, idx) => {
    if (part.toLowerCase() === targetWord.toLowerCase()) {
      if (mode === 'masked') {
        return (
          <span
            key={idx}
            className="mx-0.5 font-mono font-extrabold tracking-widest text-rose-400"
          >
            {maskedStr}
          </span>
        );
      }
      return (
        <span
          key={idx}
          className={`mx-0.5 rounded-md px-1.5 py-0.5 font-extrabold ${
            mode === 'correct'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
              : 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
          }`}
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

const SRS_BUTTONS: {
  rating: Exclude<SrsRating, 'permanent'>;
  shortcut: string;
  label: string;
  intervalLabel: string;
  cls: string;
  badgeCls: string;
}[] = [
  {
    rating: 'again',
    shortcut: '1',
    label: 'HỌC LẠI',
    intervalLabel: '10 phút',
    cls: 'border-rose-500/60 bg-rose-950/45 hover:bg-rose-900/60 text-rose-200 hover:border-rose-400',
    badgeCls: 'bg-rose-500/25 text-rose-300 border-rose-500/40',
  },
  {
    rating: 'hard',
    shortcut: '2',
    label: 'KHÓ',
    intervalLabel: '1-3 ngày',
    cls: 'border-amber-600/60 bg-amber-950/45 hover:bg-amber-900/55 text-amber-200 hover:border-amber-400',
    badgeCls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    rating: 'good',
    shortcut: '3',
    label: 'TỐT',
    intervalLabel: '1-4 ngày',
    cls: 'border-emerald-500/60 bg-emerald-950/45 hover:bg-emerald-900/55 text-emerald-200 hover:border-emerald-400',
    badgeCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    rating: 'easy',
    shortcut: '4',
    label: 'DỄ',
    intervalLabel: '1-7 ngày',
    cls: 'border-sky-500/60 bg-sky-950/45 hover:bg-sky-900/55 text-sky-200 hover:border-sky-400',
    badgeCls: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
];

export const ActiveRecallMode: React.FC<ActiveRecallModeProps> = ({
  topic,
  topicIndex,
  totalTopics,
  totalDeckWords,
  deckTitle,
  hasNextTopic,
  onGoNextTopic,
  sessionMode = false,
  sessionLabel,
  onSwitchToFlashcard,
  onExitSession,
}) => {
  const { vocabProgress, rateWordSrs, toggleSaveWord, isWordSaved, getNoteByTarget } = useApp();

  const buildQueue = (includeMastered: boolean): VocabWord[] => {
    if (includeMastered || sessionMode) return [...topic.words];
    return topic.words.filter((w) => vocabProgress[w.id]?.status !== 'mastered');
  };

  const [queue, setQueue] = useState<VocabWord[]>(() => buildQueue(false));
  const [cardTurnKey, setCardTurnKey] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [cardState, setCardState] = useState<'typing' | 'correct' | 'revealed'>('typing');
  const [hintCount, setHintCount] = useState(0);
  const [hintPopKey, setHintPopKey] = useState(0);
  const [wrongShakeKey, setWrongShakeKey] = useState(0);
  const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [requeueToast, setRequeueToast] = useState<string | null>(null);
  const [sessionCompletedCount, setSessionCompletedCount] = useState(0);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
  const [sessionWrongCount, setSessionWrongCount] = useState(0);
  const [cardHadMistake, setCardHadMistake] = useState(false);
  const [cardScoredInSession, setCardScoredInSession] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset queue & hint state cleanly when switching topics
  useEffect(() => {
    setQueue(buildQueue(false));
    setCardTurnKey((k) => k + 1);
    setInputVal('');
    setCardState('typing');
    setHintCount(0);
    setHintPopKey(0);
    setWrongShakeKey(0);
    setWrongFeedback(null);
    setShowNoteBox(false);
    setRequeueToast(null);
    setSessionCompletedCount(0);
    setSessionCorrectCount(0);
    setSessionWrongCount(0);
    setCardHadMistake(false);
    setCardScoredInSession(false);
  }, [topic.id, sessionMode]);

  const current = queue[0] || null;

  // Fresh Fisher-Yates random reveal order per card turn (guaranteed reset on every new card!)
  const shuffledIndices = useMemo(() => {
    if (!current) return [];
    return buildShuffledLetterIndices(current.word);
  }, [current?.id, cardTurnKey]);

  const totalLetters = shuffledIndices.length;
  const maxHintSteps = useMemo(() => computeMaxHintSteps(totalLetters), [totalLetters]);
  const audioHintUnlocked = hintCount >= maxHintSteps;

  const revealedIndexSet = useMemo(() => {
    return new Set(shuffledIndices.slice(0, Math.min(hintCount, maxHintSteps)));
  }, [shuffledIndices, hintCount, maxHintSteps]);

  const hintDisplay = useMemo(() => {
    if (!current) return '';
    return buildRandomHintDisplay(current.word, revealedIndexSet);
  }, [current, revealedIndexSet]);

  // Auto-focus input whenever a new card appears in typing state
  useEffect(() => {
    if (current && cardState === 'typing') {
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(t);
    }
  }, [current?.id, cardTurnKey, cardState]);

  const handlePronounce = useCallback((word: VocabWord, accent: 'en-US' | 'en-GB' = 'en-US') => {
    const audioUrl =
      accent === 'en-GB'
        ? word.audioUrlUK || word.audioUrlUS
        : word.audioUrlUS || word.audioUrlUK;
    playWordAudio(word.word, { accent, rate: 0.95, audioUrl });
  }, []);

  const resetForNextTurn = useCallback(() => {
    setInputVal('');
    setCardState('typing');
    setHintCount(0);
    setHintPopKey(0);
    setWrongShakeKey(0);
    setWrongFeedback(null);
    setShowNoteBox(false);
    setCardHadMistake(false);
    setCardScoredInSession(false);
    setCardTurnKey((k) => k + 1);
  }, []);

  const handleRateSrs = useCallback(
    (rating: SrsRating) => {
      if (!current) return;
      rateWordSrs(current.id, rating, current.deckId);

      if (rating === 'again') {
        setRequeueToast(`Đã xếp "${current.word}" lặp lại sau 3–4 thẻ (10 phút).`);
      } else {
        setRequeueToast(null);
        setSessionCompletedCount((c) => c + 1);
      }

      setQueue((prev) => {
        if (prev.length === 0) return prev;
        const [head, ...rest] = prev;
        if (rating === 'again') {
          const next = [...rest];
          const insertAt = Math.min(next.length, 3);
          next.splice(insertAt, 0, head);
          return next;
        }
        return rest;
      });
      resetForNextTurn();
    },
    [current, rateWordSrs, resetForNextTurn]
  );

  // Flip back from Back Answer Card to Front Typing Card to try typing immediately
  const handleFlipBackToFront = useCallback(() => {
    setCardState('typing');
    setInputVal('');
    setHintCount(0);
    setHintPopKey(0);
    setWrongShakeKey(0);
    setWrongFeedback(null);
    setCardTurnKey((k) => k + 1);
  }, []);

  // Keyboard shortcuts on Back Answer Card: 1/2/3/4 for 4 SRS levels; Enter advances when typed correct
  useEffect(() => {
    if (cardState === 'typing' || !current) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
      if (e.key === '1') {
        e.preventDefault();
        handleRateSrs('again');
      } else if (e.key === '2') {
        e.preventDefault();
        handleRateSrs('hard');
      } else if (e.key === '3') {
        e.preventDefault();
        handleRateSrs('good');
      } else if (e.key === '4') {
        e.preventDefault();
        handleRateSrs('easy');
      } else if (e.key === 'Enter' && cardState === 'correct') {
        e.preventDefault();
        handleRateSrs('good');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cardState, current, handleRateSrs]);

  const handleHintOrAudioClick = () => {
    if (!current || cardState !== 'typing') return;
    if (audioHintUnlocked) {
      // Final stage unlocked: pronounce target word without revealing remaining letters
      handlePronounce(current, 'en-US');
      inputRef.current?.focus();
      return;
    }
    const nextCount = Math.min(maxHintSteps, hintCount + 1);
    setHintCount(nextCount);
    setHintPopKey((k) => k + 1);
    playSubtleHintTick();
    inputRef.current?.focus();
  };

  const handleCheckAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!current || cardState !== 'typing') return;

    const cleanedUser = inputVal.trim().replace(/\s+/g, ' ').toLowerCase();
    const cleanedTarget = current.word.trim().replace(/\s+/g, ' ').toLowerCase();

    if (!cleanedUser) {
      setWrongShakeKey((k) => k + 1);
      setWrongFeedback('Hãy nhập đáp án hoặc bấm "Gợi ý" / "KHÔNG BIẾT".');
      inputRef.current?.focus();
      return;
    }

    if (cleanedUser === cleanedTarget) {
      setCardState('correct');
      setWrongFeedback(null);
      setRequeueToast(null);
      if (!cardScoredInSession) {
        if (cardHadMistake) setSessionWrongCount((c) => c + 1);
        else setSessionCorrectCount((c) => c + 1);
        setCardScoredInSession(true);
      }
      handlePronounce(current, 'en-US');
    } else {
      setCardHadMistake(true);
      let matchPrefix = 0;
      while (
        matchPrefix < cleanedUser.length &&
        matchPrefix < cleanedTarget.length &&
        cleanedUser[matchPrefix] === cleanedTarget[matchPrefix]
      ) {
        matchPrefix += 1;
      }
      setWrongShakeKey((k) => k + 1);
      if (matchPrefix >= 2) {
        setWrongFeedback(
          `Gần đúng rồi! Bạn đã khớp ${matchPrefix} ký tự đầu ("${current.word.slice(0, matchPrefix)}...") — hãy kiểm tra lại các chữ cái phía sau.`
        );
      } else {
        setWrongFeedback(
          `Chưa chính xác (từ này có ${totalLetters} chữ cái). Hãy thử sửa lại hoặc bấm "Gợi ý"!`
        );
      }
      inputRef.current?.focus();
    }
  };

  const handleDontKnow = () => {
    if (!current || cardState !== 'typing') return;
    setCardState('revealed');
    setWrongFeedback(null);
    setRequeueToast(null);
    if (!cardScoredInSession) {
      setSessionWrongCount((c) => c + 1);
      setCardScoredInSession(true);
    }
    handlePronounce(current, 'en-US');
  };

  const totalSessionWords = topic.words.length;
  const currentCardNumber = Math.min(totalSessionWords, sessionCompletedCount + 1);
  const sessionProgressPct = Math.round(
    (Math.min(sessionCompletedCount, totalSessionWords) / Math.max(1, totalSessionWords)) * 100
  );

  const renderSessionBar = () => {
    if (!sessionMode) return null;
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#111827]/95 px-4 py-3 space-y-2.5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-lg bg-indigo-500/20 border border-indigo-400/35 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
              Câu {current ? currentCardNumber : totalSessionWords}/{totalSessionWords}
            </span>
            {sessionLabel && (
              <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-none">
                {sessionLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Đúng: {sessionCorrectCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-300">
              <XCircle className="h-3 w-3" />
              Chưa nhớ: {sessionWrongCount}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onSwitchToFlashcard && (
              <button
                type="button"
                onClick={onSwitchToFlashcard}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 px-3 py-1.5 text-xs font-bold text-indigo-200 transition"
              >
                <Layers className="h-3.5 w-3.5" />
                Chuyển Flashcard
              </button>
            )}
            {onExitSession && (
              <button
                type="button"
                onClick={onExitSession}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Thoát phiên ôn
              </button>
            )}
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${sessionProgressPct}%` }}
          />
        </div>
      </div>
    );
  };

  // ================= TOPIC COMPLETED CELEBRATION =================
  if (!current) {
    return (
      <div className="space-y-4">
        {renderSessionBar()}
        <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-[#162834] via-[#152033] to-[#0F172A] p-8 sm:p-12 text-center shadow-card space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-glow">
            <PartyPopper className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-xs font-extrabold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {sessionMode ? 'HOÀN THÀNH PHIÊN ÔN GÕ TỪ' : 'HOÀN THÀNH 100% CHỦ ĐỀ'}
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Xuất sắc! Bạn đã chinh phục &ldquo;{topic.name}&rdquo;
            </h3>
            <p className="text-sm text-slate-300 max-w-lg mx-auto">
              Tất cả <b>{topic.words.length}/{topic.words.length} thẻ</b> đã được hoàn thành
              và lên lịch ôn tập thông minh SRS!
              {sessionMode && (
                <>
                  {' '}Kết quả phiên: <b className="text-emerald-300">{sessionCorrectCount} đúng ngay</b> ·{' '}
                  <b className="text-rose-300">{sessionWrongCount} cần củng cố</b>.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {hasNextTopic && (
              <button
                type="button"
                onClick={onGoNextTopic}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-glow hover:from-blue-500 hover:to-violet-500 transition active:scale-95"
              >
                Chuyển sang chủ đề tiếp theo
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setQueue(buildQueue(true));
                setSessionCompletedCount(0);
                setSessionCorrectCount(0);
                setSessionWrongCount(0);
                resetForNextTurn();
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-5 py-3.5 text-sm font-bold text-slate-200 transition"
            >
              <RotateCcw className="h-4 w-4" />
              {sessionMode ? 'Ôn gõ lại phiên này' : 'Luyện gõ lại toàn bộ chủ đề'}
            </button>
            {sessionMode && onExitSession && (
              <button
                type="button"
                onClick={onExitSession}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-glow hover:brightness-110 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại Từ vựng của tôi
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const saved = isWordSaved(current.id);
  const hasNote = Boolean(getNoteByTarget('vocab', current.id));
  const cleanMeaning = current.meaning.replace(/^\[[^\]]+\]\s*/, '');
  const isBackSide = cardState !== 'typing';
  const hasIpaUS = Boolean(current.ipaUS && current.ipaUS.trim() && current.ipaUS.trim() !== '/.../');
  const hasIpaUK = Boolean(current.ipaUK && current.ipaUK.trim() && current.ipaUK.trim() !== '/.../');
  const hasDefEn = Boolean(current.definitionEn && current.definitionEn.trim());
  const hasDefVi = Boolean(current.definitionVi && current.definitionVi.trim());
  const hasExample = Boolean(current.examples[0]?.en && current.examples[0].en.trim());

  // ================= BACK SIDE: FULL ANSWER CARD + 4-LEVEL SRS =================
  if (isBackSide) {
    return (
      <div className="space-y-4">
        {renderSessionBar()}
        <div
          key={`back-${current.id}-${cardTurnKey}`}
          className="animate-card-flip rounded-3xl border border-slate-700/80 bg-gradient-to-b from-[#1A263D] via-[#131E32] to-[#0E1627] shadow-card overflow-hidden flex flex-col"
        >
        {/* Top Header: Status + Note on Left, Flip Back button on Right */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <div className="flex items-center gap-2 flex-wrap">
            {cardState === 'correct' ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-extrabold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Chính xác! Đánh giá mức nhớ
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-extrabold text-amber-200">
                <Sparkles className="h-3.5 w-3.5" />
                Đáp án chi tiết
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowNoteBox((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                showNoteBox || hasNote
                  ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                  : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-indigo-400/40 hover:text-indigo-200'
              }`}
            >
              <NotebookPen className="h-3.5 w-3.5" />
              {hasNote ? 'Xem ghi chú' : 'Ghi chú'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleFlipBackToFront}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600/80 bg-slate-800/90 hover:bg-slate-700 hover:border-sky-400/50 px-3.5 py-1.5 text-xs font-bold text-sky-300 transition active:scale-95"
            title="Quay lại mặt gõ từ để thử gõ lại ngay"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Lật lại
          </button>
        </div>

        {/* Inline Quick Note Drawer */}
        {showNoteBox && (
          <div className="px-5 pt-3">
            <QuickNoteBox
              targetType="vocab"
              targetId={current.id}
              title={`${current.word} (${POS_VI_MAP[current.pos]})`}
              subtitle={`${deckTitle} • ${topic.name}`}
              placeholder={`Ghi mẹo nhớ hoặc collocation cho từ "${current.word}"...`}
            />
          </div>
        )}

        {/* Main Full Answer Body */}
        <div className="px-5 sm:px-10 pt-5 pb-6 flex flex-col items-center text-center space-y-5">
          {/* Topic Illustration */}
          <TopicIllustration iconKey={topic.icon} size="lg" />

          {/* Large Light-Blue English Word + POS Pill */}
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-sky-300">
                {current.word}
              </h2>
              <span className="inline-flex items-center rounded-lg border border-sky-400/35 bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-200">
                {POS_VI_MAP[current.pos]}
              </span>
            </div>

            {/* Direct US & UK IPA + Speaker Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => handlePronounce(current, 'en-US')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-slate-900/85 hover:bg-cyan-500/20 px-3 py-1.5 text-xs sm:text-sm font-semibold text-cyan-200 transition active:scale-95"
                title="Nghe phát âm giọng Mỹ (US)"
              >
                <span className="font-bold text-cyan-400">US:</span>
                <span className="font-mono text-slate-200">{current.ipaUS}</span>
                <Volume2 className="h-4 w-4 text-cyan-400" />
              </button>

              <button
                type="button"
                onClick={() => handlePronounce(current, 'en-GB')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-slate-900/85 hover:bg-amber-500/20 px-3 py-1.5 text-xs sm:text-sm font-semibold text-amber-200 transition active:scale-95"
                title="Nghe phát âm giọng Anh (UK)"
              >
                <span className="font-bold text-amber-400">UK:</span>
                <span className="font-mono text-slate-200">{current.ipaUK}</span>
                <Volume2 className="h-4 w-4 text-amber-400" />
              </button>
            </div>

            {/* Prominent Vietnamese Meaning */}
            <p className="pt-1 text-lg sm:text-xl font-extrabold text-white leading-snug">
              {cleanMeaning}
            </p>
          </div>

          {/* ĐỊNH NGHĨA & VÍ DỤ Blocks */}
          <div className="w-full max-w-2xl space-y-3.5 text-left">
            {/* ĐỊNH NGHĨA */}
            {(hasDefEn || hasDefVi) && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-sky-400">
                  ĐỊNH NGHĨA
                </p>
                {hasDefEn && (
                  <div className="flex items-start gap-2.5 text-sm text-slate-100 leading-relaxed">
                    <span className="mt-0.5 shrink-0 rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-300">
                      EN
                    </span>
                    <p>{current.definitionEn}</p>
                  </div>
                )}
                {hasDefVi && (
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    <span className="mt-0.5 shrink-0 rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
                      VI
                    </span>
                    <p>{current.definitionVi}</p>
                  </div>
                )}
              </div>
            )}

            {/* VÍ DỤ */}
            {hasExample && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400">
                    VÍ DỤ
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => speakText(current.examples[0].en, { accent: 'en-US', rate: 0.96 })}
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 text-[11px] font-bold text-cyan-300 transition active:scale-95"
                      title="Nghe câu ví dụ giọng Mỹ (US)"
                    >
                      US
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => speakText(current.examples[0].en, { accent: 'en-GB', rate: 0.96 })}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition active:scale-95"
                      title="Nghe câu ví dụ giọng Anh (UK)"
                    >
                      UK
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-sm sm:text-base font-medium text-white leading-relaxed">
                  {renderMaskedExample(
                    current.examples[0].en,
                    current.word,
                    cardState === 'correct' ? 'correct' : 'revealed'
                  )}
                </p>
                <p className="text-xs sm:text-sm italic text-slate-400 leading-relaxed">
                  {current.examples[0].vi}
                </p>
              </div>
            )}

            {/* Upgraded 3-Group Mở rộng từ vựng (Synonyms, Antonyms, Word Family + Collocations) */}
            <VocabExtensionBlock
              synonyms={current.synonyms}
              antonyms={current.antonyms}
              wordFamily={current.wordFamily}
              collocations={current.collocations}
              collapsible
              defaultOpen
            />
          </div>

          {/* 4-Level SRS Evaluation Bar */}
          <div className="w-full max-w-2xl space-y-3 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SRS_BUTTONS.map((btn) => (
                <button
                  key={btn.rating}
                  type="button"
                  onClick={() => handleRateSrs(btn.rating)}
                  className={`group relative flex flex-col items-center justify-center min-h-[54px] rounded-2xl border px-3 py-3 transition active:scale-[0.97] ${btn.cls}`}
                >
                  <span
                    className={`absolute top-1.5 right-2 rounded border px-1.5 py-0.2 text-[10px] font-mono font-bold opacity-80 ${btn.badgeCls}`}
                  >
                    {btn.shortcut}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold tracking-wide">
                    {btn.label}
                  </span>
                  <span className="mt-0.5 text-[11px] font-medium opacity-85">
                    {btn.intervalLabel}
                  </span>
                </button>
              ))}
            </div>

            {/* 2 Secondary Action Buttons: Permanent Mastery & Save */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => handleRateSrs('permanent')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-300 transition active:scale-95"
                title="Đánh dấu thuộc vĩnh viễn, không nhắc ôn lại"
              >
                <Check className="h-3.5 w-3.5 stroke-[3]" />
                Thành thạo
              </button>

              <button
                type="button"
                onClick={() => toggleSaveWord(current.id, current.deckId)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition active:scale-95 ${
                  saved
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-amber-400/40 hover:text-amber-200'
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-amber-400 text-amber-400' : ''}`} />
                {saved ? 'Đã lưu' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer with SRS keyboard shortcuts */}
        <div className="border-t border-slate-800/90 bg-slate-950/50 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            Nhóm học <b className="text-slate-200">{topicIndex + 1}/{totalTopics}</b> • Còn lại{' '}
            <b className="text-sky-400">{queue.length} thẻ</b>
          </span>
          <span className="hidden sm:inline text-[11px] text-slate-500">
            Phím tắt:{' '}
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-rose-300 font-mono">1</kbd> Học lại ·{' '}
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-amber-300 font-mono">2</kbd> Khó ·{' '}
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-300 font-mono">3</kbd> Tốt ·{' '}
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-300 font-mono">4</kbd> Dễ
            {cardState === 'correct' && (
              <>
                {' '}
                · <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200 font-mono">Enter</kbd> Tiếp
              </>
            )}
          </span>
        </div>
      </div>
      </div>
    );
  }

  // ================= FRONT SIDE: ACTIVE RECALL TYPING + RANDOM HINT =================
  return (
    <div className="space-y-4">
      {renderSessionBar()}
      <div
        key={`front-${current.id}-${cardTurnKey}`}
        className="rounded-3xl border border-slate-700/80 bg-gradient-to-b from-[#1A2438] via-[#141E30] to-[#0F172A] shadow-card overflow-hidden flex flex-col"
      >
      {/* 1. Card Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleSaveWord(current.id, current.deckId)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              saved
                ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-amber-400/40 hover:text-amber-200'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-amber-400 text-amber-400' : ''}`} />
            {saved ? 'Đã lưu' : 'Lưu từ'}
          </button>

          <button
            type="button"
            onClick={() => setShowNoteBox((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              showNoteBox || hasNote
                ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-indigo-400/40 hover:text-indigo-200'
            }`}
          >
            <NotebookPen className="h-3.5 w-3.5" />
            {hasNote ? 'Xem ghi chú' : 'Ghi chú'}
          </button>
        </div>

        <span className="rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-[11px] font-bold text-slate-300">
          Còn lại trong phiên: <span className="text-sky-400">{queue.length} thẻ</span>
        </span>
      </div>

      {/* Subtle requeue feedback toast from previous 'HỌC LẠI' card */}
      {requeueToast && (
        <div className="mx-5 mt-3 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3.5 py-2 text-center text-xs font-medium text-rose-200 animate-fade-up">
          {requeueToast}
        </div>
      )}

      {/* Inline Quick Note Drawer */}
      {showNoteBox && (
        <div className="px-5 pt-3">
          <QuickNoteBox
            targetType="vocab"
            targetId={current.id}
            title={`${current.word} (${POS_VI_MAP[current.pos]})`}
            subtitle={`${deckTitle} • ${topic.name}`}
            placeholder={`Ghi mẹo nhớ hoặc collocation cho từ "${current.word}"...`}
          />
        </div>
      )}

      {/* Main Centered Study Body */}
      <div className="px-4 sm:px-10 pt-4 sm:pt-5 pb-6 sm:pb-7 flex flex-col items-center text-center space-y-4 sm:space-y-5">
        {/* Square Rounded Topic Illustration */}
        <TopicIllustration iconKey={topic.icon} size="lg" />

        {/* 2. Large Bold Light-Blue Vietnamese Meaning + Vietnamese POS Pill + Unlocked IPA */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-sky-300 leading-snug">
              {cleanMeaning}
            </h2>
            <span className="inline-flex items-center rounded-lg border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-200">
              {POS_VI_MAP[current.pos]}
            </span>
          </div>

          {/* Unlocked IPA Row when hitting final hint threshold */}
          {audioHintUnlocked && (hasIpaUS || hasIpaUK) && (
            <div className="animate-fade-up inline-flex flex-wrap items-center justify-center gap-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3.5 py-1.5 text-xs sm:text-sm">
              {hasIpaUS && (
                <span className="text-slate-300">
                  <b className="text-cyan-300">US:</b>{' '}
                  <span className="font-mono text-white">{current.ipaUS}</span>
                </span>
              )}
              {hasIpaUS && hasIpaUK && <span className="text-slate-600">•</span>}
              {hasIpaUK && (
                <span className="text-slate-300">
                  <b className="text-amber-300">UK:</b>{' '}
                  <span className="font-mono text-white">{current.ipaUK}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3. Definitions & Masked Example Block (graceful fallback for sparse saved words) */}
        {hasDefEn || hasDefVi || hasExample ? (
          <div className="w-full max-w-2xl space-y-3 rounded-2xl border border-slate-800/90 bg-slate-900/60 px-5 py-4">
            {hasDefEn && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Định nghĩa Tiếng Anh:
                </p>
                <p className="text-sm sm:text-[15px] text-slate-200 leading-relaxed">
                  {current.definitionEn}
                </p>
              </div>
            )}

            {hasDefVi && (
              <div className={`${hasDefEn ? 'border-t border-slate-800/80 pt-2.5' : ''} space-y-1`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Định nghĩa:
                </p>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {current.definitionVi}
                </p>
              </div>
            )}

            {hasExample && (
              <div className={`${hasDefEn || hasDefVi ? 'border-t border-slate-800/80 pt-2.5' : ''} space-y-1.5`}>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Ví dụ:
                  </p>
                  {/* Unlocked US/UK Example Audio Buttons at final hint step */}
                  {audioHintUnlocked && (
                    <div className="inline-flex items-center gap-1.5 animate-fade-up">
                      <button
                        type="button"
                        onClick={() => speakText(current.examples[0].en, { accent: 'en-US', rate: 0.96 })}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 px-2 py-0.5 text-[11px] font-bold text-cyan-300 transition active:scale-95"
                        title="Nghe câu ví dụ giọng Mỹ (US)"
                      >
                        US
                        <Volume2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => speakText(current.examples[0].en, { accent: 'en-GB', rate: 0.96 })}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 text-[11px] font-bold text-amber-300 transition active:scale-95"
                        title="Nghe câu ví dụ giọng Anh (UK)"
                      >
                        UK
                        <Volume2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm sm:text-base font-medium text-white leading-relaxed">
                  {renderMaskedExample(current.examples[0].en, current.word, 'masked')}
                </p>
                {current.examples[0].vi && (
                  <p className="text-xs sm:text-sm italic text-slate-400">
                    {current.examples[0].vi}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-xl rounded-2xl border border-slate-800/90 bg-slate-900/60 px-5 py-3.5 text-center space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gợi ý độ dài từ ({totalLetters} chữ cái)
            </p>
            <p className="font-mono text-base sm:text-lg font-extrabold tracking-[0.28em] text-sky-300">
              {current.word
                .split('')
                .map((ch) => (isMaskSeparator(ch) ? ch : '_'))
                .join(' ')}
            </p>
          </div>
        )}

        {/* 4. Random Progressive Hint Row -> Transforms into Pronounce Button at Final Threshold */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div
            key={hintPopKey}
            className={`rounded-xl border border-slate-700/80 bg-[#0B1120] px-5 py-2.5 font-mono text-base sm:text-lg font-extrabold tracking-[0.22em] text-amber-300 select-none ${
              hintPopKey > 0 ? 'animate-hint-pop' : ''
            }`}
          >
            {hintDisplay}
          </div>

          {audioHintUnlocked ? (
            <button
              type="button"
              onClick={handleHintOrAudioClick}
              className="animate-fade-up inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-400 bg-[#1A1A14] hover:bg-amber-500/20 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.22)] transition active:scale-95"
              title="Nghe phát âm từ mục tiêu mà không làm lộ hết chữ cái"
            >
              <Volume2 className="h-4 w-4 text-amber-400" />
              Phát âm
            </button>
          ) : (
            <button
              type="button"
              onClick={handleHintOrAudioClick}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2.5 text-xs sm:text-sm font-bold text-amber-300 transition active:scale-95"
            >
              <Lightbulb className="h-4 w-4 text-amber-400" />
              Gợi ý ({hintCount}/{maxHintSteps})
            </button>
          )}
        </div>

        {/* 5. Input & Action Buttons */}
        <form onSubmit={handleCheckAnswer} className="w-full max-w-xl space-y-3.5">
          <div key={wrongShakeKey} className={wrongShakeKey > 0 ? 'animate-shake' : ''}>
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                if (wrongFeedback) setWrongFeedback(null);
              }}
              placeholder="Nhập từ tiếng Anh..."
              className={`w-full rounded-2xl border-2 px-4 sm:px-5 py-3.5 text-center text-base sm:text-xl font-bold tracking-wide transition focus:outline-none ${
                wrongFeedback
                  ? 'border-rose-500 bg-rose-500/10 text-white focus:border-rose-400'
                  : 'border-slate-700 bg-[#0B1120] text-white placeholder-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/20'
              }`}
            />
          </div>

          {wrongFeedback && (
            <p className="text-xs sm:text-sm font-semibold text-rose-300">{wrongFeedback}</p>
          )}

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={handleDontKnow}
              className="min-h-[48px] inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-2xl bg-rose-600/90 hover:bg-rose-500 px-3 sm:px-4 py-3 text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white shadow-sm transition active:scale-[0.98]"
            >
              <Ban className="h-4 w-4 shrink-0" />
              KHÔNG BIẾT
            </button>

            <button
              type="submit"
              className="min-h-[48px] inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-3 sm:px-4 py-3 text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white shadow-sm transition active:scale-[0.98]"
            >
              <Check className="h-4 w-4 shrink-0 stroke-[3]" />
              KIỂM TRA ĐÁP ÁN
            </button>
          </div>
        </form>
      </div>

      {/* 6. Card Footer */}
      <div className="border-t border-slate-800/90 bg-slate-950/50 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          Nhóm học <b className="text-slate-200">{topicIndex + 1}/{totalTopics}</b> • Tổng cộng{' '}
          <b className="text-slate-200">{totalDeckWords} thẻ</b> trong bộ thẻ
        </span>
        <span className="hidden sm:inline text-[11px] text-slate-500">
          Mẹo: Nhấn <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 font-mono">Enter</kbd> để kiểm tra • Bấm <b className="text-amber-300">Gợi ý</b> đến bước cuối sẽ mở IPA &amp; phát âm
        </span>
      </div>
      </div>
    </div>
  );
};
