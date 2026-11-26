import React, { useMemo, useState } from 'react';
import { ArrowLeft, Award, CheckCircle2, RotateCcw, Send } from 'lucide-react';
import { OptionKey, Part2OptionKey, ToeicDrillData } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Part1QuestionBlock,
  Part2QuestionBlock,
  Part34SetBlock,
  Part5QuestionBlock,
  Part6PassageBlock,
  Part7SetBlock,
} from './ToeicQuestionRenderers';

interface ToeicDrillRunnerProps {
  drill: ToeicDrillData;
  onBack: () => void;
}

export const ToeicDrillRunner: React.FC<ToeicDrillRunnerProps> = ({ drill, onBack }) => {
  const { recordAttempt, recordWrongQuestion } = useApp();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [allSubmitted, setAllSubmitted] = useState(false);

  const flatQuestions = useMemo(() => {
    const out: { id: string; correct: string; topic: string }[] = [];
    (drill.part1 || []).forEach((q) => out.push({ id: q.id, correct: q.correctAnswer, topic: `Part 1 — ${drill.focusTag}` }));
    (drill.part2 || []).forEach((q) => out.push({ id: q.id, correct: q.correctAnswer, topic: `Part 2 — ${drill.focusTag}` }));
    (drill.part3 || []).forEach((s) => s.questions.forEach((q) => out.push({ id: q.id, correct: q.correctAnswer, topic: `Part 3 — ${drill.focusTag}` })));
    (drill.part4 || []).forEach((s) => s.questions.forEach((q) => out.push({ id: q.id, correct: q.correctAnswer, topic: `Part 4 — ${drill.focusTag}` })));
    (drill.part5 || []).forEach((q) => out.push({ id: q.id, correct: q.correctAnswer, topic: `Part 5 — ${q.topic}` }));
    (drill.part6 || []).forEach((p) => p.questions.forEach((q) => out.push({ id: q.id, correct: q.correctAnswer, topic: `Part 6 — ${q.questionType}` })));
    (drill.part7 || []).forEach((s) => s.questions.forEach((q) => out.push({ id: q.id, correct: q.correctAnswer, topic: `Part 7 — ${q.questionType}` })));
    return out;
  }, [drill]);

  const answeredCount = flatQuestions.filter((q) => Boolean(answers[q.id])).length;
  const correctCount = flatQuestions.filter((q) => answers[q.id] === q.correct).length;

  const logSingleOrGroup = (groupKey: string, qIds: string[]) => {
    if (revealedKeys[groupKey]) return;
    setRevealedKeys((prev) => ({ ...prev, [groupKey]: true }));

    const items = flatQuestions.filter((q) => qIds.includes(q.id));
    const okCount = items.filter((q) => answers[q.id] === q.correct).length;
    recordAttempt({
      module: drill.part <= 4 ? 'listening' : 'reading',
      partLabel: `Part ${drill.part}`,
      correctCount: okCount,
      totalCount: items.length,
      topics: items.map((q) => ({ topic: q.topic, correct: answers[q.id] === q.correct })),
    });

    // Save wrong questions into "Sổ tay câu sai"
    saveWrongsForIds(qIds);
  };

  const saveWrongsForIds = (qIds: string[]) => {
    const idSet = new Set(qIds);
    (drill.part1 || []).forEach((item) => {
      if (idSet.has(item.id) && answers[item.id] !== item.correctAnswer) {
        recordWrongQuestion({
          id: item.id,
          part: 1,
          sourceTitle: drill.title,
          topicLabel: item.title,
          userWrongAnswer: answers[item.id] || 'Chưa chọn',
          correctAnswer: item.correctAnswer,
          payload: { kind: 'part1', item },
        });
      }
    });
    (drill.part2 || []).forEach((item) => {
      if (idSet.has(item.id) && answers[item.id] !== item.correctAnswer) {
        recordWrongQuestion({
          id: item.id,
          part: 2,
          sourceTitle: drill.title,
          topicLabel: item.title,
          userWrongAnswer: answers[item.id] || 'Chưa chọn',
          correctAnswer: item.correctAnswer,
          payload: { kind: 'part2', item },
        });
      }
    });
    (drill.part3 || []).forEach((set) => {
      set.questions.forEach((q) => {
        if (idSet.has(q.id) && answers[q.id] !== q.correctAnswer) {
          recordWrongQuestion({
            id: q.id,
            part: 3,
            sourceTitle: drill.title,
            topicLabel: `${set.title} — ${q.questionType}`,
            userWrongAnswer: answers[q.id] || 'Chưa chọn',
            correctAnswer: q.correctAnswer,
            payload: { kind: 'part3', set, questionId: q.id },
          });
        }
      });
    });
    (drill.part4 || []).forEach((set) => {
      set.questions.forEach((q) => {
        if (idSet.has(q.id) && answers[q.id] !== q.correctAnswer) {
          recordWrongQuestion({
            id: q.id,
            part: 4,
            sourceTitle: drill.title,
            topicLabel: `${set.title} — ${q.questionType}`,
            userWrongAnswer: answers[q.id] || 'Chưa chọn',
            correctAnswer: q.correctAnswer,
            payload: { kind: 'part4', set, questionId: q.id },
          });
        }
      });
    });
    (drill.part5 || []).forEach((item) => {
      if (idSet.has(item.id) && answers[item.id] !== item.correctAnswer) {
        recordWrongQuestion({
          id: item.id,
          part: 5,
          sourceTitle: drill.title,
          topicLabel: item.topic,
          userWrongAnswer: answers[item.id] || 'Chưa chọn',
          correctAnswer: item.correctAnswer,
          payload: { kind: 'part5', item },
        });
      }
    });
    (drill.part6 || []).forEach((passage) => {
      passage.questions.forEach((q) => {
        if (idSet.has(q.id) && answers[q.id] !== q.correctAnswer) {
          recordWrongQuestion({
            id: q.id,
            part: 6,
            sourceTitle: drill.title,
            topicLabel: `${passage.title} — ${q.questionType}`,
            userWrongAnswer: answers[q.id] || 'Chưa chọn',
            correctAnswer: q.correctAnswer,
            payload: { kind: 'part6', passage, questionId: q.id },
          });
        }
      });
    });
    (drill.part7 || []).forEach((set) => {
      set.questions.forEach((q) => {
        if (idSet.has(q.id) && answers[q.id] !== q.correctAnswer) {
          recordWrongQuestion({
            id: q.id,
            part: 7,
            sourceTitle: drill.title,
            topicLabel: `${set.title} — ${q.questionType}`,
            userWrongAnswer: answers[q.id] || 'Chưa chọn',
            correctAnswer: q.correctAnswer,
            payload: { kind: 'part7', set, questionId: q.id },
          });
        }
      });
    });
  };

  const handleSubmitAll = () => {
    if (allSubmitted) return;
    setAllSubmitted(true);
    const remainingIds = flatQuestions.filter((q) => !revealedKeys[q.id]).map((q) => q.id);
    if (remainingIds.length > 0) {
      const items = flatQuestions.filter((q) => remainingIds.includes(q.id));
      recordAttempt({
        module: drill.part <= 4 ? 'listening' : 'reading',
        partLabel: `Part ${drill.part}`,
        correctCount: items.filter((q) => answers[q.id] === q.correct).length,
        totalCount: items.length,
        topics: items.map((q) => ({ topic: q.topic, correct: answers[q.id] === q.correct })),
      });
      saveWrongsForIds(remainingIds);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setRevealedKeys({});
    setAllSubmitted(false);
  };

  let runningNum = 1;

  return (
    <div className="space-y-5">
      {/* Top Sticky Bar */}
      <div className="sticky top-16 z-20 rounded-2xl border border-slate-700/80 bg-[#0F172A]/95 backdrop-blur-md p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-extrabold text-indigo-300">
                Part {drill.part}
              </span>
              <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                {drill.focusTag}
              </span>
            </div>
            <h3 className="truncate text-sm sm:text-base font-extrabold text-white mt-0.5">{drill.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300">
            Đã chọn: <span className="text-sky-400">{answeredCount}/{flatQuestions.length}</span>
          </span>

          {!allSubmitted ? (
            <button
              type="button"
              onClick={handleSubmitAll}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 px-4 py-2 text-xs font-extrabold text-white shadow-glow transition"
            >
              <Send className="h-3.5 w-3.5" />
              Chấm toàn bài
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Làm lại chuyên đề
            </button>
          )}
        </div>
      </div>

      {/* Summary Banner when Submitted */}
      {allSubmitted && (
        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 via-[#152033] to-indigo-950/50 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                Hoàn thành chuyên đề Part {drill.part}
              </p>
              <h4 className="text-xl font-extrabold text-white">
                Đúng {correctCount}/{flatQuestions.length} câu ({Math.round((correctCount / Math.max(1, flatQuestions.length)) * 100)}%)
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {flatQuestions.length - correctCount > 0
                  ? `${flatQuestions.length - correctCount} câu làm sai đã được tự động lưu vào tab "Làm lại câu sai"!`
                  : 'Tuyệt đối chính xác 100%! Không có câu sai nào.'}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Đã mở toàn bộ giải thích chi tiết bên dưới
          </div>
        </div>
      )}

      {/* Render items by Part */}
      <div className="space-y-6">
        {(drill.part1 || []).map((item) => {
          const num = runningNum++;
          return (
            <Part1QuestionBlock
              key={item.id}
              item={item}
              displayNumber={num}
              selected={answers[item.id] as OptionKey | undefined}
              onSelect={(opt) => setAnswers((p) => ({ ...p, [item.id]: opt }))}
              showExplanation={allSubmitted || Boolean(revealedKeys[item.id])}
              onCheckSingle={() => logSingleOrGroup(item.id, [item.id])}
            />
          );
        })}

        {(drill.part2 || []).map((item) => {
          const num = runningNum++;
          return (
            <Part2QuestionBlock
              key={item.id}
              item={item}
              displayNumber={num}
              selected={answers[item.id] as Part2OptionKey | undefined}
              onSelect={(opt) => setAnswers((p) => ({ ...p, [item.id]: opt }))}
              showExplanation={allSubmitted || Boolean(revealedKeys[item.id])}
              onCheckSingle={() => logSingleOrGroup(item.id, [item.id])}
            />
          );
        })}

        {(drill.part3 || []).map((set) => {
          const startNum = runningNum;
          runningNum += set.questions.length;
          return (
            <Part34SetBlock
              key={set.id}
              set={set}
              startQuestionNumber={startNum}
              answers={answers as Record<string, OptionKey>}
              onSelect={(qId, opt) => setAnswers((p) => ({ ...p, [qId]: opt }))}
              showExplanation={allSubmitted || Boolean(revealedKeys[set.id])}
              onCheckSet={() => logSingleOrGroup(set.id, set.questions.map((q) => q.id))}
            />
          );
        })}

        {(drill.part4 || []).map((set) => {
          const startNum = runningNum;
          runningNum += set.questions.length;
          return (
            <Part34SetBlock
              key={set.id}
              set={set}
              startQuestionNumber={startNum}
              answers={answers as Record<string, OptionKey>}
              onSelect={(qId, opt) => setAnswers((p) => ({ ...p, [qId]: opt }))}
              showExplanation={allSubmitted || Boolean(revealedKeys[set.id])}
              onCheckSet={() => logSingleOrGroup(set.id, set.questions.map((q) => q.id))}
            />
          );
        })}

        {(drill.part5 || []).map((item) => {
          const num = runningNum++;
          return (
            <Part5QuestionBlock
              key={item.id}
              item={item}
              displayNumber={num}
              selected={answers[item.id] as OptionKey | undefined}
              onSelect={(opt) => setAnswers((p) => ({ ...p, [item.id]: opt }))}
              showExplanation={allSubmitted || Boolean(revealedKeys[item.id])}
              onCheckSingle={() => logSingleOrGroup(item.id, [item.id])}
            />
          );
        })}

        {(drill.part6 || []).map((passage) => {
          const startNum = runningNum;
          runningNum += passage.questions.length;
          return (
            <Part6PassageBlock
              key={passage.id}
              passage={passage}
              startQuestionNumber={startNum}
              answers={answers as Record<string, OptionKey>}
              onSelect={(qId, opt) => setAnswers((p) => ({ ...p, [qId]: opt }))}
              showExplanation={allSubmitted || Boolean(revealedKeys[passage.id])}
              onCheckPassage={() => logSingleOrGroup(passage.id, passage.questions.map((q) => q.id))}
            />
          );
        })}

        {(drill.part7 || []).map((set) => {
          const startNum = runningNum;
          runningNum += set.questions.length;
          return (
            <Part7SetBlock
              key={set.id}
              set={set}
              startQuestionNumber={startNum}
              answers={answers as Record<string, OptionKey>}
              onSelect={(qId, opt) => setAnswers((p) => ({ ...p, [qId]: opt }))}
              showExplanation={allSubmitted || Boolean(revealedKeys[set.id])}
              onCheckSet={() => logSingleOrGroup(set.id, set.questions.map((q) => q.id))}
            />
          );
        })}
      </div>
    </div>
  );
};
