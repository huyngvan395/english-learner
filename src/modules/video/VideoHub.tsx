import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDownUp,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  Globe,
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

const PAGE_SIZE = 24;

type VideoSortOption = 'newest' | 'wpm_asc' | 'duration_asc';
type ChannelSortOption = 'most_videos' | 'famous_first' | 'alpha';

const CEFR_FILTERS: ('Tất cả' | VideoCefrLevel)[] = ['Tất cả', 'A1', 'A2', 'B1', 'B2', 'C1'];

const CEFR_ORDER: Record<VideoCefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
};

const SORT_OPTIONS: { id: VideoSortOption; label: string }[] = [
  { id: 'newest', label: 'Mới nhất' },
  { id: 'wpm_asc', label: 'Dễ → Khó (WPM tăng dần)' },
  { id: 'duration_asc', label: 'Ngắn → Dài' },
];

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

  // Main video list filters & sorting
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'Tất cả' | VideoCefrLevel>('Tất cả');
  const [topicFilter, setTopicFilter] = useState('Tất cả');
  const [sortBy, setSortBy] = useState<VideoSortOption>('newest');
  const [onlyMyVideos, setOnlyMyVideos] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(
    () => searchParams.get('channel') || null
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);

  // 24-Channel directory controls
  const [channelQuery, setChannelQuery] = useState('');
  const [channelLevelFilter, setChannelLevelFilter] = useState<'Tất cả' | VideoCefrLevel>('Tất cả');
  const [channelSort, setChannelSort] = useState<ChannelSortOption>('most_videos');

  const exploreScrollRef = useRef<HTMLDivElement | null>(null);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);

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

  // Reset pagination to first 24 cards whenever any filter or sort changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, levelFilter, topicFilter, sortBy, onlyMyVideos, selectedChannel]);

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

  const handleSelectChannel = (slug: string | null, shouldScroll = true) => {
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
    if (slug && shouldScroll) {
      window.setTimeout(() => {
        resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  };

  const hasActiveFilter =
    Boolean(query.trim()) ||
    levelFilter !== 'Tất cả' ||
    topicFilter !== 'Tất cả' ||
    onlyMyVideos ||
    Boolean(selectedChannel) ||
    sortBy !== 'newest';

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = allVideos.filter((v) => {
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

    const sorted = [...matched];
    if (sortBy === 'wpm_asc') {
      sorted.sort((a, b) => (a.wpm - b.wpm) || (CEFR_ORDER[a.level] - CEFR_ORDER[b.level]));
    } else if (sortBy === 'duration_asc') {
      sorted.sort((a, b) => a.durationSec - b.durationSec);
    } else {
      sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
    return sorted;
  }, [allVideos, query, levelFilter, topicFilter, selectedChannel, onlyMyVideos, myVideoIds, sortBy]);

  // Lightweight Discovery shelves (capped tightly so DOM never explodes at 1,000+ videos)
  const exploreVideos = useMemo(() => {
    const perLevel: Record<VideoCefrLevel, VideoCatalogItem[]> = {
      A1: [],
      A2: [],
      B1: [],
      B2: [],
      C1: [],
    };
    for (const v of allVideos) {
      if (perLevel[v.level].length < 4) perLevel[v.level].push(v);
    }
    const mixed = [...perLevel.A1, ...perLevel.A2, ...perLevel.B1, ...perLevel.B2, ...perLevel.C1];
    return (mixed.length >= 12 ? mixed : allVideos).slice(0, 18);
  }, [allVideos]);

  const featuredVideos = useMemo(() => allVideos.filter((v) => v.featured).slice(0, 8), [allVideos]);
  const paginatedVideos = useMemo(() => filteredVideos.slice(0, visibleCount), [filteredVideos, visibleCount]);
  const remainingVideos = Math.max(0, filteredVideos.length - paginatedVideos.length);

  // Filtered & sorted 24-channel directory
  const filteredChannels = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    const list = channels.filter((ch) => {
      if (channelLevelFilter !== 'Tất cả') {
        const matchesLv =
          ch.dominantLevel === channelLevelFilter ||
          ch.levels.includes(channelLevelFilter) ||
          (ch.levelRange || '').includes(channelLevelFilter);
        if (!matchesLv) return false;
      }
      if (q) {
        const hay = `${ch.name} ${ch.accent || ''} ${ch.accentCode || ''} ${ch.levelRange || ''} ${ch.topics.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (channelSort === 'most_videos') {
      sorted.sort((a, b) => (b.videoCount - a.videoCount) || ((a.tier === 'famous' ? 0 : 1) - (b.tier === 'famous' ? 0 : 1)) || a.name.localeCompare(b.name));
    } else if (channelSort === 'famous_first') {
      sorted.sort((a, b) => ((a.tier === 'famous' ? 0 : 1) - (b.tier === 'famous' ? 0 : 1)) || (b.videoCount - a.videoCount) || a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [channels, channelQuery, channelLevelFilter, channelSort]);

  const activeChannelMeta = useMemo(
    () => (selectedChannel ? channels.find((c) => c.slug === selectedChannel) || null : null),
    [channels, selectedChannel]
  );

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

  const clearAllFilters = () => {
    setQuery('');
    setLevelFilter('Tất cả');
    setTopicFilter('Tất cả');
    setSortBy('newest');
    setOnlyMyVideos(false);
    handleSelectChannel(null, false);
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
        <div className="relative aspect-video w-full bg-slate-900 overflow-hidden" data-preserve-dark="true">
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

  const renderPaginatedGrid = (items: VideoCatalogItem[], remaining: number) => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((v) => renderVideoCard(v, false))}
      </div>

      {remaining > 0 && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-2xl border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 px-6 py-2.5 text-xs sm:text-sm font-extrabold text-indigo-700 dark:text-indigo-200 shadow-sm transition active:scale-95"
          >
            <ChevronDown className="h-4 w-4" />
            Xem thêm {Math.min(PAGE_SIZE, remaining)} video (còn {remaining} video)
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ================= TOP SEARCH, FILTER, SORT & ACTION BAR ================= */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gradient-to-br dark:from-[#16203A] dark:via-[#111827] dark:to-[#0F172A] p-4 sm:p-6 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-400/35 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <Film className="h-3.5 w-3.5" />
              {allVideos.length} video · {channels.length} kênh YouTube chuẩn CEFR A1–C1
            </div>
            <h2 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Kho Video Luyện Tập YouTube
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Đủ 4 giọng Anh – Mỹ – Úc – Canada chuẩn TOEIC Listening: Dictation từng câu, Shadowing, Quiz &amp; Phụ đề song ngữ.
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

        {/* Search Box + Sort Selector + Level & Topic Filter Chips */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên video, chủ đề hoặc 24 kênh (BBC, TED-Ed, VOA, Lucy, mmmEnglish, Bob...)..."
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

            {/* Sort Dropdown */}
            <div className="relative shrink-0 flex items-center">
              <ArrowDownUp className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-indigo-500 dark:text-sky-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as VideoSortOption)}
                aria-label="Sắp xếp video"
                className="w-full sm:w-auto min-h-[42px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B1120]/85 pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    Sắp xếp: {opt.label}
                  </option>
                ))}
              </select>
            </div>
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
          {/* Anchor for smooth scrolling when picking a channel */}
          <div ref={resultsTopRef} className="scroll-mt-20" />

          {/* ================= CONTINUE WATCHING + 4 PRACTICE MODES ================= */}
          {!hasActiveFilter && continueWatching && (
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              {/* Continue Watching Card */}
              <div className="xl:col-span-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-card flex flex-col sm:flex-row gap-4 items-stretch">
                <div
                  onClick={() => openVideo(continueWatching.video.id, continueWatching.lastMode)}
                  data-preserve-dark="true"
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

          {/* ================= FILTERED / CHANNEL / SORTED PAGINATED VIEW ================= */}
          {hasActiveFilter ? (
            <section className="space-y-4">
              {/* Rich Selected Channel Banner */}
              {activeChannelMeta ? (
                <div className="rounded-3xl border border-indigo-200 dark:border-indigo-500/35 bg-gradient-to-r from-indigo-50 via-white to-sky-50 dark:from-[#16203A] dark:via-[#111827] dark:to-[#0F172A] p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {activeChannelMeta.sampleThumbnail ? (
                      <img
                        src={activeChannelMeta.sampleThumbnail}
                        alt={activeChannelMeta.name}
                        className="h-16 w-24 sm:h-20 sm:w-32 rounded-2xl object-cover shrink-0 bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="h-16 w-24 sm:h-20 sm:w-32 rounded-2xl shrink-0 bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white">
                        <Tv className="h-7 w-7" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {activeChannelMeta.tier === 'famous' && (
                          <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-400/40 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-300">
                            ★ Kênh nổi tiếng
                          </span>
                        )}
                        {activeChannelMeta.accent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            <Globe className="h-3 w-3 text-indigo-500" />
                            {activeChannelMeta.accent}
                          </span>
                        )}
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                            CEFR_BADGE_STYLES[activeChannelMeta.dominantLevel]
                          }`}
                        >
                          {activeChannelMeta.levelRange || activeChannelMeta.dominantLevel}
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
                        {activeChannelMeta.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Đang hiển thị <b className="text-indigo-700 dark:text-sky-300">{filteredVideos.length} video</b>
                        {activeChannelMeta.avgDurationSec > 0 && (
                          <> · TB {formatVideoDuration(activeChannelMeta.avgDurationSec)} · {activeChannelMeta.avgWpm || 135} WPM</>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="shrink-0 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                    Xem tất cả kênh
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      {onlyMyVideos ? 'Video của tôi' : 'Danh sách video phù hợp'}
                    </h3>
                    <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {filteredVideos.length} video
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                    Xóa bộ lọc
                  </button>
                </div>
              )}

              {filteredVideos.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-10 text-center space-y-2">
                  <Film className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    {activeChannelMeta && activeChannelMeta.videoCount === 0
                      ? `Kênh ${activeChannelMeta.name} đang chờ cập nhật đợt video tiếp theo`
                      : 'Chưa tìm thấy video nào khớp bộ lọc'}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Hãy thử đổi trình độ, chủ đề hoặc bấm <b>&ldquo;Dán link YouTube&rdquo;</b> để tạo ngay bài học từ bất kỳ video nào!
                  </p>
                </div>
              ) : (
                renderPaginatedGrid(paginatedVideos, remainingVideos)
              )}
            </section>
          ) : (
            <div className="space-y-8">
              {/* 1. Khám phá (Horizontal Scroll Shelf — tightly capped at 18 cards for fast DOM) */}
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
                  {exploreVideos.map((v) => renderVideoCard(v, true))}
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
                    {featuredVideos.map((v) => renderVideoCard(v, false))}
                  </div>
                </section>
              )}

              {/* 3. Tất cả bài học (Paginated 24/page with Load More — scales smoothly to 1,000+ videos) */}
              <section className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-cyan-500" />
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      Tất cả bài học
                    </h3>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                      Đang hiện {paginatedVideos.length}/{filteredVideos.length} video
                    </span>
                  </div>
                </div>
                {renderPaginatedGrid(paginatedVideos, remainingVideos)}
              </section>

              {/* 4. Theo kênh YouTube (24 Curated Channels with Search, Level Filter & Sort) */}
              <section className="space-y-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-6 shadow-card">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
                      <Tv className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                          Theo kênh YouTube
                        </h3>
                        <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/20 px-2.5 py-0.5 text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                          {channels.length} kênh
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Bấm vào bất kỳ kênh nào để lọc &amp; cuộn lên toàn bộ video của kênh đó
                      </p>
                    </div>
                  </div>

                  {/* Channel Search + Sort */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={channelQuery}
                        onChange={(e) => setChannelQuery(e.target.value)}
                        placeholder="Tìm kênh hoặc giọng (Anh, Mỹ, Úc, Canada)..."
                        className="w-full sm:w-64 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B1120] pl-8 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                      />
                      {channelQuery && (
                        <button
                          type="button"
                          onClick={() => setChannelQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <select
                      value={channelSort}
                      onChange={(e) => setChannelSort(e.target.value as ChannelSortOption)}
                      aria-label="Sắp xếp kênh YouTube"
                      className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B1120] px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="most_videos">Nhiều video nhất</option>
                      <option value="famous_first">Kênh nổi tiếng trước</option>
                      <option value="alpha">Tên kênh A → Z</option>
                    </select>
                  </div>
                </div>

                {/* Channel Level Filter Chips */}
                <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5">
                  <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
                    Lọc kênh theo trình độ:
                  </span>
                  {CEFR_FILTERS.map((lv) => {
                    const active = channelLevelFilter === lv;
                    return (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => setChannelLevelFilter(lv)}
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          active
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        {lv}
                      </button>
                    );
                  })}
                </div>

                {/* 24-Channel Grid */}
                {filteredChannels.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Không tìm thấy kênh YouTube nào khớp bộ lọc hiện tại.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredChannels.map((ch) => (
                      <button
                        key={ch.slug}
                        type="button"
                        onClick={() => handleSelectChannel(ch.slug, true)}
                        className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B1120]/70 hover:bg-white dark:hover:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-500/60 p-3 text-left transition flex items-center gap-3"
                      >
                        {ch.sampleThumbnail ? (
                          <img
                            src={ch.sampleThumbnail}
                            alt={ch.name}
                            loading="lazy"
                            className="h-16 w-24 rounded-xl object-cover shrink-0 bg-slate-900"
                          />
                        ) : (
                          <div className="h-16 w-24 rounded-xl shrink-0 bg-gradient-to-br from-slate-800 to-indigo-950 flex flex-col items-center justify-center text-slate-300 gap-1">
                            <Tv className="h-5 w-5 text-indigo-400" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">
                              {ch.accentCode || 'EN'}
                            </span>
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <h4 className="truncate text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-sky-300 transition">
                              {ch.name}
                            </h4>
                            <span
                              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${
                                CEFR_BADGE_STYLES[ch.dominantLevel]
                              }`}
                            >
                              {ch.levelRange || ch.dominantLevel}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            <b className="text-slate-800 dark:text-slate-200">{ch.videoCount} video</b>
                            {ch.avgDurationSec > 0
                              ? ` · TB ${formatVideoDuration(ch.avgDurationSec)}`
                              : ch.targetCount
                              ? ` · Mục tiêu ${ch.targetCount}`
                              : ''}
                          </p>

                          <div className="flex flex-wrap items-center gap-1">
                            {ch.tier === 'famous' && (
                              <span className="rounded bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-300">
                                ★ Nổi tiếng
                              </span>
                            )}
                            {ch.accent && (
                              <span className="rounded bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                {ch.accent}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
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
