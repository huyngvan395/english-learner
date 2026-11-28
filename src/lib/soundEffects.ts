/**
 * Subtle, zero-latency Web Audio API sound effects for TOEIC Mastery Hub.
 * Warm, soft, short chimes (~0.24 master volume) — zero external MP3 dependencies.
 */

const SOUND_PREF_KEY = 'tmh_sound_effects_enabled_v1';
const MASTER_VOLUME = 0.24;

let audioCtx: AudioContext | null = null;
let unlockListenersAttached = false;

const subscribers = new Set<(enabled: boolean) => void>();

function readInitialEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(SOUND_PREF_KEY);
    if (raw === null) return true;
    return raw !== 'false' && raw !== '0';
  } catch {
    return true;
  }
}

let soundEnabled: boolean = readInitialEnabled();

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(next: boolean): void {
  soundEnabled = Boolean(next);
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, soundEnabled ? 'true' : 'false');
  } catch {
    // Ignore storage restriction
  }
  subscribers.forEach((fn) => fn(soundEnabled));
}

export function toggleSoundEnabled(): boolean {
  const next = !soundEnabled;
  setSoundEnabled(next);
  if (next) {
    // Gentle audible confirmation when turning sound back on
    playSave();
  }
  return next;
}

export function subscribeSoundEnabled(listener: (enabled: boolean) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return null;
    try {
      audioCtx = new AudioCtxCtor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Browser may wait for direct user gesture
    });
  }
  return audioCtx;
}

/**
 * Unlock AudioContext cleanly on the user's first pointer or keyboard gesture.
 */
export function initSoundUnlock(): void {
  if (typeof window === 'undefined' || unlockListenersAttached) return;
  unlockListenersAttached = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    }
  };

  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('touchstart', unlock, { capture: true, passive: true });
}

if (typeof window !== 'undefined') {
  initSoundUnlock();
}

/** Helper: play a single warm tone with click-free attack and exponential decay. */
function scheduleTone(
  ctx: AudioContext,
  opts: {
    type: OscillatorType;
    freqStart: number;
    freqEnd?: number;
    startOffset: number;
    duration: number;
    gain: number;
    lowpassHz?: number;
  }
): void {
  const now = ctx.currentTime + opts.startOffset;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.freqStart, now);
  if (typeof opts.freqEnd === 'number' && opts.freqEnd !== opts.freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), now + opts.duration);
  }

  const peak = Math.max(0.0008, opts.gain * MASTER_VOLUME);
  const attack = Math.min(0.012, opts.duration * 0.2);

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(peak, now + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

  if (opts.lowpassHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.lowpassHz, now);
    osc.connect(filter);
    filter.connect(amp);
  } else {
    osc.connect(amp);
  }

  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + opts.duration + 0.015);
}

/**
 * Correct answer: 2 warm bright ascending bell notes (C5 -> E5), ~220ms total.
 */
export function playCorrect(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Note 1: C5 (523.25 Hz)
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 523.25,
      startOffset: 0,
      duration: 0.12,
      gain: 0.9,
    });
    scheduleTone(ctx, {
      type: 'triangle',
      freqStart: 1046.5,
      startOffset: 0,
      duration: 0.08,
      gain: 0.16,
      lowpassHz: 2400,
    });

    // Note 2: E5 (659.25 Hz)
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 659.25,
      startOffset: 0.075,
      duration: 0.15,
      gain: 1.0,
    });
    scheduleTone(ctx, {
      type: 'triangle',
      freqStart: 1318.5,
      startOffset: 0.075,
      duration: 0.1,
      gain: 0.15,
      lowpassHz: 2600,
    });
  } catch {
    // Graceful no-op if audio is restricted
  }
}

/**
 * Wrong answer: gentle, muted low wooden knock (~150ms, 180Hz -> 138Hz).
 */
export function playWrong(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    scheduleTone(ctx, {
      type: 'triangle',
      freqStart: 185,
      freqEnd: 136,
      startOffset: 0,
      duration: 0.145,
      gain: 0.95,
      lowpassHz: 420,
    });
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 145,
      freqEnd: 112,
      startOffset: 0.015,
      duration: 0.13,
      gain: 0.5,
    });
  } catch {
    // Ignore audio errors
  }
}

/**
 * Flashcard flip / reveal hint letter: ultra-short soft tactile paper tap (~60ms).
 */
export function playFlip(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Soft filtered paper brush noise (55ms)
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * 0.055));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const env = Math.sin((i / length) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1250, ctx.currentTime);
    bandpass.Q.setValueAtTime(1.1, ctx.currentTime);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, ctx.currentTime);
    amp.gain.linearRampToValueAtTime(0.32 * MASTER_VOLUME, ctx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.055);

    noise.connect(bandpass);
    bandpass.connect(amp);
    amp.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.06);

    // Subtle warm body tap underneath
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 460,
      freqEnd: 310,
      startOffset: 0,
      duration: 0.048,
      gain: 0.36,
      lowpassHz: 900,
    });
  } catch {
    // Ignore audio errors
  }
}

/**
 * Save word / star bookmark: crisp, bright crystalline "pop/ting" (~120ms).
 */
export function playSave(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    scheduleTone(ctx, {
      type: 'sine',
      freqStart: 698.46, // F5 -> C6 quick bright pop
      freqEnd: 1046.5,
      startOffset: 0,
      duration: 0.115,
      gain: 0.82,
    });
    scheduleTone(ctx, {
      type: 'triangle',
      freqStart: 1396.9,
      startOffset: 0.02,
      duration: 0.09,
      gain: 0.16,
      lowpassHz: 3000,
    });
  } catch {
    // Ignore audio errors
  }
}

/**
 * Topic / daily goal / exam / writing completion: warm ascending C major arpeggio (C5 -> E5 -> G5 -> C6, ~450ms).
 */
export function playSuccess(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [
      { freq: 523.25, offset: 0, dur: 0.2, gain: 0.78 }, // C5
      { freq: 659.25, offset: 0.085, dur: 0.22, gain: 0.84 }, // E5
      { freq: 783.99, offset: 0.17, dur: 0.24, gain: 0.9 }, // G5
      { freq: 1046.5, offset: 0.255, dur: 0.28, gain: 1.0 }, // C6
    ];

    for (const n of notes) {
      scheduleTone(ctx, {
        type: 'sine',
        freqStart: n.freq,
        startOffset: n.offset,
        duration: n.dur,
        gain: n.gain,
      });
      scheduleTone(ctx, {
        type: 'triangle',
        freqStart: n.freq * 2,
        startOffset: n.offset,
        duration: n.dur * 0.75,
        gain: n.gain * 0.12,
        lowpassHz: 3200,
      });
    }
  } catch {
    // Ignore audio errors
  }
}
