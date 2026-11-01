import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  MathsVisual,
  angleKind,
  columnSteps,
  graphPoints,
  moneyPieces,
  numberlinePoints,
  shapeCorners,
  shapeMeasures,
} from '../../data/mathsScenes';

// Drawings for the maths templates of an animated lesson
// (src/data/mathsScenes.ts). Each one plays its method step by step, holds
// the finished picture for a moment, and plays again while the scene is on.

/** 0, 1, … n one step every `ms`, then holds `hold` steps and starts again. */
function useTick(n: number, ms = 900, hold = 4) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const t = window.setInterval(() => setI((x) => (x + 1) % (n + hold + 1)), ms);
    return () => window.clearInterval(t);
  }, [n, ms, hold]);
  return Math.min(i, n);
}

const Result: React.FC<{ show: boolean; children: React.ReactNode }> = ({ show, children }) => (
  <motion.p
    initial={false}
    animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.8 }}
    className="maths-result mt-1 rounded-2xl bg-amber-100 px-3 py-1 text-center text-lg font-black text-amber-950"
  >
    {children}
  </motion.p>
);

const fmt = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

/* ---------- number line ---------- */
const NumberLineScene: React.FC<{ v: Extract<MathsVisual, { kind: 'numberline' }> }> = ({ v }) => {
  const pts = numberlinePoints(v);
  const t = useTick(v.jumps, 850);
  const step = Math.abs(v.step);
  const lo = Math.min(...pts) - step;
  const hi = Math.max(...pts) + step;
  const X = (n: number) => 30 + ((n - lo) / (hi - lo)) * 540;
  const Y = 150;
  const ticks = [lo, ...[...pts].sort((a, b) => a - b), hi];
  const end = pts[pts.length - 1];
  return (
    <div className="flex w-full flex-col items-center">
      <svg viewBox="0 0 600 200" className="w-full max-w-xl" role="img" aria-label={`Number line from ${v.start} in jumps of ${v.step}`}>
        <line x1={14} y1={Y} x2={586} y2={Y} stroke="#44403c" strokeWidth={3} markerEnd="url(#nl-arrow)" markerStart="url(#nl-arrow-s)" />
        <defs>
          <marker id="nl-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#44403c" />
          </marker>
          <marker id="nl-arrow-s" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
            <path d="M8,0 L0,4 L8,8 z" fill="#44403c" />
          </marker>
        </defs>
        {ticks.map((n, i) => (
          <g key={i}>
            <line x1={X(n)} y1={Y - 8} x2={X(n)} y2={Y + 8} stroke="#44403c" strokeWidth={2} />
            <text x={X(n)} y={Y + 30} textAnchor="middle" fontSize={ticks.length > 9 ? 13 : 16} fontWeight={800} fill={i === 0 || i === ticks.length - 1 ? '#a8a29e' : '#1c1917'}>
              {fmt(n)}
            </text>
          </g>
        ))}
        {pts.slice(1).map((p, k) => {
          const x1 = X(pts[k]);
          const x2 = X(p);
          const on = k < t;
          return (
            <g key={k}>
              <motion.path
                d={`M ${x1} ${Y - 6} Q ${(x1 + x2) / 2} ${Y - 80} ${x2} ${Y - 6}`}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={3.5}
                strokeLinecap="round"
                initial={false}
                animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
                transition={{ duration: 0.6 }}
              />
              <motion.text x={(x1 + x2) / 2} y={Y - 50} textAnchor="middle" fontSize={14} fontWeight={900} fill="#b45309" initial={false} animate={{ opacity: on ? 1 : 0 }}>
                {v.step > 0 ? '+' : '−'}
                {step}
              </motion.text>
            </g>
          );
        })}
        <motion.text initial={false} animate={{ x: X(pts[t]), y: Y - 12 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }} textAnchor="middle" fontSize={30}>
          🐸
        </motion.text>
        {pts.slice(0, t + 1).map((p, k) => (
          <circle key={k} cx={X(p)} cy={Y} r={6} fill={k === t ? '#16a34a' : '#86efac'} />
        ))}
      </svg>
      <Result show={t >= v.jumps}>
        {fmt(v.start)} {v.jumps <= 6 ? Array.from({ length: v.jumps }, () => `${v.step > 0 ? '+' : '−'} ${step}`).join(' ') : `${v.step > 0 ? '+' : '−'} (${v.jumps} × ${step})`} = {fmt(end)}
      </Result>
    </div>
  );
};

