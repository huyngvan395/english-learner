import {
  ReadingMeta,
  ReadingPart5Question,
  ReadingPart6Passage,
  ReadingPart7Set,
} from '../types';

let readingMetaCache: ReadingMeta | null = null;
const part5BatchCache = new Map<string, ReadingPart5Question[]>();
const part6BatchCache = new Map<string, ReadingPart6Passage[]>();
const part7BatchCache = new Map<string, ReadingPart7Set[]>();

export async function loadReadingMeta(forceRefresh = false): Promise<ReadingMeta> {
  if (readingMetaCache && !forceRefresh) return readingMetaCache;
  const res = await fetch(`/data/reading/reading-meta.json?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải chỉ mục TOEIC Reading (HTTP ${res.status})`);
  }
  const data = (await res.json()) as ReadingMeta;
  readingMetaCache = data;
  return data;
}

export async function loadPart5Batch(file: string): Promise<ReadingPart5Question[]> {
  const cached = part5BatchCache.get(file);
  if (cached) return cached;
  const res = await fetch(`/data/reading/${encodeURIComponent(file)}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu Part 5 (${file}, HTTP ${res.status})`);
  }
  const data = (await res.json()) as ReadingPart5Question[];
  part5BatchCache.set(file, data);
  return data;
}

export async function loadPart5All(meta?: ReadingMeta): Promise<ReadingPart5Question[]> {
  const m = meta || (await loadReadingMeta());
  const batches = await Promise.all(m.part5.batches.map((b) => loadPart5Batch(b.file)));
  return batches.flat();
}

export async function loadPart6Batch(file: string): Promise<ReadingPart6Passage[]> {
  const cached = part6BatchCache.get(file);
  if (cached) return cached;
  const res = await fetch(`/data/reading/${encodeURIComponent(file)}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu Part 6 (${file}, HTTP ${res.status})`);
  }
  const data = (await res.json()) as ReadingPart6Passage[];
  part6BatchCache.set(file, data);
  return data;
}

export async function loadPart6All(meta?: ReadingMeta): Promise<ReadingPart6Passage[]> {
  const m = meta || (await loadReadingMeta());
  const batches = await Promise.all(m.part6.batches.map((b) => loadPart6Batch(b.file)));
  return batches.flat();
}

export async function loadPart7Batch(file: string): Promise<ReadingPart7Set[]> {
  const cached = part7BatchCache.get(file);
  if (cached) return cached;
  const res = await fetch(`/data/reading/${encodeURIComponent(file)}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu Part 7 (${file}, HTTP ${res.status})`);
  }
  const data = (await res.json()) as ReadingPart7Set[];
  part7BatchCache.set(file, data);
  return data;
}

export async function loadPart7ByType(
  passageCountType: 'all' | 'single' | 'double' | 'triple',
  meta?: ReadingMeta
): Promise<ReadingPart7Set[]> {
  const m = meta || (await loadReadingMeta());
  const targetBatches =
    passageCountType === 'all'
      ? m.part7.batches
      : m.part7.batches.filter((b) => b.passageCountType === passageCountType);
  const batches = await Promise.all(targetBatches.map((b) => loadPart7Batch(b.file)));
  return batches.flat();
}
