// Counting animations for the maths Learn cards: things appear one at a
// time while a big number flashes the count ("1… 2… 3…"), groups join and
// are counted again, balloons fly away one by one, plates are skip-counted,
// and the frog's hops are numbered. Each card shows one stage of its
// chapter's example, so the picture follows what the card says.
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { CountSpec } from '../../data/learnPlay';
import { soundEffects } from '../../services/soundEffects';

const STEP_MS = 650;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** Runs a list of timed steps once, then waits and starts again; `tick` is the current step index. */
function useTimeline(length: number, deps: unknown[]): number {
  const [tick, setTick] = useState(-1);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    let i = -1;
    setTick(-1);
    const next = () => {
      i += 1;
      if (i > length + 5) i = -1; // hold the finished picture for ~5 steps, then replay
      setTick(i);
      timer.current = window.setTimeout(next, i === -1 ? 900 : STEP_MS);
    };
    timer.current = window.setTimeout(next, 700);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return tick;
}

/** The big counting number in the corner: pops and flashes each time it changes. */
const BigCount: React.FC<{ value: number | null; tone?: string; word?: boolean }> = ({ value, tone = 'bg-violet-600', word }) => (
  <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-center" aria-live="polite">
    <AnimatePresence mode="popLayout">
      {value !== null && value > 0 && (
        <motion.div
          key={value}
          initial={{ scale: 1.8, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16 }}
          className={`count-number flex h-14 min-w-14 items-center justify-center rounded-2xl px-3 text-3xl font-black text-white shadow-[0_5px_0_rgba(0,0,0,0.2)] ${tone}`}
        >
          {value}
        </motion.div>
      )}
    </AnimatePresence>
    {word && value !== null && value > 0 && value < NUMBER_WORDS.length && (
      <motion.span key={`w${value}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1 rounded-lg bg-white/90 px-2 text-xs font-black text-violet-700">
        {NUMBER_WORDS[value]}
      </motion.span>
    )}
  </div>
);

/** One counted thing: pops in, wears its number badge while it is being counted. */
const Thing: React.FC<{ emoji: string; n?: number | null; hot?: boolean; gone?: boolean; small?: boolean }> = ({ emoji, n, hot, gone, small }) => (
  <motion.span
    layout
    initial={{ scale: 0, y: -30, opacity: 0 }}
    animate={gone ? { y: -160, opacity: 0, rotate: 25 } : { scale: hot ? 1.25 : 1, y: 0, opacity: 1 }}
    transition={gone ? { duration: 0.9, ease: 'easeIn' } : { type: 'spring', stiffness: 380, damping: 18 }}
    className={`relative inline-flex items-center justify-center ${small ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'}`}
  >
    {emoji}
    {n ? (
      <motion.span
        key={n}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`absolute -right-1 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-black text-white shadow ${hot ? 'bg-rose-500' : 'bg-violet-500'}`}
      >
        {n}
      </motion.span>
    ) : null}
  </motion.span>
);

const Basket: React.FC<{ label?: string; children: React.ReactNode; tone?: string; wrap?: boolean }> = ({ label, children, tone = 'border-amber-300 bg-amber-50/80', wrap }) => (
  <motion.div layout className={`flex min-h-[5.5rem] min-w-[5rem] shrink-0 flex-col items-center justify-end rounded-3xl border-4 border-dashed px-2 pb-2 pt-3 ${tone}`}>
    <div className={`flex items-end justify-center gap-1 ${wrap ? 'max-w-[16rem] flex-wrap' : 'flex-nowrap'}`}>{children}</div>
    {label && <span className="mt-1 text-xs font-black text-stone-600">{label}</span>}
  </motion.div>
);

const Equation: React.FC<{ text: string; show: boolean }> = ({ text, show }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="count-equation absolute left-3 top-3 z-10 rounded-2xl bg-violet-600 px-4 py-1.5 text-2xl font-black text-white shadow-[0_5px_0_rgba(76,29,149,0.4)]"
      >
        {text}
      </motion.div>
    )}
  </AnimatePresence>
);

const pop = () => soundEffects.playWordPop();

/* ------------------------------- adding ------------------------------- */

const AddCounting: React.FC<{ a: number; b: number; emoji: string; stage: string; labels?: [string, string] }> = ({ a, b, emoji, stage, labels }) => {
  // groups: count a, then count b.  join: both counted, then they slide together and are counted again.
  const showJoin = stage !== 'groups';
  const steps = a + b + (showJoin ? a + b + 1 : 0);
  const t = useTimeline(steps, [a, b, stage]);
  const shownA = Math.max(0, Math.min(a, t + 1));
  const shownB = Math.max(0, Math.min(b, t + 1 - a));
  const joinStart = a + b;
  const joined = showJoin && t >= joinStart;
  const allCount = joined ? Math.min(a + b, t - joinStart) : 0;
  useEffect(() => {
    if (t >= 0 && t < steps) pop();
  }, [t, steps]);
  let big: number | null = null;
  if (!joined) big = t < a ? shownA : shownB;
  else big = allCount || null;
  return (
    <div className="relative flex h-full items-center justify-center gap-4 px-3">
      <BigCount value={big} tone={joined ? 'bg-emerald-600' : t < a ? 'bg-amber-500' : 'bg-sky-500'} />
      {!joined ? (
        <>
          <Basket label={labels?.[0]}>
            {Array.from({ length: shownA }, (_, i) => (
              <Thing key={`a${i}`} emoji={emoji} n={i + 1} hot={t < a && i === shownA - 1} small />
            ))}
          </Basket>
          <span className="text-3xl font-black text-amber-500">+</span>
          <Basket label={labels?.[1]} tone="border-sky-300 bg-sky-50/80">
            {Array.from({ length: shownB }, (_, i) => (
              <Thing key={`b${i}`} emoji={emoji} n={i + 1} hot={t >= a && i === shownB - 1} small />
            ))}
          </Basket>
        </>
      ) : (
        <Basket label="all together" tone="border-emerald-300 bg-emerald-50/80" wrap={a + b > 6}>
          {Array.from({ length: a + b }, (_, i) => (
            <Thing key={`j${i}`} emoji={emoji} n={i < allCount ? i + 1 : null} hot={i === allCount - 1} />
          ))}
        </Basket>
      )}
      <Equation text={`${a} + ${b} = ${a + b}`} show={stage === 'equation' && joined && allCount >= a + b} />
    </div>
  );
};

/* ----------------------------- taking away ---------------------------- */

const SubtractCounting: React.FC<{ a: number; b: number; emoji: string; stage: string }> = ({ a, b, emoji, stage }) => {
  // start: count a.  remove: count a, then b fly away one by one.  equation: then count what is left.
  const removing = stage !== 'start';
  const recount = stage === 'equation';
  const steps = a + (removing ? b + 1 : 0) + (recount ? a - b + 1 : 0);
  const t = useTimeline(steps, [a, b, stage]);
  const shown = Math.max(0, Math.min(a, t + 1));
  const goneCount = removing ? Math.max(0, Math.min(b, t - a)) : 0;
  const recountStart = a + b + 1;
  const left = recount ? Math.max(0, Math.min(a - b, t - recountStart + 1)) : 0;
  useEffect(() => {
    if (t >= 0 && t < steps) pop();
  }, [t, steps]);
  let big: number | null = shown;
  let tone = 'bg-amber-500';
  if (removing && t >= a) {
    big = goneCount;
    tone = 'bg-rose-500';
  }
  if (recount && t >= recountStart) {
    big = left;
    tone = 'bg-emerald-600';
  }
  return (
    <div className="relative flex h-full items-end justify-center pb-10">
      <BigCount value={big || null} tone={tone} />
      {removing && t >= a && t < recountStart && <span className="absolute bottom-2 left-3 rounded-xl bg-rose-100 px-2 py-1 text-xs font-black text-rose-700">fly away: {goneCount}</span>}
      {recount && t >= recountStart && <span className="absolute bottom-2 left-3 rounded-xl bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">left: {left}</span>}
      <div className="flex items-end gap-2">
        {Array.from({ length: shown }, (_, i) => {
          const flying = removing && i >= a - b && i - (a - b) < goneCount;
          const keepIndex = i < a - b ? i : -1;
          const n = recount && t >= recountStart ? (keepIndex >= 0 && keepIndex < left ? keepIndex + 1 : null) : t < a ? i + 1 : null;
          return <Thing key={i} emoji={emoji} n={flying ? null : n} hot={flying || (t < a && i === shown - 1) || (keepIndex === left - 1 && t >= recountStart)} gone={flying} />;
        })}
      </div>
      <Equation text={`${a} − ${b} = ${a - b}`} show={recount && left >= a - b} />
    </div>
  );
};

/* ------------------------------ counting ------------------------------ */

const CountUp: React.FC<{ n: number; emoji: string }> = ({ n, emoji }) => {
  const t = useTimeline(n, [n, emoji]);
  const shown = Math.max(0, Math.min(n, t + 1));
  useEffect(() => {
    if (t >= 0 && t < n) pop();
  }, [t, n]);
  return (
    <div className="relative flex h-full items-center justify-center px-3">
      <BigCount value={shown || null} word />
      <div className="grid grid-cols-5 gap-x-3 gap-y-2">
        {Array.from({ length: shown }, (_, i) => (
          <Thing key={i} emoji={emoji} n={i + 1} hot={i === shown - 1} small={n > 5} />
        ))}
      </div>
    </div>
  );
};

/* ---------------------------- equal groups ---------------------------- */

const GroupsCounting: React.FC<{ groups: number; each: number; emoji: string; stage: string }> = ({ groups, each, emoji, stage }) => {
  // groups: fill plate after plate, counting inside each.  add: skip-count the plates (2, 4, 6).  equation: then show g × e.
  const total = groups * each;
  const skip = stage !== 'groups';
  const steps = total + (skip ? groups + 1 : 0);
  const t = useTimeline(steps, [groups, each, stage]);
  const filled = Math.max(0, Math.min(total, t + 1));
  const skipStep = skip ? Math.max(0, Math.min(groups, t - total)) : 0;
  useEffect(() => {
    if (t >= 0 && t < steps) pop();
  }, [t, steps]);
  const big = skip && t >= total ? (skipStep ? skipStep * each : null) : filled ? ((filled - 1) % each) + 1 : null;
  return (
    <div className="relative flex h-full items-center justify-center gap-3 px-3">
      <BigCount value={big} tone={skip && t >= total ? 'bg-emerald-600' : 'bg-amber-500'} />
      {Array.from({ length: groups }, (_, g) => {
        const inPlate = Math.max(0, Math.min(each, filled - g * each));
        const plateDone = skip && skipStep > g;
        return (
          <div key={g} className="flex flex-col items-center">
            <div className={`flex min-h-[4.5rem] min-w-[4.5rem] flex-wrap items-center justify-center gap-1 rounded-full border-4 p-2 transition-colors ${plateDone ? 'border-emerald-400 bg-emerald-50' : 'border-stone-300 bg-white'}`}>
              {Array.from({ length: inPlate }, (_, i) => (
                <Thing key={i} emoji={emoji} n={!skip || t < total ? i + 1 : null} hot={g * each + i === filled - 1 && t < total} small />
              ))}
            </div>
            {plateDone && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-1 rounded-lg bg-emerald-600 px-2 text-sm font-black text-white">
                {(g + 1) * each}
              </motion.span>
            )}
          </div>
        );
      })}
      <Equation text={stage === 'add' ? Array(groups).fill(each).join(' + ') + ` = ${total}` : `${groups} × ${each} = ${total}`} show={skip && skipStep >= groups} />
    </div>
  );
};

