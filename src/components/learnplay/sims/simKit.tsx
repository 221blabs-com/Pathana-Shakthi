// Shared pieces for the Class 6-10 simulation labs: a slider, a toggle row,
// an animation clock, and the challenge runner every simulation uses for its
// "Play" step (5 rounds of an animated question with 4 answers).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationFrame } from 'motion/react';
import { soundEffects } from '../../../services/soundEffects';
import { ChunkyButton, Feedback, RoundDots } from '../ui';

export type Mood = 'happy' | 'cheer' | 'think' | 'sad';

export interface SimProps {
  grade: string;
  /** Which version of a simulation a chapter uses (e.g. circuit "basic" for Class 6, "ohm" for Class 10). */
  variant?: string;
}

export interface SimChallengeProps extends SimProps {
  onFinish: (score: number, total: number) => void;
  onMascot: (message: string, mood?: Mood) => void;
}

export const gradeN = (grade: string) => Number(String(grade || '').replace(/\D/g, '')) || 6;
export const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
export const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Seconds since mount, updated every animation frame (paused while `running` is false). */
export function useClock(running = true): number {
  const [t, setT] = useState(0);
  const acc = useRef(0);
  const last = useRef<number | null>(null);
  useAnimationFrame((time) => {
    if (!running) {
      last.current = null;
      return;
    }
    if (last.current !== null) acc.current += Math.min(0.05, (time - last.current) / 1000);
    last.current = time;
    setT(acc.current);
  });
  return t;
}

export const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  id?: string;
}> = ({ label, value, min, max, step = 1, unit = '', onChange, format, id }) => (
  <label className="block min-w-[9rem] flex-1">
    <span className="flex items-baseline justify-between gap-2 text-xs font-black text-stone-700">
      <span>{label}</span>
      <span className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-stone-900">
        {format ? format(value) : value}
        {unit}
      </span>
    </span>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="sim-slider mt-1 w-full accent-amber-500"
    />
  </label>
);

