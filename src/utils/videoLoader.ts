import {
  VideoCatalogItem,
  VideoChannelMeta,
  VideoDetailItem,
  VideoQuizItem,
  VideoSentence,
} from '../types';

let catalogCache: VideoCatalogItem[] | null = null;
let channelsCache: VideoChannelMeta[] | null = null;
const detailCache = new Map<string, VideoDetailItem>();

export async function loadVideoCatalog(): Promise<VideoCatalogItem[]> {
  if (catalogCache) return catalogCache;
  const res = await fetch('/data/videos/catalog.json');
  if (!res.ok) throw new Error('Không thể tải danh sách video luyện tập.');
  const data = (await res.json()) as VideoCatalogItem[];
  catalogCache = data;
  return data;
}

export async function loadVideoChannels(): Promise<VideoChannelMeta[]> {
  if (channelsCache) return channelsCache;
  const res = await fetch('/data/videos/channels.json');
  if (!res.ok) throw new Error('Không thể tải danh sách kênh YouTube.');
  const data = (await res.json()) as VideoChannelMeta[];
  channelsCache = data;
  return data;
}

export async function loadVideoDetail(
  videoId: string,
  customVideos: VideoDetailItem[] = []
): Promise<VideoDetailItem> {
  const customHit = customVideos.find((v) => v.id === videoId || v.youtubeId === videoId);
  if (customHit) return customHit;

  const cached = detailCache.get(videoId);
  if (cached) return cached;

  const res = await fetch(`/data/videos/items/${encodeURIComponent(videoId)}.json`);
  if (!res.ok) throw new Error(`Không tìm thấy dữ liệu bài học video (${videoId}).`);
  const data = (await res.json()) as VideoDetailItem;
  detailCache.set(videoId, data);
  return data;
}

export function formatVideoDuration(sec: number): string {
  const safe = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function extractYouTubeId(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pat of patterns) {
    const m = trimmed.match(pat);
    if (m && m[1]) return m[1];
  }
  return null;
}

