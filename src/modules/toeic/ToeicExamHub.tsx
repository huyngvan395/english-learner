import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  Check,
  Clock,
  FileCheck2,
  Headphones,
  Layers,
  Loader2,
  Play,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import {
  ToeicDrillData,
  ToeicDrillMeta,
  ToeicPartNumber,
  ToeicTestData,
  ToeicTestMeta,
} from '../../types';
import { useApp } from '../../context/AppContext';
import {
  loadToeicDrill,
  loadToeicDrillsMeta,
  loadToeicTest,
  loadToeicTestsMeta,
} from '../../utils/toeicLoader';
import { TOEIC_PART_LABELS } from '../../utils/toeicScore';
import { ToeicExamLaunchConfig, ToeicTestRunner } from './ToeicTestRunner';
import { ToeicDrillRunner } from './ToeicDrillRunner';
import { WrongNotebookView } from './WrongNotebookView';

type HubTab = 'tests' | 'drills' | 'history';
type YearFilterKey = 'all' | '2026' | '2025' | '2024' | '2023' | '2022' | '2021' | 'other';

const ALL_PARTS: ToeicPartNumber[] = [1, 2, 3, 4, 5, 6, 7];
const YEAR_TABS: { key: YearFilterKey; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: '2026', label: 'ETS 2026' },
  { key: '2025', label: 'ETS 2025' },
  { key: '2024', label: 'ETS 2024' },
  { key: '2023', label: 'ETS 2023' },
  { key: '2022', label: 'ETS 2022' },
  { key: '2021', label: 'ETS 2021' },
  { key: 'other', label: 'Bộ đề khác' },
];

function getTestYearBucket(t: ToeicTestMeta): Exclude<YearFilterKey, 'all'> {
  const s = `${t.series} ${t.title} ${t.id}`.toLowerCase();
  if (s.includes('englishclub') || s.includes('web practice')) return 'other';
  if (t.year >= 2021 && t.year <= 2026) return String(t.year) as Exclude<YearFilterKey, 'all' | 'other'>;
  return 'other';
}

