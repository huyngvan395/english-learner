import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AttemptRecord,
  ListeningQuestionProgress,
  ListeningVocabItem,
  MasteryStatus,
  NoteTargetType,
  OptionKey,
  ReadingQuestionProgress,
  SearchIndexEntry,
  SrsRating,
  ToeicExamHistoryItem,
  UserNote,
  UserProfileStats,
  VideoDetailItem,
  VideoPracticeMode,
  VideoProgressRecord,
  VocabExample,
  VocabWord,
  WordPOS,
  WordProgress,
  WritingSubmissionRecord,
  WritingVocabTakeaway,
  WrongQuestionRecord,
} from '../types';
import { loadVocabSearchIndex } from '../utils/vocabLoader';
import { playSave, playSuccess } from '../lib/soundEffects';
import { useAuth } from './AuthContext';
import {
  clearLocalLearningProgress,
  createEmptySnapshot,
  LearningProgressSnapshot,
  pushCloudProgress,
  readLocalUpdatedAt,
  readLocalWritingDrafts,
  syncProgressOnLogin,
  updateCloudProfileGoal,
  writeLocalUpdatedAt,
  writeLocalWritingDrafts,
} from '../services/syncService';

const STORAGE_KEYS = {
  PROGRESS: 'tmh_vocab_progress_v1',
  CUSTOM_WORDS: 'tmh_custom_words_v1',
  NOTES: 'tmh_user_notes_v1',
  ATTEMPTS: 'tmh_attempt_history_v1',
  PROFILE: 'tmh_user_profile_v1',
  HIGHLIGHTS: 'tmh_reading_highlights_v1',
  READING_PROGRESS: 'tmh_reading_progress_v1',
  LISTENING_PROGRESS: 'tmh_listening_progress_v1',
  VIDEO_PROGRESS: 'tmh_video_progress_v1',
  CUSTOM_VIDEOS: 'tmh_custom_videos_v1',
  WRONG_QUESTIONS: 'tmh_wrong_questions_v1',
  EXAM_HISTORY: 'tmh_toeic_exam_history_v1',
  WRITING_HISTORY: 'tmh_writing_history_v1',
};

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_PROFILE: UserProfileStats = {
  streak: 1,
  xp: 0,
  dailyGoal: 20,
  todayWordsStudied: 0,
  lastActiveDate: getTodayStr(),
};

const SRS_INTERVALS: Record<MasteryStatus, number> = {
  new: 0,
  forgotten: 1000 * 60 * 10, // 10 minutes
  vague: 1000 * 60 * 60 * 12, // 12 hours
  mastered: 1000 * 60 * 60 * 24 * 4, // 4 days
};

interface AppContextValue {
  vocabProgress: Record<string, WordProgress>;
  customWords: VocabWord[];
  searchIndex: SearchIndexEntry[];
  searchIndexLoading: boolean;
  notes: UserNote[];
  attempts: AttemptRecord[];
  profile: UserProfileStats;
  readingHighlights: Record<string, string[]>;
  readingProgress: Record<string, ReadingQuestionProgress>;
  listeningProgress: Record<string, ListeningQuestionProgress>;
  videoProgress: Record<string, VideoProgressRecord>;
  customVideos: VideoDetailItem[];
  wrongQuestions: WrongQuestionRecord[];
  examHistory: ToeicExamHistoryItem[];
  writingHistory: WritingSubmissionRecord[];

  markWordStatus: (wordId: string, status: MasteryStatus, deckId?: string) => void;
  rateWordSrs: (wordId: string, rating: SrsRating, deckId?: string) => void;
  toggleSaveWord: (wordId: string, deckId?: string) => void;
  saveListeningVocab: (item: ListeningVocabItem) => void;
  saveWritingVocab: (item: WritingVocabTakeaway) => void;
  saveRelatedVocab: (item: {
    id?: string;
    deckId?: string;
    word: string;
    pos?: WordPOS;
    ipaUS?: string;
    ipaUK?: string;
    meaning: string;
    definitionEn?: string;
    definitionVi?: string;
    examples?: VocabExample[];
  }) => void;
  isVocabTextSaved: (wordText: string) => boolean;
  isWritingVocabSaved: (wordText: string) => boolean;
  isWordSaved: (wordId: string) => boolean;
  getDeckStats: (deckId: string) => { studiedCount: number; masteredCount: number };

  upsertNote: (params: {
    targetType: NoteTargetType;
    targetId: string;
    title: string;
    subtitle: string;
    content: string;
  }) => void;
  deleteNote: (noteId: string) => void;
  getNoteByTarget: (targetType: NoteTargetType, targetId: string) => UserNote | undefined;

  recordAttempt: (attempt: Omit<AttemptRecord, 'id' | 'timestamp'>) => void;
  recordWrongQuestion: (entry: Omit<WrongQuestionRecord, 'wrongCount' | 'lastWrongAt'>) => void;
  resolveWrongQuestion: (questionId: string) => void;
  clearAllWrongQuestions: () => void;
  recordExamHistory: (item: Omit<ToeicExamHistoryItem, 'id' | 'timestamp'>) => void;
  saveWritingSubmission: (
    item: Omit<WritingSubmissionRecord, 'id' | 'timestamp' | 'attemptNumber'>
  ) => WritingSubmissionRecord;
  clearWritingHistory: () => void;
  addXp: (amount: number) => void;
  setDailyGoal: (goal: number) => void;

