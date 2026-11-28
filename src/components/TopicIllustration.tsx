import React from 'react';

interface TopicIllustrationProps {
  iconKey: string;
  size?: 'sm' | 'lg';
}

const PALETTES: Record<string, { bg: string; accent: string; soft: string }> = {
  contract: { bg: 'from-blue-500 to-indigo-600', accent: '#E0F2FE', soft: '#93C5FD' },
  marketing: { bg: 'from-pink-500 to-rose-600', accent: '#FCE7F3', soft: '#F9A8D4' },
  strategy: { bg: 'from-violet-500 to-purple-600', accent: '#EDE9FE', soft: '#C4B5FD' },
  conference: { bg: 'from-sky-500 to-blue-600', accent: '#E0F2FE', soft: '#7DD3FC' },
  tech: { bg: 'from-cyan-500 to-teal-600', accent: '#CFFAFE', soft: '#67E8F9' },
  finance: { bg: 'from-emerald-500 to-teal-600', accent: '#D1FAE5', soft: '#6EE7B7' },
  operations: { bg: 'from-indigo-500 to-blue-700', accent: '#E0E7FF', soft: '#A5B4FC' },
  hospitality: { bg: 'from-amber-500 to-orange-600', accent: '#FEF3C7', soft: '#FCD34D' },
  logistics: { bg: 'from-orange-500 to-red-500', accent: '#FFEDD5', soft: '#FDBA74' },
  schedule: { bg: 'from-blue-500 to-cyan-500', accent: '#E0F2FE', soft: '#67E8F9' },
  communication: { bg: 'from-sky-500 to-indigo-600', accent: '#E0F2FE', soft: '#93C5FD' },
  office: { bg: 'from-slate-500 to-indigo-600', accent: '#F1F5F9', soft: '#CBD5E1' },
  shopping: { bg: 'from-fuchsia-500 to-pink-600', accent: '#FAE8FF', soft: '#F0ABFC' },
  education: { bg: 'from-amber-400 to-orange-500', accent: '#FEF9C3', soft: '#FDE047' },
  leadership: { bg: 'from-purple-500 to-indigo-700', accent: '#F3E8FF', soft: '#D8B4FE' },
  environment: { bg: 'from-green-500 to-emerald-600', accent: '#DCFCE7', soft: '#86EFAC' },
  science: { bg: 'from-cyan-500 to-blue-600', accent: '#CFFAFE', soft: '#67E8F9' },
  hr: { bg: 'from-teal-500 to-cyan-600', accent: '#CCFBF1', soft: '#5EEAD4' },
  travel: { bg: 'from-sky-400 to-blue-600', accent: '#E0F2FE', soft: '#7DD3FC' },
};

