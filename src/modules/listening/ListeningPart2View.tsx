import React, { useMemo, useState } from 'react';
import { CheckCircle2, EyeOff, RotateCcw } from 'lucide-react';
import { LISTENING_PART2_QUESTIONS } from '../../data/listeningPart2';
import { Part2OptionKey, TranscriptLine } from '../../types';
import { useApp } from '../../context/AppContext';
import { SmartAudioPlayer } from '../../components/SmartAudioPlayer';
import { ListeningAnalysisPanel } from './ListeningAnalysisPanel';

const PART2_KEYS: Part2OptionKey[] = ['A', 'B', 'C'];

export const ListeningPart2View: React.FC = () => {
  const { recordAttempt } = useApp();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<Record<string, Part2OptionKey>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [externalPlay, setExternalPlay] = useState<{ index: number; token: number } | null>(null);

  const q = LISTENING_PART2_QUESTIONS[idx];
  const isSubmitted = Boolean(submitted[q.id]);
  const userChoice = selected[q.id];

  const transcriptLines: TranscriptLine[] = useMemo(() => {
    const qLine: TranscriptLine = { ...q.questionLine, evidenceForQuestionIds: [q.id] };
    const optLines: TranscriptLine[] = PART2_KEYS.map((k) => ({
      id: `${q.id}-opt-${k}`,
      speaker: `Option (${k})`,
      voiceGender: q.options[k].voiceGender,
      accent: q.options[k].accent,
      en: `${k}. ${q.options[k].en}`,
      vi: `${k}. ${q.options[k].vi}`,
      startMs: q.options[k].startMs,
      endMs: q.options[k].endMs,
      evidenceForQuestionIds: k === q.correctAnswer ? [q.id] : undefined,
    }));
    return [qLine, ...optLines];
  }, [q]);

  const audioLines = useMemo(
    () =>
      transcriptLines.map((t) => ({
        id: t.id,
        text: t.en,
        accent: t.accent,
        gender: t.voiceGender,
        startMs: t.startMs,
        endMs: t.endMs,
      })),
    [transcriptLines]
  );

  const handleSubmit = () => {
    if (!userChoice || isSubmitted) return;
    setSubmitted((prev) => ({ ...prev, [q.id]: true }));
    recordAttempt({
      module: 'listening',
      partLabel: 'Part 2',
      correctCount: userChoice === q.correctAnswer ? 1 : 0,
      totalCount: 1,
      topics: [{ topic: `Part 2 — ${q.questionType}`, correct: userChoice === q.correctAnswer }],
    });
  };

  return (
    <div className="space-y-5">
      {/* Question Navigator */}
      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            8 Câu hỏi trọng tâm Part 2 (Đủ Wh, Yes/No, Or, Tag, Statement, Trả lời gián tiếp)
          </span>
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-200 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Làm lại câu này
            </button>
          )}
        </div>

        <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap gap-2">
          {LISTENING_PART2_QUESTIONS.map((item, i) => {
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
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  idx === i
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : done
                    ? ok
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Câu {i + 7}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Card */}
      <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 sm:p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="rounded-md bg-violet-500/20 border border-violet-500/30 px-2.5 py-0.5 text-[11px] font-bold text-violet-300">
              {q.questionType}
            </span>
            <h3 className="mt-1.5 text-lg font-extrabold text-white">{q.title}</h3>
          </div>
          {!isSubmitted && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400">
              <EyeOff className="h-3.5 w-3.5" />
              Ẩn câu hỏi &amp; đáp án khi đang nghe
            </span>
          )}
        </div>

        <SmartAudioPlayer
          lines={audioLines}
          audioUrl={q.audioUrl}
          activeLineId={activeLineId}
          onActiveLineChange={(lineId) => setActiveLineId(lineId)}
          externalPlayLineIndex={externalPlay}
          sticky
          label={`Audio Part 2 — Câu ${idx + 7} (1 Câu hỏi + 3 Hồi đáp A, B, C)`}
        />

        {/* 3 Options A / B / C */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PART2_KEYS.map((k) => {
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
                className={`rounded-2xl border p-4 text-left transition flex items-start gap-3 ${cls}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-extrabold">
                  {k}
                </span>
                <div className="flex-1 min-w-0">
                  {isSubmitted ? (
                    <>
                      <p className="text-sm font-semibold">{q.options[k].en}</p>
                      <p className="mt-1 text-xs text-slate-400">{q.options[k].vi}</p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-slate-300 mt-1">Hồi đáp ({k})</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!isSubmitted && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!userChoice}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 px-6 py-2.5 text-sm font-bold text-white shadow-glow"
            >
              <CheckCircle2 className="h-4 w-4" />
              Nộp đáp án &amp; Xem phân tích bẫy
            </button>
          </div>
        )}
      </div>

      {isSubmitted && (
        <ListeningAnalysisPanel
          questionId={q.id}
          questionLabel={`Listening Part 2 — Câu ${idx + 7} (${q.questionType})`}
          correctAnswer={q.correctAnswer}
          userAnswer={userChoice}
          optionKeys={PART2_KEYS}
          explanation={q.explanation}
          transcript={transcriptLines}
          activeLineId={activeLineId}
          onPlayLine={(lineIndex) => setExternalPlay({ index: lineIndex, token: Date.now() })}
        />
      )}
    </div>
  );
};
