import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  PenLine,
  Sparkles,
  Target,
} from 'lucide-react';
import { GrammarCatalogItem, GrammarLevel } from '../../types';
import { useApp } from '../../context/AppContext';
import { loadGrammarCatalog } from '../../utils/grammarLoader';
import { GrammarTopicView } from './GrammarTopicView';

export const GRAMMAR_LEVEL_STYLES: Record<GrammarLevel, string> = {
  basic:
    'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/40',
  intermediate:
    'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-400/40',
  advanced:
    'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-400/40',
};

const STAGE_FILTERS: {
  id: 'all' | GrammarLevel;
  label: string;
  shortDesc: string;
}[] = [
  { id: 'all', label: 'Tất cả lộ trình', shortDesc: 'Toàn bộ chuyên đề' },
  { id: 'basic', label: 'Cơ bản (Nền tảng 450+)', shortDesc: 'Chặng 1 • Cốt lõi' },
  { id: 'intermediate', label: 'Trung cấp (Bứt phá 650–750)', shortDesc: 'Chặng 2 • Trọng tâm ETS' },
  { id: 'advanced', label: 'Nâng cao (Chinh phục 800–990)', shortDesc: 'Chặng 3 • Điểm tối đa' },
];

export const GrammarHub: React.FC = () => {
  const { topicId } = useParams<{ topicId?: string }>();
  const [catalog, setCatalog] = useState<GrammarCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadGrammarCatalog()
      .then((items) => {
        if (mounted) setCatalog(items);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Lỗi tải danh mục Ngữ pháp.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (topicId) {
    return <GrammarTopicView topicId={topicId} catalog={catalog} />;
  }

  return <GrammarOverview catalog={catalog} loading={loading} error={error} />;
};

interface GrammarOverviewProps {
  catalog: GrammarCatalogItem[];
  loading: boolean;
  error: string | null;
}

const GrammarOverview: React.FC<GrammarOverviewProps> = ({ catalog, loading, error }) => {
  const { grammarProgress } = useApp();
  const navigate = useNavigate();
  const [stageFilter, setStageFilter] = useState<'all' | GrammarLevel>('all');

  const totalPlannedTopics = Math.max(16, catalog.length);

  const stats = useMemo(() => {
    const completedCount = catalog.filter(
      (t) => grammarProgress[t.id]?.status === 'completed'
    ).length;
    const inProgressCount = catalog.filter(
      (t) => grammarProgress[t.id]?.status === 'in-progress'
    ).length;
    const attempted = catalog
      .map((t) => grammarProgress[t.id])
      .filter((p) => p && p.attemptsCount > 0);
    const avgAccuracy =
      attempted.length > 0
        ? Math.round(
            attempted.reduce((acc, p) => acc + (p.bestAccuracy || 0), 0) / attempted.length
          )
        : 0;
    const pct = Math.round((completedCount / totalPlannedTopics) * 100);
    return { completedCount, inProgressCount, avgAccuracy, attemptedCount: attempted.length, pct };
  }, [catalog, grammarProgress, totalPlannedTopics]);

  const filteredTopics = useMemo(() => {
    if (stageFilter === 'all') return catalog;
    return catalog.filter((t) => t.level === stageFilter);
  }, [catalog, stageFilter]);

  const openTopic = (id: string, tab: 'theory' | 'practice' = 'theory') => {
    navigate(`/grammar/${encodeURIComponent(id)}?tab=${tab}`);
  };

  return (
    <div className="space-y-6">
      {/* ================= HERO BANNER + OVERALL PROGRESS ================= */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gradient-to-br dark:from-[#16203A] dark:via-[#111827] dark:to-[#0F172A] p-4 sm:p-6 shadow-card space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-400/35 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <BookMarked className="h-3.5 w-3.5" />
              Lộ trình Ngữ Pháp TOEIC Toàn Diện • Part 5, 6 &amp; 7
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Ngữ Pháp TOEIC Từ Cơ Bản Đến 990
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Mỗi chuyên đề gồm bảng công thức, dấu hiệu nhận biết 3 giây, bẫy kinh điển ETS và 12 bài tập thực hành giải thích 3 lớp.
            </p>
          </div>

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 shrink-0">
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/25 px-3.5 py-2.5">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Hoàn thành
              </p>
              <p className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
                {stats.completedCount}/{totalPlannedTopics}
              </p>
            </div>

            <div className="rounded-2xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/70 dark:bg-sky-950/25 px-3.5 py-2.5">
              <p className="text-[11px] font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                Độ chính xác TB
              </p>
              <p className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
                {stats.attemptedCount > 0 ? `${stats.avgAccuracy}%` : '—'}
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/25 px-3.5 py-2.5">
              <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Đã sẵn sàng
              </p>
              <p className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
                {catalog.length} chuyên đề
              </p>
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600 dark:text-slate-300">
              Tiến độ tổng thể: <b className="text-slate-900 dark:text-white">{stats.completedCount}/{totalPlannedTopics} chuyên đề đã hoàn thành</b>
              {stats.inProgressCount > 0 && (
                <span className="text-amber-600 dark:text-amber-300"> · {stats.inProgressCount} đang học</span>
              )}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{stats.pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.max(stats.pct, stats.inProgressCount > 0 ? 3 : 0)}%` }}
            />
          </div>
        </div>

        {/* 3-Stage Roadmap Filter Pills */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap gap-2 pt-1">
          {STAGE_FILTERS.map((st) => {
            const active = stageFilter === st.id;
            const cnt =
              st.id === 'all'
                ? catalog.length
                : catalog.filter((t) => t.level === st.id).length;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setStageFilter(st.id)}
                className={`shrink-0 min-h-[42px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-extrabold transition ${
                  active
                    ? 'border-indigo-500 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ================= TOPIC CARDS GRID ================= */}
      {loading ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 flex items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          Đang tải lộ trình Ngữ pháp TOEIC...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 p-6 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-10 text-center space-y-2">
          <Award className="mx-auto h-10 w-10 text-violet-500" />
          <p className="text-base font-extrabold text-slate-900 dark:text-white">
            Chặng Nâng cao (800–990) — Sắp cập nhật ở Phần 2!
          </p>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            8 chuyên đề nâng cao (Mệnh đề quan hệ, Câu điều kiện, Đảo ngữ, Giả định, Liên từ nâng cao, Rút gọn mệnh đề...) đang sẵn sàng bổ sung tiếp theo.
          </p>
          <button
            type="button"
            onClick={() => setStageFilter('all')}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
          >
            Xem 8 chuyên đề Cơ bản &amp; Trung cấp
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
          {filteredTopics.map((topic) => {
            const prog = grammarProgress[topic.id];
            const status = prog?.status || 'not-started';
            const statusMeta =
              status === 'completed'
                ? {
                    label: 'Hoàn thành',
                    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/40',
                  }
                : status === 'in-progress'
                ? {
                    label: 'Đang học',
                    cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/40',
                  }
                : {
                    label: 'Chưa học',
                    cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
                  };

            return (
              <div
                key={topic.id}
                onClick={() => openTopic(topic.id, 'theory')}
                className="group cursor-pointer rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-indigo-400 dark:hover:border-indigo-500/60 p-4 sm:p-5 shadow-card hover:shadow-lg transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Top Badges Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-extrabold text-white shadow-sm">
                        {String(topic.order).padStart(2, '0')}
                      </span>
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-[11px] font-extrabold ${
                          GRAMMAR_LEVEL_STYLES[topic.level]
                        }`}
                      >
                        {topic.levelLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                        <Flame className="h-3 w-3" />
                        ETS: {topic.etsFrequency}
                      </span>
                    </div>

                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.cls}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-sky-300 transition leading-snug">
                      {topic.title}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {topic.subtitle}
                    </p>
                  </div>

                  {/* Meta Row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <PenLine className="h-3.5 w-3.5 text-indigo-500" />
                      {topic.exerciseCount} bài tập chuẩn ETS
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Clock className="h-3.5 w-3.5 text-cyan-500" />
                      ~{topic.estimatedMinutes} phút
                    </span>
                    {prog && prog.attemptsCount > 0 && (
                      <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Gần nhất: {prog.lastAccuracy}% (Cao nhất: {prog.bestAccuracy}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/90">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTopic(topic.id, 'theory');
                    }}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-indigo-400 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                    Lý thuyết
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTopic(topic.id, 'practice');
                    }}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm hover:brightness-110 transition active:scale-95"
                  >
                    Làm {topic.exerciseCount} bài tập
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
