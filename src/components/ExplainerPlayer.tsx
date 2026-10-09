import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import { ChapterExplainer, ExplainerItem, ExplainerScene, ExplainerVisual } from '../data/explainer';
import { Language } from '../types';
import { backendApi } from '../services/backendApi';
import { kidSpeech } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import { CountingScene } from './learnplay/CountingScene';

// The animated explainer of a textbook chapter: scene by scene, each drawn
// from an animation template (counting for maths; cycles, parts, sorting,
// before→after, words for EVS and language) and narrated aloud, then a quick
// check. Opened with openExplainer() from the chapter list, the workbook's
// Lesson step, or the teacher's Teaching materials (to show in class).

export const OPEN_EXPLAINER_EVENT = 'pathana:open-explainer';
export type ExplainerTarget = { readingId: string; chapterTitle: string };
export function openExplainer(target: ExplainerTarget) {
  window.dispatchEvent(new CustomEvent<ExplainerTarget>(OPEN_EXPLAINER_EVENT, { detail: target }));
}

const toLanguage = (l: string): Language => (l === 'Telugu' || l === 'Hindi' ? l : 'English');

/** Steps through 0..n-1 every `ms`, for the cycle / sequence / sort / parts scenes. */
function useStepper(n: number, ms = 1100) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const t = window.setInterval(() => setI((x) => (x + 1) % (n + 2)), ms);
    return () => window.clearInterval(t);
  }, [n, ms]);
  return Math.min(i, n);
}

