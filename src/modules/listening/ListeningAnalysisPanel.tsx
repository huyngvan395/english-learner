import React from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Ear,
  ListChecks,
  MessageSquareText,
  Sparkles,
  Volume2,
  XCircle,
  Zap,
} from 'lucide-react';
import { ListeningExplanation, ListeningVocabItem, TranscriptLine } from '../../types';
import { useApp } from '../../context/AppContext';
import { speakText } from '../../utils/speech';
import { QuickNoteBox } from '../../components/QuickNoteBox';

interface ListeningAnalysisPanelProps {
  questionId: string;
  questionLabel: string;
  correctAnswer: string;
  userAnswer?: string;
  optionKeys: string[];
  explanation: ListeningExplanation;
  transcript?: TranscriptLine[];
  activeLineId?: string | null;
  onPlayLine?: (lineIndex: number) => void;
  extraKeyVocab?: ListeningVocabItem[];
}

export const ListeningAnalysisPanel: React.FC<ListeningAnalysisPanelProps> = ({
  questionId,
  questionLabel,
  correctAnswer,
  userAnswer,
  optionKeys,
  explanation,
  transcript,
  activeLineId,
  onPlayLine,
  extraKeyVocab,
}) => {
  const { saveListeningVocab, isWordSaved } = useApp();
  const isCorrect = userAnswer === correctAnswer;
  const vocabList = extraKeyVocab && extraKeyVocab.length > 0 ? extraKeyVocab : explanation.keyVocab;

  return (
    <div className="mt-4 rounded-2xl border border-indigo-500/35 bg-[#0F172A]/95 p-4 sm:p-5 space-y-4 shadow-lg">
      {/* Verdict */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <XCircle className="h-5 w-5 text-rose-400" />
          )}
          <span className={`text-sm font-extrabold ${isCorrect ? 'text-emerald-300' : 'text-rose-300'}`}>
            {isCorrect
              ? `Chính xác! Đáp án đúng là (${correctAnswer})`
              : `Chưa chính xác! Bạn chọn (${userAnswer || '—'}) • Đáp án đúng: (${correctAnswer})`}
          </span>
        </div>
      </div>

      {/* 1. Interactive Bilingual Transcript (if provided per-question like Part 1/2) */}
      {transcript && transcript.length > 0 && (
        <div className="rounded-xl border border-indigo-500/25 bg-slate-900/85 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-300">
              <MessageSquareText className="h-4 w-4" />
              1. Interactive Transcript song ngữ (Bấm từng dòng để nghe lại)
            </span>
          </div>
          <div className="space-y-2">
            {transcript.map((line, idx) => {
              const isEvidence = line.evidenceForQuestionIds?.includes(questionId);
              const isActive = activeLineId === line.id;
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => {
                    if (onPlayLine) {
                      onPlayLine(idx);
                    } else {
                      speakText(line.en, { accent: line.accent, gender: line.voiceGender });
                    }
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition flex items-start justify-between gap-3 ${
                    isActive
                      ? 'border-cyan-400 bg-cyan-500/15'
                      : isEvidence
                      ? 'transcript-evidence border-indigo-400/50'
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold text-indigo-300">{line.speaker}</span>
                      {isEvidence && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                          Chứa đáp án
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white">{line.en}</p>
                    <p className="text-xs text-slate-400">{line.vi}</p>
                  </div>
                  <Volume2 className="h-4 w-4 shrink-0 text-cyan-400 mt-1" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Paraphrase Map */}
      {explanation.paraphrases.length > 0 && (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-cyan-300">
            <ArrowRightLeft className="h-4 w-4" />
            Bản đồ Paraphrase (Audio ↔ Đáp án)
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Audio nói</th>
                  <th className="px-3 py-2">Đáp án / Diễn giải</th>
                  <th className="px-3 py-2">Nghĩa tiếng Việt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {explanation.paraphrases.map((p, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-semibold text-amber-200">&ldquo;{p.audioPhrase}&rdquo;</td>
                    <td className="px-3 py-2 font-semibold text-cyan-300">{p.answerPhrase}</td>
                    <td className="px-3 py-2 text-slate-300">{p.meaningVi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Listening Key (2-second audio clincher) + Trap & Sound Trap Analysis */}
      {explanation.listeningKey && (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-3.5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
            <Zap className="h-4 w-4" />
            Mẹo bắt từ khóa trong 2 giây (Listening Key)
          </div>
          <p className="mt-1.5 text-xs sm:text-sm font-semibold text-emerald-100 leading-relaxed">
            {explanation.listeningKey}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Bóc tách Bẫy Listening (Trap Analysis)
          </div>
          {explanation.trapType && (
            <span className="rounded-lg border border-amber-400/45 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-200">
              {explanation.trapType}
            </span>
          )}
        </div>

        {explanation.soundTrap && (
          <div className="rounded-lg border border-rose-500/35 bg-rose-950/30 px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 font-extrabold text-rose-300 uppercase text-[10px] tracking-wider">
              <Ear className="h-3.5 w-3.5" />
              Cặp từ gần âm / gây nhiễu:
            </span>
            <span className="rounded-md bg-rose-500/20 border border-rose-400/35 px-2 py-0.5 font-mono font-bold text-rose-100">
              {typeof explanation.soundTrap === 'string'
                ? explanation.soundTrap
                : explanation.soundTrap.pair}
            </span>
            {typeof explanation.soundTrap !== 'string' && explanation.soundTrap.noteVi && (
              <span className="text-slate-300">{explanation.soundTrap.noteVi}</span>
            )}
          </div>
        )}

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{explanation.trapAnalysis}</p>
      </div>

      {/* 4. Option-by-option Analysis */}
      <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-3.5">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
          <ListChecks className="h-4 w-4" />
          Giải thích chi tiết từng phương án ({optionKeys.join(' / ')})
        </div>
        <ul className="mt-2 space-y-1.5 text-xs sm:text-sm">
          {optionKeys.map((k) => {
            const right = k === correctAnswer;
            return (
              <li key={k} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                    right ? 'bg-emerald-500/25 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {k}
                </span>
                <span className={right ? 'text-emerald-200 font-medium' : 'text-slate-300'}>
                  {explanation.optionAnalysis[k]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 5. Key Listening Vocabulary with Instant Save */}
      {vocabList.length > 0 && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-violet-300">
            <Sparkles className="h-4 w-4" />
            Từ vựng &amp; Cụm từ nghe trọng tâm
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {vocabList.map((v) => {
              const saved = isWordSaved(v.id);
              return (
                <div
                  key={v.id}
                  className="rounded-xl border border-slate-700/70 bg-slate-900/90 p-3 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-white">{v.word}</span>
                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                          {v.pos}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">{v.ipaUS}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => speakText(v.word, { accent: 'en-US' })}
                        className="rounded-lg bg-slate-800 p-1.5 text-cyan-400 hover:bg-indigo-600 hover:text-white transition"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-emerald-300">{v.meaning}</p>
                    <p className="mt-1 text-[11px] text-slate-400 italic">{v.exampleEn}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => saveListeningVocab(v)}
                    disabled={saved}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                      saved
                        ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 cursor-default'
                        : 'bg-indigo-600/90 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {saved ? (
                      <>
                        <BookmarkCheck className="h-3.5 w-3.5" />
                        Đã lưu vào Từ vựng của tôi
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        Lưu vào Từ vựng của tôi
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Personal Note */}
      <QuickNoteBox
        targetType="listening"
        targetId={questionId}
        title={questionLabel}
        subtitle={explanation.trapType}
        placeholder="Ghi chú lại từ nghe chưa rõ hoặc bẫy phát âm của câu này..."
      />
    </div>
  );
};
