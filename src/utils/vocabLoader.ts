import { SearchIndexEntry, VocabDeck, VocabWord, WordPOS } from '../types';

export interface RelationDetailEntry {
  pos: WordPOS;
  ipaUs: string;
  ipaUk: string;
  meaningVi: string;
  definitionEn: string;
  definitionVi: string;
  exampleEn: string;
  exampleVi: string;
}

const deckCache = new Map<string, VocabDeck>();
const inFlightDecks = new Map<string, Promise<VocabDeck>>();

let searchIndexCache: SearchIndexEntry[] | null = null;
let searchIndexPromise: Promise<SearchIndexEntry[]> | null = null;

let relationDetailsCache: Record<string, RelationDetailEntry> | null = null;
let relationDetailsPromise: Promise<Record<string, RelationDetailEntry>> | null = null;

/**
 * Lazy-load a single deck's full JSON from /data/vocab/<deckId>.json
 * with in-memory RAM caching and deduplicated in-flight requests.
 */
export async function loadVocabDeck(deckId: string): Promise<VocabDeck> {
  const cached = deckCache.get(deckId);
  if (cached) return cached;

  const existingPromise = inFlightDecks.get(deckId);
  if (existingPromise) return existingPromise;

  const promise = fetch(`/data/vocab/${encodeURIComponent(deckId)}.json`)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Không thể tải bộ từ vựng "${deckId}" (HTTP ${res.status})`);
      }
      const data = (await res.json()) as VocabDeck;
      // Ensure words array is hydrated cleanly from topics if omitted in compact JSON
      if ((!data.words || data.words.length === 0) && Array.isArray(data.topics)) {
        data.words = data.topics.flatMap((t) => t.words);
      }
      deckCache.set(deckId, data);
      inFlightDecks.delete(deckId);
      return data;
    })
    .catch((err) => {
      inFlightDecks.delete(deckId);
      throw err;
    });

  inFlightDecks.set(deckId, promise);
  return promise;
}

export function getCachedDeck(deckId: string): VocabDeck | undefined {
  return deckCache.get(deckId);
}

export function getAllCachedWords(): VocabWord[] {
  const result: VocabWord[] = [];
  for (const deck of deckCache.values()) {
    result.push(...deck.words);
  }
  return result;
}

/**
 * Load lightweight search index (/data/vocab/search-index.json) for instant
 * Header Quick Dictionary across 10,000+ words without fetching full decks.
 */
export async function loadVocabSearchIndex(): Promise<SearchIndexEntry[]> {
  if (searchIndexCache) return searchIndexCache;
  if (searchIndexPromise) return searchIndexPromise;

  searchIndexPromise = fetch('/data/vocab/search-index.json')
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Không thể tải chỉ mục từ điển (HTTP ${res.status})`);
      }
      const rows = (await res.json()) as SearchIndexEntry[];
      searchIndexCache = rows;
      return rows;
    })
    .catch((err) => {
      searchIndexPromise = null;
      throw err;
    });

  return searchIndexPromise;
}

/**
 * Resolve a specific full VocabWord by lazy-loading its parent deck JSON.
 */
export async function loadFullWord(deckId: string, wordId: string): Promise<VocabWord | null> {
  const deck = await loadVocabDeck(deckId);
  return deck.words.find((w) => w.id === wordId) || null;
}

/**
 * Lazy-load /data/vocab/relation-details.json once and cache it in RAM.
 * Powers 0ms full details (IPA US/UK, EN/VI definition, bilingual example) for
 * 100% of SYN / ANT / Word Family terms outside the 16 main decks.
 */
export async function loadRelationDetails(): Promise<Record<string, RelationDetailEntry>> {
  if (relationDetailsCache) return relationDetailsCache;
  if (relationDetailsPromise) return relationDetailsPromise;

  relationDetailsPromise = fetch('/data/vocab/relation-details.json')
    .then(async (res) => {
      if (!res.ok) return {};
      const data = (await res.json()) as Record<string, RelationDetailEntry>;
      relationDetailsCache = data || {};
      return relationDetailsCache;
    })
    .catch(() => {
      relationDetailsPromise = null;
      return {};
    });

  return relationDetailsPromise;
}

export function getCachedRelationDetail(word: string): RelationDetailEntry | null {
  if (!relationDetailsCache) return null;
  return relationDetailsCache[word.trim().toLowerCase()] || null;
}

export async function lookupRelationDetail(word: string): Promise<RelationDetailEntry | null> {
  const key = word.trim().toLowerCase();
  if (!key) return null;
  const map = await loadRelationDetails();
  return map[key] || null;
}
