// Smart Web Speech API Engine supporting US/UK voices, Male/Female voice selection,
// multi-line sequential playback, rate control, single-line playback, and future MP3 audioUrl hook.

export type AccentType = 'en-US' | 'en-GB';

export interface SpeakOptions {
  accent?: AccentType;
  rate?: number;
  gender?: 'male' | 'female';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}

const FEMALE_HINTS = ['female', 'zira', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'hazel', 'susan', 'libby', 'sonia', 'aria', 'jenny', 'google uk english female', 'google us english'];
const MALE_HINTS = ['male', 'david', 'mark', 'alex', 'daniel', 'george', 'ryan', 'guy', 'james', 'arthur', 'oliver', 'google uk english male'];

export function pickVoice(accent: AccentType = 'en-US', gender?: 'male' | 'female'): SpeechSynthesisVoice | null {
  const voices = loadVoices();
  if (!voices.length) return null;

  const langPrefix = accent.toLowerCase();
  const exactLang = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === langPrefix);
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = exactLang.length > 0 ? exactLang : englishVoices;
  if (!pool.length) return voices[0] || null;

  if (gender) {
    const hints = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
    const matched = pool.find((v) =>
      hints.some((h) => v.name.toLowerCase().includes(h))
    );
    if (matched) return matched;

    // Fallback across all English voices if exact accent doesn't have that gender
    const fallbackMatch = englishVoices.find((v) =>
      hints.some((h) => v.name.toLowerCase().includes(h))
    );
    if (fallbackMatch) return fallbackMatch;
  }

  // Prefer natural/Google/Microsoft voices
  const preferred = pool.find((v) => /natural|google|microsoft/i.test(v.name));
  return preferred || pool[0];
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(text: string, options: SpeakOptions = {}): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onEnd?.();
    return;
  }
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(text);
  const accent = options.accent || 'en-US';
  utterance.lang = accent;
  utterance.rate = options.rate ?? 1.0;

  const voice = pickVoice(accent, options.gender);
  if (voice) {
    utterance.voice = voice;
  }

  // Subtle pitch distinction when browser has limited voices
  if (options.gender === 'male') {
    utterance.pitch = 0.92;
  } else if (options.gender === 'female') {
    utterance.pitch = 1.08;
  }

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onError?.();

  window.speechSynthesis.speak(utterance);
}

export interface SequenceLine {
  id: string;
  text: string;
  accent?: AccentType;
  gender?: 'male' | 'female';
  startMs?: number;
  endMs?: number;
}

let activeWordAudio: HTMLAudioElement | null = null;

export function playWordAudio(
  text: string,
  options: SpeakOptions & { audioUrl?: string } = {}
): void {
  if (activeWordAudio) {
    activeWordAudio.pause();
    activeWordAudio = null;
  }
  if (options.audioUrl) {
    try {
      stopSpeaking();
      const audio = new Audio(options.audioUrl);
      audio.playbackRate = options.rate ?? 1.0;
      activeWordAudio = audio;
      audio.onerror = () => speakText(text, options);
      audio.play().catch(() => speakText(text, options));
      return;
    } catch {
      // Fallback below
    }
  }
  speakText(text, options);
}

export class SpeechSequenceController {
  private lines: SequenceLine[] = [];
  private currentIndex = 0;
  private rate = 1.0;
  private playing = false;
  private loopLineIndex: number | null = null;
  private runToken = 0;

  private onIndexChange?: (index: number, lineId: string | null) => void;
  private onStateChange?: (isPlaying: boolean) => void;
  private onComplete?: () => void;

  constructor(callbacks: {
    onIndexChange?: (index: number, lineId: string | null) => void;
    onStateChange?: (isPlaying: boolean) => void;
    onComplete?: () => void;
  }) {
    this.onIndexChange = callbacks.onIndexChange;
    this.onStateChange = callbacks.onStateChange;
    this.onComplete = callbacks.onComplete;
  }

  setLines(lines: SequenceLine[]) {
    this.stop();
    this.lines = lines;
    this.currentIndex = 0;
  }

  setRate(rate: number) {
    this.rate = rate;
    if (this.playing) {
      this.playFrom(this.currentIndex);
    }
  }

  setLoopLine(index: number | null) {
    this.loopLineIndex = index;
  }

  playFrom(index: number) {
    if (!this.lines.length) return;
    const safeIdx = Math.max(0, Math.min(index, this.lines.length - 1));
    this.currentIndex = safeIdx;
    this.playing = true;
    this.runToken += 1;
    const token = this.runToken;
    this.onStateChange?.(true);
    this.speakCurrent(token);
  }

  togglePlay() {
    if (this.playing) {
      this.pause();
    } else {
      if (this.currentIndex >= this.lines.length) {
        this.currentIndex = 0;
      }
      this.playFrom(this.currentIndex);
    }
  }

  pause() {
    this.runToken += 1;
    this.playing = false;
    stopSpeaking();
    this.onStateChange?.(false);
  }

  stop() {
    this.runToken += 1;
    this.playing = false;
    this.currentIndex = 0;
    stopSpeaking();
    this.onStateChange?.(false);
    this.onIndexChange?.(0, null);
  }

  step(delta: number) {
    if (!this.lines.length) return;
    const nextIdx = Math.max(0, Math.min(this.lines.length - 1, this.currentIndex + delta));
    if (this.playing) {
      this.playFrom(nextIdx);
    } else {
      this.currentIndex = nextIdx;
      this.onIndexChange?.(nextIdx, this.lines[nextIdx]?.id ?? null);
    }
  }

  private speakCurrent(token: number) {
    if (token !== this.runToken || !this.playing) return;
    const line = this.lines[this.currentIndex];
    if (!line) {
      this.playing = false;
      this.onStateChange?.(false);
      this.onComplete?.();
      return;
    }

    this.onIndexChange?.(this.currentIndex, line.id);

    speakText(line.text, {
      accent: line.accent || 'en-US',
      gender: line.gender,
      rate: this.rate,
      onEnd: () => {
        if (token !== this.runToken || !this.playing) return;
        if (this.loopLineIndex !== null) {
          this.currentIndex = this.loopLineIndex;
          window.setTimeout(() => this.speakCurrent(token), 350);
          return;
        }
        if (this.currentIndex + 1 < this.lines.length) {
          this.currentIndex += 1;
          window.setTimeout(() => this.speakCurrent(token), 280);
        } else {
          this.playing = false;
          this.currentIndex = 0;
          this.onStateChange?.(false);
          this.onIndexChange?.(0, null);
          this.onComplete?.();
        }
      },
      onError: () => {
        if (token !== this.runToken) return;
        this.playing = false;
        this.onStateChange?.(false);
      },
    });
  }
}
