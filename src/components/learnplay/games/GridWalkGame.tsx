import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { soundEffects } from '../../../services/soundEffects';
import { ChunkyButton, Feedback, GameProps, RoundDots } from '../ui';

const SIZE = 5;
type Cell = [number, number]; // [row, col]; row 0 is North (top of the map)

const OBSTACLES: Record<string, string> = { '1,1': '🌳', '2,2': '🌊', '3,3': '🌳', '1,3': '🪨', '3,1': '🐄' };
const ROUNDS: { goal: Cell; emoji: string; name: string }[] = [
  { goal: [0, 4], emoji: '🏫', name: 'school' },
  { goal: [0, 0], emoji: '🛕', name: 'temple' },
  { goal: [2, 4], emoji: '🏥', name: 'hospital' },
];
const START: Cell = [4, 0];
const MOVES = {
  North: [-1, 0],
  South: [1, 0],
  East: [0, 1],
  West: [0, -1],
} as const;
type Direction = keyof typeof MOVES;

const key = (c: Cell) => `${c[0]},${c[1]}`;
const blocked = (c: Cell) => c[0] < 0 || c[1] < 0 || c[0] >= SIZE || c[1] >= SIZE || Boolean(OBSTACLES[key(c)]);

// Fewest steps from start to goal around the obstacles (breadth-first search).
export function shortestPath(start: Cell, goal: Cell): number {
  const seen = new Set([key(start)]);
  let frontier: Cell[] = [start];
  for (let steps = 0; frontier.length > 0; steps++) {
    const next: Cell[] = [];
    for (const cell of frontier) {
      if (cell[0] === goal[0] && cell[1] === goal[1]) return steps;
      for (const [dr, dc] of Object.values(MOVES)) {
        const n: Cell = [cell[0] + dr, cell[1] + dc];
        if (!blocked(n) && !seen.has(key(n))) {
          seen.add(key(n));
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return Infinity;
}

const describe = (from: Cell, to: Cell) => {
  const parts: string[] = [];
  if (to[0] < from[0]) parts.push('North');
  if (to[0] > from[0]) parts.push('South');
  if (to[1] > from[1]) parts.push('East');
  if (to[1] < from[1]) parts.push('West');
  return parts.join('-') || 'here';
};

export const GridWalkGame: React.FC<GameProps> = ({ onFinish, onMascot }) => {
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [position, setPosition] = useState<Cell>(START);
  const [steps, setSteps] = useState(0);
  const [bump, setBump] = useState(0);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const target = ROUNDS[round];
  const best = useMemo(() => shortestPath(START, target.goal), [target]);

  useEffect(() => {
    setPosition(START);
    setSteps(0);
    setDone(false);
    onMascot(`Walk to the ${target.name} ${target.emoji}! It is to the ${describe(START, target.goal)}.`, 'happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const move = (direction: Direction) => {
    if (done) return;
    const [dr, dc] = MOVES[direction];
    const next: Cell = [position[0] + dr, position[1] + dc];
    if (blocked(next)) {
      soundEffects.playTryAgain();
      setBump((b) => b + 1);
      const what = OBSTACLES[key(next)];
      onMascot(what ? `Oops, a ${what} is in the way! Go around.` : 'That is the edge of the map!', 'sad');
      return;
    }
    soundEffects.playWordPop();
    setPosition(next);
    const count = steps + 1;
    setSteps(count);
    if (next[0] === target.goal[0] && next[1] === target.goal[1]) {
      const good = count <= best + 2;
      setDone(true);
      setFeedback('correct');
      soundEffects.playCorrect();
      onMascot(good ? `You reached the ${target.name} in ${count} steps!` : `You made it in ${count} steps. The shortest way is ${best}.`, 'cheer');
      const nextResults = [...results, good];
      setResults(nextResults);
      window.setTimeout(() => {
        setFeedback(null);
        if (round + 1 >= ROUNDS.length) {
          onFinish(nextResults.filter(Boolean).length, ROUNDS.length);
          return;
        }
        setRound((r) => r + 1);
      }, 1700);
    } else {
      onMascot(`Now the ${target.name} is to the ${describe(next, target.goal)}.`, 'think');
    }
  };

  return (
    <div className="relative">
      <Feedback state={feedback} text={feedback ? `Reached the ${target.name}! ${target.emoji}` : undefined} />
      <div className="mb-3 flex items-center justify-between">
        <RoundDots total={ROUNDS.length} current={round} results={results} />
        <span className="text-xs font-black text-stone-500" id="grid-steps">Steps: {steps}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="relative mx-auto w-full max-w-sm">
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-black text-rose-600">N ▲</span>
          <motion.div
            key={bump}
            animate={bump ? { x: [0, -6, 6, -3, 0] } : {}}
            className="card-3d grid aspect-square grid-cols-5 gap-1 rounded-3xl border-4 border-teal-300 bg-lime-200 p-2"
          >
            {Array.from({ length: SIZE * SIZE }, (_, i) => {
              const cell: Cell = [Math.floor(i / SIZE), i % SIZE];
              const k = key(cell);
              const isGoal = cell[0] === target.goal[0] && cell[1] === target.goal[1];
              const isStart = cell[0] === START[0] && cell[1] === START[1];
              return (
                <div key={k} className="relative flex items-center justify-center rounded-xl bg-lime-100/80 text-2xl sm:text-3xl">
                  {OBSTACLES[k] || (isGoal ? <span className="float-fast">{target.emoji}</span> : isStart ? '🏠' : '')}
                  {position[0] === cell[0] && position[1] === cell[1] && (
                    <motion.span layoutId="walker" className="absolute text-3xl drop-shadow sm:text-4xl" transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
                      🧒
                    </motion.span>
                  )}
                </div>
              );
            })}
          </motion.div>
        </div>
        <div className="mx-auto grid w-56 grid-cols-3 grid-rows-3 gap-2">
          <span />
          <ChunkyButton color="rose" onClick={() => move('North')} className="walk-north px-2 text-sm" aria-label="North">⬆️<br />N</ChunkyButton>
          <span />
          <ChunkyButton color="sky" onClick={() => move('West')} className="walk-west px-2 text-sm" aria-label="West">⬅️<br />W</ChunkyButton>
          <div className="flex items-center justify-center text-3xl" aria-hidden="true">🧭</div>
          <ChunkyButton color="sky" onClick={() => move('East')} className="walk-east px-2 text-sm" aria-label="East">➡️<br />E</ChunkyButton>
          <span />
          <ChunkyButton color="amber" onClick={() => move('South')} className="walk-south px-2 text-sm" aria-label="South">⬇️<br />S</ChunkyButton>
          <span />
        </div>
      </div>
    </div>
  );
};
