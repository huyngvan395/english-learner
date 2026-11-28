import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Flame,
  GraduationCap,
  Loader2,
  Menu,
  Moon,
  Search,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  Volume1,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { SearchIndexEntry, VocabWord } from '../types';
import { loadFullWord } from '../utils/vocabLoader';
import { playWordAudio, speakText } from '../utils/speech';
import {
  getCombo,
  getLoadedCustomSfxCount,
  getSoundVolume,
  isKeyTickEnabled,
  isSoundEnabled,
  playComplete,
  playCorrect,
  playWrong,
  setSoundVolume,
  subscribeCombo,
  subscribeCustomSfxCount,
  subscribeKeyTickEnabled,
  subscribeSoundEnabled,
  subscribeSoundVolume,
  subscribeXpPulse,
  toggleKeyTickEnabled,
  toggleSoundEnabled,
} from '../lib/soundEffects';
import { VocabExtensionBlock } from './VocabExtensionBlock';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { searchIndex, customWords, profile, toggleSaveWord, isWordSaved } = useApp();
  const { isDark, toggleTheme } = useTheme();
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  const [soundVolume, setSoundVolumeState] = useState<number>(() => getSoundVolume());
  const [keyTickOn, setKeyTickOn] = useState<boolean>(() => isKeyTickEnabled());
  const [customSfxCount, setCustomSfxCount] = useState<number>(() => getLoadedCustomSfxCount());
  const [soundPopoverOpen, setSoundPopoverOpen] = useState(false);
  const [comboStreak, setComboStreak] = useState<number>(() => getCombo());
  const [xpBounceKey, setXpBounceKey] = useState(0);
  const [milestoneToast, setMilestoneToast] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const soundMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubEnabled = subscribeSoundEnabled(setSoundOn);
    const unsubVolume = subscribeSoundVolume(setSoundVolumeState);
    const unsubKeyTick = subscribeKeyTickEnabled(setKeyTickOn);
    const unsubCustomSfx = subscribeCustomSfxCount(setCustomSfxCount);
    const unsubCombo = subscribeCombo(setComboStreak);
    let toastTimer: number | null = null;
    const unsubPulse = subscribeXpPulse((ev) => {
      if (ev.milestone) {
        setXpBounceKey((k) => k + 1);
        if (ev.combo >= 5 && ev.combo % 5 === 0) {
          setMilestoneToast(ev.combo);
          if (toastTimer) window.clearTimeout(toastTimer);
          toastTimer = window.setTimeout(() => setMilestoneToast(null), 1700);
        }
      }
    });
    return () => {
      unsubEnabled();
      unsubVolume();
      unsubKeyTick();
      unsubCustomSfx();
      unsubCombo();
      unsubPulse();
      if (toastTimer) window.clearTimeout(toastTimer);
    };
  }, []);

  // Close sound volume popover on outside click or Escape
  useEffect(() => {
    if (!soundPopoverOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (soundMenuRef.current && target && soundMenuRef.current.contains(target)) return;
      setSoundPopoverOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSoundPopoverOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [soundPopoverOpen]);
  const [isOpen, setIsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SearchIndexEntry | null>(null);
  const [selectedFullWord, setSelectedFullWord] = useState<VocabWord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const exactOrPrefix: SearchIndexEntry[] = [];
    const contains: SearchIndexEntry[] = [];
    for (const item of searchIndex) {
      const wLower = item.word.toLowerCase();
      if (wLower.startsWith(q)) {
        exactOrPrefix.push(item);
      } else if (wLower.includes(q) || item.meaningVi.toLowerCase().includes(q)) {
        contains.push(item);
      }
      if (exactOrPrefix.length >= 10 && contains.length >= 10) break;
    }
    return [...exactOrPrefix, ...contains].slice(0, 10);
  }, [query, searchIndex]);

  const handleOpenEntry = async (entry: SearchIndexEntry) => {
    setSelectedEntry(entry);
    setSelectedFullWord(null);
    setIsOpen(false);

    // Check customWords first (e.g., words saved from Listening)
    const customMatch = customWords.find((w) => w.id === entry.id);
    if (customMatch) {
      setSelectedFullWord(customMatch);
      return;
    }

    setLoadingDetail(true);
    try {
      const full = await loadFullWord(entry.deckId, entry.id);
      setSelectedFullWord(full);
    } catch {
      setSelectedFullWord(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setSelectedEntry(null);
    setSelectedFullWord(null);
    setLoadingDetail(false);
  };

  const goalPct = Math.min(
    100,
    Math.round((profile.todayWordsStudied / Math.max(1, profile.dailyGoal)) * 100)
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B1120]/95 backdrop-blur-md">
        <div className="flex h-14 md:h-16 items-center justify-between gap-2 md:gap-3 px-3 sm:px-4 lg:px-6">
          {/* Left: Mobile menu + Compact Mobile Brand / Desktop Quick Dictionary */}
          <div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0 max-w-xl">
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white active:scale-95 transition"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile Compact Logo (< md) */}
            <div className="flex md:hidden items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 text-white shadow-sm">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="truncate text-sm font-extrabold tracking-tight text-white">
                TOEIC Hub
              </span>
            </div>

            {/* Desktop & Tablet Inline Search (md+) */}
            <div className="relative hidden md:block flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                placeholder={`Tra từ điển nhanh (${searchIndex.length.toLocaleString('vi-VN')} từ Anh / Việt...)`}
                className="w-full rounded-xl border border-slate-700/70 bg-slate-900/90 pl-10 pr-9 py-2 text-base md:text-sm text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Instant Dropdown powered by lightweight search-index.json */}
              {isOpen && query.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-12 z-50 rounded-2xl border border-slate-700/80 bg-[#111827] shadow-2xl overflow-hidden">
                  {results.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400">
                      Không tìm thấy từ phù hợp với &ldquo;{query}&rdquo; trong chỉ mục {searchIndex.length.toLocaleString('vi-VN')} từ.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
                      {results.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenEntry(item)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/70 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100">{item.word}</span>
                              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                                {item.partOfSpeech}
                              </span>
                              <span className="font-mono text-xs text-slate-400">{item.ipaUS}</span>
                            </div>
                            <p className="truncate text-xs text-slate-300 mt-0.5">{item.meaningVi}</p>
                          </div>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              speakText(item.word, { accent: 'en-US' });
                            }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-indigo-400 hover:bg-indigo-600 hover:text-white transition"
                            title="Nghe phát âm US"
                          >
                            <Volume2 className="h-4 w-4" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Sound Control + Theme Toggle + Mobile Search + Streak, XP, Daily Goal */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Sound Mute Toggle + Volume & Quick Test Popover */}
            <div ref={soundMenuRef} className="relative flex items-center">
              <div
                className={`inline-flex h-9 items-center rounded-xl border transition overflow-hidden ${
                  soundOn && soundVolume > 0
                    ? 'border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
                    : 'border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 text-slate-500 dark:text-slate-400'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSoundEnabled()}
                  aria-label={soundOn ? 'Tắt âm thanh phản hồi' : 'Bật âm thanh phản hồi'}
                  aria-pressed={soundOn}
                  title={
                    soundOn
                      ? `Âm thanh hiệu ứng: Đang bật (${soundVolume}%) — Bấm để tắt nhanh`
                      : 'Âm thanh hiệu ứng: Đang tắt — Bấm để bật nhanh'
                  }
                  className="flex h-full w-8 sm:w-9 items-center justify-center hover:bg-indigo-100/80 dark:hover:bg-indigo-500/25 active:scale-95 transition"
                >
                  {!soundOn || soundVolume === 0 ? (
                    <VolumeX className="h-4 w-4 shrink-0" />
                  ) : soundVolume < 45 ? (
                    <Volume1 className="h-4 w-4 shrink-0" />
                  ) : (
                    <Volume2 className="h-4 w-4 shrink-0" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSoundPopoverOpen((v) => !v)}
                  aria-label="Mở bảng chỉnh âm lượng và nghe thử"
                  aria-expanded={soundPopoverOpen}
                  title="Chỉnh âm lượng & Nghe thử hiệu ứng"
                  className="flex h-full w-5 sm:w-6 items-center justify-center border-l border-indigo-200/80 dark:border-slate-700/80 hover:bg-indigo-100/80 dark:hover:bg-indigo-500/25 transition"
                >
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-200 ${
                      soundPopoverOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              {soundPopoverOpen && (
                <div className="fixed right-3 top-16 sm:absolute sm:right-0 sm:top-11 z-50 w-64 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-[#131C31] p-3.5 shadow-2xl animate-fade-up space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Âm thanh hiệu ứng
                    </span>
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                        soundOn && soundVolume > 0
                          ? 'border-emerald-200 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {soundOn && soundVolume > 0 ? `Bật · ${soundVolume}%` : 'Đang tắt'}
                    </span>
                  </div>

                  {/* Volume Slider (0–100%) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <span>Âm lượng</span>
                      <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                        {soundOn ? `${soundVolume}%` : '0%'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={soundOn ? soundVolume : 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSoundVolume(val);
                      }}
                      aria-label="Điều chỉnh âm lượng hiệu ứng"
                      className="w-full h-1.5 rounded-lg accent-indigo-600 dark:accent-indigo-400 cursor-pointer"
                    />
                  </div>

                  {/* Optional Subtle Typing Key-Tick Toggle */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Âm gõ phím nhẹ
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={keyTickOn}
                      onClick={() => toggleKeyTickEnabled()}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        keyTickOn
                          ? 'bg-indigo-600 dark:bg-indigo-500'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          keyTickOn ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Quick Test Buttons */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Nghe thử ngay
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => playCorrect({ isTest: true })}
                        className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 px-2 py-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-200 transition active:scale-95"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Đúng</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => playWrong({ isTest: true })}
                        className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 px-2 py-2 text-[11px] font-bold text-rose-800 dark:text-rose-200 transition active:scale-95"
                      >
                        <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Sai</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => playComplete({ isTest: true })}
                        className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 px-2 py-2 text-[11px] font-bold text-amber-800 dark:text-amber-200 transition active:scale-95"
                      >
                        <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Xong</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Combo & Engine Footer */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    <span>
                      {customSfxCount > 0
                        ? `MP3 SFX (${customSfxCount}/5)`
                        : 'Nhạc cụ Web Audio'}
                    </span>
                    {comboStreak >= 2 ? (
                      <span className="font-extrabold text-amber-600 dark:text-amber-300">
                        🔥 Combo x{comboStreak}
                      </span>
                    ) : (
                      <span>Combo tăng cao độ</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              title={isDark ? 'Chuyển sang giao diện Sáng (Light Mode)' : 'Chuyển sang giao diện Tối (Dark Mode)'}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 hover:border-indigo-500/60 px-2 sm:px-2.5 text-xs font-bold text-slate-200 hover:text-white active:scale-95 transition"
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="hidden md:inline">Sáng</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="hidden md:inline">Tối</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen((v) => {
                  const next = !v;
                  if (next) {
                    window.setTimeout(() => mobileInputRef.current?.focus(), 60);
                  } else {
                    setIsOpen(false);
                  }
                  return next;
                });
              }}
              aria-label="Tra từ điển nhanh"
              className={`md:hidden flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                mobileSearchOpen
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              {mobileSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>

            <div
              className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 sm:px-2.5 py-1.5 text-amber-300"
              title="Chuỗi ngày học liên tiếp"
            >
              <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-amber-400 text-amber-400" />
              <span className="text-xs sm:text-sm font-bold">{profile.streak}</span>
              <span className="hidden md:inline text-[11px] text-amber-200/80">ngày</span>
            </div>

            <div
              key={xpBounceKey}
              className={`relative flex items-center gap-1 rounded-xl border border-violet-500/30 bg-violet-500/10 px-2 sm:px-2.5 py-1.5 text-violet-300 ${
                xpBounceKey > 0 ? 'animate-xp-bounce' : ''
              }`}
              title={
                comboStreak >= 2
                  ? `Điểm kinh nghiệm tích lũy • Đang chuỗi đúng x${comboStreak}`
                  : 'Điểm kinh nghiệm tích lũy'
              }
            >
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-400" />
              <span className="text-xs sm:text-sm font-bold">{profile.xp}</span>
              <span className="hidden sm:inline text-[11px] text-violet-200/80">XP</span>
              {milestoneToast !== null && (
                <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-300 dark:border-amber-400/60 bg-amber-100 dark:bg-amber-500/90 px-2 py-0.5 text-[10px] font-black text-amber-900 dark:text-slate-950 shadow-md animate-fade-up">
                  🔥 x{milestoneToast}!
                </span>
              )}
            </div>

            {/* Compact Daily Goal chip on tiny phones */}
            <div
              className="flex sm:hidden items-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 text-cyan-300"
              title="Mục tiêu ôn từ vựng mỗi ngày"
            >
              <Target className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-bold">
                {profile.todayWordsStudied}/{profile.dailyGoal}
              </span>
            </div>

            <div
              className="hidden sm:flex items-center gap-2.5 rounded-xl border border-slate-700/70 bg-slate-900/90 px-3 py-1.5"
              title="Mục tiêu ôn từ vựng mỗi ngày"
            >
              <Target className="h-4 w-4 text-cyan-400 shrink-0" />
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                  <span className="text-slate-300">Mục tiêu ngày</span>
                  <span className="text-cyan-300">
                    {profile.todayWordsStudied}/{profile.dailyGoal} từ
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-300"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Full-Width Mobile Quick Dictionary Bar (< md) */}
        {mobileSearchOpen && (
          <div className="md:hidden border-t border-slate-800/80 px-3 py-2.5 bg-[#0B1120]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                placeholder={`Tra từ điển nhanh (${searchIndex.length.toLocaleString('vi-VN')} từ)...`}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900 pl-10 pr-9 py-2.5 text-base text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {isOpen && query.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-12 z-50 rounded-2xl border border-slate-700/80 bg-[#111827] shadow-2xl overflow-hidden">
                  {results.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400">
                      Không tìm thấy từ phù hợp với &ldquo;{query}&rdquo;.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80 max-h-[60dvh] overflow-y-auto">
                      {results.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            handleOpenEntry(item);
                            setMobileSearchOpen(false);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/70 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-100">{item.word}</span>
                              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                                {item.partOfSpeech}
                              </span>
                              <span className="font-mono text-xs text-slate-400">{item.ipaUS}</span>
                            </div>
                            <p className="truncate text-xs text-slate-300 mt-0.5">{item.meaningVi}</p>
                          </div>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              speakText(item.word, { accent: 'en-US' });
                            }}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-indigo-400 hover:bg-indigo-600 hover:text-white transition"
                            title="Nghe phát âm US"
                          >
                            <Volume2 className="h-4 w-4" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Backdrop to close dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
      )}

      {/* Quick Dictionary Detail Modal (lazy-loads full card from deck JSON) */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-700/80 bg-[#1E293B] p-4 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-2xl font-extrabold text-white">{selectedEntry.word}</h3>
                  <span className="rounded-md bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-xs font-bold text-indigo-300">
                    {selectedEntry.partOfSpeech}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      playWordAudio(selectedEntry.word, {
                        accent: 'en-US',
                        audioUrl: selectedFullWord?.audioUrlUS,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/80 px-2.5 py-1 text-slate-200 transition"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="font-semibold">US</span>
                    <span className="font-mono text-slate-300">
                      {selectedFullWord?.ipaUS || selectedEntry.ipaUS}
                    </span>
                  </button>
                  {selectedFullWord?.ipaUK && (
                    <button
                      type="button"
                      onClick={() =>
                        playWordAudio(selectedEntry.word, {
                          accent: 'en-GB',
                          audioUrl: selectedFullWord.audioUrlUK,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/80 px-2.5 py-1 text-slate-200 transition"
                    >
                      <Volume2 className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-semibold">UK</span>
                      <span className="font-mono text-slate-300">{selectedFullWord.ipaUK}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSaveWord(selectedEntry.id, selectedEntry.deckId)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                    isWordSaved(selectedEntry.id)
                      ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-amber-300'
                  }`}
                  title="Lưu vào Từ vựng của tôi"
                >
                  <Star className={`h-4 w-4 ${isWordSaved(selectedEntry.id) ? 'fill-amber-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-900/80 border border-slate-700/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nghĩa tiếng Việt</p>
              <p className="mt-1 text-base font-bold text-sky-300">{selectedEntry.meaningVi}</p>
              {selectedFullWord?.definitionEn && (
                <p className="mt-2 text-xs text-slate-300">{selectedFullWord.definitionEn}</p>
              )}
              {selectedFullWord?.definitionVi &&
                selectedFullWord.definitionVi.trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase() !==
                  (selectedFullWord.definitionEn || '').trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase() && (
                  <p className="mt-1 text-xs text-slate-400 italic">{selectedFullWord.definitionVi}</p>
                )}
            </div>

            {loadingDetail ? (
              <div className="mt-5 flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                Đang tải ví dụ &amp; collocations...
              </div>
            ) : (
              selectedFullWord && (
                <>
                  {selectedFullWord.examples.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ví dụ song ngữ</p>
                      {selectedFullWord.examples.map((ex, i) => (
                        <div key={i} className="rounded-xl bg-slate-900/60 border border-slate-800 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-slate-100 leading-relaxed">{ex.en}</p>
                            <button
                              type="button"
                              onClick={() => speakText(ex.en, { accent: 'en-US' })}
                              className="shrink-0 text-slate-400 hover:text-indigo-400"
                              title="Nghe câu ví dụ"
                            >
                              <Volume2 className="h-4 w-4" />
                            </button>
                          </div>
                          {ex.vi &&
                            ex.vi.trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase() !==
                              ex.en.trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase() && (
                              <p className="mt-1 text-xs text-slate-400">{ex.vi}</p>
                            )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    <VocabExtensionBlock
                      synonyms={selectedFullWord.synonyms}
                      antonyms={selectedFullWord.antonyms}
                      wordFamily={selectedFullWord.wordFamily}
                      collocations={selectedFullWord.collocations}
                      relationMeanings={selectedFullWord.relationMeanings}
                      defaultOpen
                      onQuickLookup={handleOpenEntry}
                    />
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
};