export const TopicIllustration: React.FC<TopicIllustrationProps> = ({ iconKey, size = 'lg' }) => {
  const pal = PALETTES[iconKey] || PALETTES.education;
  const isLg = size === 'lg';

  const renderGlyph = () => {
    switch (iconKey) {
      case 'contract':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect x="14" y="10" width="32" height="44" rx="5" fill={pal.accent} />
            <path d="M21 21h18M21 29h18M21 37h11" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
            <circle cx="44" cy="44" r="10" fill="#FBBF24" stroke="#fff" strokeWidth="2.5" />
            <path d="M40 44l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'marketing':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <path d="M16 28 L44 16 V46 L16 34 Z" fill={pal.accent} />
            <rect x="11" y="27" width="8" height="10" rx="3" fill="#FDE047" />
            <path d="M20 35 L24 47 H18 L15 36 Z" fill={pal.soft} />
            <path d="M49 24 C53 27, 53 35, 49 38" fill="none" stroke="#FEF08A" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        );
      case 'finance':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect x="12" y="36" width="9" height="16" rx="2.5" fill={pal.soft} />
            <rect x="27" y="26" width="9" height="26" rx="2.5" fill={pal.accent} />
            <rect x="42" y="16" width="9" height="36" rx="2.5" fill="#FDE047" />
            <polyline points="14,28 29,18 45,10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <circle cx="45" cy="10" r="3.5" fill="#fff" />
          </svg>
        );
      case 'education':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <path d="M32 14 L56 25 L32 36 L8 25 Z" fill="#FFFBEB" />
            <path d="M18 31 V43 C18 48, 46 48, 46 43 V31" fill="none" stroke="#FEF08A" strokeWidth="4" strokeLinecap="round" />
            <line x1="52" y1="27" x2="52" y2="43" stroke="#FFFBEB" strokeWidth="3" strokeLinecap="round" />
            <circle cx="52" cy="45" r="3.5" fill="#FDE047" />
          </svg>
        );
      case 'tech':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect x="12" y="14" width="40" height="28" rx="4" fill={pal.accent} />
            <rect x="16" y="18" width="32" height="20" rx="2" fill="#0F172A" />
            <path d="M24 25 L20 28 L24 31 M40 25 L44 28 L40 31 M34 23 L30 33" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="8" y="44" width="48" height="6" rx="3" fill={pal.soft} />
          </svg>
        );
      case 'travel':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <path d="M14 40 L52 16 L40 46 L31 37 L21 44 L24 34 Z" fill="#fff" />
            <circle cx="20" cy="20" r="6" fill="#FDE047" />
          </svg>
        );
      case 'environment':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <path d="M18 46 C18 22, 46 14, 50 14 C50 38, 38 50, 18 46 Z" fill={pal.accent} />
            <path d="M16 50 C24 38, 36 28, 46 18" fill="none" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        );
      case 'science':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <path d="M25 14 H39 M28 14 V26 L16 48 C15 50, 16 52, 19 52 H45 C48 52, 49 50, 48 48 L36 26 V14" fill={pal.accent} stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M21 40 H43 L46 48 H18 Z" fill="#38BDF8" />
            <circle cx="30" cy="34" r="2.5" fill="#0284C7" />
            <circle cx="36" cy="30" r="2" fill="#0284C7" />
          </svg>
        );
      case 'communication':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect x="10" y="14" width="32" height="22" rx="7" fill="#fff" />
            <polygon points="18,36 14,44 26,36" fill="#fff" />
            <rect x="24" y="28" width="30" height="20" rx="7" fill="#FDE047" />
            <path d="M18 23h16M18 29h10" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );
      case 'hr':
      case 'conference':
      case 'leadership':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <circle cx="32" cy="22" r="9" fill="#FFFBEB" />
            <path d="M18 48 C18 37, 46 37, 46 48 Z" fill="#FFFBEB" />
            <circle cx="16" cy="27" r="6" fill={pal.soft} />
            <circle cx="48" cy="27" r="6" fill={pal.soft} />
          </svg>
        );
      case 'logistics':
      case 'operations':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <polygon points="32,10 52,20 52,44 32,54 12,44 12,20" fill={pal.accent} />
            <polyline points="12,20 32,30 52,20" fill="none" stroke="#EA580C" strokeWidth="2.5" />
            <line x1="32" y1="30" x2="32" y2="54" stroke="#EA580C" strokeWidth="2.5" />
          </svg>
        );
      case 'schedule':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <circle cx="32" cy="34" r="20" fill={pal.accent} />
            <circle cx="32" cy="34" r="15" fill="#0F172A" />
            <path d="M32 24 V34 L40 38" fill="none" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="26" y="8" width="12" height="4" rx="2" fill="#FDE047" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect x="13" y="12" width="38" height="40" rx="7" fill={pal.accent} />
            <path d="M22 24h20M22 33h20M22 42h12" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );
    }
  };

  return (
    <div
      data-preserve-dark="true"
      className={`shrink-0 overflow-hidden bg-gradient-to-br ${pal.bg} shadow-md flex items-center justify-center ${
        isLg
          ? 'h-24 w-24 sm:h-28 sm:w-28 rounded-2xl p-3 border-2 border-white/20 shadow-glow'
          : 'h-11 w-11 rounded-xl p-2 border border-white/15'
      }`}
    >
      {renderGlyph()}
    </div>
  );
};
