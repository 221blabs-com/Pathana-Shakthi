import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Volume2 } from 'lucide-react';
import { ExerciseAnswer, McqItem, WorkbookExercises } from '../data/workbookExercises';
import { seeded, shuffle } from '../data/practice';
import { soundEffects } from '../services/soundEffects';

// The SCERT exercise sections of a chapter workbook (src/data/workbookExercises.ts),
// done on screen: match the following, rhyming words, a mind map, words under
// heads, grammar, conventions of writing, writing and oral tasks (ticked when
// done in the notebook / aloud), jumbled words and "Try these" sums. Every
// answer is kept under `${section}:${index}` (first try counted for the teacher).

type Answers = Record<string, ExerciseAnswer>;
type Setter = (key: string, value: ExerciseAnswer) => void;
type Speak = (text: string) => void;

const Hear: React.FC<{ text: string; speak: Speak; label?: string }> = ({ text, speak, label = 'Hear it' }) => (
  <button
    type="button"
    aria-label={label}
    onClick={(e) => {
      e.stopPropagation();
      speak(text);
    }}
    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200"
  >
    <Volume2 className="h-4 w-4" />
  </button>
);

export const SectionTitle: React.FC<{ letter?: string; children: React.ReactNode; hint?: string }> = ({ letter, children, hint }) => (
  <div className="mb-2 mt-4 first:mt-0">
    <p className="text-sm font-black uppercase tracking-wide text-stone-800">
      {letter && <span className="mr-1 rounded-md bg-stone-800 px-1.5 text-white">{letter}</span>}
      {children}
    </p>
    {hint && <p className="text-[11px] font-semibold text-stone-500">{hint}</p>}
  </div>
);

const right = (a?: ExerciseAnswer) => (a?.solved ? (a.firstTry !== false ? '⭐ Right on the first try!' : '✅ Well done!') : '');

/* ---------- one-answer choices: rhyming words, conventions of writing ---------- */
const Choice: React.FC<{ item: McqItem; k: string; answers: Answers; set: Setter; speak: Speak; label: React.ReactNode; className?: string }> = ({ item, k, answers, set, speak, label, className }) => {
  const a = answers[k];
  const [shake, setShake] = useState(false);
  return (
    <motion.div animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }} className={`ex-choice rounded-2xl border-2 bg-white p-3 ${a?.solved ? 'border-emerald-300' : 'border-stone-100'} ${className || ''}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 text-[15px] font-bold text-stone-800">{label}</div>
        <Hear text={item.prompt} speak={speak} />
      </div>
      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
        {item.options.map((o) => {
          const isRight = a?.solved && o === item.answer;
          const isWrong = !a?.solved && a?.picked === o;
          return (
            <button
              key={o}
              type="button"
              disabled={a?.solved}
              onClick={() => {
                const ok = o === item.answer;
                if (ok) soundEffects.playCorrect();
                else {
                  soundEffects.playTryAgain();
                  setShake(true);
                  window.setTimeout(() => setShake(false), 450);
                }
                set(k, { picked: o, solved: ok, firstTry: a ? a.firstTry !== false && ok : ok });
                if (ok) speak(o);
              }}
              className={`ex-option rounded-xl border-2 px-3 py-1.5 text-left text-sm font-black ${isRight ? 'border-emerald-500 bg-emerald-500 text-white' : isWrong ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-stone-200 bg-white text-stone-800'}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {a?.solved && <p className="mt-1.5 text-xs font-black text-emerald-700">{right(a)}</p>}
    </motion.div>
  );
};

