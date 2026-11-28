import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookmarkCheck,
  BookOpen,
  Check,
  Loader2,
  Sparkles,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import { SearchIndexEntry, VocabExample, VocabWord } from '../types';
import { useApp } from '../context/AppContext';
import {
  getCachedRelationDetail,
  loadFullWord,
  lookupRelationDetail,
  RelationDetailEntry,
} from '../utils/vocabLoader';
import { playWordAudio, speakText } from '../utils/speech';
import {
  fetchOnlineDictDetails,
  generateAiBilingualExample,
  getCachedOnlineDictDetails,
  normalizeWordPos,
  OnlineDictDetails,
} from '../utils/onlineDictLookup';
import { getEffectiveGeminiKey } from '../utils/geminiWritingService';

const CUSTOM_DECK_IDS = new Set(['listening-saved', 'writing-saved', 'reading-saved', 'vocab-saved']);

export interface QuickWordTarget {
  word: string;
  relationType?: 'synonym' | 'antonym' | 'word-family';
  pos?: string;
  fallbackMeaning?: string;
}

interface VocabQuickDetailModalProps {
  target: QuickWordTarget | null;
  onClose: () => void;
  onSelectAnotherWord?: (next: QuickWordTarget) => void;
}

const POS_VI_LABEL: Record<string, string> = {
  n: 'Danh từ (n)',
  v: 'Động từ (v)',
  adj: 'Tính từ (adj)',
  adv: 'Trạng từ (adv)',
  phrase: 'Cụm từ',
};

const RELATION_BADGE: Record<
  NonNullable<QuickWordTarget['relationType']>,
  { label: string; cls: string }
> = {
  synonym: {
    label: 'Từ đồng nghĩa (SYN)',
    cls: 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-500/15 dark:text-cyan-300',
  },
  antonym: {
    label: 'Từ trái nghĩa (ANT)',
    cls: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-300',
  },
  'word-family': {
    label: 'Từ vựng gia đình (Word Family)',
    cls: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-300',
  },
};

