import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { CollocationItem, SearchIndexEntry, WordFamilyItem } from '../types';
import { useApp } from '../context/AppContext';
import { speakText } from '../utils/speech';

interface VocabExtensionBlockProps {
  synonyms?: string[];
  antonyms?: string[];
  wordFamily?: WordFamilyItem[];
  collocations?: CollocationItem[];
  /** Default expanded state (e.g. true in Quick Dictionary & Flashcard, collapsible in Active Recall) */
  defaultOpen?: boolean;
  /** Whether user can collapse/expand the block */
  collapsible?: boolean;
  /** Compact density for tight spaces like Flashcard back */
  compact?: boolean;
  /** Optional callback to open a matched word directly in Quick Dictionary */
  onQuickLookup?: (entry: SearchIndexEntry) => void;
}

const POS_BADGE_STYLE: Record<string, string> = {
  n: 'bg-sky-500/20 text-sky-300 border-sky-400/35',
  v: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/35',
  adj: 'bg-amber-500/20 text-amber-300 border-amber-400/35',
  adv: 'bg-violet-500/20 text-violet-300 border-violet-400/35',
  phrase: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/35',
};

function hasVietnameseChars(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
}

export const VocabExtensionBlock: React.FC<VocabExtensionBlockProps> = ({
  synonyms = [],
  antonyms = [],
  wordFamily = [],
  collocations = [],
  defaultOpen = true,
  collapsible = false,
  compact = false,
  onQuickLookup,
}) => {
  const { searchIndex } = useApp();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [previewWord, setPreviewWord] = useState<{
    word: string;
    meaningVi?: string;
    ipaUS?: string;
    pos?: string;
    entry?: SearchIndexEntry;
  } | null>(null);

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

  const handleChipClick = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    speakText(term, { accent: 'en-US', rate: 0.96 });
    const match = lookupMap.get(term.toLowerCase());
    if (match) {
      setPreviewWord({
        word: match.word,
        meaningVi: match.meaningVi,
        ipaUS: match.ipaUS,
        pos: match.partOfSpeech,
        entry: match,
      });
    } else {
      setPreviewWord({
        word: term,
      });
    }
  };

  const renderHeaderSummary = () => (
    <span className="flex items-center gap-1.5 flex-wrap text-left">
      <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
      <span className="text-xs font-extrabold text-indigo-300">Mở rộng từ vựng</span>
      {cleanWordFamily.length > 0 && (
        <span className="rounded-md border border-indigo-400/30 bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
          Word Family ({cleanWordFamily.length})
        </span>
      )}
      {cleanSynonyms.length > 0 && (
        <span className="rounded-md border border-cyan-400/30 bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
          Đồng nghĩa ({cleanSynonyms.length})
        </span>
      )}
      {cleanAntonyms.length > 0 && (
        <span className="rounded-md border border-rose-400/30 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
          Trái nghĩa ({cleanAntonyms.length})
        </span>
      )}
      {cleanCollocations.length > 0 && (
        <span className="rounded-md border border-violet-400/30 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
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
    <div
      onClick={(e) => e.stopPropagation()}
      className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden text-left"
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800/45 transition"
        >
          {renderHeaderSummary()}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          )}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-3.5 py-2.5">
          {renderHeaderSummary()}
        </div>
      )}

      {(!collapsible || isOpen) && (
        <div className={`${compact ? 'p-3 space-y-2.5' : 'p-3.5 sm:p-4 space-y-3'} border-t border-slate-800/80 animate-fade-up`}>
          {/* Quick Lookup Inline Toast when user taps a synonym/antonym/word-family chip */}
          {previewWord && (
            <div className="rounded-xl border border-indigo-400/35 bg-indigo-950/35 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-up">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <Volume2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span className="font-extrabold text-white">{previewWord.word}</span>
                {previewWord.pos && (
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                    {previewWord.pos}
                  </span>
                )}
                {previewWord.ipaUS && (
                  <span className="font-mono text-[11px] text-slate-400">{previewWord.ipaUS}</span>
                )}
                <span className="text-sky-300 font-semibold">
                  {previewWord.meaningVi
                    ? `— ${previewWord.meaningVi}`
                    : '— Đã phát âm mẫu US'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {previewWord.entry && onQuickLookup && (
                  <button
                    type="button"
                    onClick={() => onQuickLookup(previewWord.entry!)}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25 px-2 py-1 text-[11px] font-bold text-cyan-200 transition"
                  >
                    <Search className="h-3 w-3" />
                    Tra chi tiết
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewWord(null)}
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-slate-400 hover:text-white"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* 3 Main Groups: Synonyms, Antonyms, Word Family */}
          {sectionCount > 0 && (
            <div className="grid grid-cols-1 gap-2.5">
              {/* Group 1: Synonyms / Paraphrase */}
              {cleanSynonyms.length > 0 && (
                <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md border border-cyan-400/45 bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-cyan-200">
                        SYN
                      </span>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                        Từ đồng nghĩa / Paraphrase TOEIC ({cleanSynonyms.length})
                      </span>
                    </div>
                    <span className="hidden sm:inline text-[10px] text-slate-400">
                      Bấm từ để nghe &amp; tra nhanh
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {cleanSynonyms.map((syn) => {
                      const matched = lookupMap.get(syn.toLowerCase());
                      return (
                        <button
                          key={syn}
                          type="button"
                          onClick={(e) => handleChipClick(e, syn)}
                          title={
                            matched
                              ? `${syn} (${matched.partOfSpeech}): ${matched.meaningVi} — Bấm để nghe & tra`
                              : `Bấm để nghe phát âm "${syn}"`
                          }
                          className="group inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/25 px-2.5 py-1 text-xs font-semibold text-cyan-200 transition active:scale-95"
                        >
                          <Volume2 className="h-3 w-3 text-cyan-400 opacity-75 group-hover:opacity-100" />
                          <span>{syn}</span>
                          {matched && (
                            <span className="text-[10px] text-emerald-300/90 font-normal hidden sm:inline">
                              · {matched.meaningVi.split(/[;,]/)[0]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Group 2: Antonyms */}
              {cleanAntonyms.length > 0 && (
                <div className="rounded-xl border border-rose-500/25 bg-rose-950/20 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md border border-rose-400/45 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-rose-200">
                      ANT
                    </span>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-300">
                      Từ trái nghĩa ({cleanAntonyms.length})
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {cleanAntonyms.map((ant) => {
                      const matched = lookupMap.get(ant.toLowerCase());
                      return (
                        <button
                          key={ant}
                          type="button"
                          onClick={(e) => handleChipClick(e, ant)}
                          title={
                            matched
                              ? `${ant} (${matched.partOfSpeech}): ${matched.meaningVi} — Bấm để nghe & tra`
                              : `Bấm để nghe phát âm "${ant}"`
                          }
                          className="group inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/25 px-2.5 py-1 text-xs font-semibold text-rose-200 transition active:scale-95"
                        >
                          <Volume2 className="h-3 w-3 text-rose-400 opacity-75 group-hover:opacity-100" />
                          <span>{ant}</span>
                          {matched && (
                            <span className="text-[10px] text-amber-200/90 font-normal hidden sm:inline">
                              · {matched.meaningVi.split(/[;,]/)[0]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Group 3: Word Family */}
              {cleanWordFamily.length > 0 && (
                <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/20 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md border border-indigo-400/45 bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-indigo-200">
                      WF
                    </span>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
                      Từ vựng gia đình — Word Family ({cleanWordFamily.length})
                    </span>
                  </div>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {cleanWordFamily.map((wf, i) => {
                      const posKey = (wf.pos || 'n').toLowerCase().trim();
                      const posCls =
                        POS_BADGE_STYLE[posKey] ||
                        'bg-slate-700/60 text-slate-200 border-slate-600/60';
                      const matched = lookupMap.get(wf.word.trim().toLowerCase());
                      const displayMeaning =
                        wf.meaning && hasVietnameseChars(wf.meaning)
                          ? wf.meaning
                          : matched?.meaningVi || wf.meaning || 'Dạng từ liên quan';

                      return (
                        <li
                          key={`${wf.word}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-950/55 px-2.5 py-1.5 text-xs"
                        >
                          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => handleChipClick(e, wf.word)}
                              className="font-extrabold text-white hover:text-sky-300 transition text-left"
                              title={`Nghe phát âm "${wf.word}"`}
                            >
                              {wf.word}
                            </button>
                            <span
                              className={`rounded border px-1.5 py-0.2 text-[10px] font-extrabold uppercase ${posCls}`}
                            >
                              {wf.pos}
                            </span>
                            <span className="text-slate-300">{displayMeaning}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleChipClick(e, wf.word)}
                            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-indigo-500/20 hover:text-cyan-300 transition"
                            title={`Nghe "${wf.word}"`}
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
            <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 p-3 space-y-1.5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-violet-300">
                Collocations TOEIC ({cleanCollocations.length})
              </p>
              <ul className="space-y-1 text-xs text-slate-300">
                {cleanCollocations.map((c, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-2">
                    <span>
                      <b className="text-violet-200">{c.phrase}</b>
                      <span className="text-slate-400"> — {c.meaning}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakText(c.phrase, { accent: 'en-US', rate: 0.96 });
                      }}
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:text-violet-300"
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
  );
};