/* ---------- match the following ---------- */
export const MatchSection: React.FC<{ pairs: WorkbookExercises['match']; answers: Answers; set: Setter; speak: Speak }> = ({ pairs, answers, set, speak }) => {
  const order = useMemo(() => {
    let o = shuffle(pairs.map((_, i) => i), seeded(pairs.map((p) => p.left).join('|')));
    if (o.every((x, i) => x === i)) o = [...o.slice(1), o[0]];
    return o;
  }, [pairs]);
  const [sel, setSel] = useState<number | null>(null);
  const [miss, setMiss] = useState<number | null>(null);
  const solvedRight = new Map(pairs.map((p, i) => [i, answers[`match:${i}`]?.solved]));
  return (
    <div className="ex-match grid grid-cols-2 gap-2">
      <div className="space-y-2">
        {pairs.map((p, i) => {
          const done = solvedRight.get(i);
          return (
            <button
              key={i}
              type="button"
              disabled={done}
              onClick={() => {
                soundEffects.playWordPop();
                setSel(i);
                speak(p.left);
              }}
              className={`ex-match-left flex min-h-[48px] w-full items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-left text-sm font-black ${done ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : sel === i ? 'border-amber-500 bg-amber-100 text-stone-900' : 'border-stone-200 bg-white text-stone-800'}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[11px] text-white">{i + 1}</span>
              {p.left}
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        {order.map((j) => {
          const done = solvedRight.get(j);
          return (
            <motion.button
              key={j}
              type="button"
              disabled={done || sel === null}
              animate={miss === j ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
              onClick={() => {
                if (sel === null) return;
                const k = `match:${sel}`;
                const prev = answers[k];
                if (j === sel) {
                  soundEffects.playCorrect();
                  set(k, { solved: true, firstTry: prev?.firstTry !== false });
                  setSel(null);
                } else {
                  soundEffects.playTryAgain();
                  set(k, { ...prev, firstTry: false });
                  setMiss(j);
                  window.setTimeout(() => setMiss(null), 450);
                }
              }}
              className={`ex-match-right flex min-h-[48px] w-full items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-left text-[13px] font-bold ${done ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : sel !== null ? 'border-sky-200 bg-white text-stone-800 hover:border-sky-400' : 'border-stone-100 bg-stone-50 text-stone-600'}`}
            >
              {done && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">{j + 1}</span>}
              {pairs[j].right}
            </motion.button>
          );
        })}
      </div>
      <p className="col-span-2 text-[11px] font-semibold text-stone-500">{sel === null ? 'Tap a word on the left, then its match on the right.' : `Now tap the match for “${pairs[sel].left}”.`}</p>
    </div>
  );
};

export const RhymeSection: React.FC<{ items: McqItem[]; answers: Answers; set: Setter; speak: Speak }> = ({ items, answers, set, speak }) => (
  <div className="space-y-2">
    {items.map((r, i) => (
      <Choice
        key={i}
        item={{ ...r, prompt: r.prompt }}
        k={`rhymes:${i}`}
        answers={answers}
        set={set}
        speak={speak}
        label={
          <>
            Which word rhymes with <span className="rounded-lg bg-amber-200 px-1.5 text-amber-950">{r.prompt}</span>?
          </>
        }
      />
    ))}
  </div>
);

export const ConventionsSection: React.FC<{ items: McqItem[]; answers: Answers; set: Setter; speak: Speak }> = ({ items, answers, set, speak }) => (
  <div className="space-y-2">
    {items.map((c, i) => (
      <Choice key={i} item={c} k={`conventions:${i}`} answers={answers} set={set} speak={speak} label={c.prompt} />
    ))}
  </div>
);

/* ---------- mind map ---------- */
export const MindMapSection: React.FC<{ map: NonNullable<WorkbookExercises['mindMap']>; speak: Speak }> = ({ map, speak }) => {
  const bubbles = [...map.words.map((w) => ({ w, blank: false })), { w: '', blank: true }, { w: '', blank: true }];
  const n = bubbles.length;
  return (
    <div className="ex-mindmap relative mx-auto h-[300px] w-full max-w-[340px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 340 300" aria-hidden>
        {bubbles.map((_, i) => {
          const a = (i / n) * 2 * Math.PI - Math.PI / 2;
          return <line key={i} x1={170} y1={150} x2={170 + 125 * Math.cos(a)} y2={150 + 112 * Math.sin(a)} stroke="#fcd34d" strokeWidth={3} />;
        })}
      </svg>
      <button type="button" onClick={() => speak(map.center)} className="absolute left-1/2 top-1/2 z-10 max-w-[130px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 px-4 py-3 text-center text-sm font-black text-amber-950 shadow">
        {map.center}
      </button>
      {bubbles.map((b, i) => {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2;
        return (
          <button
            key={i}
            type="button"
            disabled={b.blank}
            onClick={() => speak(b.w)}
            className={`absolute z-10 max-w-[96px] -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1.5 text-center text-xs font-black ${b.blank ? 'border-2 border-dashed border-stone-300 bg-white text-stone-400' : 'border-2 border-sky-200 bg-sky-50 text-sky-900'}`}
            style={{ left: `${((170 + 125 * Math.cos(a)) / 340) * 100}%`, top: `${((150 + 112 * Math.sin(a)) / 300) * 100}%` }}
          >
            {b.blank ? '✏️ your word' : b.w}
          </button>
        );
      })}
    </div>
  );
};

/* ---------- words under heads ---------- */
export const ClassifySection: React.FC<{ data: NonNullable<WorkbookExercises['classify']>; answers: Answers; set: Setter; speak: Speak }> = ({ data, answers, set, speak }) => (
  <div className="space-y-2">
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${data.heads.length}, minmax(0, 1fr))` }}>
      {data.heads.map((h) => (
        <div key={h} className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-2">
          <p className="text-center text-xs font-black text-emerald-900">🧺 {h}</p>
          <div className="mt-1 flex min-h-[28px] flex-wrap justify-center gap-1">
            {data.items.map((it, i) => (answers[`classify:${i}`]?.solved && it.head === h ? <span key={i} className="rounded-lg bg-white px-2 py-0.5 text-xs font-black text-stone-800 shadow-sm">{it.word}</span> : null))}
          </div>
        </div>
      ))}
    </div>
    {data.items.map((it, i) => {
      const k = `classify:${i}`;
      const a = answers[k];
      if (a?.solved) return null;
      return (
        <div key={i} className="ex-classify flex flex-wrap items-center gap-2 rounded-2xl border border-stone-100 bg-white p-2">
          <button type="button" onClick={() => speak(it.word)} className="min-w-[72px] rounded-xl bg-amber-100 px-2.5 py-1.5 text-sm font-black text-amber-950">
            {it.word}
          </button>
          <span className="text-stone-400">➜</span>
          {data.heads.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                const ok = h === it.head;
                if (ok) soundEffects.playCorrect();
                else soundEffects.playTryAgain();
                set(k, { picked: h, solved: ok, firstTry: a ? a.firstTry !== false && ok : ok });
              }}
              className={`rounded-xl border-2 px-2.5 py-1 text-xs font-black ${a?.picked === h ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-stone-200 bg-white text-stone-700'}`}
            >
              {h}
            </button>
          ))}
        </div>
      );
    })}
  </div>
);

