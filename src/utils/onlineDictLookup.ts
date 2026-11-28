import { WordPOS } from '../types';

export interface OnlineDictDetails {
  word: string;
  pos: WordPOS;
  ipaUS: string;
  ipaUK: string;
  meaningVi: string;
  definitionEn: string;
  definitionVi: string;
  exampleEn: string;
  exampleVi: string;
  audioUrlUS?: string;
  audioUrlUK?: string;
}

const VALID_POS = new Set<string>(['n', 'v', 'adj', 'adv', 'phrase']);

// Session-level RAM caches so repeated lookups never re-hit external APIs
const detailsCache = new Map<string, OnlineDictDetails>();
const inFlightRequests = new Map<string, Promise<OnlineDictDetails>>();

export function normalizeWordPos(raw?: string, fallback: WordPOS = 'n'): WordPOS {
  const s = (raw || '').toLowerCase().trim();
  if (VALID_POS.has(s)) return s as WordPOS;
  if (s.includes('verb') && !s.includes('adverb')) return 'v';
  if (s.includes('adverb') || s === 'adv') return 'adv';
  if (s.includes('adj')) return 'adj';
  if (s.includes('phrase') || s.includes('idiom')) return 'phrase';
  return fallback;
}

function normCmp(s?: string): string {
  return (s || '').trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase();
}

