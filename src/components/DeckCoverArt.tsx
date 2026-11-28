import React from 'react';

interface DeckCoverArtProps {
  theme: string;
  gradient: string;
  badgeText: string;
  levelLabel: string;
}

export const DeckCoverArt: React.FC<DeckCoverArtProps> = ({
  theme,
  gradient,
  badgeText,
  levelLabel,
}) => {
  const renderIconSvg = () => {
    switch (theme) {
      case 'toeic-600':
        return (
          <svg viewBox="0 0 120 80" className="w-28 h-20 opacity-90 drop-shadow-lg">
            <rect x="14" y="18" width="54" height="44" rx="7" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
            <path d="M24 34h34M24 44h24M24 52h18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="84" cy="40" r="22" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="2" />
            <text x="84" y="45" textAnchor="middle" fill="white" fontSize="13" fontWeight="800">600</text>
          </svg>
        );
      case 'toeic-ets':
        return (
          <svg viewBox="0 0 120 80" className="w-28 h-20 opacity-90 drop-shadow-lg">
            <polygon points="60,8 73,30 98,35 80,53 84,76 60,64 36,76 40,53 22,35 47,30" fill="rgba(255,255,255,0.22)" stroke="white" strokeWidth="2" />
            <text x="60" y="48" textAnchor="middle" fill="white" fontSize="14" fontWeight="800">ETS</text>
          </svg>
        );
      case 'toeic-idioms':
        return (
          <svg viewBox="0 0 120 80" className="w-28 h-20 opacity-90 drop-shadow-lg">
            <rect x="16" y="16" width="56" height="34" rx="10" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8" />
            <path d="M28 30h32M28 39h20" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            <rect x="50" y="34" width="54" height="32" rx="10" fill="rgba(15,23,42,0.45)" stroke="rgba(255,255,255,0.75)" strokeWidth="1.8" />
            <path d="M62 47h30M62 56h18" stroke="#67E8F9" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        );
      case 'oxford-3000':
      case 'oxford-5000':
        return (
          <svg viewBox="0 0 120 80" className="w-28 h-20 opacity-90 drop-shadow-lg">
            <path d="M22 22 C40 16, 55 20, 60 26 C65 20, 80 16, 98 22 L98 62 C80 56, 65 60, 60 66 C55 60, 40 56, 22 62 Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="2" />
            <line x1="60" y1="26" x2="60" y2="66" stroke="white" strokeWidth="1.8" />
            <path d="M32 34h18M32 44h16M70 34h18M70 44h16" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'common-1000':
      case 'communication':
        return (
          <svg viewBox="0 0 120 80" className="w-28 h-20 opacity-90 drop-shadow-lg">
            <circle cx="44" cy="40" r="22" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="2" />
            <circle cx="76" cy="40" r="22" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
            <path d="M35 40h18M67 40h18M44 31v18" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 120 80" className="w-28 h-20 opacity-90 drop-shadow-lg">
            <path d="M60 14 L102 32 L60 50 L18 32 Z" fill="rgba(255,255,255,0.24)" stroke="white" strokeWidth="2" />
            <path d="M34 40 V58 C34 64, 86 64, 86 58 V40" fill="none" stroke="white" strokeWidth="2" />
            <line x1="96" y1="35" x2="96" y2="56" stroke="white" strokeWidth="2" />
          </svg>
        );
    }
  };

  return (
    <div
      data-preserve-dark="true"
      className={`relative h-36 w-full overflow-hidden rounded-t-2xl bg-gradient-to-br ${gradient} p-4 flex flex-col justify-between`}
    >
      {/* Decorative translucent mesh circles */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-slate-950/25 blur-lg" />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-black/30 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white border border-white/20">
          {badgeText}
        </span>
        <span className="inline-flex items-center rounded-md bg-white/20 backdrop-blur-md px-2 py-0.5 text-[11px] font-semibold text-white border border-white/15">
          {levelLabel}
        </span>
      </div>

      <div className="relative z-10 flex items-end justify-end">{renderIconSvg()}</div>
    </div>
  );
};