/* ---------- place value ---------- */
const PLACES = [
  { name: 'Ones', short: 'O', color: 'bg-amber-400' },
  { name: 'Tens', short: 'T', color: 'bg-sky-400' },
  { name: 'Hundreds', short: 'H', color: 'bg-emerald-400' },
  { name: 'Thousands', short: 'Th', color: 'bg-violet-400' },
  { name: 'Ten thousands', short: 'TTh', color: 'bg-rose-400' },
];
const Block: React.FC<{ place: number }> = ({ place }) => {
  const color = PLACES[place].color;
  if (place === 0) return <span className={`inline-block h-3 w-3 rounded-sm ${color} ring-1 ring-black/20`} />;
  if (place === 1) return <span className={`inline-block h-[42px] w-2.5 rounded-sm ${color} ring-1 ring-black/20`} style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 3.6px, rgba(0,0,0,.25) 3.6px 4.2px)' }} />;
  const grid = { backgroundImage: 'linear-gradient(rgba(0,0,0,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.22) 1px, transparent 1px)', backgroundSize: '3.2px 3.2px' };
  if (place === 2) return <span className={`inline-block h-8 w-8 rounded-sm ${color} ring-1 ring-black/20`} style={grid} />;
  if (place === 3) return <span className={`inline-block h-8 w-8 rounded-sm ${color} ring-1 ring-black/30 shadow-[3px_-3px_0_rgba(91,33,182,.55)]`} style={grid} />;
  return <span className={`inline-block rounded-md px-1 py-1.5 text-[10px] font-black text-white ${color}`}>10 000</span>;
};
const PlaceValueScene: React.FC<{ v: Extract<MathsVisual, { kind: 'placevalue' }> }> = ({ v }) => {
  const digits = String(v.n).split('').map(Number);
  const k = digits.length;
  const t = useTick(k, 1000);
  const parts = digits.map((d, i) => d * 10 ** (k - 1 - i)).filter(Boolean);
  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex items-end justify-center gap-2">
        {digits.map((d, i) => {
          const place = k - 1 - i;
          const on = i < t;
          return (
            <motion.div key={i} initial={false} animate={{ opacity: on ? 1 : 0.15, y: on ? 0 : 12 }} className="flex w-[84px] flex-col items-center gap-1 rounded-2xl bg-white p-1.5 ring-1 ring-stone-100">
              <div className="flex min-h-[96px] flex-wrap content-end items-end justify-center gap-0.5">
                {Array.from({ length: d }, (_, j) => (
                  <motion.span key={j} initial={false} animate={{ scale: on ? 1 : 0 }} transition={{ delay: on ? j * 0.06 : 0 }}>
                    <Block place={place} />
                  </motion.span>
                ))}
              </div>
              <span className="text-3xl font-black text-stone-900">{d}</span>
              <span className="text-[10px] font-black uppercase tracking-wide text-stone-500">{PLACES[place].name}</span>
            </motion.div>
          );
        })}
      </div>
      <Result show={t >= k}>
        {parts.join(' + ')} = {v.n}
      </Result>
    </div>
  );
};

