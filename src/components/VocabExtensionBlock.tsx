import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { CollocationItem, SearchIndexEntry, WordFamilyItem } from '../types';
import { useApp } from '../context/AppContext';
import { speakText } from '../utils/speech';
import { QuickWordTarget, VocabQuickDetailModal } from './VocabQuickDetailModal';

interface VocabExtensionBlockProps {
  synonyms?: string[];
  antonyms?: string[];
  wordFamily?: WordFamilyItem[];
  collocations?: CollocationItem[];
  /** Cleaned Vietnamese glosses for synonyms & antonyms (keyed by lowercase term) */
  relationMeanings?: Record<string, string>;
  /** Default expanded state (e.g. true in Quick Dictionary & Flashcard, collapsible in Active Recall) */
  defaultOpen?: boolean;
  /** Whether user can collapse/expand the block */
  collapsible?: boolean;
  /** Compact density for tight spaces like Flashcard back */
  compact?: boolean;
  /** Optional callback kept for backward compatibility */
  onQuickLookup?: (entry: SearchIndexEntry) => void;
}

const POS_BADGE_STYLE: Record<string, string> = {
  n: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-400/35',
  v: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/35',
  adj: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/35',
  adv: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-400/35',
  phrase: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-400/35',
};

function hasVietnameseChars(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
}

