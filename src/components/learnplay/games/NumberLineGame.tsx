import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { soundEffects } from '../../../services/soundEffects';
import { Feedback, GameProps, RoundDots } from '../ui';

const ROUNDS = 5;

interface Jump {
  start: number;
  step: number; // + forward, - back
  end: number;
}

export function makeJump(max: number, random: () => number = Math.random): Jump {
  const forward = random() < 0.55;
  const maxStep = Math.min(max === 10 ? 5 : 9, max - 1);
  const step = 1 + Math.floor(random() * maxStep);
  const start = forward
    ? Math.floor(random() * (max - step + 1))
    : step + Math.floor(random() * (max - step + 1));
  return { start, step: forward ? step : -step, end: forward ? start + step : start - step };
}

export const NumberLineGame: React.FC<GameProps> = ({ grade, onFinish, onMascot }) => {
  const max = grade === 'Class 1' || grade === 'Class 2' ? 10 : 20;
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [jump, setJump] = useState<Jump>(() => makeJump(max));
  const [frog, setFrog] = useState(jump.start);
  const [hops, setHops] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFrog(jump.start);
    onMascot(
      `The frog is on ${jump.start}. It jumps ${Math.abs(jump.step)} ${jump.step > 0 ? 'forward' : 'back'}. Tap where it lands!`,
      'happy'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Keep the frog in view on narrow screens.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const x = (frog / max) * (el.scrollWidth - 48);
    el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: 'smooth' });
  }, [frog, max]);

  const pick = (n: number) => {
    if (busy) return;
    setBusy(true);
    setPicked(n);
    soundEffects.playWordPop();
    const direction = Math.sign(jump.step);
    let position = jump.start;
    let count = 0;
    const timer = window.setInterval(() => {
      position += direction;
      count += 1;
      setFrog(position);
      setHops((h) => h + 1);
      soundEffects.playWaterDrop();
      if (count >= Math.abs(jump.step)) {
        window.clearInterval(timer);
        const right = n === jump.end;
        setFeedback(right ? 'correct' : 'wrong');
        right ? soundEffects.playCorrect() : soundEffects.playTryAgain();
        onMascot(
          right
            ? `Yes! ${jump.start} ${jump.step > 0 ? '+' : '−'} ${Math.abs(jump.step)} = ${jump.end}`
            : `The frog landed on ${jump.end}. ${jump.start} ${jump.step > 0 ? '+' : '−'} ${Math.abs(jump.step)} = ${jump.end}`,
          right ? 'cheer' : 'think'
        );
        const next = [...results, right];
        setResults(next);
        window.setTimeout(() => {
          setFeedback(null);
          setPicked(null);
          setBusy(false);
          if (round + 1 >= ROUNDS) {
            onFinish(next.filter(Boolean).length, ROUNDS);
            return;
          }
          setJump(makeJump(max));
          setRound((r) => r + 1);
        }, right ? 1500 : 2300);
      }
    }, 420);
  };

  const ticks = Array.from({ length: max + 1 }, (_, i) => i);

  return (
    <div className="relative">
      <Feedback state={feedback} text={feedback === 'wrong' ? `It landed on ${jump.end}!` : undefined} />
      <div className="mb-3 flex items-center justify-between">
        <RoundDots total={ROUNDS} current={round} results={results} />
        <span className="text-xs font-black text-stone-500">Round {round + 1} / {ROUNDS}</span>
      </div>
      <div className="mb-3 text-center text-3xl font-black text-stone-900 sm:text-4xl" id="numberline-equation">
        {jump.start} <span className={jump.step > 0 ? 'text-emerald-500' : 'text-rose-500'}>{jump.step > 0 ? '+' : '−'}</span>{' '}
        {Math.abs(jump.step)} = <span className="text-teal-600">{feedback ? jump.end : '?'}</span>
      </div>

      <div ref={scroller} className="card-3d overflow-x-auto rounded-[2rem] border-4 border-teal-200 bg-gradient-to-b from-teal-50 to-lime-50 px-6 pb-4 pt-20">
        <div className="relative mx-auto h-24" style={{ minWidth: `${(max + 1) * 38}px` }}>
          {/* the line */}
          <div className="absolute left-0 right-0 top-6 h-2 rounded-full bg-teal-700/70" />
          {/* frog */}
          <motion.div
            className="absolute -top-14 z-10 text-4xl"
            animate={{ left: `calc(${(frog / max) * 100}% - 20px)` }}
            transition={{ type: 'spring', stiffness: 170, damping: 16 }}
            aria-hidden="true"
          >
            <motion.div key={hops} animate={{ y: [0, -28, 0], rotate: [0, jump.step > 0 ? 12 : -12, 0] }} transition={{ duration: 0.38 }}>
              🐸
            </motion.div>
          </motion.div>
          {ticks.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              disabled={busy}
              className={`numberline-tick absolute top-0 flex -translate-x-1/2 flex-col items-center disabled:cursor-default`}
              style={{ left: `${(n / max) * 100}%` }}
              aria-label={`Number ${n}`}
            >
              <span className="h-8 w-1 rounded-full bg-teal-700/70" />
              <span
                className={`mt-1 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black shadow-[0_3px_0_rgba(0,0,0,0.15)] transition-all ${
                  feedback && n === jump.end
                    ? 'bg-emerald-500 text-white scale-110'
                    : picked === n
                    ? 'bg-amber-400 text-amber-950'
                    : n === jump.start
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-stone-700 hover:bg-amber-100'
                }`}
              >
                {n}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-sm font-bold text-stone-500">Tap the number where the frog will land 👆</p>
    </div>
  );
};
