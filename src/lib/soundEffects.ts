/**
 * Parroto / Duolingo-inspired, zero-latency audio effects engine for TOEIC Mastery Hub.
 *
 * Strict Playback Priority for `/audio/sfx/*.mp3`:
 * 1. Eagerly preloads raw MP3 bytes on app boot (`?v=2` cache-buster, `cache: 'no-cache'`)
 *    and decodes into Web Audio `AudioBuffer` (0ms latency, polyphonic overlap).
 * 2. If `AudioBuffer` is still decoding or `decodeAudioData` fails for an existing MP3,
 *    immediately falls back to `new Audio('/audio/sfx/....mp3?v=2')` (HTMLAudioElement)
 *    with matching `volume` & `playbackRate` so real MP3 files ALWAYS play.
 * 3. Only uses the Parroto-style layered Web Audio synthesizer when the `.mp3` file is
 *    confirmed missing (404 / non-audio response) or HTMLAudio playback itself fails.
 */

export type SfxKey = 'correct' | 'wrong' | 'complete' | 'save' | 'flip';

export interface PlayCorrectResult {
  combo: number;
  isMilestone: boolean;
  playbackRate: number;
}

export interface XpPulseEvent {
  combo: number;
  milestone: boolean;
  timestamp: number;
}

const SOUND_ENABLED_KEY = 'tmh_sound_effects_enabled_v1';
const SOUND_VOLUME_KEY = 'tmh_sound_effects_volume_v1';
const KEY_TICK_ENABLED_KEY = 'tmh_sound_key_tick_enabled_v1';
const DEFAULT_VOLUME_PCT = 65;
const SFX_VERSION = 'v=2';

const SFX_FILES: Record<SfxKey, string> = {
  correct: `/audio/sfx/correct.mp3?${SFX_VERSION}`,
  wrong: `/audio/sfx/wrong.mp3?${SFX_VERSION}`,
  complete: `/audio/sfx/complete.mp3?${SFX_VERSION}`,
  save: `/audio/sfx/save.mp3?${SFX_VERSION}`,
  flip: `/audio/sfx/flip.mp3?${SFX_VERSION}`,
};

// Keys known to ship as real MP3s in public/audio/sfx/ (warn loudly if they fail to load/decode)
const EXPECTED_REAL_SFX = new Set<SfxKey>(['correct', 'wrong']);
const SFX_KEYS: SfxKey[] = ['correct', 'wrong', 'complete', 'save', 'flip'];

let audioCtx: AudioContext | null = null;
let unlockListenersAttached = false;
let eagerPreloadStarted = false;

const rawFileBytes = new Map<SfxKey, ArrayBuffer>();
const decodedBuffers = new Map<SfxKey, AudioBuffer>();
const availableRealFiles = new Set<SfxKey>();
const missingFiles = new Set<SfxKey>();
const fetchingFiles = new Set<SfxKey>();
const decodingFiles = new Set<SfxKey>();

const enabledSubscribers = new Set<(enabled: boolean) => void>();
const volumeSubscribers = new Set<(volumePct: number) => void>();
const keyTickSubscribers = new Set<(enabled: boolean) => void>();
const comboSubscribers = new Set<(combo: number) => void>();
const xpPulseSubscribers = new Set<(event: XpPulseEvent) => void>();
const customSfxSubscribers = new Set<(count: number) => void>();

function readInitialBool(key: string, defaultVal: boolean): boolean {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultVal;
    return raw !== 'false' && raw !== '0';
  } catch {
    return defaultVal;
  }
}

function readInitialVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOLUME_PCT;
  try {
    const raw = window.localStorage.getItem(SOUND_VOLUME_KEY);
    if (raw === null) return DEFAULT_VOLUME_PCT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_VOLUME_PCT;
    return Math.max(0, Math.min(100, Math.round(parsed)));
  } catch {
    return DEFAULT_VOLUME_PCT;
  }
}

let soundEnabled: boolean = readInitialBool(SOUND_ENABLED_KEY, true);
let soundVolumePct: number = readInitialVolume();
let keyTickEnabled: boolean = readInitialBool(KEY_TICK_ENABLED_KEY, true);
let currentCombo = 0;

