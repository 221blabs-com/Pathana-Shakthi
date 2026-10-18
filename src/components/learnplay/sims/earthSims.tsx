// Earth, space and history simulations for Classes 6-10 (Telangana
// syllabus): the solar system in 3D (three.js, flat SVG without WebGL), a
// globe with latitudes, longitudes and time (Hyderabad marked), seasons from
// the tilted Earth's orbit with real day lengths for Hyderabad, and animated
// timelines of the National Movement and the formation of Telangana.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimatePresence, motion } from 'motion/react';
import { ChunkyButton } from '../ui';
import { ChallengeRound, SimFrame, SimProps, Slider, Toggle, clamp, pick, round, useClock, withOptions } from './simKit';

const W = 400;
const H = 240;
const svgProps = { viewBox: `0 0 ${W} ${H}`, className: 'h-full w-full', preserveAspectRatio: 'xMidYMid meet' } as const;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/* ============================ SOLAR SYSTEM ============================ */

export const PLANETS = [
  { name: 'Mercury', color: 0x9ca3af, size: 0.38, au: 0.39, years: 0.24, fact: 'Closest to the Sun and the smallest planet.' },
  { name: 'Venus', color: 0xfcd34d, size: 0.95, au: 0.72, years: 0.62, fact: 'The hottest planet and the brightest in our sky — the morning/evening star.' },
  { name: 'Earth', color: 0x3b82f6, size: 1, au: 1, years: 1, fact: 'The only planet known to have life. One Moon.' },
  { name: 'Mars', color: 0xef4444, size: 0.53, au: 1.52, years: 1.88, fact: 'The red planet — its soil has iron oxide (rust).' },
  { name: 'Jupiter', color: 0xf59e0b, size: 3.2, au: 5.2, years: 11.86, fact: 'The largest planet, with the Great Red Spot.' },
  { name: 'Saturn', color: 0xfde68a, size: 2.7, au: 9.58, years: 29.46, fact: 'Famous for its bright rings of ice and rock.' },
  { name: 'Uranus', color: 0x67e8f9, size: 1.6, au: 19.2, years: 84, fact: 'Spins lying on its side.' },
  { name: 'Neptune', color: 0x6366f1, size: 1.55, au: 30.05, years: 164.8, fact: 'Farthest from the Sun — one year there is about 165 Earth years.' },
];

