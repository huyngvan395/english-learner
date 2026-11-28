import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { formatVideoDuration } from '../../utils/videoLoader';

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayerInstance }) => void;
            onStateChange?: (e: { data: number; target: YTPlayerInstance }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  destroy: () => void;
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && typeof window.YT.Player === 'function') return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
}

export interface YouTubePlayerHandle {
  playSegment: (start: number, end: number | null) => void;
  seekTo: (seconds: number, autoPlay?: boolean) => void;
  togglePlay: () => void;
  pause: () => void;
  play: () => void;
}

interface YouTubePlayerBoxProps {
  youtubeId: string;
  durationSec: number;
  segmentStart: number;
  segmentEnd: number | null;
  autoStopAtSegmentEnd: boolean;
  loopSegment: boolean;
  onToggleLoop: () => void;
  loopPauseMs?: number;
  onPrevSentence: () => void;
  onNextSentence: () => void;
  onReplaySentence: () => void;
  canPrev: boolean;
  canNext: boolean;
  onTimeUpdate?: (timeSec: number) => void;
  onSegmentEnd?: () => void;
  sentenceLabel?: string;
}

const PLAYBACK_RATES = [0.75, 0.8, 1, 1.2];

export const YouTubePlayerBox = React.forwardRef<YouTubePlayerHandle, YouTubePlayerBoxProps>(
  (
    {
      youtubeId,
      durationSec,
      segmentStart,
      segmentEnd,
      autoStopAtSegmentEnd,
      loopSegment,
      onToggleLoop,
      loopPauseMs = 0,
      onPrevSentence,
      onNextSentence,
      onReplaySentence,
      canPrev,
      canNext,
      onTimeUpdate,
      onSegmentEnd,
      sentenceLabel,
    },
    ref
  ) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<YTPlayerInstance | null>(null);
    const loopTimerRef = useRef<number | null>(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(durationSec);
    const [rate, setRate] = useState(1);

    // Keep latest props accessible inside polling loop without re-creating player
    const configRef = useRef({
      segmentStart,
      segmentEnd,
      autoStopAtSegmentEnd,
      loopSegment,
      loopPauseMs,
      onTimeUpdate,
      onSegmentEnd,
    });
    configRef.current = {
      segmentStart,
      segmentEnd,
      autoStopAtSegmentEnd,
      loopSegment,
      loopPauseMs,
      onTimeUpdate,
      onSegmentEnd,
    };

    const clearLoopTimer = () => {
      if (loopTimerRef.current !== null) {
        window.clearTimeout(loopTimerRef.current);
        loopTimerRef.current = null;
      }
    };

    // Initialize YouTube IFrame Player once per youtubeId
    useEffect(() => {
      let cancelled = false;
      setPlayerReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setTotalDuration(durationSec);
      clearLoopTimer();

      loadYouTubeIframeApi().then(() => {
        if (cancelled || !mountRef.current || !window.YT) return;

        // Clean mount container
        mountRef.current.innerHTML = '';
        const targetEl = document.createElement('div');
        mountRef.current.appendChild(targetEl);

        const player = new window.YT.Player(targetEl, {
          videoId: youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            cc_load_policy: 0,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              playerRef.current = e.target;
              setPlayerReady(true);
              const d = e.target.getDuration?.();
              if (d && d > 0) setTotalDuration(d);
            },
            onStateChange: (e) => {
              if (cancelled || !window.YT) return;
              const playing = e.data === window.YT.PlayerState.PLAYING;
              setIsPlaying(playing);
              if (e.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
              }
            },
          },
        });
        playerRef.current = player;
      });

      return () => {
        cancelled = true;
        clearLoopTimer();
        try {
          playerRef.current?.destroy();
        } catch {
          // Ignore destroy errors during rapid unmount
        }
        playerRef.current = null;
      };
    }, [youtubeId]);

    // Apply playback rate changes smoothly
    useEffect(() => {
      if (playerReady && playerRef.current) {
        try {
          playerRef.current.setPlaybackRate(rate);
        } catch {
          // Ignore unsupported rate
        }
      }
    }, [rate, playerReady]);

    // High-resolution playback polling (~90ms) for accurate sentence end-stop & loop
    useEffect(() => {
      if (!playerReady) return;
      const timer = window.setInterval(() => {
        const p = playerRef.current;
        if (!p || typeof p.getCurrentTime !== 'function') return;
        const t = p.getCurrentTime() || 0;
        setCurrentTime(t);
        const cfg = configRef.current;
        cfg.onTimeUpdate?.(t);

        const state = p.getPlayerState?.();
        const currentlyPlaying = window.YT && state === window.YT.PlayerState.PLAYING;
        if (!currentlyPlaying) return;

        if (cfg.segmentEnd !== null && t >= cfg.segmentEnd - 0.06) {
          if (cfg.loopSegment) {
            p.pauseVideo();
            clearLoopTimer();
            const delay = Math.max(120, cfg.loopPauseMs || 0);
            loopTimerRef.current = window.setTimeout(() => {
              loopTimerRef.current = null;
              const latest = configRef.current;
              if (playerRef.current) {
                playerRef.current.seekTo(latest.segmentStart, true);
                playerRef.current.playVideo();
              }
            }, delay);
          } else if (cfg.autoStopAtSegmentEnd) {
            p.pauseVideo();
            cfg.onSegmentEnd?.();
          }
        }
      }, 90);

      return () => window.clearInterval(timer);
    }, [playerReady]);

    useImperativeHandle(
      ref,
      () => ({
        playSegment: (start: number, _end: number | null) => {
          clearLoopTimer();
          const p = playerRef.current;
          if (!p) return;
          try {
            p.seekTo(Math.max(0, start), true);
            p.setPlaybackRate(rate);
            p.playVideo();
            setCurrentTime(start);
          } catch {
            // Ignore if player not yet ready
          }
        },
        seekTo: (seconds: number, autoPlay = true) => {
          clearLoopTimer();
          const p = playerRef.current;
          if (!p) return;
          try {
            p.seekTo(Math.max(0, seconds), true);
            setCurrentTime(seconds);
            if (autoPlay) {
              p.setPlaybackRate(rate);
              p.playVideo();
            }
          } catch {
            // Ignore
          }
        },
        togglePlay: () => {
          clearLoopTimer();
          const p = playerRef.current;
          if (!p) return;
          try {
            if (isPlaying) {
              p.pauseVideo();
            } else {
              if (
                configRef.current.autoStopAtSegmentEnd &&
                configRef.current.segmentEnd !== null &&
                (p.getCurrentTime?.() || 0) >= configRef.current.segmentEnd - 0.15
              ) {
                p.seekTo(Math.max(0, configRef.current.segmentStart), true);
              }
              p.setPlaybackRate(rate);
              p.playVideo();
            }
          } catch {
            // Ignore
          }
        },
        pause: () => {
          clearLoopTimer();
          try {
            playerRef.current?.pauseVideo();
          } catch {
            // Ignore
          }
        },
        play: () => {
          clearLoopTimer();
          try {
            playerRef.current?.setPlaybackRate(rate);
            playerRef.current?.playVideo();
          } catch {
            // Ignore
          }
        },
      }),
      [isPlaying, rate]
    );

    // Desktop keyboard shortcuts: Ctrl = replay current sentence (works even inside typing input!),
    // Space = play/pause when not typing, ArrowLeft / ArrowRight = prev/next sentence when not typing.
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        const isTypingField =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);

        if (e.key === 'Control' && !e.altKey && !e.metaKey && !e.shiftKey) {
          // Single Ctrl tap replays current sentence cleanly without disrupting dictation typing
          e.preventDefault();
          onReplaySentence();
          return;
        }

        if (isTypingField) return;

        if (e.code === 'Space') {
          e.preventDefault();
          if (isPlaying) {
            playerRef.current?.pauseVideo();
          } else {
            onReplaySentence();
          }
        } else if (e.key === 'ArrowLeft' && canPrev) {
          e.preventDefault();
          onPrevSentence();
        } else if (e.key === 'ArrowRight' && canNext) {
          e.preventDefault();
          onNextSentence();
        }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [isPlaying, canPrev, canNext, onPrevSentence, onNextSentence, onReplaySentence]);

    const handleTogglePlayClick = () => {
      clearLoopTimer();
      const p = playerRef.current;
      if (!p) return;
      if (isPlaying) {
        p.pauseVideo();
      } else {
        if (
          autoStopAtSegmentEnd &&
          segmentEnd !== null &&
          (currentTime >= segmentEnd - 0.15 || currentTime < Math.max(0, segmentStart - 0.5))
        ) {
          p.seekTo(Math.max(0, segmentStart), true);
        }
        p.setPlaybackRate(rate);
        p.playVideo();
      }
    };

    const handleScrub = (val: number) => {
      clearLoopTimer();
      setCurrentTime(val);
      try {
        playerRef.current?.seekTo(val, true);
      } catch {
        // Ignore
      }
    };

    const safeMax = Math.max(1, totalDuration || durationSec || 1);

    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#111827] shadow-card overflow-hidden">
        {/* 16:9 Responsive YouTube IFrame Embed */}
        <div className="relative w-full aspect-video bg-slate-950 overflow-hidden">
          <div ref={mountRef} className="absolute inset-0 w-full h-full [&>iframe]:w-full [&>iframe]:h-full" />
          {!playerReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-xs font-semibold text-slate-300">
              Đang kết nối trình phát YouTube...
            </div>
          )}
        </div>

        {/* Custom Controls Deck */}
        <div className="p-3 sm:p-4 space-y-3 bg-slate-50/90 dark:bg-[#0F172A]/95 border-t border-slate-200 dark:border-slate-800">
          {/* Scrubber + Timestamps */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={safeMax}
              step={0.1}
              value={Math.min(safeMax, currentTime)}
              onChange={(e) => handleScrub(Number(e.target.value))}
              aria-label="Thanh tiến trình video"
              className="w-full h-1.5 accent-indigo-600 dark:accent-indigo-400 cursor-pointer rounded-lg bg-slate-300 dark:bg-slate-700"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <span>{formatVideoDuration(currentTime)}</span>
              {sentenceLabel && (
                <span className="font-sans font-bold text-indigo-600 dark:text-indigo-300 truncate px-2">
                  {sentenceLabel}
                </span>
              )}
              <span>{formatVideoDuration(safeMax)}</span>
            </div>
          </div>

          {/* Primary Transport Buttons + Speed Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!canPrev}
                onClick={onPrevSentence}
                title="Câu trước (←)"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition active:scale-95"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onReplaySentence}
                title="Nghe lại câu hiện tại (Ctrl)"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 dark:text-cyan-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleTogglePlayClick}
                title="Phát / Dừng (Space)"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow hover:brightness-110 transition active:scale-95"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={onToggleLoop}
                title="Lặp 1 câu"
                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-95 ${
                  loopSegment
                    ? 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Repeat className="h-4 w-4" />
              </button>

              <button
                type="button"
                disabled={!canNext}
                onClick={onNextSentence}
                title="Câu sau (→)"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition active:scale-95"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>

            {/* Playback Rate Switcher */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-0.5">
              {PLAYBACK_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRate(r)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition ${
                    rate === r
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Keyboard Shortcut Hint (hidden on Mobile) */}
          <p className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400">
            Phím tắt: <kbd className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">Ctrl</kbd> nghe lại câu ·{' '}
            <kbd className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">Space</kbd> phát/dừng ·{' '}
            <kbd className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">←</kbd>{' '}
            <kbd className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">→</kbd> chuyển câu
          </p>
        </div>
      </div>
    );
  }
);

YouTubePlayerBox.displayName = 'YouTubePlayerBox';
