import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { ChevronLeft, ChevronRight, Loader2, Printer, Volume2, X } from 'lucide-react';
import {
  ActivitySide,
  BookActivities,
  BookActivity,
  KIND_LABEL,
  SCORED_KINDS,
  activityTotal,
  bookActivitiesGameId,
} from '../data/bookActivities';
import { Language, PublishedReadingImage } from '../types';
import { backendApi } from '../services/backendApi';
import { kidSpeech } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import { progressSync } from '../services/progressSync';
import { offlineStorage } from '../services/offlineStorage';
import { recordGame, starsForScore } from '../services/learnPlayProgress';
import { printHtml } from '../services/printWorkbook';
import { bookActivitiesHtml } from '../services/bookActivitiesPrint';
import { SayIt } from './learnplay/SayIt';

// The chapter's own textbook exercises as games (src/data/bookActivities.ts):
// the book's instruction on top (🔊), its own pictures, and one game per
// exercise kind. A child's score per activity is kept on the device and the
// chapter's total is recorded like a Learn & Play game
// (book-<readingId>), so it reaches the class dashboard. Teachers open the
// same panel on a projector (no progress recorded) and can print it.

export const OPEN_BOOK_ACTIVITIES_EVENT = 'pathana:open-book-activities';
export type BookActivitiesTarget = { readingId: string; chapterTitle: string; language?: string; subject?: string };

export function openBookActivities(target: BookActivitiesTarget) {
  window.dispatchEvent(new CustomEvent<BookActivitiesTarget>(OPEN_BOOK_ACTIVITIES_EVENT, { detail: target }));
}

type Scores = Record<string, { score: number; total: number; done: boolean }>;
const storeKey = (studentId: string, readingId: string) => `ps_bookact_${studentId}_${readingId}`;

export function loadActivityScores(studentId: string, readingId: string): Scores {
  try {
    return JSON.parse(localStorage.getItem(storeKey(studentId, readingId)) || '{}') || {};
  } catch {
    return {};
  }
}

const langOf = (text: string, fallback: string): Language =>
  (/[ఀ-౿]/.test(text) ? 'Telugu' : /[ऀ-ॿ]/.test(text) ? 'Hindi' : (fallback as Language)) || 'English';

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

type Pictures = Record<string, PublishedReadingImage>;

const SideView: React.FC<{ side: ActivitySide; pictures: Pictures; big?: boolean }> = ({ side, pictures, big }) => {
  const pic = side.pictureId ? pictures[side.pictureId] : undefined;
  return (
    <span className="flex items-center gap-2">
      {pic ? (
        <img src={`data:${pic.mimeType};base64,${pic.base64}`} alt={pic.caption || side.text || ''} className={`${big ? 'h-32' : 'h-14'} w-auto rounded-xl object-contain`} />
      ) : side.emoji ? (
        <span className={big ? 'text-6xl' : 'text-3xl'}>{side.emoji}</span>
      ) : null}
      {side.text && <span className="text-lg font-black leading-tight">{side.text}</span>}
    </span>
  );
};

type GameProps = { activity: BookActivity; pictures: Pictures; language: Language; onScore: (score: number, total: number) => void };

const say = (text: string, language: Language) => void kidSpeech.speakText(text, langOf(text, language)).catch(() => undefined);

/* -------------------------------- Match -------------------------------- */
const MatchActivity: React.FC<GameProps> = ({ activity, pictures, onScore }) => {
  const pairs = activity.pairs || [];
  const rights = useMemo(() => shuffle(pairs.map((p, i) => ({ ...p.right, i }))), [pairs]);
  const [picked, setPicked] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const pick = (i: number) => {
    if (picked === null || matched.includes(i)) return;
    if (i === picked) {
      soundEffects.playCorrect();
      const next = [...matched, i];
      setMatched(next);
      setPicked(null);
      if (next.length === pairs.length) window.setTimeout(() => onScore(Math.max(0, pairs.length - mistakes), pairs.length), 700);
    } else {
      soundEffects.playTryAgain();
      setMistakes((m) => m + 1);
      setWrong(i);
      window.setTimeout(() => setWrong(null), 600);
    }
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        {pairs.map((p, i) => (
          <motion.button
            key={i}
            type="button"
            layout
            onClick={() => !matched.includes(i) && setPicked(i)}
            className={`btn-3d flex w-full items-center border-2 bg-white px-3 py-2 text-left ${
              matched.includes(i) ? 'border-emerald-400 bg-emerald-50' : picked === i ? 'border-amber-400 bg-amber-50' : 'border-stone-200'
            }`}
          >
            <SideView side={p.left} pictures={pictures} />
          </motion.button>
        ))}
      </div>
      <div className="space-y-2">
        {rights.map((r) => (
          <motion.button
            key={r.i}
            type="button"
            animate={wrong === r.i ? { x: [0, -8, 8, -4, 0] } : {}}
            onClick={() => pick(r.i)}
            className={`btn-3d flex w-full items-center border-2 bg-white px-3 py-2 text-left ${
              matched.includes(r.i) ? 'border-emerald-400 bg-emerald-50' : wrong === r.i ? 'border-rose-300 bg-rose-50' : 'border-stone-200'
            }`}
          >
            <SideView side={r} pictures={pictures} />
          </motion.button>
        ))}
      </div>
      <p className="col-span-2 text-center text-xs font-bold text-stone-500">Tap one on the left, then its partner on the right.</p>
    </div>
  );
};