// Distances squeezed (square root) so all eight orbits fit; periods are true ratios.
const orbitR = (au: number) => 1.6 + Math.sqrt(au) * 2.1;
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Flat top-down solar system (used in challenges and when WebGL is missing). */
const SolarFlat: React.FC<{ years: number; highlight?: string | null; dark?: boolean }> = ({ years, highlight, dark = true }) => {
  const cx = 200;
  const cy = 120;
  const k = 9.2;
  return (
    <svg {...svgProps}>
      {dark && <rect width={W} height={H} fill="#020617" />}
      <circle cx={cx} cy={cy} r={11} fill="#facc15" />
      {PLANETS.map((p) => {
        const r = orbitR(p.au) * k;
        const a = (years / p.years) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const y = cy - Math.sin(a) * r * 0.48;
        const on = highlight === p.name;
        return (
          <g key={p.name}>
            <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.48} fill="none" stroke={on ? '#facc15' : '#334155'} strokeWidth={on ? 2 : 1} />
            <circle cx={x} cy={y} r={2.5 + p.size * 1.6} fill={hex(p.color)} stroke={on ? '#facc15' : 'none'} strokeWidth={2} />
            {on && (
              <text x={x} y={y - 10} fontSize={11} fontWeight={900} textAnchor="middle" fill="#fde68a">
                {p.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const Solar3D: React.FC<{ speed: number; focus: string | null; onUnsupported: () => void }> = ({ speed, focus, onUnsupported }) => {
  const host = useRef<HTMLDivElement>(null);
  const speedRef = useRef(speed);
  const focusRef = useRef(focus);
  speedRef.current = speed;
  focusRef.current = focus;
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      onUnsupported();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x020617);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sunLight = new THREE.PointLight(0xffffff, 60, 0, 1.4);
    scene.add(sunLight);
    const disposables: { dispose: () => void }[] = [];
    const sunGeo = new THREE.SphereGeometry(1.1, 40, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    disposables.push(sunGeo, sunMat);
    scene.add(new THREE.Mesh(sunGeo, sunMat));
    const glowGeo = new THREE.SphereGeometry(1.5, 32, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.18 });
    disposables.push(glowGeo, glowMat);
    scene.add(new THREE.Mesh(glowGeo, glowMat));
    // stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const r = 60 + Math.random() * 30;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35 });
    disposables.push(starGeo, starMat);
    scene.add(new THREE.Points(starGeo, starMat));
    const bodies = PLANETS.map((p) => {
      const r = orbitR(p.au);
      const ringGeo = new THREE.RingGeometry(r - 0.02, r + 0.02, 128);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);
      const geo = new THREE.SphereGeometry(0.14 + p.size * 0.11, 32, 16);
      const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      disposables.push(ringGeo, ringMat, geo, mat);
      if (p.name === 'Saturn') {
        const sGeo = new THREE.RingGeometry(0.62, 0.95, 48);
        const sMat = new THREE.MeshBasicMaterial({ color: 0xe7d7a5, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
        const sRing = new THREE.Mesh(sGeo, sMat);
        sRing.rotation.x = -Math.PI / 2.6;
        mesh.add(sRing);
        disposables.push(sGeo, sMat);
      }
      return { p, r, mesh, ringMat };
    });
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    let yaw = 0.6;
    let pitch = 0.55;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - lx) * 0.008;
      pitch = clamp(pitch + (e.clientY - ly) * 0.006, 0.08, 1.4);
      lx = e.clientX;
      ly = e.clientY;
    };
    const up = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);
    let years = 0;
    let last = performance.now();
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      years += dt * speedRef.current;
      if (!dragging) yaw += dt * 0.05;
      for (const b of bodies) {
        const a = (years / b.p.years) * Math.PI * 2;
        b.mesh.position.set(Math.cos(a) * b.r, 0, -Math.sin(a) * b.r);
        b.mesh.rotation.y += dt * 1.5;
        b.ringMat.color.setHex(focusRef.current === b.p.name ? 0xfacc15 : 0x334155);
      }
      const dist = 17;
      camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onUnsupported]);
  return <div ref={host} className="h-full w-full cursor-grab active:cursor-grabbing" id="solar-3d" />;
};

export const SolarExplore: React.FC<SimProps> = () => {
  const [speed, setSpeed] = useState(0.5);
  const [focus, setFocus] = useState<string | null>('Earth');
  const [flat, setFlat] = useState(false);
  const years = useClock(flat) * speed;
  const onUnsupported = useMemo(() => () => setFlat(true), []);
  const p = PLANETS.find((x) => x.name === focus);
  return (
    <SimFrame
      dark
      caption={
        p ? (
          <span>
            <b>{p.name}</b>: {p.fact} One orbit = {p.years < 1 ? `${Math.round(p.years * 365)} days` : `${p.years} Earth years`}.
          </span>
        ) : (
          <span>Drag to turn the view. Planets nearer the Sun go round faster.</span>
        )
      }
      controls={
        <>
          <Slider label="Speed" value={speed} min={0.1} max={4} step={0.1} format={(v) => `1 year = ${round(1 / v, 1)} s`} onChange={setSpeed} />
          <div className="flex flex-wrap gap-1.5">
            {PLANETS.map((x) => (
              <button
                key={x.name}
                type="button"
                onClick={() => setFocus(x.name)}
                className={`rounded-xl px-2 py-1 text-xs font-black ${x.name === focus ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}
              >
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: hex(x.color) }} />
                {x.name}
              </button>
            ))}
          </div>
        </>
      }
    >
      {flat ? <SolarFlat years={years} highlight={focus} /> : <Solar3D speed={speed} focus={focus} onUnsupported={onUnsupported} />}
    </SimFrame>
  );
};

export function solarRound(): ChallengeRound {
  const facts = [
    { q: 'Which planet is closest to the Sun?', a: 'Mercury' },
    { q: 'Which is the largest planet?', a: 'Jupiter' },
    { q: 'Which planet is called the red planet?', a: 'Mars' },
    { q: 'Which planet is famous for its bright rings?', a: 'Saturn' },
    { q: 'Which is the hottest planet?', a: 'Venus' },
    { q: 'Which planet is farthest from the Sun?', a: 'Neptune' },
    { q: 'Which planet comes just after Earth (going outwards)?', a: 'Mars' },
    { q: 'Which planet takes about 12 Earth years to go round the Sun?', a: 'Jupiter' },
    { q: 'Which planet spins lying on its side?', a: 'Uranus' },
    { q: 'Which planet is called the morning star or evening star?', a: 'Venus' },
  ];
  const f = pick(facts);
  const { options, correct } = withOptions(
    f.a,
    PLANETS.map((p) => p.name)
      .filter((n) => n !== f.a)
      .sort(() => Math.random() - 0.5)
  );
  return {
    prompt: f.q,
    options,
    correct,
    explain: `${f.a}: ${PLANETS.find((p) => p.name === f.a)!.fact}`,
    visual: (revealed) => <SolarFlatAnimated highlight={revealed ? f.a : null} />,
  };
}

const SolarFlatAnimated: React.FC<{ highlight: string | null }> = ({ highlight }) => {
  const t = useClock(true);
  return <SolarFlat years={t * 0.4} highlight={highlight} />;
};

/* ================================ GLOBE ================================ */

// Rough outline of India (longitude, latitude) for orientation on the globe.
const INDIA: [number, number][] = [
  [68.2, 23.7], [70.0, 20.9], [72.8, 19.0], [73.8, 15.5], [75.0, 12.5], [76.3, 9.5], [77.5, 8.1], [78.2, 8.9], [79.9, 10.3], [80.3, 13.1],
  [80.2, 15.6], [82.3, 16.6], [85.0, 19.3], [86.9, 21.5], [88.6, 21.6], [88.2, 24.5], [88.0, 26.5], [89.8, 26.4], [92.0, 26.9], [95.5, 27.8],
  [97.0, 28.2], [96.0, 29.4], [91.6, 27.9], [88.8, 27.3], [84.0, 28.6], [80.3, 30.0], [79.0, 31.5], [78.8, 32.6], [77.8, 35.5], [74.5, 37.0],
  [73.9, 34.6], [74.6, 32.8], [74.5, 31.0], [73.4, 29.5], [70.0, 28.0], [69.5, 26.5], [70.5, 25.6], [68.2, 23.7],
];
export const HYDERABAD = { lat: 17.4, lon: 78.5 };

/** Orthographic projection: returns screen point and whether it faces us. */
function ortho(lon: number, lat: number, lon0: number, lat0: number, R: number, cx: number, cy: number): { x: number; y: number; front: boolean } {
  const l = rad(lon - lon0);
  const p = rad(lat);
  const p0 = rad(lat0);
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  return {
    x: cx + R * Math.cos(p) * Math.sin(l),
    y: cy - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)),
    front: cosc >= 0,
  };
}

function projectPath(points: [number, number][], lon0: number, lat0: number, R: number, cx: number, cy: number): string {
  let d = '';
  let pen = false;
  for (const [lon, lat] of points) {
    const q = ortho(lon, lat, lon0, lat0, R, cx, cy);
    if (!q.front) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'} ${q.x.toFixed(1)} ${q.y.toFixed(1)} `;
    pen = true;
  }
  return d;
}

const SPECIAL_LATS = [
  { lat: 0, name: 'Equator 0°', color: '#dc2626' },
  { lat: 23.5, name: 'Tropic of Cancer 23½° N', color: '#f59e0b' },
  { lat: -23.5, name: 'Tropic of Capricorn 23½° S', color: '#f59e0b' },
  { lat: 66.5, name: 'Arctic Circle 66½° N', color: '#0ea5e9' },
  { lat: -66.5, name: 'Antarctic Circle 66½° S', color: '#0ea5e9' },
];
const SPECIAL_LONS = [
  { lon: 0, name: 'Prime Meridian 0° (Greenwich)', color: '#16a34a' },
  { lon: 82.5, name: 'Indian Standard Meridian 82½° E', color: '#7c3aed' },
  { lon: 180, name: '180° (International Date Line)', color: '#64748b' },
];

const GlobeScene: React.FC<{ lon0: number; lat0: number; highlight?: string | null; marker?: { lon: number; lat: number; label: string } | null }> = ({ lon0, lat0, highlight, marker }) => {
  const R = 100;
  const cx = 130;
  const cy = 120;
  const range = (a: number, b: number, s: number) => Array.from({ length: Math.floor((b - a) / s) + 1 }, (_, i) => a + i * s);
  const latLine = (lat: number) => projectPath(range(-180, 180, 3).map((lon) => [lon, lat] as [number, number]), lon0, lat0, R, cx, cy);
  const lonLine = (lon: number) => projectPath(range(-90, 90, 3).map((lat) => [lon, lat] as [number, number]), lon0, lat0, R, cx, cy);
  const m = marker ? ortho(marker.lon, marker.lat, lon0, lat0, R, cx, cy) : null;
  return (
    <svg {...svgProps}>
      <defs>
        <radialGradient id="ocean" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0369a1" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="url(#ocean)" />
      {range(-60, 60, 30).map((lat) => (
        <path key={`lat${lat}`} d={latLine(lat)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      ))}
      {range(-180, 150, 30).map((lon) => (
        <path key={`lon${lon}`} d={lonLine(lon)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      ))}
      <path d={projectPath(INDIA, lon0, lat0, R, cx, cy)} fill="#86efac" stroke="#166534" strokeWidth={1.5} />
      {SPECIAL_LATS.map((l) => (
        <path key={l.name} d={latLine(l.lat)} fill="none" stroke={l.color} strokeWidth={highlight === l.name ? 4 : 2} strokeDasharray={l.lat ? '5 3' : undefined} opacity={!highlight || highlight === l.name ? 1 : 0.35} />
      ))}
      {SPECIAL_LONS.map((l) => (
        <path key={l.name} d={lonLine(l.lon)} fill="none" stroke={l.color} strokeWidth={highlight === l.name ? 4 : 2} opacity={!highlight || highlight === l.name ? 1 : 0.35} />
      ))}
      {m && m.front && (
        <g>
          <motion.circle cx={m.x} cy={m.y} r={9} fill="none" stroke="#facc15" strokeWidth={2} animate={{ r: [5, 12, 5], opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
          <circle cx={m.x} cy={m.y} r={3.5} fill="#dc2626" stroke="white" />
        </g>
      )}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#0c4a6e" strokeWidth={2} />
      <g transform="translate(250 20)">
        {[...SPECIAL_LATS, ...SPECIAL_LONS].map((l, i) => (
          <g key={l.name} transform={`translate(0 ${i * 17})`} opacity={!highlight || highlight === l.name ? 1 : 0.4}>
            <rect width={12} height={4} y={5} fill={l.color} />
            <text x={16} y={11} fontSize={8.5} fontWeight={800} fill="#334155">{l.name}</text>
          </g>
        ))}
        {marker && (
          <g transform={`translate(0 ${8 * 17 + 4})`}>
            <circle cx={6} cy={7} r={4} fill="#dc2626" />
            <text x={16} y={11} fontSize={9} fontWeight={900} fill="#334155">{marker.label}</text>
          </g>
        )}
      </g>
    </svg>
  );
};

const fmtTime = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
};

export const GlobeExplore: React.FC<SimProps> = () => {
  const [spin, setSpin] = useState(true);
  const [lonManual, setLonManual] = useState(78);
  const [tilt, setTilt] = useState(20);
  const [place, setPlace] = useState(78.5);
  const t = useClock(spin);
  // Earth turns west to east, so the longitude facing us goes down as time passes.
  const lon0 = spin ? ((((lonManual - t * 25 + 180) % 360) + 360) % 360) - 180 : lonManual;
  const diff = place * 4; // minutes ahead of Greenwich
  return (
    <SimFrame
      caption={
        <span>
          Earth turns 360° in 24 hours = 15° an hour = 1° every 4 minutes. At {round(Math.abs(place), 1)}° {place >= 0 ? 'E' : 'W'}, local time is {Math.round(Math.abs(diff))} min {diff >= 0 ? 'ahead of' : 'behind'} Greenwich: noon at Greenwich = {fmtTime(720 + diff)} there. IST (82½° E) = noon + 5 h 30 min = 5:30 pm.
        </span>
      }
      controls={
        <>
          <Toggle options={[{ id: 'spin', label: '🌍 Spin' }, { id: 'stop', label: '⏸ Stop' }]} value={spin ? 'spin' : 'stop'} onChange={(v) => { if (v === 'stop') setLonManual(Math.round(lon0)); setSpin(v === 'spin'); }} />
          <Slider label="Turn (centre longitude)" value={Math.round(lon0)} min={-180} max={180} unit="°" onChange={(v) => { setSpin(false); setLonManual(v); }} />
          <Slider label="Tilt" value={tilt} min={-60} max={60} unit="°" onChange={setTilt} />
          <Slider label="A place at longitude" value={place} min={-180} max={180} step={0.5} unit="°" onChange={setPlace} />
        </>
      }
    >
      <GlobeScene lon0={lon0} lat0={tilt} marker={{ ...HYDERABAD, label: 'Hyderabad 17.4° N, 78.5° E' }} />
    </SimFrame>
  );
};

export function globeRound(): ChallengeRound {
  const facts = [
    { q: 'What is the latitude of the Equator?', right: '0°', wrong: ['90° N', '23½° N', '180°'], hl: 'Equator 0°', look: [78, 10] },
    { q: 'The Tropic of Cancer is at…', right: '23½° N', wrong: ['66½° N', '23½° S', '0°'], hl: 'Tropic of Cancer 23½° N', look: [78, 20] },
    { q: 'Which line of longitude passes through Greenwich?', right: 'Prime Meridian (0°)', wrong: ['Equator', '82½° E', '180°'], hl: 'Prime Meridian 0° (Greenwich)', look: [0, 20] },
    { q: 'Indian Standard Time is taken from which meridian?', right: '82½° E', wrong: ['0°', '78½° E', '90° E'], hl: 'Indian Standard Meridian 82½° E', look: [82, 15] },
    { q: 'How much time does the Earth take to turn through 1° of longitude?', right: '4 minutes', wrong: ['1 hour', '15 minutes', '1 minute'], hl: null, look: [78, 20] },
    { q: 'It is 12 noon at Greenwich. What time is it in India (IST)?', right: '5:30 pm', wrong: ['6:30 am', '12 midnight', '5:30 am'], hl: 'Indian Standard Meridian 82½° E', look: [40, 20] },
    { q: 'Hyderabad is at about 17° N, 78° E. In which hemispheres is it?', right: 'Northern and Eastern', wrong: ['Southern and Eastern', 'Northern and Western', 'Southern and Western'], hl: null, look: [78, 20] },
    { q: 'Which latitude line passes through the middle of India?', right: 'Tropic of Cancer', wrong: ['Equator', 'Arctic Circle', 'Tropic of Capricorn'], hl: 'Tropic of Cancer 23½° N', look: [78, 20] },
  ];
  const f = pick(facts);
  const { options, correct } = withOptions(f.right, f.wrong);
  return {
    prompt: f.q,
    options,
    correct,
    explain: f.right.startsWith('5:30') ? 'India is 82½° east: 82.5 × 4 min = 330 min = 5 h 30 min ahead of Greenwich.' : `${f.right}.`,
    visual: (revealed) => <GlobeScene lon0={f.look[0]} lat0={f.look[1]} highlight={revealed ? f.hl : null} marker={{ ...HYDERABAD, label: 'Hyderabad' }} />,
  };
}

/* =============================== SEASONS ============================== */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Sun's declination (degrees) on day-of-year n (1-365), the usual approximation. */
export function declination(n: number): number {
  return 23.44 * Math.sin(rad((360 / 365) * (n + 284)));
}

/** Hours of daylight at a latitude when the Sun's declination is `decl`. */
export function dayLength(lat: number, decl: number): number {
  const x = -Math.tan(rad(lat)) * Math.tan(rad(decl));
  if (x <= -1) return 24;
  if (x >= 1) return 0;
  return (2 * deg(Math.acos(x))) / 15;
}

const dateOf = (n: number) => {
  let m = 11;
  while (m > 0 && MONTH_START[m] >= n) m--;
  return `${n - MONTH_START[m]} ${MONTHS[m]}`;
};

const SeasonScene: React.FC<{ day: number }> = ({ day }) => {
  // Orbit seen from slightly above. Angle 0 (right) = 21 June: northern summer, axis tilted towards the Sun.
  const cx = 200;
  const cy = 118;
  const rx = 150;
  const ry = 62;
  const a = rad(((day - 172) / 365) * 360);
  const ex = cx + Math.cos(a) * rx;
  const ey = cy + Math.sin(a) * ry;
  const decl = declination(day);
  // The axis always leans the same way in space: towards the Sun on 21 June (Earth on the right).
  const tilt = 23.5;
  const sunSide = Math.atan2(cy - ey, cx - ex); // direction from Earth to Sun
  return (
    <svg {...svgProps}>
      <rect width={W} height={H} fill="#0b1120" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#334155" strokeDasharray="4 4" />
      {[
        { d: 172, l: '21 Jun' },
        { d: 266, l: '23 Sep' },
        { d: 356, l: '22 Dec' },
        { d: 80, l: '21 Mar' },
      ].map((m) => {
        const aa = rad(((m.d - 172) / 365) * 360);
        return (
          <text key={m.l} x={cx + Math.cos(aa) * (rx + 22)} y={cy + Math.sin(aa) * (ry + 16) + 4} fontSize={9} fontWeight={800} textAnchor="middle" fill="#94a3b8">
            {m.l}
          </text>
        );
      })}
      <motion.circle cx={cx} cy={cy} r={22} fill="#facc15" animate={{ r: [21, 23, 21] }} transition={{ duration: 2, repeat: Infinity }} />
      <circle cx={cx} cy={cy} r={34} fill="#facc15" opacity={0.15} />
      <g transform={`translate(${ex} ${ey})`}>
        <circle r={17} fill="#1e3a8a" />
        {/* day half faces the Sun */}
        <path d={`M ${Math.cos(sunSide + Math.PI / 2) * 17} ${Math.sin(sunSide + Math.PI / 2) * 17} A 17 17 0 0 0 ${Math.cos(sunSide - Math.PI / 2) * 17} ${Math.sin(sunSide - Math.PI / 2) * 17} Z`} fill="#60a5fa" />
        <g transform={`rotate(${-tilt})`}>
          <line x1={0} y1={-26} x2={0} y2={26} stroke="#f8fafc" strokeWidth={1.5} />
          <ellipse rx={17} ry={4} fill="none" stroke="#fca5a5" strokeWidth={1} />
          <text x={0} y={-29} fontSize={8} fontWeight={900} textAnchor="middle" fill="#f8fafc">N</text>
        </g>
      </g>
      <text x={10} y={18} fontSize={12} fontWeight={900} fill="#f8fafc">{dateOf(day)}</text>
      <text x={10} y={34} fontSize={10} fontWeight={800} fill="#fde68a">
        Sun overhead at {round(Math.abs(decl), 1)}° {decl >= 0 ? 'N' : 'S'}
      </text>
    </svg>
  );
};

export function seasonInIndia(day: number): string {
  if (day >= 60 && day < 152) return 'Summer (hot season)';
  if (day >= 152 && day < 274) return 'Rainy season (south-west monsoon)';
  if (day >= 274 && day < 335) return 'Retreating monsoon (autumn)';
  return 'Winter (cold season)';
}

export const SeasonsExplore: React.FC<SimProps> = () => {
  const [play, setPlay] = useState(true);
  const [manual, setManual] = useState(172);
  const t = useClock(play);
  const day = play ? Math.floor(((manual - 1 + t * 30) % 365) + 1) : manual;
  const decl = declination(day);
  const hyd = HYDERABAD.lat;
  const noonAlt = 90 - Math.abs(hyd - decl);
  return (
    <SimFrame
      dark
      caption={
        <span>
          Earth's axis is tilted 23½° and always points the same way, so through the year each hemisphere leans towards the Sun and then away. Hyderabad on {dateOf(day)}: day length{' '}
          <b>{round(dayLength(hyd, decl), 1)} h</b>, noon Sun {round(noonAlt, 0)}° high · {seasonInIndia(day)}
        </span>
      }
      controls={
        <>
          <Toggle options={[{ id: 'play', label: '▶ Orbit' }, { id: 'stop', label: '⏸ Stop' }]} value={play ? 'play' : 'stop'} onChange={(v) => { if (v === 'stop') setManual(day); setPlay(v === 'play'); }} />
          <Slider label="Day of the year" value={day} min={1} max={365} format={(v) => dateOf(v)} onChange={(v) => { setPlay(false); setManual(v); }} />
        </>
      }
    >
      <SeasonScene day={day} />
    </SimFrame>
  );
};

export function seasonsRound(): ChallengeRound {
  const facts = [
    { q: 'On 21 June the Sun is overhead at…', right: 'Tropic of Cancer', wrong: ['Equator', 'Tropic of Capricorn', 'North Pole'], day: 172 },
    { q: 'On 22 December the Sun is overhead at…', right: 'Tropic of Capricorn', wrong: ['Tropic of Cancer', 'Equator', 'Arctic Circle'], day: 356 },
    { q: 'On 21 March and 23 September, day and night are equal everywhere. These days are called…', right: 'Equinoxes', wrong: ['Solstices', 'Eclipses', 'Monsoons'], day: 80 },
    { q: 'Which is the longest day in the Northern Hemisphere?', right: '21 June', wrong: ['22 December', '21 March', '23 September'], day: 172 },
    { q: 'What causes the seasons?', right: 'The tilt of Earth’s axis as it goes round the Sun', wrong: ['Earth going nearer and farther from the Sun', 'Clouds covering the Sun', 'The Moon’s shadow'], day: 266 },
    { q: 'How long does the Earth take to go once round the Sun?', right: 'About 365¼ days', wrong: ['24 hours', '30 days', '100 days'], day: 1 },
    { q: 'When it is summer in India (21 June), what season is it in Australia?', right: 'Winter', wrong: ['Summer', 'Spring', 'The rainy season'], day: 172 },
  ];
  const f = pick(facts);
  const { options, correct } = withOptions(f.right, f.wrong);
  return {
    prompt: f.q,
    options,
    correct,
    explain: `${f.right}. On ${dateOf(f.day)} the Sun is overhead at ${round(Math.abs(declination(f.day)), 1)}° ${declination(f.day) >= 0 ? 'N' : 'S'}; Hyderabad gets ${round(dayLength(HYDERABAD.lat, declination(f.day)), 1)} h of daylight.`,
    visual: (revealed) => <SeasonScene day={revealed ? f.day : 120} />,
  };
}

/* ============================== TIMELINES ============================= */

export interface TimelineEvent {
  year: number;
  date?: string;
  title: string;
  detail: string;
  emoji: string;
}

export const FREEDOM_EVENTS: TimelineEvent[] = [
  { year: 1857, title: 'Revolt of 1857', detail: 'The first big uprising against British rule, from Meerut to Delhi, Kanpur, Lucknow and Jhansi.', emoji: '⚔️' },
  { year: 1885, date: '28 Dec', title: 'Indian National Congress founded', detail: 'First session in Bombay, with W. C. Bonnerjee as president.', emoji: '🏛️' },
  { year: 1905, title: 'Partition of Bengal', detail: 'Lord Curzon divided Bengal; people answered with the Swadeshi movement and boycott of British goods.', emoji: '✂️' },
  { year: 1906, title: 'Muslim League founded', detail: 'Formed at Dhaka.', emoji: '🏛️' },
  { year: 1915, title: 'Gandhiji returns to India', detail: 'Back from South Africa, where he first used satyagraha.', emoji: '🚢' },
  { year: 1917, title: 'Champaran Satyagraha', detail: 'Gandhiji’s first satyagraha in India, for indigo farmers in Bihar.', emoji: '🌿' },
  { year: 1919, date: '13 Apr', title: 'Jallianwala Bagh massacre', detail: 'General Dyer’s troops fired on a peaceful crowd in Amritsar protesting the Rowlatt Act.', emoji: '🕯️' },
  { year: 1920, title: 'Non-Cooperation Movement', detail: 'Boycott of British schools, courts, councils and cloth; withdrawn in 1922 after Chauri Chaura.', emoji: '🚫' },
  { year: 1928, title: '“Simon, go back!”', detail: 'The all-British Simon Commission was boycotted across India.', emoji: '✋' },
  { year: 1929, date: 'Dec', title: 'Purna Swaraj resolution', detail: 'At the Lahore session, Congress demanded complete independence; 26 January 1930 was celebrated as Independence Day.', emoji: '🇮🇳' },
  { year: 1930, date: '12 Mar', title: 'Dandi March (Salt Satyagraha)', detail: 'Gandhiji walked 24 days from Sabarmati to Dandi and made salt, breaking the salt law: the Civil Disobedience Movement.', emoji: '🧂' },
  { year: 1931, date: '23 Mar', title: 'Bhagat Singh, Rajguru and Sukhdev hanged', detail: 'The young revolutionaries became symbols of courage.', emoji: '🔥' },
  { year: 1935, title: 'Government of India Act', detail: 'Gave provinces elected governments (elections in 1937).', emoji: '📜' },
  { year: 1942, date: '8 Aug', title: 'Quit India Movement', detail: '“Do or die!” — Congress demanded the British leave India at once.', emoji: '📣' },
  { year: 1943, date: 'Oct', title: 'Azad Hind government', detail: 'Subhas Chandra Bose led the Indian National Army: “Delhi chalo!”', emoji: '🎖️' },
  { year: 1946, title: 'Cabinet Mission and naval revolt', detail: 'British plan for a free India; sailors of the Royal Indian Navy rose in Bombay.', emoji: '⚓' },
  { year: 1947, date: '15 Aug', title: 'Independence and Partition', detail: 'India became free; the country was divided into India and Pakistan.', emoji: '🎉' },
  { year: 1950, date: '26 Jan', title: 'Constitution comes into force', detail: 'India became a Republic.', emoji: '📘' },
];

export const TELANGANA_EVENTS: TimelineEvent[] = [
  { year: 1948, date: '17 Sep', title: 'Hyderabad joins India', detail: 'After Operation Polo, Hyderabad State became part of the Indian Union.', emoji: '🤝' },
  { year: 1952, title: 'Mulki agitation', detail: 'Students in Hyderabad demanded jobs for local people (“Non-Mulki go back”).', emoji: '✊' },
  { year: 1953, title: 'States Reorganisation Commission', detail: 'The Fazal Ali Commission (report 1955) suggested keeping Telangana separate for some years.', emoji: '📝' },
  { year: 1956, date: '1 Nov', title: 'Andhra Pradesh formed', detail: 'Telangana was merged with Andhra State after the Gentlemen’s Agreement (Feb 1956) promised safeguards.', emoji: '🗺️' },
  { year: 1969, title: 'Jai Telangana movement', detail: 'A huge students’ and people’s agitation for a separate state; the Telangana Praja Samithi was formed.', emoji: '📢' },
  { year: 1973, title: 'Six-Point Formula', detail: 'A plan for regional fairness in jobs and education.', emoji: '6️⃣' },
  { year: 1985, title: 'G.O. 610', detail: 'Government order to give local jobs back to local people.', emoji: '📄' },
  { year: 2001, date: '27 Apr', title: 'TRS founded', detail: 'K. Chandrashekar Rao founded the Telangana Rashtra Samithi to win statehood.', emoji: '🚩' },
  { year: 2009, date: '9 Dec', title: 'Centre announces process', detail: 'After KCR’s fast, the Union Government announced the formation of Telangana would begin.', emoji: '📰' },
  { year: 2010, date: '30 Dec', title: 'Srikrishna Committee report', detail: 'The committee studying the demand submitted its report.', emoji: '📚' },
  { year: 2011, title: 'Million March and Sakala Janula Samme', detail: 'Mass marches in Hyderabad and a general strike of all sections of people.', emoji: '👣' },
  { year: 2014, date: '2 Jun', title: 'Telangana State formed', detail: 'After the AP Reorganisation Act (Feb 2014), Telangana became India’s 29th state; Hyderabad its capital.', emoji: '🎉' },
];

export const TIMELINES: Record<string, { title: string; events: TimelineEvent[] }> = {
  freedom: { title: 'The National Movement', events: FREEDOM_EVENTS },
  telangana: { title: 'Formation of Telangana', events: TELANGANA_EVENTS },
};

const TimelineScene: React.FC<{ events: TimelineEvent[]; year: number; focus?: TimelineEvent | null; hideYear?: boolean; showCard?: boolean }> = ({
  events,
  year,
  focus,
  hideYear,
  showCard = true,
}) => {
  const first = events[0].year;
  const last = events[events.length - 1].year;
  const x = (y: number) => 24 + ((y - first) / Math.max(1, last - first)) * (W - 48);
  const shown = showCard ? focus ?? [...events].reverse().find((e) => e.year <= year) ?? null : null;
  return (
    <svg {...svgProps}>
      <rect width={W} height={H} fill="#fffbeb" />
      <line x1={x(first)} x2={x(last)} y1={170} y2={170} stroke="#d6d3d1" strokeWidth={6} strokeLinecap="round" />
      <motion.line x1={x(first)} y1={170} y2={170} initial={false} animate={{ x2: x(clamp(year, first, last)) }} stroke="#f59e0b" strokeWidth={6} strokeLinecap="round" />
      {events.map((e, i) => {
        const done = e.year <= year;
        const on = shown === e;
        return (
          <g key={`${e.year}-${i}`}>
            <motion.circle cx={x(e.year)} cy={170} initial={false} animate={{ r: on ? 9 : done ? 6 : 4 }} fill={on ? '#dc2626' : done ? '#f59e0b' : '#a8a29e'} stroke="white" strokeWidth={2} />
            {(i === 0 || i === events.length - 1 || on) && !(hideYear && on) && (
              <text x={x(e.year)} y={on ? 158 : 194} fontSize={on ? 11 : 9} fontWeight={800} textAnchor="middle" fill={on ? '#b91c1c' : '#78716c'}>
                {e.year}
              </text>
            )}
          </g>
        );
      })}
      <AnimatePresence mode="wait">
        {shown && (
          <motion.g key={shown.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <rect x={20} y={14} width={W - 40} height={118} rx={14} fill="white" stroke="#fcd34d" strokeWidth={2} />
            <text x={40} y={58} fontSize={34}>{shown.emoji}</text>
            <text x={88} y={40} fontSize={13} fontWeight={900} fill="#b45309">{hideYear ? '????' : `${shown.date ? shown.date + ' ' : ''}${shown.year}`}</text>
            <text x={88} y={58} fontSize={13} fontWeight={900} fill="#1c1917">{shown.title}</text>
            <foreignObject x={40} y={66} width={W - 80} height={62}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#44403c', lineHeight: 1.35, margin: 0 }}>{shown.detail}</p>
            </foreignObject>
          </motion.g>
        )}
      </AnimatePresence>
      <text x={W / 2} y={224} fontSize={22} fontWeight={900} textAnchor="middle" fill="#92400e" opacity={0.25}>
        {hideYear ? '' : Math.round(year)}
      </text>
    </svg>
  );
};

export const TimelineExplore: React.FC<SimProps> = ({ variant }) => {
  const tl = TIMELINES[variant || 'freedom'] || TIMELINES.freedom;
  const first = tl.events[0].year;
  const last = tl.events[tl.events.length - 1].year;
  const [playing, setPlaying] = useState(true);
  const [manual, setManual] = useState(first);
  const t = useClock(playing);
  const startRef = useRef<{ base: number; at: number }>({ base: first, at: 0 });
  const yearsPerSecond = (last - first) / 40;
  const year = playing ? Math.min(last, startRef.current.base + (t - startRef.current.at) * yearsPerSecond) : manual;
  useEffect(() => {
    if (playing && year >= last) {
      setPlaying(false);
      setManual(last);
    }
  }, [playing, year, last]);
  return (
    <SimFrame
      caption={<span>{tl.title}: {tl.events.length} key events from {first} to {last}. Drag the year or press play.</span>}
      controls={
        <>
          <ChunkyButton
            color="amber"
            className="!px-3 !py-2 text-sm"
            onClick={() => {
              if (playing) {
                setManual(Math.round(year));
                setPlaying(false);
              } else {
                startRef.current = { base: manual >= last ? first : manual, at: t };
                setPlaying(true);
              }
            }}
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </ChunkyButton>
          <Slider label="Year" value={Math.round(year)} min={first} max={last} onChange={(v) => { setPlaying(false); setManual(v); }} />
          <div className="flex flex-wrap gap-1">
            {tl.events.map((e) => (
              <button key={`${e.year}-${e.title}`} type="button" onClick={() => { setPlaying(false); setManual(e.year); }} className="rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-black text-amber-800">
                {e.year}
              </button>
            ))}
          </div>
        </>
      }
    >
      <TimelineScene events={tl.events} year={year} />
    </SimFrame>
  );
};

export function timelineRound(variant?: string): ChallengeRound {
  const tl = TIMELINES[variant || 'freedom'] || TIMELINES.freedom;
  const events = tl.events;
  const kind = pick(['year', 'what', 'order']);
  const e = pick(events);
  if (kind === 'order') {
    let other = pick(events);
    while (other.year === e.year) other = pick(events);
    const firstEv = e.year < other.year ? e : other;
    const options = [e.title, other.title];
    return {
      prompt: 'Which of these happened first?',
      options,
      correct: options.indexOf(firstEv.title),
      explain: `${firstEv.title} (${firstEv.year}) came before ${(firstEv === e ? other : e).title} (${(firstEv === e ? other : e).year}).`,
      visual: (revealed) => <TimelineScene events={events} year={revealed ? Math.max(e.year, other.year) : events[0].year} focus={revealed ? firstEv : null} showCard={revealed} />,
    };
  }
  if (kind === 'what') {
    const wrong = events.filter((x) => x.year !== e.year).map((x) => x.title).sort(() => Math.random() - 0.5);
    const { options, correct } = withOptions(e.title, wrong);
    return {
      prompt: `What happened in ${e.date ? e.date + ' ' : ''}${e.year}?`,
      options,
      correct,
      explain: `${e.year}: ${e.title}. ${e.detail}`,
      visual: (revealed) => <TimelineScene events={events} year={e.year} focus={revealed ? e : null} showCard={revealed} />,
    };
  }
  const wrongYears = Array.from(new Set(events.filter((x) => x.year !== e.year).map((x) => String(x.year)))).sort(() => Math.random() - 0.5);
  const { options, correct } = withOptions(String(e.year), wrongYears);
  return {
    prompt: `In which year: ${e.title}?`,
    options,
    correct,
    explain: `${e.date ? e.date + ' ' : ''}${e.year}. ${e.detail}`,
    visual: (revealed) => <TimelineScene events={events} year={revealed ? e.year : events[0].year} focus={e} hideYear={!revealed} />,
  };
}
