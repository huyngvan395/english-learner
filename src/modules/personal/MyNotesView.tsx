import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Edit3,
  FileText,
  Headphones,
  NotebookPen,
  Search,
  Trash2,
} from 'lucide-react';
import { NoteTargetType } from '../../types';
import { useApp } from '../../context/AppContext';

export const MyNotesView: React.FC = () => {
  const { notes, upsertNote, deleteNote } = useApp();
  const [filter, setFilter] = useState<'all' | NoteTargetType>('all');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      const matchType = filter === 'all' || n.targetType === filter;
      const matchQ =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.subtitle.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q);
      return matchType && matchQ;
    });
  }, [notes, filter, query]);

  const badgeFor = (type: NoteTargetType) => {
    if (type === 'vocab')
      return { label: 'Từ vựng', icon: BookOpen, cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    if (type === 'reading')
      return { label: 'TOEIC Reading', icon: FileText, cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    return { label: 'TOEIC Listening', icon: Headphones, cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#16203A] via-[#111827] to-[#0F172A] p-6 shadow-card">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-xs font-bold text-indigo-300">
          <NotebookPen className="h-3.5 w-3.5" />
          Sổ tay cá nhân hóa
        </div>
        <h2 className="mt-2 text-2xl font-extrabold text-white">Ghi Chú Của Tôi ({notes.length})</h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Tất cả ghi chú mẹo nhớ, công thức ngữ pháp và lỗi hay mắc bạn viết ở Flashcard, Reading và Listening được lưu đồng bộ tại đây.
        </p>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all' as const, label: 'Tất cả' },
            { id: 'vocab' as const, label: 'Từ vựng' },
            { id: 'reading' as const, label: 'TOEIC Reading' },
            { id: 'listening' as const, label: 'TOEIC Listening' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                filter === t.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trong ghi chú..."
            className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Notes List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-12 text-center space-y-2">
          <NotebookPen className="mx-auto h-10 w-10 text-slate-500" />
          <p className="text-base font-bold text-slate-200">Chưa có ghi chú nào</p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Khi học Flashcard hoặc xem giải thích câu hỏi Reading / Listening, bạn có thể nhập ghi chú ngay trong khung <b>&ldquo;Ghi chú cá nhân&rdquo;</b>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((n) => {
            const b = badgeFor(n.targetType);
            const Icon = b.icon;
            const isEditing = editingId === n.id;

            return (
              <div
                key={n.id}
                className="rounded-2xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-card flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${b.cls}`}>
                      <Icon className="h-3 w-3" />
                      {b.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(n.id);
                            setDraft(n.content);
                          }}
                          className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-indigo-300"
                          title="Chỉnh sửa"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteNote(n.id)}
                        className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-rose-400"
                        title="Xóa ghi chú"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="mt-2.5 text-base font-extrabold text-white">{n.title}</h3>
                  <p className="text-xs text-slate-400">{n.subtitle}</p>

                  {isEditing ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        rows={3}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="w-full rounded-xl border border-indigo-500 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            upsertNote({
                              targetType: n.targetType,
                              targetId: n.targetId,
                              title: n.title,
                              subtitle: n.subtitle,
                              content: draft,
                            });
                            setEditingId(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Lưu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl bg-slate-900/80 border border-slate-800 p-3 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {n.content}
                    </p>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 text-right">
                  Cập nhật: {new Date(n.updatedAt).toLocaleString('vi-VN')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