export const Toggle: React.FC<{ options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }> = ({
  options,
  value,
  onChange,
}) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup">
    {options.map((o) => (
      <button
        key={o.id}
        type="button"
        role="radio"
        aria-checked={value === o.id}
        onClick={() => {
          soundEffects.playWordPop();
          onChange(o.id);
        }}
        className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
          value === o.id ? 'bg-stone-900 text-white shadow' : 'border border-stone-200 bg-white text-stone-700 hover:border-amber-300'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/** The simulation's drawing area plus its controls underneath. */
export const SimFrame: React.FC<{ children: React.ReactNode; controls?: React.ReactNode; caption?: React.ReactNode; dark?: boolean }> = ({
  children,
  controls,
  caption,
  dark,
}) => (
  <div className="sim-frame flex flex-col">
    <div className={`relative h-56 overflow-hidden sm:h-72 ${dark ? 'bg-slate-950' : 'bg-gradient-to-b from-sky-50 to-amber-50'}`}>{children}</div>
    {caption && <div className="border-t border-stone-100 bg-white/90 px-3 py-1.5 text-center text-xs font-black text-stone-700">{caption}</div>}
    {controls && <div className="flex flex-wrap items-end gap-3 border-t border-stone-100 bg-white px-3 py-2.5">{controls}</div>}
  </div>
);

export interface ChallengeRound {
  prompt: string;
  options: string[];
  correct: number;
  explain: string;
  /** The animated picture for this round; `revealed` is true once answered. */
  visual: (revealed: boolean) => React.ReactNode;
}

/** Puts the right answer among the wrong ones at a random place. */
export function withOptions(correct: string, wrong: string[]): { options: string[]; correct: number } {
  const unique = [...new Set(wrong.filter((w) => w !== correct))].slice(0, 3);
  const options = [...unique];
  const at = Math.floor(Math.random() * (options.length + 1));
  options.splice(at, 0, correct);
  return { options, correct: at };
}

const ROUNDS = 5;

/** Five animated questions; the score goes to onFinish like every other game. */
export const ChallengeRunner: React.FC<
  { makeRound: (index: number) => ChallengeRound; intro: string; visualHeight?: string } & Pick<SimChallengeProps, 'onFinish' | 'onMascot'>
> = ({ makeRound, intro, onFinish, onMascot, visualHeight = 'h-64 sm:h-72' }) => {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const current = useMemo(() => makeRound(index), [index]);

  useEffect(() => {
    onMascot(index === 0 ? intro : current.prompt, 'think');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const answer = (i: number) => {
    if (chosen !== null) return;
    setChosen(i);
    const ok = i === current.correct;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) soundEffects.playCorrect();
    else soundEffects.playTryAgain();
    onMascot(ok ? `Yes! ${current.explain}` : `Not quite. ${current.explain}`, ok ? 'cheer' : 'sad');
    const next = [...results, ok];
    setResults(next);
    window.setTimeout(() => {
      setFeedback(null);
      if (next.length >= ROUNDS) {
        onFinish(next.filter(Boolean).length, ROUNDS);
        return;
      }
      setChosen(null);
      setIndex((n) => n + 1);
    }, ok ? 2300 : 3600);
  };

  return (
    <div className="sim-challenge" id="sim-challenge">
      <div className="mb-2 flex items-center justify-between">
        <RoundDots total={ROUNDS} current={index} results={results} />
        <span className="text-xs font-black text-stone-500">
          Question {Math.min(index + 1, ROUNDS)} of {ROUNDS}
        </span>
      </div>
      <div className={`relative overflow-hidden rounded-2xl border-2 border-stone-100 bg-white ${visualHeight}`}>
        <Feedback state={feedback} />
        <AnimatePresence mode="wait">
          <motion.div key={index} className="h-full" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            {current.visual(chosen !== null)}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-base font-black text-stone-900 sm:text-lg" id="sim-question">
        {current.prompt}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {current.options.map((option, i) => {
          const state =
            chosen === null ? 'idle' : i === current.correct ? 'right' : i === chosen ? 'wrong' : 'dim';
          return (
            <ChunkyButton
              key={`${index}-${i}`}
              color={state === 'right' ? 'emerald' : state === 'wrong' ? 'rose' : 'white'}
              onClick={() => answer(i)}
              disabled={chosen !== null && state === 'dim'}
              className={`sim-option text-left text-sm sm:text-base ${state === 'dim' ? 'opacity-50' : ''}`}
            >
              {option}
            </ChunkyButton>
          );
        })}
      </div>
      {chosen !== null && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900" id="sim-explain">
          💡 {current.explain}
        </p>
      )}
    </div>
  );
};

/** Grid lines + axes for a cartesian SVG drawing. */
export const Axes: React.FC<{
  toX: (x: number) => number;
  toY: (y: number) => number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  step?: number;
  labels?: boolean;
}> = ({ toX, toY, xMin, xMax, yMin, yMax, step = 1, labels = true }) => {
  const xs: number[] = [];
  for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) xs.push(x);
  const ys: number[] = [];
  for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) ys.push(y);
  return (
    <g>
      {xs.map((x) => (
        <line key={`gx${x}`} x1={toX(x)} x2={toX(x)} y1={toY(yMin)} y2={toY(yMax)} stroke="#e7e5e4" strokeWidth={x === 0 ? 0 : 1} />
      ))}
      {ys.map((y) => (
        <line key={`gy${y}`} y1={toY(y)} y2={toY(y)} x1={toX(xMin)} x2={toX(xMax)} stroke="#e7e5e4" strokeWidth={y === 0 ? 0 : 1} />
      ))}
      <line x1={toX(xMin)} x2={toX(xMax)} y1={toY(0)} y2={toY(0)} stroke="#44403c" strokeWidth={2} />
      <line y1={toY(yMin)} y2={toY(yMax)} x1={toX(0)} x2={toX(0)} stroke="#44403c" strokeWidth={2} />
      {labels &&
        xs
          .filter((x) => x !== 0 && x % (step * 2) === 0)
          .map((x) => (
            <text key={`lx${x}`} x={toX(x)} y={toY(0) + 14} fontSize={10} textAnchor="middle" fill="#78716c" fontWeight={700}>
              {x}
            </text>
          ))}
      {labels &&
        ys
          .filter((y) => y !== 0 && y % (step * 2) === 0)
          .map((y) => (
            <text key={`ly${y}`} x={toX(0) - 6} y={toY(y) + 3} fontSize={10} textAnchor="end" fill="#78716c" fontWeight={700}>
              {y}
            </text>
          ))}
    </g>
  );
};
