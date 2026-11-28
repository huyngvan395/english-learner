import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Sparkles,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import { SearchIndexEntry, VocabWord, WordPOS } from '../types';
import { useApp } from '../context/AppContext';
import {
  getCachedRelationDetail,
  loadFullWord,
  lookupRelationDetail,
  RelationDetailEntry,
} from '../utils/vocabLoader';
import { buildLemmaCandidates } from '../utils/lemmatizer';
import { playWordAudio, speakText } from '../utils/speech';
import {
  fetchOnlineDictDetails,
  generateAiBilingualExample,
  getCachedOnlineDictDetails,
  OnlineDictDetails,
} from '../utils/onlineDictLookup';
import { getEffectiveGeminiKey } from '../utils/geminiWritingService';
import { QuickWordTarget, VocabQuickDetailModal } from './VocabQuickDetailModal';

const CUSTOM_DECK_IDS = new Set(['listening-saved', 'writing-saved', 'reading-saved', 'vocab-saved']);

interface LookupState {
  selectedRaw: string;
  anchorRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
  };
  source: 'internal' | 'relation' | 'online';
  loading: boolean;
  matchedEntry: SearchIndexEntry | null;
  fullWord: VocabWord | null;
  relationDetail: RelationDetailEntry | null;
  onlineData: OnlineDictDetails | null;
  aiExample: { en: string; vi: string } | null;
}

const VI_CHAR_RE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const POS_VI_BADGE: Record<string, string> = {
  n: 'n · Danh từ',
  v: 'v · Động từ',
  adj: 'adj · Tính từ',
  adv: 'adv · Trạng từ',
  phrase: 'Cụm từ',
};

