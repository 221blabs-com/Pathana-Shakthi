import React from 'react';
import { motion } from 'motion/react';
import { LabCard } from '../../data/learnPlay';
import { PlantSvg } from './games/PlantPartsGame';
import { WaterCycleScene } from './games/SequenceGame';

const loop = { repeat: Infinity, repeatDelay: 0.8 };

// A spinning CSS-3D cube (six real faces in perspective).
const Cube3D: React.FC = () => {
  const faces = [
    { t: 'rotateY(0deg) translateZ(48px)', c: '#f59e0b' },
    { t: 'rotateY(90deg) translateZ(48px)', c: '#fb923c' },
    { t: 'rotateY(180deg) translateZ(48px)', c: '#f97316' },
    { t: 'rotateY(-90deg) translateZ(48px)', c: '#fbbf24' },
    { t: 'rotateX(90deg) translateZ(48px)', c: '#fde68a' },
    { t: 'rotateX(-90deg) translateZ(48px)', c: '#d97706' },
  ];
  return (
    <div className="flex h-full items-center justify-center" style={{ perspective: 600 }}>
      <motion.div
        style={{ width: 96, height: 96, position: 'relative', transformStyle: 'preserve-3d' }}
        animate={{ rotateX: [0, 360], rotateY: [0, 360] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
      >
        {faces.map((f) => (
          <div
            key={f.t}
            style={{ position: 'absolute', inset: 0, transform: f.t, background: f.c, border: '3px solid #78350f', borderRadius: 10, opacity: 0.95 }}
          />
        ))}
      </motion.div>
    </div>
  );
};

const AddScene: React.FC = () => (
  <div className="flex h-full items-center justify-center gap-2 text-4xl sm:text-5xl">
    <motion.div animate={{ x: [0, 30, 30, 0] }} transition={{ ...loop, duration: 2.4, times: [0, 0.4, 0.8, 1] }} className="flex gap-1">
      🥭🥭🥭
    </motion.div>
    <motion.span animate={{ opacity: [1, 0, 0, 1], scale: [1, 0.5, 0.5, 1] }} transition={{ ...loop, duration: 2.4, times: [0, 0.4, 0.8, 1] }} className="font-black text-amber-500">
      +
    </motion.span>
    <motion.div animate={{ x: [0, -30, -30, 0] }} transition={{ ...loop, duration: 2.4, times: [0, 0.4, 0.8, 1] }} className="flex gap-1">
      🥭🥭
    </motion.div>
    <motion.span animate={{ opacity: [0, 0, 1, 0] }} transition={{ ...loop, duration: 2.4, times: [0, 0.45, 0.7, 1] }} className="absolute bottom-3 rounded-2xl bg-violet-600 px-3 py-1 text-xl font-black text-white">
      = 5
    </motion.span>
  </div>
);

const SubtractScene: React.FC = () => (
  <div className="flex h-full items-end justify-center gap-1 pb-6 text-4xl sm:text-5xl">
    {[0, 1, 2, 3, 4].map((i) => (
      <motion.span
        key={i}
        animate={i >= 3 ? { y: [0, -140], opacity: [1, 0], rotate: [0, i === 3 ? -20 : 20] } : { y: [0, -6, 0] }}
        transition={i >= 3 ? { ...loop, duration: 2 } : { repeat: Infinity, duration: 2 }}
      >
        🎈
      </motion.span>
    ))}
  </div>
);

const NumberLineScene: React.FC = () => (
  <div className="relative mx-6 h-full">
    <div className="absolute inset-x-0 top-1/2 h-1.5 rounded bg-teal-700/70" />
    {Array.from({ length: 11 }, (_, n) => (
      <span key={n} className="absolute top-1/2 flex -translate-x-1/2 flex-col items-center text-xs font-black text-teal-900" style={{ left: `${n * 10}%` }}>
        <span className="h-3 w-0.5 bg-teal-700" />
        {n}
      </span>
    ))}
    <motion.span
      className="absolute top-[18%] text-3xl"
      animate={{ left: ['36%', '46%', '56%', '66%', '66%'], y: [0, -20, 0, -20, 0] }}
      transition={{ ...loop, duration: 2.6 }}
    >
      🐸
    </motion.span>
  </div>
);

const CompassScene: React.FC = () => (
  <div className="flex h-full items-center justify-center">
    <div className="relative h-36 w-36 rounded-full border-8 border-teal-600 bg-white shadow-[0_8px_0_rgba(13,148,136,0.35)]">
      {[
        ['N', 'top-1 left-1/2 -translate-x-1/2 text-rose-600'],
        ['S', 'bottom-1 left-1/2 -translate-x-1/2'],
        ['E', 'right-2 top-1/2 -translate-y-1/2'],
        ['W', 'left-2 top-1/2 -translate-y-1/2'],
      ].map(([l, c]) => (
        <span key={l} className={`absolute text-sm font-black ${c}`}>
          {l}
        </span>
      ))}
      <motion.div
        className="absolute left-1/2 top-1/2 h-24 w-3 -translate-x-1/2 -translate-y-1/2"
        animate={{ rotate: [0, 200, 140, 370, 360] }}
        transition={{ ...loop, duration: 3.2 }}
      >
        <div className="h-1/2 w-full rounded-t-full bg-rose-500" />
        <div className="h-1/2 w-full rounded-b-full bg-slate-400" />
      </motion.div>
    </div>
  </div>
);

const LettersScene: React.FC<{ card: LabCard }> = ({ card }) => {
  const tiles = card.title.includes(' - ') ? card.title.split(' - ') : [...card.emoji];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="flex gap-2">
        {tiles.map((t, i) => (
          <motion.span
            key={i}
            className="btn-3d bg-amber-300 px-3 py-2 text-3xl text-amber-950"
            animate={{ x: [(i - (tiles.length - 1) / 2) * 30, 0, 0], y: [i % 2 ? -20 : 20, 0, 0], rotate: [i % 2 ? 12 : -12, 0, 0] }}
            transition={{ ...loop, duration: 2.2, times: [0, 0.5, 1] }}
          >
            {t}
          </motion.span>
        ))}
      </div>
      <span className="text-5xl float-slow">{card.emoji}</span>
    </div>
  );
};

const EmojiScene: React.FC<{ emoji: string }> = ({ emoji }) => (
  <div className="flex h-full items-center justify-center" style={{ perspective: 600 }}>
    <motion.span
      className="text-8xl drop-shadow-[0_10px_0_rgba(0,0,0,0.12)] sm:text-9xl"
      animate={{ rotateY: [0, 18, -18, 0], y: [0, -10, 0], scale: [1, 1.06, 1] }}
      transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
    >
      {emoji}
    </motion.span>
  </div>
);

export const LearnScene: React.FC<{ card: LabCard }> = ({ card }) => {
  switch (card.scene) {
    case 'add':
      return <AddScene />;
    case 'subtract':
      return <SubtractScene />;
    case 'numberline':
      return <NumberLineScene />;
    case 'shapes':
      return card.emoji === '🧊' ? <Cube3D /> : <EmojiScene emoji={card.emoji} />;
    case 'plant':
      return (
        <div className="mx-auto h-full w-44">
          <PlantSvg grow />
        </div>
      );
    case 'watercycle':
      return <WaterCycleScene />;
    case 'compass':
      return card.emoji === '🧭' ? <CompassScene /> : <EmojiScene emoji={card.emoji} />;
    case 'letters':
      return <LettersScene card={card} />;
    default:
      return <EmojiScene emoji={card.emoji} />;
  }
};
