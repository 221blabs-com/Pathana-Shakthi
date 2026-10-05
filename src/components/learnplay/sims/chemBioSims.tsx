// Chemistry and biology simulations for Classes 6-10 (Telangana syllabus):
// acids, bases and indicators (litmus, turmeric, china rose, phenolphthalein,
// universal indicator / pH), the atom (Rutherford's gold foil, Bohr shells
// for Z = 1-20 with valency, group and period), photosynthesis (Hydrilla
// bubbles under a lamp) and double circulation through the heart.
import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { soundEffects } from '../../../services/soundEffects';
import { ChunkyButton } from '../ui';
import { ChallengeRound, SimFrame, SimProps, Slider, Toggle, clamp, gradeN, pick, randInt, round, useClock, withOptions } from './simKit';

const W = 400;
const H = 240;
const svgProps = { viewBox: `0 0 ${W} ${H}`, className: 'h-full w-full', preserveAspectRatio: 'xMidYMid meet' } as const;
type Pt = [number, number];

/* ======================== ACIDS, BASES, pH ============================ */

export interface Substance {
  name: string;
  emoji: string;
  pH: number;
}

// Typical pH values of everyday things.
export const SUBSTANCES: Substance[] = [
  { name: 'Lemon juice', emoji: '🍋', pH: 2 },
  { name: 'Vinegar', emoji: '🫙', pH: 3 },
  { name: 'Tamarind water', emoji: '🟤', pH: 3 },
  { name: 'Tomato juice', emoji: '🍅', pH: 4 },
  { name: 'Curd', emoji: '🥛', pH: 4.5 },
  { name: 'Milk', emoji: '🍼', pH: 6.5 },
  { name: 'Pure water', emoji: '💧', pH: 7 },
  { name: 'Sugar solution', emoji: '🍬', pH: 7 },
  { name: 'Common salt solution', emoji: '🧂', pH: 7 },
  { name: 'Blood', emoji: '🩸', pH: 7.4 },
  { name: 'Baking soda solution', emoji: '🧁', pH: 8.5 },
  { name: 'Soap solution', emoji: '🧼', pH: 10 },
  { name: 'Lime water', emoji: '🥤', pH: 12 },
];

export const kindOf = (pH: number) => (pH < 6.8 ? 'acidic' : pH > 7.2 ? 'basic' : 'neutral');

