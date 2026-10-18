import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { makeSubtractionProblem, MathsProblem } from '../../../data/learnPlay';
import { soundEffects } from '../../../services/soundEffects';
import { ChunkyButton, Feedback, GameProps, RoundDots } from '../ui';

const ROUNDS = 5;
const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];

const Balloon: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="0 0 40 70" className="h-14 w-8 drop-shadow-[2px_4px_0_rgba(0,0,0,0.15)] sm:h-16 sm:w-10" aria-hidden="true">
    <ellipse cx="20" cy="20" rx="16" ry="19" fill={color} />
    <ellipse cx="14" cy="13" rx="4" ry="6" fill="#fff" opacity="0.45" />
    <polygon points="17,38 23,38 20,43" fill={color} />
    <path d="M20 43 q-4 8 0 13 q4 6 0 13" stroke="#78716c" strokeWidth="1.2" fill="none" />
  </svg>
);

export const SubtractionGame: React.FC<GameProps> = ({ grade, onFinish, onMascot }) => {
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [problem, setProblem] = useState<MathsProblem>(() => makeSubtractionProblem(grade));
  const [flown, setFlown] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [missed, setMissed] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  useEffect(() => {
    onMascot(`${problem.a} balloons! ${problem.b} will fly away…`, 'happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const flyAway = () => {
    soundEffects.playWordPop();
    setFlown(true);
    onMascot('Whoosh! How many are left?', 'think');
  };

  const choose = (value: number) => {
    if (!flown || answered) return;
    if (value === problem.answer) {
      soundEffects.playCorrect();
      setFeedback('correct');
      setAnswered(true);
      onMascot(`Yes! ${problem.a} − ${problem.b} = ${problem.answer}`, 'cheer');
      const next = [...results, !missed];
      setResults(next);
      window.setTimeout(() => {
        setFeedback(null);
        if (round + 1 >= ROUNDS) {
          onFinish(next.filter(Boolean).length, ROUNDS);
          return;
        }
        setRound((r) => r + 1);
        setProblem(makeSubtractionProblem(grade));
        setFlown(false);
        setAnswered(false);
        setMissed(false);
      }, 1500);
    } else {
      soundEffects.playTryAgain();
      setMissed(true);
      setFeedback('wrong');
      onMascot('Count the balloons still here!', 'sad');
      window.setTimeout(() => setFeedback(null), 900);
    }
  };

  const balloons = Array.from({ length: problem.a }, (_, i) => ({
    id: `${round}-${i}`,
    color: COLORS[(i + round) % COLORS.length],
    leaving: i >= problem.a - problem.b,
  }));

  return (
    <div className="relative">
      <Feedback state={feedback} />
      <div className="mb-3 flex items-center justify-between">
        <RoundDots total={ROUNDS} current={round} results={results} />
        <span className="text-xs font-black text-stone-500">Round {round + 1} / {ROUNDS}</span>
      </div>
      <div className="mb-3 text-center text-3xl font-black text-stone-900 sm:text-4xl" id="subtraction-equation">
        {problem.a} <span className="text-rose-500">−</span> {problem.b} ={' '}
        <span className="text-sky-600">{answered ? problem.answer : '?'}</span>
      </div>

      <div className="card-3d relative mx-auto h-60 max-w-xl overflow-hidden rounded-[2rem] border-4 border-sky-200 bg-gradient-to-b from-sky-100 via-sky-50 to-lime-100 sm:h-64">
        <div className="absolute left-6 top-4 text-3xl opacity-80">☁️</div>
        <div className="absolute right-10 top-8 text-2xl opacity-70">☁️</div>
        <div className="absolute inset-x-0 bottom-0 h-10 bg-lime-300/70" />
        <div className="absolute inset-x-0 bottom-6 flex flex-wrap items-end justify-center gap-x-0.5 gap-y-1 px-4">
          <AnimatePresence>
            {balloons
              .filter((b) => !(flown && b.leaving))
              .map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: [0, -6, 0], opacity: 1 }}
                  exit={{ y: -320, x: (i % 2 ? 40 : -40), rotate: i % 2 ? 20 : -20, opacity: 0, transition: { duration: 1.6, ease: 'easeIn' } }}
                  transition={{ y: { repeat: Infinity, duration: 2 + (i % 3) * 0.4 }, opacity: { duration: 0.3 } }}
                >
                  <Balloon color={b.color} />
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
        {!flown && (
          <div className="absolute right-3 top-3 rounded-2xl bg-white/85 px-2.5 py-1 text-xs font-black text-rose-600 shadow">
            {problem.b} will fly away 💨
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {!flown ? (
          <ChunkyButton color="sky" onClick={flyAway} id="btn-fly-away" className="text-lg">
            Let {problem.b} fly away 💨
          </ChunkyButton>
        ) : (
          problem.options.map((value) => (
            <ChunkyButton
              key={value}
              color={answered && value === problem.answer ? 'emerald' : 'white'}
              onClick={() => choose(value)}
              disabled={answered}
              className="answer-option min-w-20 text-2xl"
            >
              {value}
            </ChunkyButton>
          ))
        )}
      </div>
    </div>
  );
};