export const VocabQuickDetailModal: React.FC<VocabQuickDetailModalProps> = ({
  target,
  onClose,
  onSelectAnotherWord,
}) => {
  const { searchIndex, customWords, saveRelatedVocab, isVocabTextSaved } = useApp();
  const [fullWord, setFullWord] = useState<VocabWord | null>(null);
  const [relationDetail, setRelationDetail] = useState<RelationDetailEntry | null>(null);
  const [onlineDetails, setOnlineDetails] = useState<OnlineDictDetails | null>(null);
  const [aiExample, setAiExample] = useState<{ en: string; vi: string } | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Layer 1: Best-matching entry in our 16 standard decks (prefer exact (word, pos) match, skip sparse custom entries)
  const matchedEntry: SearchIndexEntry | null = useMemo(() => {
    if (!target) return null;
    const key = target.word.trim().toLowerCase();
    if (!key) return null;
    const targetPos = target.pos ? normalizeWordPos(target.pos) : null;
    const standardRows = searchIndex.filter((r) => !CUSTOM_DECK_IDS.has(r.deckId));
    if (targetPos) {
      const exactPosMatch = standardRows.find(
        (r) => r.word.toLowerCase() === key && r.partOfSpeech === targetPos
      );
      if (exactPosMatch) return exactPosMatch;
    }
    return standardRows.find((r) => r.word.toLowerCase() === key) || null;
  }, [target, searchIndex]);

  // Close cleanly on Escape key without disrupting underlying study card
  useEffect(() => {
    if (!target) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [target, onClose]);

  // 3-Layer Hydration:
  // Layer 1: Full card from 16 main decks -> Layer 2: /data/vocab/relation-details.json -> Layer 3: dictionaryapi.dev + VI
  useEffect(() => {
    if (!target) {
      setFullWord(null);
      setRelationDetail(null);
      setOnlineDetails(null);
      setAiExample(null);
      setAiError(null);
      setLoading(false);
      return;
    }

    const key = target.word.trim().toLowerCase();
    const customMatch = customWords.find((w) => w.word.toLowerCase() === key) || null;
    const cachedRel = getCachedRelationDetail(target.word);
    const cachedOnline = getCachedOnlineDictDetails(target.word, target.pos);
    let cancelled = false;

    setAiExample(null);
    setAiError(null);
    setRelationDetail(cachedRel);
    setOnlineDetails(cachedOnline);

    const hasCompleteCore = (
      fw: VocabWord | null,
      rel: RelationDetailEntry | null
    ): boolean => {
      const hasIpa = Boolean(
        (fw?.ipaUS && fw.ipaUS.trim() && fw.ipaUS.trim() !== '/.../') ||
          (rel?.ipaUs && rel.ipaUs.trim())
      );
      const hasDef = Boolean(fw?.definitionEn?.trim() || rel?.definitionEn?.trim());
      const hasEx = Boolean(fw?.examples?.[0]?.en?.trim() || rel?.exampleEn?.trim());
      return hasIpa && hasDef && hasEx;
    };

    const hydrateLayers2And3 = async (baseWord: VocabWord | null) => {
      if (hasCompleteCore(baseWord, cachedRel)) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Layer 2: Lazy-load /data/vocab/relation-details.json (RAM-cached after 1st load -> 0ms!)
      let resolvedRel = cachedRel;
      if (!resolvedRel) {
        resolvedRel = await lookupRelationDetail(target.word);
        if (cancelled) return;
        if (resolvedRel) {
          setRelationDetail(resolvedRel);
        }
      }

      if (hasCompleteCore(baseWord, resolvedRel)) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Layer 3: Online fallback (dictionaryapi.dev + fast Vietnamese gloss)
      if (cachedOnline) {
        if (!cancelled) {
          setOnlineDetails(cachedOnline);
          setLoading(false);
        }
        return;
      }

      try {
        const fetched = await fetchOnlineDictDetails(
          target.word,
          target.pos || resolvedRel?.pos || baseWord?.pos
        );
        if (!cancelled) setOnlineDetails(fetched);
      } catch {
        // Graceful fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!matchedEntry) {
      setFullWord(customMatch);
      const alreadyReady = hasCompleteCore(customMatch, cachedRel);
      setLoading(!alreadyReady);
      void hydrateLayers2And3(customMatch);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setFullWord(null);
    loadFullWord(matchedEntry.deckId, matchedEntry.id)
      .then((word) => {
        if (cancelled) return;
        const resolved = word || customMatch;
        setFullWord(resolved);
        return hydrateLayers2And3(resolved);
      })
      .catch(() => {
        if (cancelled) return;
        setFullWord(customMatch);
        return hydrateLayers2And3(customMatch);
      });

    return () => {
      cancelled = true;
    };
  }, [target, matchedEntry, customWords]);

  if (!target) return null;

  const displayWord = fullWord?.word || matchedEntry?.word || target.word;
  const displayPos =
    fullWord?.pos ||
    matchedEntry?.partOfSpeech ||
    relationDetail?.pos ||
    (target.pos ? normalizeWordPos(target.pos) : undefined) ||
    onlineDetails?.pos ||
    'n';
  const displayIpaUS =
    (fullWord?.ipaUS && fullWord.ipaUS !== '/.../' ? fullWord.ipaUS : '') ||
    (matchedEntry?.ipaUS && matchedEntry.ipaUS !== '/.../' ? matchedEntry.ipaUS : '') ||
    relationDetail?.ipaUs ||
    onlineDetails?.ipaUS ||
    '';
  const displayIpaUK =
    (fullWord?.ipaUK && fullWord.ipaUK !== '/.../' ? fullWord.ipaUK : '') ||
    relationDetail?.ipaUk ||
    onlineDetails?.ipaUK ||
    '';

  const rawMeaning =
    fullWord?.meaning ||
    matchedEntry?.meaningVi ||
    relationDetail?.meaningVi ||
    target.fallbackMeaning ||
    onlineDetails?.meaningVi ||
    'Từ vựng mở rộng TOEIC';
  const displayMeaning = rawMeaning.replace(/^\[[^\]]+\]\s*/, '').trim();

  const mergedDefEn =
    fullWord?.definitionEn?.trim() ||
    relationDetail?.definitionEn?.trim() ||
    onlineDetails?.definitionEn ||
    '';
  const mergedDefVi =
    fullWord?.definitionVi?.trim() ||
    relationDetail?.definitionVi?.trim() ||
    onlineDetails?.definitionVi ||
    '';

  const mergedExamples: VocabExample[] =
    fullWord && fullWord.examples.length > 0 && fullWord.examples[0]?.en?.trim()
      ? fullWord.examples
      : relationDetail?.exampleEn?.trim()
      ? [{ en: relationDetail.exampleEn, vi: relationDetail.exampleVi || '' }]
      : onlineDetails?.exampleEn
      ? [{ en: onlineDetails.exampleEn, vi: onlineDetails.exampleVi || '' }]
      : aiExample
      ? [aiExample]
      : [];

  const audioUrlUS = fullWord?.audioUrlUS || onlineDetails?.audioUrlUS;
  const audioUrlUK = fullWord?.audioUrlUK || onlineDetails?.audioUrlUK || audioUrlUS;
  const hasGeminiKey = Boolean(getEffectiveGeminiKey().key);

  const handleGenerateAiExample = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const res = await generateAiBilingualExample({
        word: displayWord,
        pos: displayPos,
        meaningVi: displayMeaning,
        definitionEn: mergedDefEn,
      });
      if (res) {
        setAiExample(res);
      } else {
        setAiError('Không tạo được ví dụ lúc này. Hãy thử lại sau.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Lỗi kết nối Gemini AI.');
    } finally {
      setAiGenerating(false);
    }
  };

  // Safety net: never render duplicate English line if definitionVi === definitionEn or ex.vi === ex.en
  const normCmp = (s?: string) => (s || '').trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase();
  const hasDistinctDefVi = Boolean(
    mergedDefVi && normCmp(mergedDefVi) !== normCmp(mergedDefEn)
  );

  const saved = isVocabTextSaved(displayWord);
  const relBadge = target.relationType ? RELATION_BADGE[target.relationType] : null;

  const handleSave = () => {
    saveRelatedVocab({
      id: fullWord?.id || matchedEntry?.id,
      deckId: fullWord?.deckId || matchedEntry?.deckId,
      word: displayWord,
      pos: normalizeWordPos(displayPos),
      ipaUS: displayIpaUS,
      ipaUK: displayIpaUK || displayIpaUS,
      meaning: displayMeaning,
      definitionEn: mergedDefEn,
      definitionVi: hasDistinctDefVi ? mergedDefVi : '',
      examples: mergedExamples,
    });
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 animate-fade-up"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết từ ${displayWord}`}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[85dvh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131C31] shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0F172A]/85 px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {relBadge && (
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${relBadge.cls}`}>
                  {relBadge.label}
                </span>
              )}
              <span className="rounded-md border border-slate-200 dark:border-indigo-400/30 bg-white dark:bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-indigo-200">
                {POS_VI_LABEL[displayPos] || displayPos}
              </span>
              {matchedEntry ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  <BookOpen className="h-3 w-3" />
                  Trong kho từ vựng chính
                </span>
              ) : relationDetail ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                  <BookOpen className="h-3 w-3" />
                  Kho từ mở rộng
                </span>
              ) : null}
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white break-words">
              {displayWord}
            </h3>

            {/* Pronunciation Buttons (US & UK) */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() =>
                  playWordAudio(displayWord, {
                    accent: 'en-US',
                    audioUrl: audioUrlUS,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 dark:border-cyan-500/35 bg-cyan-50 dark:bg-slate-800/90 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-800 dark:text-cyan-200 transition active:scale-95"
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
                  playWordAudio(displayWord, {
                    accent: 'en-GB',
                    audioUrl: audioUrlUK,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-slate-800/90 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-200 transition active:scale-95"
                title="Nghe phát âm giọng Anh (UK)"
              >
                <Volume2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>UK</span>
                {displayIpaUK && (
                  <span className="font-mono font-normal text-slate-600 dark:text-slate-300">
                    {displayIpaUK}
                  </span>
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ chi tiết"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Vietnamese Meaning Box */}
          <div className="rounded-2xl border border-indigo-200/80 dark:border-slate-700/80 bg-indigo-50/60 dark:bg-[#1E293B]/70 p-4 space-y-1.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              Nghĩa tiếng Việt
            </p>
            <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-sky-200 leading-snug">
              {displayMeaning}
            </p>
            {mergedDefEn && (
              <p className="pt-1 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                <span className="font-bold text-slate-500 dark:text-slate-400 mr-1">EN:</span>
                {mergedDefEn}
              </p>
            )}
            {hasDistinctDefVi && mergedDefVi && (
              <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed">
                {mergedDefVi}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500 dark:text-indigo-400" />
              Đang tải phiên âm, định nghĩa &amp; ví dụ song ngữ...
            </div>
          ) : (
            <>
              {/* Bilingual Examples */}
              {mergedExamples.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ví dụ song ngữ
                  </p>
                  {mergedExamples.slice(0, 2).map((ex, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-3.5 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                          {ex.en}
                        </p>
                        <button
                          type="button"
                          onClick={() => speakText(ex.en, { accent: 'en-US', rate: 0.96 })}
                          className="shrink-0 rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-indigo-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-cyan-300 transition"
                          title="Nghe câu ví dụ"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      </div>
                      {ex.vi && normCmp(ex.vi) !== normCmp(ex.en) && (
                        <p className="text-xs italic text-slate-600 dark:text-slate-400 leading-relaxed">
                          {ex.vi}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : hasGeminiKey ? (
                <div className="rounded-xl border border-dashed border-indigo-300 dark:border-indigo-500/35 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Từ này chưa có câu ví dụ từ từ điển trực tuyến.
                  </p>
                  <button
                    type="button"
                    disabled={aiGenerating}
                    onClick={handleGenerateAiExample}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 disabled:opacity-50 px-3 py-1.5 text-xs font-bold text-white shadow-sm shrink-0 transition"
                  >
                    {aiGenerating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Đang tạo...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Tạo ví dụ nhanh bằng AI
                      </>
                    )}
                  </button>
                  {aiError && <p className="text-[11px] text-rose-600 dark:text-rose-300">{aiError}</p>}
                </div>
              ) : null}

              {/* Related Terms (compact clickable chips inside modal) */}
              {fullWord &&
                (fullWord.synonyms.length > 0 ||
                  fullWord.antonyms.length > 0 ||
                  fullWord.collocations.length > 0) && (
                  <div className="space-y-2.5">
                    {fullWord.synonyms.length > 0 && (
                      <div className="rounded-xl border border-cyan-200/80 dark:border-cyan-500/25 bg-cyan-50/50 dark:bg-cyan-950/20 p-3 space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                          Đồng nghĩa liên quan ({fullWord.synonyms.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {fullWord.synonyms.slice(0, 6).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                if (onSelectAnotherWord) {
                                  onSelectAnotherWord({
                                    word: s,
                                    relationType: 'synonym',
                                    fallbackMeaning: fullWord.relationMeanings?.[s.toLowerCase()],
                                  });
                                } else {
                                  speakText(s, { accent: 'en-US' });
                                }
                              }}
                              className="rounded-lg border border-cyan-300/80 dark:border-cyan-500/35 bg-white dark:bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:text-cyan-200 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 transition"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {fullWord.antonyms.length > 0 && (
                      <div className="rounded-xl border border-rose-200/80 dark:border-rose-500/25 bg-rose-50/50 dark:bg-rose-950/20 p-3 space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                          Trái nghĩa liên quan ({fullWord.antonyms.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {fullWord.antonyms.slice(0, 6).map((a) => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => {
                                if (onSelectAnotherWord) {
                                  onSelectAnotherWord({
                                    word: a,
                                    relationType: 'antonym',
                                    fallbackMeaning: fullWord.relationMeanings?.[a.toLowerCase()],
                                  });
                                } else {
                                  speakText(a, { accent: 'en-US' });
                                }
                              }}
                              className="rounded-lg border border-rose-300/80 dark:border-rose-500/35 bg-white dark:bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-500/25 transition"
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {fullWord.collocations.length > 0 && (
                      <div className="rounded-xl border border-violet-200/80 dark:border-violet-500/25 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-1">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                          Collocations TOEIC
                        </p>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                          {fullWord.collocations.slice(0, 3).map((c, idx) => (
                            <li key={idx}>
                              <b className="text-violet-800 dark:text-violet-200">{c.phrase}</b>
                              <span className="text-slate-600 dark:text-slate-400"> — {c.meaning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
            </>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0F172A]/85 px-5 py-3.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saved}
            className={`inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-extrabold transition active:scale-[0.98] ${
              saved
                ? 'border border-emerald-300 dark:border-emerald-500/45 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 cursor-default'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 text-white shadow-sm'
            }`}
          >
            {saved ? (
              <>
                <Check className="h-4 w-4 stroke-[3]" />
                <span>Đã lưu vào Từ vựng của tôi</span>
              </>
            ) : (
              <>
                <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                <span>Lưu vào Từ vựng của tôi</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 transition"
          >
            <BookmarkCheck className="h-3.5 w-3.5 hidden" />
            Đóng (Esc)
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