/* ---------- grammar: tap the words ---------- */
const clean = (t: string) => t.replace(/[\p{P}\p{S}]+/gu, '');
export const GrammarSection: React.FC<{ data: NonNullable<WorkbookExercises['grammar']>; answers: Answers; set: Setter; speak: Speak }> = ({ data, answers, set, speak }) => (
  <div className="space-y-2">
    <div className="flex items-start gap-2 rounded-xl bg-violet-50 px-3 py-2">
      <p className="flex-1 text-sm font-bold text-violet-900">{data.instruction}</p>
      <Hear text={data.instruction} speak={speak} />
    </div>
    {data.items.map((item, i) => {
      const k = `grammar:${i}`;
      const a = answers[k] || {};
      const taps = a.taps || [];
      const checked = (a.checks || 0) > 0;
      const tokens = item.sentence.split(/\s+/);
      return (
        <div key={i} className={`ex-grammar rounded-2xl border-2 bg-white p-3 ${a.solved ? 'border-emerald-300' : 'border-stone-100'}`}>
          <div className="flex flex-wrap gap-1.5">
            {tokens.map((tok, t) => {
              const w = clean(tok);
              const on = taps.includes(`${t}`);
              const isAnswer = item.answers.includes(w);
              const showRight = (a.solved || checked) && on && isAnswer;
              const showWrong = checked && !a.solved && on && !isAnswer && !data.lenient;
              const showMissed = checked && !a.solved && !on && isAnswer && (a.checks || 0) >= 2;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={a.solved || !w}
                  onClick={() => set(k, { ...a, taps: on ? taps.filter((x) => x !== `${t}`) : [...taps, `${t}`] })}
                  className={`ex-token rounded-lg border-2 px-1.5 py-0.5 text-[15px] font-bold ${
                    showRight ? 'border-emerald-500 bg-emerald-500 text-white' : showWrong ? 'border-rose-400 bg-rose-50 text-rose-700' : showMissed ? 'border-amber-400 bg-amber-50 text-amber-900' : on ? 'border-violet-500 bg-violet-100 text-violet-900' : 'border-transparent bg-stone-50 text-stone-800'
                  }`}
                >
                  {tok}
                </button>
              );
            })}
          </div>
          {!a.solved ? (
            <button
              type="button"
              disabled={!taps.length}
              onClick={() => {
                const picked = new Set(taps.map((t) => clean(tokens[Number(t)])));
                const allFound = item.answers.every((x) => picked.has(x));
                const extra = [...picked].some((x) => !item.answers.includes(x));
                const ok = allFound && (data.lenient || !extra);
                if (ok) soundEffects.playCorrect();
                else soundEffects.playTryAgain();
                set(k, { ...a, solved: ok, firstTry: a.firstTry !== false && ok && !a.checks, checks: (a.checks || 0) + 1 });
              }}
              className="ex-check btn-3d mt-2 bg-violet-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              ✔ Check
            </button>
          ) : (
            <p className="mt-1.5 text-xs font-black text-emerald-700">
              {right(a)} {data.lenient ? `(${item.answers.join(', ')})` : ''}
            </p>
          )}
          {checked && !a.solved && <p className="mt-1 text-[11px] font-bold text-amber-800">{(a.checks || 0) >= 2 ? 'The yellow words are the ones to find. Tap them.' : 'Not yet — look again.'}</p>}
        </div>
      );
    })}
  </div>
);