// ================= STATE & SUBSCRIPTION API =================

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(next: boolean): void {
  soundEnabled = Boolean(next);
  try {
    window.localStorage.setItem(SOUND_ENABLED_KEY, soundEnabled ? 'true' : 'false');
  } catch {
    // Ignore storage restriction
  }
  enabledSubscribers.forEach((fn) => fn(soundEnabled));
}

export function toggleSoundEnabled(): boolean {
  if (soundEnabled && soundVolumePct === 0) {
    setSoundVolume(DEFAULT_VOLUME_PCT);
    playSave();
    return true;
  }
  const next = !soundEnabled;
  setSoundEnabled(next);
  if (next) {
    if (soundVolumePct === 0) {
      setSoundVolume(DEFAULT_VOLUME_PCT);
    }
    playSave();
  }
  return next;
}

export function subscribeSoundEnabled(listener: (enabled: boolean) => void): () => void {
  enabledSubscribers.add(listener);
  return () => {
    enabledSubscribers.delete(listener);
  };
}

export function getSoundVolume(): number {
  return soundVolumePct;
}

export function setSoundVolume(nextPct: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(nextPct)));
  soundVolumePct = clamped;
  try {
    window.localStorage.setItem(SOUND_VOLUME_KEY, String(clamped));
  } catch {
    // Ignore storage restriction
  }
  volumeSubscribers.forEach((fn) => fn(clamped));
  if (clamped > 0 && !soundEnabled) {
    setSoundEnabled(true);
  }
}

export function subscribeSoundVolume(listener: (volumePct: number) => void): () => void {
  volumeSubscribers.add(listener);
  return () => {
    volumeSubscribers.delete(listener);
  };
}

export function isKeyTickEnabled(): boolean {
  return keyTickEnabled;
}

export function setKeyTickEnabled(next: boolean): void {
  keyTickEnabled = Boolean(next);
  try {
    window.localStorage.setItem(KEY_TICK_ENABLED_KEY, keyTickEnabled ? 'true' : 'false');
  } catch {
    // Ignore storage restriction
  }
  keyTickSubscribers.forEach((fn) => fn(keyTickEnabled));
}

export function toggleKeyTickEnabled(): boolean {
  const next = !keyTickEnabled;
  setKeyTickEnabled(next);
  if (next) {
    playKeyTick();
  }
  return next;
}

export function subscribeKeyTickEnabled(listener: (enabled: boolean) => void): () => void {
  keyTickSubscribers.add(listener);
  return () => {
    keyTickSubscribers.delete(listener);
  };
}

export function getCombo(): number {
  return currentCombo;
}

export function resetCombo(): void {
  if (currentCombo === 0) return;
  currentCombo = 0;
  comboSubscribers.forEach((fn) => fn(0));
}

export function subscribeCombo(listener: (combo: number) => void): () => void {
  comboSubscribers.add(listener);
  return () => {
    comboSubscribers.delete(listener);
  };
}

export function subscribeXpPulse(listener: (event: XpPulseEvent) => void): () => void {
  xpPulseSubscribers.add(listener);
  return () => {
    xpPulseSubscribers.delete(listener);
  };
}

function emitXpPulse(combo: number, milestone: boolean): void {
  const payload: XpPulseEvent = { combo, milestone, timestamp: Date.now() };
  xpPulseSubscribers.forEach((fn) => fn(payload));
}

export function getLoadedCustomSfxCount(): number {
  return availableRealFiles.size;
}

export function subscribeCustomSfxCount(listener: (count: number) => void): () => void {
  customSfxSubscribers.add(listener);
  return () => {
    customSfxSubscribers.delete(listener);
  };
}

function notifyCustomSfxCount(): void {
  const cnt = availableRealFiles.size;
  customSfxSubscribers.forEach((fn) => fn(cnt));
}

// ================= EAGER MP3 PRELOAD + AUDIOBUFFER DECODER =================

