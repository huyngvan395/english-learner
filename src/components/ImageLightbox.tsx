import React, { useEffect, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
}

export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  src,
  alt,
  className = 'max-w-full h-auto object-contain',
  containerClassName = '',
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative block w-full cursor-zoom-in focus:outline-none ${containerClassName}`}
        title="Bấm để phóng to ảnh"
      >
        <img src={src} alt={alt} className={className} loading="lazy" />
        <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-slate-950/80 border border-slate-700/80 px-2 py-1 text-[11px] font-bold text-slate-200 backdrop-blur-sm opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
          <ZoomIn className="h-3.5 w-3.5 text-sky-400" />
          Phóng to
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng ảnh phóng to"
            className="fixed top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/95 text-white hover:bg-slate-800 shadow-lg transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative max-h-[90dvh] max-w-[95vw] overflow-auto rounded-2xl bg-slate-900/60 p-1.5 border border-slate-700/80 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={src}
              alt={alt}
              className="max-h-[86dvh] max-w-full w-auto h-auto rounded-xl object-contain bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
};