const Tile: React.FC<{ item: ExplainerItem; active?: boolean; big?: boolean }> = ({ item, active, big }) => (
  <motion.div
    initial={{ scale: 0.4, opacity: 0 }}
    animate={{ scale: active ? 1.12 : 1, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
    className={`flex flex-col items-center rounded-2xl border-2 bg-white px-2 py-1.5 text-center shadow-sm ${active ? 'border-amber-400 ring-4 ring-amber-200' : 'border-stone-100'}`}
  >
    <span className={big ? 'text-6xl' : 'text-4xl'}>{item.emoji}</span>
    <span className="mt-0.5 max-w-[7rem] text-xs font-black leading-tight text-stone-800">{item.label}</span>
  </motion.div>
);

const Arrow: React.FC<{ on: boolean }> = ({ on }) => (
  <motion.span animate={{ opacity: on ? 1 : 0.25, x: on ? [0, 4, 0] : 0 }} transition={{ duration: 0.6 }} className="text-2xl font-black text-amber-500">
    ➜
  </motion.span>
);

const Visual: React.FC<{ visual: ExplainerVisual }> = ({ visual }) => {
  const count =
    visual.kind === 'cycle' || visual.kind === 'sequence'
      ? visual.steps.length
      : visual.kind === 'parts'
        ? visual.parts.length
        : visual.kind === 'sort'
          ? visual.groups.reduce((n, g) => n + g.items.length, 0)
          : 2;
  const step = useStepper(count);
  switch (visual.kind) {
    case 'count':
      return (
        <div className="relative h-full w-full">
          <CountingScene spec={visual.spec} />
        </div>
      );
    case 'fact':
      return (
        <motion.div initial={{ scale: 0.3, rotate: -10 }} animate={{ scale: [1, 1.08, 1], rotate: 0 }} transition={{ duration: 1.6, repeat: Infinity }} className="text-[7rem] leading-none drop-shadow">
          {visual.emoji}
        </motion.div>
      );
    case 'word':
      return (
        <div className="flex flex-col items-center gap-2">
          <motion.span initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-7xl">
            {visual.emoji}
          </motion.span>
          <div className="flex flex-wrap justify-center gap-1">
            {Array.from(visual.word).map((ch, i) => (
              <motion.span key={i} initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.12 }} className="rounded-lg bg-amber-300 px-2 py-1 text-3xl font-black text-amber-950">
                {ch}
              </motion.span>
            ))}
          </div>
          {visual.meaning && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + visual.word.length * 0.12 }} className="max-w-xs text-center text-sm font-bold text-stone-700">
              {visual.meaning}
            </motion.p>
          )}
        </div>
      );
    case 'compare':
      return (
        <div className="flex items-center gap-4">
          <motion.div initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <Tile item={visual.left} big active={step % 2 === 0} />
          </motion.div>
          <span className="rounded-full bg-stone-800 px-3 py-1 text-sm font-black text-white">vs</span>
          <motion.div initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <Tile item={visual.right} big active={step % 2 === 1} />
          </motion.div>
        </div>
      );
    case 'sequence':
      return (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {visual.steps.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Arrow on={step >= i} />}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: step >= i ? 1 : 0.25, y: 0 }} transition={{ delay: i * 0.15 }}>
                <Tile item={s} active={step === i} />
              </motion.div>
            </React.Fragment>
          ))}
        </div>
      );
    case 'cycle': {
      const n = visual.steps.length;
      const r = 105;
      return (
        <div className="relative h-[280px] w-[280px]">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} className="absolute inset-[38px] rounded-full border-4 border-dashed border-sky-300" />
          {visual.steps.map((s, i) => {
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            return (
              <div key={i} className="absolute" style={{ left: 140 + r * Math.cos(angle), top: 140 + r * Math.sin(angle), transform: 'translate(-50%, -50%)' }}>
                <Tile item={s} active={step % n === i} />
              </div>
            );
          })}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl">🔄</span>
        </div>
      );
    }
    case 'parts': {
      const n = visual.parts.length;
      return (
        <div className="relative h-[280px] w-[300px]">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Tile item={visual.center} big />
          </div>
          {visual.parts.map((p, i) => {
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            const x = 150 + 118 * Math.cos(angle);
            const y = 140 + 108 * Math.sin(angle);
            return (
              <motion.div key={i} className="absolute" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }} initial={{ scale: 0 }} animate={{ scale: step >= i ? 1 : 0 }}>
                <Tile item={p} active={step === i} />
              </motion.div>
            );
          })}
        </div>
      );
    }
    case 'sort': {
      let k = 0;
      return (
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          {visual.groups.map((g, gi) => (
            <div key={gi} className={`min-h-[170px] rounded-3xl border-4 border-dashed p-2 ${gi === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-sky-300 bg-sky-50'}`}>
              <p className="mb-1 text-center text-sm font-black text-stone-800">🧺 {g.label}</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {g.items.map((it, i) => {
                  const order = k++;
                  return (
                    <motion.div key={i} initial={{ y: -60, opacity: 0 }} animate={{ y: step > order ? 0 : -60, opacity: step > order ? 1 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 16 }}>
                      <Tile item={it} />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case 'change':
      return (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Tile item={visual.before} big active={step === 0} />
          <div className="flex flex-col items-center">
            <motion.span animate={{ x: [0, 10, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-4xl text-amber-500">
              ➜
            </motion.span>
            {visual.how && <span className="max-w-[7rem] text-center text-[11px] font-black text-amber-800">{visual.how}</span>}
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: step >= 1 ? 1 : 0.15, scale: step >= 1 ? 1 : 0.8 }}>
            <Tile item={visual.after} big active={step >= 1} />
          </motion.div>
        </div>
      );
  }
};

const QuickCheck: React.FC<{ explainer: ChapterExplainer; onReplay: () => void; onClose: () => void }> = ({ explainer, onReplay, onClose }) => {
  const [picked, setPicked] = useState<Record<number, string>>({});
  const right = explainer.check.filter((c, i) => picked[i] === c.answer).length;
  return (
    <div className="w-full max-w-lg space-y-3" id="explainer-check">
      <p className="text-center text-lg font-black text-stone-900">🎯 Quick check</p>
      {explainer.check.map((c, i) => (
        <div key={i} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-100">
          <p className="text-sm font-bold text-stone-900">{c.question}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {c.options.map((o) => {
              const chosen = picked[i] === o;
              const done = Boolean(picked[i]);
              return (
                <button
                  key={o}
                  type="button"
                  disabled={done}
                  onClick={() => {
                    setPicked((p) => ({ ...p, [i]: o }));
                    if (o === c.answer) soundEffects.playCorrect();
                    else soundEffects.playTryAgain();
                  }}
                  className={`explainer-option rounded-xl border-2 px-3 py-1.5 text-sm font-black ${
                    done && o === c.answer ? 'border-emerald-500 bg-emerald-500 text-white' : chosen ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-stone-200 bg-white text-stone-800'
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {explainer.check.length > 0 && Object.keys(picked).length === explainer.check.length && (
        <p className="text-center text-sm font-black text-emerald-700">
          {right} of {explainer.check.length} right {right === explainer.check.length ? '🎉' : '👍'}
        </p>
      )}
      <div className="flex justify-center gap-2">
        <button type="button" onClick={onReplay} className="inline-flex items-center gap-1 rounded-2xl border-2 border-stone-200 bg-white px-4 py-2 text-sm font-black text-stone-700">
          <RotateCcw className="h-4 w-4" /> Watch again
        </button>
        <button type="button" onClick={onClose} className="btn-3d bg-emerald-500 px-5 py-2 text-sm text-white">
          Done ✅
        </button>
      </div>
    </div>
  );
};

export const ExplainerPlayer: React.FC<{ target: ExplainerTarget; onClose: () => void }> = ({ target, onClose }) => {
  const [explainer, setExplainer] = useState<ChapterExplainer | null>(null);
  const [pending, setPending] = useState(false);
  const [newer, setNewer] = useState<ChapterExplainer | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<number | null>(null);
  const sceneToken = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const load = async (first: boolean) => {
      try {
        const res = await backendApi.readings.explainer(target.readingId);
        if (cancelled) return;
        if (first) setExplainer(res.explainer);
        else if (res.explainer.source === 'ai') setNewer(res.explainer);
        setPending(res.pending && res.explainer.source !== 'ai');
        // The AI version is being made: look again a few times.
        if (res.pending && res.explainer.source !== 'ai' && tries++ < 4) window.setTimeout(() => !cancelled && load(false), 12_000);
      } catch {
        if (!cancelled && first) setError('Could not open the explainer. Please check the internet.');
      }
    };
    void load(true);
    return () => {
      cancelled = true;
      kidSpeech.stop();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [target.readingId]);

  // A better version arrived before the child started watching: swap it in.
  useEffect(() => {
    if (newer && index === 0) {
      setExplainer(newer);
      setNewer(null);
      setPending(false);
    }
  }, [newer, index]);

  const scenes = explainer?.scenes || [];
  const atCheck = explainer ? index >= scenes.length : false;
  const scene: ExplainerScene | undefined = scenes[index];

  const go = useCallback(
    (to: number) => {
      if (!explainer) return;
      if (timer.current) window.clearTimeout(timer.current);
      kidSpeech.stop();
      setIndex(Math.max(0, Math.min(to, explainer.scenes.length + (explainer.check.length ? 0 : -1))));
    },
    [explainer]
  );

  // Narrate the scene; when the narration ends, move on (while playing).
  useEffect(() => {
    if (!explainer || !scene) return;
    const token = ++sceneToken.current;
    if (timer.current) window.clearTimeout(timer.current);
    if (!playing) return;
    const next = () => {
      if (token !== sceneToken.current) return;
      timer.current = window.setTimeout(() => token === sceneToken.current && go(index + 1), scene.visual.kind === 'count' ? 3500 : 1600);
    };
    kidSpeech.stop();
    void kidSpeech.speakText(scene.say, toLanguage(explainer.language), { onEnd: next }).catch(() => {
      // No voice: give time to read.
      timer.current = window.setTimeout(() => token === sceneToken.current && go(index + 1), 2500 + scene.say.length * 60);
    });
    return () => {
      sceneToken.current++;
    };
  }, [explainer, index, playing]);

  return (
    <motion.div className="fixed inset-0 z-[88] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        id="explainer-player"
        role="dialog"
        aria-label={`Animated lesson: ${target.chapterTitle}`}
        initial={{ y: 30 }}
        animate={{ y: 0 }}
        className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-gradient-to-b from-sky-50 via-white to-amber-50 sm:h-auto sm:max-h-[94vh] sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-sky-100 bg-white/80 px-4 py-3">
          <span className="text-2xl">🎬</span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Animated lesson</p>
            <p className="truncate text-base font-black text-stone-900">{target.chapterTitle}</p>
          </div>
          <button type="button" id="btn-explainer-close" onClick={onClose} aria-label="Close" className="rounded-xl border border-stone-200 bg-white p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {pending && (
          <p className="flex items-center gap-1.5 bg-violet-50 px-4 py-1.5 text-[11px] font-bold text-violet-800">
            <Sparkles className="h-3.5 w-3.5" /> Shakthi Mitra is making a fuller animated version with examples…
          </p>
        )}
        {newer && index > 0 && (
          <button
            type="button"
            onClick={() => {
              setExplainer(newer);
              setNewer(null);
              setPending(false);
              setIndex(0);
            }}
            className="bg-violet-600 px-4 py-1.5 text-left text-[11px] font-black text-white"
          >
            ✨ The new animated version with examples is ready — watch it
          </button>
        )}

        <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-4">
          {!explainer && !error && (
            <p className="flex items-center gap-2 text-sm font-bold text-stone-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Getting the lesson ready…
            </p>
          )}
          {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
          {explainer && atCheck && <QuickCheck explainer={explainer} onReplay={() => go(0)} onClose={onClose} />}
          {explainer && scene && (
            <AnimatePresence mode="wait">
              <motion.div key={`${index}-${explainer.source}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex w-full flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  {scene.example && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">🏡 Real-life example</span>}
                  <span className="text-lg font-black text-stone-900">{scene.title}</span>
                </div>
                <div className={`explainer-visual flex w-full items-center justify-center ${scene.visual.kind === 'count' ? 'h-[300px] max-w-xl rounded-3xl bg-white/70 ring-1 ring-sky-100' : 'min-h-[260px]'}`} data-kind={scene.visual.kind}>
                  <Visual visual={scene.visual} />
                </div>
                <button
                  type="button"
                  onClick={() => void kidSpeech.speakText(scene.say, toLanguage(explainer.language)).catch(() => undefined)}
                  className="explainer-say max-w-xl rounded-2xl bg-white px-4 py-3 text-center text-base font-bold leading-relaxed text-stone-800 shadow-sm ring-1 ring-stone-100"
                >
                  🔊 {scene.say}
                </button>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {explainer && (
          <div className="flex items-center gap-2 border-t border-sky-100 bg-white/80 px-4 py-3">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Back" className="rounded-2xl border border-stone-200 p-2.5 disabled:opacity-40">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              id="btn-explainer-play"
              onClick={() => {
                if (playing) kidSpeech.stop();
                setPlaying((p) => !p);
              }}
              aria-label={playing ? 'Pause' : 'Play'}
              className="rounded-2xl border border-stone-200 p-2.5"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <div className="flex flex-1 justify-center gap-1.5" aria-label="Scenes">
              {[...scenes, ...(explainer.check.length ? [null] : [])].map((_, i) => (
                <button key={i} type="button" onClick={() => go(i)} aria-label={`Scene ${i + 1}`} className={`h-2.5 rounded-full transition-all ${i === index ? 'w-6 bg-sky-500' : i < index ? 'w-2.5 bg-sky-300' : 'w-2.5 bg-stone-200'}`} />
              ))}
            </div>
            <button type="button" id="btn-explainer-next" onClick={() => go(index + 1)} disabled={atCheck} aria-label="Next" className="btn-3d flex items-center bg-sky-500 p-2.5 text-white disabled:opacity-40">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

/** Mounted once; opens the player on OPEN_EXPLAINER_EVENT. */
export const ExplainerHost: React.FC = () => {
  const [target, setTarget] = useState<ExplainerTarget | null>(null);
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<ExplainerTarget>).detail;
      if (detail?.readingId) setTarget(detail);
    };
    window.addEventListener(OPEN_EXPLAINER_EVENT, open);
    return () => window.removeEventListener(OPEN_EXPLAINER_EVENT, open);
  }, []);
  return <AnimatePresence>{target && <ExplainerPlayer key={target.readingId} target={target} onClose={() => setTarget(null)} />}</AnimatePresence>;
};
