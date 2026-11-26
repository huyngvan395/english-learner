import { WritingMeta, WritingMode, WritingPromptItem } from '../types';

let writingMetaCache: WritingMeta | null = null;
const writingBatchCache = new Map<string, WritingPromptItem[]>();

export async function loadWritingMeta(forceRefresh = false): Promise<WritingMeta> {
  if (writingMetaCache && !forceRefresh) return writingMetaCache;
  const res = await fetch(`/data/writing/writing-meta.json?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải chỉ mục AI Writing Studio (HTTP ${res.status})`);
  }
  const data = (await res.json()) as WritingMeta;
  writingMetaCache = data;
  return data;
}

export async function loadWritingBatch(file: string): Promise<WritingPromptItem[]> {
  const cached = writingBatchCache.get(file);
  if (cached) return cached;
  const res = await fetch(`/data/writing/${encodeURIComponent(file)}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu luyện viết (${file}, HTTP ${res.status})`);
  }
  const data = (await res.json()) as WritingPromptItem[];
  writingBatchCache.set(file, data);
  return data;
}

export async function loadWritingPromptsByMode(
  mode: Exclude<WritingMode, 'custom'>,
  meta?: WritingMeta
): Promise<WritingPromptItem[]> {
  const m = meta || (await loadWritingMeta());
  const targetBatches = m.batches.filter((b) => b.mode === mode);
  const loaded = await Promise.all(targetBatches.map((b) => loadWritingBatch(b.file)));
  return loaded.flat();
}
