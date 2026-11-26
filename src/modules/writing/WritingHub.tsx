import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileEdit,
  History,
  Languages,
  Lightbulb,
  Loader2,
  Mail,
  MessageSquareQuote,
  Pause,
  PenTool,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  GeminiModelId,
  WritingDifficulty,
  WritingMeta,
  WritingMode,
  WritingPromptItem,
  WritingSubmissionRecord,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { loadWritingMeta, loadWritingPromptsByMode } from '../../utils/writingLoader';
import {
  evaluateWritingWithGemini,
  getEffectiveGeminiKey,
  getSavedGeminiModel,
} from '../../utils/geminiWritingService';
import { GeminiSettingsModal } from './GeminiSettingsModal';
import { WritingEvaluationPanel } from './WritingEvaluationPanel';

const DRAFTS_STORAGE_KEY = 'tmh_writing_drafts_v1';
const CUSTOM_PROMPT_STORAGE_KEY = 'tmh_writing_custom_prompt_v1';

interface CustomPromptState {
  title: string;
  sourceLanguage: 'vi' | 'en';
  passage: string;
  instructions: string;
}

const DEFAULT_CUSTOM_PROMPT: CustomPromptState = {
  title: 'Đề tự tạo của tôi',
  sourceLanguage: 'vi',
  passage: '',
  instructions: 'Dịch/viết lại đoạn văn trên sang tiếng Anh thương mại tự nhiên, chính xác ngữ pháp và giữ đủ ý chính.',
};

function loadDraftsMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function loadCustomPrompt(): CustomPromptState {
  try {
    const raw = localStorage.getItem(CUSTOM_PROMPT_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_PROMPT;
    return { ...DEFAULT_CUSTOM_PROMPT, ...(JSON.parse(raw) as Partial<CustomPromptState>) };
  } catch {
    return DEFAULT_CUSTOM_PROMPT;
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const WritingHub: React.FC = () => {
  const { writingHistory, saveWritingSubmission } = useApp();

  const [mode, setMode] = useState<WritingMode>('translation');
  const [difficultyFilter, setDifficultyFilter] = useState<'Tất cả' | WritingDifficulty>('Tất cả');
  const [meta, setMeta] = useState<WritingMeta | null>(null);
  const [prompts, setPrompts] = useState<WritingPromptItem[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');

  // Custom prompt state
  const [customPrompt, setCustomPrompt] = useState<CustomPromptState>(() => loadCustomPrompt());

  // Drafts & editor state
  const [drafts, setDrafts] = useState<Record<string, string>>(() => loadDraftsMap());
  const [showHints, setShowHints] = useState(false);

  // Timer state
  const [timedMode, setTimedMode] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10 * 60);

  // Gemini config & grading state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [geminiModel, setGeminiModel] = useState<GeminiModelId>(() => getSavedGeminiModel());
  const [keyStatus, setKeyStatus] = useState(() => getEffectiveGeminiKey());
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<WritingSubmissionRecord | null>(null);
  const [showGlobalHistory, setShowGlobalHistory] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const evaluationRef = useRef<HTMLDivElement | null>(null);

  // Persist drafts & custom prompt
  useEffect(() => {
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // Ignore storage quota
    }
  }, [drafts]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PROMPT_STORAGE_KEY, JSON.stringify(customPrompt));
    } catch {
      // Ignore storage quota
    }
  }, [customPrompt]);

  // Load writing-meta.json once
  useEffect(() => {
    let mounted = true;
    loadWritingMeta()
      .then((m) => {
        if (mounted) setMeta(m);
      })
      .catch((err) => {
        if (mounted) setLoadError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu Writing');
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Lazy-load prompts for active mode (except custom)
  useEffect(() => {
    if (mode === 'custom') {
      setLoadingPrompts(false);
      setLoadError(null);
      return;
    }
    let mounted = true;
    setLoadingPrompts(true);
    setLoadError(null);
    loadWritingPromptsByMode(mode, meta || undefined)
      .then((list) => {
        if (mounted) {
          setPrompts(list);
          if (list.length > 0) {
            setSelectedPromptId((prev) => (list.some((p) => p.id === prev) ? prev : list[0].id));
          }
        }
      })
      .catch((err) => {
        if (mounted) setLoadError(err instanceof Error ? err.message : 'Lỗi tải danh sách bài viết');
      })
      .finally(() => {
        if (mounted) setLoadingPrompts(false);
      });
    return () => {
      mounted = false;
    };
  }, [mode, meta]);

  const filteredPrompts = useMemo(() => {
    if (mode !== 'translation' || difficultyFilter === 'Tất cả') return prompts;
    return prompts.filter((p) => p.difficulty === difficultyFilter);
  }, [prompts, mode, difficultyFilter]);

  const currentPrompt: WritingPromptItem | null = useMemo(() => {
    if (mode === 'custom') return null;
    return filteredPrompts.find((p) => p.id === selectedPromptId) || filteredPrompts[0] || null;
  }, [mode, filteredPrompts, selectedPromptId]);

  const activePromptKey = mode === 'custom' ? 'custom-passage' : currentPrompt?.id || '';
  const userText = drafts[activePromptKey] || '';
  const wordCount = useMemo(() => countWords(userText), [userText]);
  const sentenceCount = useMemo(() => countSentences(userText), [userText]);

  // Sync timer default when switching prompts
  useEffect(() => {
    const defaultMins = mode === 'custom' ? 15 : currentPrompt?.recommendedMinutes || 10;
    setSecondsLeft(defaultMins * 60);
    setTimerRunning(false);
    setGradeError(null);
    setShowHints(false);

    // Load latest submission on this prompt if available
    const samePromptHistory = writingHistory.filter((h) => h.promptId === activePromptKey);
    setActiveSubmission(samePromptHistory[0] || null);
  }, [activePromptKey, mode]);

  // Countdown tick
  useEffect(() => {
    if (!timedMode || !timerRunning) return;
    const t = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [timedMode, timerRunning]);

  const promptHistory = useMemo(
    () => writingHistory.filter((h) => h.promptId === activePromptKey),
    [writingHistory, activePromptKey]
  );

  const bestScoreByPrompt = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of writingHistory) {
      const prev = map.get(h.promptId) ?? -1;
      if (h.evaluation.overallScore > prev) {
        map.set(h.promptId, h.evaluation.overallScore);
      }
    }
    return map;
  }, [writingHistory]);

  const handleDraftChange = (val: string) => {
    if (!activePromptKey) return;
    setDrafts((prev) => ({ ...prev, [activePromptKey]: val }));
  };

  const handleClearDraft = () => {
    if (!activePromptKey) return;
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[activePromptKey];
      return next;
    });
    setGradeError(null);
  };

  const handleGrade = async () => {
    const effective = getEffectiveGeminiKey();
    setKeyStatus(effective);
    if (!effective.key) {
      setSettingsOpen(true);
      setGradeError('Vui lòng nhập Google Gemini API Key miễn phí để bắt đầu chấm bài.');
      return;
    }

    if (wordCount < 5) {
      setGradeError('Bài viết đang quá ngắn (dưới 5 từ). Hãy viết ít nhất một vài câu hoàn chỉnh trước khi chấm.');
      return;
    }

    if (mode === 'custom' && !customPrompt.passage.trim()) {
      setGradeError('Vui lòng dán đoạn văn gốc vào khung bên trái trước khi chấm bài.');
      return;
    }

    setGrading(true);
    setGradeError(null);
    setTimerRunning(false);

    try {
      const promptTitle =
        mode === 'custom'
          ? customPrompt.title.trim() || 'Đề tự tạo (Custom Passage)'
          : currentPrompt!.title;
      const sourcePassage =
        mode === 'custom'
          ? customPrompt.passage.trim()
          : currentPrompt!.emailMeta
          ? `From: ${currentPrompt!.emailMeta.from}\nTo: ${currentPrompt!.emailMeta.to}\nSubject: ${
              currentPrompt!.emailMeta.subject
            }\n\n${currentPrompt!.passage}`
          : currentPrompt!.passage;
      const sourceLanguage = mode === 'custom' ? customPrompt.sourceLanguage : currentPrompt!.sourceLanguage;
      const instructions =
        mode === 'custom'
          ? customPrompt.instructions.trim() || 'Viết bản tiếng Anh chuẩn xác và tự nhiên.'
          : currentPrompt!.instructions;
      const checklist =
        mode === 'custom'
          ? [
              'Truyền tải chính xác và đầy đủ ý chính của đoạn văn gốc',
              'Đáp ứng đầy đủ yêu cầu viết đề ra',
              'Ngữ pháp chuẩn xác, dùng collocations tiếng Anh tự nhiên',
            ]
          : currentPrompt!.checklist;

      const evaluation = await evaluateWritingWithGemini({
        apiKey: effective.key,
        model: geminiModel,
        mode,
        promptTitle,
        sourcePassage,
        sourceLanguage,
        instructions,
        checklist,
        userText: userText.trim(),
      });

      const saved = saveWritingSubmission({
        promptId: activePromptKey,
        promptTitle,
        mode,
        userText: userText.trim(),
        wordCount,
        modelUsed: geminiModel,
        evaluation,
      });

      setActiveSubmission(saved);
      window.setTimeout(() => {
        evaluationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi gọi Gemini AI.');
    } finally {
      setGrading(false);
    }
  };

  const handleRewrite = () => {
    editorRef.current?.focus();
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const modeTabs: {
    id: WritingMode;
    label: string;
    shortDesc: string;
    icon: React.FC<{ className?: string }>;
    badge?: number | string;
  }[] = [
    {
      id: 'translation',
      label: 'Dịch & Viết đoạn văn (Việt → Anh)',
      shortDesc: '30 đoạn 3 cấp độ',
      icon: Languages,
      badge: meta?.countsByMode.translation ?? 30,
    },
    {
      id: 'toeic-email',
      label: 'TOEIC Writing — Phản hồi Email (Q6–7)',
      shortDesc: 'Chuẩn ETS',
      icon: Mail,
      badge: meta?.countsByMode['toeic-email'] ?? 8,
    },
    {
      id: 'opinion',
      label: 'Quan điểm & Tóm tắt (Q8 & Paraphrase)',
      shortDesc: 'Lập luận & Tóm tắt',
      icon: MessageSquareQuote,
      badge: meta?.countsByMode.opinion ?? 6,
    },
    {
      id: 'custom',
      label: 'Tự tạo đề riêng (Custom)',
      shortDesc: 'Dán đoạn bất kỳ',
      icon: FileEdit,
      badge: 'Tự do',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner + Gemini API Settings Button */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-5 sm:p-6 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 border border-violet-500/35 px-3 py-1 text-xs font-bold text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI Writing Studio • Powered by Google Gemini (BYOK)
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Luyện Viết &amp; Chấm Bài Chuyên Sâu
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl">
              Đọc tình huống hoặc đoạn văn gốc, tự viết bài tiếng Anh và nhận chấm điểm 4 tiêu chí, sửa lỗi chi tiết từng cụm, 2 bản tham khảo (B1/B2 &amp; C1) và trích xuất từ vựng lưu thẳng vào kho SRS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowGlobalHistory((v) => !v)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition"
            >
              <History className="h-4 w-4 text-indigo-400" />
              Lịch sử ({writingHistory.length})
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-extrabold transition ${
                keyStatus.source !== 'none'
                  ? 'border-emerald-500/45 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200'
                  : 'border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Cài đặt Gemini API</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  keyStatus.source !== 'none'
                    ? 'bg-emerald-500/30 text-emerald-100'
                    : 'bg-amber-500/30 text-amber-100'
                }`}
              >
                {keyStatus.source !== 'none' ? 'Đã kết nối' : 'Chưa gắn API Key'}
              </span>
            </button>
          </div>
        </div>

        {/* 4 Mode Tabs */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {modeTabs.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? 'border-indigo-500/70 bg-gradient-to-r from-blue-600/25 via-indigo-600/20 to-violet-600/20 text-white shadow-sm'
                    : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-100'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    active ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-extrabold leading-snug line-clamp-2">{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          active ? 'bg-indigo-500/35 text-indigo-100' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">{tab.shortDesc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Global Submission History */}
      {showGlobalHistory && (
        <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-400" />
              Các bài viết đã chấm gần đây ({writingHistory.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowGlobalHistory(false)}
              className="text-xs font-bold text-slate-400 hover:text-white"
            >
              Đóng
            </button>
          </div>
          {writingHistory.length === 0 ? (
            <p className="text-xs text-slate-400">
              Chưa có lịch sử chấm bài. Hãy viết và bấm &ldquo;Chấm bài bằng Gemini AI&rdquo; để lưu lại tiến bộ.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
              {writingHistory.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setMode(h.mode);
                    if (h.mode !== 'custom') setSelectedPromptId(h.promptId);
                    setActiveSubmission(h);
                    setShowGlobalHistory(false);
                  }}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-indigo-500/50 p-3 text-left transition space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-white">{h.promptTitle}</span>
                    <span className="shrink-0 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-extrabold text-emerald-300">
                      {h.evaluation.overallScore.toFixed(1)}/10
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Lần {h.attemptNumber} • {h.wordCount} từ • CEFR {h.evaluation.cefrLevel} •{' '}
                    {new Date(h.timestamp).toLocaleDateString('vi-VN')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prompt Picker Strip (for non-custom modes) */}
      {mode !== 'custom' && (
        <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <BookOpen className="h-4 w-4 text-indigo-400" />
              <span>Chọn bài tập luyện viết ({filteredPrompts.length} đề):</span>
            </div>

            {mode === 'translation' && (
              <div className="flex flex-wrap items-center gap-1.5">
                {(['Tất cả', 'Cơ bản', 'Trung bình', 'Nâng cao'] as const).map((diff) => {
                  const cnt =
                    diff === 'Tất cả'
                      ? prompts.length
                      : prompts.filter((p) => p.difficulty === diff).length;
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficultyFilter(diff)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        difficultyFilter === diff
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {diff} ({cnt})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {loadingPrompts ? (
            <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              Đang tải kho bài luyện viết...
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
              {loadError}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pt-1 border-t border-slate-800/80">
              {filteredPrompts.map((p, idx) => {
                const isSelected = currentPrompt?.id === p.id;
                const best = bestScoreByPrompt.get(p.id);
                const diffColor =
                  p.difficulty === 'Cơ bản'
                    ? 'text-emerald-300 bg-emerald-500/15'
                    : p.difficulty === 'Trung bình'
                    ? 'text-amber-300 bg-amber-500/15'
                    : 'text-rose-300 bg-rose-500/15';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPromptId(p.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    <span>
                      #{idx + 1}: {p.title}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                        isSelected ? 'bg-black/25 text-white' : diffColor
                      }`}
                    >
                      {p.difficulty}
                    </span>
                    {best !== undefined && (
                      <span className="rounded-md bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-200">
                        ★ {best.toFixed(1)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SPLIT-SCREEN WORKSPACE */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Source Passage, Checklist & Vocab Hints (or Custom Form) */}
        <div className="xl:col-span-6 rounded-3xl border border-slate-700/80 bg-[#1E293B] p-5 sm:p-6 shadow-card space-y-4">
          {mode === 'custom' ? (
            <div className="space-y-4">
              <div>
                <span className="rounded-md bg-violet-500/20 border border-violet-400/30 px-2.5 py-0.5 text-[11px] font-bold text-violet-200 uppercase">
                  Chế độ Tự do (Custom Passage)
                </span>
                <h3 className="mt-1.5 text-lg font-extrabold text-white">
                  Tự nhập đoạn văn &amp; yêu cầu luyện viết riêng
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Tiêu đề bài viết</label>
                  <input
                    type="text"
                    value={customPrompt.title}
                    onChange={(e) => setCustomPrompt((p) => ({ ...p, title: e.target.value }))}
                    placeholder="VD: Email xin gia hạn hợp đồng"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Ngôn ngữ đoạn gốc</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['vi', 'en'] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setCustomPrompt((p) => ({ ...p, sourceLanguage: lang }))}
                        className={`rounded-xl border py-2 text-xs font-bold transition ${
                          customPrompt.sourceLanguage === lang
                            ? 'border-indigo-400 bg-indigo-500/25 text-white'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {lang === 'vi' ? 'Tiếng Việt (Dịch → Anh)' : 'Tiếng Anh (Phản hồi / Tóm tắt)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  Đoạn văn / Email / Tình huống gốc *
                </label>
                <textarea
                  rows={7}
                  value={customPrompt.passage}
                  onChange={(e) => setCustomPrompt((p) => ({ ...p, passage: e.target.value }))}
                  placeholder="Dán bất kỳ đoạn văn tiếng Việt, email tiếng Anh, bài báo ngắn hoặc tình huống công sở nào bạn muốn luyện viết tại đây..."
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 p-3.5 text-sm text-slate-100 placeholder-slate-500 leading-relaxed focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  Yêu cầu cụ thể cho AI chấm bài
                </label>
                <textarea
                  rows={3}
                  value={customPrompt.instructions}
                  onChange={(e) => setCustomPrompt((p) => ({ ...p, instructions: e.target.value }))}
                  placeholder="VD: Dịch sát nghĩa sang văn phong email công sở lịch sự, hoặc phản hồi hỏi 2 câu hỏi & đề xuất lịch họp..."
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 p-3.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 leading-relaxed focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          ) : !currentPrompt ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Chọn một đề bài ở danh sách phía trên để bắt đầu luyện viết.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-700/70 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-[11px] font-bold text-indigo-200">
                      {currentPrompt.category}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        currentPrompt.difficulty === 'Cơ bản'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : currentPrompt.difficulty === 'Trung bình'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {currentPrompt.difficulty}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Mục tiêu: {currentPrompt.recommendedWords.min}–{currentPrompt.recommendedWords.max} từ • ~{currentPrompt.recommendedMinutes} phút
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-extrabold text-white leading-snug">
                    {currentPrompt.title}
                  </h3>
                </div>
              </div>

              {/* Email Header Box if TOEIC Email */}
              {currentPrompt.emailMeta && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs space-y-1">
                  <p>
                    <span className="font-bold text-slate-400">From: </span>
                    <span className="text-slate-200">{currentPrompt.emailMeta.from}</span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-400">To: </span>
                    <span className="text-slate-200">{currentPrompt.emailMeta.to}</span>
                  </p>
                  {currentPrompt.emailMeta.date && (
                    <p>
                      <span className="font-bold text-slate-400">Date: </span>
                      <span className="text-slate-200">{currentPrompt.emailMeta.date}</span>
                    </p>
                  )}
                  <p>
                    <span className="font-bold text-slate-400">Subject: </span>
                    <span className="font-semibold text-white">{currentPrompt.emailMeta.subject}</span>
                  </p>
                </div>
              )}

              {/* Source Passage Body */}
              <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 text-sm sm:text-[15px] text-slate-100 leading-relaxed whitespace-pre-line">
                {currentPrompt.passage}
              </div>

              {/* Task Instructions & Checklist */}
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/20 p-4 space-y-2.5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                  Yêu cầu &amp; Mục tiêu bài viết
                </p>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {currentPrompt.instructions}
                </p>
                <ul className="space-y-1.5 pt-1">
                  {currentPrompt.checklist.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-cyan-100/95">
                      <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Collapsible Vocab & Structure Hints */}
              {currentPrompt.vocabHints.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-950/15 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowHints((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-extrabold text-amber-200 hover:bg-amber-500/10 transition"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-400" />
                      Gợi ý từ vựng &amp; cấu trúc nên dùng ({currentPrompt.vocabHints.length} cụm)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300">
                      {showHints ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" /> Ẩn gợi ý
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Hiện gợi ý
                        </>
                      )}
                    </span>
                  </button>

                  {showHints && (
                    <div className="border-t border-amber-500/20 p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentPrompt.vocabHints.map((hint, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-800 bg-slate-950/75 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-amber-200">{hint.phrase}</span>
                            {hint.pos && (
                              <span className="text-[10px] font-mono text-indigo-300">({hint.pos})</span>
                            )}
                          </div>
                          <p className="text-slate-300 mt-0.5">{hint.meaningVi}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Editor, Word/Sentence Counter, Optional Timer & Submit */}
        <div className="xl:col-span-6 rounded-3xl border border-slate-700/80 bg-[#1E293B] p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-3">
            <div className="flex items-center gap-2">
              <PenTool className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm sm:text-base font-extrabold text-white">Khung soạn thảo tiếng Anh</h3>
            </div>

            {/* Optional Timer Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setTimedMode((v) => !v);
                  setTimerRunning(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition ${
                  timedMode
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {timedMode ? 'Đang bật bấm giờ' : 'Bấm giờ: Tắt'}
              </button>

              {timedMode && (
                <>
                  <span
                    className={`rounded-xl border px-2.5 py-1.5 text-xs font-mono font-extrabold ${
                      secondsLeft <= 60
                        ? 'border-rose-500/50 bg-rose-500/20 text-rose-200'
                        : 'border-slate-700 bg-slate-950 text-amber-300'
                    }`}
                  >
                    {formatTimer(secondsLeft)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTimerRunning((r) => !r)}
                    className="rounded-xl border border-slate-700 bg-slate-800 p-1.5 text-slate-200 hover:text-white"
                    title={timerRunning ? 'Tạm dừng' : 'Bắt đầu đếm ngược'}
                  >
                    {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const mins = mode === 'custom' ? 15 : currentPrompt?.recommendedMinutes || 10;
                      setSecondsLeft(mins * 60);
                      setTimerRunning(false);
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:text-white"
                    title="Đặt lại đồng hồ"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Roomy Textarea */}
          <textarea
            ref={editorRef}
            rows={13}
            value={userText}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder={
              mode === 'translation'
                ? 'Viết bản dịch tiếng Anh của bạn tại đây... (Tự động lưu nháp khi bạn gõ)'
                : mode === 'toeic-email'
                ? 'Dear ...,\n\nViết email phản hồi hoàn chỉnh đáp ứng đầy đủ các yêu cầu bên trái...'
                : 'Viết đoạn văn tiếng Anh của bạn tại đây...'
            }
            className="w-full rounded-2xl border border-slate-700 bg-slate-950/90 p-4 text-sm sm:text-[15px] text-slate-100 placeholder-slate-500 leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 resize-y"
          />

          {/* Live Stats Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 font-bold text-slate-200">
                Số từ:{' '}
                <span
                  className={
                    currentPrompt &&
                    wordCount >= currentPrompt.recommendedWords.min &&
                    wordCount <= currentPrompt.recommendedWords.max + 40
                      ? 'text-emerald-300'
                      : 'text-indigo-300'
                  }
                >
                  {wordCount}
                </span>
                {currentPrompt && (
                  <span className="text-slate-500 font-normal">
                    {' '}
                    / gợi ý {currentPrompt.recommendedWords.min}–{currentPrompt.recommendedWords.max}
                  </span>
                )}
              </span>
              <span className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 font-bold text-slate-300">
                Số câu: <span className="text-cyan-300">{sentenceCount}</span>
              </span>
            </div>

            <span className="text-[11px] text-slate-400">
              {userText.trim() ? '✓ Đã tự động lưu bản nháp' : 'Sẵn sàng soạn thảo'}
            </span>
          </div>

          {/* Error Banner */}
          {gradeError && (
            <div className="rounded-2xl border border-rose-500/45 bg-rose-950/35 p-3.5 flex items-start gap-2.5 text-xs text-rose-200 leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <p>{gradeError}</p>
                {gradeError.includes('429') || gradeError.includes('API Key') ? (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/35 px-2.5 py-1 text-[11px] font-bold text-white"
                  >
                    <Settings className="h-3 w-3" />
                    Mở Cài đặt Gemini API
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={!userText.trim() || grading}
              onClick={handleClearDraft}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-rose-300 transition"
            >
              <Trash2 className="h-4 w-4" />
              Xóa nháp
            </button>

            <button
              type="button"
              disabled={grading || !userText.trim()}
              onClick={handleGrade}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 disabled:opacity-45 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-950/50 transition active:scale-[0.99]"
            >
              {grading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gemini AI đang chấm &amp; sửa bài...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Chấm bài bằng Gemini AI
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* EVALUATION RESULT PANEL */}
      {activeSubmission && (
        <div ref={evaluationRef} className="pt-2">
          <WritingEvaluationPanel
            submission={activeSubmission}
            promptHistory={promptHistory}
            onRewrite={handleRewrite}
            onSelectHistoryItem={(rec) => setActiveSubmission(rec)}
          />
        </div>
      )}

      {/* Gemini API Key Settings Modal */}
      <GeminiSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentModel={geminiModel}
        onConfigUpdated={(newModel) => {
          setGeminiModel(newModel);
          setKeyStatus(getEffectiveGeminiKey());
        }}
      />
    </div>
  );
};
