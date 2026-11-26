import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  GitBranch,
  Languages,
  Layers,
  Lightbulb,
  Link2,
  MapPin,
  SearchCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { OptionKey, ReadingExplanation } from '../../types';
import { QuickNoteBox } from '../../components/QuickNoteBox';

interface ReadingExplanationCardProps {
  questionId: string;
  questionLabel: string;
  correctAnswer: OptionKey;
  userAnswer?: OptionKey;
  explanation: ReadingExplanation;
  onLocateEvidence?: (passageIndex: number, sentenceId: string) => void;
}

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

export const ReadingExplanationCard: React.FC<ReadingExplanationCardProps> = ({
  questionId,
  questionLabel,
  correctAnswer,
  userAnswer,
  explanation,
  onLocateEvidence,
}) => {
  const isCorrect = userAnswer === correctAnswer;

  return (
    <div className="mt-4 rounded-2xl border border-indigo-500/35 bg-[#0F172A]/95 p-4 sm:p-5 space-y-4 shadow-lg">
      {/* Banner Result */}
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

        {onLocateEvidence && explanation.proof.evidenceSentenceId && (
          <button
            type="button"
            onClick={() =>
              onLocateEvidence(
                explanation.proof.evidencePassageIndex ?? 0,
                explanation.proof.evidenceSentenceId!
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 hover:bg-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-200 transition active:scale-95"
          >
            <MapPin className="h-3.5 w-3.5 text-amber-400" />
            Xem dẫn chứng trên bài đọc
          </button>
        )}
      </div>

      {/* 1. Phân loại & Dấu hiệu nhận biết */}
      <div className="rounded-xl border border-blue-500/25 bg-blue-950/25 p-3.5">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-blue-300">
          <SearchCheck className="h-4 w-4" />
          1. Phân loại &amp; Dấu hiệu nhận biết
        </div>
        <p className="mt-1.5 text-sm font-bold text-white">{explanation.classification.category}</p>
        <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <span className="font-semibold text-blue-200">Dấu hiệu: </span>
          {explanation.classification.signal}
        </p>
      </div>

      {/* 2. Dịch nghĩa song ngữ đầy đủ */}
      <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-3.5">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-cyan-300">
          <Languages className="h-4 w-4" />
          2. Dịch nghĩa song ngữ câu hỏi &amp; 4 đáp án
        </div>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
          <span className="font-semibold text-cyan-200">Dịch câu: </span>
          {explanation.translation.questionVi}
        </p>
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
          {OPTION_KEYS.map((k) => (
            <div
              key={k}
              className={`rounded-lg px-2.5 py-1.5 border ${
                k === correctAnswer
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-slate-800 bg-slate-950/50 text-slate-300'
              }`}
            >
              <span className="font-extrabold mr-1.5">({k})</span>
              {explanation.translation.optionsVi[k]}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Chứng minh đáp án đúng & Dẫn chứng */}
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3.5">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          3. Chứng minh đáp án đúng &amp; Dẫn chứng
        </div>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
          {explanation.proof.explanation}
        </p>
        {explanation.proof.evidenceQuote && (
          <blockquote className="mt-2 rounded-lg border-l-4 border-amber-400 bg-amber-500/10 px-3 py-2 text-xs italic text-amber-100">
            &ldquo;{explanation.proof.evidenceQuote}&rdquo;
          </blockquote>
        )}

        {/* Part 5 Deep Block: Structure Breakdown (S / V / O / Modifiers) */}
        {explanation.structureBreakdown && (
          <div className="mt-3 rounded-xl border border-cyan-500/30 bg-slate-950/75 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
              <GitBranch className="h-3.5 w-3.5" />
              Phân tích khung câu (S / V / O / Bổ nghĩa)
            </div>
            {typeof explanation.structureBreakdown === 'string' ? (
              <p className="font-mono text-xs text-cyan-100 leading-relaxed">
                {explanation.structureBreakdown}
              </p>
            ) : (
              <div className="space-y-2">
                {explanation.structureBreakdown.fullStructure && (
                  <p className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2 font-mono text-xs text-white leading-relaxed">
                    {explanation.structureBreakdown.fullStructure}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                  {explanation.structureBreakdown.subject && (
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/25 px-2.5 py-1.5">
                      <span className="block text-[10px] font-bold uppercase text-blue-300">Chủ ngữ (S)</span>
                      <span className="text-slate-100 font-medium">{explanation.structureBreakdown.subject}</span>
                    </div>
                  )}
                  {explanation.structureBreakdown.verb && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1.5">
                      <span className="block text-[10px] font-bold uppercase text-emerald-300">Động từ (V)</span>
                      <span className="text-slate-100 font-medium">{explanation.structureBreakdown.verb}</span>
                    </div>
                  )}
                  {explanation.structureBreakdown.object && (
                    <div className="rounded-lg bg-violet-500/10 border border-violet-500/25 px-2.5 py-1.5">
                      <span className="block text-[10px] font-bold uppercase text-violet-300">Tân ngữ (O)</span>
                      <span className="text-slate-100 font-medium">{explanation.structureBreakdown.object}</span>
                    </div>
                  )}
                  {explanation.structureBreakdown.modifiers && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-2.5 py-1.5 sm:col-span-2 lg:col-span-4">
                      <span className="block text-[10px] font-bold uppercase text-amber-300">Cụm bổ nghĩa / Điểm mấu chốt</span>
                      <span className="text-slate-200">{explanation.structureBreakdown.modifiers}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Part 6 Deep Block: Context Bridge (Before -> Connector/Ref -> After) */}
        {explanation.contextBridge && (
          <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-950/25 p-3 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
                <Link2 className="h-3.5 w-3.5" />
                Cầu nối ngữ cảnh (Context Bridge)
              </span>
              <span className="rounded-md bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
                {explanation.contextBridge.connectorOrRef}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2.5">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Câu trước chỗ trống</span>
                <p className="text-slate-200 italic leading-relaxed">{explanation.contextBridge.beforeCue}</p>
              </div>
              <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2.5">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Câu sau chỗ trống</span>
                <p className="text-slate-200 italic leading-relaxed">{explanation.contextBridge.afterCue}</p>
              </div>
            </div>
            <p className="text-xs text-indigo-100/95 leading-relaxed">
              <span className="font-bold text-cyan-300">Logic liên kết: </span>
              {explanation.contextBridge.logicVi}
            </p>
          </div>
        )}

        {/* Part 7 Deep Block: Cross-Passage Synthesis (Double / Triple Passage) */}
        {explanation.crossPassageLogic && (
          <div className="mt-3 rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-fuchsia-300">
              <Layers className="h-3.5 w-3.5" />
              Sơ đồ liên kết thông tin chéo (Cross-Passage Logic)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-950/75 border border-cyan-500/30 p-2.5">
                <span className="inline-block rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-cyan-300 mb-1">
                  {explanation.crossPassageLogic.clue1Label}
                </span>
                <p className="text-slate-200 leading-relaxed">{explanation.crossPassageLogic.clue1Text}</p>
              </div>
              <div className="rounded-lg bg-slate-950/75 border border-amber-500/30 p-2.5">
                <span className="inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300 mb-1">
                  {explanation.crossPassageLogic.clue2Label}
                </span>
                <p className="text-slate-200 leading-relaxed">{explanation.crossPassageLogic.clue2Text}</p>
              </div>
              {explanation.crossPassageLogic.clue3Text && (
                <div className="rounded-lg bg-slate-950/75 border border-violet-500/30 p-2.5 md:col-span-2">
                  <span className="inline-block rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-violet-300 mb-1">
                    {explanation.crossPassageLogic.clue3Label || 'Mảnh ghép Đoạn 3'}
                  </span>
                  <p className="text-slate-200 leading-relaxed">{explanation.crossPassageLogic.clue3Text}</p>
                </div>
              )}
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/35 px-3 py-2 text-xs text-emerald-200 font-semibold">
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{explanation.crossPassageLogic.deduction}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Phân tích loại trừ từng đáp án sai */}
      <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-3.5">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-rose-300">
          <AlertTriangle className="h-4 w-4" />
          4. Phân tích loại trừ từng đáp án (A / B / C / D)
        </div>
        <ul className="mt-2 space-y-1.5 text-xs sm:text-sm">
          {OPTION_KEYS.map((k) => {
            const right = k === correctAnswer;
            return (
              <li key={k} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                    right
                      ? 'bg-emerald-500/25 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {k}
                </span>
                <span className={right ? 'text-emerald-200 font-medium' : 'text-slate-300'}>
                  {explanation.wrongOptionsAnalysis[k]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 5. Ghi nhớ & Bẫy thường gặp + Bảng Paraphrase */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3.5 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-violet-300">
          <Lightbulb className="h-4 w-4" />
          5. Ghi nhớ cốt lõi, Bẫy thường gặp &amp; Bảng Paraphrase
        </div>
        {explanation.applyRule && (
          <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-r from-emerald-950/40 to-teal-950/30 px-3.5 py-2.5 flex items-start gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="text-xs">
              <span className="font-extrabold uppercase tracking-wider text-emerald-300 mr-1.5">
                Công thức áp dụng nhanh (Apply Rule):
              </span>
              <span className="font-semibold text-white leading-relaxed">{explanation.applyRule}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs sm:text-sm">
          <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
            <p className="text-[11px] font-bold text-indigo-300 uppercase">Công thức / Cấu trúc ăn điểm</p>
            <p className="mt-1 font-mono text-xs text-white">{explanation.keyTakeaways.formula}</p>
          </div>
          <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
            <p className="text-[11px] font-bold text-amber-300 uppercase">Bẫy ETS thường gặp</p>
            <p className="mt-1 text-xs text-slate-300">{explanation.keyTakeaways.commonTrap}</p>
          </div>
        </div>

        {explanation.keyTakeaways.paraphrases.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Cụm từ trong bài đọc</th>
                  <th className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      <ArrowRightLeft className="h-3 w-3 text-cyan-400" />
                      Paraphrase trong đáp án
                    </span>
                  </th>
                  <th className="px-3 py-2">Nghĩa tiếng Việt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {explanation.keyTakeaways.paraphrases.map((p, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-semibold text-amber-200">{p.textInPassage}</td>
                    <td className="px-3 py-2 font-semibold text-cyan-300">{p.textInAnswer}</td>
                    <td className="px-3 py-2 text-slate-300">{p.meaningVi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline Personal Note */}
      <QuickNoteBox
        targetType="reading"
        targetId={questionId}
        title={questionLabel}
        subtitle={explanation.classification.category}
        placeholder="Ghi chú lại công thức hoặc lỗi sai của câu này để ôn lại..."
      />
    </div>
  );
};
