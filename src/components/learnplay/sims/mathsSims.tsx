// Maths simulations for Classes 6-10 (Telangana syllabus): integers on a
// number line, fractions, the equation balance, triangle angles, graphs of
// lines and parabolas, the unit circle, probability and Venn diagrams. Each
// has an Explore view (sliders, live animation) and a challenge round maker.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useSpring } from 'motion/react';
import { soundEffects } from '../../../services/soundEffects';
import { ChunkyButton } from '../ui';
import {
  Axes,
  ChallengeRound,
  SimFrame,
  SimProps,
  Slider,
  Toggle,
  clamp,
  gradeN,
  pick,
  randInt,
  round,
  useClock,
  withOptions,
} from './simKit';

const W = 400;
const H = 240;
const svgProps = { viewBox: `0 0 ${W} ${H}`, className: 'h-full w-full', preserveAspectRatio: 'xMidYMid meet' } as const;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const frac = (n: number, d: number) => {
  if (n === 0) return '0';
  const g = gcd(n, d);
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`;
};
const signed = (n: number) => (n < 0 ? `(${n})` : String(n));

/* ============================== INTEGERS ============================== */

const NL_MIN = -12;
const NL_MAX = 12;
const nlX = (n: number) => 20 + ((n - NL_MIN) / (NL_MAX - NL_MIN)) * (W - 40);

/** A token that hops from `start` by `step` on the number line, one unit every 0.45 s. */
const IntegerHops: React.FC<{ start: number; step: number; playKey: string | number; showEnd?: boolean }> = ({ start, step, playKey, showEnd = true }) => {
  const [startedAt, setStartedAt] = useState(0);
  const t = useClock(true);
  useEffect(() => setStartedAt(t), [playKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const elapsed = Math.max(0, t - startedAt - 0.3);
  const hops = Math.abs(step);
  const done = Math.min(hops, elapsed / 0.45);
  const whole = Math.floor(done);
  const part = done - whole;
  const dir = Math.sign(step) || 1;
  const pos = start + dir * done;
  const lift = whole < hops ? Math.sin(part * Math.PI) * 34 : 0;
  const end = start + step;
  const y = 150;
  return (
    <svg {...svgProps}>
      <line x1={nlX(NL_MIN)} x2={nlX(NL_MAX)} y1={y} y2={y} stroke="#44403c" strokeWidth={3} />
      {Array.from({ length: NL_MAX - NL_MIN + 1 }, (_, i) => NL_MIN + i).map((n) => (
        <g key={n}>
          <line x1={nlX(n)} x2={nlX(n)} y1={y - (n === 0 ? 10 : 6)} y2={y + (n === 0 ? 10 : 6)} stroke={n === 0 ? '#0f172a' : '#78716c'} strokeWidth={n === 0 ? 3 : 1.5} />
          <text x={nlX(n)} y={y + 24} fontSize={11} textAnchor="middle" fontWeight={800} fill={n < 0 ? '#e11d48' : n > 0 ? '#059669' : '#0f172a'}>
            {n}
          </text>
        </g>
      ))}
      {/* the path already hopped */}
      {Array.from({ length: Math.min(whole, hops) }, (_, i) => {
        const from = start + dir * i;
        const to = from + dir;
        const mx = (nlX(from) + nlX(to)) / 2;
        return (
          <path key={i} d={`M ${nlX(from)} ${y} Q ${mx} ${y - 60} ${nlX(to)} ${y}`} fill="none" stroke={dir > 0 ? '#10b981' : '#f43f5e'} strokeWidth={2.5} strokeDasharray="5 4" />
        );
      })}
      <circle cx={nlX(start)} cy={y} r={7} fill="#f59e0b" stroke="white" strokeWidth={2} />
      <g transform={`translate(${nlX(pos)} ${y - 18 - lift})`}>
        <circle r={13} fill={dir > 0 ? '#10b981' : '#f43f5e'} stroke="white" strokeWidth={3} />
        <text y={4} fontSize={13} textAnchor="middle" fill="white" fontWeight={900}>
          🐸
        </text>
      </g>
      {showEnd && done >= hops && (
        <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ transformOrigin: `${nlX(end)}px ${y}px` }}>
          <circle cx={nlX(end)} cy={y} r={11} fill="none" stroke="#7c3aed" strokeWidth={3} />
          <text x={nlX(end)} y={y - 50} fontSize={16} textAnchor="middle" fontWeight={900} fill="#7c3aed">
            {end}
          </text>
        </motion.g>
      )}
    </svg>
  );
};

export const IntegersExplore: React.FC<SimProps> = ({ grade }) => {
  const [a, setA] = useState(-3);
  const [b, setB] = useState(5);
  const [op, setOp] = useState<'add' | 'sub'>('add');
  const [play, setPlay] = useState(0);
  const step = op === 'add' ? b : -b;
  const end = a + step;
  const ok = end >= NL_MIN && end <= NL_MAX;
  return (
    <SimFrame
      caption={
        <span>
          {a} {op === 'add' ? '+' : '−'} {signed(b)} = <span className="text-violet-700">{ok ? end : '…'}</span>
          {op === 'sub' && <span className="text-stone-500"> (subtracting {signed(b)} = adding {signed(-b)})</span>}
        </span>
      }
      controls={
        <>
          <Slider label="Start" value={a} min={-9} max={9} onChange={(v) => { setA(v); setPlay((p) => p + 1); }} />
          <Slider label="Number" value={b} min={-9} max={9} onChange={(v) => { setB(v); setPlay((p) => p + 1); }} />
          {gradeN(grade) >= 7 && (
            <Toggle options={[{ id: 'add', label: '+ add' }, { id: 'sub', label: '− subtract' }]} value={op} onChange={(v) => { setOp(v as 'add' | 'sub'); setPlay((p) => p + 1); }} />
          )}
          <ChunkyButton color="sky" className="!px-3 !py-2 text-sm" onClick={() => setPlay((p) => p + 1)}>
            ▶ Hop
          </ChunkyButton>
        </>
      }
    >
      {ok ? <IntegerHops start={a} step={step} playKey={`${a}|${step}|${play}`} /> : <p className="p-6 text-center font-bold">Off the line — try smaller numbers.</p>}
    </SimFrame>
  );
};

export function integersRound(grade: string): ChallengeRound {
  const sub = gradeN(grade) >= 7 && Math.random() < 0.5;
  let a = 0;
  let b = 0;
  let end = 0;
  do {
    a = randInt(-9, 9);
    b = randInt(-9, 9);
    end = sub ? a - b : a + b;
  } while (b === 0 || end < NL_MIN || end > NL_MAX);
  const step = sub ? -b : b;
  const { options, correct } = withOptions(String(end), [String(end + 1), String(end - 1), String(-end), String(sub ? a + b : a - b)].filter((o) => o !== String(end)));
  return {
    prompt: `${a} ${sub ? '−' : '+'} ${signed(b)} = ?`,
    options,
    correct,
    explain: sub
      ? `Subtracting ${signed(b)} is the same as adding ${signed(-b)}: start at ${a}, hop ${Math.abs(step)} ${step > 0 ? 'right' : 'left'} to ${end}.`
      : `Start at ${a} and hop ${Math.abs(b)} ${b > 0 ? 'right' : 'left'}: you land on ${end}.`,
    visual: (revealed) => <IntegerHops start={a} step={revealed ? step : 0} playKey={revealed ? 1 : 0} showEnd={revealed} />,
  };
}

/* ============================== FRACTIONS ============================= */

const Pie: React.FC<{ n: number; d: number; cx: number; cy: number; r: number; color?: string }> = ({ n, d, cx, cy, r, color = '#f59e0b' }) => (
  <g>
    {Array.from({ length: d }, (_, i) => {
      const a0 = (i / d) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / d) * Math.PI * 2 - Math.PI / 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const path =
        d === 1
          ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
          : `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
      const mid = (a0 + a1) / 2;
      return (
        <motion.path
          key={`${d}-${i}`}
          d={path}
          stroke="white"
          strokeWidth={2}
          initial={false}
          animate={{
            fill: i < n ? color : '#e7e5e4',
            x: i < n ? Math.cos(mid) * 5 : 0,
            y: i < n ? Math.sin(mid) * 5 : 0,
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: i * 0.03 }}
        />
      );
    })}
  </g>
);

