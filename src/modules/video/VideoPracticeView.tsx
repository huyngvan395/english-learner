import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Keyboard,
  Languages,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Subtitles,
  Volume2,
} from 'lucide-react';
import { VideoDetailItem, VideoPracticeMode, VideoSentence, WordPOS } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatVideoDuration, loadVideoDetail } from '../../utils/videoLoader';
import { playCorrect, playFlip, playKeyTick, playSuccess, playWrong } from '../../lib/soundEffects';
import { QuickWordTarget, VocabQuickDetailModal } from '../../components/VocabQuickDetailModal';
import { CEFR_BADGE_STYLES } from './VideoHub';
import { YouTubePlayerBox, YouTubePlayerHandle } from './YouTubePlayerBox';

interface VideoPracticeViewProps {
  videoId: string;
}

const VALID_MODES: VideoPracticeMode[] = ['dictation', 'shadowing', 'quiz', 'subtitles'];

const MODE_TABS: {
  id: VideoPracticeMode;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'dictation', label: 'Dictation', icon: Keyboard },
  { id: 'shadowing', label: 'Shadowing', icon: Mic },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'subtitles', label: 'Subtitles', icon: Subtitles },
];

const SHADOWING_PAUSES = [
  { label: 'Nghỉ 1s', ms: 1000 },
  { label: 'Nghỉ 1.5s', ms: 1500 },
  { label: 'Nghỉ 2s', ms: 2000 },
  { label: 'Nghỉ 3s', ms: 3000 },
];

function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9']/g, '')
    .replace(/^'+|'+$/g, '');
}

function tokenizeSentence(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => normalizeToken(t).length > 0);
}

function evaluateWords(targetText: string, userInput: string) {
  const targetTokens = tokenizeSentence(targetText);
  const userNorms = tokenizeSentence(userInput).map(normalizeToken);

  const states = targetTokens.map((tok, i) => {
    const tNorm = normalizeToken(tok);
    const uNorm = userNorms[i];
    if (uNorm === undefined) {
      return { token: tok, status: 'pending' as const, typed: '' };
    }
    const exactMatch =
      uNorm === tNorm ||
      uNorm.replace(/'/g, '') === tNorm.replace(/'/g, '');
    return {
      token: tok,
      status: exactMatch ? ('correct' as const) : ('wrong' as const),
      typed: uNorm,
    };
  });

  const matchedCount = states.filter((s) => s.status === 'correct').length;
  const allMatched = targetTokens.length > 0 && matchedCount === targetTokens.length && userNorms.length <= targetTokens.length + 1;
  return { states, matchedCount, total: targetTokens.length, allMatched };
}

