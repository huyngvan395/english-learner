import React, { useMemo, useState } from 'react';
import { CheckCircle2, EyeOff, RotateCcw } from 'lucide-react';
import { LISTENING_PART1_QUESTIONS } from '../../data/listeningPart1';
import { OptionKey } from '../../types';
import { useApp } from '../../context/AppContext';
import { Part1Illustration } from '../../components/Part1Illustrations';
import { ZoomableImage } from '../../components/ImageLightbox';
import { SmartAudioPlayer } from '../../components/SmartAudioPlayer';
import { ListeningAnalysisPanel } from './ListeningAnalysisPanel';

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

export const ListeningPart1View: React.FC = () => {
  const { recordAttempt } = useApp();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<Record<string, OptionKey>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [externalPlay, setExternalPlay] = useState<{ index: number; token: number } | null>(null);

  const q = LISTENING_PART1_QUESTIONS[idx];
  const isSubmitted = Boolean(submitted[q.id]);
  const userChoice = selected[q.id];

  const audioLines = useMemo(
    () =>
      q.transcript.map((t) => ({
        id: t.id,
        text: t.en,
        accent: t.accent,
        gender: t.voiceGender,
        startMs: t.startMs,
        endMs: t.endMs,
      })),
    [q]
  );

  const handleSubmit = () => {
    if (!userChoice || isSubmitted) return;
    setSubmitted((prev) => ({ ...prev, [q.id]: true }));
    recordAttempt({
      module: 'listening',
      partLabel: 'Part 1',
      correctCount: userChoice === q.correctAnswer ? 1 : 0,
      totalCount: 1,
      topics: [{ topic: `Part 1 — ${q.sceneType}`, correct: userChoice === q.correctAnswer }],
    });
  };

  return (
    <div className="space-y-5">
      {/* Selector pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#111827] p-3.5 sm:p-4">
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap gap-2 w-full sm:w-auto">
          {LISTENING_PART1_QUESTIONS.map((item, i) => {
            const done = submitted[item.id];
            const ok = done && selected[item.id] === item.correctAnswer;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setIdx(i);
                  setActiveLineId(null);
                }}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition ${
                  idx === i
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : done
                    ? ok
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Tranh {i + 1}
              </button>
            );
          })}
        </div>

        {isSubmitted && (
          <button
            type="button"
            onClick={() => {
              setSubmitted((p) => ({ ...p, [q.id]: false }));
              setSelected((p) => {
                const c = { ...p };
                delete c[q.id];
                return c;
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Nghe làm lại
          </button>
        )}
      </div>

      {/* Photograph + Audio + Hidden Options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-card">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-extrabold text-white">{q.title}</h3>
              <span className="rounded-md bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-bold text-indigo-300">
                {q.sceneType === 'single-person'
                  ? 'Tả 1 người'
                  : q.sceneType === 'multiple-people'
                  ? 'Tả nhiều người'
                  : 'Tả vật / Không người'}
              </span>
            </div>
            <div className="aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950 flex items-center justify-center">
              {q.imageUrl ? (
                <ZoomableImage
                  src={q.imageUrl}
                  alt={q.title}
                  containerClassName="h-full w-full"
                  className="h-full w-full max-w-full object-cover"
                />
              ) : (
                <Part1Illustration illustrationKey={q.illustrationKey} />
              )}
            </div>
          </div>

          <SmartAudioPlayer
            lines={audioLines}
            audioUrl={q.audioUrl}
            activeLineId={activeLineId}
            onActiveLineChange={(lineId) => setActiveLineId(lineId)}
            externalPlayLineIndex={externalPlay}
            sticky
            label={`Audio Part 1 — Tranh ${idx + 1} (Nghe 4 câu mô tả A, B, C, D)`}
          />
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-white">Chọn đáp án mô tả đúng bức tranh</h4>
            {!isSubmitted && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                <EyeOff className="h-3 w-3" />
                Ẩn chữ chuẩn phòng thi
              </span>
            )}
          </div>

          <div className="space-y-2.5">
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
                  onClick={() => setSelected((prev) => ({ ...prev, [q.id]: k }))}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${cls}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-extrabold">
                    {k}
                  </span>
                  <div className="flex-1">
                    {isSubmitted ? (
                      <>
                        <p className="text-sm font-semibold">{q.options[k].en}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{q.options[k].vi}</p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-slate-300 mt-1">
                        Phương án ({k}) — Nghe audio để chọn
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {!isSubmitted && (
            <button
              type="button"
              disabled={!userChoice}
              onClick={handleSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 py-3 text-sm font-bold text-white shadow-glow hover:from-blue-500 hover:to-indigo-500 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              Nộp đáp án &amp; Mở khóa Transcript + Giải thích
            </button>
          )}
        </div>
      </div>

      {/* Deep Analysis */}
      {isSubmitted && (
        <ListeningAnalysisPanel
          questionId={q.id}
          questionLabel={`Listening Part 1 — ${q.title}`}
          correctAnswer={q.correctAnswer}
          userAnswer={userChoice}
          optionKeys={OPTION_KEYS}
          explanation={q.explanation}
          transcript={q.transcript}
          activeLineId={activeLineId}
          onPlayLine={(lineIndex) => setExternalPlay({ index: lineIndex, token: Date.now() })}
        />
      )}
    </div>
  );
};