function getEffectiveScale(): number {
  if (!soundEnabled || soundVolumePct <= 0) return 0;
  const norm = soundVolumePct / 100;
  return Math.pow(norm, 1.05);
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
      // Browser waits for direct user gesture
    });
  }
  // Decode any raw MP3 bytes already fetched eagerly on page mount
  decodePendingRawBytes(audioCtx);
  return audioCtx;
}

function decodePendingRawBytes(ctx: AudioContext): void {
  for (const [key, bytes] of rawFileBytes.entries()) {
    if (decodedBuffers.has(key) || decodingFiles.has(key)) continue;
    decodingFiles.add(key);
    ctx
      .decodeAudioData(bytes.slice(0))
      .then((decoded) => {
        decodedBuffers.set(key, decoded);
      })
      .catch((err) => {
        console.warn(
          `[soundEffects] decodeAudioData failed for ${SFX_FILES[key]} — will play via HTMLAudioElement fallback:`,
          err
        );
      })
      .finally(() => {
        decodingFiles.delete(key);
      });
  }
}

function looksLikeAudioBytes(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 64) return false;
  const head = new Uint8Array(buf, 0, Math.min(16, buf.byteLength));
  // Reject HTML/JSON text responses (e.g. '<!DO', '<htm', '{"er')
  if (head[0] === 0x3c || head[0] === 0x7b) return false;
  // Valid MP3 (ID3 tag or 0xFF 0xE0+ frame sync), WAV (RIFF), OGG (OggS), M4A/MP4 (ftyp), FLAC (fLaC)
  const isId3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33;
  const isMp3Sync = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
  const isRiff = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
  const isOgg = head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53;
  const isFtyp = head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70;
  return isId3 || isMp3Sync || isRiff || isOgg || isFtyp;
}

async function prefetchSfxFile(key: SfxKey): Promise<void> {
  if (availableRealFiles.has(key) || missingFiles.has(key) || fetchingFiles.has(key)) return;
  fetchingFiles.add(key);

  const url = SFX_FILES[key];
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      missingFiles.add(key);
      if (EXPECTED_REAL_SFX.has(key)) {
        console.warn(`[soundEffects] Failed to fetch ${url} (HTTP ${res.status}).`);
      }
      return;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      missingFiles.add(key);
      if (EXPECTED_REAL_SFX.has(key)) {
        console.warn(`[soundEffects] ${url} returned non-audio content-type "${contentType}".`);
      }
      return;
    }

    const arrayBuf = await res.arrayBuffer();
    if (!looksLikeAudioBytes(arrayBuf)) {
      missingFiles.add(key);
      if (EXPECTED_REAL_SFX.has(key)) {
        console.warn(`[soundEffects] ${url} payload is not a valid audio file (${arrayBuf.byteLength} bytes).`);
      }
      return;
    }

    rawFileBytes.set(key, arrayBuf);
    availableRealFiles.add(key);
    notifyCustomSfxCount();

    if (audioCtx) {
      decodePendingRawBytes(audioCtx);
    }
  } catch (err) {
    if (EXPECTED_REAL_SFX.has(key)) {
      console.warn(`[soundEffects] Network error preloading ${url}:`, err);
    }
  } finally {
    fetchingFiles.delete(key);
  }
}

/**
 * Eagerly preload all `/audio/sfx/*.mp3` files as soon as the module loads
 * (no need to wait for the first click to fetch the bytes!).
 */
export function preloadAllSfx(): void {
  if (typeof window === 'undefined' || eagerPreloadStarted) return;
  eagerPreloadStarted = true;
  for (const key of SFX_KEYS) {
    void prefetchSfxFile(key);
  }
}

