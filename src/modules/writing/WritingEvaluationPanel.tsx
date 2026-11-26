import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookMarked,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  History,
  ListChecks,
  RotateCcw,
  Sparkles,
  Star,
  TrendingUp,
  Volume2,
  XCircle,
} from 'lucide-react';
import { WritingSubmissionRecord } from '../../types';
import { useApp } from '../../context/AppContext';
import { speakText } from '../../utils/speech';

interface WritingEvaluationPanelProps {
  submission: WritingSubmissionRecord;
  promptHistory: WritingSubmissionRecord[];
  onRewrite: () => void;
  onSelectHistoryItem: (record: WritingSubmissionRecord) => void;
}

function getVerdictStyle(verdict: WritingSubmissionRecord['evaluation']['verdictLabel']): string {
  if (verdict === 'Xuất sắc') return 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200';
  if (verdict === 'Tốt') return 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200';
  if (verdict === 'Khá ổn') return 'border-amber-400/50 bg-amber-500/20 text-amber-200';
  return 'border-rose-400/50 bg-rose-500/20 text-rose-200';
}

function getScoreBarColor(score: number): string {
  if (score >= 8.5) return 'from-emerald-500 to-teal-400';
  if (score >= 7.0) return 'from-blue-500 to-cyan-400';
  if (score >= 5.0) return 'from-amber-500 to-yellow-400';
  return 'from-rose-500 to-orange-400';
}

function getErrorBadgeColor(errorType: string): string {
  const lower = errorType.toLowerCase();
  if (lower.includes('word-by-word') || lower.includes('diễn đạt')) {
    return 'bg-violet-500/20 border-violet-400/40 text-violet-200';
  }
  if (lower.includes('giới từ')) return 'bg-amber-500/20 border-amber-400/40 text-amber-200';
  if (lower.includes('từ loại') || lower.includes('từ vựng')) {
    return 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200';
  }
  if (lower.includes('chính tả')) return 'bg-pink-500/20 border-pink-400/40 text-pink-200';
  return 'bg-rose-500/20 border-rose-400/40 text-rose-200';
}

