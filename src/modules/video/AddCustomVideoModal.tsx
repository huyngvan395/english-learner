import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Link2, Loader2, Sparkles, X, Youtube } from 'lucide-react';
import { VideoCefrLevel, VideoDetailItem } from '../../types';
import {
  buildCustomVideoQuizItems,
  extractYouTubeId,
  parseSubtitleInput,
} from '../../utils/videoLoader';

interface AddCustomVideoModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (video: VideoDetailItem) => void;
}

const LEVELS: VideoCefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const TOPICS = [
  'Giao tiếp hàng ngày',
  'Công sở & Kinh doanh',
  'Khoa học & Công nghệ',
  'Kỹ năng & Phát triển',
  'Tin tức & Văn hóa',
];

const SAMPLE_TRANSCRIPT = `0:00 Welcome back to our daily English practice session. | Chào mừng bạn quay lại buổi luyện nghe tiếng Anh hàng ngày.
0:06 Today we will talk about how to build strong communication habits at work. | Hôm nay chúng ta sẽ nói về cách xây dựng thói quen giao tiếp tốt nơi công sở.
0:14 First, listen carefully before responding to your colleagues. | Đầu tiên, hãy lắng nghe cẩn thận trước khi phản hồi đồng nghiệp.
0:21 Second, summarize key action items at the end of every meeting. | Thứ hai, hãy tóm tắt các đầu việc chính ở cuối mỗi cuộc họp.
0:29 Practicing five minutes a day makes a huge difference over time. | Luyện tập 5 phút mỗi ngày sẽ tạo ra khác biệt lớn theo thời gian.`;

export const AddCustomVideoModal: React.FC<AddCustomVideoModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [channel, setChannel] = useState('Video của tôi');
  const [level, setLevel] = useState<VideoCefrLevel>('B1');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [subtitleText, setSubtitleText] = useState('');
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ytId = extractYouTubeId(urlInput);

  // Auto-fetch video title & author via public YouTube oEmbed whenever a valid YouTube ID is pasted
  useEffect(() => {
    if (!ytId) return;
    let cancelled = false;
    setFetchingMeta(true);
    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.title && !titleEn.trim()) setTitleEn(data.title);
        if (data.author_name) setChannel(data.author_name);
      })
      .catch(() => {
        // Silent fallback if oEmbed unavailable
      })
      .finally(() => {
        if (!cancelled) setFetchingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ytId]);

  if (!open) return null;

  const previewSentences = parseSubtitleInput(subtitleText, 180);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ytId) {
      setError('Vui lòng dán đường dẫn YouTube hợp lệ (VD: https://www.youtube.com/watch?v=...).');
      return;
    }

    const sentences = parseSubtitleInput(subtitleText, 180);
    if (sentences.length < 2) {
      setError('Vui lòng dán ít nhất 2 dòng phụ đề tiếng Anh (hỗ trợ SRT, VTT, [00:12] hoặc từng câu).');
      return;
    }

    const totalWords = sentences.reduce((acc, s) => acc + s.wordCount, 0);
    const estDuration = Math.max(60, Math.round(sentences[sentences.length - 1].end + 4));
    const wpm = Math.max(70, Math.min(220, Math.round(totalWords / Math.max(0.5, estDuration / 60))));
    const quizItems = buildCustomVideoQuizItems(sentences);

    const video: VideoDetailItem = {
      id: `custom-${ytId}-${Date.now().toString(36)}`,
      youtubeId: ytId,
      titleEn: titleEn.trim() || `Custom YouTube Lesson (${ytId})`,
      titleVi: titleEn.trim() || `Bài học YouTube cá nhân (${ytId})`,
      channel: channel.trim() || 'Video của tôi',
      channelSlug: 'custom-videos',
      durationSec: estDuration,
      level,
      topic,
      sentenceCount: sentences.length,
      wpm,
      thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      featured: false,
      createdAt: new Date().toISOString(),
      isCustom: true,
      sentences,
      quizItems,
    };

    onCreated(video);
    setUrlInput('');
    setTitleEn('');
    setSubtitleText('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88dvh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#111827] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 border border-rose-500/30">
              <Youtube className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                Tạo bài học từ link YouTube
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Lưu trong trình duyệt &amp; đồng bộ Cloud Supabase của bạn
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* YouTube URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-indigo-500" />
              Đường dẫn YouTube (hoặc Video ID 11 ký tự)
            </label>
            <div className="relative">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=1IVlILdETAw"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
              {fetchingMeta && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-indigo-500" />
              )}
            </div>
          </div>

          {/* Live Thumbnail Preview */}
          {ytId && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 dark:border-emerald-500/35 bg-emerald-50/70 dark:bg-emerald-950/25 p-2.5">
              <img
                src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
                alt="Video preview"
                className="h-16 w-28 rounded-xl object-cover shrink-0 bg-slate-900"
              />
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đã nhận diện YouTube ID: {ytId}
                </p>
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate mt-0.5">
                  {titleEn || 'Nhập tiêu đề bài học bên dưới'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{channel}</p>
              </div>
            </div>
          )}

          {/* Title & Channel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tiêu đề bài học</label>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="VD: Business Meeting English"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-base sm:text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Trình độ &amp; Chủ đề</label>
              <div className="flex gap-2">
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as VideoCefrLevel)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                >
                  {LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                >
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Subtitles Input */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-indigo-500" />
                Dán phụ đề (SRT / VTT / `0:12 Câu tiếng Anh | Dịch Việt` / từng câu)
              </label>
              <button
                type="button"
                onClick={() => setSubtitleText(SAMPLE_TRANSCRIPT)}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-400/35 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:brightness-105 transition"
              >
                <Sparkles className="h-3 w-3" />
                Điền mẫu thử
              </button>
            </div>
            <textarea
              rows={6}
              value={subtitleText}
              onChange={(e) => setSubtitleText(e.target.value)}
              placeholder={`Mẹo: Trên YouTube bấm "Hiện bản chép lời (Show transcript)", copy rồi dán thẳng vào đây.\nHoặc dán định dạng:\n0:05 Hello everyone! | Xin chào mọi người!\n0:12 Let's start today's lesson.`}
              className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-base sm:text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Tự động tách mốc thời gian &amp; tạo bộ câu hỏi Quiz nghe điền từ</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-300">
                Đã nhận diện: {previewSentences.length} câu
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/35 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-glow hover:brightness-110 transition active:scale-95"
            >
              <Youtube className="h-4 w-4" />
              Tạo &amp; Học ngay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