/* ---------- writing and oral tasks (paper / aloud) ---------- */
export const TasksSection: React.FC<{ kind: 'writing' | 'oral'; tasks: string[]; answers: Answers; set: Setter; speak: Speak }> = ({ kind, tasks, answers, set, speak }) => (
  <div className="space-y-2">
    {tasks.map((t, i) => {
      const k = `${kind}:${i}`;
      const done = answers[k]?.done;
      return (
        <div key={i} className={`ex-task rounded-2xl border-2 bg-white p-3 ${done ? 'border-emerald-300' : 'border-stone-100'}`}>
          <div className="flex items-start gap-2">
            <span className="text-xl">{kind === 'writing' ? '✍️' : '🗣️'}</span>
            <p className="flex-1 text-[15px] font-bold text-stone-800">{t}</p>
            <Hear text={t} speak={speak} />
          </div>
          <button
            type="button"
            aria-pressed={done}
            onClick={() => {
              soundEffects.playWordPop();
              set(k, { done: !done });
            }}
            className={`mt-2 rounded-xl border-2 px-3 py-1.5 text-xs font-black ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-200 bg-white text-emerald-800'}`}
          >
            {done ? (kind === 'writing' ? '✅ I wrote it in my notebook' : '✅ I said it') : kind === 'writing' ? '☐ I wrote it in my notebook' : '☐ I said it'}
          </button>
        </div>
      );
    })}
  </div>
);