export function initSoundUnlock(): void {
  if (typeof window === 'undefined') return;
  preloadAllSfx();

  if (unlockListenersAttached) return;
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

/**
 * Tier 1: Play decoded Web Audio `AudioBuffer` (0ms latency, polyphonic).
 */
function playDecodedBuffer(
  ctx: AudioContext,
  key: SfxKey,
  opts: { playbackRate?: number; gainBoost?: number } = {}
): boolean {
  const buf = decodedBuffers.get(key);
  if (!buf) return false;

  try {
    const scale = getEffectiveScale();
    if (scale <= 0) return true;

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.playbackRate.setValueAtTime(opts.playbackRate ?? 1.0, ctx.currentTime);

    const gain = ctx.createGain();
    const targetGain = Math.min(1.0, scale * 0.88 * (opts.gainBoost ?? 1.0));
    gain.gain.setValueAtTime(targetGain, ctx.currentTime);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    return true;
  } catch (err) {
    console.warn(`[soundEffects] AudioBuffer playback error for ${key}:`, err);
    return false;
  }
}

/**
 * Tier 2: Immediate `HTMLAudioElement` playback for real MP3 files when
 * AudioBuffer isn't decoded yet or `decodeAudioData` failed.
 */
function playHtmlAudioFallback(
  key: SfxKey,
  opts: { playbackRate?: number; gainBoost?: number },
  onFallbackSynth: () => void
): boolean {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;
  if (missingFiles.has(key)) return false;

  // Use HTMLAudio if the file is confirmed available OR is one of our shipped real SFX files
  if (!availableRealFiles.has(key) && !EXPECTED_REAL_SFX.has(key)) {
    return false;
  }

  try {
    const scale = getEffectiveScale();
    if (scale <= 0) return true;

    const audio = new Audio(SFX_FILES[key]);
    audio.volume = Math.max(0, Math.min(1, scale * 0.88 * (opts.gainBoost ?? 1.0)));
    audio.playbackRate = opts.playbackRate ?? 1.0;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        console.warn(`[soundEffects] HTMLAudio playback failed for ${SFX_FILES[key]}:`, err);
        onFallbackSynth();
      });
    }
    return true;
  } catch (err) {
    console.warn(`[soundEffects] Failed to construct HTMLAudio for ${SFX_FILES[key]}:`, err);
    return false;
  }
}

/**
 * Master dispatcher enforcing strict priority:
 * 1) Real MP3 via Web Audio `AudioBuffer` (0ms latency)
 * 2) Real MP3 via `HTMLAudioElement` (if buffer still decoding / decode failed)
 * 3) Parroto Web Audio layered synth (only if file is 404 or playback fails)
 */
function playSfxWithPriority(
  key: SfxKey,
  opts: { playbackRate?: number; gainBoost?: number },
  synthFallback: (ctx: AudioContext) => void
): void {
  if (getEffectiveScale() <= 0) return;

  const ctx = getAudioContext();

  // Tier 1: Zero-latency Web Audio AudioBuffer
  if (ctx && playDecodedBuffer(ctx, key, opts)) {
    return;
  }

  // Kick off prefetch if somehow not started yet
  if (!availableRealFiles.has(key) && !missingFiles.has(key)) {
    void prefetchSfxFile(key);
  }

  // Tier 2: Real MP3 via HTMLAudioElement (guarantees real MP3 plays even on 1st click or decode error!)
  const playedHtml = playHtmlAudioFallback(key, opts, () => {
    const fallbackCtx = getAudioContext();
    if (fallbackCtx) synthFallback(fallbackCtx);
  });
  if (playedHtml) {
    return;
  }

  // Tier 3: Parroto layered Web Audio synth (only for missing/404 optional SFX files)
  if (ctx) {
    synthFallback(ctx);
  }
}

// ================= PARROTO-STYLE LAYERED SYNTHESIS FALLBACK =================

let sharedNoiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return sharedNoiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  sharedNoiseBuffer = buf;
  return buf;
}

function triggerSnapTransient(
  ctx: AudioContext,
  startOffset: number,
  centerHz: number,
  intensity: number
): void {
  const scale = getEffectiveScale();
  if (scale <= 0 || intensity <= 0) return;

  const now = ctx.currentTime + startOffset;
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(Math.min(6200, Math.max(900, centerHz)), now);
  bp.Q.setValueAtTime(2.4, now);

  const gain = ctx.createGain();
  const peak = Math.min(0.5, intensity * scale * 0.34);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

  noise.connect(bp);
  bp.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.02);
}

