import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  HelpCircle,
  Keyboard,
  Link2,
  Loader2,
  Mic,
  Play,
  Search,
  Sparkles,
  Star,
  Subtitles,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import {
  VideoCatalogItem,
  VideoCefrLevel,
  VideoChannelMeta,
  VideoDetailItem,
  VideoPracticeMode,
} from '../../types';
import { useApp } from '../../context/AppContext';
import {
  formatVideoDuration,
  loadVideoCatalog,
  loadVideoChannels,
} from '../../utils/videoLoader';
import { AddCustomVideoModal } from './AddCustomVideoModal';
import { VideoPracticeView } from './VideoPracticeView';

const CEFR_FILTERS: ('Tất cả' | VideoCefrLevel)[] = ['Tất cả', 'A1', 'A2', 'B1', 'B2', 'C1'];

const TOPIC_FILTERS = [
  'Tất cả',
  'Giao tiếp hàng ngày',
  'Công sở & Kinh doanh',
  'Khoa học & Công nghệ',
  'Kỹ năng & Phát triển',
  'Tin tức & Văn hóa',
];

export const CEFR_BADGE_STYLES: Record<VideoCefrLevel, string> = {
  A1: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/40',
  A2: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-400/40',
  B1: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-400/40',
  B2: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-400/40',
  C1: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-400/40',
};

const MODE_INTRO_CARDS: {
  id: VideoPracticeMode;
  title: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
  accent: string;
}[] = [
  {
    id: 'dictation',
    title: 'Dictation',
    desc: 'Nghe chép từng câu, tự dừng cuối câu & chấm xanh/đỏ',
    icon: Keyboard,
    accent: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'shadowing',
    title: 'Shadowing',
    desc: 'Lặp câu + khoảng nghỉ & chấm phát âm bằng giọng nói',
    icon: Mic,
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'quiz',
    title: 'Quiz',
    desc: 'Nghe đoạn video & điền khuyết từ khóa B1–C1/TOEIC',
    icon: HelpCircle,
    accent: 'from-amber-500 to-orange-600',
  },
  {
    id: 'subtitles',
    title: 'Subtitles',
    desc: 'Phụ đề song ngữ cuộn tự động, bôi đen tra & lưu SRS',
    icon: Subtitles,
    accent: 'from-violet-500 to-fuchsia-600',
  },
];

export const VideoHub: React.FC = () => {
  const { videoId } = useParams<{ videoId?: string }>();
  if (videoId) {
    return <VideoPracticeView videoId={videoId} />;
  }
  return <VideoCatalogHome />;
};

