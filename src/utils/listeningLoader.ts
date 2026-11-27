import {
  ListeningMeta,
  ListeningPart1Question,
  ListeningPart2Question,
  ListeningPart3Set,
  ListeningPart4Set,
} from '../types';

let listeningMetaCache: ListeningMeta | null = null;
const part1BatchCache = new Map<string, ListeningPart1Question[]>();
const part2BatchCache = new Map<string, ListeningPart2Question[]>();
const part3BatchCache = new Map<string, ListeningPart3Set[]>();
const part4BatchCache = new Map<string, ListeningPart4Set[]>();

export async function loadListeningMeta(forceRefresh = false): Promise<ListeningMeta> {
  if (listeningMetaCache && !forceRefresh) return listeningMetaCache;
  const res = await fetch(`/data/listening/listening-meta.json?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải chỉ mục TOEIC Listening (HTTP ${res.status})`);
  }
  const data = (await res.json()) as ListeningMeta;
  listeningMetaCache = data;
  return data;
}

export async function loadListeningPart1Batch(file: string): Promise<ListeningPart1Question[]> {
  const cached = part1BatchCache.get(file);
  if (cached) return cached;
  const res = await fetch(`/data/listening/${encodeURIComponent(file)}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu Listening Part 1 (${file}, HTTP ${res.status})`);
  }
  const data = (await res.json()) as ListeningPart1Question[];
  part1BatchCache.set(file, data);
  return data;
}

export async function loadListeningPart1All(meta?: ListeningMeta): Promise<ListeningPart1Question[]> {
  const m = meta || (await loadListeningMeta());
  const nonEmpty = m.part1.batches.filter((b) => b.count > 0);
  const batches = await Promise.all(nonEmpty.map((b) => loadListeningPart1Batch(b.file)));
  return batches.flat();
}

export async function loadListeningPart2Batch(file: string): Promise<ListeningPart2Question[]> {
  const cached = part2BatchCache.get(file);
  if (cached) return cached;
  const res = await fetch(`/data/listening/${encodeURIComponent(file)}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu Listening Part 2 (${file}, HTTP ${res.status})`);
  }
  const data = (await res.json()) as ListeningPart2Question[];
  part2BatchCache.set(file, data);
  return data;
}

export async function loadListeningPart2All(meta?: ListeningMeta): Promise<ListeningPart2Question[]> {
  const m = meta || (await loadListeningMeta());
  const nonEmpty = m.part2.batches.filter((b) => b.count > 0);
  const batches = await Promise.all(nonEmpty.map((b) => loadListeningPart2Batch(b.file)));
  return batches.flat();
}

export async function loadListeningPart3Batch(file: string): Promise<ListeningPart3Set[]> {
  const cached = part3BatchCache.get(file);
  if (cached) return cached;
  const res = await fetch(`/data/listening/${encodeURIComponent(file)}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu Listening Part 3 (${file}, HTTP ${res.status})`);
  }
  const data = (await res.json()) as ListeningPart3Set[];
  part3BatchCache.set(file, data);
  return data;
}

export async function loadListeningPart3All(meta?: ListeningMeta): Promise<ListeningPart3Set[]> {
  const m = meta || (await loadListeningMeta());
  const nonEmpty = m.part3.batches.filter((b) => b.setCount > 0);
  const batches = await Promise.all(nonEmpty.map((b) => loadListeningPart3Batch(b.file)));
  return batches.flat();
}

export async function loadListeningPart4Batch(file: string): Promise<ListeningPart4Set[]> {
  const cached = part4BatchCache.get(file);
  if (cached) return cached;
  const res = await fetch(`/data/listening/${encodeURIComponent(file)}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu Listening Part 4 (${file}, HTTP ${res.status})`);
  }
  const data = (await res.json()) as ListeningPart4Set[];
  part4BatchCache.set(file, data);
  return data;
}

export async function loadListeningPart4All(meta?: ListeningMeta): Promise<ListeningPart4Set[]> {
  const m = meta || (await loadListeningMeta());
  const nonEmpty = m.part4.batches.filter((b) => b.setCount > 0);
  const batches = await Promise.all(nonEmpty.map((b) => loadListeningPart4Batch(b.file)));
  return batches.flat();
}