function playGlassyNote(
  ctx: AudioContext,
  opts: {
    freq: number;
    freqEnd?: number;
    startOffset: number;
    duration: number;
    volume: number;
    brightness?: number;
    snap?: number;
    shimmerEcho?: boolean;
  }
): void {
  const scale = getEffectiveScale();
  if (scale <= 0) return;

  const now = ctx.currentTime + opts.startOffset;
  const brightness = opts.brightness ?? 1.25;
  const peak = Math.min(0.68, opts.volume * scale * 0.6);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const startCutoff = Math.min(10500, Math.max(420, opts.freq * 5.2 * brightness));
  const endCutoff = Math.min(5400, Math.max(260, opts.freq * 2.1 * brightness));
  filter.frequency.setValueAtTime(startCutoff, now);
  filter.frequency.exponentialRampToValueAtTime(endCutoff, now + opts.duration);
  filter.Q.setValueAtTime(1.1, now);
  filter.connect(ctx.destination);

  const oscMain = ctx.createOscillator();
  const gainMain = ctx.createGain();
  oscMain.type = 'triangle';
  oscMain.frequency.setValueAtTime(opts.freq, now);
  if (typeof opts.freqEnd === 'number' && opts.freqEnd !== opts.freq) {
    oscMain.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), now + opts.duration);
  }
  gainMain.gain.setValueAtTime(0.0001, now);
  gainMain.gain.linearRampToValueAtTime(peak * 0.72, now + 0.004);
  gainMain.gain.exponentialRampToValueAtTime(peak * 0.34, now + opts.duration * 0.32);
  gainMain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
  oscMain.connect(gainMain);
  gainMain.connect(filter);
  oscMain.start(now);
  oscMain.stop(now + opts.duration + 0.02);

  const oscSub = ctx.createOscillator();
  const gainSub = ctx.createGain();
  oscSub.type = 'sine';
  oscSub.frequency.setValueAtTime(opts.freq, now);
  if (typeof opts.freqEnd === 'number' && opts.freqEnd !== opts.freq) {
    oscSub.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), now + opts.duration);
  }
  gainSub.gain.setValueAtTime(0.0001, now);
  gainSub.gain.linearRampToValueAtTime(peak * 0.56, now + 0.004);
  gainSub.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
  oscSub.connect(gainSub);
  gainSub.connect(filter);
  oscSub.start(now);
  oscSub.stop(now + opts.duration + 0.02);

  if (brightness >= 0.85) {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(opts.freq * 2, now);
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(peak * 0.28 * Math.min(1.4, brightness), now + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration * 0.62);
    osc2.connect(gain2);
    gain2.connect(filter);
    osc2.start(now);
    osc2.stop(now + opts.duration * 0.66 + 0.015);

    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(opts.freq * 3, now);
    const d3 = Math.min(0.11, opts.duration * 0.44);
    gain3.gain.setValueAtTime(0.0001, now);
    gain3.gain.linearRampToValueAtTime(peak * 0.14 * Math.min(1.4, brightness), now + 0.002);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + d3);
    osc3.connect(gain3);
    gain3.connect(filter);
    osc3.start(now);
    osc3.stop(now + d3 + 0.015);
  }

  if ((opts.snap ?? 0.45) > 0.01) {
    triggerSnapTransient(ctx, opts.startOffset, opts.freq * 3.1, opts.snap ?? 0.45);
  }

  if (opts.shimmerEcho) {
    const echoNow = now + 0.062;
    const echoDur = Math.max(0.14, opts.duration * 0.85);
    const echoOsc = ctx.createOscillator();
    const echoGain = ctx.createGain();
    echoOsc.type = 'sine';
    echoOsc.frequency.setValueAtTime(opts.freq * 2, echoNow);
    echoGain.gain.setValueAtTime(0.0001, echoNow);
    echoGain.gain.linearRampToValueAtTime(peak * 0.15, echoNow + 0.01);
    echoGain.gain.exponentialRampToValueAtTime(0.0001, echoNow + echoDur);
    echoOsc.connect(echoGain);
    echoGain.connect(ctx.destination);
    echoOsc.start(echoNow);
    echoOsc.stop(echoNow + echoDur + 0.02);
  }
}

