import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { soundEffects } from '../../../services/soundEffects';
import { ChunkyButton, Feedback, GameProps, RoundDots, shuffle } from '../ui';

const ROUNDS = 5;

interface ShapeDef {
  id: string;
  name: string;
  emoji: string;
  hint: string;
  color: number;
  make: () => THREE.BufferGeometry;
  edges: boolean;
}

const SHAPES: ShapeDef[] = [
  { id: 'cube', name: 'Cube', emoji: '🎲', hint: 'like a dice', color: 0xf59e0b, make: () => new THREE.BoxGeometry(1.5, 1.5, 1.5), edges: true },
  { id: 'cuboid', name: 'Cuboid', emoji: '🧱', hint: 'like a brick', color: 0xef4444, make: () => new THREE.BoxGeometry(2.3, 1.1, 1.1), edges: true },
  { id: 'sphere', name: 'Sphere', emoji: '⚽', hint: 'like a ball', color: 0x3b82f6, make: () => new THREE.SphereGeometry(1.15, 48, 32), edges: false },
  { id: 'cylinder', name: 'Cylinder', emoji: '🥫', hint: 'like a tin', color: 0x10b981, make: () => new THREE.CylinderGeometry(0.85, 0.85, 1.9, 48), edges: false },
  { id: 'cone', name: 'Cone', emoji: '🍦', hint: 'like an ice-cream cone', color: 0xec4899, make: () => new THREE.ConeGeometry(1.05, 2, 48), edges: false },
  { id: 'pyramid', name: 'Pyramid', emoji: '🔺', hint: 'like the pyramids of Egypt', color: 0xa855f7, make: () => new THREE.ConeGeometry(1.25, 1.8, 4), edges: true },
];

// A spinning, drag-to-rotate WebGL view of one shape.
const ShapeViewer: React.FC<{ shape: ShapeDef; onUnsupported: () => void }> = ({ shape, onUnsupported }) => {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onUnsupported();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.6, 6);
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff1c2, 0.6);
    rim.position.set(-4, -2, -3);
    scene.add(rim);

    const geometry = shape.make();
    const material = new THREE.MeshStandardMaterial({ color: shape.color, roughness: 0.35, metalness: 0.1, flatShading: shape.edges });
    const mesh = new THREE.Mesh(geometry, material);
    const group = new THREE.Group();
    group.add(mesh);
    let edgeGeometry: THREE.EdgesGeometry | null = null;
    let edgeMaterial: THREE.LineBasicMaterial | null = null;
    if (shape.edges) {
      edgeGeometry = new THREE.EdgesGeometry(geometry);
      edgeMaterial = new THREE.LineBasicMaterial({ color: 0x1c1917 });
      group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
    }
    group.rotation.set(0.5, 0.6, 0);
    scene.add(group);

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

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let velocityX = 0.012;
    let velocityY = 0.006;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      velocityY = (e.clientX - lastX) * 0.01;
      velocityX = (e.clientY - lastY) * 0.01;
      group.rotation.y += velocityY;
      group.rotation.x += velocityX;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);

    let frame = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      if (!dragging) {
        velocityX += (0.006 - velocityX) * 0.03;
        velocityY += (0.012 - velocityY) * 0.03;
        group.rotation.x += velocityX;
        group.rotation.y += velocityY;
      }
      group.position.y = Math.sin(t * 1.6) * 0.12;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      edgeGeometry?.dispose();
      edgeMaterial?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [shape, onUnsupported]);

  return <div ref={host} className="h-full w-full cursor-grab active:cursor-grabbing" aria-label={`A 3D ${shape.name}`} />;
};

export const Shapes3DGame: React.FC<GameProps> = ({ onFinish, onMascot }) => {
  const order = useMemo(() => shuffle(SHAPES).slice(0, ROUNDS), []);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [missed, setMissed] = useState(false);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [noWebGL, setNoWebGL] = useState(false);
  const shape = order[round];
  const options = useMemo(
    () => shuffle([shape, ...shuffle(SHAPES.filter((s) => s.id !== shape.id)).slice(0, 2)]),
    [shape]
  );
  const unsupported = useMemo(() => () => setNoWebGL(true), []);

  useEffect(() => {
    onMascot('Spin the shape with your finger. What is it called?', 'think');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const choose = (id: string) => {
    if (solved) return;
    if (id === shape.id) {
      soundEffects.playCorrect();
      setSolved(true);
      setFeedback('correct');
      onMascot(`Yes! A ${shape.name.toLowerCase()} — ${shape.hint}!`, 'cheer');
      const next = [...results, !missed];
      setResults(next);
      window.setTimeout(() => {
        setFeedback(null);
        if (round + 1 >= ROUNDS) {
          onFinish(next.filter(Boolean).length, ROUNDS);
          return;
        }
        setRound((r) => r + 1);
        setSolved(false);
        setMissed(false);
      }, 1500);
    } else {
      soundEffects.playTryAgain();
      setMissed(true);
      setFeedback('wrong');
      onMascot('Look at its faces and edges again!', 'sad');
      window.setTimeout(() => setFeedback(null), 900);
    }
  };

  return (
    <div className="relative">
      <Feedback state={feedback} />
      <div className="mb-3 flex items-center justify-between">
        <RoundDots total={ROUNDS} current={round} results={results} />
        <span className="text-xs font-black text-stone-500">Round {round + 1} / {ROUNDS}</span>
      </div>
      <div data-shape={shape.id} id="shape-stage" className="card-3d relative mx-auto h-64 max-w-md overflow-hidden rounded-[2rem] border-4 border-violet-200 bg-[radial-gradient(circle_at_50%_40%,#faf5ff,#ede9fe_60%,#ddd6fe)] sm:h-72">
        {noWebGL ? (
          <div className="flex h-full items-center justify-center text-8xl float-slow">{shape.emoji}</div>
        ) : (
          <ShapeViewer key={shape.id} shape={shape} onUnsupported={unsupported} />
        )}
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-black text-violet-700">
          👆 Drag to spin
        </span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <ChunkyButton
            key={option.id}
            color={solved && option.id === shape.id ? 'emerald' : 'white'}
            onClick={() => choose(option.id)}
            disabled={solved}
            className="shape-option text-lg"
          >
            {option.emoji} {option.name}
          </ChunkyButton>
        ))}
      </div>
    </div>
  );
};