export async function translateEnToViFast(text: string): Promise<string> {
  const cleaned = text.trim();
  if (!cleaned) return '';

  // Primary: fast Google Translate gtx endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(
      cleaned
    )}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.[0])) {
        const joined = data[0]
          .map((seg: unknown[]) => (typeof seg?.[0] === 'string' ? seg[0] : ''))
          .join('')
          .trim();
        if (joined && normCmp(joined) !== normCmp(cleaned)) {
          return joined;
        }
      }
    }
  } catch {
    // Fall through to MyMemory
  }

  // Fallback: MyMemory free translation API
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=en|vi`
    );
    if (res.ok) {
      const data = await res.json();
      const tr = data?.responseData?.translatedText;
      if (typeof tr === 'string' && tr.trim() && normCmp(tr) !== normCmp(cleaned)) {
        return tr.trim();
      }
    }
  } catch {
    // Graceful offline fallback
  }

  return '';
}

export function getCachedOnlineDictDetails(word: string, preferredPos?: string): OnlineDictDetails | null {
  const key = `${word.trim().toLowerCase()}|${preferredPos ? normalizeWordPos(preferredPos) : ''}`;
  return detailsCache.get(key) || detailsCache.get(`${word.trim().toLowerCase()}|`) || null;
}

/**
 * Fetch IPA (US/UK), POS-aware English definition, example sentence, and audio from
 * `dictionaryapi.dev` + fast Vietnamese translations for meaning, definition, and example.
 * Results are cached in a session-level `Map` with in-flight request deduplication.
 */
export async function fetchOnlineDictDetails(
  term: string,
  preferredPos?: string
): Promise<OnlineDictDetails> {
  const cleanTerm = term.trim();
  const normalizedPos = preferredPos ? normalizeWordPos(preferredPos) : '';
  const cacheKey = `${cleanTerm.toLowerCase()}|${normalizedPos}`;

  const cached = detailsCache.get(cacheKey);
  if (cached) return cached;

  const existing = inFlightRequests.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<OnlineDictDetails> => {
    const isSingleWord = !cleanTerm.includes(' ');
    const dictPromise = isSingleWord
      ? fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanTerm.toLowerCase())}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null);

    const meaningQuery = normalizedPos === 'v' && isSingleWord ? `to ${cleanTerm}` : cleanTerm;
    const [dictJson, rawMeaningVi] = await Promise.all([
      dictPromise,
      translateEnToViFast(meaningQuery),
    ]);

    let ipaUS = '';
    let ipaUK = '';
    let audioUrlUS: string | undefined;
    let audioUrlUK: string | undefined;
    let pos: WordPOS = normalizedPos
      ? (normalizedPos as WordPOS)
      : isSingleWord
      ? 'n'
      : 'phrase';
    let definitionEn = '';
    let exampleEn = '';

    if (Array.isArray(dictJson) && dictJson[0]) {
      // Collect phonetics across all returned dictionary entries
      for (const entry of dictJson) {
        if (Array.isArray(entry?.phonetics)) {
          for (const ph of entry.phonetics) {
            const audio = typeof ph?.audio === 'string' ? ph.audio.trim() : '';
            const text = typeof ph?.text === 'string' ? ph.text.trim() : '';
            if (audio.includes('-us.') || audio.includes('/us/')) {
              if (!audioUrlUS) audioUrlUS = audio;
              if (text && !ipaUS) ipaUS = text;
            } else if (audio.includes('-uk.') || audio.includes('/uk/')) {
              if (!audioUrlUK) audioUrlUK = audio;
              if (text && !ipaUK) ipaUK = text;
            } else {
              if (audio && !audioUrlUS) audioUrlUS = audio;
              if (text && !ipaUS) ipaUS = text;
            }
          }
        }
        if (!ipaUS && typeof entry?.phonetic === 'string' && entry.phonetic.trim()) {
          ipaUS = entry.phonetic.trim();
        }
      }
      if (!ipaUK) ipaUK = ipaUS;
      if (!ipaUS) ipaUS = ipaUK;

      // Pick the best meaning block (prefer matching POS if provided)
      const allMeanings: Array<{
        partOfSpeech?: string;
        definitions?: Array<{ definition?: string; example?: string }>;
      }> = [];
      for (const entry of dictJson) {
        if (Array.isArray(entry?.meanings)) {
          allMeanings.push(...entry.meanings);
        }
      }

      const preferredMeaning =
        (normalizedPos
          ? allMeanings.find((m) => normalizeWordPos(m.partOfSpeech) === normalizedPos)
          : undefined) || allMeanings[0];

      if (preferredMeaning) {
        pos = normalizeWordPos(preferredMeaning.partOfSpeech, pos);
        const defs = Array.isArray(preferredMeaning.definitions) ? preferredMeaning.definitions : [];
        if (defs[0]?.definition) {
          definitionEn = defs[0].definition.trim();
        }
        // Prefer the first definition that includes a real example sentence
        const withExample = defs.find((d) => typeof d?.example === 'string' && d.example.trim());
        if (withExample?.example) {
          exampleEn = withExample.example.trim();
        }
      }

      // If preferred POS block had no example, scan other meanings for a valid example
      if (!exampleEn) {
        for (const m of allMeanings) {
          const defs = Array.isArray(m.definitions) ? m.definitions : [];
          const hit = defs.find((d) => typeof d?.example === 'string' && d.example.trim());
          if (hit?.example) {
            exampleEn = hit.example.trim();
            break;
          }
        }
      }
    }

    // Translate English definition & example in parallel
    const [definitionVi, exampleVi] = await Promise.all([
      definitionEn ? translateEnToViFast(definitionEn) : Promise.resolve(''),
      exampleEn ? translateEnToViFast(exampleEn) : Promise.resolve(''),
    ]);

    const result: OnlineDictDetails = {
      word: cleanTerm,
      pos,
      ipaUS,
      ipaUK,
      meaningVi: rawMeaningVi || '',
      definitionEn,
      definitionVi: normCmp(definitionVi) !== normCmp(definitionEn) ? definitionVi : '',
      exampleEn,
      exampleVi: normCmp(exampleVi) !== normCmp(exampleEn) ? exampleVi : '',
      audioUrlUS,
      audioUrlUK,
    };

    detailsCache.set(cacheKey, result);
    if (!detailsCache.has(`${cleanTerm.toLowerCase()}|`)) {
      detailsCache.set(`${cleanTerm.toLowerCase()}|`, result);
    }
    return result;
  })();

  inFlightRequests.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}