function parseTimestampSec(raw: string): number {
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/**
 * Parses SRT, WebVTT, `[mm:ss] text`, or plain text transcripts into timed VideoSentence[].
 * Supports optional `English line | Vietnamese line` bilingual syntax.
 */
export function parseSubtitleInput(rawText: string, estimatedDurationSec = 180): VideoSentence[] {
  const normalized = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  // 1. Detect SRT / VTT blocks containing `-->`
  if (normalized.includes('-->')) {
    const blocks = normalized
      .replace(/^WEBVTT[^\n]*\n+/i, '')
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean);

    const out: VideoSentence[] = [];
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const timeIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeIdx === -1) continue;
      const [rawStart, rawEnd] = lines[timeIdx].split('-->').map((s) => s.trim().split(' ')[0]);
      const start = Math.max(0, parseTimestampSec(rawStart));
      const end = Math.max(start + 1, parseTimestampSec(rawEnd));
      const content = lines
        .slice(timeIdx + 1)
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!content) continue;
      const [enPart, viPart] = content.split('|').map((s) => s.trim());
      const wc = (enPart.match(/[A-Za-z0-9']+/g) || []).length;
      if (wc < 1) continue;
      out.push({
        index: out.length,
        start: Number(start.toFixed(2)),
        end: Number(end.toFixed(2)),
        textEn: enPart,
        textVi: viPart || 'Bản dịch tự chọn — bôi đen từ để tra cứu nhanh.',
        wordCount: wc,
      });
    }
    if (out.length > 0) return out;
  }

  // 2. Detect timestamp-prefixed lines like `0:12 Hello...` or `[00:12] Hello...`
  const rawLines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const tsLineRegex = /^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)\]?\s*[-–]?\s*(.+)$/;
  const tsMatches = rawLines.filter((l) => tsLineRegex.test(l));

  if (tsMatches.length >= Math.max(2, Math.floor(rawLines.length * 0.5))) {
    const temp: { start: number; textEn: string; textVi: string }[] = [];
    for (const line of rawLines) {
      const m = line.match(tsLineRegex);
      if (!m) continue;
      const start = parseTimestampSec(m[1]);
      const [enPart, viPart] = m[2].split('|').map((s) => s.trim());
      if (!enPart) continue;
      temp.push({
        start,
        textEn: enPart,
        textVi: viPart || 'Bản dịch tự chọn — bôi đen từ để tra cứu nhanh.',
      });
    }
    return temp.map((item, idx) => {
      const nextStart = temp[idx + 1]?.start;
      const end =
        nextStart && nextStart > item.start + 0.5
          ? nextStart
          : item.start + Math.max(3, Math.min(8, item.textEn.split(/\s+/).length * 0.5));
      return {
        index: idx,
        start: Number(item.start.toFixed(2)),
        end: Number(end.toFixed(2)),
        textEn: item.textEn,
        textVi: item.textVi,
        wordCount: (item.textEn.match(/[A-Za-z0-9']+/g) || []).length || 1,
      };
    });
  }

  // 3. Plain sentences / paragraphs — split cleanly & distribute timestamps proportionally
  const chunks =
    rawLines.length >= 3
      ? rawLines
      : normalized
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean);

  const totalChars = Math.max(1, chunks.reduce((acc, c) => acc + c.length, 0));
  const totalDur = Math.max(30, estimatedDurationSec);
  let cursor = 0;

  return chunks
    .map((chunk, idx) => {
      const [enPart, viPart] = chunk.split('|').map((s) => s.trim());
      const dur = Math.max(2.5, (chunk.length / totalChars) * totalDur);
      const start = cursor;
      const end = start + dur;
      cursor = end;
      return {
        index: idx,
        start: Number(start.toFixed(2)),
        end: Number(end.toFixed(2)),
        textEn: enPart,
        textVi: viPart || 'Bản dịch tự chọn — bôi đen từ để tra cứu nhanh.',
        wordCount: (enPart.match(/[A-Za-z0-9']+/g) || []).length || 1,
      };
    })
    .filter((s) => s.textEn.length > 0);
}

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'almost', 'already', 'always', 'another',
  'because', 'before', 'being', 'between', 'could', 'doing', 'during', 'every',
  'first', 'found', 'great', 'having', 'however', 'might', 'never', 'other',
  'people', 'really', 'right', 'should', 'since', 'small', 'still', 'their',
  'there', 'these', 'thing', 'things', 'think', 'those', 'through', 'today',
  'under', 'using', 'where', 'which', 'while', 'without', 'world', 'would', 'years',
]);

/** Auto-generates listening fill-in-the-blank quiz items for user-pasted custom videos. */
export function buildCustomVideoQuizItems(sentences: VideoSentence[]): VideoQuizItem[] {
  const wordPool: string[] = [];
  for (const s of sentences) {
    const words = s.textEn.match(/\b[A-Za-z]{5,}\b/g) || [];
    for (const w of words) {
      const low = w.toLowerCase();
      if (!STOPWORDS.has(low) && !wordPool.includes(low)) {
        wordPool.push(low);
      }
    }
  }
  const fallbackPool = ['improve', 'practice', 'language', 'strategy', 'business', 'solution', 'schedule', 'effective'];
  const fullPool = wordPool.length >= 8 ? wordPool : [...wordPool, ...fallbackPool];

  const items: VideoQuizItem[] = [];
  const usedWords = new Set<string>();
  const step = Math.max(1, Math.floor(sentences.length / 8));

  for (let i = 0; i < sentences.length && items.length < 8; i += step) {
    const sent = sentences[i];
    const cands = (sent.textEn.match(/\b[A-Za-z]{5,}\b/g) || []).filter(
      (w) => !STOPWORDS.has(w.toLowerCase()) && !usedWords.has(w.toLowerCase())
    );
    if (cands.length === 0) continue;
    const answer = cands[0];
    usedWords.add(answer.toLowerCase());

    const prompt = sent.textEn.replace(new RegExp(`\\b${answer}\\b`), '____');
    if (!prompt.includes('____')) continue;

    const distractors = fullPool
      .filter((w) => w !== answer.toLowerCase() && !sent.textEn.toLowerCase().includes(w))
      .slice(0, 3);
    while (distractors.length < 3) {
      distractors.push(fallbackPool[distractors.length % fallbackPool.length]);
    }
    const options = [answer, ...distractors].sort((a, b) => a.localeCompare(b));

    items.push({
      id: `cq-${items.length + 1}`,
      sentenceIndex: sent.index,
      start: sent.start,
      end: sent.end,
      prompt,
      sentenceVi: sent.textVi,
      answer,
      options,
      meaningVi: 'Từ khóa xuất hiện trong câu nói — bôi đen để tra nghĩa chi tiết.',
      cefr: 'B1',
      ipa: '',
      pos: 'n',
    });
  }

  return items;
}
