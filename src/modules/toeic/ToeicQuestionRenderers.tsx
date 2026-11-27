import React, { useMemo, useState } from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  CheckCircle2,
  Eraser,
  EyeOff,
  HelpCircle,
  Highlighter,
  Languages,
  MessageSquareText,
  Sparkles,
  Table2,
  Users,
  Volume2,
} from 'lucide-react';
import {
  ListeningPart1Question,
  ListeningPart2Question,
  ListeningPart3Set,
  ListeningPart4Set,
  OptionKey,
  Part2OptionKey,
  ReadingPart5Question,
  ReadingPart6Passage,
  ReadingPart7Set,
  TranscriptLine,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { Part1Illustration } from '../../components/Part1Illustrations';
import { ZoomableImage } from '../../components/ImageLightbox';
import { SmartAudioPlayer } from '../../components/SmartAudioPlayer';
import { ListeningAnalysisPanel } from '../listening/ListeningAnalysisPanel';
import { ReadingExplanationCard } from '../reading/ReadingExplanationCard';
import { speakText } from '../../utils/speech';

const OPT4: OptionKey[] = ['A', 'B', 'C', 'D'];
const OPT3: Part2OptionKey[] = ['A', 'B', 'C'];

// ============================================================================
// PART 1 PHOTOGRAPH BLOCK
// ============================================================================
export const Part1QuestionBlock: React.FC<{
  item: ListeningPart1Question;
  displayNumber: number;
  selected?: OptionKey;
  onSelect: (opt: OptionKey) => void;
  showExplanation: boolean;
  onCheckSingle?: () => void;
}> = ({ item, displayNumber, selected, onSelect, showExplanation, onCheckSingle }) => {
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [externalPlay, setExternalPlay] = useState<{ index: number; token: number } | null>(null);

  const audioLines = useMemo(
    () =>
      item.transcript.map((t) => ({
        id: t.id,
        text: t.en,
        accent: t.accent,
        gender: t.voiceGender,
        startMs: t.startMs,
        endMs: t.endMs,
      })),
    [item]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-3.5">
          <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-card">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
                  Câu {displayNumber} • Part 1
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white">{item.title}</h4>
              </div>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                {item.sceneType === 'single-person'
                  ? 'Tả 1 người'
                  : item.sceneType === 'multiple-people'
                  ? 'Tả nhiều người'
                  : 'Tả vật / Không người'}
              </span>
            </div>
            <div className="aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950 flex items-center justify-center">
              {item.imageUrl ? (
                <ZoomableImage
                  src={item.imageUrl}
                  alt={item.title}
                  containerClassName="h-full w-full"
                  className="h-full w-full max-w-full object-cover"
                />
              ) : (
                <Part1Illustration illustrationKey={item.illustrationKey} />
              )}
            </div>
          </div>

          <SmartAudioPlayer
            lines={audioLines}
            audioUrl={item.audioUrl}
            label={`Audio Part 1 — Câu ${displayNumber}`}
            onActiveLineChange={(lid) => setActiveLineId(lid)}
            externalPlayLineIndex={externalPlay}
          />
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold uppercase tracking-wider text-white">Chọn đáp án A / B / C / D</h4>
            {!showExplanation && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <EyeOff className="h-3.5 w-3.5" />
                Ẩn chữ chuẩn thi thật
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {OPT4.map((k) => {
              const chosen = selected === k;
              const isCorrect = k === item.correctAnswer;
              let cls = 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-indigo-500/60';
              if (showExplanation) {
                if (isCorrect) cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
                else if (chosen) cls = 'border-rose-500 bg-rose-500/15 text-rose-100';
                else cls = 'border-slate-800 bg-slate-900/40 text-slate-400';
              } else if (chosen) {
                cls = 'border-indigo-500 bg-indigo-500/20 text-white ring-1 ring-indigo-500/40';
              }

              return (
                <button
                  key={k}
                  type="button"
                  disabled={showExplanation}
                  onClick={() => onSelect(k)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${cls}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-extrabold">
                    {k}
                  </span>
                  <div className="flex-1 text-sm">
                    {showExplanation ? (
                      <>
                        <p className="font-semibold">{item.options[k].en}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.options[k].vi}</p>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Nghe câu mô tả ({k})...</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {!showExplanation && onCheckSingle && (
            <button
              type="button"
              disabled={!selected}
              onClick={onCheckSingle}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 disabled:opacity-40 py-3 text-sm font-bold text-white shadow-glow transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              Kiểm tra &amp; Mở Transcript
            </button>
          )}
        </div>
      </div>

      {showExplanation && (
        <ListeningAnalysisPanel
          questionId={item.id}
          questionLabel={`Part 1 Câu ${displayNumber}: ${item.title}`}
          correctAnswer={item.correctAnswer}
          userAnswer={selected}
          optionKeys={OPT4}
          transcript={item.transcript}
          explanation={item.explanation}
          activeLineId={activeLineId}
          onPlayLine={(lineIdx) => setExternalPlay({ index: lineIdx, token: Date.now() })}
        />
      )}
    </div>
  );
};

// ============================================================================
// PART 2 QUESTION–RESPONSE BLOCK
// ============================================================================
export const Part2QuestionBlock: React.FC<{
  item: ListeningPart2Question;
  displayNumber: number;
  selected?: Part2OptionKey;
  onSelect: (opt: Part2OptionKey) => void;
  showExplanation: boolean;
  onCheckSingle?: () => void;
}> = ({ item, displayNumber, selected, onSelect, showExplanation, onCheckSingle }) => {
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [externalPlay, setExternalPlay] = useState<{ index: number; token: number } | null>(null);

  const transcriptLines: TranscriptLine[] = useMemo(() => {
    const qLine: TranscriptLine = { ...item.questionLine, evidenceForQuestionIds: [item.id] };
    const optLines: TranscriptLine[] = OPT3.map((k) => ({
      id: `${item.id}-opt-${k}`,
      speaker: `Option (${k})`,
      voiceGender: item.options[k].voiceGender,
      accent: item.options[k].accent,
      en: `${k}. ${item.options[k].en}`,
      vi: `${k}. ${item.options[k].vi}`,
      startMs: item.options[k].startMs,
      endMs: item.options[k].endMs,
      evidenceForQuestionIds: k === item.correctAnswer ? [item.id] : undefined,
    }));
    return [qLine, ...optLines];
  }, [item]);

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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
              Câu {displayNumber} • Part 2
            </span>
            <h4 className="text-sm sm:text-base font-bold text-white">{item.title}</h4>
          </div>
          <span className="rounded-lg bg-violet-500/20 border border-violet-500/30 px-2.5 py-1 text-[11px] font-bold text-violet-300">
            {item.questionType}
          </span>
        </div>

        <SmartAudioPlayer
          lines={audioLines}
          audioUrl={item.audioUrl}
          label={`Audio Part 2 — Câu ${displayNumber}`}
          onActiveLineChange={(lid) => setActiveLineId(lid)}
          externalPlayLineIndex={externalPlay}
        />

        {showExplanation && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5">
            <p className="text-[11px] font-bold uppercase text-indigo-300">Câu hỏi (Question)</p>
            <p className="mt-1 text-sm font-bold text-white">{item.questionLine.en}</p>
            <p className="text-xs text-slate-300 mt-0.5">{item.questionLine.vi}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OPT3.map((k) => {
            const chosen = selected === k;
            const isCorrect = k === item.correctAnswer;
            let cls = 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-indigo-500/60';
            if (showExplanation) {
              if (isCorrect) cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
              else if (chosen) cls = 'border-rose-500 bg-rose-500/15 text-rose-100';
              else cls = 'border-slate-800 bg-slate-900/40 text-slate-400';
            } else if (chosen) {
              cls = 'border-indigo-500 bg-indigo-500/20 text-white ring-1 ring-indigo-500/40';
            }

            return (
              <button
                key={k}
                type="button"
                disabled={showExplanation}
                onClick={() => onSelect(k)}
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${cls}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-extrabold">
                  {k}
                </span>
                <div className="text-sm">
                  {showExplanation ? (
                    <>
                      <p className="font-semibold">{item.options[k].en}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.options[k].vi}</p>
                    </>
                  ) : (
                    <span className="text-slate-400 italic">Đáp án ({k})...</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!showExplanation && onCheckSingle && (
          <button
            type="button"
            disabled={!selected}
            onClick={onCheckSingle}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 disabled:opacity-40 px-5 py-2.5 text-sm font-bold text-white shadow-glow transition"
          >
            <CheckCircle2 className="h-4 w-4" />
            Kiểm tra &amp; Xem phân tích bẫy
          </button>
        )}
      </div>

      {showExplanation && (
        <ListeningAnalysisPanel
          questionId={item.id}
          questionLabel={`Part 2 Câu ${displayNumber}: ${item.title}`}
          correctAnswer={item.correctAnswer}
          userAnswer={selected}
          optionKeys={OPT3}
          transcript={transcriptLines}
          explanation={item.explanation}
          activeLineId={activeLineId}
          onPlayLine={(lineIdx) => setExternalPlay({ index: lineIdx, token: Date.now() })}
        />
      )}
    </div>
  );
};

// ============================================================================
// PART 3 & PART 4 CONVERSATION / SHORT TALK SET BLOCK
// ============================================================================
export const Part34SetBlock: React.FC<{
  set: ListeningPart3Set | ListeningPart4Set;
  startQuestionNumber: number;
  answers: Record<string, OptionKey>;
  onSelect: (qId: string, opt: OptionKey) => void;
  showExplanation: boolean;
  onCheckSet?: () => void;
  onlyQuestionId?: string;
}> = ({ set, startQuestionNumber, answers, onSelect, showExplanation, onCheckSet, onlyQuestionId }) => {
  const { saveListeningVocab, isWordSaved } = useApp();
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [externalPlay, setExternalPlay] = useState<{ index: number; token: number } | null>(null);

  const audioLines = useMemo(
    () =>
      set.transcript.map((t) => ({
        id: t.id,
        text: t.en,
        accent: t.accent,
        gender: t.voiceGender,
        startMs: t.startMs,
        endMs: t.endMs,
      })),
    [set]
  );

  const displayedQuestions = useMemo(
    () => (onlyQuestionId ? set.questions.filter((q) => q.id === onlyQuestionId) : set.questions),
    [set.questions, onlyQuestionId]
  );

  const allAnswered = displayedQuestions.every((q) => Boolean(answers[q.id]));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
              Part {set.part}
            </span>
            <h4 className="text-base font-extrabold text-white">{set.title}</h4>
            {'speakerCount' in set && (
              <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/15 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                <Users className="h-3 w-3" />
                {set.speakerCount} người nói
              </span>
            )}
            {'talkType' in set && (
              <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-300">
                {set.talkType}
              </span>
            )}
            {set.hasGraphic && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                <Table2 className="h-3 w-3" />
                Có bảng biểu (Graphic)
              </span>
            )}
          </div>
        </div>

        <SmartAudioPlayer
          lines={audioLines}
          audioUrl={set.audioUrl}
          label={`Audio Part ${set.part} — ${set.title}`}
          onActiveLineChange={(lid) => setActiveLineId(lid)}
          externalPlayLineIndex={externalPlay}
        />

        {set.graphic && (
          <div className="rounded-xl border border-amber-500/35 bg-slate-950/75 p-4 overflow-x-auto">
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-2">
              {set.graphic.title}
            </p>
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-300">
                  {set.graphic.headers.map((h, i) => (
                    <th key={i} className="py-2 pr-4 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {set.graphic.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) => (
                      <td key={ci} className="py-2 pr-4">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {set.graphic.footnote && (
              <p className="mt-2 text-[11px] italic text-slate-400">{set.graphic.footnote}</p>
            )}
          </div>
        )}

        {set.graphicImageUrl && !set.graphic && (
          <div className="rounded-xl border border-amber-500/35 bg-slate-950/75 p-3">
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-2">
              Biểu đồ / Bảng biểu đính kèm (Graphic)
            </p>
            <ZoomableImage
              src={set.graphicImageUrl}
              alt={`Graphic for ${set.title}`}
              className="mx-auto max-h-80 max-w-full w-auto h-auto rounded-lg bg-white p-1 object-contain"
            />
          </div>
        )}
      </div>

      {/* Sub-questions */}
      <div className="space-y-4">
        {displayedQuestions.map((q, idx) => {
          const chosen = answers[q.id];
          return (
            <div key={q.id} className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-card space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-extrabold text-sky-300">
                  Câu {startQuestionNumber + idx}
                </span>
                <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold text-indigo-300">
                  {q.questionType}
                </span>
              </div>

              <div>
                <p className="text-sm sm:text-base font-bold text-white">{q.prompt}</p>
                {showExplanation && <p className="text-xs text-slate-400 mt-0.5">{q.promptVi}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {OPT4.map((k) => {
                  const isChosen = chosen === k;
                  const isCorrect = k === q.correctAnswer;
                  let cls = 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-indigo-500/60';
                  if (showExplanation) {
                    if (isCorrect) cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
                    else if (isChosen) cls = 'border-rose-500 bg-rose-500/15 text-rose-100';
                    else cls = 'border-slate-800 bg-slate-900/40 text-slate-400';
                  } else if (isChosen) {
                    cls = 'border-indigo-500 bg-indigo-500/20 text-white ring-1 ring-indigo-500/40';
                  }

                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={showExplanation}
                      onClick={() => onSelect(q.id, k)}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${cls}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-extrabold">
                        {k}
                      </span>
                      <div className="text-xs sm:text-sm">
                        <p className="font-medium">{q.options[k].en}</p>
                        {showExplanation && <p className="text-[11px] text-slate-400 mt-0.5">{q.options[k].vi}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {showExplanation && (
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3.5 space-y-2 text-xs">
                  <p className="font-bold text-amber-300">
                    Bẫy &amp; Phân tích ({q.explanation.trapType}):{' '}
                    <span className="font-normal text-slate-200">{q.explanation.trapAnalysis}</span>
                  </p>
                  {q.explanation.paraphrases.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {q.explanation.paraphrases.map((p, pi) => (
                        <span
                          key={pi}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-2.5 py-1 text-[11px] text-cyan-200"
                        >
                          <b className="text-white">{p.audioPhrase}</b> → <b className="text-cyan-300">{p.answerPhrase}</b> ({p.meaningVi})
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-300">
                    {OPT4.map((k) => (
                      <p key={k} className={k === q.correctAnswer ? 'text-emerald-300 font-semibold' : ''}>
                        <b>({k})</b> {q.explanation.optionAnalysis[k]}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!showExplanation && onCheckSet && (
          <button
            type="button"
            disabled={!allAnswered}
            onClick={onCheckSet}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 disabled:opacity-40 py-3 text-sm font-bold text-white shadow-glow transition"
          >
            <CheckCircle2 className="h-4 w-4" />
            Chấm đoạn này &amp; Mở Interactive Transcript
          </button>
        )}
      </div>

      {/* Interactive Transcript + Saveable Key Vocab after submitting */}
      {showExplanation && (
        <div className="rounded-2xl border border-indigo-500/30 bg-[#111827] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-indigo-400" />
            <h5 className="text-sm font-extrabold text-white">
              Interactive Transcript song ngữ (Bấm vào từng câu để nghe ngay dòng đó)
            </h5>
          </div>

          <div className="space-y-2">
            {set.transcript.map((line, lIdx) => {
              const isActive = activeLineId === line.id;
              const isEvidence = (line.evidenceForQuestionIds?.length ?? 0) > 0;
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => setExternalPlay({ index: lIdx, token: Date.now() })}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isActive
                      ? 'border-sky-400 bg-sky-500/15'
                      : isEvidence
                      ? 'transcript-evidence border-indigo-500/40'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                    <span className="text-indigo-300 flex items-center gap-1.5">
                      <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                      {line.speaker}
                    </span>
                    {isEvidence && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                        Dẫn chứng đáp án
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-100">{line.en}</p>
                  <p className="mt-0.5 text-xs italic text-slate-400">{line.vi}</p>
                </button>
              );
            })}
          </div>

          {set.keyVocab.length > 0 && (
            <div className="border-t border-slate-800 pt-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h6 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  Từ vựng trọng tâm trong bài nghe
                </h6>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {set.keyVocab.map((v) => {
                  const saved = isWordSaved(v.id);
                  return (
                    <div key={v.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-white">{v.word}</span>
                          <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                            {v.pos}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">{v.ipaUS}</span>
                          <button
                            type="button"
                            onClick={() => speakText(v.word, { accent: 'en-US' })}
                            className="text-cyan-400 hover:text-cyan-300"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-xs font-semibold text-sky-300 mt-0.5">{v.meaning}</p>
                        <p className="text-[11px] text-slate-400 italic mt-0.5">{v.exampleEn}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveListeningVocab(v)}
                        className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                          saved
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200'
                        }`}
                      >
                        {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                        {saved ? 'Đã lưu' : 'Lưu vào Từ vựng của tôi'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PART 5 INCOMPLETE SENTENCE BLOCK
// ============================================================================
export const Part5QuestionBlock: React.FC<{
  item: ReadingPart5Question;
  displayNumber: number;
  selected?: OptionKey;
  onSelect: (opt: OptionKey) => void;
  showExplanation: boolean;
  onCheckSingle?: () => void;
}> = ({ item, displayNumber, selected, onSelect, showExplanation, onCheckSingle }) => {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
            Câu {displayNumber} • Part 5
          </span>
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
            {item.topic}
          </span>
        </div>
        <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-300">
          {item.difficulty}
        </span>
      </div>

      <p className="text-base sm:text-lg font-bold text-white leading-relaxed">{item.sentence}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {OPT4.map((k) => {
          const chosen = selected === k;
          const isCorrect = k === item.correctAnswer;
          let cls = 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-indigo-500/60';
          if (showExplanation) {
            if (isCorrect) cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
            else if (chosen) cls = 'border-rose-500 bg-rose-500/15 text-rose-100';
            else cls = 'border-slate-800 bg-slate-900/40 text-slate-400';
          } else if (chosen) {
            cls = 'border-indigo-500 bg-indigo-500/20 text-white ring-1 ring-indigo-500/40';
          }

          return (
            <button
              key={k}
              type="button"
              disabled={showExplanation}
              onClick={() => onSelect(k)}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition ${cls}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-extrabold">
                {k}
              </span>
              <span>{item.options[k]}</span>
            </button>
          );
        })}
      </div>

      {!showExplanation && onCheckSingle && (
        <button
          type="button"
          disabled={!selected}
          onClick={onCheckSingle}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 disabled:opacity-40 px-5 py-2.5 text-sm font-bold text-white shadow-glow transition"
        >
          <CheckCircle2 className="h-4 w-4" />
          Kiểm tra &amp; Xem giải thích 5 lớp
        </button>
      )}

      {showExplanation && (
        <ReadingExplanationCard
          questionId={item.id}
          questionLabel={`Part 5 Câu ${displayNumber} (${item.topic})`}
          correctAnswer={item.correctAnswer}
          userAnswer={selected}
          explanation={item.explanation}
        />
      )}
    </div>
  );
};

// ============================================================================
// PART 6 TEXT COMPLETION SPLIT-SCREEN BLOCK
// ============================================================================
export const Part6PassageBlock: React.FC<{
  passage: ReadingPart6Passage;
  startQuestionNumber: number;
  answers: Record<string, OptionKey>;
  onSelect: (qId: string, opt: OptionKey) => void;
  showExplanation: boolean;
  onCheckPassage?: () => void;
  onlyQuestionId?: string;
}> = ({ passage, startQuestionNumber, answers, onSelect, showExplanation, onCheckPassage, onlyQuestionId }) => {
  const { readingHighlights, toggleReadingHighlight, clearReadingHighlights } = useApp();
  const [showTranslation, setShowTranslation] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'passage' | 'questions'>('passage');

  const userMarks = readingHighlights[passage.id] || [];
  const displayedQuestions = useMemo(
    () => (onlyQuestionId ? passage.questions.filter((q) => q.id === onlyQuestionId) : passage.questions),
    [passage.questions, onlyQuestionId]
  );

  const handleLocateEvidence = (_pIdx: number, sentenceId: string) => {
    setMobilePane('passage');
    setActiveEvidenceId(null);
    window.setTimeout(() => {
      setActiveEvidenceId(sentenceId);
      const el = document.getElementById(`ev-${sentenceId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  return (
    <div className="space-y-3">
      {/* Mobile Split-Screen Tab Switcher (< lg) */}
      <div className="lg:hidden grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-700/80 bg-[#0F172A]/95 p-1">
        <button
          type="button"
          onClick={() => setMobilePane('passage')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition ${
            mobilePane === 'passage'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Bài đọc Part 6
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('questions')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition ${
            mobilePane === 'questions'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Câu hỏi ({displayedQuestions.length})
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Bilingual Passage */}
        <div
          className={`${
            mobilePane === 'passage' ? 'block' : 'hidden lg:block'
          } lg:col-span-6 lg:sticky lg:top-20 rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 sm:p-5 shadow-card space-y-4`}
        >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-3">
          <div>
            <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold text-indigo-300 uppercase">
              Part 6 • {passage.genre}
            </span>
            <h4 className="mt-1 text-base font-extrabold text-white">{passage.title}</h4>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHighlightMode((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                highlightMode
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <Highlighter className="h-3.5 w-3.5" />
              Highlight
            </button>
            {userMarks.length > 0 && (
              <button
                type="button"
                onClick={() => clearReadingHighlights(passage.id)}
                className="rounded-lg border border-slate-700 bg-slate-900 p-1 text-slate-400 hover:text-white"
                title="Xóa highlight"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                showTranslation
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              Song ngữ
            </button>
          </div>
        </div>

        {passage.headerMeta && (
          <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-3 text-xs space-y-1 text-slate-300">
            {passage.headerMeta.from && <p><b className="text-slate-400">From:</b> {passage.headerMeta.from}</p>}
            {passage.headerMeta.to && <p><b className="text-slate-400">To:</b> {passage.headerMeta.to}</p>}
            {passage.headerMeta.date && <p><b className="text-slate-400">Date:</b> {passage.headerMeta.date}</p>}
            {passage.headerMeta.subject && <p><b className="text-slate-400">Subject:</b> {passage.headerMeta.subject}</p>}
          </div>
        )}

        <div className="space-y-3 text-sm leading-relaxed text-slate-100">
          {passage.paragraphs.map((para) => (
            <div key={para.id} className="space-y-1.5">
              <p>
                {para.sentences.map((s) => {
                  const isEv = activeEvidenceId === s.id;
                  const isMarked = userMarks.includes(s.id);
                  return (
                    <span
                      key={s.id}
                      id={`ev-${s.id}`}
                      onClick={() => highlightMode && toggleReadingHighlight(passage.id, s.id)}
                      className={`mr-1 transition ${highlightMode ? 'cursor-pointer hover:bg-amber-500/20' : ''} ${
                        isEv ? 'evidence-highlight-active' : isMarked ? 'user-highlight-mark' : ''
                      }`}
                    >
                      {s.en}
                    </span>
                  );
                })}
              </p>
              {showTranslation && (
                <p className="text-xs italic text-cyan-200/85 border-l-2 border-cyan-500/40 pl-2.5">
                  {para.sentences.map((s) => s.vi).join(' ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Questions */}
      <div className={`${mobilePane === 'questions' ? 'block' : 'hidden lg:block'} lg:col-span-6 space-y-4`}>
        {displayedQuestions.map((q, idx) => {
          const chosen = answers[q.id];
          return (
            <div key={q.id} className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-card space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
                  Câu {startQuestionNumber + idx} (Chỗ trống [{q.blankNumber}])
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-sky-300">
                  {q.questionType}
                </span>
              </div>

              <div className="space-y-2">
                {OPT4.map((k) => {
                  const isChosen = chosen === k;
                  const isCorrect = k === q.correctAnswer;
                  let cls = 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-indigo-500/60';
                  if (showExplanation) {
                    if (isCorrect) cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
                    else if (isChosen) cls = 'border-rose-500 bg-rose-500/15 text-rose-100';
                    else cls = 'border-slate-800 bg-slate-900/40 text-slate-400';
                  } else if (isChosen) {
                    cls = 'border-indigo-500 bg-indigo-500/20 text-white ring-1 ring-indigo-500/40';
                  }
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={showExplanation}
                      onClick={() => onSelect(q.id, k)}
                      className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs sm:text-sm font-medium transition ${cls}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-extrabold">
                        {k}
                      </span>
                      <span>{q.options[k]}</span>
                    </button>
                  );
                })}
              </div>

              {showExplanation && (
                <ReadingExplanationCard
                  questionId={q.id}
                  questionLabel={`Part 6 Câu ${startQuestionNumber + idx} [${q.blankNumber}]`}
                  correctAnswer={q.correctAnswer}
                  userAnswer={chosen}
                  explanation={q.explanation}
                  onLocateEvidence={handleLocateEvidence}
                />
              )}
            </div>
          );
        })}

        {!showExplanation && onCheckPassage && (
          <button
            type="button"
            disabled={!displayedQuestions.every((q) => Boolean(answers[q.id]))}
            onClick={onCheckPassage}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 disabled:opacity-40 py-3 text-sm font-bold text-white shadow-glow transition"
          >
            <CheckCircle2 className="h-4 w-4" />
            Chấm đoạn Part 6 &amp; Xem giải thích 5 lớp
          </button>
        )}
      </div>
    </div>
    </div>
  );
};

// ============================================================================
// PART 7 READING COMPREHENSION SPLIT-SCREEN BLOCK (SINGLE / DOUBLE / TRIPLE)
// ============================================================================
export const Part7SetBlock: React.FC<{
  set: ReadingPart7Set;
  startQuestionNumber: number;
  answers: Record<string, OptionKey>;
  onSelect: (qId: string, opt: OptionKey) => void;
  showExplanation: boolean;
  onCheckSet?: () => void;
  onlyQuestionId?: string;
}> = ({ set, startQuestionNumber, answers, onSelect, showExplanation, onCheckSet, onlyQuestionId }) => {
  const { readingHighlights, toggleReadingHighlight, clearReadingHighlights } = useApp();
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'passage' | 'questions'>('passage');

  const currentDoc = set.passages[activeDocIdx] || set.passages[0];
  const userMarks = readingHighlights[currentDoc.id] || [];
  const displayedQuestions = useMemo(
    () => (onlyQuestionId ? set.questions.filter((q) => q.id === onlyQuestionId) : set.questions),
    [set.questions, onlyQuestionId]
  );

  const handleLocateEvidence = (passageIndex: number, sentenceId: string) => {
    setMobilePane('passage');
    setActiveDocIdx(passageIndex);
    setActiveEvidenceId(null);
    window.setTimeout(() => {
      setActiveEvidenceId(sentenceId);
      const el = document.getElementById(`ev-${sentenceId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 90);
  };

  return (
    <div className="space-y-3">
      {/* Mobile Split-Screen Tab Switcher (< lg) */}
      <div className="lg:hidden grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-700/80 bg-[#0F172A]/95 p-1">
        <button
          type="button"
          onClick={() => setMobilePane('passage')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition ${
            mobilePane === 'passage'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Bài đọc ({set.passages.length} đoạn)
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('questions')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition ${
            mobilePane === 'questions'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Câu hỏi ({displayedQuestions.length})
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Multi-Passage Viewer */}
        <div
          className={`${
            mobilePane === 'passage' ? 'block' : 'hidden lg:block'
          } lg:col-span-6 lg:sticky lg:top-20 rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 sm:p-5 shadow-card space-y-4`}
        >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {set.passages.map((doc, idx) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setActiveDocIdx(idx)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeDocIdx === idx
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {doc.tabLabel}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHighlightMode((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                highlightMode
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <Highlighter className="h-3.5 w-3.5" />
              Highlight
            </button>
            {userMarks.length > 0 && (
              <button
                type="button"
                onClick={() => clearReadingHighlights(currentDoc.id)}
                className="rounded-lg border border-slate-700 bg-slate-900 p-1 text-slate-400 hover:text-white"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                showTranslation
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              Song ngữ
            </button>
          </div>
        </div>

        <div>
          <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-extrabold text-violet-300 uppercase">
            {currentDoc.genre}
          </span>
          <h4 className="mt-1 text-base font-extrabold text-white">{currentDoc.title}</h4>
        </div>

        {currentDoc.headerMeta && currentDoc.headerMeta.length > 0 && (
          <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-3 text-xs space-y-1 text-slate-300">
            {currentDoc.headerMeta.map((m, i) => (
              <p key={i}>
                <b className="text-slate-400">{m.label}:</b> {m.value}
              </p>
            ))}
          </div>
        )}

        {currentDoc.tableData && (
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-sky-300">
                  {currentDoc.tableData.headers.map((h, i) => (
                    <th key={i} className="py-1.5 pr-3 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {currentDoc.tableData.rows.map((r) => (
                  <tr key={r.id}>
                    {r.cells.map((c, ci) => (
                      <td key={ci} className="py-1.5 pr-3">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {currentDoc.chatMessages && currentDoc.chatMessages.length > 0 && (
          <div className="space-y-2.5">
            {currentDoc.chatMessages.map((msg) => {
              const isEv = activeEvidenceId === msg.id;
              const isMarked = userMarks.includes(msg.id);
              return (
                <div
                  key={msg.id}
                  id={`ev-${msg.id}`}
                  onClick={() => highlightMode && toggleReadingHighlight(currentDoc.id, msg.id)}
                  className={`rounded-xl border p-3 text-sm transition ${
                    msg.align === 'right'
                      ? 'ml-6 border-indigo-500/35 bg-indigo-950/35'
                      : 'mr-6 border-slate-700 bg-slate-900/75'
                  } ${isEv ? 'evidence-highlight-active' : isMarked ? 'user-highlight-mark' : ''}`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-sky-300">{msg.sender}</span>
                    <span className="text-slate-500">{msg.time}</span>
                  </div>
                  <p className="text-slate-100">{msg.en}</p>
                  {showTranslation && <p className="text-xs italic text-cyan-200/85 mt-1">{msg.vi}</p>}
                </div>
              );
            })}
          </div>
        )}

        {currentDoc.paragraphs.length > 0 && (
          <div className="space-y-3 text-sm leading-relaxed text-slate-100">
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
                        className={`mr-1 transition ${highlightMode ? 'cursor-pointer hover:bg-amber-500/20' : ''} ${
                          isEv ? 'evidence-highlight-active' : isMarked ? 'user-highlight-mark' : ''
                        }`}
                      >
                        {s.en}
                      </span>
                    );
                  })}
                </p>
                {showTranslation && (
                  <p className="text-xs italic text-cyan-200/85 border-l-2 border-cyan-500/40 pl-2.5">
                    {para.sentences.map((s) => s.vi).join(' ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Questions */}
      <div className={`${mobilePane === 'questions' ? 'block' : 'hidden lg:block'} lg:col-span-6 space-y-4`}>
        {displayedQuestions.map((q, idx) => {
          const chosen = answers[q.id];
          return (
            <div key={q.id} className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-extrabold text-indigo-300">
                  Câu {startQuestionNumber + idx}
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                  {q.questionType}
                </span>
              </div>

              <p className="text-sm sm:text-base font-bold text-white leading-snug">{q.prompt}</p>

              <div className="space-y-2">
                {OPT4.map((k) => {
                  const isChosen = chosen === k;
                  const isCorrect = k === q.correctAnswer;
                  let cls = 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-indigo-500/60';
                  if (showExplanation) {
                    if (isCorrect) cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-100';
                    else if (isChosen) cls = 'border-rose-500 bg-rose-500/15 text-rose-100';
                    else cls = 'border-slate-800 bg-slate-900/40 text-slate-400';
                  } else if (isChosen) {
                    cls = 'border-indigo-500 bg-indigo-500/20 text-white ring-1 ring-indigo-500/40';
                  }
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={showExplanation}
                      onClick={() => onSelect(q.id, k)}
                      className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs sm:text-sm font-medium transition ${cls}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-extrabold">
                        {k}
                      </span>
                      <span>{q.options[k]}</span>
                    </button>
                  );
                })}
              </div>

              {showExplanation && (
                <ReadingExplanationCard
                  questionId={q.id}
                  questionLabel={`Part 7 Câu ${startQuestionNumber + idx}`}
                  correctAnswer={q.correctAnswer}
                  userAnswer={chosen}
                  explanation={q.explanation}
                  onLocateEvidence={handleLocateEvidence}
                />
              )}
            </div>
          );
        })}

        {!showExplanation && onCheckSet && (
          <button
            type="button"
            disabled={!displayedQuestions.every((q) => Boolean(answers[q.id]))}
            onClick={onCheckSet}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 disabled:opacity-40 py-3 text-sm font-bold text-white shadow-glow transition"
          >
            <CheckCircle2 className="h-4 w-4" />
            Chấm bài đọc Part 7 &amp; Mở dẫn chứng 5 lớp
          </button>
        )}
      </div>
    </div>
    </div>
  );
};