export const WritingEvaluationPanel: React.FC<WritingEvaluationPanelProps> = ({
  submission,
  promptHistory,
  onRewrite,
  onSelectHistoryItem,
}) => {
  const { saveWritingVocab, isWritingVocabSaved } = useApp();
  const [copiedKey, setCopiedKey] = useState<'smooth' | 'upgraded' | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const ev = submission.evaluation;

  const handleCopy = async (text: string, key: 'smooth' | 'upgraded') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const criteriaRows = [
    { label: 'Ngữ pháp (Grammar)', score: ev.criteriaScores.grammar },
    { label: 'Từ vựng & Collocations (Vocabulary)', score: ev.criteriaScores.vocabulary },
    { label: 'Độ tự nhiên & Mạch lạc (Coherence & Naturalness)', score: ev.criteriaScores.coherenceNaturalness },
    { label: 'Hoàn thành yêu cầu / Sát nghĩa (Task & Accuracy)', score: ev.criteriaScores.taskAccuracy },
  ];

  // Compare with earliest attempt on same prompt if >= 2 attempts exist
  const orderedPromptHistory = [...promptHistory].sort((a, b) => a.timestamp - b.timestamp);
  const firstAttempt = orderedPromptHistory[0];
  const latestAttempt = orderedPromptHistory[orderedPromptHistory.length - 1];
  const scoreDelta =
    orderedPromptHistory.length >= 2
      ? Math.round((latestAttempt.evaluation.overallScore - firstAttempt.evaluation.overallScore) * 10) / 10
      : null;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* BLOCK 1: Overall Score & 4 Criteria */}
      <div className="rounded-3xl border border-indigo-500/35 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-5 sm:p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-indigo-400/50 bg-indigo-950/60 shadow-inner">
              <span className="text-2xl font-black text-white leading-none">
                {ev.overallScore.toFixed(1)}
              </span>
              <span className="text-[11px] font-bold text-indigo-300 mt-1">/ 10 điểm</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-0.5 text-xs font-extrabold ${getVerdictStyle(ev.verdictLabel)}`}>
                  {ev.verdictLabel}
                </span>
                <span className="rounded-full border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-200">
                  CEFR {ev.cefrLevel}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-slate-300">
                  Ước lượng TOEIC Writing: {ev.toeicWritingEstimate}/200
                </span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl">
                {ev.summaryFeedbackVi}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Lần nộp #{submission.attemptNumber} • {submission.wordCount} từ • Chấm bởi{' '}
                <span className="font-mono text-indigo-300">{submission.modelUsed}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRewrite}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            Viết lại để cải thiện điểm
          </button>
        </div>

        {/* 4 Criteria Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {criteriaRows.map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-200">{c.label}</span>
                <span className="font-extrabold text-white">{c.score.toFixed(1)}/10</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${getScoreBarColor(c.score)} transition-all duration-500`}
                  style={{ width: `${Math.min(100, c.score * 10)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BLOCK 2: Inline Corrections */}
      <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            2. Sửa lỗi chi tiết từng câu &amp; Diễn đạt chưa tự nhiên ({ev.inlineCorrections.length})
          </div>
        </div>

        {ev.inlineCorrections.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/25 p-4 text-sm text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            Tuyệt vời! Gemini không phát hiện lỗi ngữ pháp hay diễn đạt đáng kể nào trong bài viết của bạn.
          </div>
        ) : (
          <div className="space-y-3">
            {ev.inlineCorrections.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-400">Điểm cần sửa #{idx + 1}</span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${getErrorBadgeColor(
                      item.errorType
                    )}`}
                  >
                    {item.errorType}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm leading-relaxed">
                  <span className="rounded-lg bg-rose-500/15 border border-rose-500/35 px-2.5 py-1 text-rose-200 line-through decoration-rose-400 decoration-2">
                    {item.original}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 font-semibold text-emerald-200">
                    {item.corrected}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  <span className="font-bold text-cyan-300">Bản chất: </span>
                  {item.explanationVi}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BLOCK 3: Faithfulness & Checklist Audit */}
      <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <ListChecks className="h-4 w-4 text-cyan-400" />
          3. Mức độ bám sát đoạn gốc &amp; Checklist yêu cầu
        </div>

        <p className="rounded-2xl border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-xs sm:text-sm text-cyan-100 leading-relaxed">
          {ev.faithfulnessSummaryVi}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ev.checklistEvaluation.map((chk, idx) => {
            const isMet = chk.status === 'met';
            const isMissed = chk.status === 'missed';
            return (
              <div
                key={idx}
                className={`rounded-2xl border p-3.5 space-y-1.5 ${
                  isMet
                    ? 'border-emerald-500/35 bg-emerald-950/20'
                    : isMissed
                    ? 'border-rose-500/35 bg-rose-950/20'
                    : 'border-amber-500/35 bg-amber-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-white leading-snug">{chk.requirement}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                      isMet
                        ? 'bg-emerald-500/25 text-emerald-200'
                        : isMissed
                        ? 'bg-rose-500/25 text-rose-200'
                        : 'bg-amber-500/25 text-amber-200'
                    }`}
                  >
                    {isMet ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Đạt tốt
                      </>
                    ) : isMissed ? (
                      <>
                        <XCircle className="h-3 w-3" /> Sót / Lệch
                      </>
                    ) : (
                      <>Đạt một phần</>
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{chk.noteVi}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOCK 4: Two Reference Versions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Smooth Revision */}
        <div className="rounded-3xl border border-blue-500/30 bg-[#111827] p-5 space-y-3 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="rounded-md bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-extrabold uppercase text-blue-200">
                Band B1/B2 • Giữ nguyên ý bạn viết
              </span>
              <h4 className="mt-1.5 text-sm font-extrabold text-white">
                4A. Bản sửa mượt (Tối ưu câu chữ của bạn)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(ev.smoothRevision, 'smooth')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 transition"
            >
              {copiedKey === 'smooth' ? (
                <>
                  <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Đã chép
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-100 leading-relaxed whitespace-pre-line">
            {ev.smoothRevision || '—'}
          </div>
        </div>

        {/* Upgraded C1 Version */}
        <div className="rounded-3xl border border-violet-500/35 bg-gradient-to-br from-violet-950/30 via-[#111827] to-[#0F172A] p-5 space-y-3 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="rounded-md bg-violet-500/20 border border-violet-400/40 px-2 py-0.5 text-[10px] font-extrabold uppercase text-violet-200">
                Band C1 • TOEIC Writing 180–200
              </span>
              <h4 className="mt-1.5 text-sm font-extrabold text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-violet-400" />
                4B. Bản nâng cấp chuyên nghiệp (Chuẩn bản xứ)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(ev.upgradedVersion, 'upgraded')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/20 hover:bg-violet-500/30 px-3 py-1.5 text-xs font-bold text-violet-100 transition"
            >
              {copiedKey === 'upgraded' ? (
                <>
                  <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Đã chép
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="flex-1 rounded-2xl border border-violet-500/25 bg-slate-950/75 p-4 text-sm text-slate-100 leading-relaxed whitespace-pre-line">
            {ev.upgradedVersion || '—'}
          </div>
        </div>
      </div>

      {/* BLOCK 5: High-Value Vocab & Structures */}
      <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <BookMarked className="h-4 w-4 text-amber-400" />
            5. Từ vựng &amp; Cấu trúc ăn điểm từ bài sửa ({ev.vocabTakeaways.length})
          </div>
          <span className="text-[11px] text-slate-400">
            Bấm ★ để lưu thẳng vào kho <strong>Từ vựng của tôi</strong> ôn theo SRS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {ev.vocabTakeaways.map((v, idx) => {
            const saved = isWritingVocabSaved(v.word);
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-white">{v.word}</span>
                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                          {v.pos}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{v.ipa}</span>
                        <button
                          type="button"
                          onClick={() => speakText(v.word)}
                          title="Nghe phát âm"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-cyan-300 transition"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-amber-200">{v.meaningVi}</p>
                    </div>
                  </div>
                  {v.exampleEn && (
                    <div className="rounded-xl bg-slate-900/90 border border-slate-800/90 p-2.5 text-xs space-y-0.5">
                      <p className="text-slate-200 italic">&ldquo;{v.exampleEn}&rdquo;</p>
                      {v.exampleVi && <p className="text-slate-400">{v.exampleVi}</p>}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saved}
                    onClick={() => saveWritingVocab(v)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      saved
                        ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 cursor-default'
                        : 'border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200'
                    }`}
                  >
                    {saved ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Đã lưu vào Từ vựng của tôi
                      </>
                    ) : (
                      <>
                        <Star className="h-3.5 w-3.5" />
                        Lưu vào Từ vựng của tôi
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOCK 6: Attempt History & Progress Comparison */}
      <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <History className="h-4 w-4 text-indigo-400" />
            6. Lịch sử &amp; Tiến bộ trên bài viết này ({orderedPromptHistory.length} lần nộp)
          </div>

          <div className="flex items-center gap-2">
            {scoreDelta !== null && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${
                  scoreDelta > 0
                    ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200'
                    : scoreDelta < 0
                    ? 'bg-rose-500/20 border border-rose-400/40 text-rose-200'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Lần 1 → Lần {orderedPromptHistory.length}: {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} điểm
              </span>
            )}
            {orderedPromptHistory.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowCompare((v) => !v)}
                className="rounded-xl border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 px-3 py-1.5 text-xs font-bold text-indigo-200 transition"
              >
                {showCompare ? 'Ẩn so sánh Lần 1 vs Mới nhất' : 'So sánh Lần 1 vs Mới nhất'}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {orderedPromptHistory.map((rec) => {
            const isViewing = rec.id === submission.id;
            return (
              <button
                key={rec.id}
                type="button"
                onClick={() => onSelectHistoryItem(rec)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  isViewing
                    ? 'border-indigo-400 bg-indigo-600/30 text-white'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Award className="h-3.5 w-3.5 text-amber-400" />
                <span>Lần {rec.attemptNumber}</span>
                <span className="rounded bg-black/30 px-1.5 py-0.5 text-emerald-300">
                  {rec.evaluation.overallScore.toFixed(1)}/10
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(rec.timestamp).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </button>
            );
          })}
        </div>

        {showCompare && orderedPromptHistory.length >= 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300">Lần 1 ({firstAttempt.wordCount} từ)</span>
                <span className="text-amber-300">{firstAttempt.evaluation.overallScore.toFixed(1)}/10 • {firstAttempt.evaluation.cefrLevel}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                {firstAttempt.userText}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/35 bg-emerald-950/15 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-200">Lần {latestAttempt.attemptNumber} ({latestAttempt.wordCount} từ)</span>
                <span className="text-emerald-300">{latestAttempt.evaluation.overallScore.toFixed(1)}/10 • {latestAttempt.evaluation.cefrLevel}</span>
              </div>
              <p className="text-xs text-slate-100 leading-relaxed whitespace-pre-line">
                {latestAttempt.userText}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
