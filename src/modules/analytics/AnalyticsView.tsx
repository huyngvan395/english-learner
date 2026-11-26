import React, { useMemo } from 'react';
import {
  AlertCircle,
  Award,
  BarChart3,
  BookOpen,
  Flame,
  History,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TOTAL_VOCAB_COUNT } from '../../data/vocabDecksMeta';

const TOEIC_PARTS = ['Part 1', 'Part 2', 'Part 3', 'Part 4', 'Part 5', 'Part 6', 'Part 7'];

export const AnalyticsView: React.FC = () => {
  const { vocabProgress, attempts, profile, setDailyGoal } = useApp();

  const vocabStats = useMemo(() => {
    const total = TOTAL_VOCAB_COUNT;
    const values = Object.values(vocabProgress);
    const mastered = values.filter((v) => v.status === 'mastered').length;
    const vague = values.filter((v) => v.status === 'vague').length;
    const forgotten = values.filter((v) => v.status === 'forgotten').length;
    return {
      total,
      mastered,
      vague,
      forgotten,
      pct: Math.round((mastered / Math.max(1, total)) * 100),
    };
  }, [vocabProgress]);

  const partAccuracy = useMemo(() => {
    return TOEIC_PARTS.map((part) => {
      const matched = attempts.filter((a) => a.partLabel === part);
      const correct = matched.reduce((s, a) => s + a.correctCount, 0);
      const total = matched.reduce((s, a) => s + a.totalCount, 0);
      const pct = total > 0 ? Math.round((correct / total) * 100) : null;
      return { part, correct, total, pct };
    });
  }, [attempts]);

  const weaknessList = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      for (const t of a.topics) {
        const cur = map.get(t.topic) || { correct: 0, total: 0 };
        cur.total += 1;
        if (t.correct) cur.correct += 1;
        map.set(t.topic, cur);
      }
    }
    return Array.from(map.entries())
      .map(([topic, stat]) => ({
        topic,
        ...stat,
        pct: Math.round((stat.correct / stat.total) * 100),
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 5);
  }, [attempts]);

  const totalQuestionsDone = attempts.reduce((s, a) => s + a.totalCount, 0);
  const totalQuestionsCorrect = attempts.reduce((s, a) => s + a.correctCount, 0);
  const overallAccuracy =
    totalQuestionsDone > 0 ? Math.round((totalQuestionsCorrect / totalQuestionsDone) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
            <BarChart3 className="h-3.5 w-3.5" />
            Phân tích hiệu suất cá nhân
          </div>
          <h2 className="mt-2 text-2xl font-extrabold text-white">Thống Kê Học Tập TOEIC</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Theo dõi tỷ lệ thuộc từ, độ chính xác từng Part 1–7 và tự động chẩn đoán chuyên đề yếu cần ôn sâu.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 px-4 py-3 flex items-center gap-3">
          <Target className="h-5 w-5 text-cyan-400 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Mục tiêu từ vựng / ngày</p>
            <div className="mt-1 flex items-center gap-1.5">
              {[10, 20, 30, 50].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setDailyGoal(g)}
                  className={`rounded-md px-2 py-0.5 text-xs font-bold transition ${
                    profile.dailyGoal === g
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-700/70 bg-[#1E293B] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Tiến độ thuộc từ</span>
            <BookOpen className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-white">
            {vocabStats.mastered}{' '}
            <span className="text-base font-semibold text-slate-400">/ {vocabStats.total}</span>
          </p>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
              style={{ width: `${vocabStats.pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Mơ hồ: {vocabStats.vague} • Chưa nhớ: {vocabStats.forgotten}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-[#1E293B] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Độ chính xác chung</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-emerald-400">{overallAccuracy}%</p>
          <p className="mt-2 text-xs text-slate-400">
            {totalQuestionsCorrect} / {totalQuestionsDone} câu đúng qua {attempts.length} lượt luyện
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-[#1E293B] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Chuỗi ngày học</span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-amber-300">{profile.streak} ngày</p>
          <p className="mt-2 text-xs text-slate-400">
            Hôm nay đã ôn: {profile.todayWordsStudied}/{profile.dailyGoal} từ
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-[#1E293B] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Kinh nghiệm tích lũy</span>
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-violet-300">{profile.xp} XP</p>
          <p className="mt-2 text-xs text-slate-400">
            {profile.xp >= 500
              ? 'Hạng: Chuyên gia TOEIC'
              : profile.xp >= 200
              ? 'Hạng: Học viên bứt phá'
              : 'Hạng: Người mới khởi động'}
          </p>
        </div>
      </div>

      {/* Accuracy by Part + Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Part 1 - 7 Bars */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-400" />
            <h3 className="text-base font-extrabold text-white">
              Tỷ lệ chính xác theo từng Part TOEIC (Part 1 – Part 7)
            </h3>
          </div>

          <div className="space-y-3.5">
            {partAccuracy.map((item) => (
              <div key={item.part} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-200">{item.part}</span>
                  {item.pct !== null ? (
                    <span
                      className={
                        item.pct >= 80
                          ? 'text-emerald-400 font-bold'
                          : item.pct >= 55
                          ? 'text-amber-300 font-bold'
                          : 'text-rose-400 font-bold'
                      }
                    >
                      {item.pct}% ({item.correct}/{item.total} câu)
                    </span>
                  ) : (
                    <span className="text-slate-500">Chưa có dữ liệu luyện tập</span>
                  )}
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.pct === null
                        ? 'bg-slate-800'
                        : item.pct >= 80
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : item.pct >= 55
                        ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                        : 'bg-gradient-to-r from-rose-500 to-pink-500'
                    }`}
                    style={{ width: `${item.pct ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weaknesses Radar */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <h3 className="text-base font-extrabold text-white">Điểm yếu cần cải thiện</h3>
          </div>

          {weaknessList.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center text-xs text-slate-400">
              Hãy hoàn thành một vài câu Reading, Listening hoặc Quiz từ vựng để hệ thống tự động phát hiện chuyên đề yếu nhất của bạn!
            </div>
          ) : (
            <div className="space-y-2.5">
              {weaknessList.map((w) => (
                <div
                  key={w.topic}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-100">{w.topic}</p>
                    <p className="text-[11px] text-slate-400">
                      Đúng {w.correct}/{w.total} lần •{' '}
                      {w.pct < 60 ? 'Cần ưu tiên ôn kỹ giải thích & bẫy' : 'Tiếp tục duy trì'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                      w.pct < 60
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : w.pct < 80
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {w.pct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attempt History */}
      <div className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-cyan-400" />
          <h3 className="text-base font-extrabold text-white">Lịch sử làm bài gần đây</h3>
        </div>

        {attempts.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có lịch sử làm bài nào được ghi nhận.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Phân hệ</th>
                  <th className="px-4 py-3">Nội dung / Part</th>
                  <th className="px-4 py-3 text-right">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {attempts.slice(0, 15).map((a) => {
                  const pct = Math.round((a.correctCount / Math.max(1, a.totalCount)) * 100);
                  return (
                    <tr key={a.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(a.timestamp).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${
                            a.module === 'reading'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : a.module === 'listening'
                              ? 'bg-cyan-500/15 text-cyan-300'
                              : 'bg-indigo-500/15 text-indigo-300'
                          }`}
                        >
                          {a.module}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{a.partLabel}</td>
                      <td className="px-4 py-3 text-right font-bold">
                        <span className={pct >= 70 ? 'text-emerald-400' : 'text-amber-300'}>
                          {a.correctCount}/{a.totalCount} ({pct}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
