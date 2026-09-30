import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { soundEffects } from '../../../services/soundEffects';
import { Feedback, GameProps, shuffle } from '../ui';

const PAIR_COLORS = ['bg-emerald-100 border-emerald-400', 'bg-sky-100 border-sky-400', 'bg-amber-100 border-amber-400', 'bg-pink-100 border-pink-400', 'bg-violet-100 border-violet-400'];

// Tap one on the left, then its partner on the right.
export const MatchGame: React.FC<
  GameProps & { prompt: string; pairs: { left: string; right: string; leftLabel: string; rightLabel: string }[] }
> = ({ prompt, pairs, onFinish, onMascot }) => {
  const rights = useMemo(() => shuffle(pairs.map((p, i) => ({ ...p, index: i }))), [pairs]);
  const [selected, setSelected] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  useEffect(() => {
    onMascot(`${prompt}. Tap one on the left, then its partner!`, 'happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickRight = (index: number) => {
    if (selected === null) {
      onMascot('First tap one on the left side 👈', 'think');
      return;
    }
    if (matched.includes(index)) return;
    if (index === selected) {
      soundEffects.playCorrect();
      const next = [...matched, index];
      setMatched(next);
      setSelected(null);
      onMascot(`${pairs[index].leftLabel} ↔ ${pairs[index].rightLabel}. Great!`, 'cheer');
      if (next.length === pairs.length) {
        setFeedback('correct');
        window.setTimeout(() => onFinish(Math.max(0, pairs.length - mistakes), pairs.length), 1400);
      }
    } else {
      soundEffects.playTryAgain();
      setMistakes((m) => m + 1);
      setShake(`r${index}`);
      setFeedback('wrong');
      onMascot(`Hmm, ${pairs[selected].leftLabel} doesn't go with ${pairs[index].rightLabel}. Try another!`, 'sad');
      window.setTimeout(() => {
        setShake(null);
        setFeedback(null);
      }, 800);
    }
  };

  const tile = (emoji: string, label: string, state: string, onClick: () => void, key: string, testClass: string) => (
    <motion.button
      key={key}
      type="button"
      onClick={onClick}
      animate={shake === key ? { x: [0, -10, 10, -6, 0] } : { scale: state === 'selected' ? 1.05 : 1 }}
      className={`${testClass} btn-3d flex w-full items-center gap-2 border-2 px-3 py-2.5 text-left ${state}`}
    >
      <span className="text-3xl sm:text-4xl">{emoji}</span>
      <span className="text-sm font-black text-stone-800 sm:text-base">{label}</span>
    </motion.button>
  );

  return (
    <div className="relative">
      <Feedback state={feedback} text={feedback === 'correct' ? 'All matched! 🎉' : undefined} />
      <p className="mb-3 text-center text-sm font-black text-stone-600">
        {matched.length} / {pairs.length} matched
      </p>
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        <div className="space-y-3">
          {pairs.map((p, i) =>
            tile(
              p.left,
              p.leftLabel,
              matched.includes(i) ? `${PAIR_COLORS[i % PAIR_COLORS.length]} opacity-80` : selected === i ? 'bg-amber-200 border-amber-500' : 'bg-white border-stone-200',
              () => {
                if (matched.includes(i)) return;
                soundEffects.playWordPop();
                setSelected(i);
              },
              `l${i}`,
              'match-left'
            )
          )}
        </div>
        <div className="space-y-3">
          {rights.map((p) =>
            tile(
              p.right,
              p.rightLabel,
              matched.includes(p.index) ? `${PAIR_COLORS[p.index % PAIR_COLORS.length]} opacity-80` : 'bg-white border-stone-200',
              () => pickRight(p.index),
              `r${p.index}`,
              'match-right'
            )
          )}
        </div>
      </div>
    </div>
  );
};
