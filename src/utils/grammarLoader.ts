import { GrammarCatalogItem, GrammarTopicDetail } from '../types';

let catalogCache: GrammarCatalogItem[] | null = null;
const topicCache = new Map<string, GrammarTopicDetail>();

export async function loadGrammarCatalog(): Promise<GrammarCatalogItem[]> {
  if (catalogCache) return catalogCache;
  const res = await fetch('/data/grammar/catalog.json');
  if (!res.ok) throw new Error('Không thể tải danh mục Ngữ pháp TOEIC.');
  const data = (await res.json()) as GrammarCatalogItem[];
  catalogCache = data;
  return data;
}

export async function loadGrammarTopic(topicId: string): Promise<GrammarTopicDetail> {
  const cached = topicCache.get(topicId);
  if (cached) return cached;
  const res = await fetch(`/data/grammar/topics/${encodeURIComponent(topicId)}.json`);
  if (!res.ok) throw new Error(`Không tìm thấy chuyên đề ngữ pháp "${topicId}".`);
  const data = (await res.json()) as GrammarTopicDetail;
  topicCache.set(topicId, data);
  return data;
}
