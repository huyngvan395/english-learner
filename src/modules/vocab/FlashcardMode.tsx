import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  RotateCcw,
  Star,
  Volume2,
  XCircle,
} from 'lucide-react';
import { MasteryStatus, VocabWord } from '../../types';
import { useApp } from '../../context/AppContext';
import { AccentType, playWordAudio, speakText } from '../../utils/speech';
import { QuickNoteBox } from '../../components/QuickNoteBox';
import { VocabExtensionBlock } from '../../components/VocabExtensionBlock';

interface FlashcardModeProps {
  words: VocabWord[];
  deckTitle: string;
}

function highlightKeyword(sentence: string, keyword: string): React.ReactNode {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const root = escaped.length > 5 ? escaped.slice(0, -1) : escaped;
  const regex = new RegExp(`(${root}[a-zA-Z]*)`, 'gi');
  const parts = sentence.split(regex);
  return parts.map((part, idx) =>
    regex.test(part) ? (
      <span key={idx} className="font-bold text-cyan-300 underline decoration-cyan-400/60 underline-offset-2">
        {part}
      </span>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export const FlashcardMode: React.FC<FlashcardModeProps> = ({ words, deckTitle }) => {
  const { vocabProgress, markWordStatus, toggleSaveWord, isWordSaved } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  // Prioritize unmastered/forgotten words first using SRS state
  const initialQueue = useMemo(() => {
    const priority: Record<MasteryStatus, number> = {
      forgotten: 0,
      vague: 1,
      new: 2,
      mastered: 3,
    };
    return [...words].sort((a, b) => {
      const sa = vocabProgress[a.id]?.status || 'new';
      const sb = vocabProgress[b.id]?.status || 'new';
      return priority[sa] - priority[sb];
    });
  }, [words]);

  const [queue, setQueue] = useState<VocabWord[]>(initialQueue);
  const [index, setIndex] = useState(() => {
    const raw = Number(searchParams.get('card') || '1');
    if (Number.isFinite(raw) && raw >= 1 && raw <= initialQueue.length) {
      return raw - 1;
    }
    return 0;
  });
  const [flipped, setFlipped] = useState(false);
  const [accent, setAccent] = useState<AccentType>('en-US');
  const [speed, setSpeed] = useState<number>(1.0);
  const [requeueToast, setRequeueToast] = useState<string | null>(null);

  // Sync ?card=<1-based> in URL so F5 keeps the exact flashcard
  useEffect(() => {
    if (queue.length === 0) return;
    const desired = String(Math.min(index, queue.length - 1) + 1);
    if (searchParams.get('card') !== desired) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('card', desired);
          return next;
        },
        { replace: true }
      );
    }
  }, [index, queue.length]);

  const current = queue[index] || queue[0];

  if (!current) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-8 text-center text-slate-400">
        Chưa có từ vựng nào trong bộ thẻ này.
      </div>
    );
  }

  const saved = isWordSaved(current.id);
  const currentStatus = vocabProgress[current.id]?.status || 'new';

  const handlePlay = (text: string, overrideAccent?: AccentType) => {
    const targetAccent = overrideAccent || accent;
    if (text === current.word) {
      const audioUrl = targetAccent === 'en-GB' ? current.audioUrlUK || current.audioUrlUS : current.audioUrlUS || current.audioUrlUK;
      playWordAudio(text, { accent: targetAccent, rate: speed, audioUrl });
      return;
    }
    speakText(text, { accent: targetAccent, rate: speed });
  };

  const handleRate = (status: MasteryStatus) => {
    markWordStatus(current.id, status);
    setFlipped(false);

    // Spaced repetition inside current session: re-insert forgotten/vague cards 2-3 positions ahead
    if (status === 'forgotten' || status === 'vague') {
      const offset = status === 'forgotten' ? 2 : 4;
      setQueue((prev) => {
        const next = [...prev];
        const insertAt = Math.min(next.length, index + 1 + offset);
        next.splice(insertAt, 0, current);
        return next;
      });
      setRequeueToast(
        status === 'forgotten'
          ? `SRS: "${current.word}" sẽ lặp lại sau 2 thẻ để củng cố trí nhớ!`
          : `SRS: "${current.word}" sẽ lặp lại sớm trong phiên ôn này.`
      );
      window.setTimeout(() => setRequeueToast(null), 2600);
    }

    if (index + 1 < queue.length) {
      setIndex((i) => i + 1);
    } else {
      setIndex(0);
    }
  };

  const statusBadge = {
    new: { label: 'Từ mới', cls: 'bg-slate-700/80 text-slate-300' },
    forgotten: { label: 'Chưa nhớ (SRS)', cls: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' },
    vague: { label: 'Mơ hồ (SRS)', cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
    mastered: { label: 'Đã thuộc', cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
  }[currentStatus];

  return (
    <div className="space-y-5">
      {/* Controls bar: Accent, Speed, Progress */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Thẻ:</span>
          <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300">
            {index + 1} / {queue.length}
          </span>
          <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* US / UK selector */}
          <div className="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700">
            {(['en-US', 'en-GB'] as AccentType[]).map((ac) => (
              <button
                key={ac}
                type="button"
                onClick={() => setAccent(ac)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  accent === ac ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ac === 'en-US' ? 'Giọng US' : 'Giọng UK'}
              </button>
            ))}
          </div>

          {/* 0.75x / 1.0x speed selector */}
          <div className="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700">
            {[0.75, 1.0].map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setSpeed(sp)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  speed === sp ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setQueue(initialQueue);
              setIndex(0);
              setFlipped(false);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
            title="Học lại từ đầu"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {requeueToast && (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-4 py-2.5 text-xs font-semibold text-indigo-200">
          {requeueToast}
        </div>
      )}

      {/* 3D Flip Card */}
      <div className="perspective-1200 w-full">
        <div
          onClick={() => setFlipped((f) => !f)}
          className={`relative w-full min-h-[380px] sm:min-h-[420px] cursor-pointer transition-transform duration-500 preserve-3d ${
            flipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* FRONT SIDE */}
          <div className="absolute inset-0 backface-hidden rounded-3xl border border-slate-700/80 bg-gradient-to-br from-[#1E293B] via-[#172135] to-[#0F172A] p-4 sm:p-10 shadow-card flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                {current.pos}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSaveWord(current.id);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  saved
                    ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-amber-400/40 hover:text-amber-300'
                }`}
              >
                <Star className={`h-4 w-4 ${saved ? 'fill-amber-400 text-amber-400' : ''}`} />
                {saved ? 'Đã lưu' : 'Lưu từ'}
              </button>
            </div>

            <div className="my-auto py-6 sm:py-8 text-center">
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white break-words">
                {current.word}
              </h2>

              <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlay(current.word, 'en-US');
                  }}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/25 px-3.5 sm:px-4 py-2 text-xs sm:text-sm text-cyan-200 transition"
                >
                  <Volume2 className="h-4 w-4 text-cyan-400" />
                  <span className="font-bold">US</span>
                  <span className="font-mono text-xs sm:text-sm">{current.ipaUS}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlay(current.word, 'en-GB');
                  }}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/25 px-3.5 sm:px-4 py-2 text-xs sm:text-sm text-amber-200 transition"
                >
                  <Volume2 className="h-4 w-4 text-amber-400" />
                  <span className="font-bold">UK</span>
                  <span className="font-mono text-xs sm:text-sm">{current.ipaUK}</span>
                </button>
              </div>
            </div>

            <div className="text-center text-xs font-medium text-slate-400">
              Nhấn vào thẻ để lật xem nghĩa tiếng Việt, ví dụ, Word Family, Paraphrase & Collocations
            </div>
          </div>

          {/* BACK SIDE */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl border border-indigo-500/40 bg-gradient-to-br from-[#1E293B] via-[#131C31] to-[#0B1120] p-4 sm:p-7 shadow-card overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-700/70 pb-3.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-2xl font-extrabold text-white">{current.word}</h3>
                  <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-300">
                    {current.pos}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {accent === 'en-US' ? current.ipaUS : current.ipaUK}
                  </span>
                </div>
                <p className="mt-1.5 text-lg font-bold text-emerald-300">{current.meaning}</p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlay(current.word);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition"
                title="Nghe phát âm"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            </div>

            {/* Examples */}
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Ví dụ song ngữ
              </p>
              {current.examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-slate-900/75 border border-slate-800 p-3 flex items-start justify-between gap-2"
                >
                  <div>
                    <p className="text-sm text-slate-100 leading-relaxed">
                      {highlightKeyword(ex.en, current.word)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{ex.vi}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlay(ex.en);
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-cyan-300"
                    title="Nghe câu ví dụ"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Word Family / Synonyms / Antonyms / Collocations */}
            <div className="mt-4">
              <VocabExtensionBlock
                synonyms={current.synonyms}
                antonyms={current.antonyms}
                wordFamily={current.wordFamily}
                collocations={current.collocations}
                relationMeanings={current.relationMeanings}
                defaultOpen
                compact
              />
            </div>
          </div>
        </div>
      </div>

      {/* SRS Evaluation & Prev/Next Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            setFlipped(false);
            setIndex((i) => (i > 0 ? i - 1 : queue.length - 1));
          }}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          <ChevronLeft className="h-4 w-4" />
          Thẻ trước
        </button>

        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleRate('forgotten')}
            className="min-h-[46px] inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-rose-300 transition active:scale-95"
          >
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Chưa nhớ</span>
          </button>

          <button
            type="button"
            onClick={() => handleRate('vague')}
            className="min-h-[46px] inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-amber-300 transition active:scale-95"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span>Mơ hồ</span>
          </button>

          <button
            type="button"
            onClick={() => handleRate('mastered')}
            className="min-h-[46px] inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-emerald-300 transition active:scale-95"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Đã thuộc</span>
          </button>
        </div>

        {/* Mobile Prev/Next Row */}
        <div className="grid grid-cols-2 gap-2.5 w-full sm:hidden">
          <button
            type="button"
            onClick={() => {
              setFlipped(false);
              setIndex((i) => (i > 0 ? i - 1 : queue.length - 1));
            }}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 active:scale-95 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Thẻ trước
          </button>
          <button
            type="button"
            onClick={() => {
              setFlipped(false);
              setIndex((i) => (i + 1) % queue.length);
            }}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 active:scale-95 transition"
          >
            Thẻ sau
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setFlipped(false);
            setIndex((i) => (i + 1) % queue.length);
          }}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          Thẻ sau
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Personal Note Box for current word */}
      <QuickNoteBox
        targetType="vocab"
        targetId={current.id}
        title={`${current.word} (${current.pos})`}
        subtitle={`${deckTitle} • ${current.meaning}`}
        placeholder={`Ghi chú mẹo nhớ cho từ "${current.word}"...`}
      />
    </div>
  );
};