function synthParrotoCorrect(ctx: AudioContext, playbackRate: number, highCombo = false): void {
  const n1 = 659.25 * playbackRate;
  const n2 = 987.77 * playbackRate;

  playGlassyNote(ctx, {
    freq: n1,
    startOffset: 0,
    duration: 0.15,
    volume: 0.9,
    brightness: 1.32,
    snap: 0.65,
    shimmerEcho: false,
  });
  playGlassyNote(ctx, {
    freq: n2,
    startOffset: 0.074,
    duration: highCombo ? 0.25 : 0.21,
    volume: 1.0,
    brightness: highCombo ? 1.55 : 1.42,
    snap: 0.55,
    shimmerEcho: true,
  });

  if (highCombo) {
    playGlassyNote(ctx, {
      freq: 1318.51 * playbackRate,
      startOffset: 0.135,
      duration: 0.2,
      volume: 0.52,
      brightness: 1.55,
      snap: 0.25,
      shimmerEcho: false,
    });
  }
}

function synthParrotoWrong(ctx: AudioContext): void {
  playGlassyNote(ctx, {
    freq: 164.81,
    freqEnd: 152,
    startOffset: 0,
    duration: 0.105,
    volume: 0.88,
    brightness: 0.5,
    snap: 0.55,
    shimmerEcho: false,
  });
  playGlassyNote(ctx, {
    freq: 130.81,
    freqEnd: 118,
    startOffset: 0.082,
    duration: 0.16,
    volume: 0.96,
    brightness: 0.45,
    snap: 0.5,
    shimmerEcho: false,
  });
}

function synthParrotoComplete(ctx: AudioContext, pitchScale = 1.0): void {
  const scale = getEffectiveScale();
  if (scale <= 0) return;

  const now = ctx.currentTime;
  const padPeak = Math.min(0.22, scale * 0.16);
  for (const padFreq of [261.63 * pitchScale, 392.0 * pitchScale]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(padFreq, now + 0.04);
    g.gain.setValueAtTime(0.0001, now + 0.04);
    g.gain.linearRampToValueAtTime(padPeak, now + 0.14);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + 0.04);
    osc.stop(now + 0.65);
  }

  const notes = [
    { freq: 523.25 * pitchScale, offset: 0.0, dur: 0.2, vol: 0.82, bright: 1.25, echo: false },
    { freq: 659.25 * pitchScale, offset: 0.075, dur: 0.22, vol: 0.88, bright: 1.35, echo: false },
    { freq: 783.99 * pitchScale, offset: 0.15, dur: 0.24, vol: 0.94, bright: 1.45, echo: false },
    { freq: 1046.5 * pitchScale, offset: 0.228, dur: 0.36, vol: 1.0, bright: 1.58, echo: true },
  ];

  for (const n of notes) {
    playGlassyNote(ctx, {
      freq: n.freq,
      startOffset: n.offset,
      duration: n.dur,
      volume: n.vol,
      brightness: n.bright,
      snap: 0.5,
      shimmerEcho: n.echo,
    });
  }
}

function synthParrotoSave(ctx: AudioContext): void {
  playGlassyNote(ctx, {
    freq: 783.99,
    freqEnd: 1174.66,
    startOffset: 0,
    duration: 0.14,
    volume: 0.82,
    brightness: 1.42,
    snap: 0.5,
    shimmerEcho: true,
  });
}

function synthParrotoFlip(ctx: AudioContext): void {
  const scale = getEffectiveScale();
  if (scale <= 0) return;

  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1650, now);
  bp.frequency.exponentialRampToValueAtTime(880, now + 0.055);
  bp.Q.setValueAtTime(1.15, now);

  const gain = ctx.createGain();
  const peak = scale * 0.24;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.058);

  noise.connect(bp);
  bp.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.065);

  playGlassyNote(ctx, {
    freq: 520,
    freqEnd: 360,
    startOffset: 0,
    duration: 0.055,
    volume: 0.36,
    brightness: 0.72,
    snap: 0.25,
    shimmerEcho: false,
  });
}