/* ---------- column addition / subtraction ---------- */
const ColumnScene: React.FC<{ v: Extract<MathsVisual, { kind: 'column' }> }> = ({ v }) => {
  const steps = columnSteps(v.op, v.a, v.b);
  const n = steps.length;
  const t = useTick(n, 1300);
  const finalCarry = v.op === 'add' && steps[n - 1].carry === 1;
  const width = n + (finalCarry ? 1 : 0);
  const answer = v.op === 'add' ? v.a + v.b : v.a - v.b;
  // column index (0 = ones) → grid position from the left (after the sign column)
  const col = (i: number) => width - i + 1;
  const aDigits = String(v.a).length;
  const bDigits = String(v.b).length;
  const cell = 'flex h-11 w-10 items-center justify-center font-mono text-4xl font-black';
  return (
    <div className="flex w-full flex-col items-center">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${width + 1}, 2.5rem)` }}>
        {/* carries (add) or borrowed digits (sub) */}
        {steps.map((s, i) => {
          if (v.op === 'add') {
            const on = s.carry === 1 && i < t;
            return (
              <motion.div key={`c${i}`} style={{ gridColumn: col(i + 1), gridRow: 1 }} initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : 10 }} className="flex h-7 items-end justify-center text-lg font-black text-rose-600">
                1
              </motion.div>
            );
          }
          const on = s.top !== undefined && (i < t || (i === t && steps[i - 1]?.carry === 1));
          return (
            <motion.div key={`c${i}`} style={{ gridColumn: col(i), gridRow: 1 }} initial={false} animate={{ opacity: on ? 1 : 0 }} className="flex h-7 items-end justify-center text-lg font-black text-rose-600">
              {s.top}
            </motion.div>
          );
        })}
        {/* the two numbers */}
        {steps.map((s, i) => {
          const crossed = v.op === 'sub' && s.top !== undefined && (i < t || (i === t && steps[i - 1]?.carry === 1));
          const active = i === t - 1;
          return (
            <React.Fragment key={`ab${i}`}>
              <div style={{ gridColumn: col(i), gridRow: 2 }} className={`${cell} ${active ? 'rounded-t-xl bg-amber-100' : ''} ${crossed ? 'text-stone-400 line-through decoration-rose-500 decoration-4' : 'text-stone-900'}`}>
                {i < aDigits ? s.a : ''}
              </div>
              <div style={{ gridColumn: col(i), gridRow: 3 }} className={`${cell} ${active ? 'bg-amber-100' : ''} text-stone-900`}>
                {i < bDigits ? s.b : ''}
              </div>
              <motion.div style={{ gridColumn: col(i), gridRow: 5 }} initial={false} animate={{ opacity: i < t ? 1 : 0, scale: i < t ? 1 : 0.5 }} className={`${cell} ${active ? 'rounded-b-xl bg-amber-100' : ''} text-emerald-700`}>
                {s.result}
              </motion.div>
            </React.Fragment>
          );
        })}
        <div style={{ gridColumn: 1, gridRow: 3 }} className={`${cell} text-sky-700`}>
          {v.op === 'add' ? '+' : '−'}
        </div>
        <div style={{ gridColumn: `1 / span ${width + 1}`, gridRow: 4 }} className="my-1 h-1 rounded bg-stone-800" />
        {finalCarry && (
          <motion.div style={{ gridColumn: 2, gridRow: 5 }} initial={false} animate={{ opacity: t >= n ? 1 : 0 }} className={`${cell} text-emerald-700`}>
            1
          </motion.div>
        )}
      </div>
      <p className="mt-1 h-5 text-xs font-black text-stone-500">
        {t > 0 && t <= n ? ['Ones', 'Tens', 'Hundreds', 'Thousands', 'Ten thousands'][t - 1] : ''}
        {t > 0 && t <= n && steps[t - 1].carry ? (v.op === 'add' ? ' · carry 1' : ' · borrow 1') : ''}
      </p>
      <Result show={t >= n}>
        {v.a} {v.op === 'add' ? '+' : '−'} {v.b} = {answer}
      </Result>
    </div>
  );
};

/* ---------- multiplication array ---------- */
const ArrayScene: React.FC<{ v: Extract<MathsVisual, { kind: 'array' }> }> = ({ v }) => {
  const t = useTick(v.rows, 800);
  const size = v.cols > 8 || v.rows > 6 ? 'text-xl' : v.cols > 5 ? 'text-2xl' : 'text-3xl';
  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: v.rows }, (_, r) => (
          <motion.div key={r} initial={false} animate={{ opacity: r < t ? 1 : 0.1, x: r < t ? 0 : -20 }} className="flex items-center gap-1">
            <span className={`${size} leading-none`}>{Array.from({ length: v.cols }, () => v.emoji).join('')}</span>
            <span className={`ml-2 rounded-lg px-1.5 text-sm font-black ${r === t - 1 ? 'bg-amber-300 text-amber-950' : 'text-stone-500'}`}>{r < t ? (r + 1) * v.cols : ''}</span>
          </motion.div>
        ))}
      </div>
      <Result show={t >= v.rows}>
        {v.rows} rows of {v.cols}: {v.rows} × {v.cols} = {v.rows * v.cols}
      </Result>
    </div>
  );
};

/* ---------- sharing (division) ---------- */
const ShareScene: React.FC<{ v: Extract<MathsVisual, { kind: 'share' }> }> = ({ v }) => {
  const each = Math.floor(v.total / v.groups);
  const left = v.total % v.groups;
  const t = useTick(each, 900);
  const dealt = t * v.groups;
  const size = v.total > 30 ? 'text-lg' : 'text-2xl';
  const item = (k: number) => (
    <motion.span key={k} layoutId={`share-${k}`} transition={{ type: 'spring', stiffness: 220, damping: 22 }} className={`${size} leading-none`}>
      {v.emoji}
    </motion.span>
  );
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex min-h-[36px] max-w-md flex-wrap justify-center gap-0.5 rounded-2xl bg-stone-100 px-2 py-1">
        {Array.from({ length: v.total }, (_, k) => k).filter((k) => k >= dealt).map(item)}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: v.groups }, (_, g) => (
          <div key={g} className="flex w-[74px] flex-col items-center rounded-b-[2rem] rounded-t-xl border-4 border-sky-200 bg-sky-50 px-1 pb-2 pt-1">
            <div className="flex min-h-[48px] flex-wrap content-start justify-center gap-0.5">{Array.from({ length: v.total }, (_, k) => k).filter((k) => k < dealt && k % v.groups === g).map(item)}</div>
            <span className="text-xs font-black text-sky-800">{Math.min(t, each)}</span>
          </div>
        ))}
      </div>
      <Result show={t >= each}>
        {v.total} ÷ {v.groups} = {each}
        {left ? `, ${left} left over` : ''}
      </Result>
    </div>
  );
};

/* ---------- fractions ---------- */
const FractionText: React.FC<{ n: number; d: number }> = ({ n, d }) => (
  <span className="inline-flex flex-col items-center px-1 align-middle font-black leading-none text-stone-900">
    <span className="text-2xl">{n}</span>
    <span className="my-0.5 h-0.5 w-6 bg-stone-900" />
    <span className="text-2xl">{d}</span>
  </span>
);
const FractionPicture: React.FC<{ n: number; d: number; shape: 'circle' | 'bar'; shaded: number; cut: boolean; color: string }> = ({ n, d, shape, shaded, cut, color }) => {
  if (shape === 'bar') {
    return (
      <svg viewBox="0 0 244 64" className="w-[220px]" role="img" aria-label={`${n} of ${d} parts`}>
        {Array.from({ length: d }, (_, i) => (
          <motion.rect key={i} x={2 + (i * 240) / d} y={2} width={240 / d} height={60} stroke="#1c1917" strokeWidth={cut ? 2.5 : 0} initial={false} animate={{ fill: i < shaded ? color : '#fff' }} />
        ))}
        <rect x={2} y={2} width={240} height={60} fill="none" stroke="#1c1917" strokeWidth={3} />
      </svg>
    );
  }
  const r = 70;
  const slice = (i: number) => {
    const a0 = (i / d) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
    return `M 75 75 L ${75 + r * Math.cos(a0)} ${75 + r * Math.sin(a0)} A ${r} ${r} 0 ${1 / d > 0.5 ? 1 : 0} 1 ${75 + r * Math.cos(a1)} ${75 + r * Math.sin(a1)} Z`;
  };
  return (
    <svg viewBox="0 0 150 150" className="w-[150px]" role="img" aria-label={`${n} of ${d} parts`}>
      {Array.from({ length: d }, (_, i) => (
        <motion.path key={i} d={slice(i)} stroke="#1c1917" strokeWidth={cut ? 2.5 : 0} initial={false} animate={{ fill: i < shaded ? color : '#fff' }} />
      ))}
      <circle cx={75} cy={75} r={r} fill="none" stroke="#1c1917" strokeWidth={3} />
    </svg>
  );
};
const FractionScene: React.FC<{ v: Extract<MathsVisual, { kind: 'fraction' }> }> = ({ v }) => {
  const two = v.den2 !== undefined && v.num2 !== undefined;
  const steps = 1 + Math.max(v.num, two ? v.num2! : 0);
  const t = useTick(steps, 800);
  const sign = two ? (v.num * v.den2! === v.num2! * v.den ? '=' : v.num * v.den2! > v.num2! * v.den ? '>' : '<') : '';
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <FractionPicture n={v.num} d={v.den} shape={v.shape} cut={t >= 1} shaded={Math.min(v.num, t - 1)} color="#fbbf24" />
          <FractionText n={v.num} d={v.den} />
        </div>
        {two && (
          <>
            <motion.span initial={false} animate={{ opacity: t >= steps ? 1 : 0 }} className="text-5xl font-black text-rose-600">
              {sign}
            </motion.span>
            <div className="flex flex-col items-center gap-1">
              <FractionPicture n={v.num2!} d={v.den2!} shape={v.shape} cut={t >= 1} shaded={Math.min(v.num2!, t - 1)} color="#38bdf8" />
              <FractionText n={v.num2!} d={v.den2!} />
            </div>
          </>
        )}
      </div>
      <Result show={t >= steps}>
        {two ? `${v.num}/${v.den} ${sign} ${v.num2}/${v.den2}` : `${v.num} of ${v.den} equal parts = ${v.num}/${v.den}`}
      </Result>
    </div>
  );
};

/* ---------- shapes ---------- */
function polygon(n: number, w = 200, h = 170): [number, number][] {
  const r = Math.min(w, h) / 2 - 10;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2 + (n === 4 ? Math.PI / 4 : 0);
    return [w / 2 + r * Math.cos(a), h / 2 + 8 + r * Math.sin(a)];
  });
}
const ShapeScene: React.FC<{ v: Extract<MathsVisual, { kind: 'shape' }> }> = ({ v }) => {
  const corners = shapeCorners(v.shape);
  const measures = shapeMeasures(v);
  const steps = v.shape === 'circle' ? 2 : v.shape === 'angle' ? 2 : corners + (measures ? 1 : 0);
  const t = useTick(steps, 800);

  if (v.shape === 'circle') {
    return (
      <div className="flex w-full flex-col items-center">
        <svg viewBox="0 0 200 190" className="w-[220px]" role="img" aria-label="A circle">
          <motion.circle cx={100} cy={95} r={80} fill="#e0f2fe" stroke="#0284c7" strokeWidth={5} initial={false} animate={{ pathLength: t >= 1 ? 1 : 0.02 }} transition={{ duration: 0.9 }} />
          <circle cx={100} cy={95} r={4} fill="#1c1917" />
          <motion.line x1={100} y1={95} x2={180} y2={95} stroke="#e11d48" strokeWidth={3} initial={false} animate={{ opacity: t >= 2 ? 1 : 0 }} />
          <motion.text x={140} y={88} textAnchor="middle" fontSize={13} fontWeight={800} fill="#e11d48" initial={false} animate={{ opacity: t >= 2 ? 1 : 0 }}>
            radius
          </motion.text>
        </svg>
        <Result show={t >= 2}>Round: no sides, no corners</Result>
      </div>
    );
  }

  if (v.shape === 'angle') {
    const deg = v.a || 60;
    const R = 120;
    const shown = t >= 1 ? deg : 0;
    const end = (d: number) => [40 + R * Math.cos((-d * Math.PI) / 180), 160 + R * Math.sin((-d * Math.PI) / 180)];
    const [ex, ey] = end(shown);
    const arc = (d: number) => {
      const [ax, ay] = [40 + 40 * Math.cos((-d * Math.PI) / 180), 160 + 40 * Math.sin((-d * Math.PI) / 180)];
      return `M 80 160 A 40 40 0 ${d > 180 ? 1 : 0} 0 ${ax} ${ay}`;
    };
    return (
      <div className="flex w-full flex-col items-center">
        <svg viewBox="-90 20 300 160" className="w-[300px]" role="img" aria-label={`An angle of ${deg} degrees`}>
          <line x1={40} y1={160} x2={40 + R} y2={160} stroke="#1c1917" strokeWidth={5} strokeLinecap="round" />
          <motion.line x1={40} y1={160} initial={false} animate={{ x2: ex, y2: ey }} transition={{ duration: 1.2 }} stroke="#0284c7" strokeWidth={5} strokeLinecap="round" />
          {deg === 90 && t >= 1 ? <rect x={40} y={140} width={20} height={20} fill="none" stroke="#e11d48" strokeWidth={3} /> : <motion.path initial={false} animate={{ d: arc(Math.max(shown, 1)) }} transition={{ duration: 1.2 }} fill="none" stroke="#e11d48" strokeWidth={3} />}
          <circle cx={40} cy={160} r={5} fill="#1c1917" />
          <motion.text x={95} y={140} fontSize={18} fontWeight={900} fill="#e11d48" initial={false} animate={{ opacity: t >= 2 ? 1 : 0 }}>
            {deg}°
          </motion.text>
        </svg>
        <Result show={t >= 2}>
          {deg}° is {angleKind(deg) === 'acute' ? 'an acute' : angleKind(deg) === 'right' ? 'a right' : angleKind(deg) === 'obtuse' ? 'an obtuse' : 'a straight'} angle
        </Result>
      </div>
    );
  }

  // polygons: square/rectangle drawn to their sides, others regular
  let pts: [number, number][];
  const unit = measures ? Math.min(200 / (v.a || 1), 140 / (v.shape === 'rectangle' ? v.b || 1 : v.a || 1), 34) : 0;
  if (v.shape === 'rectangle' || v.shape === 'square') {
    const w = measures ? (v.a || 1) * unit : v.shape === 'square' ? 140 : 190;
    const h = measures ? (v.shape === 'square' ? (v.a || 1) : v.b || 1) * unit : v.shape === 'square' ? 140 : 110;
    const x0 = 110 - w / 2;
    const y0 = 95 - h / 2;
    pts = [
      [x0, y0],
      [x0 + w, y0],
      [x0 + w, y0 + h],
      [x0, y0 + h],
    ];
  } else {
    pts = polygon(corners).map(([x, y]) => [x + 10, y - 5]);
  }
  const cols = v.a || 0;
  const rows = v.shape === 'rectangle' ? v.b || 0 : v.a || 0;
  return (
    <div className="flex w-full flex-col items-center">
      <svg viewBox="0 0 220 190" className="w-[240px]" role="img" aria-label={`A ${v.shape}`}>
        {measures && t >= steps &&
          Array.from({ length: rows * cols }, (_, k) => (
            <motion.rect key={k} x={pts[0][0] + (k % cols) * unit} y={pts[0][1] + Math.floor(k / cols) * unit} width={unit} height={unit} fill="#bbf7d0" stroke="#4ade80" strokeWidth={1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: k * 0.03 }} />
          ))}
        {pts.map(([x, y], i) => {
          const [x2, y2] = pts[(i + 1) % pts.length];
          const on = i < t;
          return (
            <g key={i}>
              <line x1={x} y1={y} x2={x2} y2={y2} stroke="#e7e5e4" strokeWidth={5} strokeLinecap="round" />
              <motion.line x1={x} y1={y} x2={x2} y2={y2} stroke="#0284c7" strokeWidth={5} strokeLinecap="round" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.5 }} />
            </g>
          );
        })}
        {pts.map(([x, y], i) => (
          <motion.g key={i} initial={false} animate={{ scale: i < t ? 1 : 0 }} style={{ originX: `${x}px`, originY: `${y}px` }}>
            <circle cx={x} cy={y} r={11} fill="#f59e0b" />
            <text x={x} y={y + 4.5} textAnchor="middle" fontSize={13} fontWeight={900} fill="#fff">
              {i + 1}
            </text>
          </motion.g>
        ))}
        {measures && (
          <>
            <text x={(pts[0][0] + pts[1][0]) / 2} y={pts[0][1] - 16} textAnchor="middle" fontSize={13} fontWeight={900} fill="#0369a1">
              {v.a}
            </text>
            <text x={pts[1][0] + 18} y={(pts[1][1] + pts[2][1]) / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={900} fill="#0369a1">
              {rows}
            </text>
          </>
        )}
      </svg>
      <Result show={t >= steps}>
        {measures
          ? `Perimeter = ${v.shape === 'square' ? `4 × ${v.a}` : `2 × (${v.a} + ${v.b})`} = ${measures.perimeter} · Area = ${v.shape === 'square' ? `${v.a} × ${v.a}` : `${v.a} × ${v.b}`} = ${measures.area} squares`
          : `${corners} sides · ${corners} corners`}
      </Result>
    </div>
  );
};

/* ---------- clock ---------- */
const ClockScene: React.FC<{ v: Extract<MathsVisual, { kind: 'clock' }> }> = ({ v }) => {
  const t = useTick(1, 2600, 2);
  const minuteDeg = t ? v.minute * 6 : 0;
  const hourDeg = t ? (v.hour % 12) * 30 + v.minute * 0.5 : 0;
  const hand = (deg: number): React.CSSProperties => ({ transform: `rotate(${deg}deg)`, transformOrigin: '100px 100px', transformBox: 'view-box', transition: 'transform 2.2s ease-in-out' });
  const words = v.minute === 0 ? `${v.hour} o'clock` : v.minute === 30 ? `half past ${v.hour}` : v.minute === 15 ? `quarter past ${v.hour}` : v.minute === 45 ? `quarter to ${(v.hour % 12) + 1}` : '';
  return (
    <div className="flex w-full flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-[200px]" role="img" aria-label={`A clock showing ${v.hour}:${String(v.minute).padStart(2, '0')}`}>
        <circle cx={100} cy={100} r={92} fill="#fff" stroke="#1c1917" strokeWidth={6} />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * 2 * Math.PI;
          const r1 = i % 5 === 0 ? 76 : 82;
          return <line key={i} x1={100 + r1 * Math.sin(a)} y1={100 - r1 * Math.cos(a)} x2={100 + 86 * Math.sin(a)} y2={100 - 86 * Math.cos(a)} stroke="#57534e" strokeWidth={i % 5 === 0 ? 3 : 1} />;
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const a = ((i + 1) / 12) * 2 * Math.PI;
          return (
            <text key={i} x={100 + 62 * Math.sin(a)} y={100 - 62 * Math.cos(a) + 7} textAnchor="middle" fontSize={19} fontWeight={900} fill="#1c1917">
              {i + 1}
            </text>
          );
        })}
        <line className="clock-hour" x1={100} y1={100} x2={100} y2={52} stroke="#1c1917" strokeWidth={8} strokeLinecap="round" style={hand(hourDeg)} />
        <line className="clock-minute" x1={100} y1={100} x2={100} y2={26} stroke="#e11d48" strokeWidth={5} strokeLinecap="round" style={hand(minuteDeg)} />
        <circle cx={100} cy={100} r={6} fill="#1c1917" />
      </svg>
      <Result show={t >= 1}>
        {v.hour}:{String(v.minute).padStart(2, '0')}
        {words ? ` · ${words}` : ''}
      </Result>
    </div>
  );
};

