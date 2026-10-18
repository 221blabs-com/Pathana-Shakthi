import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { soundEffects } from '../../../services/soundEffects';
import { Feedback, GameProps, RoundDots, shuffle } from '../ui';

type Part = 'roots' | 'stem' | 'leaves' | 'flower' | 'fruit';

const FACTS: Record<Part, { label: string; fact: string }> = {
  roots: { label: 'Roots', fact: 'Roots hold the plant and drink water from the soil.' },
  stem: { label: 'Stem', fact: 'The stem carries water from the roots to the leaves.' },
  leaves: { label: 'Leaves', fact: 'Green leaves make food using sunlight.' },
  flower: { label: 'Flower', fact: 'Flowers turn into fruits.' },
  fruit: { label: 'Fruit', fact: 'Fruits keep the seeds safe inside.' },
};

// A plant whose parts are tap targets. `found` parts glow and get a label.
export const PlantSvg: React.FC<{ onPart?: (p: Part) => void; found?: Part[]; wrong?: Part | null; grow?: boolean }> = ({
  onPart,
  found = [],
  wrong = null,
  grow = false,
}) => {
  const style = (part: Part) => ({
    cursor: onPart ? 'pointer' : 'default',
    filter: found.includes(part) ? 'drop-shadow(0 0 6px #facc15) drop-shadow(0 0 2px #facc15)' : undefined,
    opacity: wrong === part ? 0.5 : 1,
  });
  const tap = (part: Part) => () => onPart?.(part);
  return (
    <svg viewBox="0 0 300 380" className="h-full w-full" role="img" aria-label="A plant with roots, stem, leaves, flower and fruit">
      <defs>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a16207" />
          <stop offset="1" stopColor="#713f12" />
        </linearGradient>
        <radialGradient id="fruitG" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fca5a5" />
          <stop offset="1" stopColor="#dc2626" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="300" height="262" fill="#e0f2fe" />
      <circle cx="255" cy="45" r="26" fill="#fde047" />
      <rect x="0" y="262" width="300" height="118" fill="url(#soil)" />
      {/* roots */}
      <g style={style('roots')} onClick={tap('roots')} className="plant-part" data-part="roots">
        <rect x="95" y="262" width="110" height="110" fill="transparent" />
        <motion.g initial={grow ? { scaleY: 0 } : false} animate={{ scaleY: 1 }} style={{ originY: '262px' }} transition={{ duration: 0.8 }}>
          {['M150 262 q-6 40 -40 70', 'M150 262 q4 45 0 95', 'M150 262 q10 35 45 60', 'M130 300 q-20 10 -30 30', 'M168 300 q20 12 25 34'].map((d) => (
            <path key={d} d={d} stroke="#fef3c7" strokeWidth="5" fill="none" strokeLinecap="round" />
          ))}
        </motion.g>
      </g>
      {/* stem */}
      <g style={style('stem')} onClick={tap('stem')} className="plant-part" data-part="stem">
        <rect x="135" y="95" width="30" height="170" fill="transparent" />
        <motion.rect initial={grow ? { scaleY: 0 } : false} animate={{ scaleY: 1 }} style={{ originY: '262px' }} transition={{ duration: 0.8, delay: 0.3 }} x="144" y="95" width="12" height="168" rx="6" fill="#15803d" />
        <path d="M150 170 q40 -20 62 -48" stroke="#15803d" strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>
      {/* leaves */}
      <g style={style('leaves')} onClick={tap('leaves')} className="plant-part" data-part="leaves">
        {[
          { cx: 110, cy: 200, r: -35 },
          { cx: 190, cy: 225, r: 35 },
          { cx: 108, cy: 140, r: -30 },
        ].map((leaf, i) => (
          <motion.ellipse
            key={i}
            initial={grow ? { scale: 0 } : false}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8 + i * 0.15, type: 'spring' }}
            cx={leaf.cx}
            cy={leaf.cy}
            rx="36"
            ry="15"
            fill="#22c55e"
            stroke="#15803d"
            strokeWidth="3"
            transform={`rotate(${leaf.r} ${leaf.cx} ${leaf.cy})`}
          />
        ))}
      </g>
      {/* flower */}
      <g style={style('flower')} onClick={tap('flower')} className="plant-part" data-part="flower">
        <motion.g initial={grow ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: 1.2, type: 'spring' }} style={{ originX: '150px', originY: '72px' }}>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx="150" cy="52" rx="13" ry="22" fill="#f472b6" transform={`rotate(${a} 150 72)`} />
          ))}
          <circle cx="150" cy="72" r="13" fill="#facc15" />
        </motion.g>
      </g>
      {/* fruit */}
      <g style={style('fruit')} onClick={tap('fruit')} className="plant-part" data-part="fruit">
        <motion.circle initial={grow ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: 1.4, type: 'spring' }} cx="218" cy="136" r="20" fill="url(#fruitG)" />
        <path d="M218 116 q4 -8 10 -8" stroke="#15803d" strokeWidth="3" fill="none" />
      </g>
      {found.map((part) => {
        const spots: Record<Part, [number, number]> = {
          roots: [210, 350],
          stem: [168, 250],
          leaves: [40, 115],
          flower: [180, 28],
          fruit: [242, 172],
        };
        const [x, y] = spots[part];
        return (
          <g key={part}>
            <rect x={x - 4} y={y - 16} width={FACTS[part].label.length * 10 + 10} height="22" rx="8" fill="#fff" stroke="#16a34a" strokeWidth="2" />
            <text x={x + 1} y={y} fontSize="15" fontWeight="900" fill="#166534">
              {FACTS[part].label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const PlantPartsGame: React.FC<GameProps> = ({ onFinish, onMascot }) => {
  const order = useMemo(() => shuffle(Object.keys(FACTS) as Part[]), []);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [found, setFound] = useState<Part[]>([]);
  const [wrong, setWrong] = useState<Part | null>(null);
  const [missed, setMissed] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [locked, setLocked] = useState(false);
  const target = order[round];

  useEffect(() => {
    if (target) onMascot(`Tap the ${FACTS[target].label.toUpperCase()} of the plant!`, 'happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const tap = (part: Part) => {
    if (locked || found.includes(part)) return;
    if (part === target) {
      soundEffects.playCorrect();
      setLocked(true);
      setFound((f) => [...f, part]);
      setFeedback('correct');
      onMascot(FACTS[part].fact, 'cheer');
      const next = [...results, !missed];
      setResults(next);
      window.setTimeout(() => {
        setFeedback(null);
        setLocked(false);
        setMissed(false);
        if (round + 1 >= order.length) {
          onFinish(next.filter(Boolean).length, order.length);
          return;
        }
        setRound((r) => r + 1);
      }, 1900);
    } else {
      soundEffects.playTryAgain();
      setMissed(true);
      setWrong(part);
      setFeedback('wrong');
      onMascot(`That is the ${FACTS[part].label.toLowerCase()}. Find the ${FACTS[target].label.toLowerCase()}!`, 'sad');
      window.setTimeout(() => {
        setWrong(null);
        setFeedback(null);
      }, 900);
    }
  };

  return (
    <div className="relative">
      <Feedback state={feedback} />
      <div className="mb-3 flex items-center justify-between">
        <RoundDots total={order.length} current={round} results={results} />
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-800" id="plant-target">
          Find: {target ? FACTS[target].label : '—'}
        </span>
      </div>
      <div className="card-3d mx-auto h-80 max-w-sm overflow-hidden rounded-[2rem] border-4 border-emerald-200 bg-white sm:h-96">
        <PlantSvg onPart={tap} found={found} wrong={wrong} />
      </div>
    </div>
  );
};