function synthKeyTick(ctx: AudioContext): void {
  const scale = getEffectiveScale();
  if (scale <= 0) return;

  const now = ctx.currentTime;
  const jitter = 0.96 + Math.random() * 0.08;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(920 * jitter, now);
  osc.frequency.exponentialRampToValueAtTime(340 * jitter, now + 0.018);

  const peak = Math.min(0.14, scale * 0.11);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.022);

  triggerSnapTransient(ctx, 0, 2900 * jitter, 0.22);
}

// ================= PUBLIC SOUND TRIGGERS =================

/**
 * Plays real `/audio/sfx/correct.mp3` with Combo Streak Pitch (1.00 -> 1.28).
 * Every 5 consecutive correct answers triggers celebratory `complete` + XP bounce.
 */
export function playCorrect(options: { isTest?: boolean } = {}): PlayCorrectResult {
  const isTest = Boolean(options.isTest);
  let comboForPlay = currentCombo;
  let playbackRate = 1.0;
  let isMilestone = false;

  if (!isTest) {
    currentCombo += 1;
    comboForPlay = currentCombo;
    playbackRate = Math.min(1.28, Number((1 + (currentCombo - 1) * 0.04).toFixed(2)));
    isMilestone = currentCombo > 0 && currentCombo % 5 === 0;
    comboSubscribers.forEach((fn) => fn(currentCombo));
    if (isMilestone) {
      emitXpPulse(currentCombo, true);
    } else if (currentCombo >= 2) {
      emitXpPulse(currentCombo, false);
    }
  }

  if (getEffectiveScale() <= 0) {
    return { combo: comboForPlay, isMilestone, playbackRate };
  }

  try {
    if (isMilestone) {
      const milestoneRate = comboForPlay >= 10 ? 1.06 : 1.0;
      playSfxWithPriority(
        'complete',
        { playbackRate: milestoneRate, gainBoost: 0.95 },
        (ctx) => synthParrotoComplete(ctx, milestoneRate)
      );
    } else {
      playSfxWithPriority(
        'correct',
        { playbackRate },
        (ctx) => synthParrotoCorrect(ctx, playbackRate, comboForPlay >= 4)
      );
    }
  } catch (err) {
    console.warn('[soundEffects] playCorrect error:', err);
  }

  return { combo: comboForPlay, isMilestone, playbackRate };
}

/**
 * Plays real `/audio/sfx/wrong.mp3` and resets Combo Streak to 0.
 */
export function playWrong(options: { isTest?: boolean } = {}): void {
  if (!options.isTest) {
    resetCombo();
  }
  if (getEffectiveScale() <= 0) return;

  try {
    playSfxWithPriority('wrong', {}, synthParrotoWrong);
  } catch (err) {
    console.warn('[soundEffects] playWrong error:', err);
  }
}

/**
 * Plays `/audio/sfx/flip.mp3` if present, otherwise silky card flip synth.
 */
export function playFlip(): void {
  if (getEffectiveScale() <= 0) return;
  try {
    playSfxWithPriority('flip', {}, synthParrotoFlip);
  } catch {
    // Graceful no-op
  }
}

/**
 * Plays `/audio/sfx/save.mp3` if present, otherwise crisp glassy pop synth.
 */
export function playSave(): void {
  if (getEffectiveScale() <= 0) return;
  try {
    playSfxWithPriority('save', {}, synthParrotoSave);
  } catch {
    // Graceful no-op
  }
}

/**
 * Plays `/audio/sfx/complete.mp3` if present, otherwise Parroto 4-note crystal arpeggio.
 */
export function playComplete(options: { isTest?: boolean } = {}): void {
  if (!options.isTest) {
    emitXpPulse(currentCombo, true);
  }
  if (getEffectiveScale() <= 0) return;

  try {
    playSfxWithPriority('complete', {}, (ctx) => synthParrotoComplete(ctx, 1.0));
  } catch {
    // Graceful no-op
  }
}

/** Backwards-compatible alias for `playComplete`. */
export const playSuccess = playComplete;

/**
 * Optional ultra-light tactile keystroke tick (~18ms) when typing answers.
 */
export function playKeyTick(): void {
  if (!keyTickEnabled || getEffectiveScale() <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    synthKeyTick(ctx);
  } catch {
    // Graceful no-op
  }
}