export const ToeicExamHub: React.FC = () => {
  const { wrongQuestions, examHistory } = useApp();
  const { testId: routeTestId } = useParams<{ testId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawTab = searchParams.get('tab') as HubTab | null;
  const activeTab: HubTab =
    rawTab === 'drills' || rawTab === 'history' || rawTab === 'tests' ? rawTab : 'tests';
  const setActiveTab = (nextTab: HubTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab === 'tests') next.delete('tab');
        else next.set('tab', nextTab);
        next.delete('drill');
        return next;
      },
      { replace: true }
    );
  };

  const [selectedYear, setSelectedYear] = useState<YearFilterKey>('all');
  const [testsMeta, setTestsMeta] = useState<ToeicTestMeta[]>([]);
  const [drillsMeta, setDrillsMeta] = useState<ToeicDrillMeta[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drill Part selector (Part 1..7) synced with ?part=
  const rawPartParam = Number(searchParams.get('part') || '1');
  const selectedDrillPart: ToeicPartNumber =
    rawPartParam >= 1 && rawPartParam <= 7 ? (rawPartParam as ToeicPartNumber) : 1;
  const setSelectedDrillPart = (part: ToeicPartNumber) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'drills');
        next.set('part', String(part));
        return next;
      },
      { replace: true }
    );
  };

  const routeDrillId = searchParams.get('drill');

  // Active exam or drill session
  const [activeTest, setActiveTest] = useState<{ data: ToeicTestData; config: ToeicExamLaunchConfig } | null>(null);
  const [activeDrill, setActiveDrill] = useState<ToeicDrillData | null>(null);
  const [loadingPayload, setLoadingPayload] = useState<string | null>(null);

  // Study4-style Test Launch Config Modal
  const [configModalTest, setConfigModalTest] = useState<ToeicTestMeta | null>(null);
  const [launchMode, setLaunchMode] = useState<'full' | 'mini' | 'custom'>('full');
  const [customParts, setCustomParts] = useState<ToeicPartNumber[]>([1, 2, 3, 4, 5, 6, 7]);
  const [customMinutes, setCustomMinutes] = useState<number>(30);

  // Deep-link / F5 auto-loader for /tests/:testId(?mode=...&parts=...&duration=...)
  useEffect(() => {
    if (!routeTestId) {
      setActiveTest(null);
      return;
    }
    if (activeTest?.data.id === routeTestId) return;

    let cancelled = false;
    setLoadError(null);
    setLoadingPayload(routeTestId);

    const modeParam = searchParams.get('mode');
    const resolvedMode: 'full' | 'mini' | 'custom' =
      modeParam === 'mini' || modeParam === 'custom' ? modeParam : 'full';
    const partsParam = searchParams.get('parts') || searchParams.get('part');
    let parsedParts: ToeicPartNumber[] = ALL_PARTS;
    if (partsParam) {
      const nums = partsParam
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n): n is ToeicPartNumber => n >= 1 && n <= 7);
      if (nums.length > 0) {
        parsedParts = Array.from(new Set(nums)).sort((a, b) => a - b);
      }
    }
    const durParam = Number(searchParams.get('duration') || '0');

    loadToeicTest(routeTestId)
      .then((data) => {
        if (cancelled) return;
        const durationMinutes =
          durParam > 0
            ? durParam
            : resolvedMode === 'mini'
            ? Math.max(15, Math.round((data.durationMinutes || 120) / 2))
            : data.durationMinutes || 120;
        setActiveTest({
          data,
          config: {
            mode: parsedParts.length < 7 && resolvedMode === 'full' ? 'custom' : resolvedMode,
            selectedParts: parsedParts,
            durationMinutes,
          },
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setActiveTest(null);
          setLoadError(err instanceof Error ? err.message : 'Không thể tải đề thi ETS này');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPayload(null);
      });

    return () => {
      cancelled = true;
    };
  }, [routeTestId, activeTest?.data.id, searchParams]);

  // Deep-link / F5 auto-loader for /tests?tab=drills&drill=<drillId>
  useEffect(() => {
    if (!routeDrillId || routeTestId) {
      setActiveDrill(null);
      return;
    }
    if (activeDrill?.id === routeDrillId) return;

    let cancelled = false;
    setLoadError(null);
    setLoadingPayload(routeDrillId);
    loadToeicDrill(routeDrillId)
      .then((data) => {
        if (!cancelled) setActiveDrill(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setActiveDrill(null);
          setLoadError(err instanceof Error ? err.message : 'Không thể tải chuyên đề luyện tập');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPayload(null);
      });

    return () => {
      cancelled = true;
    };
  }, [routeDrillId, routeTestId, activeDrill?.id]);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadToeicTestsMeta(), loadToeicDrillsMeta()])
      .then(([tm, dm]) => {
        if (!mounted) return;
        setTestsMeta(tm);
        setDrillsMeta(dm);
      })
      .catch((err) => {
        if (mounted) setLoadError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu TOEIC');
      })
      .finally(() => {
        if (mounted) setLoadingMeta(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const readyTests = useMemo(
    () => testsMeta.filter((t) => t.status === 'ready'),
    [testsMeta]
  );

  const yearCounts = useMemo(() => {
    const counts: Record<YearFilterKey, number> = {
      all: readyTests.length,
      '2026': 0,
      '2025': 0,
      '2024': 0,
      '2023': 0,
      '2022': 0,
      '2021': 0,
      other: 0,
    };
    readyTests.forEach((t) => {
      const b = getTestYearBucket(t);
      counts[b] += 1;
    });
    return counts;
  }, [readyTests]);

  const testsByYearGroup = useMemo(() => {
    const filtered =
      selectedYear === 'all'
        ? readyTests
        : readyTests.filter((t) => getTestYearBucket(t) === selectedYear);

    const bucketOrder: Exclude<YearFilterKey, 'all'>[] = ['2026', '2025', '2024', '2023', '2022', '2021', 'other'];
    const bucketLabels: Record<Exclude<YearFilterKey, 'all'>, string> = {
      '2026': 'ETS TOEIC 2026',
      '2025': 'ETS TOEIC 2025',
      '2024': 'ETS TOEIC 2024',
      '2023': 'ETS TOEIC 2023',
      '2022': 'ETS TOEIC 2022',
      '2021': 'ETS TOEIC 2021',
      other: 'Bộ đề luyện tập khác',
    };

    const grouped = new Map<Exclude<YearFilterKey, 'all'>, ToeicTestMeta[]>();
    filtered.forEach((t) => {
      const b = getTestYearBucket(t);
      const arr = grouped.get(b) || [];
      arr.push(t);
      grouped.set(b, arr);
    });

    const result: { key: string; label: string; items: ToeicTestMeta[] }[] = [];
    bucketOrder.forEach((b) => {
      const items = grouped.get(b);
      if (!items || items.length === 0) return;
      items.sort((a, bItem) => {
        if (a.testNumber !== bItem.testNumber) return a.testNumber - bItem.testNumber;
        return bItem.questionCount - a.questionCount || a.title.localeCompare(bItem.title);
      });
      result.push({ key: b, label: bucketLabels[b], items });
    });
    return result;
  }, [readyTests, selectedYear]);

  const drillsForActivePart = useMemo(
    () => drillsMeta.filter((d) => d.part === selectedDrillPart),
    [drillsMeta, selectedDrillPart]
  );

  const openTestModal = (meta: ToeicTestMeta) => {
    setConfigModalTest(meta);
    setLaunchMode('full');
    setCustomParts([1, 2, 3, 4, 5, 6, 7]);
    setCustomMinutes(meta.durationMinutes);
  };

  const handleStartTest = async () => {
    if (!configModalTest) return;
    const chosenParts = [...(launchMode === 'custom' ? customParts : ALL_PARTS)].sort((a, b) => a - b);
    if (chosenParts.length === 0) return;

    const duration =
      launchMode === 'full'
        ? configModalTest.durationMinutes
        : launchMode === 'mini'
        ? configModalTest.miniDurationMinutes
        : customMinutes;

    const targetId = configModalTest.id;
    setConfigModalTest(null);
    const qs = new URLSearchParams();
    if (launchMode !== 'full') qs.set('mode', launchMode);
    if (chosenParts.length < 7) qs.set('parts', chosenParts.join(','));
    if (duration !== configModalTest.durationMinutes) qs.set('duration', String(duration));
    const qstr = qs.toString();
    navigate(`/tests/${encodeURIComponent(targetId)}${qstr ? `?${qstr}` : ''}`);
  };

  const handleStartDrill = (meta: ToeicDrillMeta) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'drills');
      next.set('part', String(meta.part));
      next.set('drill', meta.id);
      return next;
    });
  };

  const handleRetakeFromHistory = (testId: string) => {
    const found = testsMeta.find((t) => t.id === testId && t.status === 'ready');
    if (found) {
      setActiveTab('tests');
      openTestModal(found);
    }
  };

  // Loading state on deep link / F5 of /tests/:testId or /tests?drill=...
  if ((routeTestId && (!activeTest || activeTest.data.id !== routeTestId)) || (routeDrillId && !routeTestId && (!activeDrill || activeDrill.id !== routeDrillId))) {
    if (loadError) {
      return (
        <div className="rounded-3xl border border-rose-500/40 bg-[#1E293B] p-8 text-center space-y-4">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-400" />
          <p className="text-base font-bold text-white">{loadError}</p>
          <button
            type="button"
            onClick={() => navigate('/tests', { replace: true })}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-bold text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại kho đề thi TOEIC
          </button>
        </div>
      );
    }
    return (
      <div className="rounded-3xl border border-slate-800 bg-[#1E293B] p-12 flex flex-col items-center justify-center gap-3 text-slate-300 shadow-card">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        <p className="text-sm font-semibold">
          {routeTestId ? 'Đang tải đề thi TOEIC ETS...' : 'Đang tải chuyên đề luyện tập...'}
        </p>
      </div>
    );
  }

  // Active Exam Runner View
  if (activeTest) {
    return (
      <ToeicTestRunner
        test={activeTest.data}
        config={activeTest.config}
        onExit={() => {
          setActiveTest(null);
          navigate('/tests');
        }}
      />
    );
  }

  // Active Drill Runner View
  if (activeDrill) {
    return (
      <ToeicDrillRunner
        drill={activeDrill}
        onBack={() => {
          setActiveDrill(null);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('drill');
            return next;
          });
        }}
      />
    );
  }

  const readyTestsCount = testsMeta.filter((t) => t.status === 'ready').length;
  const totalDrillQuestions = drillsMeta.reduce((acc, d) => acc + d.questionCount, 0);
  const totalTestQuestions = testsMeta
    .filter((t) => t.status === 'ready')
    .reduce((acc, t) => acc + t.questionCount, 0);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-[#172542] via-[#131C31] to-[#0F172A] p-6 sm:p-8 shadow-card">
        <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-extrabold text-amber-300">
              <Trophy className="h-3.5 w-3.5" />
              TRUNG TÂM LUYỆN THI TOEIC CHUẨN ETS 2021–2026
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Phòng thi thử 990 &amp; Kho chuyên đề 7 Part toàn diện
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Hỗ trợ Full Test / Mini Test / Chọn từng Part theo kiểu Study4, chấm điểm quy đổi thang <b>990</b>,
              giải thích <b>5 lớp Reading</b> kèm highlight dẫn chứng và <b>Interactive Transcript MP3 đa giọng US/UK/AU</b>.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-center">
              <p className="text-xl sm:text-2xl font-black text-sky-400">{readyTestsCount} đề</p>
              <p className="text-[11px] text-slate-400">ETS ({totalTestQuestions} câu)</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-center">
              <p className="text-xl sm:text-2xl font-black text-emerald-400">{drillsMeta.length}</p>
              <p className="text-[11px] text-slate-400">Chuyên đề ({totalDrillQuestions} câu)</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-center">
              <p className="text-xl sm:text-2xl font-black text-rose-400">{wrongQuestions.length}</p>
              <p className="text-[11px] text-slate-400">Câu cần ôn lại</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Main Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-[#111827] p-2">
        <button
          type="button"
          onClick={() => setActiveTab('tests')}
          className={`flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs sm:text-sm font-extrabold transition ${
            activeTab === 'tests'
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-glow'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <FileCheck2 className="h-4 w-4" />
          1. Bộ đề thi chuẩn ETS 2021–2026 ({readyTestsCount} đề)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drills')}
          className={`flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs sm:text-sm font-extrabold transition ${
            activeTab === 'drills'
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-glow'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Target className="h-4 w-4" />
          2. Luyện chuyên sâu 7 Part ({drillsMeta.length} chuyên đề)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs sm:text-sm font-extrabold transition ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-glow'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          3. Lịch sử &amp; Sổ tay câu sai ({wrongQuestions.length})
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200">
          {loadError}
        </div>
      )}

      {loadingMeta ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 flex items-center justify-center gap-3 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          Đang tải kho đề ETS &amp; chuyên đề 7 Part...
        </div>
      ) : (
        <>
          {/* ================= TAB 1: ETS TESTS GRID WITH YEAR FILTER (2021–2026) ================= */}
          {activeTab === 'tests' && (
            <div className="space-y-6">
              {/* Year Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-[#111827] p-2.5">
                {YEAR_TABS.map((yt) => {
                  const cnt = yearCounts[yt.key];
                  const active = selectedYear === yt.key;
                  return (
                    <button
                      key={yt.key}
                      type="button"
                      onClick={() => setSelectedYear(yt.key)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                        active
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                          : cnt > 0
                          ? 'bg-slate-800/90 text-slate-200 hover:bg-slate-700/80 hover:text-white border border-slate-700/60'
                          : 'bg-slate-900/70 text-slate-500 hover:text-slate-300 border border-slate-800'
                      }`}
                    >
                      <span>{yt.label}</span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                          active ? 'bg-black/25 text-white' : cnt > 0 ? 'bg-slate-950/70 text-sky-300' : 'bg-slate-950/50 text-slate-500'
                        }`}
                      >
                        {cnt}
                      </span>
                    </button>
                  );
                })}
              </div>

              {testsByYearGroup.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-10 text-center space-y-2">
                  <p className="text-base font-bold text-white">Chưa có bộ đề READY cho mục này</p>
                  <p className="text-xs text-slate-400">
                    Tiến trình cào tự động đang cập nhật dần các bộ đề ETS 2021–2026 — bạn có thể nhấn F5 sau vài phút để xem đề mới.
                  </p>
                </div>
              ) : (
                testsByYearGroup.map((group) => (
                  <div key={group.key} className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="h-7 w-1.5 rounded-full bg-gradient-to-b from-sky-400 to-indigo-600" />
                        <h3 className="text-lg font-extrabold text-white">{group.label}</h3>
                      </div>
                      <span className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-[11px] font-bold text-slate-400">
                        {group.items.length} bộ đề READY
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {group.items.map((t) => {
                        const bestAttempt = examHistory
                          .filter((h) => h.testId === t.id && h.totalScore !== null)
                          .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))[0];

                        return (
                          <div
                            key={t.id}
                            className="rounded-2xl border border-slate-700/80 bg-[#1E293B] hover:border-indigo-500/60 p-5 shadow-card flex flex-col justify-between gap-4 transition"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                                  {t.badge}
                                </span>
                                {bestAttempt && (
                                  <span className="rounded-lg bg-amber-500/15 border border-amber-400/40 px-2 py-0.5 text-[11px] font-extrabold text-amber-300">
                                    Cao nhất: {bestAttempt.totalScore}/990
                                  </span>
                                )}
                              </div>

                              <div>
                                <h4 className="text-base font-extrabold text-white">{t.title}</h4>
                                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{t.subtitle}</p>
                              </div>

                              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-900/90 px-2.5 py-1">
                                  <Layers className="h-3.5 w-3.5 text-sky-400" />
                                  Đủ 7 Part ({t.questionCount} câu)
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-900/90 px-2.5 py-1">
                                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                                  {t.durationMinutes} phút
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-900/90 px-2.5 py-1">
                                  <Headphones className="h-3.5 w-3.5 text-cyan-400" />
                                  L: {t.listeningCount} • R: {t.readingCount}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => openTestModal(t)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-glow transition active:scale-[0.98]"
                            >
                              <Play className="h-4 w-4 fill-white" />
                              Vào phòng thi / Chọn Part
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ================= TAB 2: 7-PART TOPIC DRILLS ================= */}
          {activeTab === 'drills' && (
            <div className="space-y-5">
              {/* Part 1..7 Selector Tabs */}
              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-[#111827] p-3">
                {ALL_PARTS.map((p) => {
                  const count = drillsMeta.filter((d) => d.part === p).length;
                  const qTotal = drillsMeta.filter((d) => d.part === p).reduce((s, d) => s + d.questionCount, 0);
                  const active = selectedDrillPart === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedDrillPart(p)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition flex items-center gap-1.5 ${
                        active
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                          : 'bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      {p <= 4 ? <Headphones className="h-3.5 w-3.5" /> : <BookOpenCheck className="h-3.5 w-3.5" />}
                      <span>Part {p}</span>
                      <span className="rounded-md bg-black/25 px-1.5 py-0.5 text-[10px]">
                        {count} bài • {qTotal} câu
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Part Heading */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-white">
                    {TOEIC_PART_LABELS[selectedDrillPart].name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {TOEIC_PART_LABELS[selectedDrillPart].shortDesc} — {drillsForActivePart.length} chuyên đề chuyên sâu
                  </p>
                </div>
              </div>

              {/* Drills Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {drillsForActivePart.map((d) => {
                  const isLoading = loadingPayload === d.id;
                  return (
                    <div
                      key={d.id}
                      className="rounded-2xl border border-slate-700/80 bg-[#1E293B] hover:border-indigo-500/60 p-5 shadow-card flex flex-col justify-between gap-4 transition"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-[11px] font-bold text-indigo-300">
                            {d.focusTag}
                          </span>
                          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                            {d.difficulty}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-extrabold text-white leading-snug">
                          {d.title}
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{d.subtitle}</p>
                        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-300 pt-1">
                          <span>{d.questionCount} câu luyện tập</span>
                          <span>•</span>
                          <span>~{d.estimatedMinutes} phút</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={Boolean(loadingPayload)}
                        onClick={() => handleStartDrill(d)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 border border-slate-700 hover:border-indigo-400/50 py-2.5 text-xs font-extrabold text-white transition"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Đang tải bài tập...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                            Luyện chuyên đề ngay
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 3: HISTORY & WRONG QUESTIONS NOTEBOOK ================= */}
          {activeTab === 'history' && (
            <WrongNotebookView onRetakeTest={handleRetakeFromHistory} />
          )}
        </>
      )}

      {/* ================= STUDY4-STYLE EXAM LAUNCH MODAL ================= */}
      {configModalTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-[#111827] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-md bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo-300">
                  CẤU HÌNH PHÒNG THI
                </span>
                <h3 className="mt-1.5 text-xl font-extrabold text-white">{configModalTest.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{configModalTest.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setConfigModalTest(null)}
                className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'full' as const,
                  title: 'Full Test',
                  desc: `Đủ 7 Part (${configModalTest.questionCount} câu • ${configModalTest.durationMinutes}p)`,
                },
                {
                  id: 'mini' as const,
                  title: 'Mini Test (50%)',
                  desc: `Rút gọn 50% thời gian (${configModalTest.miniDurationMinutes}p)`,
                },
                {
                  id: 'custom' as const,
                  title: 'Chọn từng Part',
                  desc: 'Tùy chọn Part 1–7 như Study4',
                },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setLaunchMode(m.id)}
                  className={`rounded-2xl border p-3.5 text-left transition ${
                    launchMode === m.id
                      ? 'border-indigo-400 bg-indigo-500/20 text-white'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <p className="text-sm font-extrabold">{m.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{m.desc}</p>
                </button>
              ))}
            </div>

            {/* Custom Part Selection Checkboxes */}
            {launchMode === 'custom' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                <p className="text-xs font-bold text-slate-300">Chọn các Part muốn luyện:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_PARTS.map((p) => {
                    const checked = customParts.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setCustomParts((prev) =>
                            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                          )
                        }
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition ${
                          checked
                            ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                            : 'border-slate-800 bg-slate-950/70 text-slate-400'
                        }`}
                      >
                        <span>
                          Part {p} ({configModalTest.partCounts[p]})
                        </span>
                        {checked && <Check className="h-3.5 w-3.5 text-sky-300" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <label className="text-xs font-bold text-slate-300">Thời gian làm bài (phút):</label>
                  <select
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Number(e.target.value))}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                      <option key={m} value={m}>
                        {m} phút
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfigModalTest(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={Boolean(loadingPayload) || (launchMode === 'custom' && customParts.length === 0)}
                onClick={handleStartTest}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-40 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-glow transition"
              >
                {loadingPayload === configModalTest.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải bộ đề...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    Bắt đầu làm bài ngay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