function cleanSelectedEnglish(raw: string): string | null {
  const collapsed = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;

  // Trim leading/trailing punctuation and quotes
  const trimmed = collapsed
    .replace(/^[\s.,?!;:"'()\[\]{}“”‘’«»—–\-/*•]+/, '')
    .replace(/[\s.,?!;:"'()\[\]{}“”‘’«»—–\-/*•]+$/, '')
    .trim();

  if (trimmed.length < 2 || trimmed.length > 45) return null;
  // Ignore Vietnamese text so highlighting Vietnamese explanations never pops up English dictionary
  if (VI_CHAR_RE.test(trimmed)) return null;
  // Must contain at least 2 English letters and only valid English word/phrase chars
  if (!/[a-zA-Z]{2,}/.test(trimmed)) return null;
  if (!/^[a-zA-Z0-9\s'’\-]+$/.test(trimmed)) return null;

  const words = trimmed.split(' ').filter(Boolean);
  if (words.length < 1 || words.length > 4) return null;

  return trimmed;
}

function isEditableOrIgnoredTarget(node: Node | null): boolean {
  if (!node) return false;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  if (!el) return false;
  if (
    el.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""], [data-selection-lookup="true"], [role="dialog"]'
    )
  ) {
    return true;
  }
  return false;
}

export const TextSelectionLookup: React.FC = () => {
  const { searchIndex, customWords, saveRelatedVocab, isVocabTextSaved } = useApp();
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [fullModalTarget, setFullModalTarget] = useState<QuickWordTarget | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

  // Track responsive mobile viewport for bottom-sheet vs floating popover
  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const closeLookup = useCallback(() => {
    requestIdRef.current += 1;
    setLookup(null);
  }, []);

  // Close on Escape, outside pointerdown, or scroll-resize dismissal
  useEffect(() => {
    if (!lookup) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLookup();
      }
    };

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (popoverRef.current && target && popoverRef.current.contains(target)) {
        return;
      }
      closeLookup();
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [lookup, closeLookup]);

  // Listen globally to mouseup / touchend to detect highlighted English words/phrases
  useEffect(() => {
    let settleTimer: number | null = null;

    const inspectSelection = (ev: MouseEvent | TouchEvent) => {
      const evTarget = ev.target as Node | null;
      if (isEditableOrIgnoredTarget(evTarget)) return;

      if (settleTimer) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
        if (isEditableOrIgnoredTarget(sel.anchorNode) || isEditableOrIgnoredTarget(sel.focusNode)) {
          return;
        }

        const cleaned = cleanSelectedEnglish(sel.toString());
        if (!cleaned) return;

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const reqId = ++requestIdRef.current;
        const anchorRect = {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };

        // TIER 1: Instant internal 16-deck bank lookup + basic lemmatization (prefer standard decks over sparse custom entries)
        const candidates = buildLemmaCandidates(cleaned);
        const standardRows = searchIndex.filter((r) => !CUSTOM_DECK_IDS.has(r.deckId));
        let matchedEntry: SearchIndexEntry | null = null;
        for (const cand of candidates) {
          const hit = standardRows.find((r) => r.word.toLowerCase() === cand);
          if (hit) {
            matchedEntry = hit;
            break;
          }
        }

        const needsHydration = (fw: VocabWord | null): boolean => {
          if (!fw) return true;
          const hasIpa = Boolean(fw.ipaUS && fw.ipaUS.trim() && fw.ipaUS.trim() !== '/.../');
          const hasDef = Boolean(fw.definitionEn && fw.definitionEn.trim());
          const hasEx = Boolean(fw.examples?.[0]?.en?.trim());
          return !hasIpa || !hasDef || !hasEx;
        };

        if (matchedEntry) {
          const cachedOnline = getCachedOnlineDictDetails(matchedEntry.word, matchedEntry.partOfSpeech);
          setLookup({
            selectedRaw: cleaned,
            anchorRect,
            source: 'internal',
            loading: true,
            matchedEntry,
            fullWord: null,
            relationDetail: null,
            onlineData: cachedOnline,
            aiExample: null,
          });

          loadFullWord(matchedEntry.deckId, matchedEntry.id)
            .then(async (fw) => {
              if (requestIdRef.current !== reqId) return;
              if (needsHydration(fw)) {
                const online = await fetchOnlineDictDetails(matchedEntry!.word, matchedEntry!.partOfSpeech);
                if (requestIdRef.current !== reqId) return;
                setLookup((prev) =>
                  prev ? { ...prev, fullWord: fw, onlineData: online, loading: false } : prev
                );
              } else {
                setLookup((prev) =>
                  prev ? { ...prev, fullWord: fw, loading: false } : prev
                );
              }
            })
            .catch(() => {
              if (requestIdRef.current !== reqId) return;
              setLookup((prev) => (prev ? { ...prev, loading: false } : prev));
            });
          return;
        }

        // TIER 2: Lazy-loaded relation-details.json (0ms once cached) -> TIER 3: Online fallback
        const customMatch =
          customWords.find((w) => candidates.includes(w.word.toLowerCase())) || null;

        let cachedRel: RelationDetailEntry | null = null;
        for (const cand of candidates) {
          const hit = getCachedRelationDetail(cand);
          if (hit) {
            cachedRel = hit;
            break;
          }
        }

        if (cachedRel) {
          setLookup({
            selectedRaw: cleaned,
            anchorRect,
            source: 'relation',
            loading: false,
            matchedEntry: null,
            fullWord: customMatch,
            relationDetail: cachedRel,
            onlineData: null,
            aiExample: null,
          });
          return;
        }

        const cachedOnline = getCachedOnlineDictDetails(cleaned);
        setLookup({
          selectedRaw: cleaned,
          anchorRect,
          source: 'online',
          loading: true,
          matchedEntry: null,
          fullWord: customMatch,
          relationDetail: null,
          onlineData: cachedOnline,
          aiExample: null,
        });

        (async () => {
          // Try Layer 2 relation-details.json first
          for (const cand of candidates) {
            const relHit = await lookupRelationDetail(cand);
            if (requestIdRef.current !== reqId) return;
            if (relHit) {
              setLookup((prev) =>
                prev
                  ? { ...prev, source: 'relation', relationDetail: relHit, loading: false }
                  : prev
              );
              return;
            }
          }

          // Layer 3: Online dictionaryapi.dev + Vietnamese translation
          if (cachedOnline) {
            setLookup((prev) => (prev ? { ...prev, onlineData: cachedOnline, loading: false } : prev));
            return;
          }
          const data = await fetchOnlineDictDetails(cleaned, customMatch?.pos);
          if (requestIdRef.current !== reqId) return;
          setLookup((prev) =>
            prev ? { ...prev, onlineData: data, loading: false } : prev
          );
        })();
      }, 110);
    };

    document.addEventListener('mouseup', inspectSelection);
    document.addEventListener('touchend', inspectSelection, { passive: true });
    return () => {
      if (settleTimer) window.clearTimeout(settleTimer);
      document.removeEventListener('mouseup', inspectSelection);
      document.removeEventListener('touchend', inspectSelection);
    };
  }, [searchIndex, customWords]);

  if (!lookup && !fullModalTarget) return null;

  // Derive display fields cleanly from Tier 1 or Tier 2
  const displayWord =
    lookup?.fullWord?.word ||
    lookup?.matchedEntry?.word ||
    lookup?.onlineData?.word ||
    lookup?.selectedRaw ||
    '';

  const isLemmatizedMatch =
    Boolean(lookup) &&
    displayWord.toLowerCase() !== lookup!.selectedRaw.toLowerCase();

  const displayPos: WordPOS =
    lookup?.fullWord?.pos ||
    lookup?.matchedEntry?.partOfSpeech ||
    lookup?.relationDetail?.pos ||
    lookup?.onlineData?.pos ||
    (displayWord.includes(' ') ? 'phrase' : 'n');

  const displayIpaUS =
    (lookup?.fullWord?.ipaUS && lookup.fullWord.ipaUS !== '/.../' ? lookup.fullWord.ipaUS : '') ||
    (lookup?.matchedEntry?.ipaUS && lookup.matchedEntry.ipaUS !== '/.../'
      ? lookup.matchedEntry.ipaUS
      : '') ||
    lookup?.relationDetail?.ipaUs ||
    lookup?.onlineData?.ipaUS ||
    '';

  const displayIpaUK =
    (lookup?.fullWord?.ipaUK && lookup.fullWord.ipaUK !== '/.../' ? lookup.fullWord.ipaUK : '') ||
    lookup?.relationDetail?.ipaUk ||
    lookup?.onlineData?.ipaUK ||
    '';

  const rawMeaning =
    lookup?.fullWord?.meaning ||
    lookup?.matchedEntry?.meaningVi ||
    lookup?.relationDetail?.meaningVi ||
    lookup?.onlineData?.meaningVi ||
    '';
  const displayMeaning = rawMeaning.replace(/^\[[^\]]+\]\s*/, '').trim();

  const normCmp = (s?: string) => (s || '').trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase();
  const displayDefEn =
    lookup?.fullWord?.definitionEn?.trim() ||
    lookup?.relationDetail?.definitionEn?.trim() ||
    lookup?.onlineData?.definitionEn ||
    '';
  const rawDefVi =
    lookup?.fullWord?.definitionVi?.trim() ||
    lookup?.relationDetail?.definitionVi?.trim() ||
    lookup?.onlineData?.definitionVi ||
    '';
  const displayDefVi = rawDefVi && normCmp(rawDefVi) !== normCmp(displayDefEn) ? rawDefVi : '';

  const displayExampleEn =
    lookup?.fullWord?.examples?.[0]?.en?.trim() ||
    lookup?.relationDetail?.exampleEn?.trim() ||
    lookup?.onlineData?.exampleEn ||
    lookup?.aiExample?.en ||
    '';
  const rawExampleVi =
    lookup?.fullWord?.examples?.[0]?.vi?.trim() ||
    lookup?.relationDetail?.exampleVi?.trim() ||
    lookup?.onlineData?.exampleVi ||
    lookup?.aiExample?.vi ||
    '';
  const displayExampleVi =
    rawExampleVi && normCmp(rawExampleVi) !== normCmp(displayExampleEn) ? rawExampleVi : '';

  const hasGeminiKey = Boolean(getEffectiveGeminiKey().key);

  const handleGenerateAiExample = async () => {
    if (!lookup || aiGenerating) return;
    setAiGenerating(true);
    try {
      const res = await generateAiBilingualExample({
        word: displayWord,
        pos: displayPos,
        meaningVi: displayMeaning,
        definitionEn: displayDefEn,
      });
      if (res) {
        setLookup((prev) => (prev ? { ...prev, aiExample: res } : prev));
      }
    } catch {
      // Ignore error gracefully
    } finally {
      setAiGenerating(false);
    }
  };

  const audioUrlUS = lookup?.fullWord?.audioUrlUS || lookup?.onlineData?.audioUrlUS;
  const audioUrlUK =
    lookup?.fullWord?.audioUrlUK || lookup?.onlineData?.audioUrlUK || audioUrlUS;

  const hasFullDetails = Boolean(
    lookup?.matchedEntry ||
      (lookup?.fullWord &&
        (lookup.fullWord.synonyms.length > 0 ||
          lookup.fullWord.antonyms.length > 0 ||
          lookup.fullWord.wordFamily.length > 0 ||
          lookup.fullWord.collocations.length > 0))
  );

  const saved = displayWord ? isVocabTextSaved(displayWord) : false;

  const handleSave = () => {
    if (!lookup || !displayWord) return;
    saveRelatedVocab({
      id: lookup.fullWord?.id || lookup.matchedEntry?.id,
      deckId: lookup.fullWord?.deckId || lookup.matchedEntry?.deckId,
      word: displayWord,
      pos: displayPos,
      ipaUS: displayIpaUS,
      ipaUK: displayIpaUK || displayIpaUS,
      meaning: displayMeaning || displayWord,
      definitionEn: displayDefEn,
      definitionVi: displayDefVi,
      examples: displayExampleEn
        ? [{ en: displayExampleEn, vi: displayExampleVi || displayMeaning }]
        : [],
    });
  };

  const handleOpenFullModal = () => {
    if (!displayWord) return;
    setFullModalTarget({
      word: displayWord,
      pos: displayPos,
      fallbackMeaning: displayMeaning,
    });
    closeLookup();
  };

  // Compute viewport-clamped Desktop popover position (smart flip above/below or vertical center, always >= 16px from edges)
  const computeDesktopStyle = (): React.CSSProperties => {
    if (!lookup) return {};
    const MARGIN = 16;
    const GAP = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const POPOVER_W = Math.min(368, vw - MARGIN * 2);
    const MAX_ALLOWED_H = Math.min(380, Math.max(220, vh - MARGIN * 2));
    const ESTIMATED_H = Math.min(340, MAX_ALLOWED_H);

    const centerX = lookup.anchorRect.left + lookup.anchorRect.width / 2;
    const clampedLeft = Math.max(MARGIN, Math.min(vw - POPOVER_W - MARGIN, centerX - POPOVER_W / 2));

    const spaceBelow = vh - lookup.anchorRect.bottom - GAP - MARGIN;
    const spaceAbove = lookup.anchorRect.top - GAP - MARGIN;

    if (spaceBelow >= ESTIMATED_H) {
      const top = Math.max(MARGIN, lookup.anchorRect.bottom + GAP);
      const maxHeight = Math.min(MAX_ALLOWED_H, Math.max(200, vh - top - MARGIN));
      return {
        position: 'fixed',
        left: `${clampedLeft}px`,
        top: `${top}px`,
        width: `${POPOVER_W}px`,
        maxHeight: `${maxHeight}px`,
      };
    }

    if (spaceAbove >= ESTIMATED_H || (spaceAbove >= 240 && spaceAbove >= spaceBelow)) {
      const bottom = Math.max(MARGIN, vh - lookup.anchorRect.top + GAP);
      const maxHeight = Math.min(MAX_ALLOWED_H, Math.max(200, vh - bottom - MARGIN));
      return {
        position: 'fixed',
        left: `${clampedLeft}px`,
        bottom: `${bottom}px`,
        width: `${POPOVER_W}px`,
        maxHeight: `${maxHeight}px`,
      };
    }

    // Fallback: vertically center within viewport with guaranteed 16px top/bottom margin
    const centeredTop = Math.max(MARGIN, Math.round((vh - MAX_ALLOWED_H) / 2));
    return {
      position: 'fixed',
      left: `${clampedLeft}px`,
      top: `${centeredTop}px`,
      width: `${POPOVER_W}px`,
      maxHeight: `${MAX_ALLOWED_H}px`,
    };
  };

  const popupNode = lookup ? (
    <div
      ref={popoverRef}
      data-selection-lookup="true"
      style={isMobileViewport ? undefined : computeDesktopStyle()}
      className={
        isMobileViewport
          ? 'fixed inset-x-2.5 bottom-3 z-[65] max-h-[min(380px,calc(100dvh-32px))] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C31] shadow-2xl overflow-hidden animate-fade-up pb-safe'
          : 'z-[65] max-h-[min(380px,calc(100dvh-32px))] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-[#131C31] shadow-2xl overflow-hidden animate-fade-up'
      }
    >
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0F172A]/90 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded-md border border-indigo-200 dark:border-indigo-400/35 bg-indigo-50 dark:bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-200">
              {POS_VI_BADGE[displayPos] || displayPos}
            </span>
            {lookup.source === 'internal' ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                <BookOpen className="h-2.5 w-2.5" />
                Kho từ chính
              </span>
            ) : lookup.source === 'relation' ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                <BookOpen className="h-2.5 w-2.5" />
                Kho từ mở rộng
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
                <Globe className="h-2.5 w-2.5" />
                Tra cứu nhanh
              </span>
            )}
            {isLemmatizedMatch && (
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                ({lookup.selectedRaw} → {displayWord})
              </span>
            )}
          </div>

          <h4 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white break-words leading-tight">
            {displayWord}
          </h4>

          {/* Audio Buttons US / UK */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() =>
                playWordAudio(displayWord, { accent: 'en-US', audioUrl: audioUrlUS })
              }
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 dark:border-cyan-500/35 bg-cyan-50 dark:bg-slate-800/90 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 px-2 py-1 text-[11px] font-bold text-cyan-800 dark:text-cyan-200 transition active:scale-95"
              title="Nghe phát âm giọng Mỹ (US)"
            >
              <Volume2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>US</span>
              {displayIpaUS && (
                <span className="font-mono font-normal text-slate-600 dark:text-slate-300">
                  {displayIpaUS}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                playWordAudio(displayWord, { accent: 'en-GB', audioUrl: audioUrlUK })
              }
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-slate-800/90 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-2 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-200 transition active:scale-95"
              title="Nghe phát âm giọng Anh (UK)"
            >
              <Volume2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>UK</span>
              {displayIpaUK && displayIpaUK !== displayIpaUS && (
                <span className="font-mono font-normal text-slate-600 dark:text-slate-300">
                  {displayIpaUK}
                </span>
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={closeLookup}
          aria-label="Đóng tra từ nhanh"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 text-xs">
        {lookup.loading && !displayMeaning ? (
          <div className="flex items-center gap-2 py-3 text-slate-600 dark:text-slate-300 font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500 dark:text-indigo-400" />
            <span>Đang tra nghĩa &amp; phiên âm...</span>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-indigo-200/80 dark:border-slate-700/80 bg-indigo-50/70 dark:bg-[#1E293B]/75 px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Nghĩa tiếng Việt
              </p>
              <p className="text-sm font-extrabold text-slate-900 dark:text-sky-200 leading-snug">
                {displayMeaning || 'Đang cập nhật nghĩa...'}
              </p>
              {displayDefEn && (
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">
                  {displayDefEn}
                </p>
              )}
              {displayDefVi && (
                <p className="text-[11px] italic text-slate-600 dark:text-slate-400 leading-relaxed">
                  {displayDefVi}
                </p>
              )}
            </div>

            {displayExampleEn ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 px-3 py-2 space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                    &ldquo;{displayExampleEn}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => speakText(displayExampleEn, { accent: 'en-US', rate: 0.96 })}
                    className="shrink-0 rounded p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-300"
                    title="Nghe câu ví dụ"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {displayExampleVi && (
                  <p className="text-[11px] italic text-slate-600 dark:text-slate-400 leading-relaxed">
                    {displayExampleVi}
                  </p>
                )}
              </div>
            ) : !lookup.loading && hasGeminiKey ? (
              <button
                type="button"
                disabled={aiGenerating}
                onClick={handleGenerateAiExample}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/35 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 px-3 py-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-200 transition disabled:opacity-50"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Đang tạo ví dụ AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Tạo ví dụ nhanh bằng AI
                  </>
                )}
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0F172A]/90 px-3.5 py-2.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saved}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition active:scale-[0.98] ${
            saved
              ? 'border border-emerald-300 dark:border-emerald-500/45 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 cursor-default'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 text-white shadow-sm'
          }`}
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              <span>Đã lưu</span>
            </>
          ) : (
            <>
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              <span>Lưu vào Từ vựng của tôi</span>
            </>
          )}
        </button>

        {hasFullDetails && (
          <button
            type="button"
            onClick={handleOpenFullModal}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition shrink-0"
            title="Mở chi tiết đầy đủ (Word Family, Đồng nghĩa, Trái nghĩa)"
          >
            <span>Xem đầy đủ</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {popupNode && createPortal(popupNode, document.body)}
      <VocabQuickDetailModal
        target={fullModalTarget}
        onClose={() => setFullModalTarget(null)}
        onSelectAnotherWord={(next) => setFullModalTarget(next)}
      />
    </>
  );
};
