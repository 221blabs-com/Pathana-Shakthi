import React from 'react';
import { motion } from 'motion/react';

interface PathanaShakthiLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  variant?: 'full' | 'icon' | 'badge';
}

export const PathanaShakthiLogo: React.FC<PathanaShakthiLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
  variant = 'full',
}) => {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  // Vector Mascot Book with Headphones (matches the brand logo exactly)
  const MascotIcon = (
    <div className={`relative ${iconSizes[size]} flex-shrink-0 flex items-center justify-center`}>
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md overflow-visible"
      >
        {/* Headphone Arch */}
        <path
          d="M 22 55 C 22 24, 98 24, 98 55"
          stroke="#1e40af"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 22 55 C 22 28, 98 28, 98 55"
          stroke="#38bdf8"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Headphone Ear Pads */}
        {/* Left Ear Pad */}
        <g>
          <rect x="10" y="44" width="16" height="28" rx="8" fill="#1e3a8a" />
          <rect x="12" y="46" width="12" height="24" rx="6" fill="#6366f1" />
          <ellipse cx="18" cy="58" rx="3.5" ry="8" fill="#a855f7" />
        </g>
        {/* Right Ear Pad */}
        <g>
          <rect x="94" y="44" width="16" height="28" rx="8" fill="#1e3a8a" />
          <rect x="96" y="46" width="12" height="24" rx="6" fill="#6366f1" />
          <ellipse cx="102" cy="58" rx="3.5" ry="8" fill="#a855f7" />
        </g>

        {/* Book Spine Center & Outer Glow */}
        <path
          d="M 60 40 L 28 48 C 26 68 28 88 30 96 L 60 106 L 90 96 C 92 88 94 68 92 48 Z"
          fill="#0f172a"
          opacity="0.3"
        />

        {/* Left Page (Cyan Blue Half) */}
        <path
          d="M 60 40 C 48 36, 34 38, 26 48 C 27 68 29 88 32 94 C 40 90, 52 94, 60 104 Z"
          fill="url(#bluePageGrad)"
          stroke="#1e3a8a"
          strokeWidth="2.5"
        />

        {/* Right Page (Orange Half) */}
        <path
          d="M 60 40 C 72 36, 86 38, 94 48 C 93 68 91 88 88 94 C 80 90, 68 94, 60 104 Z"
          fill="url(#orangePageGrad)"
          stroke="#c2410c"
          strokeWidth="2.5"
        />

        {/* Book Spine Center Highlight */}
        <path d="M 60 40 L 60 104" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />

        {/* Left Eye */}
        <circle cx="46" cy="62" r="7.5" fill="#ffffff" />
        <circle cx="47" cy="62" r="5" fill="#0f172a" />
        <circle cx="45" cy="60" r="2" fill="#ffffff" />

        {/* Right Eye */}
        <circle cx="74" cy="62" r="7.5" fill="#ffffff" />
        <circle cx="73" cy="62" r="5" fill="#0f172a" />
        <circle cx="71" cy="60" r="2" fill="#ffffff" />

        {/* Cheerful Smile across spine */}
        <path
          d="M 50 75 Q 60 87 70 75"
          stroke="#0f172a"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="#e11d48"
        />

        {/* Speech Bubble on Top Right with audio waves */}
        <g transform="translate(82, 16) scale(0.9)">
          <path
            d="M 8 2 C 22 2, 34 10, 34 20 C 34 28, 26 34, 18 36 L 14 44 L 14 36 C 6 36, 0 30, 0 20 C 0 10, 10 2, 22 2 Z"
            fill="#ffffff"
            stroke="#1e3a8a"
            strokeWidth="2"
          />
          {/* Sound waves inside speech bubble */}
          <path d="M 8 16 Q 13 13 18 16 T 28 16" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M 8 22 Q 13 19 18 22 T 28 22" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M 10 28 Q 14 26 18 28 T 26 28" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>

        {/* Gradients */}
        <defs>
          <linearGradient id="bluePageGrad" x1="26" y1="40" x2="60" y2="104" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="orangePageGrad" x1="60" y1="40" x2="94" y2="104" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fb923c" />
            <stop offset="1" stopColor="#ea580c" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} id="pathana-shakthi-icon">
        {MascotIcon}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`} id="pathana-shakthi-logo">
      <motion.div
        whileHover={{ scale: 1.05, rotate: [-1, 1, 0] }}
        transition={{ duration: 0.3 }}
      >
        {MascotIcon}
      </motion.div>

      <div className="flex flex-col">
        {/* Telugu Brand Typography & English Romanization */}
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-black ${textSizes[size]} tracking-tight text-[#2d2d2d] leading-none`}
            style={{ fontFamily: "'Lexend', 'Noto Sans Telugu', sans-serif" }}
          >
            Pathana Shakthi
          </span>
          <span
            className="text-xs sm:text-sm font-black text-amber-600 tracking-tight leading-none"
            style={{ fontFamily: "'Noto Sans Telugu', sans-serif" }}
          >
            పఠన శక్తి
          </span>
        </div>

        {showSubtitle && (
          <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-wider mt-0.5">
            AI Read-Along & Classroom Assistant
          </span>
        )}
      </div>
    </div>
  );
};
