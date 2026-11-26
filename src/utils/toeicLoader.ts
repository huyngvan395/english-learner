import { ToeicDrillData, ToeicDrillMeta, ToeicTestData, ToeicTestMeta } from '../types';

let testsMetaCache: ToeicTestMeta[] | null = null;
let drillsMetaCache: ToeicDrillMeta[] | null = null;
const testCache = new Map<string, ToeicTestData>();
const drillCache = new Map<string, ToeicDrillData>();

export async function loadToeicTestsMeta(forceRefresh = false): Promise<ToeicTestMeta[]> {
  if (testsMetaCache && !forceRefresh) return testsMetaCache;
  const res = await fetch(`/data/toeic/tests-meta.json?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Không thể tải danh sách đề ETS (HTTP ${res.status})`);
  const data = (await res.json()) as ToeicTestMeta[];
  testsMetaCache = data;
  return data;
}

export async function loadToeicTest(testId: string): Promise<ToeicTestData> {
  const cached = testCache.get(testId);
  if (cached) return cached;
  const res = await fetch(`/data/toeic/tests/${encodeURIComponent(testId)}.json`);
  if (!res.ok) throw new Error(`Không thể tải bộ đề ${testId} (HTTP ${res.status})`);
  const data = (await res.json()) as ToeicTestData;
  testCache.set(testId, data);
  return data;
}

export async function loadToeicDrillsMeta(): Promise<ToeicDrillMeta[]> {
  if (drillsMetaCache) return drillsMetaCache;
  const res = await fetch('/data/toeic/drills-meta.json');
  if (!res.ok) throw new Error(`Không thể tải danh sách chuyên đề 7 Part (HTTP ${res.status})`);
  const data = (await res.json()) as ToeicDrillMeta[];
  drillsMetaCache = data;
  return data;
}

export async function loadToeicDrill(drillId: string): Promise<ToeicDrillData> {
  const cached = drillCache.get(drillId);
  if (cached) return cached;
  const res = await fetch(`/data/toeic/drills/${encodeURIComponent(drillId)}.json`);
  if (!res.ok) throw new Error(`Không thể tải chuyên đề ${drillId} (HTTP ${res.status})`);
  const data = (await res.json()) as ToeicDrillData;
  drillCache.set(drillId, data);
  return data;
}