/* ------------------------------ number line --------------------------- */

const HopCounting: React.FC<{ from: number; by: number }> = ({ from, by }) => {
  const hops = Math.abs(by);
  const dir = Math.sign(by) || 1;
  const t = useTimeline(hops + 1, [from, by]);
  const done = Math.max(0, Math.min(hops, t));
  const at = from + dir * done;
  useEffect(() => {
    if (t > 0 && t <= hops) pop();
  }, [t, hops]);
  const pct = (n: number) => `${4 + n * 9.2}%`;
  return (
    <div className="relative h-full">
      <BigCount value={done || null} tone={dir > 0 ? 'bg-emerald-600' : 'bg-rose-500'} />
      <div className="absolute inset-x-[4%] top-[62%] h-1.5 rounded bg-teal-700/70" />
      {Array.from({ length: 11 }, (_, n) => (
        <span key={n} className={`absolute top-[62%] flex -translate-x-1/2 flex-col items-center text-sm font-black ${n === at ? 'text-rose-600' : 'text-teal-900'}`} style={{ left: pct(n) }}>
          <span className="h-3 w-0.5 bg-teal-700" />
          {n}
        </span>
      ))}
      {Array.from({ length: done }, (_, i) => {
        const a = from + dir * i;
        const b = a + dir;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-[34%] -translate-x-1/2 rounded-full bg-amber-400 px-1.5 text-xs font-black text-amber-950"
            style={{ left: `calc((${pct(a)} + ${pct(b)}) / 2)` }}
          >
            {i + 1}
          </motion.span>
        );
      })}
      <motion.div className="absolute top-[38%] w-0" initial={false} animate={{ left: pct(at) }} transition={{ duration: 0.45 }}>
        <motion.span key={at} className="absolute -left-4 text-3xl" initial={{ y: 0 }} animate={{ y: [0, -26, 0] }} transition={{ duration: 0.45 }}>
          🐸
        </motion.span>
      </motion.div>
      <Equation text={`${from} ${dir > 0 ? '+' : '−'} ${hops} = ${from + by}`} show={done >= hops && hops > 0} />
    </div>
  );
};

export const CountingScene: React.FC<{ spec: CountSpec }> = ({ spec }) => {
  switch (spec.op) {
    case 'add':
      return <AddCounting a={spec.a} b={spec.b} emoji={spec.emoji} stage={spec.stage || 'equation'} labels={spec.labels} />;
    case 'sub':
      return <SubtractCounting a={spec.a} b={spec.b} emoji={spec.emoji} stage={spec.stage || 'equation'} />;
    case 'count':
      return <CountUp n={spec.n} emoji={spec.emoji} />;
    case 'groups':
      return <GroupsCounting groups={spec.groups} each={spec.each} emoji={spec.emoji} stage={spec.stage || 'equation'} />;
    case 'hop':
      return <HopCounting from={spec.from} by={spec.by} />;
  }
};