const Bar: React.FC<{ n: number; d: number; x: number; y: number; w: number; h: number; color?: string }> = ({ n, d, x, y, w, h, color = '#0ea5e9' }) => (
  <g>
    {Array.from({ length: d }, (_, i) => (
      <motion.rect
        key={`${d}-${i}`}
        x={x + (i * w) / d}
        y={y}
        width={w / d}
        height={h}
        stroke="white"
        strokeWidth={2}
        initial={false}
        animate={{ fill: i < n ? color : '#e7e5e4' }}
        transition={{ delay: i * 0.04 }}
        rx={3}
      />
    ))}
  </g>
);

export const FractionsExplore: React.FC<SimProps> = () => {
  const [d, setD] = useState(8);
  const [n, setN] = useState(3);
  const nn = Math.min(n, d);
  const k = 2;
  return (
    <SimFrame
      caption={
        <span>
          {nn}/{d} = {frac(nn, d)} = <span className="text-sky-700">{round(nn / d, 3)}</span> = {round((nn / d) * 100, 1)}% ·{' '}
          <span className="text-violet-700">
            equivalent: {nn * k}/{d * k}
          </span>
        </span>
      }
      controls={
        <>
          <Slider label="Shaded parts (numerator)" value={nn} min={0} max={d} onChange={setN} />
          <Slider label="Equal parts (denominator)" value={d} min={1} max={12} onChange={(v) => { setD(v); setN((x) => Math.min(x, v)); }} />
        </>
      }
    >
      <svg {...svgProps}>
        <Pie n={nn} d={d} cx={95} cy={110} r={78} />
        <text x={95} y={225} textAnchor="middle" fontWeight={900} fontSize={18} fill="#92400e">
          {nn}/{d}
        </text>
        <Bar n={nn} d={d} x={200} y={50} w={180} h={40} />
        <Bar n={nn * k} d={d * k} x={200} y={115} w={180} h={40} color="#8b5cf6" />
        <text x={290} y={42} textAnchor="middle" fontWeight={800} fontSize={12} fill="#0369a1">
          {nn}/{d}
        </text>
        <text x={290} y={175} textAnchor="middle" fontWeight={800} fontSize={12} fill="#6d28d9">
          {nn * k}/{d * k} — same amount!
        </text>
      </svg>
    </SimFrame>
  );
}

export function fractionsRound(grade: string): ChallengeRound {
  const d = pick([2, 3, 4, 5, 6, 8, 10, 12]);
  const n = randInt(1, d - 1);
  const kind = gradeN(grade) >= 7 ? pick(['shaded', 'equivalent', 'decimal']) : pick(['shaded', 'equivalent']);
  if (kind === 'equivalent') {
    const k = randInt(2, 4);
    const right = `${n * k}/${d * k}`;
    const { options, correct } = withOptions(right, [`${n + k}/${d + k}`, `${n * k}/${d}`, `${n}/${d * k}`, `${n * k + 1}/${d * k}`]);
    return {
      prompt: `Which fraction is equal to ${n}/${d}?`,
      options,
      correct,
      explain: `Multiply top and bottom by the same number ${k}: ${n}×${k}/${d}×${k} = ${right}.`,
      visual: (revealed) => (
        <svg {...svgProps}>
          <Bar n={n} d={d} x={40} y={50} w={320} h={44} />
          {revealed && <Bar n={n * k} d={d * k} x={40} y={130} w={320} h={44} color="#8b5cf6" />}
        </svg>
      ),
    };
  }
  if (kind === 'decimal') {
    const dd = pick([2, 4, 5, 10]);
    const nn = randInt(1, dd - 1);
    const right = String(nn / dd);
    const { options, correct } = withOptions(right, [String(round(dd / (nn * 10), 2)), String(round(nn / dd + 0.1, 2)), `${nn}.${dd}`, String(round(nn / dd / 10, 3))]);
    return {
      prompt: `Write ${nn}/${dd} as a decimal.`,
      options,
      correct,
      explain: `${nn} ÷ ${dd} = ${right}.`,
      visual: () => (
        <svg {...svgProps}>
          <Pie n={nn} d={dd} cx={200} cy={120} r={95} color="#0ea5e9" />
        </svg>
      ),
    };
  }
  const right = `${n}/${d}`;
  const { options, correct } = withOptions(right, [`${d - n}/${d}`, `${n}/${d + 1}`, `${d}/${n}`, `${n + 1}/${d}`].filter((o) => o !== right));
  return {
    prompt: 'What fraction of the circle is coloured?',
    options,
    correct,
    explain: `${n} of the ${d} equal parts are coloured: ${n}/${d}.`,
    visual: () => (
      <svg {...svgProps}>
        <Pie n={n} d={d} cx={200} cy={120} r={95} />
      </svg>
    ),
  };
}

/* ======================== EQUATION BALANCE ============================ */

/** A see-saw balance: left pan a boxes of x plus b unit weights, right pan c unit weights. */
const BalanceScene: React.FC<{ a: number; b: number; c: number; x: number | null; xLabel?: string }> = ({ a, b, c, x, xLabel = 'x' }) => {
  const left = x === null ? null : a * x + b;
  const tilt = left === null ? 0 : clamp((left - c) * 2.2, -16, 16);
  const angle = useSpring(0, { stiffness: 60, damping: 9 });
  useEffect(() => angle.set(tilt), [tilt, angle]);
  // SVG transform attributes from React state (a motion value string would be
  // applied as a CSS transform, which ignores SVG's "rotate(a cx cy)" form).
  // The heavier side goes down: positive tilt = left heavier = anticlockwise.
  const [v, setV] = useState(0);
  useMotionValueEvent(angle, 'change', setV);
  const drop = Math.sin((v * Math.PI) / 180) * 90;
  const rot = `rotate(${-v} 200 90)`;
  const leftPan = `translate(110 ${90 + drop})`;
  const rightPan = `translate(290 ${90 - drop})`;
  const weights = (count: number, color: string) =>
    Array.from({ length: Math.min(count, 14) }, (_, i) => (
      <circle key={i} cx={-42 + (i % 7) * 14} cy={-12 - Math.floor(i / 7) * 13} r={6} fill={color} stroke="white" strokeWidth={1.5} />
    ));
  const balanced = left !== null && left === c;
  return (
    <svg {...svgProps}>
      <polygon points="200,95 180,215 220,215" fill="#78716c" />
      <rect x={150} y={212} width={100} height={10} rx={4} fill="#57534e" />
      <g transform={rot}>
        <rect x={100} y={86} width={200} height={8} rx={4} fill={balanced ? '#10b981' : '#a8a29e'} />
      </g>
      <g transform={leftPan}>
        <line x1={-45} y1={0} x2={-55} y2={40} stroke="#78716c" strokeWidth={2} />
        <line x1={45} y1={0} x2={55} y2={40} stroke="#78716c" strokeWidth={2} />
        <g transform="translate(0 40)">
          <rect x={-60} y={0} width={120} height={8} rx={4} fill="#57534e" />
          {Array.from({ length: a }, (_, i) => (
            <g key={i} transform={`translate(${-54 + i * 24} ${-44})`}>
              <rect width={20} height={20} rx={4} fill="#f59e0b" stroke="#92400e" strokeWidth={1.5} />
              <text x={10} y={14} fontSize={11} fontWeight={900} textAnchor="middle" fill="#451a03">
                {x === null ? xLabel : x}
              </text>
            </g>
          ))}
          {weights(b, '#0ea5e9')}
        </g>
      </g>
      <g transform={rightPan}>
        <line x1={-45} y1={0} x2={-55} y2={40} stroke="#78716c" strokeWidth={2} />
        <line x1={45} y1={0} x2={55} y2={40} stroke="#78716c" strokeWidth={2} />
        <g transform="translate(0 40)">
          <rect x={-60} y={0} width={120} height={8} rx={4} fill="#57534e" />
          {c <= 14 ? weights(c, '#0ea5e9') : (
            <g>
              <rect x={-30} y={-34} width={60} height={30} rx={6} fill="#0ea5e9" />
              <text y={-13} fontSize={15} fontWeight={900} textAnchor="middle" fill="white">
                {c}
              </text>
            </g>
          )}
        </g>
      </g>
      <text x={200} y={24} textAnchor="middle" fontSize={17} fontWeight={900} fill="#1c1917">
        {a === 1 ? '' : a}
        {xLabel}
        {b ? ` + ${b}` : ''} = {c}
      </text>
      {balanced && (
        <text x={200} y={46} textAnchor="middle" fontSize={13} fontWeight={900} fill="#059669">
          Balanced! {xLabel} = {x}
        </text>
      )}
    </svg>
  );
};

