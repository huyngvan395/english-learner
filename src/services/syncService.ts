import { supabase } from '../lib/supabase';
import {
  AttemptRecord,
  ReadingQuestionProgress,
  ToeicExamHistoryItem,
  UserNote,
  UserProfileStats,
  VocabWord,
  WordProgress,
  WritingSubmissionRecord,
  WrongQuestionRecord,
} from '../types';

/**
 * Storage keys belonging strictly to learning progress (safe to sync & clear on sign-out).
 * PRIVACY GUARANTEE:
 * - 'tmh_gemini_api_key_v1' and 'tmh_gemini_model_v1' are NEVER listed or touched here.
 * - Gemini API keys remain 100% local to the user's browser.
 */
export const PROGRESS_STORAGE_KEYS = {
  VOCAB_PROGRESS: 'tmh_vocab_progress_v1',
  CUSTOM_WORDS: 'tmh_custom_words_v1',
  NOTES: 'tmh_user_notes_v1',
  ATTEMPTS: 'tmh_attempt_history_v1',
  PROFILE: 'tmh_user_profile_v1',
  HIGHLIGHTS: 'tmh_reading_highlights_v1',
  READING_PROGRESS: 'tmh_reading_progress_v1',
  WRONG_QUESTIONS: 'tmh_wrong_questions_v1',
  EXAM_HISTORY: 'tmh_toeic_exam_history_v1',
  WRITING_HISTORY: 'tmh_writing_history_v1',
  WRITING_DRAFTS: 'tmh_writing_drafts_v1',
  UPDATED_AT: 'tmh_progress_updated_at_v1',
} as const;

export interface CloudUserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  target_score: number;
  daily_goal: number;
  updated_at?: string;
}

export interface LearningProgressSnapshot {
  vocabProgress: Record<string, WordProgress>;
  customWords: VocabWord[];
  notes: UserNote[];
  attempts: AttemptRecord[];
  profile: UserProfileStats;
  readingHighlights: Record<string, string[]>;
  readingProgress: Record<string, ReadingQuestionProgress>;
  wrongQuestions: WrongQuestionRecord[];
  examHistory: ToeicExamHistoryItem[];
  writingHistory: WritingSubmissionRecord[];
  writingDrafts: Record<string, string>;
  updatedAt: number;
}

interface UserProgressRow {
  user_id: string;
  vocab_srs: Record<string, WordProgress> | null;
  saved_words: VocabWord[] | null;
  user_notes: UserNote[] | null;
  toeic_history: {
    examHistory?: ToeicExamHistoryItem[];
    wrongQuestions?: WrongQuestionRecord[];
    attempts?: AttemptRecord[];
  } | null;
  reading_progress: {
    progress?: Record<string, ReadingQuestionProgress>;
    highlights?: Record<string, string[]>;
  } | null;
  listening_progress: {
    attempts?: AttemptRecord[];
  } | null;
  writing_history: {
    submissions?: WritingSubmissionRecord[];
    drafts?: Record<string, string>;
  } | null;
  stats: Partial<UserProfileStats> | null;
  updated_at: string | null;
}

export function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export function createEmptySnapshot(): LearningProgressSnapshot {
  return {
    vocabProgress: {},
    customWords: [],
    notes: [],
    attempts: [],
    profile: {
      streak: 1,
      xp: 0,
      dailyGoal: 20,
      todayWordsStudied: 0,
      lastActiveDate: getTodayDateStr(),
    },
    readingHighlights: {},
    readingProgress: {},
    wrongQuestions: [],
    examHistory: [],
    writingHistory: [],
    writingDrafts: {},
    updatedAt: 0,
  };
}

export function hasMeaningfulProgress(snap: LearningProgressSnapshot): boolean {
  return (
    Object.keys(snap.vocabProgress).length > 0 ||
    snap.customWords.length > 0 ||
    snap.notes.length > 0 ||
    snap.attempts.length > 0 ||
    Object.keys(snap.readingHighlights).length > 0 ||
    Object.keys(snap.readingProgress).length > 0 ||
    snap.wrongQuestions.length > 0 ||
    snap.examHistory.length > 0 ||
    snap.writingHistory.length > 0 ||
    Object.keys(snap.writingDrafts).some((k) => Boolean(snap.writingDrafts[k]?.trim())) ||
    snap.profile.xp > 0 ||
    snap.profile.todayWordsStudied > 0
  );
}