/* ---------- money ---------- */
const NOTE_COLORS: Record<number, string> = { 500: '#a8a29e', 200: '#fb923c', 100: '#a78bfa', 50: '#67e8f9', 20: '#bef264', 10: '#b45309' };
const MoneyScene: React.FC<{ v: Extract<MathsVisual, { kind: 'money' }> }> = ({ v }) => {
  const pieces = moneyPieces(v.amount);
  const t = useTick(pieces.length, 700);
  const total = pieces.slice(0, t).reduce((a, b) => a + b, 0);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex max-w-lg flex-wrap items-center justify-center gap-2">
        {pieces.map((p, i) => (
          <motion.div key={i} initial={false} animate={{ opacity: i < t ? 1 : 0, y: i < t ? 0 : -30, rotate: i < t ? 0 : -8 }} transition={{ type: 'spring', stiffness: 200, damping: 16 }}>
            {p >= 10 ? (
              <span className="flex h-11 w-[84px] items-center justify-center rounded-md border-2 border-black/20 text-base font-black text-stone-900 shadow" style={{ background: NOTE_COLORS[p] }}>
                ₹{p}
              </span>
            ) : (
              <span className={`flex h-11 w-11 items-center justify-center rounded-full border-4 text-sm font-black shadow ${p === 5 ? 'border-amber-500 bg-amber-300 text-amber-950' : 'border-stone-400 bg-stone-200 text-stone-800'}`}>₹{p}</span>
            )}
          </motion.div>
        ))}
      </div>
      <p className="text-4xl font-black text-emerald-700">₹{total}</p>
      <Result show={t >= pieces.length}>{pieces.join(' + ')} = ₹{v.amount}</Result>
    </div>
  );
};