export const BalanceExplore: React.FC<SimProps> = () => {
  const [a, setA] = useState(3);
  const [b, setB] = useState(4);
  const [secret, setSecret] = useState(5);
  const [guess, setGuess] = useState(1);
  const c = a * secret + b;
  useEffect(() => {
    if (a * guess + b === c) soundEffects.playCorrect();
  }, [guess, a, b, c]);
  return (
    <SimFrame
      caption={
        <span>
          Steps: {a}x + {b} = {c} → {a}x = {c} − {b} = {c - b} → x = {c - b} ÷ {a} = <span className="text-emerald-700">{secret}</span>
        </span>
      }
      controls={
        <>
          <Slider label="Your guess for x" value={guess} min={0} max={12} onChange={setGuess} />
          <Slider label="Boxes of x" value={a} min={1} max={4} onChange={setA} />
          <Slider label="Extra weights" value={b} min={0} max={9} onChange={setB} />
          <ChunkyButton color="violet" className="!px-3 !py-2 text-sm" onClick={() => { setSecret(randInt(1, 9)); setGuess(0); }}>
            New puzzle
          </ChunkyButton>
        </>
      }
    >
      <BalanceScene a={a} b={b} c={c} x={guess} />
    </SimFrame>
  );
};

export function balanceRound(): ChallengeRound {
  const a = randInt(1, 4);
  const x = randInt(1, 9);
  const b = randInt(0, 9);
  const c = a * x + b;
  const { options, correct } = withOptions(String(x), [String(x + 1), String(x - 1 >= 0 ? x - 1 : x + 2), String(c - b), String(round((c + b) / a, 1))]);
  return {
    prompt: `Solve: ${a === 1 ? '' : a}x${b ? ` + ${b}` : ''} = ${c}. What is x?`,
    options,
    correct,
    explain: `Take ${b} from both sides: ${a}x = ${c - b}. Divide both sides by ${a}: x = ${x}. The scale balances.`,
    visual: (revealed) => <BalanceScene a={a} b={b} c={c} x={revealed ? x : null} />,
  };
}

/* =========================== TRIANGLE ANGLES ========================== */

