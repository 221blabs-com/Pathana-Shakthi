// Physics simulations for Classes 6-10 (Telangana syllabus): electric
// circuits (conductors for Class 6-7, Ohm's law for Class 10), magnets and
// the field of a current, motion and its graphs, refraction at a plane
// surface (Snell's law, total internal reflection) and lenses (ray diagrams
// from the lens formula). Each has an Explore view and a challenge round maker.
import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChunkyButton } from '../ui';
import { ChallengeRound, SimFrame, SimProps, Slider, Toggle, clamp, gradeN, pick, randInt, round, useClock, withOptions } from './simKit';

const W = 400;
const H = 240;
const svgProps = { viewBox: `0 0 ${W} ${H}`, className: 'h-full w-full', preserveAspectRatio: 'xMidYMid meet' } as const;
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

type Pt = [number, number];

/** Point at distance `s` along a closed polyline. */
function alongLoop(points: Pt[], s: number): Pt {
  const lens = points.map((p, i) => Math.hypot(points[(i + 1) % points.length][0] - p[0], points[(i + 1) % points.length][1] - p[1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let d = ((s % total) + total) % total;
  for (let i = 0; i < points.length; i++) {
    if (d <= lens[i]) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const f = lens[i] ? d / lens[i] : 0;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    d -= lens[i];
  }
  return points[0];
}

/* ============================== CIRCUITS ============================== */

const LOOP: Pt[] = [
  [70, 60],
  [330, 60],
  [330, 190],
  [70, 190],
];
const LOOP_LENGTH = 2 * (260 + 130);

/** Battery (left side), switch (top), bulb (right), resistor or gap object (bottom), electrons flowing. */
const CircuitScene: React.FC<{
  cells: number;
  closed: boolean;
  current: number; // amperes, for electron speed and glow
  glow: number; // 0..1
  gapItem?: { label: string; emoji: string; conducts: boolean } | null;
  resistor?: string | null;
  showElectrons?: boolean;
}> = ({ cells, closed, current, glow, gapItem, resistor, showElectrons = true }) => {
  const t = useClock(true);
  const flowing = closed && current > 0 && (!gapItem || gapItem.conducts);
  const speed = 18 + Math.min(1, current / 3) * 110;
  const electrons = 16;
  return (
    <svg {...svgProps}>
      {/* wires */}
      <path d="M 70 60 L 330 60 L 330 190 L 70 190 Z" fill="none" stroke="#b45309" strokeWidth={5} strokeLinejoin="round" />
      {/* battery: cells stacked on the left wire */}
      <rect x={52} y={96} width={36} height={58} fill="#f5f5f4" />
      {Array.from({ length: cells }, (_, i) => {
        const y = 102 + (i * 48) / Math.max(1, cells);
        return (
          <g key={i}>
            <line x1={56} x2={84} y1={y} y2={y} stroke="#1c1917" strokeWidth={3} />
            <line x1={63} x2={77} y1={y + 6} y2={y + 6} stroke="#1c1917" strokeWidth={6} />
          </g>
        );
      })}
      <text x={40} y={104} fontSize={13} fontWeight={900} fill="#dc2626">+</text>
      <text x={40} y={156} fontSize={15} fontWeight={900} fill="#1d4ed8">−</text>
      <text x={96} y={130} fontSize={11} fontWeight={900} fill="#57534e">{round(cells * 1.5, 1)} V</text>
      {/* switch on the top wire */}
      <rect x={176} y={50} width={48} height={20} fill="#f8fafc" />
      <circle cx={180} cy={60} r={4} fill="#1c1917" />
      <circle cx={220} cy={60} r={4} fill="#1c1917" />
      <motion.line x1={180} y1={60} initial={false} animate={{ x2: closed ? 220 : 212, y2: closed ? 60 : 36 }} stroke="#1c1917" strokeWidth={4} strokeLinecap="round" />
      <text x={200} y={30} fontSize={10} fontWeight={800} textAnchor="middle" fill="#57534e">{closed ? 'switch ON' : 'switch OFF'}</text>
      {/* bulb on the right wire */}
      <rect x={316} y={105} width={28} height={40} fill="#f8fafc" />
      <motion.circle cx={330} cy={115} r={40} initial={false} animate={{ opacity: glow * 0.55 }} fill="url(#bulbGlow)" />
      <defs>
        <radialGradient id="bulbGlow">
          <stop offset="0%" stopColor="#fde047" stopOpacity={1} />
          <stop offset="100%" stopColor="#fde047" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={330} cy={115} r={16} fill={glow > 0.02 ? `rgba(253,224,71,${0.35 + glow * 0.65})` : '#e7e5e4'} stroke="#78716c" strokeWidth={2} />
      <path d="M 323 120 Q 326 108 330 120 Q 334 108 337 120" fill="none" stroke={glow > 0.02 ? '#ea580c' : '#78716c'} strokeWidth={2} />
      <rect x={322} y={131} width={16} height={12} rx={2} fill="#a8a29e" />
      {/* bottom: resistor or the object put in the gap */}
      {resistor && (
        <g>
          <rect x={160} y={180} width={80} height={20} fill="#f8fafc" />
          <path d="M 160 190 l 8 -8 l 10 16 l 10 -16 l 10 16 l 10 -16 l 10 16 l 10 -16 l 12 8" fill="none" stroke="#1c1917" strokeWidth={3} />
          <text x={200} y={216} fontSize={11} fontWeight={800} textAnchor="middle" fill="#57534e">{resistor}</text>
        </g>
      )}
      {gapItem !== undefined && (
        <g>
          <rect x={160} y={176} width={80} height={28} fill="#f8fafc" />
          <circle cx={164} cy={190} r={4} fill="#1c1917" />
          <circle cx={236} cy={190} r={4} fill="#1c1917" />
          {gapItem ? (
            <motion.g initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <rect x={166} y={184} width={68} height={12} rx={6} fill={gapItem.conducts ? '#94a3b8' : '#fca5a5'} />
              <text x={200} y={176} fontSize={18} textAnchor="middle">{gapItem.emoji}</text>
              <text x={200} y={222} fontSize={11} fontWeight={800} textAnchor="middle" fill="#57534e">{gapItem.label}</text>
            </motion.g>
          ) : (
            <text x={200} y={222} fontSize={11} fontWeight={800} textAnchor="middle" fill="#57534e">gap</text>
          )}
        </g>
      )}
      {/* electrons: from the − terminal round the circuit to + */}
      {showElectrons &&
        flowing &&
        Array.from({ length: electrons }, (_, i) => {
          // LOOP runs clockwise on screen; electrons leave the − terminal (bottom of the battery) along
          // the bottom wire, so they move anticlockwise: negative distance.
          const [x, y] = alongLoop(LOOP, -(t * speed) + (i * LOOP_LENGTH) / electrons);
          return <circle key={i} cx={x} cy={y} r={3.2} fill="#2563eb" stroke="white" strokeWidth={1} />;
        })}
    </svg>
  );
};

const GAP_ITEMS = [
  { label: 'iron nail', emoji: '🔩', conducts: true },
  { label: 'copper wire', emoji: '🧵', conducts: true },
  { label: 'aluminium foil', emoji: '🥫', conducts: true },
  { label: 'steel spoon', emoji: '🥄', conducts: true },
  { label: 'pencil lead (graphite)', emoji: '✏️', conducts: true },
  { label: 'plastic scale', emoji: '📏', conducts: false },
  { label: 'rubber eraser', emoji: '🧽', conducts: false },
  { label: 'wooden stick', emoji: '🪵', conducts: false },
  { label: 'glass bangle', emoji: '💍', conducts: false },
  { label: 'paper', emoji: '📄', conducts: false },
];

export const CircuitExplore: React.FC<SimProps> = ({ grade }) => {
  const g = gradeN(grade);
  const ohm = g >= 8;
  const [cells, setCells] = useState(2);
  const [closed, setClosed] = useState(true);
  const [r1, setR1] = useState(4);
  const [r2, setR2] = useState(4);
  const [mode, setMode] = useState<'single' | 'series' | 'parallel'>('single');
  const [item, setItem] = useState(0);
  const V = cells * 1.5;
  const bulbR = 2; // the bulb's own resistance
  const R = ohm ? bulbR + (mode === 'single' ? r1 : mode === 'series' ? r1 + r2 : (r1 * r2) / (r1 + r2)) : bulbR + 1;
  const gap = ohm ? null : GAP_ITEMS[item];
  const I = closed && (!gap || gap.conducts) ? V / R : 0;
  const glow = clamp((I * I * bulbR) / 6, 0, 1);
  return (
    <SimFrame
      caption={
        ohm ? (
          <span>
            V = {round(V, 1)} V · R = {round(R, 2)} Ω (bulb 2 Ω{mode === 'single' ? ` + ${r1} Ω` : mode === 'series' ? ` + ${r1} + ${r2} Ω in series` : ` + ${r1}‖${r2} = ${round((r1 * r2) / (r1 + r2), 2)} Ω`}) · I = V/R ={' '}
            <span className="text-sky-700">{round(I, 2)} A</span>
          </span>
        ) : (
          <span>
            {!closed
              ? 'Switch OFF: the circuit is open, no current flows.'
              : gap && gap.conducts
              ? `${gap.label} is a conductor: the circuit is closed and the bulb glows. The filament gets hot — the heating effect of current.`
              : `${gap?.label} is an insulator: current cannot pass, the bulb stays off.`}
          </span>
        )
      }
      controls={
        <>
          <Slider label="Cells (1.5 V each)" value={cells} min={1} max={4} onChange={setCells} />
          <Toggle options={[{ id: 'on', label: '🔌 Switch ON' }, { id: 'off', label: 'Switch OFF' }]} value={closed ? 'on' : 'off'} onChange={(v) => setClosed(v === 'on')} />
          {ohm ? (
            <>
              <Toggle
                options={[
                  { id: 'single', label: 'One resistor' },
                  { id: 'series', label: 'Series' },
                  { id: 'parallel', label: 'Parallel' },
                ]}
                value={mode}
                onChange={(v) => setMode(v as typeof mode)}
              />
              <Slider label="R₁" value={r1} min={1} max={12} unit=" Ω" onChange={setR1} />
              {mode !== 'single' && <Slider label="R₂" value={r2} min={1} max={12} unit=" Ω" onChange={setR2} />}
            </>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {GAP_ITEMS.map((it, i) => (
                <button
                  key={it.label}
                  type="button"
                  onClick={() => setItem(i)}
                  className={`rounded-xl px-2 py-1 text-xs font-black ${i === item ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}
                >
                  {it.emoji} {it.label}
                </button>
              ))}
            </div>
          )}
        </>
      }
    >
      <CircuitScene
        cells={cells}
        closed={closed}
        current={I}
        glow={glow}
        gapItem={ohm ? undefined : gap}
        resistor={ohm ? (mode === 'single' ? `R = ${r1} Ω` : mode === 'series' ? `${r1} Ω + ${r2} Ω` : `${r1} Ω ‖ ${r2} Ω`) : null}
      />
    </SimFrame>
  );
};

export function circuitRound(grade: string): ChallengeRound {
  const g = gradeN(grade);
  if (g < 8) {
    const it = pick(GAP_ITEMS);
    const closed = Math.random() < 0.8;
    const glows = closed && it.conducts;
    const right = glows ? 'Yes, it glows' : 'No, it stays off';
    return {
      prompt: `The ${it.label} is put in the gap${closed ? '' : ' and the switch is OFF'}. Will the bulb glow?`,
      options: ['Yes, it glows', 'No, it stays off'],
      correct: glows ? 0 : 1,
      explain: !closed
        ? 'With the switch OFF the circuit is open — no current flows, whatever is in the gap.'
        : it.conducts
        ? `${it.label} is a conductor, so the circuit is closed and current flows.`
        : `${it.label} is an insulator, so current cannot flow through it.`,
      visual: (revealed) => (
        <CircuitScene cells={2} closed={closed} current={revealed && glows ? 1.5 : 0} glow={revealed && glows ? 0.8 : 0} gapItem={it} showElectrons={revealed} />
      ),
    };
  }
  const kind = pick(['current', 'voltage', 'series', 'parallel']);
  if (kind === 'series' || kind === 'parallel') {
    const a = pick([2, 3, 4, 6, 12]);
    const b = pick([2, 3, 4, 6, 12]);
    const value = kind === 'series' ? a + b : (a * b) / (a + b);
    const right = `${round(value, 2)} Ω`;
    const { options, correct } = withOptions(right, [
      `${round(kind === 'series' ? (a * b) / (a + b) : a + b, 2)} Ω`,
      `${a * b} Ω`,
      `${round(Math.abs(a - b) || a / 2, 2)} Ω`,
      `${round(value + 1, 2)} Ω`,
    ]);
    return {
      prompt: `${a} Ω and ${b} Ω are joined in ${kind}. What is the total (equivalent) resistance?`,
      options,
      correct,
      explain: kind === 'series' ? `In series, resistances add: ${a} + ${b} = ${a + b} Ω.` : `In parallel, 1/R = 1/${a} + 1/${b}, so R = ${a}×${b}/(${a}+${b}) = ${right}.`,
      visual: (revealed) => <CircuitScene cells={2} closed current={revealed ? 3 / (value + 2) : 0.3} glow={0.4} resistor={kind === 'series' ? `${a} Ω + ${b} Ω` : `${a} Ω ‖ ${b} Ω`} />,
    };
  }
  const cells = randInt(1, 4);
  const V = cells * 1.5;
  const Rv = pick([1, 2, 3, 5, 6]);
  if (kind === 'voltage') {
    const I = pick([0.5, 1, 1.5, 2]);
    const right = `${round(I * Rv, 2)} V`;
    const { options, correct } = withOptions(right, [`${round(I / Rv, 2)} V`, `${round(Rv / I, 2)} V`, `${round(I + Rv, 2)} V`, `${round(I * Rv * 2, 2)} V`]);
    return {
      prompt: `A current of ${I} A flows through a ${Rv} Ω resistor. What is the potential difference across it?`,
      options,
      correct,
      explain: `Ohm's law: V = I × R = ${I} × ${Rv} = ${right}.`,
      visual: () => <CircuitScene cells={2} closed current={I} glow={0.5} resistor={`R = ${Rv} Ω`} />,
    };
  }
  const right = `${round(V / Rv, 2)} A`;
  const { options, correct } = withOptions(right, [`${round(V * Rv, 2)} A`, `${round(Rv / V, 2)} A`, `${round(V + Rv, 2)} A`, `${round(V / Rv / 2, 2)} A`]);
  return {
    prompt: `${cells} cell${cells > 1 ? 's' : ''} give ${V} V across a ${Rv} Ω resistor. What current flows?`,
    options,
    correct,
    explain: `Ohm's law: I = V / R = ${V} / ${Rv} = ${right}.`,
    visual: (revealed) => <CircuitScene cells={cells} closed current={revealed ? V / Rv : 0.2} glow={revealed ? clamp(V / Rv / 3, 0.1, 1) : 0.1} resistor={`R = ${Rv} Ω`} />,
  };
}

/* ============================== MAGNETS =============================== */

/** Field direction (unit vector) at a point from a bar magnet, modelled as two poles. */
function barField(x: number, y: number, n: Pt, s: Pt): Pt {
  const f = (p: Pt, sign: number): Pt => {
    const dx = x - p[0];
    const dy = y - p[1];
    // Softened inverse-square so lines starting right at a pole stay smooth.
    const r3 = (dx * dx + dy * dy + 30) ** 1.5;
    return [(sign * dx) / r3, (sign * dy) / r3];
  };
  const a = f(n, 1);
  const b = f(s, -1);
  return [a[0] + b[0], a[1] + b[1]];
}

/** One field line traced from near the N pole until it reaches the S pole. */
function fieldLine(n: Pt, s: Pt, startAngle: number): Pt[] {
  let p: Pt = [n[0] + Math.cos(startAngle) * 8, n[1] + Math.sin(startAngle) * 8];
  const pts: Pt[] = [p];
  for (let i = 0; i < 500; i++) {
    const [fx, fy] = barField(p[0], p[1], n, s);
    const m = Math.hypot(fx, fy) || 1;
    p = [p[0] + (fx / m) * 4, p[1] + (fy / m) * 4];
    pts.push(p);
    if (Math.hypot(p[0] - s[0], p[1] - s[1]) < 8 || p[0] < -60 || p[0] > W + 60 || p[1] < -60 || p[1] > H + 60) break;
  }
  return pts;
}

const Needle: React.FC<{ x: number; y: number; angle: number; size?: number }> = ({ x, y, angle, size = 11 }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={size + 2} fill="white" stroke="#d6d3d1" />
    <motion.g initial={false} animate={{ rotate: angle }} transition={{ type: 'spring', stiffness: 90, damping: 9 }}>
      <polygon points={`${size},0 0,-3.5 0,3.5`} fill="#dc2626" />
      <polygon points={`${-size},0 0,-3.5 0,3.5`} fill="#1d4ed8" />
    </motion.g>
  </g>
);

const MagnetScene: React.FC<{ angle: number; flipped: boolean; showLines: boolean; compassGrid?: boolean }> = ({ angle, flipped, showLines, compassGrid = true }) => {
  const cx = 200;
  const cy = 120;
  const half = 45;
  const a = rad(angle);
  const dir = flipped ? -1 : 1;
  const n: Pt = [cx + Math.cos(a) * half * dir, cy + Math.sin(a) * half * dir];
  const s: Pt = [cx - Math.cos(a) * half * dir, cy - Math.sin(a) * half * dir];
  const lines = useMemo(() => {
    if (!showLines) return [];
    const base = Math.atan2(n[1] - cy, n[0] - cx);
    return [-70, -45, -25, -10, 10, 25, 45, 70].map((d) => fieldLine(n, s, base + rad(d) * 1.6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angle, flipped, showLines]);
  const compasses: Pt[] = compassGrid
    ? [
        [40, 40], [120, 30], [200, 30], [280, 30], [360, 40],
        [30, 120], [370, 120],
        [40, 200], [120, 210], [200, 210], [280, 210], [360, 200],
      ]
    : [];
  return (
    <svg {...svgProps}>
      {lines.map((pts, i) => (
        <motion.polyline
          key={`${angle}-${flipped}-${i}`}
          points={pts.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="#a78bfa"
          strokeWidth={1.6}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, delay: i * 0.05 }}
        />
      ))}
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        <rect x={cx - half - 10} y={cy - 14} width={half + 10} height={28} fill={flipped ? '#dc2626' : '#1d4ed8'} rx={3} />
        <rect x={cx} y={cy - 14} width={half + 10} height={28} fill={flipped ? '#1d4ed8' : '#dc2626'} rx={3} />
        <text x={cx + half - 8} y={cy + 6} fontSize={16} fontWeight={900} fill="white" textAnchor="middle" transform={`rotate(${-angle} ${cx + half - 8} ${cy})`}>
          {flipped ? 'S' : 'N'}
        </text>
        <text x={cx - half + 8} y={cy + 6} fontSize={16} fontWeight={900} fill="white" textAnchor="middle" transform={`rotate(${-angle} ${cx - half + 8} ${cy})`}>
          {flipped ? 'N' : 'S'}
        </text>
      </g>
      {compasses.map(([x, y], i) => {
        const [fx, fy] = barField(x, y, n, s);
        return <Needle key={i} x={x} y={y} angle={deg(Math.atan2(fy, fx))} />;
      })}
    </svg>
  );
};

/** Field of a straight wire carrying current into (⊗) or out of (⊙) the page: circles, right-hand thumb rule. */
const WireScene: React.FC<{ out: boolean; current: number }> = ({ out, current }) => {
  const t = useClock(current > 0);
  const cx = 200;
  const cy = 120;
  const radii = [30, 55, 80, 105];
  // Out of the page → anticlockwise as seen; SVG y points down, so anticlockwise on screen = negative angle.
  const sense = out ? -1 : 1;
  return (
    <svg {...svgProps}>
      {current > 0 &&
        radii.map((r, i) => (
          <g key={r}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#a78bfa" strokeWidth={1.6} strokeDasharray="6 6" strokeDashoffset={-sense * t * 30 * current} opacity={1 - i * 0.18} />
          </g>
        ))}
      <circle cx={cx} cy={cy} r={14} fill="#f59e0b" stroke="#92400e" strokeWidth={3} />
      {out ? <circle cx={cx} cy={cy} r={4} fill="#451a03" /> : (
        <g stroke="#451a03" strokeWidth={3}>
          <line x1={cx - 7} y1={cy - 7} x2={cx + 7} y2={cy + 7} />
          <line x1={cx + 7} y1={cy - 7} x2={cx - 7} y2={cy + 7} />
        </g>
      )}
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const x = cx + Math.cos(rad(a)) * 68;
        const y = cy + Math.sin(rad(a)) * 68;
        // tangent direction: anticlockwise on screen = angle - 90°
        const needle = current > 0 ? a + sense * 90 : -90;
        return <Needle key={a} x={x} y={y} angle={needle} size={10} />;
      })}
      <text x={20} y={24} fontSize={12} fontWeight={800} fill="#57534e">
        {out ? '⊙ current coming out of the page' : '⊗ current going into the page'}
      </text>
    </svg>
  );
};

export const MagnetExplore: React.FC<SimProps> = ({ grade }) => {
  const g = gradeN(grade);
  const [mode, setMode] = useState<'bar' | 'wire'>(g >= 10 ? 'wire' : 'bar');
  const [angle, setAngle] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [lines, setLines] = useState(true);
  const [out, setOut] = useState(true);
  const [current, setCurrent] = useState(2);
  return (
    <SimFrame
      caption={
        mode === 'bar' ? (
          <span>Compass needles point along the field: out of the magnet's <b className="text-red-600">N</b> pole, into its <b className="text-blue-700">S</b> pole. Like poles repel, unlike poles attract.</span>
        ) : (
          <span>Right-hand thumb rule: thumb along the current, fingers curl the way the field goes. {out ? 'Out of the page → anticlockwise.' : 'Into the page → clockwise.'}</span>
        )
      }
      controls={
        <>
          {g >= 8 && <Toggle options={[{ id: 'bar', label: '🧲 Bar magnet' }, { id: 'wire', label: '⚡ Current in a wire' }]} value={mode} onChange={(v) => setMode(v as 'bar' | 'wire')} />}
          {mode === 'bar' ? (
            <>
              <Slider label="Turn the magnet" value={angle} min={-180} max={180} step={5} unit="°" onChange={setAngle} />
              <Toggle options={[{ id: 'show', label: 'Field lines' }, { id: 'hide', label: 'Compasses only' }]} value={lines ? 'show' : 'hide'} onChange={(v) => setLines(v === 'show')} />
              <ChunkyButton color="white" className="!px-3 !py-2 text-sm" onClick={() => setFlipped((f) => !f)}>
                ⇄ Flip poles
              </ChunkyButton>
            </>
          ) : (
            <>
              <Toggle options={[{ id: 'out', label: '⊙ Out of page' }, { id: 'in', label: '⊗ Into page' }]} value={out ? 'out' : 'in'} onChange={(v) => setOut(v === 'out')} />
              <Slider label="Current" value={current} min={0} max={5} unit=" A" onChange={setCurrent} />
            </>
          )}
        </>
      }
    >
      {mode === 'bar' ? <MagnetScene angle={angle} flipped={flipped} showLines={lines} /> : <WireScene out={out} current={current} />}
    </SimFrame>
  );
};

/** Two magnets facing each other that slide together (attract) or apart (repel) once revealed. */
const PairScene: React.FC<{ left: 'N' | 'S'; right: 'N' | 'S'; revealed: boolean }> = ({ left, right, revealed }) => {
  const attract = left !== right;
  const gap = revealed ? (attract ? 4 : 90) : 40;
  const color = (p: 'N' | 'S') => (p === 'N' ? '#dc2626' : '#1d4ed8');
  const other = (p: 'N' | 'S') => (p === 'N' ? 'S' : 'N');
  return (
    <svg {...svgProps}>
      <motion.g initial={false} animate={{ x: -gap / 2 }} transition={{ type: 'spring', stiffness: 120, damping: 12 }}>
        <rect x={60} y={100} width={70} height={40} fill={color(other(left))} rx={3} />
        <rect x={130} y={100} width={70} height={40} fill={color(left)} rx={3} />
        <text x={95} y={127} fontSize={18} fontWeight={900} fill="white" textAnchor="middle">{other(left)}</text>
        <text x={165} y={127} fontSize={18} fontWeight={900} fill="white" textAnchor="middle">{left}</text>
      </motion.g>
      <motion.g initial={false} animate={{ x: gap / 2 }} transition={{ type: 'spring', stiffness: 120, damping: 12 }}>
        <rect x={200} y={100} width={70} height={40} fill={color(right)} rx={3} />
        <rect x={270} y={100} width={70} height={40} fill={color(other(right))} rx={3} />
        <text x={235} y={127} fontSize={18} fontWeight={900} fill="white" textAnchor="middle">{right}</text>
        <text x={305} y={127} fontSize={18} fontWeight={900} fill="white" textAnchor="middle">{other(right)}</text>
      </motion.g>
      {revealed && (
        <text x={200} y={190} fontSize={16} fontWeight={900} textAnchor="middle" fill={attract ? '#059669' : '#dc2626'}>
          {attract ? 'ATTRACT ⟶⟵' : '⟵ REPEL ⟶'}
        </text>
      )}
    </svg>
  );
};

const MAGNETIC = [
  { label: 'iron nail', yes: true },
  { label: 'steel pin', yes: true },
  { label: 'nickel coin', yes: true },
  { label: 'plastic comb', yes: false },
  { label: 'wooden pencil', yes: false },
  { label: 'copper wire', yes: false },
  { label: 'aluminium can', yes: false },
  { label: 'rubber band', yes: false },
];

export function magnetRound(grade: string): ChallengeRound {
  const g = gradeN(grade);
  const kind = g >= 10 ? pick(['wire', 'wire', 'pair', 'compass']) : pick(['pair', 'pair', 'object', 'compass']);
  if (kind === 'wire') {
    const out = Math.random() < 0.5;
    const right = out ? 'Anticlockwise' : 'Clockwise';
    return {
      prompt: `Current flows ${out ? 'out of' : 'into'} the page. Which way do the magnetic field lines go (as you look at the page)?`,
      options: ['Clockwise', 'Anticlockwise', 'Straight up', 'There is no field'],
      correct: out ? 1 : 0,
      explain: `Right-hand thumb rule: point your thumb ${out ? 'towards you' : 'into the page'} — your fingers curl ${right.toLowerCase()}.`,
      visual: (revealed) => <WireScene out={out} current={revealed ? 2 : 0} />,
    };
  }
  if (kind === 'object') {
    const it = pick(MAGNETIC);
    return {
      prompt: `Will a magnet pull a ${it.label}?`,
      options: ['Yes — it is magnetic', 'No — it is non-magnetic'],
      correct: it.yes ? 0 : 1,
      explain: it.yes ? `A ${it.label} contains iron, nickel or cobalt, so it is magnetic.` : `A ${it.label} has no iron, nickel or cobalt — magnets do not attract it.`,
      visual: (revealed) => (
        <svg {...svgProps}>
          <g transform="translate(120 100)">
            <path d="M0 0 h40 v60 a40 40 0 0 0 80 0 v-60 h40 v60 a80 80 0 0 1 -160 0 Z" fill="#dc2626" />
            <rect x={0} y={0} width={40} height={18} fill="#e5e7eb" />
            <rect x={120} y={0} width={40} height={18} fill="#e5e7eb" />
          </g>
          <motion.text x={200} y={60} fontSize={14} fontWeight={900} textAnchor="middle" fill="#44403c" initial={false} animate={{ y: revealed && it.yes ? 95 : 50 }} transition={{ type: 'spring' }}>
            {it.label}
          </motion.text>
        </svg>
      ),
    };
  }
  if (kind === 'compass') {
    const angle = pick([0, 90, 180, -90]);
    return {
      prompt: 'Outside a bar magnet, the N end of a compass needle points…',
      options: ['Away from the magnet’s N pole, towards its S pole', 'Towards the magnet’s N pole', 'Always to the top of the page', 'It spins and never stops'],
      correct: 0,
      explain: 'Field lines leave the N pole and enter the S pole; a compass needle lines up along them.',
      visual: (revealed) => <MagnetScene angle={angle} flipped={false} showLines={revealed} />,
    };
  }
  const left = pick<'N' | 'S'>(['N', 'S']);
  const right = pick<'N' | 'S'>(['N', 'S']);
  return {
    prompt: `The ${left} pole of one magnet faces the ${right} pole of another. What happens?`,
    options: ['They attract', 'They repel', 'Nothing happens'],
    correct: left !== right ? 0 : 1,
    explain: left !== right ? 'Unlike poles attract each other.' : 'Like poles repel each other.',
    visual: (revealed) => <PairScene left={left} right={right} revealed={revealed} />,
  };
}

/* =============================== MOTION =============================== */

/** Road with a car, plus distance-time and velocity-time graphs drawn as time passes. */
const MotionScene: React.FC<{ u: number; a: number; playKey: number; tMax?: number; showGraphs?: boolean }> = ({ u, a, playKey, tMax = 10, showGraphs = true }) => {
  const clock = useClock(true);
  const start = useRef<{ key: number; at: number } | null>(null);
  if (!start.current || start.current.key !== playKey) start.current = { key: playKey, at: clock };
  // Stop when the car would start going backwards.
  const tStop = a < 0 ? Math.min(tMax, u / -a) : tMax;
  const t = clamp((clock - start.current.at) * 1.6, 0, tStop);
  const v = u + a * t;
  const s = u * t + 0.5 * a * t * t;
  const sEnd = u * tStop + 0.5 * a * tStop * tStop;
  const sMax = Math.max(50, sEnd);
  const vMax = Math.max(10, u, u + a * tStop);
  const roadX = (d: number) => 20 + (d / sMax) * 340;
  const gx = (tt: number, x0: number) => x0 + (tt / tMax) * 150;
  const gyS = (d: number) => 225 - (d / sMax) * 90;
  const gyV = (vv: number) => 225 - (vv / vMax) * 90;
  const samples = 40;
  const pts = (f: (tt: number) => number, x0: number, toY: (v: number) => number) =>
    Array.from({ length: samples + 1 }, (_, i) => (i / samples) * t)
      .map((tt) => `${gx(tt, x0)},${toY(f(tt))}`)
      .join(' ');
  return (
    <svg {...svgProps}>
      <rect x={0} y={42} width={W} height={34} fill="#57534e" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={i * 36 + 4} y={57} width={18} height={3} fill="#fafaf9" />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={roadX(f * sMax)} y={90} fontSize={9} fontWeight={700} textAnchor="middle" fill="#78716c">
          {Math.round(f * sMax)} m
        </text>
      ))}
      <g transform={`translate(${roadX(s)} 46)`}>
        <rect x={-18} y={4} width={36} height={14} rx={4} fill="#f59e0b" />
        <rect x={-10} y={-4} width={20} height={10} rx={3} fill="#fbbf24" />
        <circle cx={-10} cy={19} r={5} fill="#1c1917" />
        <circle cx={10} cy={19} r={5} fill="#1c1917" />
      </g>
      <text x={8} y={20} fontSize={12} fontWeight={900} fill="#44403c">
        t = {t.toFixed(1)} s · speed = {v.toFixed(1)} m/s · distance = {s.toFixed(1)} m
      </text>
      {showGraphs && (
        <>
          <text x={30} y={128} fontSize={10} fontWeight={900} fill="#b45309">distance–time</text>
          <line x1={30} y1={135} x2={30} y2={225} stroke="#44403c" strokeWidth={1.5} />
          <line x1={30} y1={225} x2={185} y2={225} stroke="#44403c" strokeWidth={1.5} />
          <polyline points={pts((tt) => u * tt + 0.5 * a * tt * tt, 30, gyS)} fill="none" stroke="#f59e0b" strokeWidth={3} />
          <text x={225} y={128} fontSize={10} fontWeight={900} fill="#0369a1">velocity–time</text>
          <line x1={225} y1={135} x2={225} y2={225} stroke="#44403c" strokeWidth={1.5} />
          <line x1={225} y1={225} x2={380} y2={225} stroke="#44403c" strokeWidth={1.5} />
          <polyline points={pts((tt) => u + a * tt, 225, gyV)} fill="none" stroke="#0ea5e9" strokeWidth={3} />
          <text x={185} y={236} fontSize={9} textAnchor="end" fill="#78716c">t (s)</text>
          <text x={380} y={236} fontSize={9} textAnchor="end" fill="#78716c">t (s)</text>
        </>
      )}
    </svg>
  );
};

export const MotionExplore: React.FC<SimProps> = ({ grade }) => {
  const g = gradeN(grade);
  const [u, setU] = useState(g <= 7 ? 10 : 4);
  const [a, setA] = useState(g <= 7 ? 0 : 1);
  const [play, setPlay] = useState(0);
  const tEnd = a < 0 ? Math.min(10, u / -a) : 10;
  return (
    <SimFrame
      caption={
        g <= 7 ? (
          <span>Speed = distance ÷ time. At {u} m/s the car covers {u} m every second: {u * 10} m in 10 s.</span>
        ) : (
          <span>
            v = u + at = {u} + ({a})×{round(tEnd, 1)} = <span className="text-sky-700">{round(u + a * tEnd, 1)} m/s</span> · s = ut + ½at² ={' '}
            <span className="text-amber-700">{round(u * tEnd + 0.5 * a * tEnd * tEnd, 1)} m</span>
          </span>
        )
      }
      controls={
        <>
          <Slider label="Starting speed u" value={u} min={0} max={20} unit=" m/s" onChange={(v) => { setU(v); setPlay((p) => p + 1); }} />
          {g >= 8 && <Slider label="Acceleration a" value={a} min={-2} max={3} step={0.5} unit=" m/s²" onChange={(v) => { setA(v); setPlay((p) => p + 1); }} />}
          <ChunkyButton color="sky" className="!px-3 !py-2 text-sm" onClick={() => setPlay((p) => p + 1)}>
            ▶ Drive
          </ChunkyButton>
        </>
      }
    >
      <MotionScene u={u} a={g <= 7 ? 0 : a} playKey={play} showGraphs={g >= 8} />
    </SimFrame>
  );
};

const GRAPH_SHAPES = [
  { id: 'dt-line', axis: 'distance', label: 'Moving at a steady (uniform) speed', f: (x: number) => x },
  { id: 'dt-flat', axis: 'distance', label: 'At rest (not moving)', f: () => 0.5 },
  { id: 'dt-up', axis: 'distance', label: 'Speeding up (accelerating)', f: (x: number) => x * x },
  { id: 'dt-down', axis: 'distance', label: 'Slowing down', f: (x: number) => 1 - (1 - x) * (1 - x) },
  { id: 'vt-flat', axis: 'velocity', label: 'Moving at a steady (uniform) speed', f: () => 0.6 },
  { id: 'vt-up', axis: 'velocity', label: 'Speeding up (accelerating)', f: (x: number) => 0.1 + x * 0.85 },
  { id: 'vt-down', axis: 'velocity', label: 'Slowing down', f: (x: number) => 0.95 - x * 0.85 },
];

const GraphShape: React.FC<{ shape: (typeof GRAPH_SHAPES)[number] }> = ({ shape }) => {
  const pts = Array.from({ length: 41 }, (_, i) => i / 40).map((x) => `${70 + x * 270},${200 - shape.f(x) * 160}`);
  return (
    <svg {...svgProps}>
      <line x1={70} y1={30} x2={70} y2={200} stroke="#44403c" strokeWidth={2} />
      <line x1={70} y1={200} x2={350} y2={200} stroke="#44403c" strokeWidth={2} />
      <text x={60} y={30} fontSize={12} fontWeight={900} textAnchor="end" fill="#44403c">{shape.axis}</text>
      <text x={350} y={220} fontSize={12} fontWeight={900} textAnchor="end" fill="#44403c">time</text>
      <motion.polyline points={pts.join(' ')} fill="none" stroke={shape.axis === 'distance' ? '#f59e0b' : '#0ea5e9'} strokeWidth={4} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
    </svg>
  );
};

export function motionRound(grade: string): ChallengeRound {
  const g = gradeN(grade);
  const kind = g <= 7 ? 'speed' : g === 8 ? pick(['graph', 'graph', 'speed']) : pick(['graph', 'v', 's', 'a']);
  if (kind === 'graph') {
    const shape = pick(GRAPH_SHAPES);
    const labels = [...new Set(GRAPH_SHAPES.filter((s) => s.axis === shape.axis).map((s) => s.label))];
    return {
      prompt: `What does this ${shape.axis}–time graph show?`,
      options: labels,
      correct: labels.indexOf(shape.label),
      explain:
        shape.axis === 'distance'
          ? 'On a distance–time graph the slope is the speed: straight = steady, flat = resting, getting steeper = speeding up, flattening = slowing down.'
          : 'On a velocity–time graph the slope is the acceleration: flat = steady speed, rising = speeding up, falling = slowing down.',
      visual: () => <GraphShape shape={shape} />,
    };
  }
  if (kind === 'speed') {
    const speed = pick([20, 30, 40, 45, 50, 60]);
    const hours = pick([2, 3, 4]);
    const dist = speed * hours;
    const right = `${speed} km/h`;
    const { options, correct } = withOptions(right, [`${dist * hours} km/h`, `${hours * 10} km/h`, `${speed + 10} km/h`, `${dist} km/h`]);
    return {
      prompt: `A bus travels ${dist} km in ${hours} hours. What is its average speed?`,
      options,
      correct,
      explain: `Speed = distance ÷ time = ${dist} ÷ ${hours} = ${right}.`,
      visual: (revealed) => <MotionScene u={revealed ? speed / 5 : 0} a={0} playKey={revealed ? 1 : 0} showGraphs={false} />,
    };
  }
  const u = pick([0, 2, 4, 5, 10]);
  const a = pick([1, 2, 3]);
  const t = pick([2, 3, 4, 5]);
  if (kind === 'v') {
    const right = `${u + a * t} m/s`;
    const { options, correct } = withOptions(right, [`${u + a} m/s`, `${a * t} m/s`, `${u * t + a} m/s`, `${u + a * t * t} m/s`]);
    return {
      prompt: `A cycle starts at ${u} m/s and speeds up at ${a} m/s² for ${t} s. What is its final speed?`,
      options,
      correct,
      explain: `v = u + at = ${u} + ${a}×${t} = ${right}.`,
      visual: (revealed) => <MotionScene u={u} a={a} tMax={t} playKey={revealed ? 1 : 0} />,
    };
  }
  if (kind === 'a') {
    const v = u + a * t;
    const right = `${a} m/s²`;
    const { options, correct } = withOptions(right, [`${v} m/s²`, `${round(v / t, 2)} m/s²`, `${a + 1} m/s²`, `${v - u} m/s²`].filter((o) => o !== right));
    return {
      prompt: `A car goes from ${u} m/s to ${v} m/s in ${t} s. What is its acceleration?`,
      options,
      correct,
      explain: `a = (v − u) / t = (${v} − ${u}) / ${t} = ${right}.`,
      visual: (revealed) => <MotionScene u={u} a={a} tMax={t} playKey={revealed ? 1 : 0} />,
    };
  }
  const s = u * t + 0.5 * a * t * t;
  const right = `${s} m`;
  const { options, correct } = withOptions(right, [`${u * t + a * t * t} m`, `${u * t} m`, `${(u + a * t) * t} m`, `${0.5 * a * t * t} m`].filter((o) => o !== right));
  return {
    prompt: `Starting at ${u} m/s with acceleration ${a} m/s², how far does it go in ${t} s?`,
    options,
    correct,
    explain: `s = ut + ½at² = ${u}×${t} + ½×${a}×${t}² = ${right}.`,
    visual: (revealed) => <MotionScene u={u} a={a} tMax={t} playKey={revealed ? 1 : 0} />,
  };
}

/* ============================= REFRACTION ============================= */

const MEDIA = [
  { id: 'water', label: 'Water', n: 1.33, color: '#bae6fd' },
  { id: 'glass', label: 'Glass', n: 1.5, color: '#cffafe' },
  { id: 'diamond', label: 'Diamond', n: 2.42, color: '#e0e7ff' },
];

/**
 * A ray hitting a flat boundary at the centre. `fromDense` sends it from the
 * medium into air (top = air, bottom = medium either way).
 */
const RefractionScene: React.FC<{ n: number; color: string; angle: number; fromDense: boolean; label: string; playKey?: string | number; showOut?: boolean }> = ({
  n,
  color,
  angle,
  fromDense,
  label,
  playKey,
  showOut = true,
}) => {
  const cx = 200;
  const cy = 120;
  const L = 115;
  const n1 = fromDense ? n : 1;
  const n2 = fromDense ? 1 : n;
  const sinR = (n1 / n2) * Math.sin(rad(angle));
  const tir = sinR > 1;
  const r = tir ? 0 : deg(Math.asin(sinR));
  const critical = fromDense ? deg(Math.asin(1 / n)) : null;
  // Incoming from the top-left (air) or bottom-left (medium).
  const inSide = fromDense ? 1 : -1; // +1 = comes from below
  const inc: Pt = [cx - Math.sin(rad(angle)) * L, cy + inSide * Math.cos(rad(angle)) * L];
  const refr: Pt = [cx + Math.sin(rad(r)) * L, cy - inSide * Math.cos(rad(r)) * L];
  const refl: Pt = [cx + Math.sin(rad(angle)) * L, cy + inSide * Math.cos(rad(angle)) * L];
  return (
    <svg {...svgProps}>
      <rect x={0} y={0} width={W} height={cy} fill="#f8fafc" />
      <rect x={0} y={cy} width={W} height={H - cy} fill={color} />
      <text x={10} y={20} fontSize={12} fontWeight={900} fill="#475569">Air (n = 1.00)</text>
      <text x={10} y={H - 10} fontSize={12} fontWeight={900} fill="#0f172a">{label} (n = {n})</text>
      <line x1={cx} y1={8} x2={cx} y2={H - 8} stroke="#78716c" strokeDasharray="5 5" />
      <text x={cx + 4} y={16} fontSize={10} fill="#78716c" fontWeight={700}>normal</text>
      <motion.line key={`i-${playKey}`} x1={inc[0]} y1={inc[1]} x2={cx} y2={cy} stroke="#dc2626" strokeWidth={4} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
      {showOut && (
      <motion.line
        key={`r-${playKey}`}
        x1={cx}
        y1={cy}
        x2={tir ? refl[0] : refr[0]}
        y2={tir ? refl[1] : refr[1]}
        stroke={tir ? '#dc2626' : '#f97316'}
        strokeWidth={4}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      />
      )}
      {showOut && !tir && <line x1={cx} y1={cy} x2={refl[0]} y2={refl[1]} stroke="#dc2626" strokeWidth={1.5} opacity={0.35} />}
      <text x={clamp(inc[0], 8, W - 60)} y={clamp(inc[1] + (fromDense ? 14 : -6), 34, H - 22)} fontSize={11} fontWeight={900} fill="#dc2626">i = {angle}°</text>
      {showOut && !tir && (
        <text x={clamp(refr[0] - 20, 8, W - 60)} y={refr[1] + (fromDense ? -6 : 14)} fontSize={11} fontWeight={900} fill="#c2410c">
          r = {round(r, 1)}°
        </text>
      )}
      {showOut && tir && (
        <text x={W - 10} y={fromDense ? 40 : 200} fontSize={13} fontWeight={900} textAnchor="end" fill="#b91c1c">
          Total internal reflection!
        </text>
      )}
      {critical !== null && (
        <text x={W - 10} y={fromDense ? 20 : 220} fontSize={11} fontWeight={800} textAnchor="end" fill="#475569">
          critical angle = {round(critical, 1)}°
        </text>
      )}
    </svg>
  );
};

export const RefractionExplore: React.FC<SimProps> = () => {
  const [medium, setMedium] = useState('glass');
  const [angle, setAngle] = useState(40);
  const [fromDense, setFromDense] = useState(false);
  const m = MEDIA.find((x) => x.id === medium)!;
  const n1 = fromDense ? m.n : 1;
  const n2 = fromDense ? 1 : m.n;
  const s = (n1 / n2) * Math.sin(rad(angle));
  return (
    <SimFrame
      caption={
        <span>
          Snell's law: n₁ sin i = n₂ sin r → {n1} × sin {angle}° = {n2} × sin r →{' '}
          {s > 1 ? <span className="text-rose-700">no refracted ray (i is more than the critical angle)</span> : <span className="text-orange-700">r = {round(deg(Math.asin(s)), 1)}°</span>}
          {' · '}
          {fromDense ? 'denser → rarer: bends away from the normal' : 'rarer → denser: bends towards the normal'}
        </span>
      }
      controls={
        <>
          <Toggle options={MEDIA.map((x) => ({ id: x.id, label: `${x.label} ${x.n}` }))} value={medium} onChange={setMedium} />
          <Slider label="Angle of incidence i" value={angle} min={0} max={85} unit="°" onChange={setAngle} />
          <Toggle options={[{ id: 'air', label: 'Air → medium' }, { id: 'dense', label: 'Medium → air' }]} value={fromDense ? 'dense' : 'air'} onChange={(v) => setFromDense(v === 'dense')} />
        </>
      }
    >
      <RefractionScene n={m.n} color={m.color} angle={angle} fromDense={fromDense} label={m.label} />
    </SimFrame>
  );
};

export function refractionRound(): ChallengeRound {
  const kind = pick(['bend', 'snell', 'critical', 'speed', 'tir']);
  const m = pick(MEDIA);
  if (kind === 'bend') {
    const fromDense = Math.random() < 0.5;
    return {
      prompt: `Light goes from ${fromDense ? m.label.toLowerCase() + ' into air' : 'air into ' + m.label.toLowerCase()}. Which way does it bend?`,
      options: ['Towards the normal', 'Away from the normal', 'It does not bend at all'],
      correct: fromDense ? 1 : 0,
      explain: fromDense ? 'Going into a rarer medium light speeds up and bends away from the normal.' : 'Going into a denser medium light slows down and bends towards the normal.',
      visual: (revealed) => <RefractionScene n={m.n} color={m.color} angle={40} fromDense={fromDense} label={m.label} playKey={revealed ? 1 : 0} showOut={revealed} />,
    };
  }
  if (kind === 'snell') {
    // sin i = 0.5 (30°) into glass: sin r = 1/3 → 19.5°
    const i = pick([30, 45, 60]);
    const n = pick([1.5, 1.33]);
    const r = deg(Math.asin(Math.sin(rad(i)) / n));
    const right = `${round(r, 0)}°`;
    const { options, correct } = withOptions(right, [`${i}°`, `${round(i * n, 0)}°`, `${round(r + 12, 0)}°`, `${round(90 - r, 0)}°`]);
    return {
      prompt: `A ray enters a medium of refractive index ${n} from air at i = ${i}°. About what is the angle of refraction?`,
      options,
      correct,
      explain: `sin r = sin ${i}° ÷ ${n} = ${round(Math.sin(rad(i)) / n, 3)}, so r ≈ ${right}.`,
      visual: (revealed) => <RefractionScene n={n} color="#cffafe" angle={i} fromDense={false} label="Medium" playKey={revealed ? 1 : 0} />,
    };
  }
  if (kind === 'critical') {
    const c = deg(Math.asin(1 / m.n));
    const right = `${round(c, 1)}°`;
    const { options, correct } = withOptions(right, [`${round(90 - c, 1)}°`, `${round(c + 15, 1)}°`, `${round(c / 2, 1)}°`, '90°']);
    return {
      prompt: `What is the critical angle for ${m.label.toLowerCase()} (n = ${m.n}) to air?`,
      options,
      correct,
      explain: `sin C = 1/n = 1/${m.n} = ${round(1 / m.n, 3)}, so C ≈ ${right}.`,
      visual: (revealed) => <RefractionScene n={m.n} color={m.color} angle={revealed ? Math.round(c) : 20} fromDense label={m.label} playKey={revealed ? 1 : 0} />,
    };
  }
  if (kind === 'tir') {
    const c = deg(Math.asin(1 / m.n));
    const i = Math.round(c + pick([-15, 10, 20]));
    const tir = i > c;
    return {
      prompt: `Light inside ${m.label.toLowerCase()} hits the surface at ${i}° (critical angle ${round(c, 1)}°). What happens?`,
      options: ['It goes out into the air, bending away', 'It is totally reflected back inside'],
      correct: tir ? 1 : 0,
      explain: tir ? 'The angle is more than the critical angle, so all the light reflects back: total internal reflection.' : 'The angle is less than the critical angle, so the light refracts out into the air.',
      visual: (revealed) => <RefractionScene n={m.n} color={m.color} angle={revealed ? i : 5} fromDense label={m.label} playKey={revealed ? 1 : 0} />,
    };
  }
  const v = round(3 / m.n, 2);
  const right = String(m.n);
  const { options, correct } = withOptions(right, [String(round(1 / m.n, 2)), String(round(m.n + 0.5, 2)), String(round(m.n * 3, 2)), '1']);
  return {
    prompt: `Light travels at 3 × 10⁸ m/s in vacuum and ${v} × 10⁸ m/s in ${m.label.toLowerCase()}. What is its refractive index?`,
    options,
    correct,
    explain: `n = speed in vacuum ÷ speed in the medium = 3 ÷ ${v} ≈ ${m.n}.`,
    visual: (revealed) => <RefractionScene n={m.n} color={m.color} angle={45} fromDense={false} label={m.label} playKey={revealed ? 1 : 0} />,
  };
}

/* ================================ LENS ================================ */

const LX0 = 200; // lens position (px)
const LY0 = 130; // principal axis (px)
const PX_PER_CM = 3.2;
const lx = (cm: number) => LX0 + cm * PX_PER_CM;
const ly = (cm: number) => LY0 - cm * PX_PER_CM;

/** Image from the lens formula 1/v − 1/u = 1/f (u negative, f > 0 convex, f < 0 concave). */
export function lensImage(u: number, f: number): { v: number; m: number } | null {
  const inv = 1 / f + 1 / u;
  if (Math.abs(inv) < 1e-9) return null; // at infinity
  const v = 1 / inv;
  return { v, m: v / u };
}

const Arrow: React.FC<{ x: number; h: number; color: string; dashed?: boolean }> = ({ x, h, color, dashed }) => (
  <g>
    <line x1={lx(x)} y1={ly(0)} x2={lx(x)} y2={ly(h)} stroke={color} strokeWidth={4} strokeDasharray={dashed ? '5 4' : undefined} />
    <polygon points={`${lx(x)},${ly(h) - (h > 0 ? 8 : -8)} ${lx(x) - 6},${ly(h) + (h > 0 ? 4 : -4)} ${lx(x) + 6},${ly(h) + (h > 0 ? 4 : -4)}`} fill={color} />
  </g>
);

const LensScene: React.FC<{ u: number; f: number; h?: number; showImage?: boolean; playKey?: string | number }> = ({ u, f, h = 10, showImage = true, playKey }) => {
  const img = lensImage(u, f);
  const convex = f > 0;
  const far = 75; // cm, beyond the drawing
  const top: Pt = [u, h];
  const rays: { pts: Pt[]; back?: Pt[] }[] = [];
  if (img) {
    const im: Pt = [img.v, img.m * h];
    // Ray 1: parallel to the axis, then through (or as if from) the focus.
    // Ray 2: through the optical centre, undeviated.
    for (const hit of [[0, h] as Pt, [0, 0] as Pt]) {
      if (img.v > 0) {
        const dir: Pt = [im[0] - hit[0], im[1] - hit[1]];
        const k = (far - hit[0]) / dir[0];
        rays.push({ pts: [top, hit, [hit[0] + dir[0] * k, hit[1] + dir[1] * k]] });
      } else {
        const dir: Pt = [hit[0] - im[0], hit[1] - im[1]];
        const k = (far - hit[0]) / dir[0];
        rays.push({ pts: [top, hit, [hit[0] + dir[0] * k, hit[1] + dir[1] * k]], back: [hit, im] });
      }
    }
  }
  const toPts = (ps: Pt[]) => ps.map(([x, y]) => `${lx(x)},${ly(clamp(y, -40, 40))}`).join(' ');
  return (
    <svg {...svgProps}>
      <line x1={0} y1={LY0} x2={W} y2={LY0} stroke="#78716c" strokeWidth={1.5} />
      {[f, -f, 2 * f, -2 * f].map((x, i) => (
        <g key={i}>
          <circle cx={lx(x)} cy={LY0} r={3} fill="#1c1917" />
          <text x={lx(x)} y={LY0 + 15} fontSize={10} fontWeight={800} textAnchor="middle" fill="#57534e">
            {i < 2 ? 'F' : '2F'}
          </text>
        </g>
      ))}
      {convex ? (
        <ellipse cx={LX0} cy={LY0} rx={9} ry={95} fill="#bae6fd" stroke="#0284c7" strokeWidth={2} opacity={0.85} />
      ) : (
        <path d={`M ${LX0 - 12} ${LY0 - 95} Q ${LX0 - 2} ${LY0} ${LX0 - 12} ${LY0 + 95} L ${LX0 + 12} ${LY0 + 95} Q ${LX0 + 2} ${LY0} ${LX0 + 12} ${LY0 - 95} Z`} fill="#bae6fd" stroke="#0284c7" strokeWidth={2} opacity={0.85} />
      )}
      <Arrow x={u} h={h} color="#16a34a" />
      {rays.map((r, i) => (
        <g key={`${playKey}-${i}`}>
          <motion.polyline points={toPts(r.pts)} fill="none" stroke={i ? '#f59e0b' : '#dc2626'} strokeWidth={2.2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: i * 0.3 }} />
          {r.back && showImage && <polyline points={toPts(r.back)} fill="none" stroke={i ? '#f59e0b' : '#dc2626'} strokeWidth={1.5} strokeDasharray="5 4" />}
        </g>
      ))}
      {img && showImage && Math.abs(img.v) < 60 && Math.abs(img.m * h) < 40 && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          <Arrow x={img.v} h={img.m * h} color="#7c3aed" dashed={img.v < 0} />
        </motion.g>
      )}
      {!img && showImage && (
        <text x={W - 8} y={24} fontSize={12} fontWeight={900} textAnchor="end" fill="#7c3aed">
          Object at F: rays come out parallel — image at infinity
        </text>
      )}
    </svg>
  );
};

/** Plain-words description of an image. */
export function describeImage(v: number, m: number): string {
  const kind = v > 0 ? 'Real, inverted' : 'Virtual, erect';
  const size = Math.abs(m) > 1.02 ? 'magnified' : Math.abs(m) < 0.98 ? 'diminished' : 'same size';
  return `${kind}, ${size}`;
}

export const LensExplore: React.FC<SimProps> = () => {
  const [type, setType] = useState<'convex' | 'concave'>('convex');
  const [fAbs, setF] = useState(15);
  const [uAbs, setU] = useState(40);
  const f = type === 'convex' ? fAbs : -fAbs;
  const u = -uAbs;
  const img = lensImage(u, f);
  return (
    <SimFrame
      caption={
        img ? (
          <span>
            1/v − 1/u = 1/f → 1/v = 1/{f} + 1/({u}) → <span className="text-violet-700">v = {round(img.v, 1)} cm</span>, m = v/u = {round(img.m, 2)} ·{' '}
            <b>{describeImage(img.v, img.m)}</b>
          </span>
        ) : (
          <span>Object exactly at the focus: the image forms at infinity.</span>
        )
      }
      controls={
        <>
          <Toggle options={[{ id: 'convex', label: '🔍 Convex' }, { id: 'concave', label: 'Concave' }]} value={type} onChange={(v) => setType(v as 'convex' | 'concave')} />
          <Slider label="Focal length |f|" value={fAbs} min={8} max={20} unit=" cm" onChange={setF} />
          <Slider label="Object distance |u|" value={uAbs} min={4} max={55} unit=" cm" onChange={setU} />
        </>
      }
    >
      <LensScene u={u} f={f} playKey={`${u}|${f}`} />
    </SimFrame>
  );
};

export function lensRound(): ChallengeRound {
  const kind = pick(['nature', 'v', 'nature', 'concave']);
  if (kind === 'concave') {
    const f = -pick([10, 15, 20]);
    const u = -pick([10, 20, 30]);
    const img = lensImage(u, f)!;
    const right = describeImage(img.v, img.m);
    const { options, correct } = withOptions(right, ['Real, inverted, magnified', 'Real, inverted, diminished', 'Virtual, erect, magnified']);
    return {
      prompt: `An object is ${-u} cm from a concave lens (f = ${f} cm). What is the image like?`,
      options,
      correct,
      explain: `A concave lens always gives a virtual, erect, diminished image between the lens and F (here v = ${round(img.v, 1)} cm).`,
      visual: (revealed) => <LensScene u={u} f={f} showImage={revealed} playKey={revealed ? 1 : 0} />,
    };
  }
  const f = pick([10, 12, 15]);
  const choices = [-(3 * f), -(2 * f), -(1.5 * f), -(f / 2)];
  const u = pick(choices);
  const img = lensImage(u, f)!;
  if (kind === 'v') {
    const right = `${round(img.v, 1)} cm`;
    const { options, correct } = withOptions(right, [`${round(-img.v, 1)} cm`, `${round(f - u, 1)} cm`, `${round((f * u) / (f - u), 1)} cm`, `${f} cm`]);
    return {
      prompt: `Convex lens, f = +${f} cm, object at u = ${u} cm. Where is the image (v)?`,
      options,
      correct,
      explain: `1/v = 1/f + 1/u = 1/${f} + 1/(${u}) → v = ${right}${img.v < 0 ? ' (negative: virtual, on the object’s side)' : ''}.`,
      visual: (revealed) => <LensScene u={u} f={f} showImage={revealed} playKey={revealed ? 1 : 0} />,
    };
  }
  const right = describeImage(img.v, img.m);
  const { options, correct } = withOptions(right, ['Real, inverted, diminished', 'Real, inverted, same size', 'Real, inverted, magnified', 'Virtual, erect, magnified'].filter((o) => o !== right));
  return {
    prompt: `An object is ${-u} cm from a convex lens of focal length ${f} cm. What is the image like?`,
    options,
    correct,
    explain:
      -u > 2 * f
        ? 'Beyond 2F: image between F and 2F — real, inverted, diminished.'
        : -u === 2 * f
        ? 'At 2F: image at 2F on the other side — real, inverted, same size.'
        : -u > f
        ? 'Between F and 2F: image beyond 2F — real, inverted, magnified.'
        : 'Inside F: the lens works as a magnifying glass — virtual, erect, magnified.',
    visual: (revealed) => <LensScene u={u} f={f} showImage={revealed} playKey={revealed ? 1 : 0} />,
  };
}