/* ---------- ruler ---------- */
const MeasureScene: React.FC<{ v: Extract<MathsVisual, { kind: 'measure' }> }> = ({ v }) => {
  const t = useTick(1, 2200, 2);
  const L = Math.min(32, Math.max(10, Math.ceil(v.length) + 2));
  const cm = 560 / L;
  return (
    <div className="flex w-full flex-col items-center">
      <svg viewBox="0 0 600 170" className="w-full max-w-xl" role="img" aria-label={`Measuring ${v.length} centimetres`}>
        <motion.rect x={20} y={36} height={34} rx={8} fill="#fde68a" stroke="#d97706" strokeWidth={2} initial={false} animate={{ width: t ? v.length * cm : 0 }} transition={{ duration: 1.6, ease: 'easeOut' }} />
        <motion.text y={64} fontSize={26} initial={false} animate={{ x: t ? 20 + v.length * cm - 30 : 22 }} transition={{ duration: 1.6, ease: 'easeOut' }}>
          {v.emoji}
        </motion.text>
        <rect x={10} y={84} width={580} height={62} rx={6} fill="#fef9c3" stroke="#a16207" strokeWidth={2} />
        {Array.from({ length: L * 2 + 1 }, (_, i) => {
          const x = 20 + (i / 2) * cm;
          const major = i % 2 === 0;
          return (
            <g key={i}>
              <line x1={x} y1={84} x2={x} y2={major ? 108 : 98} stroke="#422006" strokeWidth={major ? 2 : 1} />
              {major && (
                <text x={x} y={128} textAnchor="middle" fontSize={L > 20 ? 10 : 14} fontWeight={800} fill="#422006">
                  {i / 2}
                </text>
              )}
            </g>
          );
        })}
        <text x={585} y={142} textAnchor="end" fontSize={11} fontWeight={800} fill="#a16207">
          cm
        </text>
        <motion.line x1={20 + v.length * cm} y1={30} x2={20 + v.length * cm} y2={110} stroke="#e11d48" strokeWidth={3} strokeDasharray="5 4" initial={false} animate={{ opacity: t ? 1 : 0 }} transition={{ delay: t ? 1.5 : 0 }} />
      </svg>
      <Result show={t >= 1}>
        Start at 0 · it ends at {v.length} · {v.length} cm long
      </Result>
    </div>
  );
};

