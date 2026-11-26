import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  History,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { OptionKey, Part2OptionKey, ToeicPartNumber, WrongQuestionRecord } from '../../types';
import { useApp } from '../../context/AppContext';
import { getToeicLevelBadge } from '../../utils/toeicScore';
import {
  Part1QuestionBlock,
  Part2QuestionBlock,
  Part34SetBlock,
  Part5QuestionBlock,
  Part6PassageBlock,
  Part7SetBlock,
} from './ToeicQuestionRenderers';

interface WrongNotebookViewProps {
  onRetakeTest?: (testId: string) => void;
}

export const WrongNotebookView: React.FC<WrongNotebookViewProps> = ({ onRetakeTest }) => {
  const { wrongQuestions, resolveWrongQuestion, clearAllWrongQuestions, examHistory } = useApp();
  const [subTab, setSubTab] = useState<'wrong' | 'history'>('wrong');
  const [partFilter, setPartFilter] = useState<ToeicPartNumber | 'all'>('all');
  const [retryAnswers, setRetryAnswers] = useState<Record<string, string>>({});
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  const filteredWrong = useMemo(() => {
    if (partFilter === 'all') return wrongQuestions;
    return wrongQuestions.filter((w) => w.part === partFilter);
  }, [wrongQuestions, partFilter]);

  const handleCheckRetry = (rec: WrongQuestionRecord) => {
    setCheckedIds((prev) => ({ ...prev, [rec.id]: true }));
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}p ${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#111827] p-3.5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('wrong')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
              subTab === 'wrong'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Làm lại câu sai ({wrongQuestions.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
              subTab === 'history'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <History className="h-4 w-4" />
            Lịch sử làm đề ETS ({examHistory.length})
          </button>
        </div>

        {subTab === 'wrong' && wrongQuestions.length > 0 && (
          <button
            type="button"
            onClick={clearAllWrongQuestions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:border-rose-500/50 hover:text-rose-300 px-3 py-1.5 text-xs font-bold text-slate-400 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa toàn bộ sổ câu sai
          </button>
        )}
      </div>

      {/* SUB-TAB 1: WRONG QUESTIONS NOTEBOOK */}
      {subTab === 'wrong' && (
        <div className="space-y-4">
          {/* Part Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPartFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                partFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Tất cả ({wrongQuestions.length})
            </button>
            {([1, 2, 3, 4, 5, 6, 7] as ToeicPartNumber[]).map((p) => {
              const cnt = wrongQuestions.filter((w) => w.part === p).length;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPartFilter(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    partFilter === p
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Part {p} ({cnt})
                </button>
              );
            })}
          </div>

          {filteredWrong.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 text-center space-y-2">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="text-base font-extrabold text-white">
                {wrongQuestions.length === 0
                  ? 'Sổ tay câu sai đang sạch bóng!'
                  : `Không có câu sai nào ở Part ${partFilter}`}
              </p>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Mọi câu bạn chọn sai trong Đề thi ETS hoặc Bài tập 7 Part sẽ tự động gom về đây để bạn làm lại cho tới khi thuộc hẳn.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredWrong.map((rec, idx) => {
                const isChecked = Boolean(checkedIds[rec.id]);
                const userAns = retryAnswers[rec.id];
                const isNowRight = isChecked && userAns === rec.correctAnswer;

                return (
                  <div
                    key={rec.id}
                    className="rounded-3xl border border-slate-700/80 bg-[#111827] p-4 sm:p-5 space-y-4"
                  >
                    {/* Header Metadata */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-lg bg-rose-500/20 border border-rose-500/35 px-2.5 py-1 text-xs font-extrabold text-rose-300">
                          Sai {rec.wrongCount} lần • Part {rec.part}
                        </span>
                        <span className="text-xs font-bold text-slate-200">{rec.sourceTitle}</span>
                        <span className="text-xs text-slate-400">({rec.topicLabel})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isNowRight && (
                          <button
                            type="button"
                            onClick={() => resolveWrongQuestion(rec.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-white transition"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Đánh dấu đã khắc phục (Gỡ khỏi sổ sai)
                          </button>
                        )}
                        {isChecked && !isNowRight && (
                          <button
                            type="button"
                            onClick={() => {
                              setCheckedIds((p) => ({ ...p, [rec.id]: false }));
                              setRetryAnswers((p) => {
                                const c = { ...p };
                                delete c[rec.id];
                                return c;
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Thử làm lại
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Render interactive retry question by payload kind */}
                    {rec.payload.kind === 'part1' && (
                      <Part1QuestionBlock
                        item={rec.payload.item}
                        displayNumber={idx + 1}
                        selected={userAns as OptionKey | undefined}
                        onSelect={(opt) => setRetryAnswers((p) => ({ ...p, [rec.id]: opt }))}
                        showExplanation={isChecked}
                        onCheckSingle={() => handleCheckRetry(rec)}
                      />
                    )}
                    {rec.payload.kind === 'part2' && (
                      <Part2QuestionBlock
                        item={rec.payload.item}
                        displayNumber={idx + 1}
                        selected={userAns as Part2OptionKey | undefined}
                        onSelect={(opt) => setRetryAnswers((p) => ({ ...p, [rec.id]: opt }))}
                        showExplanation={isChecked}
                        onCheckSingle={() => handleCheckRetry(rec)}
                      />
                    )}
                    {(rec.payload.kind === 'part3' || rec.payload.kind === 'part4') && (
                      <Part34SetBlock
                        set={rec.payload.set}
                        startQuestionNumber={idx + 1}
                        answers={{ [rec.payload.questionId]: (userAns || '') as OptionKey }}
                        onSelect={(_qId, opt) => setRetryAnswers((p) => ({ ...p, [rec.id]: opt }))}
                        showExplanation={isChecked}
                        onCheckSet={() => handleCheckRetry(rec)}
                        onlyQuestionId={rec.payload.questionId}
                      />
                    )}
                    {rec.payload.kind === 'part5' && (
                      <Part5QuestionBlock
                        item={rec.payload.item}
                        displayNumber={idx + 1}
                        selected={userAns as OptionKey | undefined}
                        onSelect={(opt) => setRetryAnswers((p) => ({ ...p, [rec.id]: opt }))}
                        showExplanation={isChecked}
                        onCheckSingle={() => handleCheckRetry(rec)}
                      />
                    )}
                    {rec.payload.kind === 'part6' && (
                      <Part6PassageBlock
                        passage={rec.payload.passage}
                        startQuestionNumber={idx + 1}
                        answers={{ [rec.payload.questionId]: (userAns || '') as OptionKey }}
                        onSelect={(_qId, opt) => setRetryAnswers((p) => ({ ...p, [rec.id]: opt }))}
                        showExplanation={isChecked}
                        onCheckPassage={() => handleCheckRetry(rec)}
                        onlyQuestionId={rec.payload.questionId}
                      />
                    )}
                    {rec.payload.kind === 'part7' && (
                      <Part7SetBlock
                        set={rec.payload.set}
                        startQuestionNumber={idx + 1}
                        answers={{ [rec.payload.questionId]: (userAns || '') as OptionKey }}
                        onSelect={(_qId, opt) => setRetryAnswers((p) => ({ ...p, [rec.id]: opt }))}
                        showExplanation={isChecked}
                        onCheckSet={() => handleCheckRetry(rec)}
                        onlyQuestionId={rec.payload.questionId}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ETS EXAM HISTORY */}
      {subTab === 'history' && (
        <div className="space-y-4">
          {examHistory.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 text-center space-y-2">
              <Award className="mx-auto h-10 w-10 text-slate-500" />
              <p className="text-base font-extrabold text-white">Chưa có lịch sử làm đề ETS</p>
              <p className="text-xs sm:text-sm text-slate-400">
                Hãy chọn một bộ đề ở tab <b>Bộ đề thi chuẩn ETS</b> để nhận bảng quy đổi điểm 990 và lưu lịch sử chi tiết!
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {examHistory.map((h) => {
                const level = getToeicLevelBadge(h.totalScore);
                const totalC = h.listeningCorrect + h.readingCorrect;
                const totalQ = h.listeningTotal + h.readingTotal;
                return (
                  <div
                    key={h.id}
                    className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-extrabold text-white">{h.testTitle}</h4>
                        <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-300 uppercase">
                          {h.mode === 'full' ? 'Full Test' : h.mode === 'mini' ? 'Mini Test' : 'Luyện Part lẻ'}
                        </span>
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${level.colorClass}`}>
                          {level.cefr}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(h.timestamp).toLocaleString('vi-VN')} • Thời gian: {formatDuration(h.elapsedSeconds)}
                        </span>
                        <span>
                          Đúng <b className="text-white">{totalC}/{totalQ}</b> ({Math.round((totalC / Math.max(1, totalQ)) * 100)}%)
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {h.partBreakdown.map((pb) => {
                          const pct = Math.round((pb.correct / Math.max(1, pb.total)) * 100);
                          return (
                            <span
                              key={pb.part}
                              className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
                                pct >= 80
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : pct >= 50
                                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                                  : 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                              }`}
                            >
                              P{pb.part}: {pb.correct}/{pb.total}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-2.5 text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Quy đổi TOEIC</p>
                        <p className="text-2xl font-black bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                          {h.totalScore !== null ? `${h.totalScore}/990` : h.listeningScore !== null ? `L: ${h.listeningScore}` : `R: ${h.readingScore}`}
                        </p>
                        {h.totalScore !== null && (
                          <p className="text-[10px] text-slate-400">
                            L: {h.listeningScore} • R: {h.readingScore}
                          </p>
                        )}
                      </div>

                      {onRetakeTest && (
                        <button
                          type="button"
                          onClick={() => onRetakeTest(h.testId)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 px-3.5 py-2.5 text-xs font-bold text-indigo-200 transition"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Thi lại
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