  toggleReadingHighlight: (passageId: string, sentenceId: string) => void;
  clearReadingHighlights: (passageId: string) => void;
  recordReadingResult: (questionId: string, selectedAnswer: OptionKey, isCorrect: boolean) => void;
  recordListeningResult: (questionId: string, selectedAnswer: string, isCorrect: boolean) => void;

  markVideoSentenceCompleted: (
    videoId: string,
    sentenceIndex: number,
    totalSentences: number,
    mode: VideoPracticeMode
  ) => void;
  setVideoLastSentence: (videoId: string, sentenceIndex: number, mode: VideoPracticeMode) => void;
  recordVideoQuizScore: (videoId: string, score: number, total: number) => void;
  toggleFavoriteVideo: (videoId: string) => void;
  addCustomVideo: (video: VideoDetailItem) => void;
  deleteCustomVideo: (videoId: string) => void;

  syncNow: () => Promise<void>;
  signOutAndClear: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setSyncState, markSyncedNow, signOut } = useAuth();

  const [vocabProgress, setVocabProgress] = useState<Record<string, WordProgress>>(() =>
    safeLoad(STORAGE_KEYS.PROGRESS, {})
  );
  const [customWords, setCustomWords] = useState<VocabWord[]>(() =>
    safeLoad(STORAGE_KEYS.CUSTOM_WORDS, [])
  );
  const [rawSearchIndex, setRawSearchIndex] = useState<SearchIndexEntry[]>([]);
  const [searchIndexLoading, setSearchIndexLoading] = useState(true);

  const [notes, setNotes] = useState<UserNote[]>(() =>
    safeLoad(STORAGE_KEYS.NOTES, [])
  );
  const [attempts, setAttempts] = useState<AttemptRecord[]>(() =>
    safeLoad(STORAGE_KEYS.ATTEMPTS, [])
  );
  const [readingHighlights, setReadingHighlights] = useState<Record<string, string[]>>(() =>
    safeLoad(STORAGE_KEYS.HIGHLIGHTS, {})
  );
  const [readingProgress, setReadingProgress] = useState<Record<string, ReadingQuestionProgress>>(() =>
    safeLoad(STORAGE_KEYS.READING_PROGRESS, {})
  );
  const [listeningProgress, setListeningProgress] = useState<Record<string, ListeningQuestionProgress>>(() =>
    safeLoad(STORAGE_KEYS.LISTENING_PROGRESS, {})
  );
  const [videoProgress, setVideoProgress] = useState<Record<string, VideoProgressRecord>>(() =>
    safeLoad(STORAGE_KEYS.VIDEO_PROGRESS, {})
  );
  const [customVideos, setCustomVideos] = useState<VideoDetailItem[]>(() =>
    safeLoad(STORAGE_KEYS.CUSTOM_VIDEOS, [])
  );
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestionRecord[]>(() =>
    safeLoad(STORAGE_KEYS.WRONG_QUESTIONS, [])
  );
  const [examHistory, setExamHistory] = useState<ToeicExamHistoryItem[]>(() =>
    safeLoad(STORAGE_KEYS.EXAM_HISTORY, [])
  );
  const [writingHistory, setWritingHistory] = useState<WritingSubmissionRecord[]>(() =>
    safeLoad(STORAGE_KEYS.WRITING_HISTORY, [])
  );
  const [profile, setProfile] = useState<UserProfileStats>(() => {
    const saved = safeLoad<UserProfileStats>(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
    const today = getTodayStr();
    if (saved.lastActiveDate !== today) {
      const yesterday = getYesterdayStr();
      return {
        ...saved,
        streak: saved.lastActiveDate === yesterday ? saved.streak + 1 : 1,
        todayWordsStudied: 0,
        lastActiveDate: today,
      };
    }
    return saved;
  });

  // Load lightweight search-index.json once asynchronously
  useEffect(() => {
    let mounted = true;
    loadVocabSearchIndex()
      .then((rows) => {
        if (mounted) setRawSearchIndex(rows);
      })
      .catch(() => {
        // Silent fallback if index temporarily unavailable
      })
      .finally(() => {
        if (mounted) setSearchIndexLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(vocabProgress));
  }, [vocabProgress]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_WORDS, JSON.stringify(customWords));
  }, [customWords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
  }, [attempts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(readingHighlights));
  }, [readingHighlights]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.READING_PROGRESS, JSON.stringify(readingProgress));
  }, [readingProgress]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LISTENING_PROGRESS, JSON.stringify(listeningProgress));
  }, [listeningProgress]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VIDEO_PROGRESS, JSON.stringify(videoProgress));
    } catch {
      // Ignore storage quota overflow
    }
  }, [videoProgress]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_VIDEOS, JSON.stringify(customVideos));
    } catch {
      // Ignore storage quota overflow
    }
  }, [customVideos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WRONG_QUESTIONS, JSON.stringify(wrongQuestions));
    } catch {
      // Ignore quota overflow
    }
  }, [wrongQuestions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXAM_HISTORY, JSON.stringify(examHistory));
  }, [examHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WRITING_HISTORY, JSON.stringify(writingHistory));
    } catch {
      // Ignore quota overflow
    }
  }, [writingHistory]);

  // ================= SMART CLOUD SYNC (localStorage <-> Supabase) =================
  const hydratingRef = useRef<boolean>(false);
  const prevTodayWordsRef = useRef<number>(profile.todayWordsStudied);
  const hasMountedRef = useRef<boolean>(false);
  const syncedUserIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const [draftSyncNonce, setDraftSyncNonce] = useState(0);

  // Celebrate gently once when user crosses their daily word goal
  useEffect(() => {
    const prevCount = prevTodayWordsRef.current;
    prevTodayWordsRef.current = profile.todayWordsStudied;
    if (hydratingRef.current) return;
    if (prevCount < profile.dailyGoal && profile.todayWordsStudied >= profile.dailyGoal) {
      const t = window.setTimeout(() => playSuccess(), 280);
      return () => window.clearTimeout(t);
    }
  }, [profile.todayWordsStudied, profile.dailyGoal]);

  const buildCurrentSnapshot = useCallback((): LearningProgressSnapshot => {
    return {
      vocabProgress,
      customWords,
      notes,
      attempts,
      profile,
      readingHighlights,
      readingProgress,
      listeningProgress,
      videoProgress,
      customVideos,
      wrongQuestions,
      examHistory,
      writingHistory,
      writingDrafts: readLocalWritingDrafts(),
      updatedAt: readLocalUpdatedAt() || Date.now(),
    };
  }, [
    vocabProgress,
    customWords,
    notes,
    attempts,
    profile,
    readingHighlights,
    readingProgress,
    listeningProgress,
    videoProgress,
    customVideos,
    wrongQuestions,
    examHistory,
    writingHistory,
  ]);

  const latestSnapshotRef = useRef<LearningProgressSnapshot>(buildCurrentSnapshot());
  latestSnapshotRef.current = buildCurrentSnapshot();

  const applySnapshotToState = useCallback((snap: LearningProgressSnapshot) => {
    hydratingRef.current = true;
    setVocabProgress(snap.vocabProgress);
    setCustomWords(snap.customWords);
    setNotes(snap.notes);
    setAttempts(snap.attempts);
    setProfile(snap.profile);
    setReadingHighlights(snap.readingHighlights);
    setReadingProgress(snap.readingProgress);
    setListeningProgress(snap.listeningProgress || {});
    setVideoProgress(snap.videoProgress || {});
    setCustomVideos(snap.customVideos || []);
    setWrongQuestions(snap.wrongQuestions);
    setExamHistory(snap.examHistory);
    setWritingHistory(snap.writingHistory);
    writeLocalWritingDrafts(snap.writingDrafts);
    writeLocalUpdatedAt(snap.updatedAt || Date.now());
    window.dispatchEvent(new Event('tmh:progress-hydrated'));
    window.setTimeout(() => {
      hydratingRef.current = false;
    }, 150);
  }, []);

  // Listen for draft edits from WritingHub so drafts sync cleanly with 2s debounce
  useEffect(() => {
    const onDraftUpdated = () => {
      writeLocalUpdatedAt(Date.now());
      setDraftSyncNonce((n) => n + 1);
    };
    window.addEventListener('tmh:draft-updated', onDraftUpdated);
    return () => window.removeEventListener('tmh:draft-updated', onDraftUpdated);
  }, []);

  // Initial smart merge & sync whenever a user logs in (or restores session)
  useEffect(() => {
    const uid = user?.id || null;
    if (!uid) {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      syncedUserIdRef.current = null;
      return;
    }

    if (syncedUserIdRef.current === uid) return;

    let cancelled = false;
    setSyncState('syncing');

    syncProgressOnLogin(uid, latestSnapshotRef.current)
      .then(({ finalSnapshot }) => {
        if (cancelled) return;
        syncedUserIdRef.current = uid;
        applySnapshotToState(finalSnapshot);
        markSyncedNow();
      })
      .catch((err) => {
        if (cancelled) return;
        syncedUserIdRef.current = uid;
        setSyncState('error', err instanceof Error ? err.message : 'Lỗi đồng bộ Cloud');
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, applySnapshotToState, setSyncState, markSyncedNow]);

  // Debounced auto-push (2 seconds after last change) while logged in
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (hydratingRef.current) return;

    writeLocalUpdatedAt(Date.now());

    const uid = user?.id;
    if (!uid || syncedUserIdRef.current !== uid) return;

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    setSyncState('syncing');
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      const snap = { ...latestSnapshotRef.current, updatedAt: Date.now() };
      pushCloudProgress(uid, snap)
        .then(() => {
          writeLocalUpdatedAt(snap.updatedAt);
          markSyncedNow();
        })
        .catch((err) => {
          setSyncState('error', err instanceof Error ? err.message : 'Lỗi mạng khi lưu lên Cloud');
        });
    }, 2000);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    vocabProgress,
    customWords,
    notes,
    attempts,
    profile,
    readingHighlights,
    readingProgress,
    listeningProgress,
    videoProgress,
    customVideos,
    wrongQuestions,
    examHistory,
    writingHistory,
    draftSyncNonce,
    user?.id,
    setSyncState,
    markSyncedNow,
  ]);

  const syncNow = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSyncState('syncing');
    try {
      const { finalSnapshot } = await syncProgressOnLogin(uid, {
        ...latestSnapshotRef.current,
        updatedAt: Date.now(),
      });
      syncedUserIdRef.current = uid;
      applySnapshotToState(finalSnapshot);
      markSyncedNow();
    } catch (err) {
      setSyncState('error', err instanceof Error ? err.message : 'Lỗi mạng khi đồng bộ');
    }
  }, [user?.id, applySnapshotToState, setSyncState, markSyncedNow]);

  const signOutAndClear = useCallback(async () => {
    const uid = user?.id;
    // Best-effort flush any pending local changes before signing out
    if (uid && debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      try {
        await pushCloudProgress(uid, { ...latestSnapshotRef.current, updatedAt: Date.now() });
      } catch {
        // Proceed with sign-out even if offline
      }
    }

    await signOut();
    syncedUserIdRef.current = null;
    clearLocalLearningProgress();
    applySnapshotToState(createEmptySnapshot());
  }, [user?.id, signOut, applySnapshotToState]);

  // Combined search index (public search-index.json + saved listening customWords)
  const searchIndex = useMemo(() => {
    const map = new Map<string, SearchIndexEntry>();
    for (const row of rawSearchIndex) map.set(row.id, row);
    for (const cw of customWords) {
      if (!map.has(cw.id)) {
        map.set(cw.id, {
          id: cw.id,
          word: cw.word,
          meaningVi: cw.meaning,
          ipaUS: cw.ipaUS,
          partOfSpeech: cw.pos,
          deckId: cw.deckId,
        });
      }
    }
    return Array.from(map.values());
  }, [rawSearchIndex, customWords]);

  const wordIdToDeckId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of searchIndex) {
      map.set(row.id, row.deckId);
    }
    return map;
  }, [searchIndex]);

  const touchActivity = (xpGain: number, wordsIncrement = 0) => {
    const today = getTodayStr();
    setProfile((prev) => {
      const sameDay = prev.lastActiveDate === today;
      return {
        ...prev,
        xp: prev.xp + xpGain,
        todayWordsStudied: sameDay
          ? prev.todayWordsStudied + wordsIncrement
          : wordsIncrement,
        streak: sameDay ? prev.streak : prev.streak + 1,
        lastActiveDate: today,
      };
    });
  };

  const markWordStatus = (wordId: string, status: MasteryStatus, deckId?: string) => {
    const now = Date.now();
    const resolvedDeckId = deckId || wordIdToDeckId.get(wordId);
    setVocabProgress((prev) => {
      const existing = prev[wordId];
      const next: WordProgress = {
        wordId,
        deckId: resolvedDeckId || existing?.deckId,
        status,
        saved: existing?.saved ?? false,
        reviewCount: (existing?.reviewCount ?? 0) + 1,
        lastReviewedAt: now,
        nextReviewAt: now + SRS_INTERVALS[status],
        permanentlyMastered: status === 'mastered' ? existing?.permanentlyMastered : false,
      };
      return { ...prev, [wordId]: next };
    });

    const xpGain = status === 'mastered' ? 10 : status === 'vague' ? 5 : 3;
    touchActivity(xpGain, 1);
  };

  const rateWordSrs = (wordId: string, rating: SrsRating, deckId?: string) => {
    const now = Date.now();
    const DAY_MS = 1000 * 60 * 60 * 24;
    const resolvedDeckId = deckId || wordIdToDeckId.get(wordId);

    setVocabProgress((prev) => {
      const existing = prev[wordId];
      const prevReviews = existing?.reviewCount ?? 0;

      let status: MasteryStatus = 'mastered';
      let nextReviewAt = now;
      let intervalDays = 0;
      let permanentlyMastered = false;

      if (rating === 'again') {
        status = 'forgotten';
        nextReviewAt = now + 1000 * 60 * 10; // 10 minutes
        intervalDays = 0;
      } else if (rating === 'hard') {
        status = 'vague';
        intervalDays = prevReviews >= 2 ? 3 : prevReviews === 1 ? 2 : 1; // 1-3 days
        nextReviewAt = now + intervalDays * DAY_MS;
      } else if (rating === 'good') {
        status = 'mastered';
        intervalDays = prevReviews >= 2 ? 4 : prevReviews === 1 ? 2 : 1; // 1-4 days
        nextReviewAt = now + intervalDays * DAY_MS;
      } else if (rating === 'easy') {
        status = 'mastered';
        intervalDays = prevReviews >= 2 ? 7 : prevReviews === 1 ? 5 : 3; // 1-7 days
        nextReviewAt = now + intervalDays * DAY_MS;
      } else {
        // permanent mastery — no future reminders needed
        status = 'mastered';
        intervalDays = 3650;
        nextReviewAt = 0;
        permanentlyMastered = true;
      }

      const next: WordProgress = {
        wordId,
        deckId: resolvedDeckId || existing?.deckId,
        status,
        saved: existing?.saved ?? false,
        reviewCount: prevReviews + 1,
        lastReviewedAt: now,
        nextReviewAt,
        srsLevel: rating,
        intervalDays,
        permanentlyMastered,
      };
      return { ...prev, [wordId]: next };
    });

    const xpMap: Record<SrsRating, number> = {
      again: 3,
      hard: 5,
      good: 10,
      easy: 12,
      permanent: 15,
    };
    touchActivity(xpMap[rating], 1);
  };

  const toggleSaveWord = (wordId: string, deckId?: string) => {
    const now = Date.now();
    const resolvedDeckId = deckId || wordIdToDeckId.get(wordId);
    const willSave = !(vocabProgress[wordId]?.saved ?? false);
    if (willSave) playSave();
    setVocabProgress((prev) => {
      const existing = prev[wordId];
      return {
        ...prev,
        [wordId]: {
          wordId,
          deckId: resolvedDeckId || existing?.deckId,
          status: existing?.status ?? 'new',
          saved: !(existing?.saved ?? false),
          reviewCount: existing?.reviewCount ?? 0,
          lastReviewedAt: existing?.lastReviewedAt ?? now,
          nextReviewAt: existing?.nextReviewAt ?? now,
        },
      };
    });
  };

  const saveListeningVocab = (item: ListeningVocabItem) => {
    const existingMain = searchIndex.find(
      (w) => w.id === item.id || w.word.toLowerCase() === item.word.toLowerCase()
    );
    const targetId = existingMain ? existingMain.id : item.id;
    const targetDeckId = existingMain ? existingMain.deckId : 'listening-saved';

    if (!existingMain) {
      setCustomWords((prev) => {
        if (prev.some((w) => w.id === item.id)) return prev;
        const newWord: VocabWord = {
          id: item.id,
          deckId: 'listening-saved',
          word: item.word,
          pos: item.pos,
          ipaUK: item.ipaUK,
          ipaUS: item.ipaUS,
          meaning: item.meaning,
          definitionEn: `A high-frequency TOEIC listening expression meaning "${item.meaning}".`,
          definitionVi: `Từ/cụm từ nghe trọng tâm TOEIC mang nghĩa "${item.meaning}".`,
          examples: [{ en: item.exampleEn, vi: item.exampleVi }],
          wordFamily: [],
          synonyms: [],
          antonyms: [],
          collocations: [],
        };
        return [...prev, newWord];
      });
    }

    const now = Date.now();
    setVocabProgress((prev) => {
      const existing = prev[targetId];
      return {
        ...prev,
        [targetId]: {
          wordId: targetId,
          deckId: targetDeckId,
          status: existing?.status ?? 'vague',
          saved: true,
          reviewCount: existing?.reviewCount ?? 0,
          lastReviewedAt: existing?.lastReviewedAt ?? now,
          nextReviewAt: existing?.nextReviewAt ?? now,
        },
      };
    });
    touchActivity(5, 0);
    playSave();
  };

  const saveWritingVocab = (item: WritingVocabTakeaway) => {
    const normalized = item.word.trim().toLowerCase();
    const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const customId = `wr-${slug || Date.now()}`;
    const existingMain = searchIndex.find(
      (w) => w.id === customId || w.word.toLowerCase() === normalized
    );
    const targetId = existingMain ? existingMain.id : customId;
    const targetDeckId = existingMain ? existingMain.deckId : 'writing-saved';

    if (!existingMain) {
      setCustomWords((prev) => {
        if (prev.some((w) => w.id === customId || w.word.toLowerCase() === normalized)) return prev;
        const newWord: VocabWord = {
          id: customId,
          deckId: 'writing-saved',
          word: item.word.trim(),
          pos: item.pos,
          ipaUK: item.ipa || '/.../',
          ipaUS: item.ipa || '/.../',
          meaning: item.meaningVi,
          definitionEn: `High-value expression extracted from AI Writing Studio meaning "${item.meaningVi}".`,
          definitionVi: `Từ/cụm từ ăn điểm trích từ bài chấm Writing AI mang nghĩa "${item.meaningVi}".`,
          examples: item.exampleEn
            ? [{ en: item.exampleEn, vi: item.exampleVi || item.meaningVi }]
            : [],
          wordFamily: [],
          synonyms: [],
          antonyms: [],
          collocations: [],
        };
        return [...prev, newWord];
      });
    }

    const now = Date.now();
    setVocabProgress((prev) => {
      const existing = prev[targetId];
      return {
        ...prev,
        [targetId]: {
          wordId: targetId,
          deckId: targetDeckId,
          status: existing?.status ?? 'vague',
          saved: true,
          reviewCount: existing?.reviewCount ?? 0,
          lastReviewedAt: existing?.lastReviewedAt ?? now,
          nextReviewAt: existing?.nextReviewAt ?? now,
        },
      };
    });
    touchActivity(5, 0);
    playSave();
  };

  const isWritingVocabSaved = (wordText: string): boolean => {
    const normalized = wordText.trim().toLowerCase();
    if (!normalized) return false;
    const matched = searchIndex.find((w) => w.word.toLowerCase() === normalized);
    if (matched && vocabProgress[matched.id]?.saved) return true;
    const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return Boolean(vocabProgress[`wr-${slug}`]?.saved || vocabProgress[`rel-${slug}`]?.saved);
  };

  const isVocabTextSaved = (wordText: string): boolean => {
    const normalized = wordText.trim().toLowerCase();
    if (!normalized) return false;
    for (const w of searchIndex) {
      if (w.word.toLowerCase() === normalized && vocabProgress[w.id]?.saved) {
        return true;
      }
    }
    const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return Boolean(vocabProgress[`rel-${slug}`]?.saved || vocabProgress[`wr-${slug}`]?.saved);
  };

  const saveRelatedVocab = (item: {
    id?: string;
    deckId?: string;
    word: string;
    pos?: WordPOS;
    ipaUS?: string;
    ipaUK?: string;
    meaning: string;
    definitionEn?: string;
    definitionVi?: string;
    examples?: VocabExample[];
  }) => {
    const cleanWord = item.word.trim();
    if (!cleanWord) return;
    const normalized = cleanWord.toLowerCase();
    const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const CUSTOM_DECKS = new Set(['listening-saved', 'writing-saved', 'reading-saved', 'vocab-saved']);
    const existingMain =
      (item.id ? searchIndex.find((w) => w.id === item.id && !CUSTOM_DECKS.has(w.deckId)) : undefined) ||
      searchIndex.find((w) => w.word.toLowerCase() === normalized && !CUSTOM_DECKS.has(w.deckId));

    const targetId = existingMain ? existingMain.id : `rel-${slug || Date.now()}`;
    const targetDeckId = existingMain ? existingMain.deckId : 'vocab-saved';

    if (!existingMain) {
      setCustomWords((prev) => {
        const existingIdx = prev.findIndex(
          (w) => w.id === targetId || w.word.toLowerCase() === normalized
        );
        if (existingIdx >= 0) {
          // Enrich an existing sparse customWord if richer hydrated IPA/definition/examples arrived
          const cur = prev[existingIdx];
          const enriched: VocabWord = {
            ...cur,
            ipaUS: cur.ipaUS && cur.ipaUS !== '/.../' ? cur.ipaUS : item.ipaUS || cur.ipaUS,
            ipaUK: cur.ipaUK && cur.ipaUK !== '/.../' ? cur.ipaUK : item.ipaUK || item.ipaUS || cur.ipaUK,
            meaning: cur.meaning && cur.meaning !== cur.word ? cur.meaning : item.meaning.trim() || cur.meaning,
            definitionEn: cur.definitionEn || item.definitionEn || '',
            definitionVi: cur.definitionVi || item.definitionVi || '',
            examples:
              cur.examples && cur.examples.length > 0 && cur.examples[0]?.en
                ? cur.examples
                : item.examples && item.examples.length > 0
                ? item.examples
                : [],
          };
          const next = [...prev];
          next[existingIdx] = enriched;
          return next;
        }
        const newWord: VocabWord = {
          id: targetId,
          deckId: 'vocab-saved',
          word: cleanWord,
          pos: item.pos || 'n',
          ipaUK: item.ipaUK || item.ipaUS || '',
          ipaUS: item.ipaUS || '',
          meaning: item.meaning.trim() || cleanWord,
          definitionEn: item.definitionEn || '',
          definitionVi: item.definitionVi || '',
          examples: item.examples && item.examples.length > 0 ? item.examples : [],
          wordFamily: [],
          synonyms: [],
          antonyms: [],
          collocations: [],
        };
        return [...prev, newWord];
      });
    }

    const now = Date.now();
    setVocabProgress((prev) => {
      const existing = prev[targetId];
      return {
        ...prev,
        [targetId]: {
          wordId: targetId,
          deckId: targetDeckId,
          status: existing?.status ?? 'vague',
          saved: true,
          reviewCount: existing?.reviewCount ?? 0,
          lastReviewedAt: existing?.lastReviewedAt ?? now,
          nextReviewAt: existing?.nextReviewAt ?? now,
        },
      };
    });
    touchActivity(5, 0);
    playSave();
  };

  const isWordSaved = (wordId: string): boolean => {
    return Boolean(vocabProgress[wordId]?.saved);
  };

  const getDeckStats = (deckId: string) => {
    let studiedCount = 0;
    let masteredCount = 0;
    for (const p of Object.values(vocabProgress)) {
      const belongs = (p.deckId || wordIdToDeckId.get(p.wordId)) === deckId;
      if (!belongs) continue;
      if (p.status !== 'new') {
        studiedCount += 1;
        if (p.status === 'mastered') masteredCount += 1;
      }
    }
    return { studiedCount, masteredCount };
  };

  const upsertNote = (params: {
    targetType: NoteTargetType;
    targetId: string;
    title: string;
    subtitle: string;
    content: string;
  }) => {
    const trimmed = params.content.trim();
    const id = `${params.targetType}:${params.targetId}`;
    setNotes((prev) => {
      if (!trimmed) {
        return prev.filter((n) => n.id !== id);
      }
      const exists = prev.some((n) => n.id === id);
      const updated: UserNote = {
        id,
        targetType: params.targetType,
        targetId: params.targetId,
        title: params.title,
        subtitle: params.subtitle,
        content: trimmed,
        updatedAt: Date.now(),
      };
      if (exists) {
        return prev.map((n) => (n.id === id ? updated : n));
      }
      return [updated, ...prev];
    });
  };

  const deleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const getNoteByTarget = (targetType: NoteTargetType, targetId: string) => {
    return notes.find((n) => n.id === `${targetType}:${targetId}`);
  };

  const recordAttempt = (attempt: Omit<AttemptRecord, 'id' | 'timestamp'>) => {
    const rec: AttemptRecord = {
      ...attempt,
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    setAttempts((prev) => [rec, ...prev].slice(0, 150));
    const xpGain = attempt.correctCount * 15 + 10;
    touchActivity(xpGain, 0);
  };

  const recordWrongQuestion = (entry: Omit<WrongQuestionRecord, 'wrongCount' | 'lastWrongAt'>) => {
    const now = Date.now();
    setWrongQuestions((prev) => {
      const existing = prev.find((w) => w.id === entry.id);
      if (existing) {
        return [
          {
            ...entry,
            wrongCount: existing.wrongCount + 1,
            lastWrongAt: now,
          },
          ...prev.filter((w) => w.id !== entry.id),
        ].slice(0, 200);
      }
      return [{ ...entry, wrongCount: 1, lastWrongAt: now }, ...prev].slice(0, 200);
    });
  };

  const resolveWrongQuestion = (questionId: string) => {
    setWrongQuestions((prev) => prev.filter((w) => w.id !== questionId));
  };

  const clearAllWrongQuestions = () => {
    setWrongQuestions([]);
  };

  const recordExamHistory = (item: Omit<ToeicExamHistoryItem, 'id' | 'timestamp'>) => {
    const rec: ToeicExamHistoryItem = {
      ...item,
      id: `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    setExamHistory((prev) => [rec, ...prev].slice(0, 60));
  };

  const saveWritingSubmission = (
    item: Omit<WritingSubmissionRecord, 'id' | 'timestamp' | 'attemptNumber'>
  ): WritingSubmissionRecord => {
    const prevSamePrompt = writingHistory.filter((w) => w.promptId === item.promptId);
    const rec: WritingSubmissionRecord = {
      ...item,
      id: `wr_sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      attemptNumber: prevSamePrompt.length + 1,
      timestamp: Date.now(),
    };
    setWritingHistory((prev) => [rec, ...prev].slice(0, 100));
    touchActivity(25, 0);
    return rec;
  };

  const clearWritingHistory = () => {
    setWritingHistory([]);
  };

  const addXp = (amount: number) => {
    touchActivity(amount, 0);
  };

  const setDailyGoal = (goal: number) => {
    const clamped = Math.max(5, Math.min(100, goal));
    setProfile((prev) => ({ ...prev, dailyGoal: clamped }));
    if (user?.id) {
      updateCloudProfileGoal(user.id, clamped).catch(() => {
        // Silent background goal sync
      });
    }
  };

  const toggleReadingHighlight = (passageId: string, sentenceId: string) => {
    setReadingHighlights((prev) => {
      const curr = prev[passageId] || [];
      const exists = curr.includes(sentenceId);
      return {
        ...prev,
        [passageId]: exists ? curr.filter((s) => s !== sentenceId) : [...curr, sentenceId],
      };
    });
  };

  const clearReadingHighlights = (passageId: string) => {
    setReadingHighlights((prev) => {
      const next = { ...prev };
      delete next[passageId];
      return next;
    });
  };

  const recordReadingResult = (questionId: string, selectedAnswer: OptionKey, isCorrect: boolean) => {
    setReadingProgress((prev) => ({
      ...prev,
      [questionId]: {
        status: isCorrect ? 'correct' : 'wrong',
        selectedAnswer,
        updatedAt: Date.now(),
      },
    }));
  };

  const recordListeningResult = (questionId: string, selectedAnswer: string, isCorrect: boolean) => {
    setListeningProgress((prev) => ({
      ...prev,
      [questionId]: {
        status: isCorrect ? 'correct' : 'wrong',
        selectedAnswer,
        updatedAt: Date.now(),
      },
    }));
  };

  const markVideoSentenceCompleted = useCallback(
    (videoId: string, sentenceIndex: number, totalSentences: number, mode: VideoPracticeMode) => {
      let newlyCompleted = false;
      let justFinishedVideo = false;

      setVideoProgress((prev) => {
        const curr: VideoProgressRecord = prev[videoId] || {
          videoId,
          completedSentences: [],
          shadowedSentences: [],
          lastSentenceIndex: sentenceIndex,
          lastMode: mode,
          lastStudiedAt: Date.now(),
        };

        const nextCompleted = new Set(curr.completedSentences || []);
        const nextShadowed = new Set(curr.shadowedSentences || []);

        if (mode === 'shadowing') {
          if (!nextShadowed.has(sentenceIndex)) {
            newlyCompleted = true;
            nextShadowed.add(sentenceIndex);
          }
          if (!nextCompleted.has(sentenceIndex)) {
            nextCompleted.add(sentenceIndex);
          }
        } else {
          if (!nextCompleted.has(sentenceIndex)) {
            newlyCompleted = true;
            nextCompleted.add(sentenceIndex);
          }
        }

        if (
          newlyCompleted &&
          totalSentences > 0 &&
          curr.completedSentences.length < totalSentences &&
          nextCompleted.size >= totalSentences
        ) {
          justFinishedVideo = true;
        }

        return {
          ...prev,
          [videoId]: {
            ...curr,
            completedSentences: Array.from(nextCompleted).sort((a, b) => a - b),
            shadowedSentences: Array.from(nextShadowed).sort((a, b) => a - b),
            lastSentenceIndex: sentenceIndex,
            lastMode: mode,
            lastStudiedAt: Date.now(),
          },
        };
      });

      if (newlyCompleted) {
        touchActivity(justFinishedVideo ? 30 : 5, 1);
        if (justFinishedVideo) {
          playSuccess();
        }
      }
    },
    []
  );

  const setVideoLastSentence = useCallback(
    (videoId: string, sentenceIndex: number, mode: VideoPracticeMode) => {
      setVideoProgress((prev) => {
        const curr: VideoProgressRecord = prev[videoId] || {
          videoId,
          completedSentences: [],
          shadowedSentences: [],
          lastSentenceIndex: sentenceIndex,
          lastMode: mode,
          lastStudiedAt: Date.now(),
        };
        return {
          ...prev,
          [videoId]: {
            ...curr,
            lastSentenceIndex: sentenceIndex,
            lastMode: mode,
            lastStudiedAt: Date.now(),
          },
        };
      });
    },
    []
  );

  const recordVideoQuizScore = useCallback((videoId: string, score: number, total: number) => {
    setVideoProgress((prev) => {
      const curr: VideoProgressRecord = prev[videoId] || {
        videoId,
        completedSentences: [],
        shadowedSentences: [],
        lastSentenceIndex: 0,
        lastMode: 'quiz',
        lastStudiedAt: Date.now(),
      };
      return {
        ...prev,
        [videoId]: {
          ...curr,
          lastMode: 'quiz',
          quizBestScore: Math.max(curr.quizBestScore ?? 0, score),
          quizTotal: total,
          lastStudiedAt: Date.now(),
        },
      };
    });
    if (score > 0) {
      touchActivity(score * 4, Math.min(3, score));
    }
  }, []);

  const toggleFavoriteVideo = useCallback((videoId: string) => {
    setVideoProgress((prev) => {
      const curr: VideoProgressRecord = prev[videoId] || {
        videoId,
        completedSentences: [],
        shadowedSentences: [],
        lastSentenceIndex: 0,
        lastMode: 'dictation',
        lastStudiedAt: Date.now(),
      };
      const nextFav = !curr.favorite;
      if (nextFav) playSave();
      return {
        ...prev,
        [videoId]: {
          ...curr,
          favorite: nextFav,
          lastStudiedAt: curr.lastStudiedAt || Date.now(),
        },
      };
    });
  }, []);

  const addCustomVideo = useCallback((video: VideoDetailItem) => {
    setCustomVideos((prev) => [video, ...prev.filter((v) => v.id !== video.id)].slice(0, 20));
    playSave();
  }, []);

  const deleteCustomVideo = useCallback((videoId: string) => {
    setCustomVideos((prev) => prev.filter((v) => v.id !== videoId));
  }, []);

  return (
    <AppContext.Provider
      value={{
        vocabProgress,
        customWords,
        searchIndex,
        searchIndexLoading,
        notes,
        attempts,
        profile,
        readingHighlights,
        readingProgress,
        listeningProgress,
        videoProgress,
        customVideos,
        wrongQuestions,
        examHistory,
        writingHistory,
        markWordStatus,
        rateWordSrs,
        toggleSaveWord,
        saveListeningVocab,
        saveWritingVocab,
        saveRelatedVocab,
        isVocabTextSaved,
        isWritingVocabSaved,
        isWordSaved,
        getDeckStats,
        upsertNote,
        deleteNote,
        getNoteByTarget,
        recordAttempt,
        recordWrongQuestion,
        resolveWrongQuestion,
        clearAllWrongQuestions,
        recordExamHistory,
        saveWritingSubmission,
        clearWritingHistory,
        addXp,
        setDailyGoal,
        toggleReadingHighlight,
        clearReadingHighlights,
        recordReadingResult,
        recordListeningResult,
        markVideoSentenceCompleted,
        setVideoLastSentence,
        recordVideoQuizScore,
        toggleFavoriteVideo,
        addCustomVideo,
        deleteCustomVideo,
        syncNow,
        signOutAndClear,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