export const VocabExtensionBlock: React.FC<VocabExtensionBlockProps> = ({
  synonyms = [],
  antonyms = [],
  wordFamily = [],
  collocations = [],
  relationMeanings,
  defaultOpen = true,
  collapsible = false,
  compact = false,
}) => {
  const { searchIndex } = useApp();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeModalTarget, setActiveModalTarget] = useState<QuickWordTarget | null>(null);

  const cleanSynonyms = useMemo(
    () => Array.from(new Set(synonyms.map((s) => s.trim()).filter(Boolean))),
    [synonyms]
  );
  const cleanAntonyms = useMemo(
    () => Array.from(new Set(antonyms.map((a) => a.trim()).filter(Boolean))),
    [antonyms]
  );
  const cleanWordFamily = useMemo(
    () => wordFamily.filter((wf) => wf && wf.word && wf.word.trim()),
    [wordFamily]
  );
  const cleanCollocations = useMemo(
    () => collocations.filter((c) => c && c.phrase && c.phrase.trim()),
    [collocations]
  );

  // Build fast lowercase lookup map only for words displayed inside this block
  const lookupMap = useMemo(() => {
    const needed = new Set<string>();
    cleanSynonyms.forEach((s) => needed.add(s.toLowerCase()));
    cleanAntonyms.forEach((a) => needed.add(a.toLowerCase()));
    cleanWordFamily.forEach((wf) => needed.add(wf.word.trim().toLowerCase()));
    const map = new Map<string, SearchIndexEntry>();
    if (needed.size === 0 || searchIndex.length === 0) return map;
    for (const row of searchIndex) {
      const k = row.word.toLowerCase();
      if (needed.has(k) && !map.has(k)) {
        map.set(k, row);
        if (map.size === needed.size) break;
      }
    }
    return map;
  }, [cleanSynonyms, cleanAntonyms, cleanWordFamily, searchIndex]);

  const hasAny =
    cleanSynonyms.length > 0 ||
    cleanAntonyms.length > 0 ||
    cleanWordFamily.length > 0 ||
    cleanCollocations.length > 0;

  if (!hasAny) return null;

  const openDetail = (
    e: React.MouseEvent,
    word: string,
    relationType: QuickWordTarget['relationType'],
    pos?: string,
    explicitMeaning?: string
  ) => {
    e.stopPropagation();
    const key = word.trim().toLowerCase();
    const matched = lookupMap.get(key);
    const fallbackMeaning =
      explicitMeaning ||
      relationMeanings?.[key] ||
      matched?.meaningVi ||
      undefined;

    setActiveModalTarget({
      word,
      relationType,
      pos: pos || matched?.partOfSpeech,
      fallbackMeaning,
    });
  };

  const renderHeaderSummary = () => (
    <span className="flex items-center gap-1.5 flex-wrap text-left">
      <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
      <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
        Mở rộng từ vựng
      </span>
      {cleanWordFamily.length > 0 && (
        <span className="rounded-md border border-indigo-200 dark:border-indigo-400/30 bg-indigo-50 dark:bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
          Word Family ({cleanWordFamily.length})
        </span>
      )}
      {cleanSynonyms.length > 0 && (
        <span className="rounded-md border border-cyan-200 dark:border-cyan-400/30 bg-cyan-50 dark:bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
          Đồng nghĩa ({cleanSynonyms.length})
        </span>
      )}
      {cleanAntonyms.length > 0 && (
        <span className="rounded-md border border-rose-200 dark:border-rose-400/30 bg-rose-50 dark:bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
          Trái nghĩa ({cleanAntonyms.length})
        </span>
      )}
      {cleanCollocations.length > 0 && (
        <span className="rounded-md border border-violet-200 dark:border-violet-400/30 bg-violet-50 dark:bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
          Collocations ({cleanCollocations.length})
        </span>
      )}
    </span>
  );

  const sectionCount =
    (cleanSynonyms.length > 0 ? 1 : 0) +
    (cleanAntonyms.length > 0 ? 1 : 0) +
    (cleanWordFamily.length > 0 ? 1 : 0);

  return (
    <>
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 overflow-hidden text-left"
      >
        {collapsible ? (
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/45 transition"
          >
            {renderHeaderSummary()}
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
            )}
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 px-3.5 py-2.5">
            {renderHeaderSummary()}
          </div>
        )}

        {(!collapsible || isOpen) && (
          <div
            className={`${
              compact ? 'p-3 space-y-2.5' : 'p-3.5 sm:p-4 space-y-3'
            } border-t border-slate-200 dark:border-slate-800/80 animate-fade-up`}
          >
            {/* 3 Main Groups: Synonyms, Antonyms, Word Family */}
            {sectionCount > 0 && (
              <div className="grid grid-cols-1 gap-2.5">
                {/* Group 1: Synonyms / Paraphrase (Clean compact chips — tap to open Quick Detail Modal) */}
                {cleanSynonyms.length > 0 && (
                  <div className="rounded-xl border border-cyan-200/80 dark:border-cyan-500/25 bg-cyan-50/50 dark:bg-cyan-950/20 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md border border-cyan-300 dark:border-cyan-400/45 bg-cyan-100 dark:bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-cyan-800 dark:text-cyan-200">
                          SYN
                        </span>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                          Từ đồng nghĩa / Paraphrase TOEIC ({cleanSynonyms.length})
                        </span>
                      </div>
                      <span className="hidden sm:inline text-[10px] text-slate-500 dark:text-slate-400">
                        Bấm từ để xem nghĩa &amp; lưu
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {cleanSynonyms.map((syn) => (
                        <button
                          key={syn}
                          type="button"
                          onClick={(e) => openDetail(e, syn, 'synonym')}
                          title={`Bấm xem chi tiết & lưu từ "${syn}"`}
                          className="group inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/90 dark:border-cyan-500/35 bg-white dark:bg-cyan-500/10 hover:bg-cyan-100/80 dark:hover:bg-cyan-500/25 hover:border-cyan-400 px-2.5 py-1 text-xs font-bold text-cyan-900 dark:text-cyan-200 shadow-sm dark:shadow-none transition active:scale-95"
                        >
                          <span>{syn}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Group 2: Antonyms (Clean compact chips — tap to open Quick Detail Modal) */}
                {cleanAntonyms.length > 0 && (
                  <div className="rounded-xl border border-rose-200/80 dark:border-rose-500/25 bg-rose-50/50 dark:bg-rose-950/20 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md border border-rose-300 dark:border-rose-400/45 bg-rose-100 dark:bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-rose-800 dark:text-rose-200">
                          ANT
                        </span>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                          Từ trái nghĩa ({cleanAntonyms.length})
                        </span>
                      </div>
                      <span className="hidden sm:inline text-[10px] text-slate-500 dark:text-slate-400">
                        Bấm từ để xem nghĩa &amp; lưu
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {cleanAntonyms.map((ant) => (
                        <button
                          key={ant}
                          type="button"
                          onClick={(e) => openDetail(e, ant, 'antonym')}
                          title={`Bấm xem chi tiết & lưu từ "${ant}"`}
                          className="group inline-flex items-center gap-1.5 rounded-lg border border-rose-300/90 dark:border-rose-500/35 bg-white dark:bg-rose-500/10 hover:bg-rose-100/80 dark:hover:bg-rose-500/25 hover:border-rose-400 px-2.5 py-1 text-xs font-bold text-rose-900 dark:text-rose-200 shadow-sm dark:shadow-none transition active:scale-95"
                        >
                          <span>{ant}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Group 3: Word Family (Word + POS badge + Clean Vietnamese meaning; tap word for detail popup, speaker to pronounce) */}
                {cleanWordFamily.length > 0 && (
                  <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-500/25 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md border border-indigo-300 dark:border-indigo-400/45 bg-indigo-100 dark:bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-indigo-800 dark:text-indigo-200">
                        WF
                      </span>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                        Từ vựng gia đình — Word Family ({cleanWordFamily.length})
                      </span>
                    </div>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {cleanWordFamily.map((wf, i) => {
                        const posKey = (wf.pos || 'n').toLowerCase().trim();
                        const posCls =
                          POS_BADGE_STYLE[posKey] ||
                          'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600/60';
                        const matched = lookupMap.get(wf.word.trim().toLowerCase());
                        const displayMeaning =
                          wf.meaning && hasVietnameseChars(wf.meaning)
                            ? wf.meaning
                            : matched?.meaningVi || wf.meaning || 'Dạng từ liên quan';

                        return (
                          <li
                            key={`${wf.word}-${i}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-950/55 px-2.5 py-1.5 text-xs shadow-sm dark:shadow-none"
                          >
                            <button
                              type="button"
                              onClick={(e) =>
                                openDetail(e, wf.word, 'word-family', wf.pos, displayMeaning)
                              }
                              className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap text-left group"
                              title={`Bấm xem chi tiết & lưu từ "${wf.word}"`}
                            >
                              <span className="font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-sky-300 transition">
                                {wf.word}
                              </span>
                              <span
                                className={`rounded border px-1.5 py-0.2 text-[10px] font-extrabold uppercase ${posCls}`}
                              >
                                {wf.pos}
                              </span>
                              <span className="text-slate-600 dark:text-slate-300">
                                {displayMeaning}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speakText(wf.word, { accent: 'en-US', rate: 0.96 });
                              }}
                              className="shrink-0 rounded-md p-1 text-slate-500 dark:text-slate-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:text-indigo-700 dark:hover:text-cyan-300 transition"
                              title={`Nghe phát âm "${wf.word}"`}
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Optional Collocations TOEIC */}
            {cleanCollocations.length > 0 && (
              <div className="rounded-xl border border-violet-200/80 dark:border-violet-500/25 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-1.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-violet-800 dark:text-violet-300">
                  Collocations TOEIC ({cleanCollocations.length})
                </p>
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {cleanCollocations.map((c, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-2">
                      <span>
                        <b className="text-violet-900 dark:text-violet-200">{c.phrase}</b>
                        <span className="text-slate-600 dark:text-slate-400"> — {c.meaning}</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakText(c.phrase, { accent: 'en-US', rate: 0.96 });
                        }}
                        className="shrink-0 rounded p-0.5 text-slate-500 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300"
                        title={`Nghe cụm "${c.phrase}"`}
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unified Quick Detail & Save Popup Modal */}
      <VocabQuickDetailModal
        target={activeModalTarget}
        onClose={() => setActiveModalTarget(null)}
        onSelectAnotherWord={(next) => setActiveModalTarget(next)}
      />
    </>
  );
};