type Pt = { x: number; y: number };
const angleAt = (p: Pt, q: Pt, r: Pt) => {
  const v1 = { x: q.x - p.x, y: q.y - p.y };
  const v2 = { x: r.x - p.x, y: r.y - p.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  return (Math.acos(clamp(dot / cross, -1, 1)) * 180) / Math.PI;
};
const arcPath = (p: Pt, q: Pt, r: Pt, rad = 22) => {
  const a1 = Math.atan2(q.y - p.y, q.x - p.x);
  const a2 = Math.atan2(r.y - p.y, r.x - p.x);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const sweep = d > 0 ? 1 : 0;
  return `M ${p.x + rad * Math.cos(a1)} ${p.y + rad * Math.sin(a1)} A ${rad} ${rad} 0 0 ${sweep} ${p.x + rad * Math.cos(a2)} ${p.y + rad * Math.sin(a2)}`;
};

const TriangleScene: React.FC<{ pts: Pt[]; labels: (string | null)[]; onDrag?: (i: number, p: Pt) => void; proof?: boolean }> = ({ pts, labels, onDrag, proof }) => {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  const colors = ['#f43f5e', '#0ea5e9', '#10b981'];
  const toLocal = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const scale = Math.max(W / r.width, H / r.height);
    const ox = (r.width * scale - W) / 2;
    const oy = (r.height * scale - H) / 2;
    return { x: clamp((e.clientX - r.left) * scale - ox, 15, W - 15), y: clamp((e.clientY - r.top) * scale - oy, 15, H - 15) };
  };
  const [A, B, C] = pts;
  // a line through A parallel to BC, for the angle-sum proof
  const dir = { x: C.x - B.x, y: C.y - B.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  return (
    <svg
      ref={svg}
      {...svgProps}
      onPointerMove={(e) => dragging.current !== null && onDrag?.(dragging.current, toLocal(e))}
      onPointerUp={() => (dragging.current = null)}
      onPointerLeave={() => (dragging.current = null)}
      style={{ touchAction: 'none' }}
    >
      <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="#fef3c7" stroke="#92400e" strokeWidth={3} strokeLinejoin="round" />
      {pts.map((p, i) => {
        const q = pts[(i + 1) % 3];
        const r = pts[(i + 2) % 3];
        return <path key={`arc${i}`} d={arcPath(p, q, r)} fill="none" stroke={colors[i]} strokeWidth={4} />;
      })}
      {proof && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <line x1={A.x - ux * 160} y1={A.y - uy * 160} x2={A.x + ux * 160} y2={A.y + uy * 160} stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 4" />
          <path d={arcPath(A, { x: A.x - ux, y: A.y - uy }, B, 30)} fill="none" stroke={colors[1]} strokeWidth={4} />
          <path d={arcPath(A, C, { x: A.x + ux, y: A.y + uy }, 30)} fill="none" stroke={colors[2]} strokeWidth={4} />
          <text x={A.x} y={A.y - 34} fontSize={11} fontWeight={800} textAnchor="middle" fill="#6d28d9">
            three angles on a straight line = 180°
          </text>
        </motion.g>
      )}
      {pts.map((p, i) => (
        <g key={`v${i}`}>
          <circle
            cx={p.x}
            cy={p.y}
            r={onDrag ? 11 : 6}
            fill={colors[i]}
            stroke="white"
            strokeWidth={3}
            style={{ cursor: onDrag ? 'grab' : 'default' }}
            onPointerDown={(e) => {
              if (!onDrag) return;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              dragging.current = i;
            }}
          />
          {labels[i] !== null && (
            <text x={p.x + (p.x < W / 2 ? -14 : 14)} y={p.y + (p.y < H / 2 ? -12 : 22)} fontSize={14} fontWeight={900} textAnchor="middle" fill={colors[i]}>
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

export const TriangleExplore: React.FC<SimProps> = () => {
  const [pts, setPts] = useState<Pt[]>([
    { x: 200, y: 40 },
    { x: 70, y: 200 },
    { x: 330, y: 200 },
  ]);
  const [proof, setProof] = useState(false);
  const angles = pts.map((p, i) => angleAt(p, pts[(i + 1) % 3], pts[(i + 2) % 3]));
  const rounded = angles.map((a) => Math.round(a));
  const fix = 180 - rounded[0] - rounded[1];
  return (
    <SimFrame
      caption={
        <span>
          <span className="text-rose-600">{rounded[0]}°</span> + <span className="text-sky-600">{rounded[1]}°</span> +{' '}
          <span className="text-emerald-600">{fix}°</span> = <span className="text-violet-700">180°</span> · drag the corners!
        </span>
      }
      controls={
        <ChunkyButton color={proof ? 'white' : 'violet'} className="!px-3 !py-2 text-sm" onClick={() => setProof((p) => !p)}>
          {proof ? 'Hide proof' : '✨ Show why it is 180°'}
        </ChunkyButton>
      }
    >
      <TriangleScene
        pts={pts}
        labels={[`${rounded[0]}°`, `${rounded[1]}°`, `${fix}°`]}
        proof={proof}
        onDrag={(i, p) => setPts((old) => old.map((q, j) => (j === i ? p : q)))}
      />
    </SimFrame>
  );
};

export function triangleRound(): ChallengeRound {
  const a = randInt(30, 90);
  const b = randInt(25, 150 - a);
  const c = 180 - a - b;
  const exterior = Math.random() < 0.4;
  const pts: Pt[] = (() => {
    // draw a triangle with these angles: base from B to C, apex from the angles
    const bx = 80;
    const cx = 320;
    const base = cx - bx;
    const tb = Math.tan((b * Math.PI) / 180);
    const tc = Math.tan((c * Math.PI) / 180);
    const ax = bx + (base * tc) / (tb + tc);
    const ay = 205 - ((ax - bx) * tb);
    const scale = ay < 30 ? (205 - 30) / (205 - ay) : 1;
    return [
      { x: ax, y: 205 - (205 - ay) * scale },
      { x: bx, y: 205 },
      { x: cx, y: 205 },
    ];
  })();
  if (exterior) {
    const ext = a + b;
    const { options, correct } = withOptions(`${ext}°`, [`${c}°`, `${180 - a}°`, `${ext + 10}°`, `${Math.abs(a - b) || 15}°`]);
    return {
      prompt: `Two angles of a triangle are ${a}° and ${b}°. What is the exterior angle at the third corner?`,
      options,
      correct,
      explain: `An exterior angle equals the sum of the two opposite interior angles: ${a}° + ${b}° = ${ext}°.`,
      visual: (revealed) => <TriangleScene pts={pts} labels={[`${a}°`, `${b}°`, revealed ? `${c}° (ext ${ext}°)` : '?']} />,
    };
  }
  const { options, correct } = withOptions(`${c}°`, [`${c + 10}°`, `${Math.max(5, c - 10)}°`, `${a + b}°`, `${360 - a - b - 180 + 20}°`]);
  return {
    prompt: `A triangle has angles ${a}° and ${b}°. What is the third angle?`,
    options,
    correct,
    explain: `The three angles of a triangle add up to 180°: 180° − ${a}° − ${b}° = ${c}°.`,
    visual: (revealed) => <TriangleScene pts={pts} labels={[`${a}°`, `${b}°`, revealed ? `${c}°` : '?']} />,
  };
}

/* ========================== GRAPHS (9-10) ============================= */

const GX = 8;
const GY = 6;
const gx = (x: number) => 200 + (x / GX) * 190;
const gy = (y: number) => 120 - (y / GY) * 110;

const LinePath: React.FC<{ m: number; c: number; color: string; k: string | number }> = ({ m, c, color, k }) => {
  const x1 = -GX;
  const x2 = GX;
  return (
    <motion.line
      key={k}
      x1={gx(x1)}
      y1={gy(m * x1 + c)}
      x2={gx(x2)}
      y2={gy(m * x2 + c)}
      stroke={color}
      strokeWidth={3}
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.8 }}
    />
  );
};

const parabolaPath = (a: number, b: number, c: number) => {
  const pts: string[] = [];
  for (let x = -GX; x <= GX; x += 0.1) {
    const y = a * x * x + b * x + c;
    if (y < -GY * 3 || y > GY * 3) continue;
    pts.push(`${pts.length ? 'L' : 'M'} ${gx(x).toFixed(1)} ${gy(y).toFixed(1)}`);
  }
  return pts.join(' ');
};

const GraphCanvas: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg {...svgProps}>
    <defs>
      <clipPath id="graph-clip">
        <rect x={gx(-GX)} y={gy(GY)} width={gx(GX) - gx(-GX)} height={gy(-GY) - gy(GY)} />
      </clipPath>
    </defs>
    <Axes toX={gx} toY={gy} xMin={-GX} xMax={GX} yMin={-GY} yMax={GY} />
    <g clipPath="url(#graph-clip)">{children}</g>
  </svg>
);

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(round(v, 2)));
const lineEq = (m: number, c: number) => `y = ${m === 1 ? '' : m === -1 ? '−' : fmt(m)}x ${c >= 0 ? '+' : '−'} ${fmt(Math.abs(c))}`;

export const GraphExplore: React.FC<SimProps> = ({ grade, variant }) => {
  const mode = variant === 'quadratic' ? 'quadratic' : variant === 'pair' || (variant !== 'line' && gradeN(grade) >= 10) ? 'pair' : 'line';
  const [m1, setM1] = useState(1);
  const [c1, setC1] = useState(1);
  const [m2, setM2] = useState(-0.5);
  const [c2, setC2] = useState(4);
  const [qa, setQa] = useState(1);
  const [qb, setQb] = useState(-2);
  const [qc, setQc] = useState(-3);
  const pulse = useClock(true);
  if (mode === 'quadratic') {
    const D = qb * qb - 4 * qa * qc;
    const roots = D >= 0 && qa !== 0 ? [(-qb - Math.sqrt(D)) / (2 * qa), (-qb + Math.sqrt(D)) / (2 * qa)] : [];
    return (
      <SimFrame
        caption={
          <span>
            y = {fmt(qa)}x² {qb >= 0 ? '+' : '−'} {Math.abs(qb)}x {qc >= 0 ? '+' : '−'} {Math.abs(qc)} · D = b² − 4ac = <span className="text-violet-700">{fmt(D)}</span> ·{' '}
            {D > 0 ? 'two different real roots' : D === 0 ? 'two equal real roots' : 'no real roots'}
            {roots.length ? ` (x = ${fmt(round(roots[0]))}${D > 0 ? `, ${fmt(round(roots[1]))}` : ''})` : ''}
          </span>
        }
        controls={
          <>
            <Slider label="a" value={qa} min={-2} max={2} step={0.5} onChange={(v) => setQa(v === 0 ? 0.5 : v)} />
            <Slider label="b" value={qb} min={-6} max={6} onChange={setQb} />
            <Slider label="c" value={qc} min={-6} max={6} onChange={setQc} />
          </>
        }
      >
        <GraphCanvas>
          <motion.path key={`${qa}${qb}${qc}`} d={parabolaPath(qa, qb, qc)} fill="none" stroke="#7c3aed" strokeWidth={3} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
          {roots.map((r, i) => (
            <circle key={i} cx={gx(r)} cy={gy(0)} r={6 + Math.sin(pulse * 5) * 2} fill="#f43f5e" stroke="white" strokeWidth={2} />
          ))}
        </GraphCanvas>
      </SimFrame>
    );
  }
  const parallel = mode === 'pair' && m1 === m2;
  const ix = parallel ? null : (c2 - c1) / (m1 - m2);
  const iy = ix === null ? null : m1 * ix + c1;
  return (
    <SimFrame
      caption={
        mode === 'pair' ? (
          <span>
            <span className="text-sky-700">{lineEq(m1, c1)}</span> and <span className="text-rose-600">{lineEq(m2, c2)}</span> ·{' '}
            {parallel ? (c1 === c2 ? 'same line: infinitely many solutions' : 'parallel lines: no solution') : `meet at (${fmt(round(ix!))}, ${fmt(round(iy!))}) — the solution`}
          </span>
        ) : (
          <span>
            <span className="text-sky-700">{lineEq(m1, c1)}</span> · slope {fmt(m1)} (up {fmt(m1)} for every 1 across) · cuts the y-axis at {c1}
          </span>
        )
      }
      controls={
        <>
          <Slider label="slope m" value={m1} min={-3} max={3} step={0.5} onChange={setM1} />
          <Slider label="intercept c" value={c1} min={-5} max={5} onChange={setC1} />
          {mode === 'pair' && <Slider label="2nd slope" value={m2} min={-3} max={3} step={0.5} onChange={setM2} />}
          {mode === 'pair' && <Slider label="2nd intercept" value={c2} min={-5} max={5} onChange={setC2} />}
        </>
      }
    >
      <GraphCanvas>
        <LinePath m={m1} c={c1} color="#0284c7" k={`a${m1}${c1}`} />
        {mode === 'pair' && <LinePath m={m2} c={c2} color="#e11d48" k={`b${m2}${c2}`} />}
        {mode === 'line' && (
          <g>
            <line x1={gx(1)} y1={gy(m1 + c1)} x2={gx(2)} y2={gy(m1 + c1)} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" />
            <line x1={gx(2)} y1={gy(m1 + c1)} x2={gx(2)} y2={gy(2 * m1 + c1)} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" />
            <circle cx={gx(0)} cy={gy(c1)} r={6} fill="#0284c7" stroke="white" strokeWidth={2} />
          </g>
        )}
        {ix !== null && iy !== null && Math.abs(ix) <= GX && Math.abs(iy) <= GY && (
          <circle cx={gx(ix)} cy={gy(iy)} r={7 + Math.sin(pulse * 5) * 2.5} fill="#f59e0b" stroke="white" strokeWidth={3} />
        )}
      </GraphCanvas>
    </SimFrame>
  );
};

export function graphRound(grade: string, variant?: string): ChallengeRound {
  const mode = variant === 'quadratic' ? 'quadratic' : gradeN(grade) >= 10 && variant !== 'line' ? pick(['pair', 'pair', 'line']) : 'line';
  if (mode === 'quadratic') {
    const r1 = randInt(-4, 4);
    const r2 = randInt(-4, 4);
    const kind = pick(['roots', 'nature', 'nature']);
    // (x - r1)(x - r2) = x² - (r1+r2)x + r1 r2, or a shifted one with no real roots
    const none = kind === 'nature' && Math.random() < 0.4;
    const b = none ? randInt(-2, 2) * 2 : -(r1 + r2);
    const c = none ? (b * b) / 4 + randInt(1, 4) : r1 * r2;
    const D = b * b - 4 * c;
    const eq = `x² ${b >= 0 ? '+' : '−'} ${Math.abs(b)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c)} = 0`;
    if (kind === 'roots' && D >= 0) {
      const right = r1 === r2 ? `x = ${r1} (equal roots)` : `x = ${Math.min(r1, r2)} and x = ${Math.max(r1, r2)}`;
      const { options, correct } = withOptions(right, [
        `x = ${-Math.min(r1, r2)} and x = ${-Math.max(r1, r2)}`,
        `x = ${Math.min(r1, r2) - 1} and x = ${Math.max(r1, r2) + 1}`,
        'no real roots',
      ]);
      return {
        prompt: `Solve ${eq}`,
        options,
        correct,
        explain: `It factorises as (x ${-r1 >= 0 ? '+' : '−'} ${Math.abs(r1)})(x ${-r2 >= 0 ? '+' : '−'} ${Math.abs(r2)}) = 0, so the parabola cuts the x-axis at ${right.replace('x = ', '')}.`,
        visual: (revealed) => (
          <GraphCanvas>{revealed && <motion.path d={parabolaPath(1, b, c)} fill="none" stroke="#7c3aed" strokeWidth={3} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />}</GraphCanvas>
        ),
      };
    }
    const right = D > 0 ? 'Two different real roots' : D === 0 ? 'Two equal real roots' : 'No real roots';
    const { options, correct } = withOptions(right, ['Two different real roots', 'Two equal real roots', 'No real roots'].filter((o) => o !== right));
    return {
      prompt: `What kind of roots does ${eq} have?`,
      options,
      correct,
      explain: `Discriminant D = b² − 4ac = ${b * b} − ${4 * c} = ${D}. ${D > 0 ? 'D > 0' : D === 0 ? 'D = 0' : 'D < 0'}, so: ${right.toLowerCase()}.`,
      visual: (revealed) => (
        <GraphCanvas>{revealed && <motion.path d={parabolaPath(1, b, c)} fill="none" stroke="#7c3aed" strokeWidth={3} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />}</GraphCanvas>
      ),
    };
  }
  if (mode === 'pair') {
    const x = randInt(-3, 3);
    const y = randInt(-3, 3);
    const m1 = pick([1, 2, -1, 0.5]);
    let m2 = pick([-1, -2, 1, 3, 0]);
    if (m2 === m1) m2 = -m1 - 1;
    const c1 = y - m1 * x;
    const c2 = y - m2 * x;
    const right = `(${x}, ${y})`;
    const { options, correct } = withOptions(right, [`(${y}, ${x})`, `(${x + 1}, ${y})`, `(${x}, ${y - 1})`, `(${-x}, ${-y})`]);
    return {
      prompt: `Where do ${lineEq(m1, c1)} and ${lineEq(m2, c2)} meet?`,
      options,
      correct,
      explain: `At (${x}, ${y}) both equations are true: it is the solution of the pair. ${y} = ${fmt(m1)}×${x} ${c1 >= 0 ? '+' : '−'} ${fmt(Math.abs(c1))}.`,
      visual: (revealed) => (
        <GraphCanvas>
          <LinePath m={m1} c={c1} color="#0284c7" k="a" />
          <LinePath m={m2} c={c2} color="#e11d48" k="b" />
          {revealed && <motion.circle cx={gx(x)} cy={gy(y)} r={8} fill="#f59e0b" stroke="white" strokeWidth={3} initial={{ scale: 0 }} animate={{ scale: [0, 1.6, 1] }} />}
        </GraphCanvas>
      ),
    };
  }
  const m = pick([1, 2, -1, -2, 0.5, 3]);
  const c = randInt(-4, 4);
  const askSlope = Math.random() < 0.5;
  const right = askSlope ? fmt(m) : String(c);
  const { options, correct } = withOptions(
    right,
    askSlope ? [fmt(-m), fmt(m + 1), String(c), fmt(1 / m)] : [String(-c), String(c + 1), fmt(m), String(c - 2)]
  );
  return {
    prompt: askSlope ? 'What is the slope (m) of this line?' : 'Where does this line cut the y-axis (c)?',
    options,
    correct,
    explain: askSlope
      ? `For every 1 step right the line goes ${m > 0 ? 'up' : 'down'} ${fmt(Math.abs(m))}: slope m = ${fmt(m)}. (${lineEq(m, c)})`
      : `At x = 0 the line is at y = ${c}: c = ${c}. (${lineEq(m, c)})`,
    visual: (revealed) => (
      <GraphCanvas>
        <LinePath m={m} c={c} color="#0284c7" k="l" />
        {revealed && askSlope && (
          <g>
            <line x1={gx(1)} y1={gy(m + c)} x2={gx(2)} y2={gy(m + c)} stroke="#f59e0b" strokeWidth={3} />
            <line x1={gx(2)} y1={gy(m + c)} x2={gx(2)} y2={gy(2 * m + c)} stroke="#f59e0b" strokeWidth={3} />
          </g>
        )}
        {revealed && !askSlope && <circle cx={gx(0)} cy={gy(c)} r={8} fill="#f59e0b" stroke="white" strokeWidth={3} />}
      </GraphCanvas>
    ),
  };
}

/* ============================ TRIGONOMETRY ============================ */

const UC = { cx: 110, cy: 120, r: 85 };

const UnitCircle: React.FC<{ deg: number; trail?: number[] }> = ({ deg, trail = [] }) => {
  const t = (deg * Math.PI) / 180;
  const px = UC.cx + UC.r * Math.cos(t);
  const py = UC.cy - UC.r * Math.sin(t);
  const waveX = (d: number) => 220 + (d / 360) * 170;
  const waveY = (s: number) => UC.cy - s * UC.r;
  return (
    <svg {...svgProps}>
      <circle cx={UC.cx} cy={UC.cy} r={UC.r} fill="#f0f9ff" stroke="#0369a1" strokeWidth={2} />
      <line x1={UC.cx - UC.r - 10} x2={UC.cx + UC.r + 10} y1={UC.cy} y2={UC.cy} stroke="#a8a29e" />
      <line y1={UC.cy - UC.r - 10} y2={UC.cy + UC.r + 10} x1={UC.cx} x2={UC.cx} stroke="#a8a29e" />
      <polygon points={`${UC.cx},${UC.cy} ${px},${UC.cy} ${px},${py}`} fill="#fde68a" opacity={0.6} />
      <line x1={UC.cx} y1={UC.cy} x2={px} y2={py} stroke="#1c1917" strokeWidth={3} />
      <line x1={px} y1={UC.cy} x2={px} y2={py} stroke="#e11d48" strokeWidth={4} />
      <line x1={UC.cx} y1={UC.cy} x2={px} y2={UC.cy} stroke="#0284c7" strokeWidth={4} />
      <path d={`M ${UC.cx + 20} ${UC.cy} A 20 20 0 ${deg % 360 > 180 ? 1 : 0} 0 ${UC.cx + 20 * Math.cos(t)} ${UC.cy - 20 * Math.sin(t)}`} fill="none" stroke="#7c3aed" strokeWidth={2.5} />
      <circle cx={px} cy={py} r={7} fill="#f59e0b" stroke="white" strokeWidth={2} />
      {/* sine wave traced on the right */}
      <line x1={220} x2={392} y1={UC.cy} y2={UC.cy} stroke="#d6d3d1" />
      <polyline points={trail.map((d) => `${waveX(d)},${waveY(Math.sin((d * Math.PI) / 180))}`).join(' ')} fill="none" stroke="#e11d48" strokeWidth={2.5} />
      <line x1={px} y1={py} x2={waveX(deg % 360)} y2={py} stroke="#e11d48" strokeDasharray="3 3" opacity={0.6} />
      <text x={226} y={22} fontSize={11} fontWeight={800} fill="#e11d48">
        sin θ = {round(Math.sin(t), 3)}
      </text>
      <text x={226} y={38} fontSize={11} fontWeight={800} fill="#0284c7">
        cos θ = {round(Math.cos(t), 3)}
      </text>
      <text x={226} y={54} fontSize={11} fontWeight={800} fill="#78716c">
        tan θ = {Math.abs(Math.cos(t)) < 1e-6 ? 'not defined' : round(Math.tan(t), 3)}
      </text>
      <text x={UC.cx + 26} y={UC.cy - 8} fontSize={12} fontWeight={900} fill="#7c3aed">
        {Math.round(deg % 360)}°
      </text>
    </svg>
  );
};

export const TrigExplore: React.FC<SimProps> = () => {
  const [auto, setAuto] = useState(true);
  const [manual, setManual] = useState(30);
  const t = useClock(auto);
  const deg = auto ? (t * 40) % 360 : manual;
  const trail = useMemo(() => Array.from({ length: Math.floor(deg / 3) + 1 }, (_, i) => i * 3), [Math.floor(deg / 3)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <SimFrame
      caption={<span>In a circle of radius 1: <span className="text-rose-600">sin θ = height</span>, <span className="text-sky-700">cos θ = width</span>, tan θ = sin θ / cos θ</span>}
      controls={
        <>
          <Toggle options={[{ id: 'auto', label: '▶ Spin' }, { id: 'hand', label: '✋ Set angle' }]} value={auto ? 'auto' : 'hand'} onChange={(v) => { setAuto(v === 'auto'); setManual(Math.round(deg)); }} />
          {!auto && <Slider label="Angle θ" value={manual} min={0} max={360} step={15} unit="°" onChange={setManual} />}
        </>
      }
    >
      <UnitCircle deg={deg} trail={trail} />
    </SimFrame>
  );
};

const TRIG_FACTS: { q: string; a: string; deg: number }[] = [
  { q: 'sin 30°', a: '1/2', deg: 30 },
  { q: 'cos 60°', a: '1/2', deg: 60 },
  { q: 'tan 45°', a: '1', deg: 45 },
  { q: 'sin 90°', a: '1', deg: 90 },
  { q: 'cos 0°', a: '1', deg: 0 },
  { q: 'sin 60°', a: '√3/2', deg: 60 },
  { q: 'cos 30°', a: '√3/2', deg: 30 },
  { q: 'sin 45°', a: '1/√2', deg: 45 },
  { q: 'tan 60°', a: '√3', deg: 60 },
  { q: 'tan 30°', a: '1/√3', deg: 30 },
  { q: 'sin 0°', a: '0', deg: 0 },
  { q: 'cos 90°', a: '0', deg: 90 },
];
const TRIG_VALUES = ['0', '1/2', '1/√2', '√3/2', '1', '√3', '1/√3'];

export function trigRound(): ChallengeRound {
  if (Math.random() < 0.35) {
    // heights and distances: a tower seen from d metres at an angle of elevation
    const angle = pick([30, 45, 60]);
    const d = pick([10, 20, 30, 40, 50]);
    const right = angle === 45 ? `${d} m` : angle === 60 ? `${d}√3 m` : `${d}/√3 m`;
    const { options, correct } = withOptions(right, [`${d} m`, `${d}√3 m`, `${d}/√3 m`, `${d * 2} m`].filter((o) => o !== right));
    return {
      prompt: `From ${d} m away, the top of a tower is seen at an angle of elevation of ${angle}°. How tall is the tower?`,
      options,
      correct,
      explain: `tan ${angle}° = height / ${d}, so height = ${d} × tan ${angle}° = ${right}.`,
      visual: (revealed) => {
        const h = d * Math.tan((angle * Math.PI) / 180);
        const s = 150 / Math.max(d, h);
        return (
          <svg {...svgProps}>
            <line x1={40} x2={360} y1={210} y2={210} stroke="#57534e" strokeWidth={3} />
            <rect x={60 + d * s} y={210 - h * s} width={14} height={h * s} fill="#78716c" />
            <text x={40} y={205} fontSize={20}>
              🧍
            </text>
            <motion.line x1={52} y1={196} x2={60 + d * s} y2={210 - h * s} stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="6 4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
            <text x={90} y={202} fontSize={12} fontWeight={900} fill="#7c3aed">
              {angle}°
            </text>
            <text x={60 + (d * s) / 2} y={228} fontSize={12} fontWeight={800} textAnchor="middle" fill="#1c1917">
              {d} m
            </text>
            <text x={84 + d * s} y={210 - (h * s) / 2} fontSize={13} fontWeight={900} fill="#e11d48">
              {revealed ? right : 'h = ?'}
            </text>
          </svg>
        );
      },
    };
  }
  const fact = pick(TRIG_FACTS);
  const { options, correct } = withOptions(fact.a, TRIG_VALUES.filter((v) => v !== fact.a).sort(() => Math.random() - 0.5));
  return {
    prompt: `What is ${fact.q}?`,
    options,
    correct,
    explain: `${fact.q} = ${fact.a}. On the unit circle at ${fact.deg}°, ${fact.q.startsWith('sin') ? 'the height' : fact.q.startsWith('cos') ? 'the width' : 'height ÷ width'} is ${fact.a}.`,
    visual: (revealed) => <UnitCircle deg={revealed ? fact.deg : 0} />,
  };
}

/* ============================ PROBABILITY ============================= */

export const ProbabilityExplore: React.FC<SimProps> = () => {
  const [mode, setMode] = useState<'coin' | 'die'>('coin');
  const [counts, setCounts] = useState<number[]>([0, 0]);
  const [last, setLast] = useState<number | null>(null);
  const [flip, setFlip] = useState(0);
  const faces = mode === 'coin' ? ['Heads', 'Tails'] : ['1', '2', '3', '4', '5', '6'];
  const total = counts.reduce((a, b) => a + b, 0);
  const run = (times: number) => {
    const next = [...counts];
    let r = 0;
    for (let i = 0; i < times; i++) {
      r = Math.floor(Math.random() * faces.length);
      next[r] += 1;
    }
    setCounts(next);
    setLast(r);
    setFlip((f) => f + 1);
    soundEffects.playWordPop();
  };
  const switchMode = (m: 'coin' | 'die') => {
    setMode(m);
    setCounts(m === 'coin' ? [0, 0] : [0, 0, 0, 0, 0, 0]);
    setLast(null);
  };
  const theory = 1 / faces.length;
  const maxBar = 150;
  const barW = 260 / faces.length;
  return (
    <SimFrame
      caption={
        <span>
          {total} {mode === 'coin' ? 'tosses' : 'rolls'} · each result should come about <span className="text-violet-700">{frac(1, faces.length)}</span> of the time — the more you try, the closer it gets
        </span>
      }
      controls={
        <>
          <Toggle options={[{ id: 'coin', label: '🪙 Coin' }, { id: 'die', label: '🎲 Die' }]} value={mode} onChange={(v) => switchMode(v as 'coin' | 'die')} />
          {[1, 10, 100].map((n) => (
            <ChunkyButton key={n} color="sky" className="!px-3 !py-2 text-sm" onClick={() => run(n)}>
              ×{n}
            </ChunkyButton>
          ))}
        </>
      }
    >
      <svg {...svgProps}>
        <motion.g key={flip} initial={{ rotateY: 0, y: 0 }} animate={{ rotateY: 720, y: [0, -40, 0] }} transition={{ duration: 0.7 }} style={{ transformOrigin: '60px 110px' }}>
          <circle cx={60} cy={110} r={34} fill={mode === 'coin' ? '#fbbf24' : '#f5f5f4'} stroke="#92400e" strokeWidth={3} />
          <text x={60} y={117} textAnchor="middle" fontWeight={900} fontSize={mode === 'coin' ? 13 : 24} fill="#451a03">
            {last === null ? '?' : faces[last]}
          </text>
        </motion.g>
        {faces.map((f, i) => {
          const p = total ? counts[i] / total : 0;
          const h = p * maxBar * (faces.length / 2);
          return (
            <g key={f}>
              <motion.rect x={120 + i * barW + 4} width={barW - 8} initial={false} animate={{ y: 200 - h, height: h }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} rx={4} fill={i % 2 ? '#0ea5e9' : '#f59e0b'} />
              <text x={120 + i * barW + barW / 2} y={216} fontSize={11} fontWeight={800} textAnchor="middle" fill="#44403c">
                {f}
              </text>
              <text x={120 + i * barW + barW / 2} y={196 - h} fontSize={10} fontWeight={800} textAnchor="middle" fill="#57534e">
                {total ? round(p, 2) : ''}
              </text>
            </g>
          );
        })}
        <line x1={120} x2={380} y1={200 - theory * maxBar * (faces.length / 2)} y2={200 - theory * maxBar * (faces.length / 2)} stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 4" />
        <text x={380} y={194 - theory * maxBar * (faces.length / 2)} fontSize={10} fontWeight={800} textAnchor="end" fill="#7c3aed">
          theory {frac(1, faces.length)}
        </text>
      </svg>
    </SimFrame>
  );
};

export function probabilityRound(): ChallengeRound {
  const kind = pick(['bag', 'die', 'cards', 'bag']);
  if (kind === 'bag') {
    const red = randInt(1, 6);
    const blue = randInt(1, 6);
    const green = randInt(0, 3);
    const total = red + blue + green;
    const ask = pick(['red', 'blue', ...(green ? ['green'] : [])]);
    const k = ask === 'red' ? red : ask === 'blue' ? blue : green;
    const right = frac(k, total);
    const { options, correct } = withOptions(right, [frac(total - k, total), `${k}/${Math.max(1, total - k)}`, frac(1, total), frac(Math.min(total, k + 1), total)]);
    const balls = [...Array(red).fill('#ef4444'), ...Array(blue).fill('#3b82f6'), ...Array(green).fill('#22c55e')];
    return {
      prompt: `A bag has ${red} red, ${blue} blue${green ? ` and ${green} green` : ''} balls. One is picked without looking. P(${ask})?`,
      options,
      correct,
      explain: `${k} ${ask} out of ${total} balls: P = ${k}/${total}${right !== `${k}/${total}` ? ` = ${right}` : ''}.`,
      visual: (revealed) => (
        <svg {...svgProps}>
          <path d="M 110 60 Q 100 220 200 225 Q 300 220 290 60 Z" fill="#fde68a" stroke="#92400e" strokeWidth={3} />
          {balls.map((c, i) => (
            <motion.circle
              key={i}
              cx={140 + (i % 6) * 24}
              cy={200 - Math.floor(i / 6) * 24}
              r={10}
              fill={c}
              stroke="white"
              strokeWidth={2}
              animate={{ y: [0, -4, 0], opacity: revealed && c !== (ask === 'red' ? '#ef4444' : ask === 'blue' ? '#3b82f6' : '#22c55e') ? 0.25 : 1 }}
              transition={{ duration: 1.2 + (i % 3) * 0.2, repeat: Infinity }}
            />
          ))}
        </svg>
      ),
    };
  }
  if (kind === 'die') {
    const q = pick([
      { text: 'an even number', k: 3 },
      { text: 'a number greater than 4', k: 2 },
      { text: 'a prime number', k: 3 },
      { text: 'a 6', k: 1 },
      { text: 'a number less than 3', k: 2 },
      { text: 'a 7', k: 0 },
    ]);
    const right = frac(q.k, 6);
    const { options, correct } = withOptions(right, [frac(6 - q.k, 6), frac(q.k + 1, 6), '1', '1/2', '1/3', '0'].filter((o) => o !== right));
    return {
      prompt: `A die is rolled once. What is the probability of getting ${q.text}?`,
      options,
      correct,
      explain: `${q.k} of the 6 faces work: P = ${q.k}/6${right !== `${q.k}/6` ? ` = ${right}` : ''}.${q.k === 0 ? ' It is impossible.' : ''}`,
      visual: () => (
        <svg {...svgProps}>
          {[1, 2, 3, 4, 5, 6].map((n, i) => (
            <motion.g key={n} initial={{ y: -80, rotate: -40 }} animate={{ y: 0, rotate: 0 }} transition={{ delay: i * 0.08, type: 'spring' }}>
              <rect x={40 + i * 56} y={95} width={46} height={46} rx={8} fill="white" stroke="#44403c" strokeWidth={2.5} />
              <text x={63 + i * 56} y={126} textAnchor="middle" fontWeight={900} fontSize={20} fill="#1c1917">
                {n}
              </text>
            </motion.g>
          ))}
        </svg>
      ),
    };
  }
  const q = pick([
    { text: 'a king', k: 4 },
    { text: 'a red card', k: 26 },
    { text: 'a heart', k: 13 },
    { text: 'the ace of spades', k: 1 },
    { text: 'a face card (J, Q, K)', k: 12 },
  ]);
  const right = frac(q.k, 52);
  const { options, correct } = withOptions(right, [frac(q.k, 13), frac(52 - q.k, 52), '1/2', '1/4', '1/13', '3/13'].filter((o) => o !== right));
  return {
    prompt: `One card is drawn from a full pack of 52 cards. P(${q.text})?`,
    options,
    correct,
    explain: `${q.k} of the 52 cards: P = ${q.k}/52${right !== `${q.k}/52` ? ` = ${right}` : ''}.`,
    visual: () => (
      <svg {...svgProps}>
        {['♠', '♥', '♦', '♣'].map((s, i) => (
          <motion.g key={s} initial={{ rotate: 0 }} animate={{ rotate: (i - 1.5) * 12 }} style={{ transformOrigin: '200px 230px' }}>
            <rect x={170} y={60} width={60} height={86} rx={8} fill="white" stroke="#44403c" strokeWidth={2} />
            <text x={200} y={115} textAnchor="middle" fontSize={30} fill={i === 1 || i === 2 ? '#e11d48' : '#1c1917'}>
              {s}
            </text>
          </motion.g>
        ))}
      </svg>
    ),
  };
}

/* ================================ SETS ================================ */

type Pred = { id: string; label: string; test: (n: number) => boolean };
const PREDICATES: Pred[] = [
  { id: 'even', label: 'even numbers', test: (n) => n % 2 === 0 },
  { id: 'm3', label: 'multiples of 3', test: (n) => n % 3 === 0 },
  { id: 'prime', label: 'prime numbers', test: (n) => n > 1 && [2, 3, 5, 7, 11, 13, 17, 19].includes(n) },
  { id: 'm5', label: 'multiples of 5', test: (n) => n % 5 === 0 },
  { id: 'f12', label: 'factors of 12', test: (n) => 12 % n === 0 },
];

const VennScene: React.FC<{ U: number[]; inA: (n: number) => boolean; inB: (n: number) => boolean; shade: string; labelA: string; labelB: string }> = ({
  U,
  inA,
  inB,
  shade,
  labelA,
  labelB,
}) => {
  const region = (n: number) => (inA(n) && inB(n) ? 'AB' : inA(n) ? 'A' : inB(n) ? 'B' : 'U');
  const groups: Record<string, number[]> = { A: [], AB: [], B: [], U: [] };
  U.forEach((n) => groups[region(n)].push(n));
  const spots: Record<string, { x: number; y: number; cols: number }> = {
    A: { x: 105, y: 85, cols: 3 },
    AB: { x: 190, y: 95, cols: 2 },
    B: { x: 255, y: 85, cols: 3 },
    U: { x: 20, y: 205, cols: 18 },
  };
  const highlighted = (r: string) =>
    shade === 'union' ? r !== 'U' : shade === 'inter' ? r === 'AB' : shade === 'aminusb' ? r === 'A' : shade === 'bminusa' ? r === 'B' : false;
  return (
    <svg {...svgProps}>
      <rect x={6} y={6} width={388} height={228} rx={14} fill="#fafaf9" stroke="#a8a29e" strokeWidth={2} />
      <text x={16} y={24} fontSize={12} fontWeight={900} fill="#57534e">
        U
      </text>
      <motion.circle cx={150} cy={110} r={82} animate={{ fill: shade === 'union' || shade === 'aminusb' ? 'rgba(14,165,233,0.25)' : 'rgba(14,165,233,0.08)' }} stroke="#0284c7" strokeWidth={3} />
      <motion.circle cx={250} cy={110} r={82} animate={{ fill: shade === 'union' || shade === 'bminusa' ? 'rgba(244,63,94,0.25)' : 'rgba(244,63,94,0.08)' }} stroke="#e11d48" strokeWidth={3} />
      {shade === 'inter' && (
        <motion.path d="M 200 44 A 82 82 0 0 1 200 176 A 82 82 0 0 1 200 44 Z" fill="rgba(124,58,237,0.35)" initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.8, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
      )}
      {shade === 'aminusb' && <circle cx={250} cy={110} r={82} fill="#fafaf9" opacity={0.7} />}
      {shade === 'bminusa' && <circle cx={150} cy={110} r={82} fill="#fafaf9" opacity={0.7} />}
      <text x={110} y={36} fontSize={12} fontWeight={900} fill="#0369a1" textAnchor="middle">
        A: {labelA}
      </text>
      <text x={290} y={36} fontSize={12} fontWeight={900} fill="#be123c" textAnchor="middle">
        B: {labelB}
      </text>
      {Object.entries(groups).map(([r, list]) =>
        list.map((n, i) => {
          const s = spots[r];
          return (
            <motion.text
              key={n}
              layout
              initial={false}
              animate={{ x: s.x + (i % s.cols) * (r === 'U' ? 21 : 22), y: s.y + Math.floor(i / s.cols) * 20, scale: highlighted(r) ? 1.2 : 1 }}
              transition={{ type: 'spring', stiffness: 140, damping: 16 }}
              fontSize={13}
              fontWeight={900}
              fill={highlighted(r) ? '#6d28d9' : '#57534e'}
            >
              {n}
            </motion.text>
          );
        })
      )}
    </svg>
  );
};

export const VennExplore: React.FC<SimProps> = () => {
  const [a, setA] = useState('even');
  const [b, setB] = useState('m3');
  const [op, setOp] = useState('inter');
  const U = useMemo(() => Array.from({ length: 20 }, (_, i) => i + 1), []);
  const pa = PREDICATES.find((p) => p.id === a)!;
  const pb = PREDICATES.find((p) => p.id === b)!;
  const A = U.filter(pa.test);
  const B = U.filter(pb.test);
  const inter = A.filter((n) => pb.test(n));
  const union = U.filter((n) => pa.test(n) || pb.test(n));
  const shown = op === 'union' ? union : op === 'inter' ? inter : op === 'aminusb' ? A.filter((n) => !pb.test(n)) : B.filter((n) => !pa.test(n));
  return (
    <SimFrame
      caption={
        <span>
          {op === 'union' ? 'A ∪ B' : op === 'inter' ? 'A ∩ B' : op === 'aminusb' ? 'A − B' : 'B − A'} = {'{'}
          {shown.join(', ')}
          {'}'} · n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = {A.length} + {B.length} − {inter.length} = {union.length}
        </span>
      }
      controls={
        <>
          <Toggle options={PREDICATES.map((p) => ({ id: p.id, label: `A: ${p.label}` }))} value={a} onChange={(v) => v !== b && setA(v)} />
          <Toggle options={PREDICATES.map((p) => ({ id: p.id, label: `B: ${p.label}` }))} value={b} onChange={(v) => v !== a && setB(v)} />
          <Toggle
            options={[
              { id: 'union', label: 'A ∪ B' },
              { id: 'inter', label: 'A ∩ B' },
              { id: 'aminusb', label: 'A − B' },
              { id: 'bminusa', label: 'B − A' },
            ]}
            value={op}
            onChange={setOp}
          />
        </>
      }
    >
      <VennScene U={U} inA={pa.test} inB={pb.test} shade={op} labelA={pa.label} labelB={pb.label} />
    </SimFrame>
  );
};

export function vennRound(): ChallengeRound {
  const start = randInt(1, 4);
  const A = Array.from({ length: randInt(4, 5) }, (_, i) => start + i);
  const bStart = start + randInt(1, 3);
  const B = Array.from({ length: randInt(3, 5) }, (_, i) => bStart + i);
  const inter = A.filter((n) => B.includes(n));
  const union = [...new Set([...A, ...B])].sort((x, y) => x - y);
  const show = (s: number[]) => `{${s.join(', ')}}`;
  const op = pick(['inter', 'union', 'aminusb', 'count']);
  const U = Array.from({ length: 12 }, (_, i) => i + 1);
  const visual = (revealed: boolean) => (
    <VennScene U={U} inA={(n) => A.includes(n)} inB={(n) => B.includes(n)} shade={revealed ? (op === 'count' ? 'union' : op) : 'none'} labelA={show(A)} labelB={show(B)} />
  );
  if (op === 'count') {
    const right = String(union.length);
    const { options, correct } = withOptions(right, [String(A.length + B.length), String(inter.length), String(union.length + 1), String(Math.abs(A.length - B.length))]);
    return {
      prompt: `A = ${show(A)}, B = ${show(B)}. What is n(A ∪ B)?`,
      options,
      correct,
      explain: `n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = ${A.length} + ${B.length} − ${inter.length} = ${union.length}.`,
      visual,
    };
  }
  const result = op === 'inter' ? inter : op === 'union' ? union : A.filter((n) => !B.includes(n));
  const right = result.length ? show(result) : '{ } (empty set)';
  const { options, correct } = withOptions(right, [show(inter), show(union), show(A.filter((n) => !B.includes(n))), show(B.filter((n) => !A.includes(n)))].filter((o) => o !== right));
  const name = op === 'inter' ? 'A ∩ B' : op === 'union' ? 'A ∪ B' : 'A − B';
  return {
    prompt: `A = ${show(A)}, B = ${show(B)}. What is ${name}?`,
    options,
    correct,
    explain:
      op === 'inter'
        ? `A ∩ B has the elements in both A and B: ${right}.`
        : op === 'union'
        ? `A ∪ B has every element of A or B, each written once: ${right}.`
        : `A − B has the elements of A that are not in B: ${right}.`,
    visual,
  };
}

/** Animated count-up helper (used by headers). */
export const CountUp: React.FC<{ to: number }> = ({ to }) => {
  const v = useMotionValue(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    const c = animate(v, to, { duration: 0.8, onUpdate: (x) => setN(Math.round(x)) });
    return () => c.stop();
  }, [to, v]);
  return <>{n}</>;
};
