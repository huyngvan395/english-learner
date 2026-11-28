import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Repeat, RotateCcw, RotateCw, Volume2 } from 'lucide-react';
import { SequenceLine, SpeechSequenceController } from '../utils/speech';

interface SmartAudioPlayerProps {
  lines: SequenceLine[];
  audioUrl?: string;
  activeLineId?: string | null;
  onActiveLineChange?: (lineId: string | null, index: number) => void;
  externalPlayLineIndex?: { index: number; token: number } | null;
  compact?: boolean;
  sticky?: boolean;
  label?: string;
}

const SPEEDS = [0.8, 1.0, 1.2];

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const SmartAudioPlayer: React.FC<SmartAudioPlayerProps> = ({
  lines,
  audioUrl,
  onActiveLineChange,
  externalPlayLineIndex,
  compact = false,
  sticky = false,
  label = 'Trình phát Audio TOEIC thông minh',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1.0);
  const [loopCurrent, setLoopCurrent] = useState(false);

  // Real HTML5 MP3 state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [mp3Failed, setMp3Failed] = useState(false);

  const useRealMp3 = Boolean(audioUrl) && !mp3Failed;
  const controllerRef = useRef<SpeechSequenceController | null>(null);

  useEffect(() => {
    const ctrl = new SpeechSequenceController({
      onIndexChange: (idx, lineId) => {
        setCurrentIndex(idx);
        onActiveLineChange?.(lineId, idx);
      },
      onStateChange: (playing) => {
        setIsPlaying(playing);
      },
      onComplete: () => {
        setIsPlaying(false);
      },
    });
    controllerRef.current = ctrl;
    return () => {
      ctrl.stop();
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setLines(lines);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentIndex(0);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setMp3Failed(false);
    setIsPlaying(false);
    setLoopCurrent(false);
  }, [lines, audioUrl]);

  useEffect(() => {
    controllerRef.current?.setRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, [rate]);

  useEffect(() => {
    controllerRef.current?.setLoopLine(loopCurrent ? currentIndex : null);
  }, [loopCurrent, currentIndex]);

  // Handle clicking a specific line in Interactive Transcript
  useEffect(() => {
    if (!externalPlayLineIndex) return;
    const idx = Math.max(0, Math.min(lines.length - 1, externalPlayLineIndex.index));
    const targetLine = lines[idx];
    setCurrentIndex(idx);
    onActiveLineChange?.(targetLine?.id ?? null, idx);

    if (useRealMp3 && audioRef.current) {
      const el = audioRef.current;
      if (targetLine?.startMs !== undefined) {
        el.currentTime = targetLine.startMs / 1000;
      }
      el.playbackRate = rate;
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setMp3Failed(true);
          controllerRef.current?.playFrom(idx);
        });
      return;
    }

    if (loopCurrent) {
      controllerRef.current?.setLoopLine(idx);
    }
    controllerRef.current?.playFrom(idx);
  }, [externalPlayLineIndex]);

  const handleTogglePlay = () => {
    if (useRealMp3 && audioRef.current) {
      const el = audioRef.current;
      if (isPlaying) {
        el.pause();
        setIsPlaying(false);
      } else {
        el.playbackRate = rate;
        el.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setMp3Failed(true);
            controllerRef.current?.togglePlay();
          });
      }
      return;
    }
    controllerRef.current?.togglePlay();
  };

  const handleStep = (delta: number) => {
    if (useRealMp3 && audioRef.current) {
      const el = audioRef.current;
      const nextTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta * 5));
      el.currentTime = nextTime;
      setAudioCurrentTime(nextTime);
      return;
    }
    controllerRef.current?.step(delta);
  };

  const handleScrub = (val: number) => {
    if (useRealMp3 && audioRef.current && audioDuration > 0) {
      const nextTime = (val / 100) * audioDuration;
      audioRef.current.currentTime = nextTime;
      setAudioCurrentTime(nextTime);
      return;
    }
    const targetIdx = Math.min(lines.length - 1, Math.max(0, val));
    setCurrentIndex(targetIdx);
    if (isPlaying) {
      controllerRef.current?.playFrom(targetIdx);
    } else {
      onActiveLineChange?.(lines[targetIdx]?.id ?? null, targetIdx);
    }
  };

  const handleAudioTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const el = e.currentTarget;
    const nowSec = el.currentTime;
    const nowMs = nowSec * 1000;
    setAudioCurrentTime(nowSec);

    // Loop strictly within the active transcript line if Loop 1 câu is enabled
    const activeLine = lines[currentIndex];
    if (
      loopCurrent &&
      activeLine &&
      activeLine.startMs !== undefined &&
      activeLine.endMs !== undefined &&
      nowMs >= activeLine.endMs
    ) {
      el.currentTime = activeLine.startMs / 1000;
      return;
    }

    // Sync highlighted line in Interactive Transcript
    const matchedIdx = lines.findIndex(
      (l) => l.startMs !== undefined && l.endMs !== undefined && nowMs >= l.startMs && nowMs <= l.endMs + 250
    );
    if (matchedIdx !== -1 && matchedIdx !== currentIndex) {
      setCurrentIndex(matchedIdx);
      onActiveLineChange?.(lines[matchedIdx].id, matchedIdx);
    }
  };

  const progressPercent = useRealMp3
    ? audioDuration > 0
      ? Math.min(100, Math.round((audioCurrentTime / audioDuration) * 100))
      : 0
    : lines.length <= 1
    ? isPlaying
      ? 100
      : 0
    : Math.round(((currentIndex + (isPlaying ? 1 : 0)) / Math.max(1, lines.length)) * 100);

  return (
    <div
      className={`rounded-2xl border border-slate-700/80 ${
        sticky
          ? 'sticky top-14 md:top-16 z-20 bg-slate-900/95 backdrop-blur-md shadow-xl'
          : 'bg-slate-900/90 shadow-card'
      } ${compact ? 'p-3' : 'p-3.5 sm:p-5'}`}
    >
      {audioUrl && !mp3Failed && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => {
            setAudioDuration(e.currentTarget.duration || 0);
            e.currentTarget.playbackRate = rate;
          }}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={() => {
            if (loopCurrent && audioRef.current) {
              const activeLine = lines[currentIndex];
              audioRef.current.currentTime = (activeLine?.startMs ?? 0) / 1000;
              audioRef.current.play().catch(() => setIsPlaying(false));
            } else {
              setIsPlaying(false);
            }
          }}
          onError={() => setMp3Failed(true)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
            <Volume2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">{label}</p>
            <p className="text-[11px] text-slate-400 truncate">
              {useRealMp3
                ? `Audio MP3 ETS • Câu ${Math.min(currentIndex + 1, lines.length)}/${lines.length}`
                : `Đoạn ${Math.min(currentIndex + 1, lines.length)} / ${lines.length} • Giọng AI dự phòng`}
            </p>
          </div>
        </div>

        {/* Speed & Loop controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center rounded-lg bg-slate-800/90 p-0.5 border border-slate-700/60">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRate(s)}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                  rate === s
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.toFixed(1)}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLoopCurrent((prev) => !prev)}
            title="Lặp lại đúng câu hiện tại để luyện nghe chép chính tả / Shadowing"
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition ${
              loopCurrent
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-800/90 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
          >
            <Repeat className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{loopCurrent ? 'Đang lặp 1 câu' : 'Lặp 1 câu'}</span>
          </button>
        </div>
      </div>

      {/* Main controls + Scrubber */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => handleStep(-1)}
          title="Lùi 5 giây"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleTogglePlay}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow hover:from-blue-500 hover:to-indigo-500 transition active:scale-95"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={() => handleStep(1)}
          title="Tua tới 5 giây"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
        >
          <RotateCw className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={useRealMp3 ? 100 : Math.max(0, lines.length - 1)}
            value={useRealMp3 ? progressPercent : currentIndex}
            onChange={(e) => handleScrub(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer h-1.5 rounded-lg bg-slate-700"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>{useRealMp3 ? formatSec(audioCurrentTime) : isPlaying ? 'Đang phát...' : 'Sẵn sàng'}</span>
            <span>{useRealMp3 ? formatSec(audioDuration) : `${progressPercent}%`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