/* ---------- jumbled words ---------- */
export const JumbleSection: React.FC<{ items: WorkbookExercises['jumbles']; answers: Answers; set: Setter; speak: Speak }> = ({ items, answers, set, speak }) => {
  const [shake, setShake] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((j, i) => {
        const k = `jumbles:${i}`;
        const a = answers[k] || {};
        const placed = a.solved ? j.tiles.map((_, x) => x) : a.placed || [];
        const built = a.solved ? j.word : placed.map((x) => j.tiles[x]).join('');
        return (
          <motion.div key={i} animate={shake === i ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }} className={`ex-jumble rounded-2xl border-2 bg-white p-3 ${a.solved ? 'border-emerald-300' : 'border-stone-100'}`}>
            {j.hint && <p className="text-xs font-bold text-stone-500">💡 {j.hint}</p>}
            <div className="mt-1 flex min-h-[44px] items-center gap-1 rounded-xl bg-stone-50 px-2">
              <span className={`text-2xl font-black tracking-wide ${a.solved ? 'text-emerald-700' : 'text-stone-900'}`}>{built || <span className="text-sm font-bold text-stone-400">Tap the letters in order</span>}</span>
              {!a.solved && placed.length > 0 && (
                <button type="button" onClick={() => set(k, { ...a, placed: [] })} className="ml-auto rounded-lg border border-stone-200 px-2 py-0.5 text-xs font-black text-stone-500">
                  ↺
                </button>
              )}
            </div>
            {!a.solved && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {j.tiles.map((t, x) => (
                  <button
                    key={x}
                    type="button"
                    disabled={placed.includes(x)}
                    onClick={() => {
                      const next = [...placed, x];
                      if (next.length < j.tiles.length) return set(k, { ...a, placed: next });
                      const ok = next.map((y) => j.tiles[y]).join('') === j.word;
                      if (ok) {
                        soundEffects.playCorrect();
                        speak(j.word);
                        set(k, { solved: true, firstTry: a.firstTry !== false });
                      } else {
                        soundEffects.playTryAgain();
                        setShake(i);
                        window.setTimeout(() => setShake(null), 450);
                        set(k, { ...a, placed: [], firstTry: false });
                      }
                    }}
                    className="ex-tile h-11 min-w-[44px] rounded-xl border-b-4 border-amber-500 bg-amber-300 px-2 text-xl font-black text-amber-950 disabled:opacity-25"
                  >
                    {t}
                  </button>
                ))}
                {a.firstTry === false && <Hear text={j.word} speak={speak} label="Hear the word" />}
              </div>
            )}
            {a.solved && <p className="mt-1 text-xs font-black text-emerald-700">{right(a)}</p>}
          </motion.div>
        );
      })}
    </div>
  );
};

/* ---------- maths: try these ---------- */
const toAscii = (s: string) => s.replace(/[౦-౯]/g, (c) => String(c.charCodeAt(0) - 0x0c66)).replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x0966)).replace(/[\s,]/g, '');
export const ProblemsSection: React.FC<{ items: WorkbookExercises['problems']; answers: Answers; set: Setter }> = ({ items, answers, set }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {items.map((p, i) => {
      const k = `problems:${i}`;
      const a = answers[k] || {};
      const wrong = (a.checks || 0) > 0 && !a.solved;
      return (
        <form
          key={i}
          onSubmit={(e) => {
            e.preventDefault();
            const ok = Number(toAscii(a.typed || '')) === Number(p.answer) && toAscii(a.typed || '') !== '';
            if (ok) soundEffects.playCorrect();
            else soundEffects.playTryAgain();
            set(k, { ...a, solved: ok, firstTry: a.firstTry !== false && ok && !a.checks, checks: (a.checks || 0) + 1 });
          }}
          className={`ex-problem rounded-2xl border-2 bg-white p-3 ${a.solved ? 'border-emerald-300' : wrong ? 'border-rose-200' : 'border-stone-100'}`}
        >
          <p className="font-mono text-xl font-black text-stone-900">{p.question.replace('= ?', '=')}</p>
          <div className="mt-2 flex gap-2">
            <input
              inputMode="numeric"
              aria-label={`Answer for ${p.question}`}
              value={a.solved ? p.answer : a.typed || ''}
              disabled={a.solved}
              onChange={(e) => set(k, { ...a, typed: e.target.value.slice(0, 10) })}
              className="w-24 rounded-xl border-2 border-stone-200 px-2 py-1 text-lg font-black"
            />
            {!a.solved && (
              <button type="submit" className="btn-3d bg-sky-500 px-3 py-1 text-xs text-white">
                ✔ Check
              </button>
            )}
          </div>
          {a.solved && <p className="mt-1 text-xs font-black text-emerald-700">{right(a)}</p>}
          {wrong && <p className="mt-1 text-xs font-bold text-rose-700">{(a.checks || 0) >= 2 ? `The answer is ${p.answer}. Try it once more in your notebook.` : 'Not yet — try again.'}</p>}
        </form>
      );
    })}
  </div>
);