/* -------------------------- Fill / Choose / True-false -------------------------- */
const ItemsActivity: React.FC<GameProps> = ({ activity, pictures, language, onScore }) => {
  const items = activity.items || [];
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const item = items[index];
  const options = useMemo(
    () => (activity.kind === 'truefalse' ? ['true', 'false'] : shuffle(item?.options || [])),
    [activity.kind, item]
  );
  useEffect(() => {
    if (item) say(item.prompt.replace(/_____/g, ' blank '), language);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!item) return null;
  const choose = (o: string) => {
    if (picked !== null) return;
    const ok = o === item.answer;
    setPicked(o);
    ok ? soundEffects.playCorrect() : soundEffects.playTryAgain();
    const total = right + (ok ? 1 : 0);
    window.setTimeout(() => {
      setPicked(null);
      setRight(total);
      if (index + 1 < items.length) setIndex(index + 1);
      else onScore(total, items.length);
    }, 1200);
  };
  const shown = activity.kind === 'fill' && picked !== null ? item.prompt.replace('_____', `【${item.answer}】`) : item.prompt;
  const pic = item.pictureId ? pictures[item.pictureId] : undefined;
  const label = (o: string) => (o === 'true' ? '✅ True' : o === 'false' ? '❌ False' : o);
  return (
    <div>
      <p className="mb-2 text-right text-xs font-black text-stone-400">
        {index + 1} / {items.length}
      </p>
      {(pic || item.emoji) && (
        <div className="mb-3 flex justify-center">
          {pic ? <img src={`data:${pic.mimeType};base64,${pic.base64}`} alt={pic.caption} className="max-h-48 rounded-2xl object-contain" /> : <span className="text-7xl">{item.emoji}</span>}
        </div>
      )}
      <motion.p key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center text-2xl font-black leading-snug text-stone-900">
        {shown.split(/(【[^】]*】|_____)/).map((part, i) =>
          part === '_____' ? (
            <span key={i} className="mx-1 inline-block min-w-[4rem] border-b-4 border-amber-400">&nbsp;</span>
          ) : part.startsWith('【') ? (
            <motion.span key={i} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="mx-1 rounded-lg bg-emerald-100 px-2 text-emerald-800">
              {part.slice(1, -1)}
            </motion.span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </motion.p>
      <div className={`mt-5 grid gap-3 ${options.length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {options.map((o) => (
          <motion.button
            key={o}
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={() => choose(o)}
            className={`btn-3d border-2 bg-white px-3 py-4 text-xl font-black ${
              picked === null ? 'border-stone-200 text-stone-900' : o === item.answer ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : o === picked ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-stone-200 text-stone-400'
            }`}
          >
            {label(o)}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

/* -------------------------------- Order -------------------------------- */
const OrderActivity: React.FC<GameProps> = ({ activity, language, onScore }) => {
  const sequence = activity.sequence || [];
  const pool = useMemo(() => {
    let s = shuffle(sequence);
    for (let k = 0; k < 5 && s.join('|') === sequence.join('|'); k++) s = shuffle(sequence);
    return s;
  }, [sequence]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);
  const tap = (s: string) => {
    if (chosen.includes(s)) return;
    if (s === sequence[chosen.length]) {
      soundEffects.playCorrect();
      say(s, language);
      const next = [...chosen, s];
      setChosen(next);
      if (next.length === sequence.length) window.setTimeout(() => onScore(mistakes === 0 ? 1 : 0, 1), 900);
    } else {
      soundEffects.playTryAgain();
      setMistakes((m) => m + 1);
      setWrong(s);
      window.setTimeout(() => setWrong(null), 600);
    }
  };
  return (
    <div>
      <ol className="mb-4 min-h-[3rem] space-y-1.5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-3">
        {chosen.map((s, i) => (
          <motion.li key={s} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-base font-black text-emerald-900">
            {i + 1}. {s}
          </motion.li>
        ))}
        {!chosen.length && <li className="text-sm font-bold text-stone-400">Tap what comes first…</li>}
      </ol>
      <div className="space-y-2">
        {pool
          .filter((s) => !chosen.includes(s))
          .map((s) => (
            <motion.button
              key={s}
              type="button"
              layout
              animate={wrong === s ? { x: [0, -8, 8, -4, 0] } : {}}
              onClick={() => tap(s)}
              className={`btn-3d w-full border-2 bg-white px-3 py-3 text-left text-base font-bold ${wrong === s ? 'border-rose-300' : 'border-stone-200'}`}
            >
              {s}
            </motion.button>
          ))}
      </div>
    </div>
  );
};

/* ---------------------------- Picture talk ---------------------------- */
const PictureActivity: React.FC<GameProps & { onDone: () => void }> = ({ activity, pictures, language, onDone }) => {
  const items = activity.items || [];
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const item = items[index];
  useEffect(() => {
    if (item) say(item.prompt, language);
    setShown(false);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!item) return null;
  const pic = item.pictureId ? pictures[item.pictureId] : undefined;
  const next = () => (index + 1 < items.length ? setIndex(index + 1) : onDone());
  return (
    <div className="text-center">
      <motion.div key={index} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex justify-center">
        {pic ? <img src={`data:${pic.mimeType};base64,${pic.base64}`} alt={pic.caption} className="max-h-64 rounded-2xl object-contain shadow" /> : <span className="text-8xl">{item.emoji}</span>}
      </motion.div>
      <button type="button" onClick={() => say(item.prompt, language)} className="mt-4 inline-flex items-center gap-2 text-xl font-black text-stone-900">
        <Volume2 className="h-5 w-5 text-sky-600" /> {item.prompt}
      </button>
      <p className="mt-1 text-sm font-bold text-stone-500">Say your answer out loud.</p>
      {shown && item.answer && <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-lg font-bold text-emerald-900">{item.answer}</p>}
      <div className="mt-4 flex justify-center gap-2">
        {item.answer && !shown && (
          <button type="button" onClick={() => setShown(true)} className="btn-3d border-2 border-stone-200 bg-white px-4 py-2 text-sm">
            Check the answer
          </button>
        )}
        <button type="button" onClick={next} className="btn-3d bg-emerald-500 px-4 py-2 text-sm text-white">
          {index + 1 < items.length ? 'Next picture →' : 'Done ✓'}
        </button>
      </div>
    </div>
  );
};

/* ------------------------------ Say / Write ------------------------------ */
const LinesActivity: React.FC<GameProps & { onDone: () => void }> = ({ activity, language, onDone }) => {
  const lines = activity.lines || [];
  return (
    <div>
      <div className="space-y-4">
        {lines.map((line) =>
          activity.kind === 'say' ? (
            <SayIt key={line} text={line} language={langOf(line, language)} size="md" />
          ) : (
            <div key={line} className="rounded-2xl border-2 border-stone-200 bg-white p-3">
              <button type="button" onClick={() => say(line, language)} className="flex items-start gap-2 text-left text-lg font-bold text-stone-800">
                <Volume2 className="mt-1 h-5 w-5 shrink-0 text-sky-600" /> {line}
              </button>
              <div className="mt-2 h-8 border-b-2 border-dashed border-stone-300" />
            </div>
          )
        )}
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onDone} className="btn-3d bg-emerald-500 px-4 py-2.5 text-sm text-white">
          {activity.kind === 'write' ? '📓 I wrote it in my notebook ✓' : 'I read it ✓'}
        </button>
      </div>
    </div>
  );
};

/* ------------------------------ The panel ------------------------------ */
export const BookActivitiesPanel: React.FC<{ target: BookActivitiesTarget; studentId: string | null; onClose: () => void }> = ({ target, studentId, onClose }) => {
  const [data, setData] = useState<BookActivities | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [pictures, setPictures] = useState<Pictures>({});
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<Scores>(() => (studentId ? loadActivityScores(studentId, target.readingId) : {}));
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [round, setRound] = useState(0);
  const language = (target.language as Language) || 'English';

  useEffect(() => {
    let live = true;
    let tries = 0;
    let timer = 0;
    const load = () =>
      backendApi.readings
        .activities(target.readingId)
        .then((r) => {
          if (!live) return;
          // Never swap activities under a child mid-way; only before they start.
          setData((old) => (old && Object.keys(scores).length ? old : r.activities));
          setPending(r.pending);
          if (r.pending && tries++ < 4) timer = window.setTimeout(load, 12000);
        })
        .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load the activities.'));
    void load();
    backendApi.readings
      .images(target.readingId)
      .then((r) => live && setPictures(Object.fromEntries((r.images || []).map((im) => [im.id, im]))))
      .catch(() => undefined);
    return () => {
      live = false;
      window.clearTimeout(timer);
      kidSpeech.stop();
    };
  }, [target.readingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activities = data?.activities || [];
  const activity = activities[index];

  useEffect(() => {
    setResult(null);
    if (activity) say(activity.instruction, language);
  }, [index, activity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (next: Scores) => {
    setScores(next);
    if (!studentId) return;
    try {
      localStorage.setItem(storeKey(studentId, target.readingId), JSON.stringify(next));
    } catch {
      // Storage full: scores just aren't remembered.
    }
    // The chapter's total across its scored activities, recorded like a game.
    const scored = activities.filter((a) => SCORED_KINDS.includes(a.kind));
    const total = scored.reduce((s, a) => s + activityTotal(a), 0);
    const score = scored.reduce((s, a) => s + (next[a.id]?.score || 0), 0);
    const allDone = activities.every((a) => next[a.id]?.done);
    if (allDone || total > 0) {
      const id = bookActivitiesGameId(target.readingId);
      const t = Math.max(1, total);
      recordGame(studentId, id, Math.min(score, t), t);
      offlineStorage.recordDailyActivity(`game_${id}`);
      progressSync.record({ type: 'game', chapterId: id, subject: target.subject || '', score: Math.min(score, t), total: t, stars: total ? starsForScore(score, t) : allDone ? 3 : 0 });
    }
  };

  const finish = (score: number, total: number) => {
    if (!activity) return;
    const prev = scores[activity.id];
    const best = !prev || score / Math.max(1, total) >= prev.score / Math.max(1, prev.total) ? { score, total, done: true } : { ...prev, done: true };
    save({ ...scores, [activity.id]: best });
    if (total > 0) {
      setResult({ score, total });
      if (starsForScore(score, total) >= 2) {
        soundEffects.playVictoryFanfare();
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } else soundEffects.playCheerChime();
    } else {
      soundEffects.playCheerChime();
      if (index + 1 < activities.length) setIndex(index + 1);
      else setResult({ score: 0, total: 0 });
    }
  };

  const game = () => {
    if (!activity) return null;
    const props: GameProps = { activity, pictures, language, onScore: finish };
    const k = `${activity.id}-${round}`;
    switch (activity.kind) {
      case 'match':
        return <MatchActivity key={k} {...props} />;
      case 'fill':
      case 'choose':
      case 'truefalse':
        return <ItemsActivity key={k} {...props} />;
      case 'order':
        return <OrderActivity key={k} {...props} />;
      case 'picture':
        return <PictureActivity key={k} {...props} onDone={() => finish(0, 0)} />;
      default:
        return <LinesActivity key={k} {...props} onDone={() => finish(0, 0)} />;
    }
  };

  const doneCount = activities.filter((a) => scores[a.id]?.done).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-stretch justify-center bg-stone-900/60 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Book activities" id="book-activities-panel">
      <motion.div initial={{ y: 30 }} animate={{ y: 0 }} className="flex w-full max-w-3xl flex-col overflow-hidden bg-gradient-to-b from-amber-50 to-white sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2 border-b border-amber-100 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-amber-600">📗 Book activities</p>
            <h2 className="truncate text-lg font-black text-stone-900">{target.chapterTitle}</h2>
          </div>
          <div className="flex items-center gap-1">
            {data && activities.length > 0 && (
              <button type="button" onClick={() => printHtml(bookActivitiesHtml(target.chapterTitle, data, pictures))} className="rounded-full p-2 text-stone-500 hover:bg-stone-100" aria-label="Print" title="Print as a worksheet">
                <Printer className="h-5 w-5" />
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-full p-2 text-stone-500 hover:bg-stone-100" aria-label="Close" id="btn-book-activities-close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {activities.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto border-b border-amber-100 bg-white/70 px-4 py-2">
            {activities.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-black ${i === index ? 'bg-stone-900 text-white' : 'bg-white text-stone-600'}`}
              >
                {KIND_LABEL[a.kind].emoji} {i + 1} {scores[a.id]?.done && <span className="text-emerald-500">✓</span>}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
          {!data && !error && (
            <p className="flex items-center gap-2 text-sm font-bold text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Opening the book’s activities…
            </p>
          )}
          {data && !activities.length && (
            <div className="rounded-2xl bg-white p-5 text-center">
              {pending ? (
                <p className="flex items-center justify-center gap-2 text-sm font-bold text-stone-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Shakthi Mitra is turning this chapter’s exercises into games… (about a minute)
                </p>
              ) : (
                <p className="text-sm font-bold text-stone-600">This chapter has no exercises printed in the book. Try its workbook instead.</p>
              )}
            </div>
          )}
          {activity && (
            <AnimatePresence mode="wait">
              <motion.div key={`${activity.id}-${result ? 'r' : 'p'}-${round}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-white p-3">
                  <p className="text-xs font-black text-amber-600">
                    {KIND_LABEL[activity.kind].emoji} {KIND_LABEL[activity.kind].label}
                    {activity.page ? ` · Book p. ${activity.page}` : ''}
                  </p>
                  <button type="button" onClick={() => say(activity.instruction, language)} className="mt-1 flex items-start gap-2 text-left text-lg font-black text-stone-900">
                    <Volume2 className="mt-1 h-5 w-5 shrink-0 text-sky-600" /> {activity.instruction}
                  </button>
                </div>
                {result ? (
                  <div className="rounded-3xl bg-white p-6 text-center">
                    {result.total > 0 ? (
                      <>
                        <p className="text-5xl text-amber-500">
                          {'★'.repeat(starsForScore(result.score, result.total))}
                          <span className="text-stone-200">{'★'.repeat(3 - starsForScore(result.score, result.total))}</span>
                        </p>
                        <p className="mt-2 text-xl font-black text-stone-900">
                          {result.score} of {result.total} right
                        </p>
                      </>
                    ) : (
                      <p className="text-2xl font-black text-emerald-700">🎉 All the book’s activities done!</p>
                    )}
                    <div className="mt-4 flex justify-center gap-2">
                      {result.total > 0 && (
                        <button type="button" onClick={() => { setResult(null); setRound((r) => r + 1); }} className="btn-3d border-2 border-stone-200 bg-white px-4 py-2 text-sm">
                          ↻ Try again
                        </button>
                      )}
                      {index + 1 < activities.length ? (
                        <button type="button" onClick={() => setIndex(index + 1)} className="btn-3d bg-emerald-500 px-4 py-2 text-sm text-white">
                          Next activity →
                        </button>
                      ) : (
                        <button type="button" onClick={onClose} className="btn-3d bg-emerald-500 px-4 py-2 text-sm text-white">
                          Finish ✓
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  game()
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        {activities.length > 0 && (
          <div className="flex items-center justify-between border-t border-amber-100 bg-white px-4 py-2 text-sm font-black text-stone-600">
            <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="inline-flex items-center gap-1 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <span>
              {doneCount} of {activities.length} done
            </span>
            <button type="button" disabled={index + 1 >= activities.length} onClick={() => setIndex(index + 1)} className="inline-flex items-center gap-1 disabled:opacity-30">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

/** Mounted once; opens the panel on OPEN_BOOK_ACTIVITIES_EVENT (students record progress, teachers don't). */
export const BookActivitiesHost: React.FC<{ studentId: string | null | undefined }> = ({ studentId }) => {
  const [target, setTarget] = useState<BookActivitiesTarget | null>(null);
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<BookActivitiesTarget>).detail;
      if (detail?.readingId) setTarget(detail);
    };
    window.addEventListener(OPEN_BOOK_ACTIVITIES_EVENT, open);
    return () => window.removeEventListener(OPEN_BOOK_ACTIVITIES_EVENT, open);
  }, []);
  return (
    <AnimatePresence>
      {target && <BookActivitiesPanel key={target.readingId} target={target} studentId={studentId && studentId !== 'guest' ? studentId : null} onClose={() => setTarget(null)} />}
    </AnimatePresence>
  );
};
