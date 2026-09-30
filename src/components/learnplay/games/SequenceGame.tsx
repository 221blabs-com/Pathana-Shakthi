import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { soundEffects } from '../../../services/soundEffects';
import { Feedback, GameProps, shuffle } from '../ui';

// The water cycle, animated: sun heats the sea, vapour rises, a cloud forms
// and rain falls back. Also used by the Learn step.
export const WaterCycleScene: React.FC<{ highlight?: number }> = ({ highlight }) => (
  <svg viewBox="0 0 320 200" className="h-full w-full" role="img" aria-label="The water cycle">
    <rect width="320" height="200" fill="#e0f2fe" />
    <motion.g animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ originX: '40px', originY: '40px' }} opacity={highlight === undefined || highlight === 0 ? 1 : 0.45}>
      <circle cx="40" cy="40" r="22" fill="#facc15" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="40" y1="8" x2="40" y2="0" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" transform={`rotate(${a} 40 40)`} />
      ))}
    </motion.g>
    {/* hills + sea */}
    <path d="M0 150 q60 -40 120 0 v50 h-120z" fill="#86efac" />
    <rect x="120" y="160" width="200" height="40" fill="#3b82f6" />
    <motion.path d="M120 168 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" stroke="#bfdbfe" strokeWidth="2" fill="none" animate={{ x: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 3 }} />
    {/* vapour */}
    <g opacity={highlight === undefined || highlight === 1 ? 1 : 0.35}>
      {[180, 215, 250].map((x, i) => (
        <motion.path key={x} d={`M${x} 150 q-8 -10 0 -20 q8 -10 0 -20`} stroke="#94a3b8" strokeWidth="3" fill="none" strokeLinecap="round"
          animate={{ y: [0, -30], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 2.2, delay: i * 0.5 }} />
      ))}
    </g>
    {/* cloud */}
    <motion.g animate={{ x: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 4 }} opacity={highlight === undefined || highlight === 2 ? 1 : 0.45}>
      <ellipse cx="130" cy="45" rx="42" ry="20" fill="#f8fafc" />
      <ellipse cx="105" cy="52" rx="25" ry="16" fill="#e2e8f0" />
      <ellipse cx="158" cy="53" rx="26" ry="15" fill="#e2e8f0" />
    </motion.g>
    {/* rain */}
    <g opacity={highlight === undefined || highlight === 3 ? 1 : 0.3}>
      {[95, 115, 135, 155, 170].map((x, i) => (
        <motion.line key={x} x1={x} y1="70" x2={x - 4} y2="80" stroke="#2563eb" strokeWidth="3" strokeLinecap="round"
          animate={{ y: [0, 70], opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.18 }} />
      ))}
    </g>
  </svg>
);

export const SequenceGame: React.FC<GameProps & { steps: { emoji: string; label: string }[] }> = ({ steps, onFinish, onMascot }) => {
  const cards = useMemo(() => shuffle(steps.map((s, i) => ({ ...s, order: i }))), [steps]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  useEffect(() => {
    onMascot('Tap the steps in the right order: what happens first?', 'happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = (order: number) => {
    if (placed.includes(order)) return;
    if (order === placed.length) {
      soundEffects.playCorrect();
      const next = [...placed, order];
      setPlaced(next);
      if (next.length === steps.length) {
        setFeedback('correct');
        onMascot('You know the whole cycle! It goes round and round.', 'cheer');
        window.setTimeout(() => onFinish(Math.max(0, steps.length - mistakes), steps.length), 1600);
      } else {
        onMascot(`Yes! Step ${next.length} is done. What comes next?`, 'happy');
      }
    } else {
      soundEffects.playTryAgain();
      setMistakes((m) => m + 1);
      setShake(order);
      setFeedback('wrong');
      onMascot('Not yet! Think about what happens before that.', 'sad');
      window.setTimeout(() => {
        setShake(null);
        setFeedback(null);
      }, 800);
    }
  };

  return (
    <div className="relative">
      <Feedback state={feedback} text={feedback === 'correct' ? 'Perfect order! 🌧️' : undefined} />
      <div className="card-3d mx-auto mb-4 h-44 max-w-lg overflow-hidden rounded-[2rem] border-4 border-sky-200 sm:h-52">
        <WaterCycleScene highlight={placed.length > 0 ? placed[placed.length - 1] : undefined} />
      </div>
      <LayoutGroup>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Your order">
          {steps.map((_, slot) => {
            const order = placed[slot];
            const step = order === undefined ? null : steps[order];
            return (
              <div key={slot} className="flex min-h-20 items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/60 p-2 text-center">
                {step ? (
                  <motion.div layoutId={`seq-${order}`} className="text-sm font-black text-sky-900">
                    <div className="text-3xl">{step.emoji}</div>
                    {slot + 1}. {step.label}
                  </motion.div>
                ) : (
                  <span className="text-2xl font-black text-sky-300">{slot + 1}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards
            .filter((c) => !placed.includes(c.order))
            .map((card) => (
              <motion.button
                layoutId={`seq-${card.order}`}
                key={card.order}
                type="button"
                onClick={() => tap(card.order)}
                animate={shake === card.order ? { x: [0, -10, 10, -6, 0] } : {}}
                className="sequence-card btn-3d bg-white p-3 text-sm text-stone-800 border-2 border-stone-200"
              >
                <div className="text-3xl">{card.emoji}</div>
                {card.label}
              </motion.button>
            ))}
        </div>
      </LayoutGroup>
    </div>
  );
};