const UNIVERSAL = ['#dc2626', '#ef4444', '#f97316', '#fb923c', '#facc15', '#eab308', '#a3e635', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#4f46e5', '#7c3aed', '#6d28d9', '#581c87'];
const universalColor = (pH: number) => UNIVERSAL[clamp(Math.round(pH), 0, 14)];

export type IndicatorId = 'blue-litmus' | 'red-litmus' | 'turmeric' | 'china-rose' | 'phenolphthalein' | 'universal';

export const INDICATORS: { id: IndicatorId; label: string; minGrade: number }[] = [
  { id: 'blue-litmus', label: 'Blue litmus', minGrade: 6 },
  { id: 'red-litmus', label: 'Red litmus', minGrade: 6 },
  { id: 'turmeric', label: 'Turmeric', minGrade: 7 },
  { id: 'china-rose', label: 'China rose', minGrade: 7 },
  { id: 'phenolphthalein', label: 'Phenolphthalein', minGrade: 10 },
  { id: 'universal', label: 'Universal (pH)', minGrade: 10 },
];

/** Colour of a solution after adding an indicator, with the words for it. */
export function indicatorResult(id: IndicatorId, pH: number): { color: string; words: string } {
  const k = kindOf(pH);
  switch (id) {
    case 'blue-litmus':
      return k === 'acidic' ? { color: '#ef4444', words: 'blue litmus turns red' } : { color: '#3b82f6', words: 'blue litmus stays blue' };
    case 'red-litmus':
      return k === 'basic' ? { color: '#3b82f6', words: 'red litmus turns blue' } : { color: '#ef4444', words: 'red litmus stays red' };
    case 'turmeric':
      return k === 'basic' ? { color: '#b91c1c', words: 'turmeric turns red' } : { color: '#facc15', words: 'turmeric stays yellow' };
    case 'china-rose':
      return k === 'acidic' ? { color: '#db2777', words: 'china rose turns dark pink (magenta)' } : k === 'basic' ? { color: '#16a34a', words: 'china rose turns green' } : { color: '#c4b5fd', words: 'china rose stays light' };
    case 'phenolphthalein':
      return pH > 8.2 ? { color: '#ec4899', words: 'phenolphthalein turns pink' } : { color: 'rgba(255,255,255,0.6)', words: 'phenolphthalein stays colourless' };
    case 'universal':
      return { color: universalColor(pH), words: `universal indicator shows pH ${pH}` };
  }
}

const Beaker: React.FC<{ x: number; fill: string; label: string; dropKey?: string | number; dropColor?: string }> = ({ x, fill, label, dropKey, dropColor }) => (
  <g transform={`translate(${x} 0)`}>
    {dropColor && (
      <motion.circle key={`d-${dropKey}`} cx={0} r={6} fill={dropColor} initial={{ cy: 10, opacity: 1 }} animate={{ cy: 112, opacity: 0 }} transition={{ duration: 0.6, ease: 'easeIn' }} />
    )}
    <motion.path
      d="M -45 120 L -45 200 Q -45 214 -31 214 L 31 214 Q 45 214 45 200 L 45 120 Z"
      initial={false}
      animate={{ fill }}
      transition={{ duration: 0.9, delay: dropColor ? 0.5 : 0 }}
      opacity={0.85}
    />
    <path d="M -50 70 L -45 76 L -45 200 Q -45 214 -31 214 L 31 214 Q 45 214 45 200 L 45 76 L 50 70" fill="none" stroke="#64748b" strokeWidth={3} />
    {[140, 160, 180].map((y) => (
      <line key={y} x1={28} x2={45} y1={y} y2={y} stroke="#94a3b8" strokeWidth={1.5} />
    ))}
    <text x={0} y={232} fontSize={11} fontWeight={900} textAnchor="middle" fill="#334155">{label}</text>
  </g>
);

const PhBar: React.FC<{ pH: number; y?: number; marker?: boolean }> = ({ pH, y = 30, marker = true }) => (
  <g>
    {UNIVERSAL.map((c, i) => (
      <rect key={i} x={20 + i * 24} y={y} width={24} height={16} fill={c} />
    ))}
    {[0, 7, 14].map((v) => (
      <text key={v} x={32 + v * 24} y={y + 30} fontSize={10} fontWeight={800} textAnchor="middle" fill="#475569">
        {v}
      </text>
    ))}
    <text x={32 + 2 * 24} y={y - 4} fontSize={9} fontWeight={800} textAnchor="middle" fill="#b91c1c">acid</text>
    <text x={32 + 7 * 24} y={y - 4} fontSize={9} fontWeight={800} textAnchor="middle" fill="#15803d">neutral</text>
    <text x={32 + 12 * 24} y={y - 4} fontSize={9} fontWeight={800} textAnchor="middle" fill="#6d28d9">base</text>
    {marker && <motion.polygon initial={false} animate={{ x: 32 + pH * 24 }} points={`0,${y + 18} -6,${y + 30} 6,${y + 30}`} fill="#0f172a" transition={{ type: 'spring', stiffness: 140, damping: 14 }} />}
  </g>
);

export const AcidsExplore: React.FC<SimProps> = ({ grade }) => {
  const g = gradeN(grade);
  const indicators = INDICATORS.filter((i) => i.minGrade <= Math.max(g, 6));
  const [sub, setSub] = useState(0);
  const [ind, setInd] = useState<IndicatorId>(g >= 10 ? 'universal' : 'blue-litmus');
  const [drops, setDrops] = useState(0);
  const s = SUBSTANCES[sub];
  const res = indicatorResult(ind, s.pH);
  return (
    <SimFrame
      caption={
        <span>
          {s.emoji} {s.name}: {res.words} → <b className={kindOf(s.pH) === 'acidic' ? 'text-red-700' : kindOf(s.pH) === 'basic' ? 'text-violet-700' : 'text-green-700'}>{kindOf(s.pH)}</b>
          {g >= 10 && <> (pH ≈ {s.pH})</>}
        </span>
      }
      controls={
        <>
          <div className="flex flex-wrap gap-1.5">
            {SUBSTANCES.map((x, i) => (
              <button
                key={x.name}
                type="button"
                onClick={() => {
                  setSub(i);
                  setDrops((d) => d + 1);
                  soundEffects.playWordPop();
                }}
                className={`rounded-xl px-2 py-1 text-xs font-black ${i === sub ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}
              >
                {x.emoji} {x.name}
              </button>
            ))}
          </div>
          <Toggle options={indicators.map((i) => ({ id: i.id, label: i.label }))} value={ind} onChange={(v) => { setInd(v as IndicatorId); setDrops((d) => d + 1); }} />
        </>
      }
    >
      <svg {...svgProps}>
        {g >= 10 && <PhBar pH={s.pH} />}
        <Beaker x={110} fill="#e0f2fe" label={`${s.name} (before)`} />
        <Beaker x={290} fill={res.color} label={`+ ${INDICATORS.find((i) => i.id === ind)?.label}`} dropKey={`${sub}-${ind}-${drops}`} dropColor={ind === 'phenolphthalein' ? '#f1f5f9' : ind === 'universal' ? '#22c55e' : ind === 'turmeric' ? '#facc15' : ind === 'china-rose' ? '#f472b6' : ind === 'blue-litmus' ? '#3b82f6' : '#ef4444'} />
        <text x={110} y={100} fontSize={30} textAnchor="middle">{s.emoji}</text>
      </svg>
    </SimFrame>
  );
};

export function acidsRound(grade: string): ChallengeRound {
  const g = gradeN(grade);
  const kind = g >= 10 ? pick(['ph', 'ph', 'phenol', 'neutral', 'litmus']) : pick(['litmus', 'litmus', 'turmeric', 'rose', 'neutral']);
  if (kind === 'neutral') {
    return {
      prompt: 'An acid and a base react together. What do they make?',
      options: ['Salt and water', 'Only gas', 'Another acid', 'Sugar and oxygen'],
      correct: 0,
      explain: 'Acid + base → salt + water. This is neutralisation (like taking an antacid for acidity).',
      visual: (revealed) => (
        <svg {...svgProps}>
          <Beaker x={90} fill="#fca5a5" label="acid (HCl)" />
          <Beaker x={200} fill="#a5b4fc" label="base (NaOH)" />
          <Beaker x={310} fill={revealed ? '#bbf7d0' : '#e2e8f0'} label={revealed ? 'salt + water (pH 7)' : '?'} />
        </svg>
      ),
    };
  }
  const s = pick(SUBSTANCES);
  if (kind === 'ph') {
    const right = kindOf(s.pH) === 'acidic' ? (s.pH <= 3 ? 'Strongly acidic' : 'Weakly acidic') : kindOf(s.pH) === 'basic' ? (s.pH >= 11 ? 'Strongly basic' : 'Weakly basic') : 'Neutral';
    const all = ['Strongly acidic', 'Weakly acidic', 'Neutral', 'Weakly basic', 'Strongly basic'];
    const { options, correct } = withOptions(right, all.filter((a) => a !== right).sort(() => Math.random() - 0.5));
    return {
      prompt: `${s.name} has a pH of about ${s.pH}. It is…`,
      options,
      correct,
      explain: 'pH below 7 is acidic (the lower, the stronger), 7 is neutral, above 7 is basic (the higher, the stronger).',
      visual: (revealed) => (
        <svg {...svgProps}>
          <PhBar pH={s.pH} y={40} marker={revealed} />
          <Beaker x={200} fill={revealed ? universalColor(s.pH) : '#e2e8f0'} label={`${s.emoji} ${s.name}`} />
        </svg>
      ),
    };
  }
  const id: IndicatorId = kind === 'litmus' ? pick<IndicatorId>(['blue-litmus', 'red-litmus']) : kind === 'turmeric' ? 'turmeric' : kind === 'rose' ? 'china-rose' : 'phenolphthalein';
  const res = indicatorResult(id, s.pH);
  const allWords = Array.from(new Set(SUBSTANCES.map((x) => indicatorResult(id, x.pH).words)));
  const label = INDICATORS.find((i) => i.id === id)!.label;
  const { options, correct } = withOptions(res.words, allWords.filter((w) => w !== res.words));
  return {
    prompt: `${label} is added to ${s.name.toLowerCase()} ${s.emoji}. What happens?`,
    options,
    correct,
    explain: `${s.name} is ${kindOf(s.pH)}, so ${res.words}.`,
    visual: (revealed) => (
      <svg {...svgProps}>
        <Beaker x={200} fill={revealed ? res.color : '#e0f2fe'} label={`${s.name} + ${label}`} dropKey={revealed ? 1 : 0} dropColor={revealed ? res.color : undefined} />
        <text x={200} y={60} fontSize={30} textAnchor="middle">{s.emoji}</text>
      </svg>
    ),
  };
}

/* =============================== ATOM ================================= */

export const ELEMENTS: { z: number; symbol: string; name: string; mass: number }[] = [
  { z: 1, symbol: 'H', name: 'Hydrogen', mass: 1 },
  { z: 2, symbol: 'He', name: 'Helium', mass: 4 },
  { z: 3, symbol: 'Li', name: 'Lithium', mass: 7 },
  { z: 4, symbol: 'Be', name: 'Beryllium', mass: 9 },
  { z: 5, symbol: 'B', name: 'Boron', mass: 11 },
  { z: 6, symbol: 'C', name: 'Carbon', mass: 12 },
  { z: 7, symbol: 'N', name: 'Nitrogen', mass: 14 },
  { z: 8, symbol: 'O', name: 'Oxygen', mass: 16 },
  { z: 9, symbol: 'F', name: 'Fluorine', mass: 19 },
  { z: 10, symbol: 'Ne', name: 'Neon', mass: 20 },
  { z: 11, symbol: 'Na', name: 'Sodium', mass: 23 },
  { z: 12, symbol: 'Mg', name: 'Magnesium', mass: 24 },
  { z: 13, symbol: 'Al', name: 'Aluminium', mass: 27 },
  { z: 14, symbol: 'Si', name: 'Silicon', mass: 28 },
  { z: 15, symbol: 'P', name: 'Phosphorus', mass: 31 },
  { z: 16, symbol: 'S', name: 'Sulphur', mass: 32 },
  { z: 17, symbol: 'Cl', name: 'Chlorine', mass: 35 },
  { z: 18, symbol: 'Ar', name: 'Argon', mass: 40 },
  { z: 19, symbol: 'K', name: 'Potassium', mass: 39 },
  { z: 20, symbol: 'Ca', name: 'Calcium', mass: 40 },
];

/** Bohr shell filling (K, L, M, N) for Z = 1-20: 2, 8, 8, 2. */
export function shellsFor(z: number): number[] {
  const caps = [2, 8, 8, 2];
  const out: number[] = [];
  let left = z;
  for (const cap of caps) {
    if (left <= 0) break;
    out.push(Math.min(cap, left));
    left -= cap;
  }
  return out;
}

export function valencyFor(z: number): number {
  const shells = shellsFor(z);
  const outer = shells[shells.length - 1];
  if (z === 2 || outer === 8) return 0;
  return outer <= 4 ? outer : 8 - outer;
}

/** Modern periodic table group (1-18) and period for Z = 1-20. */
export function groupPeriodFor(z: number): { group: number; period: number } {
  const shells = shellsFor(z);
  const outer = shells[shells.length - 1];
  const period = shells.length;
  if (z === 2) return { group: 18, period };
  if (z === 1) return { group: 1, period };
  return { group: outer <= 2 ? outer : outer + 10, period };
}

const BohrAtom: React.FC<{ z: number; spin?: boolean; size?: number; cx?: number; cy?: number }> = ({ z, spin = true, size = 1, cx = 130, cy = 120 }) => {
  const t = useClock(spin);
  const el = ELEMENTS[z - 1];
  const shells = shellsFor(z);
  const radii = [34, 56, 78, 100].map((r) => r * size);
  return (
    <g>
      {shells.map((count, si) => (
        <g key={si}>
          <circle cx={cx} cy={cy} r={radii[si]} fill="none" stroke="#cbd5e1" strokeWidth={1.5} />
          {Array.from({ length: count }, (_, ei) => {
            const a = (ei / count) * Math.PI * 2 + t * (1.2 - si * 0.22);
            return <circle key={ei} cx={cx + Math.cos(a) * radii[si]} cy={cy + Math.sin(a) * radii[si]} r={4.5 * size} fill="#2563eb" stroke="white" strokeWidth={1} />;
          })}
          <text x={cx + radii[si] * 0.72} y={cy - radii[si] * 0.72} fontSize={9} fontWeight={900} fill="#64748b">
            {'KLMN'[si]}
          </text>
        </g>
      ))}
      <circle cx={cx} cy={cy} r={18 * size} fill="#f97316" />
      <text x={cx} y={cy - 1} fontSize={12 * size} fontWeight={900} textAnchor="middle" fill="white">{el.symbol}</text>
      <text x={cx} y={cy + 10 * size} fontSize={7 * size} fontWeight={800} textAnchor="middle" fill="white">
        {z}p {el.mass - z}n
      </text>
    </g>
  );
};

/** Rutherford's gold-foil experiment: alpha particles traced through a row of nuclei with a repulsive 1/r² force. */
function rutherfordPaths(count: number): Pt[][] {
  const nuclei: Pt[] = Array.from({ length: 7 }, (_, i) => [220, 20 + i * 33] as Pt);
  const paths: Pt[][] = [];
  for (let k = 0; k < count; k++) {
    let p: Pt = [10, 12 + ((k * 211) % 216)];
    let v: Pt = [3, 0];
    const pts: Pt[] = [p];
    for (let step = 0; step < 220; step++) {
      let ax = 0;
      let ay = 0;
      for (const nu of nuclei) {
        const dx = p[0] - nu[0];
        const dy = p[1] - nu[1];
        const r2 = dx * dx + dy * dy + 4;
        const f = 80 / (r2 * Math.sqrt(r2));
        ax += f * dx;
        ay += f * dy;
      }
      v = [v[0] + ax, v[1] + ay];
      const sp = Math.hypot(v[0], v[1]);
      v = [(v[0] / sp) * 3, (v[1] / sp) * 3];
      p = [p[0] + v[0], p[1] + v[1]];
      pts.push(p);
      if (p[0] < -10 || p[0] > W + 10 || p[1] < -10 || p[1] > H + 10) break;
    }
    paths.push(pts);
  }
  return paths;
}

const RutherfordScene: React.FC = () => {
  const paths = useMemo(() => rutherfordPaths(26), []);
  const t = useClock(true);
  return (
    <svg {...svgProps}>
      <rect x={0} y={0} width={W} height={H} fill="#0f172a" />
      <rect x={214} y={0} width={12} height={H} fill="#facc15" opacity={0.25} />
      {Array.from({ length: 7 }, (_, i) => (
        <circle key={i} cx={220} cy={20 + i * 33} r={3} fill="#facc15" />
      ))}
      <text x={232} y={14} fontSize={10} fontWeight={800} fill="#fde68a">gold foil (nuclei)</text>
      {paths.map((pts, i) => {
        const cycle = 3.6;
        const local = ((t + i * 0.37) % cycle) / cycle;
        const upto = Math.max(1, Math.floor(local * pts.length));
        const head = pts[Math.min(upto, pts.length - 1)];
        const tail = pts.slice(Math.max(0, upto - 14), upto + 1);
        return (
          <g key={i}>
            <polyline points={tail.map((p) => p.join(',')).join(' ')} fill="none" stroke="#f472b6" strokeWidth={1.6} opacity={0.6} />
            <circle cx={head[0]} cy={head[1]} r={3} fill="#f472b6" />
          </g>
        );
      })}
      <text x={10} y={H - 10} fontSize={11} fontWeight={800} fill="#e2e8f0">α particles → most pass straight; a few bounce back from the tiny, heavy nucleus</text>
    </svg>
  );
};

export const AtomExplore: React.FC<SimProps> = ({ grade, variant }) => {
  const g = gradeN(grade);
  const [mode, setMode] = useState<'bohr' | 'rutherford'>(variant === 'rutherford' ? 'rutherford' : 'bohr');
  const [z, setZ] = useState(11);
  const el = ELEMENTS[z - 1];
  const shells = shellsFor(z);
  const gp = groupPeriodFor(z);
  return (
    <SimFrame
      dark={mode === 'rutherford'}
      caption={
        mode === 'bohr' ? (
          <span>
            {el.name} ({el.symbol}): Z = {z} → {z} protons, {z} electrons, {el.mass - z} neutrons (mass number {el.mass}) · configuration <b>{shells.join(', ')}</b> · valency{' '}
            {valencyFor(z)}
            {g >= 10 && <> · group {gp.group}, period {gp.period}</>}
          </span>
        ) : (
          <span>Rutherford (1911): almost all the atom is empty space; its positive charge and mass sit in a tiny nucleus.</span>
        )
      }
      controls={
        <>
          <Toggle options={[{ id: 'bohr', label: '⚛️ Bohr model' }, { id: 'rutherford', label: '✨ Gold foil experiment' }]} value={mode} onChange={(v) => setMode(v as 'bohr' | 'rutherford')} />
          {mode === 'bohr' && <Slider label="Atomic number Z" value={z} min={1} max={20} onChange={setZ} format={(v) => `${v} ${ELEMENTS[v - 1].symbol}`} />}
        </>
      }
    >
      {mode === 'bohr' ? (
        <svg {...svgProps}>
          <BohrAtom z={z} />
          <g transform="translate(250 30)">
            <rect width={130} height={74} rx={10} fill="white" stroke="#cbd5e1" />
            <text x={10} y={18} fontSize={11} fontWeight={800} fill="#64748b">{z}</text>
            <text x={65} y={50} fontSize={30} fontWeight={900} textAnchor="middle" fill="#0f172a">{el.symbol}</text>
            <text x={65} y={67} fontSize={10} fontWeight={800} textAnchor="middle" fill="#475569">{el.name}</text>
            <text x={120} y={18} fontSize={10} fontWeight={800} textAnchor="end" fill="#64748b">{el.mass}</text>
          </g>
          <g transform="translate(250 120)">
            {shells.map((n, i) => (
              <g key={i} transform={`translate(0 ${i * 22})`}>
                <text x={0} y={14} fontSize={11} fontWeight={900} fill="#475569">{'KLMN'[i]}</text>
                {Array.from({ length: n }, (_, k) => (
                  <motion.circle key={`${z}-${k}`} cx={18 + k * 13} cy={10} r={5} fill="#2563eb" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: k * 0.04 }} />
                ))}
              </g>
            ))}
          </g>
        </svg>
      ) : (
        <RutherfordScene />
      )}
    </SimFrame>
  );
};

export function atomRound(grade: string): ChallengeRound {
  const g = gradeN(grade);
  const z = randInt(3, 20);
  const el = ELEMENTS[z - 1];
  const shells = shellsFor(z);
  const kind = g >= 10 ? pick(['config', 'valency', 'group', 'period', 'neutrons']) : pick(['config', 'valency', 'neutrons', 'rutherford']);
  const visual = (revealed: boolean) => (
    <svg {...svgProps}>
      {revealed ? <BohrAtom z={z} cx={200} /> : (
        <g>
          <circle cx={200} cy={120} r={26} fill="#f97316" />
          <text x={200} y={127} fontSize={20} fontWeight={900} textAnchor="middle" fill="white">{el.symbol}</text>
          <text x={200} y={175} fontSize={12} fontWeight={800} textAnchor="middle" fill="#475569">Z = {z}, mass number {el.mass}</text>
        </g>
      )}
    </svg>
  );
  if (kind === 'rutherford') {
    return {
      prompt: 'In Rutherford’s gold foil experiment, most alpha particles went straight through. What does this show?',
      options: ['Most of the atom is empty space', 'The atom is a solid ball', 'Electrons are heavier than protons', 'Gold has no nucleus'],
      correct: 0,
      explain: 'Most of the atom is empty; only the very few particles that came close to the tiny, heavy, positive nucleus were turned back.',
      visual: () => <RutherfordScene />,
    };
  }
  if (kind === 'config') {
    const right = shells.join(', ');
    const wrong = [shellsFor(z + 1).join(', '), shellsFor(Math.max(1, z - 1)).join(', '), [Math.min(8, z), ...(z > 8 ? [z - 8] : [])].join(', '), shells.slice().reverse().join(', ')];
    const { options, correct } = withOptions(right, wrong.filter((w) => w !== right));
    return { prompt: `What is the electronic configuration of ${el.name} (Z = ${z})?`, options, correct, explain: `Fill K with 2, L with 8, then M: ${el.symbol} = ${right}.`, visual };
  }
  if (kind === 'valency') {
    const v = valencyFor(z);
    const { options, correct } = withOptions(String(v), ['0', '1', '2', '3', '4'].filter((o) => o !== String(v)).sort(() => Math.random() - 0.5));
    return {
      prompt: `What is the valency of ${el.name} (configuration ${shells.join(', ')})?`,
      options,
      correct,
      explain: `The outer shell has ${shells[shells.length - 1]} electron(s); ${v === 0 ? 'it is full, so valency 0' : shells[shells.length - 1] <= 4 ? `it gives them away: valency ${v}` : `it needs ${v} more to make 8: valency ${v}`}.`,
      visual,
    };
  }
  if (kind === 'neutrons') {
    const n = el.mass - z;
    const { options, correct } = withOptions(String(n), [String(el.mass), String(z), String(el.mass + z), String(n + 1)]);
    return { prompt: `${el.name} has atomic number ${z} and mass number ${el.mass}. How many neutrons?`, options, correct, explain: `Neutrons = mass number − atomic number = ${el.mass} − ${z} = ${n}.`, visual };
  }
  const gp = groupPeriodFor(z);
  if (kind === 'period') {
    const { options, correct } = withOptions(String(gp.period), ['1', '2', '3', '4'].filter((o) => o !== String(gp.period)));
    return { prompt: `In which period of the periodic table is ${el.name} (${shells.join(', ')})?`, options, correct, explain: `It has ${shells.length} shells, so it is in period ${gp.period}.`, visual };
  }
  const { options, correct } = withOptions(String(gp.group), ['1', '2', '13', '14', '15', '16', '17', '18'].filter((o) => o !== String(gp.group)).sort(() => Math.random() - 0.5));
  return {
    prompt: `In which group is ${el.name} (${shells.join(', ')})?`,
    options,
    correct,
    explain: `Outer shell electrons ${shells[shells.length - 1]} → group ${gp.group} (1-2 stay as they are; 3-8 add 10).`,
    visual,
  };
}

/* =========================== PHOTOSYNTHESIS =========================== */

/** Hydrilla in a beaker under a lamp. Rate of bubbles grows with light and CO₂ (limited by the smaller). */
export function photosynthesisRate(lampCm: number, co2: number, light: boolean): number {
  if (!light) return 0;
  const intensity = clamp((20 / lampCm) ** 2, 0, 1.6); // inverse square, 1 at 20 cm
  return round(Math.min(intensity * 30, co2 * 10), 1); // bubbles per minute
}

const HydrillaScene: React.FC<{ rate: number; lampCm: number; light: boolean; co2?: number }> = ({ rate, lampCm, light, co2 = 3 }) => {
  const t = useClock(true);
  const lampX = 330 - (lampCm - 10) * 4;
  const perSecond = rate / 60;
  const bubbles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ offset: (i * 0.618) % 1, dx: ((i * 37) % 11) - 5 })), []);
  return (
    <svg {...svgProps}>
      {/* lamp */}
      <g transform={`translate(${lampX} 40)`}>
        {light && <motion.circle r={60} fill="#fde047" opacity={0.25} animate={{ opacity: [0.2, 0.32, 0.2] }} transition={{ duration: 1.6, repeat: Infinity }} />}
        <path d="M -16 -10 L 16 -10 L 10 10 L -10 10 Z" fill={light ? '#fde047' : '#e7e5e4'} stroke="#a16207" strokeWidth={2} />
        <line x1={0} y1={-10} x2={0} y2={-38} stroke="#57534e" strokeWidth={3} />
        <text x={0} y={30} fontSize={10} fontWeight={800} textAnchor="middle" fill="#57534e">{light ? `${lampCm} cm` : 'dark'}</text>
      </g>
      {/* beaker with water */}
      <rect x={90} y={80} width={130} height={140} rx={8} fill="#bae6fd" opacity={0.7} />
      <rect x={90} y={80} width={130} height={140} rx={8} fill="none" stroke="#64748b" strokeWidth={3} />
      {/* CO2 dots dissolved */}
      {Array.from({ length: Math.round(co2 * 2) }, (_, i) => (
        <text key={i} x={100 + ((i * 47) % 110)} y={150 + ((i * 29) % 60)} fontSize={7} fontWeight={800} fill="#475569" opacity={0.6}>CO₂</text>
      ))}
      {/* funnel + test tube */}
      <path d="M 110 205 L 155 160 L 165 160 L 210 205 Z" fill="#e2e8f0" opacity={0.7} stroke="#64748b" />
      <rect x={152} y={60} width={16} height={100} rx={8} fill="#f1f5f9" opacity={0.8} stroke="#64748b" />
      {/* hydrilla */}
      {[-20, -8, 4, 16].map((dx, i) => (
        <path key={i} d={`M ${160 + dx} 214 q ${(i % 2 ? 1 : -1) * 10} -20 0 -40 q ${(i % 2 ? -1 : 1) * 10} -10 4 -24`} stroke="#15803d" strokeWidth={3} fill="none" />
      ))}
      {/* oxygen bubbles rising up the tube */}
      {perSecond > 0 &&
        bubbles.slice(0, clamp(Math.round(rate / 2), 2, 24)).map((b, i) => {
          const speed = 0.35 + perSecond * 0.4;
          const phase = (t * speed + b.offset) % 1;
          const y = 175 - phase * 105;
          return <circle key={i} cx={160 + b.dx * (1 - phase)} cy={y} r={2.5 + phase} fill="white" stroke="#0ea5e9" strokeWidth={1} opacity={1 - phase * 0.4} />;
        })}
      <text x={160} y={52} fontSize={10} fontWeight={900} textAnchor="middle" fill="#0369a1">O₂</text>
      <text x={20} y={20} fontSize={12} fontWeight={900} fill="#166534">{rate} bubbles of oxygen per minute</text>
      <text x={20} y={234} fontSize={10} fontWeight={800} fill="#475569">6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (sunlight, chlorophyll)</text>
    </svg>
  );
};

export const PhotosynthesisExplore: React.FC<SimProps> = () => {
  const [lamp, setLamp] = useState(20);
  const [co2, setCo2] = useState(3);
  const [light, setLight] = useState(true);
  const rate = photosynthesisRate(lamp, co2, light);
  const limited = light && co2 * 10 < clamp((20 / lamp) ** 2, 0, 1.6) * 30 ? 'carbon dioxide' : 'light';
  return (
    <SimFrame
      caption={
        light ? (
          <span>
            Leaves use light energy to make food (glucose) from carbon dioxide and water, giving out oxygen. Right now the rate is limited by <b>{limited}</b>.
          </span>
        ) : (
          <span>No light, no photosynthesis — no oxygen bubbles.</span>
        )
      }
      controls={
        <>
          <Toggle options={[{ id: 'on', label: '💡 Lamp on' }, { id: 'off', label: '🌑 Dark' }]} value={light ? 'on' : 'off'} onChange={(v) => setLight(v === 'on')} />
          <Slider label="Lamp distance" value={lamp} min={10} max={50} step={5} unit=" cm" onChange={setLamp} />
          <Slider label="CO₂ (baking soda pinches)" value={co2} min={0} max={6} onChange={setCo2} />
        </>
      }
    >
      <HydrillaScene rate={rate} lampCm={lamp} light={light} co2={co2} />
    </SimFrame>
  );
};

export function photosynthesisRound(): ChallengeRound {
  const kind = pick(['closer', 'dark', 'gas', 'raw', 'starch', 'where']);
  if (kind === 'closer' || kind === 'dark') {
    const far = pick([30, 40]);
    const near = pick([10, 15]);
    const dark = kind === 'dark';
    return {
      prompt: dark ? 'The lamp is switched off. What happens to the bubbles from the Hydrilla?' : `The lamp is moved from ${far} cm to ${near} cm. What happens to the bubbles?`,
      options: ['More bubbles', 'Fewer bubbles', 'They stop', 'No change'],
      correct: dark ? 2 : 0,
      explain: dark ? 'Without light the plant cannot photosynthesise, so no oxygen is given out.' : 'More light reaches the plant, so it photosynthesises faster and gives more oxygen.',
      visual: (revealed) => {
        const lampCm = dark ? 20 : revealed ? near : far;
        const light = !(dark && revealed);
        return <HydrillaScene rate={photosynthesisRate(lampCm, 6, light)} lampCm={lampCm} light={light} co2={6} />;
      },
    };
  }
  const facts: Record<string, { q: string; right: string; wrong: string[]; explain: string }> = {
    gas: { q: 'Which gas are the bubbles?', right: 'Oxygen', wrong: ['Carbon dioxide', 'Nitrogen', 'Hydrogen'], explain: 'Photosynthesis gives out oxygen.' },
    raw: { q: 'What are the raw materials of photosynthesis?', right: 'Carbon dioxide and water', wrong: ['Oxygen and glucose', 'Soil and air', 'Nitrogen and water'], explain: 'Plants take in carbon dioxide (air) and water (roots) and use sunlight.' },
    starch: {
      q: 'A leaf kept in the dark for 2 days is tested with iodine. What do you see?',
      right: 'No blue-black colour: no starch',
      wrong: ['Blue-black colour: lots of starch', 'The leaf turns red', 'The iodine boils'],
      explain: 'In the dark the leaf used up its starch and could not make more, so iodine does not turn blue-black.',
    },
    where: { q: 'In which part of the cell does photosynthesis happen?', right: 'Chloroplast', wrong: ['Nucleus', 'Cell wall', 'Vacuole'], explain: 'Chloroplasts hold chlorophyll, which traps light energy.' },
  };
  const f = facts[kind];
  const { options, correct } = withOptions(f.right, f.wrong);
  return { prompt: f.q, options, correct, explain: f.explain, visual: () => <HydrillaScene rate={photosynthesisRate(15, 4, true)} lampCm={15} light co2={4} /> };
}

/* ============================== HEART ================================= */

// The double circulation as one loop (viewer's view: the heart's right side is on the left).
// Each point carries the blood's colour arriving there: blue = oxygen-poor, red = oxygen-rich.
const CIRC: { p: Pt; red: boolean; label?: string }[] = [
  { p: [110, 210], red: false },
  { p: [110, 110], red: false, label: 'Vena cava' },
  { p: [168, 110], red: false, label: 'Right atrium' },
  { p: [172, 150], red: false, label: 'Right ventricle' },
  { p: [150, 92], red: false },
  { p: [120, 46], red: false, label: 'Pulmonary artery' },
  { p: [150, 26], red: false, label: 'Lungs' },
  { p: [250, 26], red: true, label: 'Lungs' },
  { p: [280, 46], red: true },
  { p: [250, 92], red: true, label: 'Pulmonary vein' },
  { p: [232, 110], red: true, label: 'Left atrium' },
  { p: [228, 150], red: true, label: 'Left ventricle' },
  { p: [210, 92], red: true },
  { p: [300, 70], red: true, label: 'Aorta' },
  { p: [300, 210], red: true },
  { p: [200, 210], red: true, label: 'Body cells' },
  { p: [150, 210], red: false, label: 'Body cells' },
];

function circPoint(s: number): { p: Pt; red: boolean; label?: string } {
  const pts = CIRC;
  const lens = pts.map((c, i) => Math.hypot(pts[(i + 1) % pts.length].p[0] - c.p[0], pts[(i + 1) % pts.length].p[1] - c.p[1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let d = ((s % total) + total) % total;
  for (let i = 0; i < pts.length; i++) {
    if (d <= lens[i]) {
      const a = pts[i].p;
      const b = pts[(i + 1) % pts.length].p;
      const f = d / lens[i];
      const next = pts[(i + 1) % pts.length];
      return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], red: next.red, label: next.label };
    }
    d -= lens[i];
  }
  return pts[0];
}

export const CHAMBERS = [
  { id: 'RA', name: 'Right atrium', x: 150, y: 96, w: 40, h: 30, red: false },
  { id: 'RV', name: 'Right ventricle', x: 150, y: 132, w: 44, h: 40, red: false },
  { id: 'LA', name: 'Left atrium', x: 210, y: 96, w: 40, h: 30, red: true },
  { id: 'LV', name: 'Left ventricle', x: 206, y: 132, w: 44, h: 40, red: true },
];

const HeartScene: React.FC<{ bpm: number; highlight?: string | null; flow?: boolean }> = ({ bpm, highlight, flow = true }) => {
  const t = useClock(true);
  const beat = (t * bpm) / 60;
  const phase = beat % 1;
  // Atria squeeze first (0-0.15), then ventricles (0.2-0.45).
  const atria = phase < 0.15 ? 1 - Math.sin((phase / 0.15) * Math.PI) * 0.12 : 1;
  const ventricles = phase > 0.2 && phase < 0.45 ? 1 - Math.sin(((phase - 0.2) / 0.25) * Math.PI) * 0.14 : 1;
  const speed = 26 + bpm * 0.5;
  const cells = 22;
  const total = useMemo(() => CIRC.reduce((sum, c, i) => sum + Math.hypot(CIRC[(i + 1) % CIRC.length].p[0] - c.p[0], CIRC[(i + 1) % CIRC.length].p[1] - c.p[1]), 0), []);
  return (
    <svg {...svgProps}>
      {/* lungs */}
      <ellipse cx={150} cy={30} rx={46} ry={22} fill="#fecdd3" />
      <ellipse cx={250} cy={30} rx={46} ry={22} fill="#fecdd3" />
      <text x={200} y={60} fontSize={11} fontWeight={900} textAnchor="middle" fill="#9f1239">LUNGS ↑</text>
      {/* body */}
      <rect x={95} y={200} width={220} height={38} rx={10} fill="#fde68a" />
      <text x={205} y={232} fontSize={11} fontWeight={900} textAnchor="middle" fill="#92400e">BODY CELLS (use oxygen)</text>
      {/* vessels */}
      <polyline points={CIRC.map((c) => c.p.join(',')).join(' ') + ` ${CIRC[0].p.join(',')}`} fill="none" stroke="#e2e8f0" strokeWidth={9} strokeLinejoin="round" />
      {/* heart */}
      <path d="M 200 186 C 120 150 120 82 160 82 C 182 82 196 92 200 102 C 204 92 218 82 240 82 C 280 82 280 150 200 186 Z" fill="#fda4af" opacity={0.5} />
      {CHAMBERS.map((c) => {
        const s = c.id.endsWith('A') ? atria : ventricles;
        const on = highlight === c.id;
        return (
          <g key={c.id} transform={`translate(${c.x + c.w / 2} ${c.y + c.h / 2}) scale(${s}) translate(${-(c.x + c.w / 2)} ${-(c.y + c.h / 2)})`}>
            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={9} fill={c.red ? '#dc2626' : '#2563eb'} opacity={on ? 1 : 0.75} stroke={on ? '#facc15' : 'white'} strokeWidth={on ? 4 : 2} />
            <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 4} fontSize={11} fontWeight={900} textAnchor="middle" fill="white">{c.id}</text>
          </g>
        );
      })}
      {/* blood cells */}
      {flow &&
        Array.from({ length: cells }, (_, i) => {
          const c = circPoint(t * speed + (i * total) / cells);
          return <circle key={i} cx={c.p[0]} cy={c.p[1]} r={4} fill={c.red ? '#dc2626' : '#2563eb'} stroke="white" strokeWidth={1} />;
        })}
      <text x={8} y={64} fontSize={10} fontWeight={800} fill="#2563eb">oxygen-poor</text>
      <text x={392} y={64} fontSize={10} fontWeight={800} textAnchor="end" fill="#dc2626">oxygen-rich</text>
    </svg>
  );
};

export const HeartExplore: React.FC<SimProps> = () => {
  const [bpm, setBpm] = useState(72);
  const [step, setStep] = useState(-1);
  const route = ['Body', 'Vena cava', 'RA', 'RV', 'Pulmonary artery', 'Lungs', 'Pulmonary vein', 'LA', 'LV', 'Aorta', 'Body'];
  const routeNames: Record<string, string> = { RA: 'right atrium', RV: 'right ventricle', LA: 'left atrium', LV: 'left ventricle' };
  return (
    <SimFrame
      caption={
        <span>
          {step < 0 ? (
            <>Double circulation: blood passes through the heart twice in one round — heart → lungs → heart → body. {bpm} beats a minute = {bpm * 60} an hour.</>
          ) : (
            <>
              Step {step + 1}:{' '}
              {route
                .slice(0, step + 1)
                .map((r) => routeNames[r] || r)
                .join(' → ')}
            </>
          )}
        </span>
      }
      controls={
        <>
          <Slider label="Heart rate" value={bpm} min={50} max={150} unit=" beats/min" onChange={setBpm} />
          <ChunkyButton color="rose" className="!px-3 !py-2 text-sm" onClick={() => setStep((s) => (s + 1 >= route.length ? -1 : s + 1))}>
            {step < 0 ? '▶ Follow the blood' : step + 1 >= route.length ? '↺ Start again' : 'Next ➜'}
          </ChunkyButton>
        </>
      }
    >
      <HeartScene bpm={bpm} highlight={step >= 0 ? route[step] : null} />
    </SimFrame>
  );
}

export function heartRound(): ChallengeRound {
  const facts = [
    { q: 'Which chamber pumps oxygen-rich blood to the whole body?', right: 'Left ventricle', wrong: ['Right ventricle', 'Left atrium', 'Right atrium'], hl: 'LV', explain: 'The left ventricle has the thickest wall: it pumps blood through the aorta to the whole body.' },
    { q: 'Oxygen-rich blood from the lungs first enters the…', right: 'Left atrium', wrong: ['Right atrium', 'Left ventricle', 'Right ventricle'], hl: 'LA', explain: 'Pulmonary veins bring oxygen-rich blood from the lungs into the left atrium.' },
    { q: 'Blood from the body (oxygen-poor) enters the heart into the…', right: 'Right atrium', wrong: ['Left atrium', 'Right ventricle', 'Left ventricle'], hl: 'RA', explain: 'The vena cavae bring oxygen-poor blood from the body to the right atrium.' },
    { q: 'Which chamber sends blood to the lungs?', right: 'Right ventricle', wrong: ['Left ventricle', 'Left atrium', 'Right atrium'], hl: 'RV', explain: 'The right ventricle pumps oxygen-poor blood through the pulmonary artery to the lungs.' },
    { q: 'Why is it called "double circulation"?', right: 'Blood passes through the heart twice in one round', wrong: ['There are two hearts', 'Blood moves twice as fast', 'Blood goes to the lungs twice'], hl: null, explain: 'One loop goes heart → lungs → heart, the other heart → body → heart.' },
    { q: 'Which artery carries oxygen-poor blood?', right: 'Pulmonary artery', wrong: ['Aorta', 'Pulmonary vein', 'Coronary artery'], hl: 'RV', explain: 'Arteries usually carry oxygen-rich blood — the pulmonary artery is the exception: it carries oxygen-poor blood to the lungs.' },
  ];
  const kind = Math.random() < 0.25 ? 'pulse' : 'fact';
  if (kind === 'pulse') {
    const bpm = pick([70, 72, 75, 80]);
    const min = pick([2, 3, 5]);
    const right = String(bpm * min);
    const { options, correct } = withOptions(right, [String(bpm + min), String(bpm * (min + 1)), String(bpm * 60), String(round(bpm / min, 0))]);
    return { prompt: `A heart beats ${bpm} times a minute. How many beats in ${min} minutes?`, options, correct, explain: `${bpm} × ${min} = ${right} beats.`, visual: () => <HeartScene bpm={bpm} /> };
  }
  const f = pick(facts);
  const { options, correct } = withOptions(f.right, f.wrong);
  return { prompt: f.q, options, correct, explain: f.explain, visual: (revealed) => <HeartScene bpm={72} highlight={revealed ? f.hl : null} /> };
}