/* ---------- bar graph ---------- */
const BarsScene: React.FC<{ v: Extract<MathsVisual, { kind: 'bars' }> }> = ({ v }) => {
  const t = useTick(v.bars.length, 800);
  const max = Math.max(...v.bars.map((b) => b.value), 1);
  const top = v.bars.reduce((a, b) => (b.value > a.value ? b : a), v.bars[0]);
  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex h-[190px] items-end gap-3 border-b-4 border-l-4 border-stone-700 px-3">
        {v.bars.map((b, i) => (
          <div key={i} className="flex w-14 flex-col items-center justify-end">
            <motion.span initial={false} animate={{ opacity: i < t ? 1 : 0 }} className="text-sm font-black text-stone-900">
              {b.value}
            </motion.span>
            <motion.div initial={false} animate={{ height: i < t ? Math.max(4, (b.value / max) * 150) : 0 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} className={`w-10 rounded-t-lg ${['bg-sky-400', 'bg-amber-400', 'bg-emerald-400', 'bg-rose-400', 'bg-violet-400', 'bg-lime-400'][i % 6]}`} />
          </div>
        ))}
      </div>
      <div className="flex gap-3 px-3 pt-1">
        {v.bars.map((b, i) => (
          <span key={i} className="flex w-14 flex-col items-center text-center text-[11px] font-black leading-tight text-stone-700">
            <span className="text-lg">{b.emoji}</span>
            {b.label}
          </span>
        ))}
      </div>
      <Result show={t >= v.bars.length}>
        Most: {top.label} ({top.value})
      </Result>
    </div>
  );
};