const VideoCatalogHome: React.FC = () => {
  const {
    videoProgress,
    customVideos,
    toggleFavoriteVideo,
    addCustomVideo,
    deleteCustomVideo,
  } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [catalog, setCatalog] = useState<VideoCatalogItem[]>([]);
  const [channels, setChannels] = useState<VideoChannelMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'Tất cả' | VideoCefrLevel>('Tất cả');
  const [topicFilter, setTopicFilter] = useState('Tất cả');
  const [onlyMyVideos, setOnlyMyVideos] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(
    () => searchParams.get('channel') || null
  );
  const [pasteModalOpen, setPasteModalOpen] = useState(false);

  const exploreScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([loadVideoCatalog(), loadVideoChannels()])
      .then(([cat, ch]) => {
        if (!mounted) return;
        setCatalog(cat);
        setChannels(ch);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Lỗi tải danh sách video.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const allVideos: VideoCatalogItem[] = useMemo(() => {
    const customAsCatalog: VideoCatalogItem[] = customVideos.map((cv) => ({
      id: cv.id,
      youtubeId: cv.youtubeId,
      titleEn: cv.titleEn,
      titleVi: cv.titleVi,
      channel: cv.channel,
      channelSlug: cv.channelSlug,
      durationSec: cv.durationSec,
      level: cv.level,
      topic: cv.topic,
      sentenceCount: cv.sentenceCount,
      wpm: cv.wpm,
      thumbnail: cv.thumbnail,
      featured: false,
      createdAt: cv.createdAt,
      isCustom: true,
    }));
    return [...customAsCatalog, ...catalog];
  }, [customVideos, catalog]);

  const myVideoIds = useMemo(() => {
    const set = new Set<string>();
    for (const cv of customVideos) set.add(cv.id);
    for (const [vid, rec] of Object.entries(videoProgress)) {
      if (rec.favorite || rec.completedSentences.length > 0 || rec.quizBestScore !== undefined) {
        set.add(vid);
      }
    }
    return set;
  }, [customVideos, videoProgress]);

  const continueWatching = useMemo(() => {
    const studiedEntries = Object.values(videoProgress)
      .filter((p) => p.lastStudiedAt > 0)
      .sort((a, b) => b.lastStudiedAt - a.lastStudiedAt);

    for (const entry of studiedEntries) {
      const match = allVideos.find((v) => v.id === entry.videoId);
      if (match) {
        const done = entry.completedSentences?.length || 0;
        const pct = Math.min(100, Math.round((done / Math.max(1, match.sentenceCount)) * 100));
        return {
          video: match,
          done,
          pct,
          lastMode: entry.lastMode || 'dictation',
          isStarted: done > 0 || entry.lastSentenceIndex > 0,
        };
      }
    }

    const fallback = allVideos.find((v) => v.featured) || allVideos[0];
    if (!fallback) return null;
    return {
      video: fallback,
      done: 0,
      pct: 0,
      lastMode: 'dictation' as VideoPracticeMode,
      isStarted: false,
    };
  }, [videoProgress, allVideos]);

  const handleSelectChannel = (slug: string | null) => {
    setSelectedChannel(slug);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (slug) next.set('channel', slug);
        else next.delete('channel');
        return next;
      },
      { replace: true }
    );
  };

  const hasActiveFilter =
    Boolean(query.trim()) ||
    levelFilter !== 'Tất cả' ||
    topicFilter !== 'Tất cả' ||
    onlyMyVideos ||
    Boolean(selectedChannel);

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allVideos.filter((v) => {
      if (levelFilter !== 'Tất cả' && v.level !== levelFilter) return false;
      if (topicFilter !== 'Tất cả' && v.topic !== topicFilter) return false;
      if (selectedChannel && v.channelSlug !== selectedChannel) return false;
      if (onlyMyVideos && !myVideoIds.has(v.id)) return false;
      if (q) {
        const hay = `${v.titleEn} ${v.titleVi} ${v.channel} ${v.topic} ${v.level}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allVideos, query, levelFilter, topicFilter, selectedChannel, onlyMyVideos, myVideoIds]);

  const featuredVideos = useMemo(() => allVideos.filter((v) => v.featured), [allVideos]);
  const newestVideos = useMemo(() => [...allVideos].reverse().slice(0, 8), [allVideos]);

  const scrollExplore = (dir: -1 | 1) => {
    exploreScrollRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  const openVideo = (vid: string, mode: VideoPracticeMode = 'dictation') => {
    navigate(`/videos/${encodeURIComponent(vid)}?mode=${mode}`);
  };

  const handleCreatedCustomVideo = (video: VideoDetailItem) => {
    addCustomVideo(video);
    openVideo(video.id, 'dictation');
  };

  const renderVideoCard = (v: VideoCatalogItem, compactWidth = false) => {
    const prog = videoProgress[v.id];
    const doneCount = prog?.completedSentences?.length || 0;
    const pct = Math.min(100, Math.round((doneCount / Math.max(1, v.sentenceCount)) * 100));
    const isFav = Boolean(prog?.favorite);

    return (
      <div
        key={v.id}
        onClick={() => openVideo(v.id, prog?.lastMode || 'dictation')}
        className={`group cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-indigo-400 dark:hover:border-indigo-500/60 shadow-card hover:shadow-lg transition-all overflow-hidden flex flex-col ${
          compactWidth ? 'w-[270px] sm:w-[290px] shrink-0' : 'w-full'
        }`}
      >
        {/* 16:9 Thumbnail */}
        <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
          <img
            src={v.thumbnail}
            alt={v.titleEn}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />

          {/* Top Left CEFR Badge */}
          <span
            className={`absolute top-2.5 left-2.5 rounded-lg border px-2 py-0.5 text-[11px] font-extrabold backdrop-blur-sm ${
              CEFR_BADGE_STYLES[v.level]
            }`}
          >
            {v.level}
          </span>

          {/* Top Right Favorite / Delete Custom */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
            {v.isCustom && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCustomVideo(v.id);
                }}
                title="Xóa video cá nhân"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950/70 text-slate-300 hover:bg-rose-600 hover:text-white backdrop-blur-sm transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavoriteVideo(v.id);
              }}
              aria-label={isFav ? 'Bỏ lưu video' : 'Lưu video'}
              className={`flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-sm transition ${
                isFav
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-950/70 text-slate-200 hover:bg-slate-900 hover:text-amber-300'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-slate-950' : ''}`} />
            </button>
          </div>

          {/* Bottom Duration & Sentence Pill */}
          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-bold text-white">
            <span className="rounded-md bg-slate-950/75 px-2 py-0.5 backdrop-blur-sm">
              {v.sentenceCount} câu · {v.wpm} WPM
            </span>
            <span className="rounded-md bg-slate-950/80 px-2 py-0.5 font-mono backdrop-blur-sm">
              {formatVideoDuration(v.durationSec)}
            </span>
          </div>

          {/* Progress Strip at Thumbnail Bottom */}
          {pct > 0 && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-800/80">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-sky-300 transition">
              {v.titleEn}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{v.titleVi}</p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/90 text-[11px]">
            <span className="truncate font-semibold text-slate-600 dark:text-slate-300">
              {v.channel}
            </span>
            {pct > 0 ? (
              <span className="shrink-0 font-extrabold text-emerald-600 dark:text-emerald-400">
                {pct}% ({doneCount}/{v.sentenceCount})
              </span>
            ) : (
              <span className="shrink-0 text-slate-500 dark:text-slate-400 truncate max-w-[125px]">
                {v.topic}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ================= TOP SEARCH, FILTER & ACTION BAR ================= */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gradient-to-br dark:from-[#16203A] dark:via-[#111827] dark:to-[#0F172A] p-4 sm:p-6 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-400/35 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <Film className="h-3.5 w-3.5" />
              Video Luyện Nghe &amp; Nói Chuẩn CEFR A1–C1
            </div>
            <h2 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Kho Video Luyện Tập YouTube
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Chép chính tả từng câu, Shadowing chấm phát âm, Quiz điền từ khóa &amp; Phụ đề song ngữ tra từ tức thì.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setOnlyMyVideos((v) => !v)}
              className={`min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                onlyMyVideos
                  ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Video của tôi
              {myVideoIds.size > 0 && (
                <span className="rounded-full bg-indigo-600 text-white px-1.5 py-0.5 text-[10px] font-extrabold">
                  {myVideoIds.size}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPasteModalOpen(true)}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-xs font-extrabold text-white shadow-glow hover:brightness-110 transition active:scale-95"
            >
              <Link2 className="h-4 w-4" />
              Dán link YouTube
            </button>
          </div>
        </div>

        {/* Search Box + Level & Topic Filter Chips */}
        <div className="space-y-3 pt-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên video, chủ đề hoặc kênh (BBC, TED-Ed, Kurzgesagt, Lucy...)..."
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B1120]/85 pl-10 pr-10 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Level Pills */}
            <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5">
              <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
                Trình độ:
              </span>
              {CEFR_FILTERS.map((lv) => {
                const active = levelFilter === lv;
                return (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setLevelFilter(lv)}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lv}
                  </button>
                );
              })}
            </div>

            {/* Topic Pills */}
            <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5">
              {TOPIC_FILTERS.map((tp) => {
                const active = topicFilter === tp;
                return (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setTopicFilter(tp)}
                    className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                      active
                        ? 'border border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-400/50 dark:bg-cyan-500/20 dark:text-cyan-200'
                        : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tp}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 flex items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          Đang tải kho video luyện tập...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 p-6 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      ) : (
        <>
          {/* ================= CONTINUE WATCHING + 4 PRACTICE MODES ================= */}
          {!hasActiveFilter && continueWatching && (
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              {/* Continue Watching Card */}
              <div className="xl:col-span-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-card flex flex-col sm:flex-row gap-4 items-stretch">
                <div
                  onClick={() => openVideo(continueWatching.video.id, continueWatching.lastMode)}
                  className="relative sm:w-52 shrink-0 aspect-video sm:aspect-auto rounded-2xl overflow-hidden bg-slate-900 cursor-pointer group"
                >
                  <img
                    src={continueWatching.video.thumbnail}
                    alt={continueWatching.video.titleEn}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-950/35 flex items-center justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-indigo-600 shadow-lg group-hover:scale-110 transition">
                      <Play className="h-5 w-5 ml-0.5 fill-indigo-600" />
                    </span>
                  </div>
                  <span
                    className={`absolute top-2 left-2 rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${
                      CEFR_BADGE_STYLES[continueWatching.video.level]
                    }`}
                  >
                    {continueWatching.video.level}
                  </span>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
                        <Sparkles className="h-3.5 w-3.5" />
                        {continueWatching.isStarted ? 'Đang học gần đây' : 'Đề xuất bắt đầu ngay'}
                      </span>
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                        {continueWatching.pct}%
                      </span>
                    </div>
                    <h3 className="mt-1 text-base font-extrabold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {continueWatching.video.titleEn}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {continueWatching.video.channel} · {continueWatching.done}/{continueWatching.video.sentenceCount} câu đã hoàn thành
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all"
                        style={{ width: `${Math.max(continueWatching.pct, continueWatching.isStarted ? 4 : 0)}%` }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => openVideo(continueWatching.video.id, continueWatching.lastMode)}
                      className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-xs sm:text-sm font-extrabold text-white shadow-glow hover:brightness-110 transition active:scale-95"
                    >
                      <Play className="h-4 w-4 fill-white" />
                      {continueWatching.isStarted ? 'Nghe tiếp' : 'Bắt đầu học ngay'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Modes Quick Intro Cards */}
              <div className="xl:col-span-6 grid grid-cols-2 gap-3">
                {MODE_INTRO_CARDS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openVideo(continueWatching.video.id, m.id)}
                      className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-indigo-400 dark:hover:border-indigo-500/60 p-3.5 sm:p-4 text-left shadow-card transition flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${m.accent} text-white shadow-sm`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-sky-300 transition">
                          {m.title}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {m.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ================= FILTERED VIEW OR DISCOVERY SHELVES ================= */}
          {hasActiveFilter ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    {selectedChannel
                      ? `Kênh: ${channels.find((c) => c.slug === selectedChannel)?.name || selectedChannel}`
                      : onlyMyVideos
                      ? 'Video của tôi'
                      : 'Kết quả lọc video'}
                  </h3>
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    {filteredVideos.length} video
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setLevelFilter('Tất cả');
                    setTopicFilter('Tất cả');
                    setOnlyMyVideos(false);
                    handleSelectChannel(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition"
                >
                  <X className="h-3.5 w-3.5" />
                  Xóa bộ lọc
                </button>
              </div>

              {filteredVideos.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-10 text-center space-y-2">
                  <Film className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    Chưa tìm thấy video nào khớp bộ lọc
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Hãy thử đổi trình độ, chủ đề hoặc bấm <b>&ldquo;Dán link YouTube&rdquo;</b> để tạo ngay bài học từ bất kỳ video nào!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredVideos.map((v) => renderVideoCard(v, false))}
                </div>
              )}
            </section>
          ) : (
            <div className="space-y-8">
              {/* 1. Khám phá (Horizontal Scroll Shelf with ‹ › arrows) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      Khám phá
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Lướt chọn nhanh các bài học đa dạng trình độ A1–C1
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => scrollExplore(-1)}
                      aria-label="Cuộn trái"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollExplore(1)}
                      aria-label="Cuộn phải"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div
                  ref={exploreScrollRef}
                  className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1"
                >
                  {allVideos.map((v) => renderVideoCard(v, true))}
                </div>
              </section>

              {/* 2. Video nổi bật */}
              {featuredVideos.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      Video nổi bật
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {featuredVideos.slice(0, 8).map((v) => renderVideoCard(v, false))}
                  </div>
                </section>
              )}

              {/* 3. Bài học mới */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-500" />
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    Bài học mới
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {newestVideos.map((v) => renderVideoCard(v, false))}
                </div>
              </section>

              {/* 4. Theo kênh */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tv className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    Theo kênh YouTube
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {channels.map((ch) => (
                    <button
                      key={ch.slug}
                      type="button"
                      onClick={() => handleSelectChannel(ch.slug)}
                      className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-indigo-400 dark:hover:border-indigo-500/60 p-3.5 text-left shadow-card transition flex items-center gap-3.5"
                    >
                      <img
                        src={ch.sampleThumbnail}
                        alt={ch.name}
                        loading="lazy"
                        className="h-16 w-24 rounded-xl object-cover shrink-0 bg-slate-900"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="truncate text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-sky-300 transition">
                            {ch.name}
                          </h4>
                          <span
                            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${
                              CEFR_BADGE_STYLES[ch.dominantLevel]
                            }`}
                          >
                            {ch.dominantLevel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {ch.videoCount} video · TB {formatVideoDuration(ch.avgDurationSec)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {ch.levels.map((lv) => (
                            <span
                              key={lv}
                              className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300"
                            >
                              {lv}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      <AddCustomVideoModal
        open={pasteModalOpen}
        onClose={() => setPasteModalOpen(false)}
        onCreated={handleCreatedCustomVideo}
      />
    </div>
  );
};