function evaluateShadowingSpeech(targetText: string, spokenText: string) {
  const targetTokens = tokenizeSentence(targetText);
  const spokenSet = new Set(
    tokenizeSentence(spokenText)
      .map(normalizeToken)
      .map((s) => s.replace(/'/g, ''))
  );
  const results = targetTokens.map((tok) => {
    const norm = normalizeToken(tok).replace(/'/g, '');
    return { token: tok, matched: spokenSet.has(norm) };
  });
  const hitCount = results.filter((r) => r.matched).length;
  const pct = Math.round((hitCount / Math.max(1, targetTokens.length)) * 100);
  return { results, pct };
}

function cleanLookupWord(raw: string): string {
  return raw
    .replace(/^[“”"'(\[{]+|[“”"')\]}.,!?;:—–-]+$/g, '')
    .trim();
}

function mapPos(raw?: string): WordPOS {
  if (raw === 'v' || raw === 'adj' || raw === 'adv' || raw === 'phrase') return raw;
  return 'n';
}

export const VideoPracticeView: React.FC<VideoPracticeViewProps> = ({ videoId }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    videoProgress,
    customVideos,
    markVideoSentenceCompleted,
    setVideoLastSentence,
    recordVideoQuizScore,
    toggleFavoriteVideo,
    saveRelatedVocab,
    isVocabTextSaved,
  } = useApp();

  const rawMode = searchParams.get('mode') as VideoPracticeMode | null;
  const activeMode: VideoPracticeMode =
    rawMode && VALID_MODES.includes(rawMode) ? rawMode : 'dictation';

  const setActiveMode = (mode: VideoPracticeMode) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('mode', mode);
        return next;
      },
      { replace: true }
    );
  };

  const [video, setVideo] = useState<VideoDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<YouTubePlayerHandle | null>(null);
  const dictationInputRef = useRef<HTMLInputElement | null>(null);
  const subtitleRowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Shared active sentence pointer
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [loopSingle, setLoopSingle] = useState(false);

  // Dictation state
  const [dictationInput, setDictationInput] = useState('');
  const [dictationRevealed, setDictationRevealed] = useState(false);
  const [dictationSubmitted, setDictationSubmitted] = useState(false);
  const [revealedWordIndices, setRevealedWordIndices] = useState<number[]>([]);
  const [showDictationVi, setShowDictationVi] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [quickWordTarget, setQuickWordTarget] = useState<QuickWordTarget | null>(null);

  // Shadowing state
  const [shadowPauseMs, setShadowPauseMs] = useState(1500);
  const [showShadowVi, setShowShadowVi] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizFinished, setQuizFinished] = useState(false);

  // Subtitles state
  const [showSubVi, setShowSubVi] = useState(true);
  const [autoScrollSub, setAutoScrollSub] = useState(true);

  // Load video detail JSON
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    loadVideoDetail(videoId, customVideos)
      .then((detail) => {
        if (!mounted) return;
        setVideo(detail);
        const savedProg = videoProgress[detail.id];
        const initialIdx =
          savedProg &&
          savedProg.lastSentenceIndex >= 0 &&
          savedProg.lastSentenceIndex < detail.sentences.length
            ? savedProg.lastSentenceIndex
            : 0;
        setSentenceIdx(initialIdx);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Không thể tải bài học video.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [videoId, customVideos]);

  // Reset per-mode defaults smoothly when switching tabs
  useEffect(() => {
    setLoopSingle(activeMode === 'shadowing');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      setIsRecording(false);
    }
  }, [activeMode]);

  // Persist last studied pointer cleanly
  useEffect(() => {
    if (!video) return;
    setVideoLastSentence(video.id, sentenceIdx, activeMode);
  }, [video?.id, sentenceIdx, activeMode]);

  const sentences = video?.sentences || [];
  const currentSentence: VideoSentence | null = sentences[sentenceIdx] || null;
  const quizItems = video?.quizItems || [];
  const currentQuiz = quizItems[quizIndex] || null;

  const progressRec = video ? videoProgress[video.id] : undefined;
  const completedSet = useMemo(
    () => new Set(progressRec?.completedSentences || []),
    [progressRec?.completedSentences]
  );
  const completedCount = completedSet.size;
  const progressPct = video
    ? Math.min(100, Math.round((completedCount / Math.max(1, video.sentences.length)) * 100))
    : 0;
  const isFav = Boolean(progressRec?.favorite);

  // Determine active playback window for YouTubePlayerBox
  const activeSegment = useMemo(() => {
    if (activeMode === 'quiz' && currentQuiz) {
      return { start: currentQuiz.start, end: currentQuiz.end };
    }
    if (currentSentence) {
      return { start: currentSentence.start, end: currentSentence.end };
    }
    return { start: 0, end: null as number | null };
  }, [activeMode, currentQuiz, currentSentence]);

  const jumpToSentence = useCallback(
    (nextIdx: number, shouldPlay = true) => {
      if (!video || nextIdx < 0 || nextIdx >= video.sentences.length) return;
      setSentenceIdx(nextIdx);
      setDictationInput('');
      setDictationRevealed(false);
      setDictationSubmitted(false);
      setRevealedWordIndices([]);
      setSpokenTranscript('');
      setSpeechError(null);

      const target = video.sentences[nextIdx];
      if (shouldPlay && target) {
        playerRef.current?.playSegment(target.start, activeMode === 'subtitles' ? null : target.end);
      }
      if (activeMode === 'dictation') {
        window.setTimeout(() => dictationInputRef.current?.focus(), 60);
      }
    },
    [video, activeMode]
  );

  const handleReplayCurrent = useCallback(() => {
    if (activeMode === 'quiz' && currentQuiz) {
      playerRef.current?.playSegment(currentQuiz.start, currentQuiz.end);
      return;
    }
    if (currentSentence) {
      playerRef.current?.playSegment(
        currentSentence.start,
        activeMode === 'subtitles' ? null : currentSentence.end
      );
    }
  }, [activeMode, currentQuiz, currentSentence]);

  const handlePrev = useCallback(() => {
    if (activeMode === 'quiz') {
      if (quizIndex > 0) {
        const nextIdx = quizIndex - 1;
        setQuizIndex(nextIdx);
        const q = quizItems[nextIdx];
        if (q) playerRef.current?.playSegment(q.start, q.end);
      }
      return;
    }
    jumpToSentence(sentenceIdx - 1, true);
  }, [activeMode, quizIndex, quizItems, jumpToSentence, sentenceIdx]);

  const handleNext = useCallback(() => {
    if (activeMode === 'quiz') {
      if (quizIndex + 1 < quizItems.length) {
        const nextIdx = quizIndex + 1;
        setQuizIndex(nextIdx);
        const q = quizItems[nextIdx];
        if (q) playerRef.current?.playSegment(q.start, q.end);
      }
      return;
    }
    jumpToSentence(sentenceIdx + 1, true);
  }, [activeMode, quizIndex, quizItems, jumpToSentence, sentenceIdx]);

  // Live subtitle time sync in Subtitles mode
  const handlePlayerTimeUpdate = useCallback(
    (timeSec: number) => {
      if (activeMode !== 'subtitles' || sentences.length === 0) return;
      const foundIdx = sentences.findIndex((s) => timeSec >= s.start - 0.1 && timeSec <= s.end + 0.15);
      if (foundIdx !== -1 && foundIdx !== sentenceIdx) {
        setSentenceIdx(foundIdx);
        if (autoScrollSub) {
          subtitleRowRefs.current[foundIdx]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }
    },
    [activeMode, sentences, sentenceIdx, autoScrollSub]
  );

  // ================= DICTATION LOGIC =================
  const dictationEval = useMemo(() => {
    if (!currentSentence) return { states: [], matchedCount: 0, total: 0, allMatched: false };
    return evaluateWords(currentSentence.textEn, dictationInput);
  }, [currentSentence, dictationInput]);

  const revealedWordSet = useMemo(() => new Set(revealedWordIndices), [revealedWordIndices]);

  const isAllSlotsSolved = useCallback(
    (evalStates: ReturnType<typeof evaluateWords>['states'], revealedSet: Set<number>) => {
      return (
        evalStates.length > 0 &&
        evalStates.every((st, idx) => st.status === 'correct' || revealedSet.has(idx))
      );
    },
    []
  );

  // Auto-complete dictation as soon as all words match accurately (or combined with revealed words)
  const handleDictationInputChange = (val: string) => {
    setDictationInput(val);
    if (!video || !currentSentence || dictationRevealed) return;
    const ev = evaluateWords(currentSentence.textEn, val);
    if (ev.allMatched || isAllSlotsSolved(ev.states, revealedWordSet)) {
      playCorrect();
      setDictationRevealed(true);
      setDictationSubmitted(true);
      markVideoSentenceCompleted(video.id, currentSentence.index, video.sentences.length, 'dictation');
      if (autoAdvance && sentenceIdx + 1 < video.sentences.length) {
        window.setTimeout(() => {
          jumpToSentence(sentenceIdx + 1, true);
        }, 700);
      }
    }
  };

  const handleDictationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!video || !currentSentence) return;

    if (dictationRevealed) {
      if (sentenceIdx + 1 < video.sentences.length) {
        jumpToSentence(sentenceIdx + 1, true);
      }
      return;
    }

    setDictationSubmitted(true);
    if (dictationEval.allMatched || isAllSlotsSolved(dictationEval.states, revealedWordSet)) {
      playCorrect();
      setDictationRevealed(true);
      markVideoSentenceCompleted(video.id, currentSentence.index, video.sentences.length, 'dictation');
      if (autoAdvance && sentenceIdx + 1 < video.sentences.length) {
        window.setTimeout(() => jumpToSentence(sentenceIdx + 1, true), 650);
      }
    } else {
      playWrong();
      dictationInputRef.current?.focus();
    }
  };

  const handleRevealSingleSlot = (targetIdx: number, syncInputPrefix = false) => {
    if (!video || !currentSentence || dictationRevealed) return;
    const targetState = dictationEval.states[targetIdx];
    if (!targetState) return;

    const nextRevealedList = revealedWordSet.has(targetIdx)
      ? revealedWordIndices
      : [...revealedWordIndices, targetIdx];
    const nextRevealedSet = new Set(nextRevealedList);

    playFlip();
    setRevealedWordIndices(nextRevealedList);

    let nextInput = dictationInput;
    if (syncInputPrefix) {
      // Fill/correct up to targetIdx smoothly so user can continue typing from targetIdx + 1
      const currentWords = tokenizeSentence(dictationInput);
      const rebuilt: string[] = [];
      for (let i = 0; i <= targetIdx; i += 1) {
        const st = dictationEval.states[i];
        if (!st) break;
        if (i === targetIdx || st.status === 'correct' || nextRevealedSet.has(i)) {
          rebuilt.push(cleanLookupWord(st.token) || st.token);
        } else {
          rebuilt.push(currentWords[i] || cleanLookupWord(st.token) || st.token);
        }
      }
      for (let j = targetIdx + 1; j < currentWords.length; j += 1) {
        rebuilt.push(currentWords[j]);
      }
      nextInput = rebuilt.join(' ') + (targetIdx >= currentWords.length - 1 ? ' ' : '');
      setDictationInput(nextInput);
    }

    const reEval = evaluateWords(currentSentence.textEn, nextInput);
    if (reEval.allMatched || isAllSlotsSolved(reEval.states, nextRevealedSet)) {
      setDictationRevealed(true);
      setDictationSubmitted(true);
      markVideoSentenceCompleted(video.id, currentSentence.index, video.sentences.length, 'dictation');
    } else {
      dictationInputRef.current?.focus();
    }
  };

  const handleRevealNextWord = () => {
    if (!currentSentence || dictationRevealed) return;
    const nextIdx = dictationEval.states.findIndex(
      (st, idx) => st.status !== 'correct' && !revealedWordSet.has(idx)
    );
    if (nextIdx === -1) return;
    handleRevealSingleSlot(nextIdx, true);
  };

  const handleRevealSentence = () => {
    if (!video || !currentSentence) return;
    playFlip();
    setDictationInput(currentSentence.textEn);
    setRevealedWordIndices(dictationEval.states.map((_, idx) => idx));
    setDictationRevealed(true);
    setDictationSubmitted(true);
    markVideoSentenceCompleted(video.id, currentSentence.index, video.sentences.length, 'dictation');
  };

  const handleLookupDictationWord = (rawToken: string) => {
    const cleaned = cleanLookupWord(rawToken);
    if (!cleaned) return;
    setQuickWordTarget({ word: cleaned });
  };

  // ================= SHADOWING WEB SPEECH API =================
  const shadowingEval = useMemo(() => {
    if (!currentSentence || !spokenTranscript.trim()) return null;
    return evaluateShadowingSpeech(currentSentence.textEn, spokenTranscript);
  }, [currentSentence, spokenTranscript]);

  const handleToggleSpeechRecognition = () => {
    setSpeechError(null);
    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      setIsRecording(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechError('Trình duyệt hiện tại chưa hỗ trợ Web Speech API (khuyên dùng Chrome/Edge).');
      return;
    }

    playerRef.current?.pause();
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsRecording(true);
      setSpokenTranscript('');
    };
    rec.onresult = (event: any) => {
      let full = '';
      for (let i = 0; i < event.results.length; i += 1) {
        full += event.results[i][0].transcript + ' ';
      }
      const trimmed = full.trim();
      setSpokenTranscript(trimmed);

      const isFinal = event.results[event.results.length - 1]?.isFinal;
      if (isFinal && video && currentSentence) {
        const res = evaluateShadowingSpeech(currentSentence.textEn, trimmed);
        if (res.pct >= 75) {
          playCorrect();
          markVideoSentenceCompleted(video.id, currentSentence.index, video.sentences.length, 'shadowing');
        } else {
          playWrong();
        }
      }
    };
    rec.onerror = (event: any) => {
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        setSpeechError('Vui lòng cấp quyền Micro cho trình duyệt để kiểm tra phát âm.');
      } else if (event.error !== 'no-speech') {
        setSpeechError(`Không nhận diện được giọng nói (${event.error}). Hãy thử lại.`);
      }
    };
    rec.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setIsRecording(false);
    }
  };

  // ================= QUIZ LOGIC =================
  const handleSelectQuizOption = (option: string) => {
    if (!video || !currentQuiz || quizAnswers[currentQuiz.id]) return;
    const ok = option.toLowerCase() === currentQuiz.answer.toLowerCase();
    if (ok) playCorrect();
    else playWrong();

    const nextAnswers = { ...quizAnswers, [currentQuiz.id]: option };
    setQuizAnswers(nextAnswers);

    if (Object.keys(nextAnswers).length === quizItems.length) {
      const score = quizItems.filter(
        (q) => (nextAnswers[q.id] || '').toLowerCase() === q.answer.toLowerCase()
      ).length;
      recordVideoQuizScore(video.id, score, quizItems.length);
      setQuizFinished(true);
      window.setTimeout(() => playSuccess(), 350);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 flex items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        Đang tải bài học video &amp; phụ đề song ngữ...
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="rounded-3xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 p-8 text-center space-y-3">
        <p className="text-sm font-bold text-rose-700 dark:text-rose-200">
          {error || 'Không tìm thấy bài học video này.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/videos')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Kho Video
        </button>
      </div>
    );
  }

  const currentDurSec = currentSentence
    ? Math.max(1, Math.round(currentSentence.end - currentSentence.start))
    : 0;

  return (
    <div className="space-y-4">
      {/* ================= TOP HEADER BAR ================= */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3.5 sm:px-5 py-3.5 shadow-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate('/videos')}
              className="shrink-0 min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 hover:border-indigo-400 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Video
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                    CEFR_BADGE_STYLES[video.level]
                  }`}
                >
                  {video.level}
                </span>
                <h2 className="truncate text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  {video.titleEn}
                </h2>
              </div>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {video.channel} · {video.wpm} WPM · {video.topic}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleFavoriteVideo(video.id)}
            className={`shrink-0 min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              isFav
                ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-200'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span className="hidden sm:inline">{isFav ? 'Đã lưu' : 'Lưu video'}</span>
          </button>
        </div>

        {/* 4 Practice Mode Tabs (single-row horizontal scroll on Mobile) */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {MODE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMode(tab.id)}
                className={`shrink-0 min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/85 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.id === 'quiz' && quizItems.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      active ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    {quizItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= 2-COLUMN WORKSPACE (Sticky Video Left, Interactive Panel Right) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        {/* LEFT COLUMN: Sticky Custom YouTube Player + Overall Progress */}
        <div className="lg:col-span-5 sticky top-14 md:top-16 lg:top-20 z-20 space-y-3">
          <YouTubePlayerBox
            ref={playerRef}
            youtubeId={video.youtubeId}
            durationSec={video.durationSec}
            segmentStart={activeSegment.start}
            segmentEnd={activeMode === 'subtitles' ? null : activeSegment.end}
            autoStopAtSegmentEnd={activeMode !== 'subtitles'}
            loopSegment={loopSingle}
            onToggleLoop={() => setLoopSingle((v) => !v)}
            loopPauseMs={activeMode === 'shadowing' ? shadowPauseMs : 0}
            onPrevSentence={handlePrev}
            onNextSentence={handleNext}
            onReplaySentence={handleReplayCurrent}
            canPrev={activeMode === 'quiz' ? quizIndex > 0 : sentenceIdx > 0}
            canNext={
              activeMode === 'quiz'
                ? quizIndex + 1 < quizItems.length
                : sentenceIdx + 1 < sentences.length
            }
            onTimeUpdate={handlePlayerTimeUpdate}
            sentenceLabel={
              activeMode === 'quiz'
                ? `Quiz ${quizIndex + 1}/${quizItems.length}`
                : `Câu ${sentenceIdx + 1}/${sentences.length}`
            }
          />

          {/* Compact Progress Bar */}
          <div className="hidden sm:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-3 space-y-1.5 shadow-card">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-300">
                Tiến độ: <b className="text-slate-900 dark:text-white">{completedCount}/{sentences.length} câu đã chép</b>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{progressPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE PRACTICE MODE */}
        <div className="lg:col-span-7 min-w-0 space-y-4">
          {/* ================= MODE 1: DICTATION ================= */}
          {activeMode === 'dictation' && currentSentence && (
            <div className="space-y-4">
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-card space-y-4">
                {/* Sentence Header & Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-lg bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-400/35 px-2.5 py-1 text-xs font-extrabold text-indigo-800 dark:text-indigo-200">
                      Câu {sentenceIdx + 1}/{sentences.length}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {currentSentence.wordCount} từ · {currentDurSec} giây
                    </span>
                    {completedSet.has(currentSentence.index) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Đã chép
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={autoAdvance}
                        onChange={(e) => setAutoAdvance(e.target.checked)}
                        className="h-4 w-4 accent-indigo-600 rounded"
                      />
                      Tự sang câu
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowDictationVi((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                    >
                      {showDictationVi ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      Dịch Việt
                    </button>
                  </div>
                </div>

                {/* Word-by-Word Live Grading & Interactive Reveal Slots */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120]/80 p-3.5 sm:p-4 space-y-2.5">
                  <div className="flex flex-wrap gap-1.5 leading-relaxed">
                    {dictationEval.states.map((st, idx) => {
                      const isIndividuallyRevealed = revealedWordSet.has(idx);
                      if (dictationRevealed || st.status === 'correct') {
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleLookupDictationWord(st.token)}
                            title="Bấm để tra nghĩa chi tiết & lưu vào Từ vựng của tôi"
                            className="rounded-lg border border-emerald-300 dark:border-emerald-500/45 bg-emerald-100/80 dark:bg-emerald-500/20 hover:border-emerald-500 hover:brightness-105 px-2.5 py-1 text-sm font-extrabold text-emerald-800 dark:text-emerald-200 transition active:scale-95 cursor-pointer"
                          >
                            {st.token}
                          </button>
                        );
                      }
                      if (isIndividuallyRevealed) {
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleLookupDictationWord(st.token)}
                            title="Từ đã hé lộ — bấm để tra nghĩa & lưu vào Từ vựng của tôi"
                            className="animate-hint-pop rounded-lg border border-sky-400 dark:border-sky-400/60 bg-sky-100 dark:bg-sky-500/20 hover:border-indigo-500 px-2.5 py-1 text-sm font-extrabold text-sky-900 dark:text-sky-200 transition active:scale-95 cursor-pointer"
                          >
                            {st.token}
                          </button>
                        );
                      }
                      if (st.status === 'wrong') {
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleRevealSingleSlot(idx, false)}
                            title="Đang gõ chưa khớp — bấm để hé lộ riêng từ này"
                            className="rounded-lg border border-rose-300 dark:border-rose-500/50 bg-rose-100/80 dark:bg-rose-500/20 hover:border-amber-400 px-2.5 py-1 text-sm font-bold text-rose-700 dark:text-rose-200 transition active:scale-95 cursor-pointer"
                          >
                            {st.typed || '___'}
                          </button>
                        );
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleRevealSingleSlot(idx, false)}
                          title="Bấm để mở riêng từ này"
                          className={`rounded-lg border px-2.5 py-1 text-xs font-mono font-bold select-none transition active:scale-95 cursor-pointer ${
                            dictationSubmitted
                              ? 'border-amber-300 dark:border-amber-500/45 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:border-amber-500'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-500 dark:hover:text-sky-300'
                          }`}
                        >
                          {'_'.repeat(Math.min(8, Math.max(3, normalizeToken(st.token).length)))}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mẹo: Bấm trực tiếp vào ô gạch <span className="font-mono font-bold">_____</span> để mở riêng từ đó · Bấm vào từ đã mở để tra nghĩa &amp; lưu SRS.
                  </p>

                  {showDictationVi && (
                    <p className="pt-2.5 border-t border-slate-200 dark:border-slate-800 text-xs sm:text-sm italic text-slate-600 dark:text-slate-400">
                      <Languages className="inline h-3.5 w-3.5 mr-1 text-cyan-500" />
                      {currentSentence.textVi}
                    </p>
                  )}
                </div>

                {/* Typing Form */}
                <form onSubmit={handleDictationSubmit} className="space-y-3">
                  <input
                    ref={dictationInputRef}
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={dictationInput}
                    onKeyDown={(e) => {
                      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
                        playKeyTick();
                      }
                    }}
                    onChange={(e) => handleDictationInputChange(e.target.value)}
                    placeholder="Nghe câu hiện tại và gõ lại tiếng Anh..."
                    className={`w-full rounded-2xl border-2 px-4 py-3 text-base font-semibold transition focus:outline-none ${
                      dictationRevealed
                        ? 'border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100'
                        : dictationSubmitted && !dictationEval.allMatched
                        ? 'border-rose-400 bg-rose-50/60 dark:bg-rose-950/25 text-slate-900 dark:text-white'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white focus:border-indigo-500'
                    }`}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleReplayCurrent}
                        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition active:scale-95"
                      >
                        <Volume2 className="h-4 w-4 text-cyan-500" />
                        Nghe lại
                      </button>

                      <button
                        type="button"
                        disabled={dictationRevealed}
                        onClick={handleRevealNextWord}
                        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-sky-300 dark:border-sky-500/45 bg-sky-50 dark:bg-sky-500/15 disabled:opacity-40 px-3 py-2 text-xs font-bold text-sky-800 dark:text-sky-200 hover:brightness-105 transition active:scale-95"
                      >
                        <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                        Hiện 1 từ
                      </button>

                      <button
                        type="button"
                        onClick={handleRevealSentence}
                        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-500/45 bg-amber-50 dark:bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-200 hover:brightness-105 transition active:scale-95"
                      >
                        <Eye className="h-4 w-4" />
                        Hiện cả câu
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:brightness-110 transition active:scale-95"
                    >
                      {dictationRevealed ? (
                        <>
                          Câu tiếp theo
                          <ArrowRight className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 stroke-[3]" />
                          Kiểm tra ({dictationEval.states.filter((s, idx) => s.status === 'correct' || revealedWordSet.has(idx)).length}/{dictationEval.total})
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Masked / Revealed Dictation Progress List */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-card space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 dark:text-slate-200">
                  <span>Danh sách câu ({completedCount}/{sentences.length} đã mở khóa)</span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Câu chưa chép sẽ được che mờ
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {sentences.map((s) => {
                    const isCurrent = s.index === sentenceIdx;
                    const isDone = completedSet.has(s.index);
                    return (
                      <button
                        key={s.index}
                        type="button"
                        onClick={() => jumpToSentence(s.index, true)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          isCurrent
                            ? 'border-indigo-400 bg-indigo-50/90 dark:border-indigo-400/60 dark:bg-indigo-500/15 ring-1 ring-indigo-300 dark:ring-indigo-400/30'
                            : isDone
                            ? 'border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-950/15 hover:border-emerald-400'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                          <span className="font-mono font-bold text-slate-500 dark:text-slate-400">
                            #{s.index + 1} · {formatVideoDuration(s.start)}
                          </span>
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã chép
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              {s.wordCount} từ
                            </span>
                          )}
                        </div>

                        {isDone ? (
                          <div className="space-y-0.5">
                            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                              {s.textEn}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {s.textVi}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5 py-0.5">
                            <div className="h-2.5 w-4/5 rounded-full bg-slate-200 dark:bg-slate-800" />
                            <div className="h-2 w-1/2 rounded-full bg-slate-200/70 dark:bg-slate-800/60" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= MODE 2: SHADOWING ================= */}
          {activeMode === 'shadowing' && currentSentence && (
            <div className="space-y-4">
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#111827] p-4 sm:p-6 shadow-card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/35 px-2.5 py-1 text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                      Shadowing • Câu {sentenceIdx + 1}/{sentences.length}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {formatVideoDuration(currentSentence.start)} – {formatVideoDuration(currentSentence.end)}
                    </span>
                  </div>

                  {/* Loop Pause Gap Selector */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {SHADOWING_PAUSES.map((p) => (
                      <button
                        key={p.ms}
                        type="button"
                        onClick={() => setShadowPauseMs(p.ms)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                          shadowPauseMs === p.ms
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Shadowing Target Sentence */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120]/85 p-5 space-y-3">
                  <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white leading-relaxed">
                    {currentSentence.textEn}
                  </p>
                  {showShadowVi && (
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 italic border-t border-slate-200 dark:border-slate-800 pt-2.5">
                      {currentSentence.textVi}
                    </p>
                  )}
                </div>

                {/* Action Row: Replay + Record Speech API + Toggle Vi */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReplayCurrent}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:brightness-110 transition active:scale-95"
                    >
                      <Play className="h-4 w-4 fill-white" />
                      Phát &amp; Lặp câu
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleSpeechRecognition}
                      className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-extrabold transition active:scale-95 ${
                        isRecording
                          ? 'border-rose-500 bg-rose-600 text-white animate-pulse shadow-glow'
                          : 'border-emerald-300 dark:border-emerald-500/45 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 hover:brightness-105'
                      }`}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isRecording ? 'Đang nghe... (Bấm dừng)' : 'Ghi âm & Chấm phát âm'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowShadowVi((v) => !v)}
                    className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"
                  >
                    {showShadowVi ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showShadowVi ? 'Ẩn dịch Việt' : 'Hiện dịch Việt'}
                  </button>
                </div>

                {speechError && (
                  <p className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
                    {speechError}
                  </p>
                )}

                {/* Pronunciation Match Feedback */}
                {shadowingEval && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/70 p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                        Kết quả nhận diện giọng nói:
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                          shadowingEval.pct >= 75
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                        }`}
                      >
                        Khớp {shadowingEval.pct}%
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {shadowingEval.results.map((r, i) => (
                        <span
                          key={i}
                          className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                            r.matched
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                          }`}
                        >
                          {r.token}
                        </span>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Bạn vừa đọc: <span className="italic">&ldquo;{spokenTranscript}&rdquo;</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Sentence Picker */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-card space-y-2">
                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                  Chọn nhanh câu luyện nói ({sentences.length} câu):
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {sentences.map((s) => (
                    <button
                      key={s.index}
                      type="button"
                      onClick={() => jumpToSentence(s.index, true)}
                      className={`h-8 min-w-[36px] rounded-lg px-2 text-xs font-bold transition ${
                        s.index === sentenceIdx
                          ? 'bg-indigo-600 text-white'
                          : completedSet.has(s.index)
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {s.index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= MODE 3: QUIZ ================= */}
          {activeMode === 'quiz' && (
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#111827] p-4 sm:p-6 shadow-card space-y-5">
              {quizItems.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                  Video này chưa có câu hỏi Quiz tự động. Hãy chuyển sang chế độ Dictation hoặc Subtitles!
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-400/35 px-2.5 py-1 text-xs font-extrabold text-amber-800 dark:text-amber-200">
                        Câu hỏi {quizIndex + 1}/{quizItems.length}
                      </span>
                      {currentQuiz?.cefr && (
                        <span className="rounded-md bg-indigo-50 dark:bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          Từ khóa {currentQuiz.cefr}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (currentQuiz) {
                          playerRef.current?.playSegment(currentQuiz.start, currentQuiz.end);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-400/35 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-200 hover:brightness-105 transition"
                    >
                      <Volume2 className="h-4 w-4" />
                      Nghe đoạn câu hỏi
                    </button>
                  </div>

                  {currentQuiz && (() => {
                    const chosen = quizAnswers[currentQuiz.id];
                    const isAnswered = Boolean(chosen);
                    const isSaved = isVocabTextSaved(currentQuiz.answer);
                    const letters = ['A', 'B', 'C', 'D'];

                    return (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120]/85 p-4 sm:p-5">
                          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
                            {currentQuiz.prompt.split('____').map((part, idx, arr) => (
                              <React.Fragment key={idx}>
                                {part}
                                {idx < arr.length - 1 && (
                                  <span
                                    className={`inline-block mx-1 rounded-lg px-2.5 py-0.5 font-extrabold ${
                                      isAnswered
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-200 border border-emerald-400/50'
                                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200 border border-dashed border-indigo-400'
                                    }`}
                                  >
                                    {isAnswered ? currentQuiz.answer : '______'}
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {currentQuiz.options.map((opt, oi) => {
                            const isSelected = chosen === opt;
                            const isCorrectOpt = opt.toLowerCase() === currentQuiz.answer.toLowerCase();
                            let cls =
                              'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/75 text-slate-800 dark:text-slate-100 hover:border-indigo-400';
                            if (isAnswered) {
                              if (isCorrectOpt) {
                                cls =
                                  'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100';
                              } else if (isSelected) {
                                cls =
                                  'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100';
                              } else {
                                cls =
                                  'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400';
                              }
                            }

                            return (
                              <button
                                key={opt}
                                type="button"
                                disabled={isAnswered}
                                onClick={() => handleSelectQuizOption(opt)}
                                className={`min-h-[48px] flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm font-bold transition active:scale-[0.98] ${cls}`}
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-extrabold">
                                  {letters[oi] || oi + 1}
                                </span>
                                <span className="truncate">{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Explanation + Save to My Vocab */}
                        {isAnswered && (
                          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/35 bg-indigo-50/70 dark:bg-indigo-950/25 p-4 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-base font-extrabold text-indigo-800 dark:text-sky-300">
                                    {currentQuiz.answer}
                                  </span>
                                  {currentQuiz.ipa && (
                                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                                      {currentQuiz.ipa}
                                    </span>
                                  )}
                                  <span className="rounded bg-indigo-100 dark:bg-indigo-500/25 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-200">
                                    {currentQuiz.pos}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                                  {currentQuiz.meaningVi}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  saveRelatedVocab({
                                    word: currentQuiz.answer,
                                    pos: mapPos(currentQuiz.pos),
                                    ipaUS: currentQuiz.ipa,
                                    ipaUK: currentQuiz.ipa,
                                    meaning: currentQuiz.meaningVi,
                                    deckId: 'listening-saved',
                                    examples: [
                                      {
                                        en: currentQuiz.prompt.replace('____', currentQuiz.answer),
                                        vi: currentQuiz.sentenceVi,
                                      },
                                    ],
                                  })
                                }
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                                  isSaved
                                    ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-200'
                                    : 'border-indigo-300 dark:border-indigo-400/40 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-200 hover:brightness-105'
                                }`}
                              >
                                <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-amber-500 text-amber-500' : ''}`} />
                                {isSaved ? 'Đã lưu SRS' : 'Lưu vào Từ vựng của tôi'}
                              </button>
                            </div>

                            <p className="text-xs sm:text-sm italic text-slate-600 dark:text-slate-300 border-t border-indigo-200/80 dark:border-indigo-500/20 pt-2">
                              {currentQuiz.sentenceVi}
                            </p>
                          </div>
                        )}

                        {/* Quiz Navigation */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            disabled={quizIndex === 0}
                            onClick={handlePrev}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-35 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
                          >
                            ← Câu trước
                          </button>

                          {quizFinished ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                                <Sparkles className="h-4 w-4" />
                                Điểm:{' '}
                                {
                                  quizItems.filter(
                                    (q) =>
                                      (quizAnswers[q.id] || '').toLowerCase() ===
                                      q.answer.toLowerCase()
                                  ).length
                                }
                                /{quizItems.length}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuizAnswers({});
                                  setQuizIndex(0);
                                  setQuizFinished(false);
                                }}
                                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Làm lại
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={quizIndex + 1 >= quizItems.length}
                              onClick={handleNext}
                              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-35 px-4 py-2 text-xs font-extrabold text-white"
                            >
                              Câu tiếp →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* ================= MODE 4: INTERACTIVE SUBTITLES ================= */}
          {activeMode === 'subtitles' && (
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-card space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Phụ đề song ngữ tương tác ({sentences.length} câu)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Bấm bất kỳ câu nào để nhảy tới mốc thời gian · Bôi đen từ tiếng Anh để tra nghĩa &amp; lưu SRS
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoScrollSub}
                      onChange={(e) => setAutoScrollSub(e.target.checked)}
                      className="h-4 w-4 accent-indigo-600 rounded"
                    />
                    Tự cuộn
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSubVi((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                  >
                    <Languages className="h-3.5 w-3.5 text-cyan-500" />
                    {showSubVi ? 'Ẩn dịch Việt' : 'Hiện dịch Việt'}
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[68dvh] overflow-y-auto pr-1">
                {sentences.map((s) => {
                  const isActive = s.index === sentenceIdx;
                  return (
                    <div
                      key={s.index}
                      ref={(el) => {
                        subtitleRowRefs.current[s.index] = el;
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (window.getSelection()?.toString().trim()) return;
                        setSentenceIdx(s.index);
                        playerRef.current?.seekTo(s.start, true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setSentenceIdx(s.index);
                          playerRef.current?.seekTo(s.start, true);
                        }
                      }}
                      className={`w-full cursor-pointer rounded-2xl border p-3.5 text-left transition select-text ${
                        isActive
                          ? 'border-indigo-400 bg-indigo-50/90 dark:border-indigo-400/60 dark:bg-indigo-500/15 shadow-sm'
                          : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-indigo-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 shrink-0 rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold select-none ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {formatVideoDuration(s.start)}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p
                            className={`text-sm sm:text-[15px] leading-relaxed ${
                              isActive
                                ? 'font-bold text-indigo-950 dark:text-white'
                                : 'font-medium text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {s.textEn}
                          </p>
                          {showSubVi && (
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                              {s.textVi}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <VocabQuickDetailModal
        target={quickWordTarget}
        onClose={() => setQuickWordTarget(null)}
        onSelectAnotherWord={(next) => setQuickWordTarget(next)}
      />
    </div>
  );
};