/* ---------- straight-line graph ---------- */
const GraphScene: React.FC<{ v: Extract<MathsVisual, { kind: 'graph' }> }> = ({ v }) => {
  const pts = graphPoints(v);
  const t = useTick(pts.length + 1, 650);
  const X = (x: number) => 150 + x * 26;
  const Y = (y: number) => 150 - y * 13;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const eq = `y = ${v.slope === 1 ? '' : v.slope === -1 ? '−' : fmt(v.slope)}x ${v.intercept < 0 ? '−' : '+'} ${Math.abs(v.intercept)}`;
  const table = pts.filter((p) => p.x >= -2 && p.x <= 2);
  const shown = pts.slice(0, t);
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-3">
      <svg viewBox="0 0 300 300" className="w-[260px]" role="img" aria-label={`Graph of ${eq}`}>
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} x1={X(i - 6)} y1={20} x2={X(i - 6)} y2={280} stroke="#e7e5e4" />
        ))}
        {Array.from({ length: 21 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={Y(i - 10)} x2={300} y2={Y(i - 10)} stroke="#e7e5e4" />
        ))}
        <line x1={0} y1={150} x2={300} y2={150} stroke="#1c1917" strokeWidth={2} />
        <line x1={150} y1={20} x2={150} y2={280} stroke="#1c1917" strokeWidth={2} />
        {[-5, 5].map((x) => (
          <text key={x} x={X(x)} y={165} textAnchor="middle" fontSize={10} fontWeight={800}>
            {fmt(x)}
          </text>
        ))}
        {[-10, 10].map((y) => (
          <text key={y} x={140} y={Y(y) + 4} textAnchor="end" fontSize={10} fontWeight={800}>
            {fmt(y)}
          </text>
        ))}
        <text x={292} y={145} textAnchor="end" fontSize={12} fontWeight={900}>
          x
        </text>
        <text x={158} y={30} fontSize={12} fontWeight={900}>
          y
        </text>
        <motion.line x1={X(first.x)} y1={Y(first.y)} x2={X(last.x)} y2={Y(last.y)} stroke="#e11d48" strokeWidth={3} initial={false} animate={{ pathLength: t > pts.length ? 1 : 0, opacity: t > pts.length ? 1 : 0 }} transition={{ duration: 0.8 }} />
        {shown.map((p, i) => (
          <motion.circle key={i} cx={X(p.x)} cy={Y(p.y)} r={5} fill="#0284c7" initial={{ scale: 0 }} animate={{ scale: 1 }} />
        ))}
        {t > 0 && t <= pts.length && (
          <text x={X(pts[t - 1].x) + 8} y={Y(pts[t - 1].y) - 8} fontSize={12} fontWeight={900} fill="#0369a1">
            ({fmt(pts[t - 1].x)}, {fmt(pts[t - 1].y)})
          </text>
        )}
      </svg>
      <div className="flex flex-col items-center gap-1">
        <p className="text-lg font-black text-rose-700">{eq}</p>
        <table className="text-center text-sm font-black">
          <tbody>
            <tr>
              <th className="border border-stone-300 bg-stone-100 px-2">x</th>
              {table.map((p) => (
                <td key={p.x} className="border border-stone-300 px-2">
                  {fmt(p.x)}
                </td>
              ))}
            </tr>
            <tr>
              <th className="border border-stone-300 bg-stone-100 px-2">y</th>
              {table.map((p) => (
                <td key={p.x} className={`border border-stone-300 px-2 ${shown.some((s) => s.x === p.x) ? 'text-sky-700' : 'text-transparent'}`}>
                  {fmt(p.y)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const MathsScene: React.FC<{ visual: MathsVisual }> = ({ visual }) => {
  switch (visual.kind) {
    case 'numberline':
      return <NumberLineScene v={visual} />;
    case 'placevalue':
      return <PlaceValueScene v={visual} />;
    case 'column':
      return <ColumnScene v={visual} />;
    case 'array':
      return <ArrayScene v={visual} />;
    case 'share':
      return <ShareScene v={visual} />;
    case 'fraction':
      return <FractionScene v={visual} />;
    case 'shape':
      return <ShapeScene v={visual} />;
    case 'clock':
      return <ClockScene v={visual} />;
    case 'money':
      return <MoneyScene v={visual} />;
    case 'measure':
      return <MeasureScene v={visual} />;
    case 'bars':
      return <BarsScene v={visual} />;
    case 'graph':
      return <GraphScene v={visual} />;
  }
};
