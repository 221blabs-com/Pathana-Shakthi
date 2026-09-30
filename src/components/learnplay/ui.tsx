import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

// Shakthi Mitra, the app's tiger mascot, as a floating 3D guide with an
// optional speech bubble. mood changes how it moves.
export const MitraGuide: React.FC<{
  message?: string;
  mood?: 'happy' | 'cheer' | 'think' | 'sad';
  size?: number;
  side?: 'left' | 'right';
  className?: string;
}> = ({ message, mood = 'happy', size = 72, side = 'left', className = '' }) => {
  const animate =
    mood === 'cheer'
      ? { y: [0, -18, 0, -10, 0], rotate: [0, -8, 8, -4, 0], scale: [1, 1.12, 1, 1.06, 1] }
      : mood === 'sad'
      ? { rotate: [0, -6, 6, 0], y: [0, 2, 0] }
      : mood === 'think'
      ? { rotate: [0, 6, 0], y: [0, -3, 0] }
      : { y: [0, -7, 0], rotate: [-2, 2, -2] };
  return (
    <div className={`flex items-end gap-2 ${side === 'right' ? 'flex-row-reverse' : ''} ${className}`}>
      <motion.div
        key={mood}
        animate={animate}
        transition={{ duration: mood === 'cheer' ? 0.9 : 3, repeat: mood === 'cheer' ? 0 : Infinity, ease: 'easeInOut' }}
        className="shrink-0 rounded-full bg-gradient-to-b from-amber-200 to-orange-300 p-1 shadow-[0_8px_0_rgba(180,83,9,0.35),0_14px_24px_rgba(180,83,9,0.25)]"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <img src="/shakthi-face-256.png" alt="" className="h-full w-full object-contain drop-shadow" draggable={false} />
      </motion.div>
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`relative mb-3 max-w-[16rem] rounded-2xl border-2 border-amber-200 bg-white px-3.5 py-2 text-sm font-bold text-stone-800 shadow-[0_5px_0_rgba(251,191,36,0.35)] ${
              side === 'right' ? 'rounded-br-md' : 'rounded-bl-md'
            }`}
            role="status"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ChunkyButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: 'amber' | 'emerald' | 'sky' | 'rose' | 'violet' | 'white' }
> = ({ color = 'amber', className = '', children, ...props }) => {
  const colors: Record<string, string> = {
    amber: 'bg-amber-400 text-amber-950',
    emerald: 'bg-emerald-500 text-white',
    sky: 'bg-sky-500 text-white',
    rose: 'bg-rose-500 text-white',
    violet: 'bg-violet-500 text-white',
    white: 'bg-white text-stone-800 border-2 border-stone-200',
  };
  return (
    <button type="button" {...props} className={`btn-3d px-5 py-3 text-base ${colors[color]} ${className}`}>
      {children}
    </button>
  );
};

export const RoundDots: React.FC<{ total: number; current: number; results: boolean[] }> = ({ total, current, results }) => (
  <div className="flex items-center gap-1.5" aria-label={`Round ${Math.min(current + 1, total)} of ${total}`}>
    {Array.from({ length: total }, (_, i) => (
      <span
        key={i}
        className={`h-3 w-3 rounded-full transition-all ${
          i < results.length ? (results[i] ? 'bg-emerald-500' : 'bg-rose-400') : i === current ? 'w-6 bg-amber-400' : 'bg-stone-200'
        }`}
      />
    ))}
  </div>
);

// Big "Correct!/Try again" flash over the game area.
export const Feedback: React.FC<{ state: 'correct' | 'wrong' | null; text?: string }> = ({ state, text }) => (
  <AnimatePresence>
    {state && (
      <motion.div
        initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="pointer-events-none absolute inset-x-0 top-3 z-30 mx-auto w-fit"
      >
        <div
          className={`btn-3d px-5 py-2 text-lg ${state === 'correct' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
        >
          {text || (state === 'correct' ? 'Correct! ⭐' : 'Try again! 💪')}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export interface GameProps {
  grade: string;
  language: string;
  onFinish: (score: number, total: number) => void;
  onMascot: (message: string, mood?: 'happy' | 'cheer' | 'think' | 'sad') => void;
}

export const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
