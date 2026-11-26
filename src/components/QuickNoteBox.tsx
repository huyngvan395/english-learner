import React, { useEffect, useState } from 'react';
import { Check, NotebookPen } from 'lucide-react';
import { NoteTargetType } from '../types';
import { useApp } from '../context/AppContext';

interface QuickNoteBoxProps {
  targetType: NoteTargetType;
  targetId: string;
  title: string;
  subtitle: string;
  placeholder?: string;
}

export const QuickNoteBox: React.FC<QuickNoteBoxProps> = ({
  targetType,
  targetId,
  title,
  subtitle,
  placeholder = 'Viết ghi chú cá nhân, mẹo nhớ hoặc lỗi hay sai của bạn tại đây...',
}) => {
  const { getNoteByTarget, upsertNote } = useApp();
  const existing = getNoteByTarget(targetType, targetId);
  const [text, setText] = useState(existing?.content || '');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setText(existing?.content || '');
  }, [targetId, existing?.content]);

  const handleSave = () => {
    upsertNote({ targetType, targetId, title, subtitle, content: text });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
          <NotebookPen className="h-3.5 w-3.5" />
          <span>Ghi chú cá nhân (tự động đồng bộ vào "Ghi chú của tôi")</span>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 px-2.5 py-1 text-xs font-semibold text-white transition"
        >
          {savedFlash ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Đã lưu
            </>
          ) : (
            'Lưu ghi chú'
          )}
        </button>
      </div>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
      />
    </div>
  );
};
