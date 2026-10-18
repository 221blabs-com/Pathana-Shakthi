import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { makeAdditionProblem, MathsProblem } from '../../../data/learnPlay';
import { soundEffects } from '../../../services/soundEffects';
import { ChunkyButton, Feedback, GameProps, RoundDots } from '../ui';

const ROUNDS = 5;
const FRUITS = ['🥭', '🍎', '🍌', '🍊', '🍓', '🥥'];

type Phase = 'show' | 'merged' | 'answered';

// One mango / cube / rod that can fly between containers (shared layoutId).
const Piece: React.FC<{ id: string; children: React.ReactNode; delay?: number; className?: string }> = ({
  id,
  children,
  delay = 0,
  className = '',
}) => (
  <motion.div
    layoutId={id}
    initial={{ scale: 0, rotate: -20 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: 'spring', stiffness: 260, damping: 18, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const Rod = () => (
  <div className="flex h-24 w-5 flex-col overflow-hidden rounded-md border-2 border-emerald-700 bg-emerald-400 shadow-[3px_4px_0_rgba(4,120,87,0.5)] sm:h-28 sm:w-6">
    {Array.from({ length: 10 }, (_, i) => (
      <div key={i} className="flex-1 border-b border-emerald-600/60 last:border-b-0" />
    ))}
  </div>
);
const Cube = () => (
  <div className="h-5 w-5 rounded-[5px] border-2 border-amber-700 bg-amber-300 shadow-[2px_3px_0_rgba(180,83,9,0.5)] sm:h-6 sm:w-6" />
);

export const AdditionGame: React.FC<GameProps> = ({ grade, onFinish, onMascot }) => {
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [problem, setProblem] = useState<MathsProblem>(() => makeAdditionProblem(grade));
  const [phase, setPhase] = useState<Phase>('show');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [missed, setMissed] = useState(false);
  const [regrouped, setRegrouped] = useState(false);
  const fruit = useMemo(() => FRUITS[round % FRUITS.length], [round]);
  const blocks = problem.answer > 20;

  useEffect(() => {
    onMascot(blocks ? 'Tens are rods, ones are cubes. Put them together!' : `How many ${fruit} in all? Put them together!`, 'happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const merge = () => {
    soundEffects.playWordPop();
    setPhase('merged');
    const ones = (problem.a % 10) + (problem.b % 10);
    if (blocks && ones >= 10) {
      onMascot('10 cubes make 1 rod! Watch…', 'think');
      window.setTimeout(() => {
        setRegrouped(true);
        soundEffects.playCheerChime();
        onMascot('Ten ones became one ten! Now count.', 'happy');
      }, 1400);
    } else {
      onMascot('Count them all and pick the answer!', 'think');
    }
  };

  const choose = (value: number) => {
    if (phase !== 'merged' || feedback === 'correct') return;
    if (value === problem.answer) {
      soundEffects.playCorrect();
      setFeedback('correct');
      setPhase('answered');
      onMascot(`Yes! ${problem.a} + ${problem.b} = ${problem.answer}`, 'cheer');
      const nextResults = [...results, !missed];
      setResults(nextResults);
      window.setTimeout(() => {
        setFeedback(null);
        if (round + 1 >= ROUNDS) {
          onFinish(nextResults.filter(Boolean).length, ROUNDS);
          return;
        }
        setRound((r) => r + 1);
        setProblem(makeAdditionProblem(grade));
        setPhase('show');
        setMissed(false);
        setRegrouped(false);
      }, 1500);
    } else {
      soundEffects.playTryAgain();
      setMissed(true);
      setFeedback('wrong');
      onMascot('Almost! Count again slowly.', 'sad');
      window.setTimeout(() => setFeedback(null), 900);
    }
  };

  // ---- Pieces for each group -------------------------------------------
  const objectPieces = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, i) => ({ id: `${round}-${prefix}-${i}` }));
  const blockPieces = (n: number, prefix: string) => ({
    rods: Array.from({ length: Math.floor(n / 10) }, (_, i) => `${round}-${prefix}-rod-${i}`),
    cubes: Array.from({ length: n % 10 }, (_, i) => `${round}-${prefix}-cube-${i}`),
  });

  const left = objectPieces(problem.a, 'a');
  const right = objectPieces(problem.b, 'b');
  const leftBlocks = blockPieces(problem.a, 'a');
  const rightBlocks = blockPieces(problem.b, 'b');
  const allCubes = [...leftBlocks.cubes, ...rightBlocks.cubes];
  const mergedCubes = regrouped ? allCubes.slice(10) : allCubes;
  const extraRod = regrouped ? [`${round}-carry-rod`] : [];

  const renderGroup = (pieces: { id: string }[], blocksOf: { rods: string[]; cubes: string[] }) =>
    blocks ? (
      <div className="flex min-h-28 flex-wrap items-end justify-center gap-1.5">
        {blocksOf.rods.map((id, i) => (
          <Piece key={id} id={id} delay={i * 0.04}>
            <Rod />
          </Piece>
        ))}
        <div className="flex max-w-[5.5rem] flex-wrap gap-1">
          {blocksOf.cubes.map((id, i) => (
            <Piece key={id} id={id} delay={0.2 + i * 0.03}>
              <Cube />
            </Piece>
          ))}
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-3 justify-items-center gap-0.5 sm:grid-cols-5 sm:gap-1">
        {pieces.map((p, i) => (
          <Piece key={p.id} id={p.id} delay={i * 0.05} className="text-xl leading-none sm:text-3xl">
            {fruit}
          </Piece>
        ))}
      </div>
    );

  return (
    <div className="relative">
      <Feedback state={feedback} />
      <div className="mb-3 flex items-center justify-between">
        <RoundDots total={ROUNDS} current={round} results={results} />
        <span className="text-xs font-black text-stone-500">Round {round + 1} / {ROUNDS}</span>
      </div>

      <div className="mb-4 text-center text-3xl font-black tracking-tight text-stone-900 sm:text-4xl" id="addition-equation">
        {problem.a} <span className="text-amber-500">+</span> {problem.b} ={' '}
        <span className="text-violet-600">{phase === 'answered' ? problem.answer : '?'}</span>
      </div>

      <LayoutGroup id={`add-${round}`}>
        {phase === 'show' ? (
          <div className="scene-3d grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-4">
            <div className="card-3d min-h-36 min-w-0 rounded-3xl border-4 border-amber-300 bg-amber-50 p-2 sm:p-3">
              <p className="mb-2 text-center text-xs font-black uppercase text-amber-800">{problem.a}</p>
              {renderGroup(left, leftBlocks)}
            </div>
            <span className="text-4xl font-black text-amber-500">+</span>
            <div className="card-3d min-h-36 min-w-0 rounded-3xl border-4 border-sky-300 bg-sky-50 p-2 sm:p-3">
              <p className="mb-2 text-center text-xs font-black uppercase text-sky-800">{problem.b}</p>
              {renderGroup(right, rightBlocks)}
            </div>
          </div>
        ) : (
          <div className="card-3d mx-auto min-h-40 max-w-xl rounded-[2rem] border-4 border-violet-300 bg-gradient-to-b from-violet-50 to-white p-4">
            <p className="mb-2 text-center text-xs font-black uppercase text-violet-800">All together</p>
            {blocks ? (
              <div className="flex flex-wrap items-end justify-center gap-1.5">
                {[...leftBlocks.rods, ...rightBlocks.rods, ...extraRod].map((id) => (
                  <Piece key={id} id={id}>
                    <Rod />
                  </Piece>
                ))}
                <div className="flex max-w-[8rem] flex-wrap gap-1">
                  <AnimatePresence>
                    {mergedCubes.map((id) => (
                      <motion.div key={id} layoutId={id} exit={{ scale: 0, y: -30, opacity: 0 }}>
                        <Cube />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 justify-items-center gap-1.5 sm:grid-cols-10">
                {[...left, ...right].map((p, i) => (
                  <Piece key={p.id} id={p.id} className="relative text-2xl leading-none sm:text-3xl">
                    {fruit}
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.12 }}
                      className="absolute -right-1 -top-1 rounded-full bg-violet-600 px-1 text-[10px] font-black leading-4 text-white"
                    >
                      {i + 1}
                    </motion.span>
                  </Piece>
                ))}
              </div>
            )}
          </div>
        )}
      </LayoutGroup>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {phase === 'show' ? (
          <ChunkyButton color="violet" onClick={merge} id="btn-merge" className="text-lg">
            Put them together ✨
          </ChunkyButton>
        ) : (
          problem.options.map((value) => (
            <ChunkyButton
              key={value}
              color={phase === 'answered' && value === problem.answer ? 'emerald' : 'white'}
              onClick={() => choose(value)}
              disabled={phase === 'answered' || (blocks && (problem.a % 10) + (problem.b % 10) >= 10 && !regrouped)}
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