export function readLocalWritingDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEYS.WRITING_DRAFTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function writeLocalWritingDrafts(drafts: Record<string, string>): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEYS.WRITING_DRAFTS, JSON.stringify(drafts));
  } catch {
    // Ignore storage quota errors
  }
}

export function readLocalUpdatedAt(): number {
  try {
    const val = Number(localStorage.getItem(PROGRESS_STORAGE_KEYS.UPDATED_AT) || 0);
    return Number.isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

export function writeLocalUpdatedAt(ts: number): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEYS.UPDATED_AT, String(ts));
  } catch {
    // Ignore
  }
}

/**
 * Clears ONLY learning progress keys on sign-out to prevent cross-account leakage
 * on shared browsers. Deliberately preserves Gemini API Key & model settings.
 */
export function clearLocalLearningProgress(): void {
  try {
    for (const key of Object.values(PROGRESS_STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

function rowToSnapshot(row: UserProgressRow): LearningProgressSnapshot {
  const base = createEmptySnapshot();
  const toeicAttempts = Array.isArray(row.toeic_history?.attempts) ? row.toeic_history!.attempts! : [];
  const listeningAttempts = Array.isArray(row.listening_progress?.attempts)
    ? row.listening_progress!.attempts!
    : [];

  // Deduplicate combined attempts by id
  const attemptMap = new Map<string, AttemptRecord>();
  for (const a of [...toeicAttempts, ...listeningAttempts]) {
    if (a?.id) attemptMap.set(a.id, a);
  }
  const combinedAttempts = Array.from(attemptMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 150);

  const cloudTs = row.updated_at ? Date.parse(row.updated_at) : 0;

  return {
    vocabProgress:
      row.vocab_srs && typeof row.vocab_srs === 'object'
        ? (row.vocab_srs as Record<string, WordProgress>)
        : {},
    customWords: Array.isArray(row.saved_words) ? row.saved_words : [],
    notes: Array.isArray(row.user_notes) ? row.user_notes : [],
    attempts: combinedAttempts,
    profile: {
      ...base.profile,
      ...(row.stats && typeof row.stats === 'object' ? row.stats : {}),
    },
    readingHighlights:
      row.reading_progress?.highlights && typeof row.reading_progress.highlights === 'object'
        ? row.reading_progress.highlights
        : {},
    readingProgress:
      row.reading_progress?.progress && typeof row.reading_progress.progress === 'object'
        ? row.reading_progress.progress
        : {},
    wrongQuestions: Array.isArray(row.toeic_history?.wrongQuestions)
      ? row.toeic_history!.wrongQuestions!
      : [],
    examHistory: Array.isArray(row.toeic_history?.examHistory)
      ? row.toeic_history!.examHistory!
      : [],
    writingHistory: Array.isArray(row.writing_history?.submissions)
      ? row.writing_history!.submissions!
      : [],
    writingDrafts:
      row.writing_history?.drafts && typeof row.writing_history.drafts === 'object'
        ? row.writing_history.drafts
        : {},
    updatedAt: Number.isFinite(cloudTs) ? cloudTs : 0,
  };
}

function snapshotToRow(userId: string, snap: LearningProgressSnapshot): UserProgressRow {
  const listeningAttempts = snap.attempts.filter((a) => a.module === 'listening');
  return {
    user_id: userId,
    vocab_srs: snap.vocabProgress,
    saved_words: snap.customWords,
    user_notes: snap.notes,
    toeic_history: {
      examHistory: snap.examHistory.slice(0, 60),
      wrongQuestions: snap.wrongQuestions.slice(0, 200),
      attempts: snap.attempts.slice(0, 150),
    },
    reading_progress: {
      progress: snap.readingProgress,
      highlights: snap.readingHighlights,
    },
    listening_progress: {
      attempts: listeningAttempts.slice(0, 80),
    },
    writing_history: {
      submissions: snap.writingHistory.slice(0, 100),
      drafts: snap.writingDrafts,
    },
    stats: snap.profile,
    updated_at: new Date(snap.updatedAt || Date.now()).toISOString(),
  };
}

/**
 * Smart union merge between Local and Cloud snapshots:
 * - Never loses mastered/saved words, notes, exam history, or writing submissions.
 * - Resolves per-item conflicts by newest timestamp.
 */
export function mergeProgressSnapshots(
  local: LearningProgressSnapshot,
  cloud: LearningProgressSnapshot
): LearningProgressSnapshot {
  const localIsNewer = local.updatedAt >= cloud.updatedAt;

  // 1. Vocab SRS progress (union, newest review wins, keep saved/permanentlyMastered OR)
  const vocabProgress: Record<string, WordProgress> = { ...cloud.vocabProgress };
  for (const [wid, lp] of Object.entries(local.vocabProgress)) {
    const cp = vocabProgress[wid];
    if (!cp) {
      vocabProgress[wid] = lp;
    } else {
      const winner =
        (lp.lastReviewedAt || 0) >= (cp.lastReviewedAt || 0)
          ? lp
          : cp;
      vocabProgress[wid] = {
        ...winner,
        saved: Boolean(lp.saved || cp.saved),
        permanentlyMastered: Boolean(lp.permanentlyMastered || cp.permanentlyMastered),
        reviewCount: Math.max(lp.reviewCount || 0, cp.reviewCount || 0),
      };
    }
  }

  // 2. Custom words (saved from Listening / Writing) — deduplicated by id
  const customMap = new Map<string, VocabWord>();
  for (const w of [...cloud.customWords, ...local.customWords]) {
    if (w?.id) customMap.set(w.id, w);
  }
  const customWords = Array.from(customMap.values());

  // 3. Notes — deduplicated by id, newest updatedAt wins
  const notesMap = new Map<string, UserNote>();
  for (const n of cloud.notes) {
    if (n?.id) notesMap.set(n.id, n);
  }
  for (const n of local.notes) {
    if (!n?.id) continue;
    const prev = notesMap.get(n.id);
    if (!prev || (n.updatedAt || 0) >= (prev.updatedAt || 0)) {
      notesMap.set(n.id, n);
    }
  }
  const notes = Array.from(notesMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);

  // 4. Attempts — deduplicated by id
  const attemptsMap = new Map<string, AttemptRecord>();
  for (const a of [...cloud.attempts, ...local.attempts]) {
    if (a?.id) attemptsMap.set(a.id, a);
  }
  const attempts = Array.from(attemptsMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 150);

  // 5. Reading highlights — union per passage
  const readingHighlights: Record<string, string[]> = { ...cloud.readingHighlights };
  for (const [pid, sids] of Object.entries(local.readingHighlights)) {
    readingHighlights[pid] = Array.from(new Set([...(readingHighlights[pid] || []), ...sids]));
  }

  // 6. Reading progress — newest updatedAt per question
  const readingProgress: Record<string, ReadingQuestionProgress> = { ...cloud.readingProgress };
  for (const [qid, rp] of Object.entries(local.readingProgress)) {
    const prev = readingProgress[qid];
    if (!prev || (rp.updatedAt || 0) >= (prev.updatedAt || 0)) {
      readingProgress[qid] = rp;
    }
  }

  // 7. Wrong questions — deduplicated by id, keep newest & max wrongCount
  const wrongMap = new Map<string, WrongQuestionRecord>();
  for (const w of cloud.wrongQuestions) {
    if (w?.id) wrongMap.set(w.id, w);
  }
  for (const w of local.wrongQuestions) {
    if (!w?.id) continue;
    const prev = wrongMap.get(w.id);
    if (!prev) {
      wrongMap.set(w.id, w);
    } else {
      const winner = (w.lastWrongAt || 0) >= (prev.lastWrongAt || 0) ? w : prev;
      wrongMap.set(w.id, {
        ...winner,
        wrongCount: Math.max(w.wrongCount || 1, prev.wrongCount || 1),
      });
    }
  }
  const wrongQuestions = Array.from(wrongMap.values())
    .sort((a, b) => b.lastWrongAt - a.lastWrongAt)
    .slice(0, 200);

  // 8. Exam history — deduplicated by id
  const examMap = new Map<string, ToeicExamHistoryItem>();
  for (const e of [...cloud.examHistory, ...local.examHistory]) {
    if (e?.id) examMap.set(e.id, e);
  }
  const examHistory = Array.from(examMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 60);

  // 9. Writing history — deduplicated by id
  const writingMap = new Map<string, WritingSubmissionRecord>();
  for (const w of [...cloud.writingHistory, ...local.writingHistory]) {
    if (w?.id) writingMap.set(w.id, w);
  }
  const writingHistory = Array.from(writingMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);

  // 10. Writing drafts — union, newer snapshot wins on conflicting non-empty draft
  const writingDrafts: Record<string, string> = { ...cloud.writingDrafts };
  for (const [key, text] of Object.entries(local.writingDrafts)) {
    const cloudVal = writingDrafts[key];
    if (!cloudVal || (text.trim() && localIsNewer)) {
      writingDrafts[key] = text;
    }
  }

  // 11. Stats — preserve highest XP/streak & latest active date
  const latestDate =
    (local.profile.lastActiveDate || '') >= (cloud.profile.lastActiveDate || '')
      ? local.profile.lastActiveDate
      : cloud.profile.lastActiveDate;

  const sameDate = local.profile.lastActiveDate === cloud.profile.lastActiveDate;
  const todayWordsStudied = sameDate
    ? Math.max(local.profile.todayWordsStudied || 0, cloud.profile.todayWordsStudied || 0)
    : local.profile.lastActiveDate === latestDate
    ? local.profile.todayWordsStudied
    : cloud.profile.todayWordsStudied;

  const profile: UserProfileStats = {
    streak: Math.max(local.profile.streak || 1, cloud.profile.streak || 1),
    xp: Math.max(local.profile.xp || 0, cloud.profile.xp || 0),
    dailyGoal: localIsNewer
      ? local.profile.dailyGoal || cloud.profile.dailyGoal || 20
      : cloud.profile.dailyGoal || local.profile.dailyGoal || 20,
    todayWordsStudied,
    lastActiveDate: latestDate || getTodayDateStr(),
  };

  return {
    vocabProgress,
    customWords,
    notes,
    attempts,
    profile,
    readingHighlights,
    readingProgress,
    wrongQuestions,
    examHistory,
    writingHistory,
    writingDrafts,
    updatedAt: Math.max(local.updatedAt, cloud.updatedAt, Date.now()),
  };
}

export async function fetchCloudProfile(userId: string): Promise<CloudUserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, target_score, daily_goal, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[SyncService] Không thể tải profiles:', error.message);
    return null;
  }
  return (data as CloudUserProfile | null) ?? null;
}

export async function updateCloudProfileGoal(userId: string, dailyGoal: number): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('profiles')
    .update({ daily_goal: dailyGoal })
    .eq('id', userId);
}

export async function fetchCloudProgress(userId: string): Promise<LearningProgressSnapshot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_progress')
    .select(
      'user_id, vocab_srs, saved_words, user_notes, toeic_history, reading_progress, listening_progress, writing_history, stats, updated_at'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Lỗi tải tiến độ từ Supabase: ${error.message}`);
  }
  if (!data) return null;
  return rowToSnapshot(data as UserProgressRow);
}

export async function pushCloudProgress(
  userId: string,
  snapshot: LearningProgressSnapshot
): Promise<void> {
  if (!supabase) return;
  const row = snapshotToRow(userId, snapshot);
  const { error } = await supabase
    .from('user_progress')
    .upsert(row, { onConflict: 'user_id' });

  if (error) {
    throw new Error(`Lỗi lưu tiến độ lên Supabase: ${error.message}`);
  }
}

/**
 * Orchestrates smart initial sync upon login / session restore:
 * 1. Cloud empty & Local has data -> uploads Local to Cloud (zero data loss).
 * 2. Local empty & Cloud has data -> hydrates Local from Cloud.
 * 3. Both have data -> smart union merge & pushes merged snapshot back to Cloud.
 */
export async function syncProgressOnLogin(
  userId: string,
  localSnapshot: LearningProgressSnapshot
): Promise<{
  finalSnapshot: LearningProgressSnapshot;
  action: 'uploaded-local' | 'loaded-cloud' | 'merged' | 'empty';
}> {
  const cloudSnapshot = await fetchCloudProgress(userId);
  const localHasData = hasMeaningfulProgress(localSnapshot);
  const cloudHasData = cloudSnapshot ? hasMeaningfulProgress(cloudSnapshot) : false;

  if (!cloudHasData && localHasData) {
    const stamped = { ...localSnapshot, updatedAt: Date.now() };
    await pushCloudProgress(userId, stamped);
    return { finalSnapshot: stamped, action: 'uploaded-local' };
  }

  if (cloudHasData && !localHasData && cloudSnapshot) {
    return { finalSnapshot: cloudSnapshot, action: 'loaded-cloud' };
  }

  if (cloudHasData && localHasData && cloudSnapshot) {
    const merged = mergeProgressSnapshots(localSnapshot, cloudSnapshot);
    await pushCloudProgress(userId, merged);
    return { finalSnapshot: merged, action: 'merged' };
  }

  return { finalSnapshot: localSnapshot, action: 'empty' };
}
