import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Headphones,
  Keyboard,
  Layers,
  List,
  Minus,
  Puzzle,
  Star,
  Volume2,
} from 'lucide-react';
import { VocabDeck } from '../../types';
import { useApp } from '../../context/AppContext';
import { playWordAudio } from '../../utils/speech';
import { TopicIllustration } from '../../components/TopicIllustration';
import { ActiveRecallMode } from './ActiveRecallMode';
import { FlashcardMode } from './FlashcardMode';
import { QuizModeType, VocabQuizModes } from './VocabQuizModes';

interface DeckStudyViewProps {
  deck: VocabDeck;
  initialTopicId?: string;
  onBack: () => void;
}

type StudyTab = 'active-recall' | 'flashcard' | QuizModeType | 'list';
const VALID_TABS: StudyTab[] = ['active-recall', 'flashcard', 'meaning', 'listening', 'cloze', 'matching', 'list'];

export const DeckStudyView: React.FC<DeckStudyViewProps> = ({ deck, initialTopicId, onBack }) => {
  const { vocabProgress, toggleSaveWord, isWordSaved } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Ensure topics array always exists cleanly
  const topics = useMemo(() => {
    if (deck.topics && deck.topics.length > 0) return deck.topics;
    return [{ id: `${deck.id}-all`, name: deck.title, icon: 'education', words: deck.words }];
  }, [deck]);

  const resolvedTopicId = useMemo(() => {
    if (initialTopicId && topics.some((t) => t.id === initialTopicId)) {
      return initialTopicId;
    }
    return topics[0].id;
  }, [initialTopicId, topics]);

  const rawTab = searchParams.get('tab') as StudyTab | null;
  const activeTab: StudyTab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'active-recall';
  const [mobileTopicsOpen, setMobileTopicsOpen] = useState(false);

  // Normalize /vocabulary/:deckId -> /vocabulary/:deckId/:topicId on mount
  useEffect(() => {
    if (!initialTopicId || !topics.some((t) => t.id === initialTopicId)) {
      const qs = searchParams.toString();
      navigate(
        `/vocabulary/${encodeURIComponent(deck.id)}/${encodeURIComponent(topics[0].id)}${qs ? `?${qs}` : ''}`,
        { replace: true }
      );
    }
  }, [deck.id, initialTopicId, topics, navigate, searchParams]);

  const activeTopicIndex = Math.max(
    0,
    topics.findIndex((t) => t.id === resolvedTopicId)
  );
  const activeTopic = topics[activeTopicIndex] || topics[0];

  const handleSelectTopic = (nextTopicId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('card');
    const qs = nextParams.toString();
    navigate(
      `/vocabulary/${encodeURIComponent(deck.id)}/${encodeURIComponent(nextTopicId)}${qs ? `?${qs}` : ''}`
    );
  };

  const handleSelectTab = (tab: StudyTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'active-recall') next.delete('tab');
        else next.set('tab', tab);
        next.delete('card');
        return next;
      },
      { replace: true }
    );
  };

  const deckMastered = deck.words.filter((w) => vocabProgress[w.id]?.status === 'mastered').length;
  const deckPct = Math.round((deckMastered / Math.max(1, deck.words.length)) * 100);

  const modePills: { id: StudyTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'active-recall', label: 'Gõ từ chủ động', icon: Keyboard },
    { id: 'flashcard', label: 'Flashcard 3D', icon: Layers },
    { id: 'meaning', label: 'Trắc nghiệm', icon: BookOpenCheck },
    { id: 'listening', label: 'Nghe chọn từ', icon: Headphones },
    { id: 'matching', label: 'Ghép cặp', icon: Puzzle },
    { id: 'list', label: 'Danh sách', icon: List },
  ];

  const handleGoNextTopic = () => {
    if (activeTopicIndex + 1 < topics.length) {
      handleSelectTopic(topics[activeTopicIndex + 1].id);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">
      {/* ================= LEFT COLUMN: DANH SÁCH CHỦ ĐỀ (Collapsible Accordion on Mobile, Sticky Sidebar on Desktop) ================= */}
      <aside className="w-full lg:w-[300px] xl:w-[320px] shrink-0 lg:sticky lg:top-20 rounded-2xl lg:rounded-3xl border border-slate-800 bg-[#111827] shadow-card flex flex-col lg:max-h-[calc(100dvh-104px)] overflow-hidden">
        {/* Sidebar Top Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/90 space-y-2.5 sm:space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại kho bộ thẻ
            </button>

            {/* Mobile Accordion Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileTopicsOpen((v) => !v)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-bold text-indigo-200 transition active:scale-95"
            >
              <span>Chủ đề ({activeTopicIndex + 1}/{topics.length})</span>
              {mobileTopicsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>

          <div>
            <p className="hidden lg:block text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              DANH SÁCH CHỦ ĐỀ
            </p>
            <h2 className="mt-0.5 lg:mt-1 text-sm font-extrabold text-white leading-snug line-clamp-2">
              {deck.title}
            </h2>
          </div>

          {/* Overall Deck Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-slate-400">
                Tổng tiến độ ({deckMastered}/{deck.words.length} thẻ)
              </span>
              <span className="text-emerald-400 font-bold">{deckPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${deckPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Vertical Topic Cards (collapsed by default on < lg) */}
        <div
          className={`${
            mobileTopicsOpen ? 'block' : 'hidden'
          } lg:block p-3 space-y-2 overflow-y-auto flex-1 max-h-[55dvh] lg:max-h-none`}
        >
          {topics.map((topic) => {
            const mastered = topic.words.filter(
              (w) => vocabProgress[w.id]?.status === 'mastered'
            ).length;
            const total = topic.words.length;
            const pct = Math.round((mastered / Math.max(1, total)) * 100);
            const isActive = topic.id === activeTopic.id;
            const isCompleted = total > 0 && mastered === total;
            const isNotStarted = mastered === 0;

            let cardCls =
              'border-slate-800 bg-[#182235] text-slate-200 hover:border-slate-700 hover:bg-[#1E293B]';
            if (isActive && !isCompleted) {
              cardCls =
                'border-blue-400/70 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-glow';
            } else if (isCompleted) {
              cardCls = isActive
                ? 'border-emerald-400 bg-emerald-950/55 text-emerald-200 ring-2 ring-emerald-400/35'
                : 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/45';
            }

            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  handleSelectTopic(topic.id);
                  setMobileTopicsOpen(false);
                }}
                className={`w-full rounded-2xl border p-3 text-left transition-all flex items-center gap-3 ${cardCls}`}
              >
                <TopicIllustration iconKey={topic.icon} size="sm" />

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-xs sm:text-[13px] font-bold ${
                      isCompleted ? 'text-emerald-300' : isActive ? 'text-white' : 'text-slate-100'
                    }`}
                  >
                    {topic.name}
                  </p>
                  <p
                    className={`mt-0.5 text-[11px] font-medium ${
                      isCompleted
                        ? 'text-emerald-400/90'
                        : isActive
                        ? 'text-blue-100'
                        : 'text-slate-400'
                    }`}
                  >
                    {mastered}/{total} thẻ
                  </p>
                </div>

                {/* Right Status Badge */}
                <div className="shrink-0">
                  {isCompleted ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-sm">
                      <Check className="h-4 w-4 stroke-[3]" />
                    </span>
                  ) : isActive || !isNotStarted ? (
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                        isActive
                          ? 'bg-white/20 text-white backdrop-blur-sm'
                          : 'bg-blue-500/20 text-sky-300 border border-blue-400/30'
                      }`}
                    >
                      {pct}%
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-500">
                      <Minus className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ================= RIGHT COLUMN: ACTIVE RECALL CARD + MODE TABS ================= */}
      <div className="flex-1 min-w-0 w-full space-y-4">
        {/* Compact Top Topic Bar + Mode Switcher Pills */}
        <div className="rounded-2xl border border-slate-800 bg-[#111827]/95 px-3.5 sm:px-4 py-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded-lg bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-[11px] font-extrabold text-sky-300 shrink-0">
              Chủ đề {activeTopicIndex + 1}/{topics.length}
            </span>
            <h3 className="truncate text-sm sm:text-base font-extrabold text-white">
              {activeTopic.name}
            </h3>
          </div>

          <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 -mx-1 px-1 sm:mx-0 sm:px-0">
            {modePills.map((m) => {
              const Icon = m.icon;
              const active = activeTab === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectTab(m.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 sm:px-2.5 sm:py-1.5 text-xs font-bold transition ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800/90 text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* DEFAULT MAIN VIEW: Active Recall Typing Card */}
        {activeTab === 'active-recall' && (
          <ActiveRecallMode
            key={activeTopic.id}
            topic={activeTopic}
            topicIndex={activeTopicIndex}
            totalTopics={topics.length}
            totalDeckWords={deck.words.length}
            deckTitle={deck.title}
            hasNextTopic={activeTopicIndex + 1 < topics.length}
            onGoNextTopic={handleGoNextTopic}
          />
        )}

        {/* Secondary Modes (scoped cleanly to active topic!) */}
        {activeTab === 'flashcard' && (
          <FlashcardMode
            key={`fc-${activeTopic.id}`}
            words={activeTopic.words}
            deckTitle={`${deck.title} — ${activeTopic.name}`}
          />
        )}

        {(activeTab === 'meaning' ||
          activeTab === 'listening' ||
          activeTab === 'cloze' ||
          activeTab === 'matching') && (
          <VocabQuizModes
            key={`qz-${activeTopic.id}-${activeTab}`}
            words={activeTopic.words}
            mode={activeTab}
            deckTitle={`${deck.title} — ${activeTopic.name}`}
          />
        )}

        {activeTab === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeTopic.words.map((w) => {
              const st = vocabProgress[w.id]?.status || 'new';
              const saved = isWordSaved(w.id);
              return (
                <div
                  key={w.id}
                  className="rounded-2xl border border-slate-700/70 bg-[#1E293B] p-4 hover:border-indigo-500/40 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-extrabold text-white">{w.word}</h4>
                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                          {w.pos}
                        </span>
                        <span className="font-mono text-xs text-slate-400">{w.ipaUS}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-sky-300">{w.meaning}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          playWordAudio(w.word, { accent: 'en-US', audioUrl: w.audioUrlUS })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-cyan-400 hover:bg-indigo-600 hover:text-white transition"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSaveWord(w.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                          saved
                            ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                            : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-amber-300'
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${saved ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{w.definitionEn}</p>
                  {w.examples[0] && (
                    <p className="mt-2 text-xs text-slate-300 italic border-l-2 border-indigo-500/50 pl-2.5">
                      &ldquo;{w.examples[0].en}&rdquo;
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      {w.synonyms.length > 0 ? `SYN: ${w.synonyms.slice(0, 3).join(', ')}` : 'Từ vựng trọng tâm'}
                    </span>
                    <span
                      className={`font-bold ${
                        st === 'mastered'
                          ? 'text-emerald-400'
                          : st === 'vague'
                          ? 'text-amber-400'
                          : st === 'forgotten'
                          ? 'text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {st === 'mastered'
                        ? 'Đã thuộc'
                        : st === 'vague'
                        ? 'Mơ hồ'
                        : st === 'forgotten'
                        ? 'Chưa nhớ'
                        : 'Chưa học'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
