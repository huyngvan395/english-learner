import React from 'react';
import { ListeningPart1Question } from '../types';

export const Part1Illustration: React.FC<{
  illustrationKey: ListeningPart1Question['illustrationKey'];
}> = ({ illustrationKey }) => {
  switch (illustrationKey) {
    case 'office-laptop':
      return (
        <svg viewBox="0 0 640 360" className="w-full h-full rounded-xl bg-[#0F172A]">
          {/* Office wall & window with blinds */}
          <rect width="640" height="360" fill="#1E293B" />
          <rect x="380" y="30" width="210" height="150" rx="6" fill="#38BDF8" fillOpacity="0.22" stroke="#64748B" strokeWidth="4" />
          {[48, 66, 84, 102, 120, 138, 156].map((y) => (
            <line key={y} x1="384" y1={y} x2="586" y2={y} stroke="#94A3B8" strokeWidth="2.5" strokeOpacity="0.55" />
          ))}
          {/* Wall shelf & plant */}
          <rect x="46" y="74" width="150" height="10" rx="3" fill="#475569" />
          <rect x="65" y="42" width="18" height="32" rx="2" fill="#6366F1" />
          <rect x="88" y="48" width="16" height="26" rx="2" fill="#38BDF8" />
          <rect x="110" y="38" width="20" height="36" rx="2" fill="#A855F7" />
          {/* Desk */}
          <rect x="40" y="245" width="560" height="20" rx="4" fill="#92400E" />
          <rect x="70" y="265" width="22" height="95" fill="#78350F" />
          <rect x="548" y="265" width="22" height="95" fill="#78350F" />
          {/* Woman sitting & typing */}
          <circle cx="250" cy="128" r="30" fill="#FDBA74" />
          <path d="M220 124 C222 92, 278 92, 280 124 C272 108, 228 108, 220 124 Z" fill="#1E1B4B" />
          <path d="M210 245 L220 168 C224 156, 276 156, 282 168 L292 245 Z" fill="#4F46E5" />
          {/* Arms reaching laptop keyboard */}
          <path d="M228 188 L272 225 L322 232" fill="none" stroke="#FDBA74" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M274 188 L304 222 L346 232" fill="none" stroke="#FDBA74" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
          {/* Laptop */}
          <polygon points="338,245 430,245 456,174 366,174" fill="#CBD5E1" stroke="#475569" strokeWidth="3" />
          <polygon points="348,236 422,236 444,182 372,182" fill="#0F172A" />
          <rect x="305" y="236" width="128" height="10" rx="3" fill="#94A3B8" />
          {/* Coffee mug & notebook */}
          <rect x="486" y="214" width="28" height="31" rx="4" fill="#F8FAFC" />
          <path d="M514 221 C524 221, 524 238, 514 238" fill="none" stroke="#F8FAFC" strokeWidth="4" />
          <rect x="130" y="234" width="66" height="11" rx="2" fill="#38BDF8" />
          <text x="16" y="344" fill="#94A3B8" fontSize="13" fontFamily="sans-serif">TOEIC Part 1 Visual Scene — Office Desk</text>
        </svg>
      );

    case 'meeting-whiteboard':
      return (
        <svg viewBox="0 0 640 360" className="w-full h-full rounded-xl bg-[#0F172A]">
          <rect width="640" height="360" fill="#1E293B" />
          {/* Whiteboard with ascending chart */}
          <rect x="190" y="28" width="280" height="150" rx="6" fill="#F8FAFC" stroke="#64748B" strokeWidth="6" />
          <line x1="220" y1="150" x2="440" y2="150" stroke="#94A3B8" strokeWidth="2" />
          <line x1="220" y1="54" x2="220" y2="150" stroke="#94A3B8" strokeWidth="2" />
          <rect x="245" y="112" width="26" height="38" fill="#6366F1" rx="2" />
          <rect x="290" y="92" width="26" height="58" fill="#3B82F6" rx="2" />
          <rect x="335" y="70" width="26" height="80" fill="#06B6D4" rx="2" />
          <polyline points="258,104 303,84 348,62 405,48" fill="none" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="405" cy="48" r="5" fill="#EF4444" />
          {/* Presenter pointing to chart */}
          <circle cx="136" cy="108" r="24" fill="#FDBA74" />
          <path d="M108 242 L114 142 C116 134, 156 134, 158 142 L166 242 Z" fill="#0EA5E9" />
          {/* Pointing arm */}
          <path d="M150 156 L220 120 L282 95" fill="none" stroke="#FDBA74" strokeWidth="11" strokeLinecap="round" />
          {/* Conference table */}
          <ellipse cx="365" cy="272" rx="210" ry="44" fill="#475569" stroke="#64748B" strokeWidth="3" />
          {/* Two seated colleagues */}
          <circle cx="310" cy="202" r="22" fill="#FED7AA" />
          <path d="M282 260 C282 228, 338 228, 338 260 Z" fill="#6366F1" />
          <circle cx="470" cy="202" r="22" fill="#FDBA74" />
          <path d="M442 260 C442 228, 498 228, 498 260 Z" fill="#10B981" />
          {/* Documents on table */}
          <rect x="340" y="254" width="46" height="22" rx="2" fill="#F1F5F9" transform="rotate(-6 340 254)" />
          <rect x="408" y="256" width="40" height="20" rx="2" fill="#E2E8F0" transform="rotate(8 408 256)" />
          <text x="16" y="344" fill="#94A3B8" fontSize="13" fontFamily="sans-serif">TOEIC Part 1 Visual Scene — Meeting Presentation</text>
        </svg>
      );

    case 'cafe-patio':
      return (
        <svg viewBox="0 0 640 360" className="w-full h-full rounded-xl bg-[#0F172A]">
          {/* Sky & facade */}
          <rect width="640" height="215" fill="#1E3A5F" />
          <rect x="0" y="215" width="640" height="145" fill="#334155" />
          {/* Patio brick grid */}
          {[245, 280, 315].map((y) => (
            <line key={y} x1="0" y1={y} x2="640" y2={y} stroke="#475569" strokeWidth="1.5" />
          ))}
          {/* Cafe building facade */}
          <rect x="28" y="34" width="584" height="181" rx="6" fill="#1E293B" stroke="#475569" strokeWidth="3" />
          <rect x="64" y="76" width="140" height="106" rx="4" fill="#38BDF8" fillOpacity="0.18" stroke="#64748B" strokeWidth="3" />
          <rect x="250" y="76" width="140" height="106" rx="4" fill="#38BDF8" fillOpacity="0.18" stroke="#64748B" strokeWidth="3" />
          <rect x="436" y="76" width="140" height="106" rx="4" fill="#38BDF8" fillOpacity="0.18" stroke="#64748B" strokeWidth="3" />
          <rect x="210" y="42" width="220" height="26" rx="4" fill="#0F172A" />
          <text x="320" y="60" textAnchor="middle" fill="#FDE68A" fontSize="14" fontWeight="700" letterSpacing="3">BISTRO PATIO</text>
          {/* Two outdoor tables with open umbrellas — NO PEOPLE */}
          {[190, 450].map((cx) => (
            <g key={cx}>
              {/* Umbrella canopy */}
              <path d={`M${cx - 85} 152 Q${cx} 82 ${cx + 85} 152 Z`} fill="#F59E0B" stroke="#FEF3C7" strokeWidth="2.5" />
              {/* Pole */}
              <line x1={cx} y1="152" x2={cx} y2="292" stroke="#CBD5E1" strokeWidth="5" />
              {/* Table */}
              <ellipse cx={cx} cy="242" rx="58" ry="14" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
              {/* Left & right upright chairs */}
              <rect x={cx - 88} y="246" width="26" height="6" rx="2" fill="#64748B" />
              <line x1={cx - 86} y1="220" x2={cx - 86} y2="290" stroke="#94A3B8" strokeWidth="4" />
              <line x1={cx - 64} y1="252" x2={cx - 64} y2="290" stroke="#94A3B8" strokeWidth="4" />
              <rect x={cx + 62} y="246" width="26" height="6" rx="2" fill="#64748B" />
              <line x1={cx + 86} y1="220" x2={cx + 86} y2="290" stroke="#94A3B8" strokeWidth="4" />
              <line x1={cx + 64} y1="252" x2={cx + 64} y2="290" stroke="#94A3B8" strokeWidth="4" />
            </g>
          ))}
          {/* Potted plants along walkway */}
          {[68, 572].map((px) => (
            <g key={px}>
              <polygon points={`${px - 18},274 ${px + 18},274 ${px + 13},308 ${px - 13},308`} fill="#B45309" />
              <circle cx={px} cy="256" r="20" fill="#10B981" />
              <circle cx={px - 12} cy="264" r="13" fill="#059669" />
              <circle cx={px + 12} cy="264" r="13" fill="#34D399" />
            </g>
          ))}
          <text x="16" y="344" fill="#94A3B8" fontSize="13" fontFamily="sans-serif">TOEIC Part 1 Visual Scene — Empty Café Patio</text>
        </svg>
      );

    case 'warehouse-shelves':
      return (
        <svg viewBox="0 0 640 360" className="w-full h-full rounded-xl bg-[#0F172A]">
          <rect width="640" height="360" fill="#1E293B" />
          <rect x="0" y="286" width="640" height="74" fill="#334155" />
          {/* Metal shelving rack */}
          <rect x="44" y="36" width="330" height="254" fill="none" stroke="#64748B" strokeWidth="6" />
          {[118, 200].map((y) => (
            <line key={y} x1="44" y1={y} x2="374" y2={y} stroke="#64748B" strokeWidth="6" />
          ))}
          <line x1="209" y1="36" x2="209" y2="290" stroke="#64748B" strokeWidth="5" />
          {/* Stacked cardboard boxes */}
          {[
            { x: 60, y: 66, w: 62, h: 48 },
            { x: 130, y: 58, w: 64, h: 56 },
            { x: 224, y: 62, w: 66, h: 52 },
            { x: 298, y: 70, w: 60, h: 44 },
            { x: 60, y: 144, w: 72, h: 52 },
            { x: 140, y: 152, w: 56, h: 44 },
            { x: 224, y: 142, w: 62, h: 54 },
            { x: 294, y: 146, w: 66, h: 50 },
            { x: 64, y: 226, w: 66, h: 58 },
            { x: 138, y: 232, w: 58, h: 52 },
            { x: 226, y: 224, w: 74, h: 60 },
            { x: 308, y: 234, w: 52, h: 50 },
          ].map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="3" fill="#D97706" stroke="#92400E" strokeWidth="2" />
              <rect x={b.x + 8} y={b.y + 8} width="22" height="10" rx="1" fill="#FEF3C7" />
            </g>
          ))}
          {/* Worker standing on floor inspecting with clipboard */}
          <circle cx="468" cy="112" r="24" fill="#FDBA74" />
          {/* Safety vest */}
          <path d="M442 222 L448 144 C450 136, 486 136, 488 144 L496 222 Z" fill="#FACC15" />
          <rect x="446" y="176" width="46" height="8" fill="#E2E8F0" />
          {/* Trousers standing on floor */}
          <rect x="448" y="222" width="18" height="72" rx="4" fill="#1E3A8A" />
          <rect x="472" y="222" width="18" height="72" rx="4" fill="#1E3A8A" />
          {/* Arms holding clipboard facing shelves */}
          <path d="M452 158 L416 178 L428 192" fill="none" stroke="#FDBA74" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="396" y="164" width="26" height="36" rx="2" fill="#F8FAFC" stroke="#475569" strokeWidth="2" transform="rotate(-10 396 164)" />
          <text x="16" y="344" fill="#94A3B8" fontSize="13" fontFamily="sans-serif">TOEIC Part 1 Visual Scene — Warehouse Inventory Inspection</text>
        </svg>
      );
  }
};
