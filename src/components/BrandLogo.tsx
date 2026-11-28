import React, { useId } from 'react';

interface BrandLogoProps {
  className?: string;
  title?: string;
}

/**
 * Exclusive vector brand emblem for TOEIC Mastery Hub:
 * Rounded gradient squircle (Blue -> Indigo -> Violet) combining a sculpted
 * open mastery book / "TM" monogram with an upward target breakthrough spark.
 * Crisp at 24px, 32px, 40px, and large sizes across both Light and Dark Mode.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'h-9 w-9',
  title = 'TOEIC Mastery Hub',
}) => {
  const uid = useId().replace(/:/g, '');
  const bgId = `tmh-bg-${uid}`;
  const sheenId = `tmh-sheen-${uid}`;
  const sparkId = `tmh-spark-${uid}`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={bgId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="52%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id={sheenId} x1="8" y1="4" x2="36" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={sparkId} x1="25" y1="24" x2="39" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#FDE047" />
        </linearGradient>
      </defs>

      {/* Rounded Gradient Squircle Base */}
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${bgId})`} />
      <rect x="2.75" y="2.75" width="42.5" height="42.5" rx="12.25" stroke="white" strokeOpacity="0.22" strokeWidth="1.5" />

      {/* Subtle Top-Left Glass Sheen */}
      <path
        d="M15 2.75H33C39.7655 2.75 45.25 8.23451 45.25 15V19C35.5 14 17 15 2.75 23V15C2.75 8.23451 8.23451 2.75 15 2.75Z"
        fill={`url(#${sheenId})`}
      />

      {/* Sculpted Open Mastery Book / "M" Wings Base */}
      <path
        d="M11 33.5V22.8C11 21.8 11.9 21.1 12.85 21.4L23 24.7V36.4L12.7 35.1C11.73 34.98 11 34.48 11 33.5Z"
        fill="white"
        fillOpacity="0.92"
      />
      <path
        d="M37 33.5V22.8C37 21.8 36.1 21.1 35.15 21.4L25 24.7V36.4L35.3 35.1C36.27 34.98 37 34.48 37 33.5Z"
        fill="white"
        fillOpacity="0.78"
      />

      {/* Stylized Bold "T" Crest + Upward Target Breakthrough Arrow */}
      <path
        d="M12.5 15.5H27.5"
        stroke="white"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path
        d="M20 15.5V26.2"
        stroke="white"
        strokeWidth="3.6"
        strokeLinecap="round"
      />

      {/* Breakthrough Energy Ray & 4-Point Target Spark (990 Peak) */}
      <path
        d="M24.5 23.2L35.2 12.5"
        stroke={`url(#${sparkId})`}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M35.5 9.2L36.7 12.3L39.8 13.5L36.7 14.7L35.5 17.8L34.3 14.7L31.2 13.5L34.3 12.3L35.5 9.2Z"
        fill="#FDE047"
      />
    </svg>
  );
};
