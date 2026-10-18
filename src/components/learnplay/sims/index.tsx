// Registry of the Class 6-10 simulations. Each group (maths, physics,
// chemistry/biology, earth/history) is its own chunk, loaded only when a
// chapter that uses it opens, so younger classes never download them.
import React, { useEffect, useState } from 'react';
import type { SimKind } from '../../../data/learnPlay';
import { ChallengeRound, ChallengeRunner, SimChallengeProps, SimProps } from './simKit';

type Mods = {
  maths: typeof import('./mathsSims');
  physics: typeof import('./physicsSims');
  chembio: typeof import('./chemBioSims');
  earth: typeof import('./earthSims');
};
type Group = keyof Mods;

const LOADERS: { [G in Group]: () => Promise<Mods[G]> } = {
  maths: () => import('./mathsSims'),
  physics: () => import('./physicsSims'),
  chembio: () => import('./chemBioSims'),
  earth: () => import('./earthSims'),
};

interface Entry {
  group: Group;
  explore: (mod: never) => React.FC<SimProps>;
  round: (mod: never, grade: string, variant?: string) => ChallengeRound;
  intro: string;
}

const entry = <G extends Group>(
  group: G,
  explore: (mod: Mods[G]) => React.FC<SimProps>,
  round: (mod: Mods[G], grade: string, variant?: string) => ChallengeRound,
  intro: string
): Entry => ({ group, explore: explore as Entry['explore'], round: round as Entry['round'], intro });

export const SIMS: Record<SimKind, Entry> = {
  integers: entry('maths', (m) => m.IntegersExplore, (m, g) => m.integersRound(g), 'Watch the counter hop on the number line, then pick the answer!'),
  fractions: entry('maths', (m) => m.FractionsExplore, (m, g) => m.fractionsRound(g), 'Look at the shaded parts and answer.'),
  balance: entry('maths', (m) => m.BalanceExplore, (m) => m.balanceRound(), 'Keep the balance level to find x!'),
  triangles: entry('maths', (m) => m.TriangleExplore, (m) => m.triangleRound(), 'The angles of a triangle always add up to 180°.'),
  graphs: entry('maths', (m) => m.GraphExplore, (m, g, v) => m.graphRound(g, v), 'Read the graph carefully!'),
  trig: entry('maths', (m) => m.TrigExplore, (m) => m.trigRound(), 'Use the unit circle and the standard values.'),
  probability: entry('maths', (m) => m.ProbabilityExplore, (m) => m.probabilityRound(), 'Probability = favourable outcomes ÷ all outcomes.'),
  sets: entry('maths', (m) => m.VennExplore, (m) => m.vennRound(), 'Look at the shaded part of the Venn diagram.'),
  circuit: entry('physics', (m) => m.CircuitExplore, (m, g) => m.circuitRound(g), 'Think about the path the current takes.'),
  magnet: entry('physics', (m) => m.MagnetExplore, (m, g) => m.magnetRound(g), 'Magnets and currents — think about the field!'),
  motion: entry('physics', (m) => m.MotionExplore, (m, g) => m.motionRound(g), 'Distance, speed, time — let’s go!'),
  refraction: entry('physics', (m) => m.RefractionExplore, (m) => m.refractionRound(), 'Remember Snell’s law: n₁ sin i = n₂ sin r.'),
  lens: entry('physics', (m) => m.LensExplore, (m) => m.lensRound(), 'Use 1/v − 1/u = 1/f and the ray diagram.'),
  acids: entry('chembio', (m) => m.AcidsExplore, (m, g) => m.acidsRound(g), 'Acid, base or neutral? Watch the colour!'),
  atom: entry('chembio', (m) => m.AtomExplore, (m, g) => m.atomRound(g), 'K holds 2, L holds 8, M holds 8.'),
  photosynthesis: entry('chembio', (m) => m.PhotosynthesisExplore, (m) => m.photosynthesisRound(), 'Light + CO₂ + water → food + oxygen.'),
  heart: entry('chembio', (m) => m.HeartExplore, (m) => m.heartRound(), 'Follow the blood: body → heart → lungs → heart → body.'),
  solar: entry('earth', (m) => m.SolarExplore, (m) => m.solarRound(), 'Eight planets — how well do you know them?'),
  globe: entry('earth', (m) => m.GlobeExplore, (m) => m.globeRound(), 'Latitudes, longitudes and time!'),
  seasons: entry('earth', (m) => m.SeasonsExplore, (m) => m.seasonsRound(), 'The tilted Earth makes the seasons.'),
  timeline: entry('earth', (m) => m.TimelineExplore, (m, _g, v) => m.timelineRound(v), 'Dates and events — travel through history!'),
};

const loaded: Partial<Record<Group, unknown>> = {};

function useGroup(group: Group): unknown | null {
  const [mod, setMod] = useState<unknown | null>(() => loaded[group] ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (loaded[group]) {
      setMod(loaded[group]);
      return;
    }
    let alive = true;
    LOADERS[group]()
      .then((m) => {
        loaded[group] = m;
        if (alive) setMod(m);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [group]);
  if (failed) throw new Error(`Could not load the ${group} simulations`);
  return mod;
}

const Loading: React.FC = () => (
  <div className="flex h-full items-center justify-center text-sm font-black text-stone-400" role="status">
    <span className="animate-pulse">Setting up the experiment…</span>
  </div>
);

/** The interactive simulation shown on a Learn card. */
export const SimExplore: React.FC<SimProps & { kind: SimKind }> = ({ kind, grade, variant }) => {
  const e = SIMS[kind];
  const mod = useGroup(e.group);
  if (!mod) return <Loading />;
  const Explore = e.explore(mod as never);
  return <Explore grade={grade} variant={variant} />;
};

/** The Play step of a simulation chapter: five animated questions. */
export const SimChallenge: React.FC<SimChallengeProps & { kind: SimKind }> = ({ kind, grade, variant, onFinish, onMascot }) => {
  const e = SIMS[kind];
  const mod = useGroup(e.group);
  if (!mod) return <div className="h-72"><Loading /></div>;
  return <ChallengeRunner makeRound={() => e.round(mod as never, grade, variant)} intro={e.intro} onFinish={onFinish} onMascot={onMascot} />;
};
