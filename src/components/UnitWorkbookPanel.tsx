import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2, Printer, Volume2, X } from 'lucide-react';
import { Language, UnitWorkbook } from '../types';
import { backendApi } from '../services/backendApi';
import { kidSpeech } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import { progressSync } from '../services/progressSync';
import { printHtml, workbookHtml } from '../services/printWorkbook';
import { openExplainer } from './ExplainerPlayer';

// The chapter workbook a child does after reading a textbook chapter, in the
// order teachers use in class: 📖 Lesson → ✏️ Fill in the blanks → ❓ Questions
// and answers → 🎯 I can… (learning outcomes) → 💭 What I learned
// (reflection, and "I need help") → 🎨 Activity. Every line can be heard
// (🔊), Next is always open, and the child's answers are kept on this device
// and sent to the teacher (activity type "unit", unitResponses).

export const OPEN_WORKBOOK_EVENT = 'pathana:open-workbook';

export type WorkbookTarget = { readingId: string; chapterTitle: string; subject?: string };

/** Open a chapter's workbook from anywhere (handled by <UnitWorkbookHost/>). */
export function openWorkbook(target: WorkbookTarget) {
  window.dispatchEvent(new CustomEvent<WorkbookTarget>(OPEN_WORKBOOK_EVENT, { detail: target }));
}

const STEPS = [
  { id: 'lesson', icon: '📖', name: 'Lesson' },
  { id: 'blanks', icon: '✏️', name: 'Fill in the blanks' },
  { id: 'questions', icon: '❓', name: 'Questions' },
  { id: 'outcomes', icon: '🎯', name: 'I can…' },
  { id: 'reflect', icon: '💭', name: 'What I learned' },
  { id: 'activity', icon: '🎨', name: 'Activity' },
] as const;

type Feeling = '' | 'easy' | 'ok' | 'hard';

interface WorkbookState {
  step: number;
  /** Blank index → the word picked last and whether the first try was right. */
  blanks: Record<number, { picked: string; firstTry: boolean; solved: boolean }>;
  revealed: Record<number, boolean>;
  known: Record<number, boolean>;
  outcomes: Record<number, number>;
  feeling: Feeling;
  note: string;
  needHelp: boolean;
  helpQuestion: string;
  activityDone: boolean;
  done: boolean;
  /** The workbook the child answered: kept, so a newer (AI) version made
   * later never mixes with answers given to the old one. */
  wb?: UnitWorkbook;
}

const EMPTY: WorkbookState = {
  step: 0,
  blanks: {},
  revealed: {},
  known: {},
  outcomes: {},
  feeling: '',
  note: '',
  needHelp: false,
  helpQuestion: '',
  activityDone: false,
  done: false,
};

const storeKey = (studentId: string, readingId: string) => `ps_workbook_${studentId}_${readingId}`;

export function loadWorkbookState(studentId: string, readingId: string): WorkbookState | null {
  try {
    const raw = localStorage.getItem(storeKey(studentId, readingId));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function saveWorkbookState(studentId: string, readingId: string, state: WorkbookState) {
  try {
    localStorage.setItem(storeKey(studentId, readingId), JSON.stringify(state));
  } catch {
    // Storage full or blocked: the server still has the last saved state.
  }
}

/** Right-first-time blanks and known answers, counting only items this workbook has. */
function countAnswers(s: WorkbookState, wb: UnitWorkbook | null) {
  const inRange = (i: string, n: number) => Number(i) >= 0 && Number(i) < n;
  return {
    blanksCorrect: Object.entries(s.blanks).filter(([i, b]) => inRange(i, wb?.blanks.length || 0) && b.firstTry).length,
    questionsKnown: Object.entries(s.known).filter(([i, k]) => inRange(i, wb?.questions.length || 0) && k).length,
  };
}

const scriptOf = (t: string): Language => (/[ఀ-౿]/.test(t) ? 'Telugu' : /[ऀ-ॿ]/.test(t) ? 'Hindi' : 'English');

const speak = (text: string) => {
  kidSpeech.stop();
  void kidSpeech.speakText(text.replace(/_{3,}/g, ' … '), scriptOf(text)).catch(() => undefined);
};

const HearButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Hear it' }) => (
  <button
    type="button"
    aria-label={label}
    onClick={(e) => {
      e.stopPropagation();
      speak(text);
    }}
    className="workbook-hear inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200"
  >
    <Volume2 className="h-4 w-4" />
  </button>
);

const FACES: { value: number; face: string; label: string }[] = [
  { value: 2, face: '😀', label: 'Yes, I can' },
  { value: 1, face: '🙂', label: 'A little' },
  { value: 0, face: '😟', label: 'Not yet' },
];

export const UnitWorkbookPanel: React.FC<{
  target: WorkbookTarget;
  studentId: string;
  className?: string;
  onClose: () => void;
}> = ({ target, studentId, className, onClose }) => {
  const [state, setState] = useState<WorkbookState>(() => loadWorkbookState(studentId, target.readingId) || EMPTY);
  const [workbook, setWorkbook] = useState<UnitWorkbook | null>(() => state.wb || null);
  const [error, setError] = useState('');
  const [shake, setShake] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (workbook) return () => kidSpeech.stop(); // the one this child already started
    backendApi.readings
      .workbook(target.readingId)
      .then((res) => !cancelled && setWorkbook(res.workbook))
      .catch(() => !cancelled && setError('The workbook could not open. Please check the internet and try again.'));
    return () => {
      cancelled = true;
      kidSpeech.stop();
    };
  }, [target.readingId]);

  const update = useCallback(
    (change: Partial<WorkbookState>) =>
      setState((old) => {
        const next = { ...old, ...change, wb: old.wb || workbook || undefined };
        saveWorkbookState(studentId, target.readingId, next);
        return next;
      }),
    [studentId, target.readingId, workbook]
  );

  const summary = useMemo(() => countAnswers(state, workbook), [state, workbook]);

  /** Tell the server (and so the teacher) where the child is. */
  const send = useCallback(
    (s: WorkbookState, done: boolean) => {
      if (!workbook) return;
      progressSync.record({
        type: 'unit',
        readingId: target.readingId,
        chapterTitle: target.chapterTitle,
        subject: target.subject,
        step: done ? 'done' : STEPS[s.step]?.id || 'lesson',
        blanksCorrect: countAnswers(s, workbook).blanksCorrect,
        blanksTotal: workbook.blanks.length,
        questionsKnown: countAnswers(s, workbook).questionsKnown,
        questionsTotal: workbook.questions.length,
        outcomes: workbook.outcomes.map((_, i) => s.outcomes[i] ?? 0),
        reflection: { feeling: s.feeling, note: s.note.trim() },
        needHelp: s.needHelp,
        helpQuestion: s.needHelp ? s.helpQuestion.trim() : '',
        activityDone: s.activityDone,
        done,
      });
    },
    [workbook, target]
  );

  const goTo = (step: number) => {
    soundEffects.playPageTurn();
    kidSpeech.stop();
    const next = { ...state, step };
    update({ step });
    send(next, state.done);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const finish = () => {
    const next = { ...state, done: true };
    update({ done: true });
    send(next, true);
    soundEffects.playVictoryFanfare();
    setCelebrate(true);
  };

  const pickBlank = (i: number, word: string, answer: string) => {
    const old = state.blanks[i];
    if (old?.solved) return;
    const right = word === answer;
    if (right) soundEffects.playCorrect();
    else {
      soundEffects.playTryAgain();
      setShake(i);
      window.setTimeout(() => setShake(null), 450);
    }
    update({ blanks: { ...state.blanks, [i]: { picked: word, firstTry: old ? old.firstTry : right, solved: right } } });
    if (right && workbook) speak(workbook.blanks[i].sentence.replace(/_{3,}/, answer));
  };

  const step = STEPS[state.step] || STEPS[0];
  const isLast = state.step === STEPS.length - 1;

  return (
    <motion.div
      className="fixed inset-0 z-[85] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        id="unit-workbook"
        role="dialog"
        aria-label={`Workbook: ${target.chapterTitle}`}
        initial={{ y: 30 }}
        animate={{ y: 0 }}
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#fffdf7] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl"
      >
        {/* Header: title and the six steps */}
        <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-emerald-50 px-4 pb-3 pt-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              📝
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Chapter workbook</p>
              <p className="truncate text-base font-black text-stone-900">{target.chapterTitle}</p>
            </div>
            {workbook && (
              <button
                type="button"
                id="btn-workbook-print"
                aria-label="Print the workbook"
                onClick={() => printHtml(workbookHtml(target.chapterTitle, workbook, { className }))}
                className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
              >
                <Printer className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              id="btn-workbook-close"
              aria-label="Close"
              onClick={onClose}
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ol className="mt-3 grid grid-cols-6 gap-1" aria-label="Workbook steps">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => workbook && goTo(i)}
                  aria-current={i === state.step ? 'step' : undefined}
                  title={s.name}
                  className={`workbook-step flex w-full flex-col items-center rounded-xl py-1.5 text-lg transition ${
                    i === state.step
                      ? 'bg-emerald-500 text-white shadow'
                      : i < state.step || state.done
                        ? 'bg-emerald-100'
                        : 'bg-white/70'
                  }`}
                >
                  <span aria-hidden>{s.icon}</span>
                  <span className={`hidden text-[9px] font-black sm:block ${i === state.step ? 'text-white' : 'text-stone-500'}`}>{s.name}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {!workbook && !error && (
            <p className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-stone-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Opening the workbook…
            </p>
          )}
          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}

          {workbook && (
            <AnimatePresence mode="wait">
              <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
                <h2 className="mb-3 flex items-center gap-2 text-xl font-black text-stone-900">
                  <span aria-hidden>{step.icon}</span> {step.name}
                </h2>

                {step.id === 'lesson' && (
                  <div className="space-y-3" id="workbook-lesson">
                    <button
                      type="button"
                      id="btn-workbook-explainer"
                      onClick={() => openExplainer({ readingId: target.readingId, chapterTitle: target.chapterTitle })}
                      className="flex w-full items-center gap-3 rounded-2xl border-2 border-sky-200 bg-gradient-to-r from-sky-50 to-white p-3 text-left hover:border-sky-400"
                    >
                      <span className="text-3xl">🎬</span>
                      <span className="flex-1">
                        <span className="block text-sm font-black text-stone-900">Watch the animated lesson</span>
                        <span className="block text-[11px] font-semibold text-stone-500">Pictures, examples from real life, and a voice that explains.</span>
                      </span>
                      <span className="text-lg text-sky-600">▶</span>
                    </button>
                    {workbook.lesson.points.length === 0 && <p className="text-sm text-stone-500">Read the chapter again, then come back here.</p>}
                    {workbook.lesson.points.map((p, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-white p-3">
                        <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950">
                          {i + 1}
                        </span>
                        <p className="flex-1 text-[15px] font-semibold leading-relaxed text-stone-800">{p}</p>
                        <HearButton text={p} />
                      </div>
                    ))}
                    {workbook.lesson.words.length > 0 && (
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                        <p className="mb-2 text-xs font-black uppercase tracking-wide text-sky-800">🔤 New words — tap to hear</p>
                        <div className="flex flex-wrap gap-2">
                          {workbook.lesson.words.map((w) => (
                            <button
                              key={w.word}
                              type="button"
                              onClick={() => speak(w.meaning ? `${w.word}. ${w.meaning}` : w.word)}
                              className="workbook-word rounded-2xl border border-sky-200 bg-white px-3 py-1.5 text-left"
                            >
                              <span className="block text-sm font-black text-stone-900">{w.word}</span>
                              {w.meaning && <span className="block text-[11px] font-semibold text-stone-500">{w.meaning}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step.id === 'blanks' && (
                  <div className="space-y-3" id="workbook-blanks">
                    {workbook.blanks.length === 0 && <p className="text-sm text-stone-500">No blanks for this chapter. Tap Next ➜</p>}
                    {workbook.blanks.map((b, i) => {
                      const got = state.blanks[i];
                      const [before, after] = b.sentence.split(/_{3,}/);
                      return (
                        <motion.div
                          key={i}
                          animate={shake === i ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                          className={`workbook-blank rounded-2xl border-2 bg-white p-3 ${got?.solved ? 'border-emerald-300' : 'border-stone-100'}`}
                        >
                          <div className="flex items-start gap-2">
                            <p className="flex-1 text-[15px] font-semibold leading-relaxed text-stone-800">
                              {before}
                              <span
                                className={`mx-1 inline-block min-w-[4.5rem] border-b-2 px-1 text-center font-black ${
                                  got?.solved ? 'border-emerald-500 text-emerald-700' : 'border-stone-400 text-transparent'
                                }`}
                              >
                                {got?.solved ? b.answer : '?'}
                              </span>
                              {after}
                            </p>
                            <HearButton text={b.sentence} />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {b.options.map((o) => {
                              const wrong = got && !got.solved && got.picked === o;
                              const right = got?.solved && o === b.answer;
                              return (
                                <button
                                  key={o}
                                  type="button"
                                  disabled={got?.solved}
                                  onClick={() => pickBlank(i, o, b.answer)}
                                  className={`workbook-option rounded-xl border-2 px-3 py-1.5 text-sm font-black transition ${
                                    right
                                      ? 'border-emerald-500 bg-emerald-500 text-white'
                                      : wrong
                                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                                        : 'border-stone-200 bg-white text-stone-800 hover:border-emerald-300'
                                  }`}
                                >
                                  {o}
                                </button>
                              );
                            })}
                          </div>
                          {got?.solved && (
                            <p className="mt-2 text-xs font-black text-emerald-700">{got.firstTry ? '⭐ Right on the first try!' : '✅ Well done!'}</p>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {step.id === 'questions' && (
                  <div className="space-y-3" id="workbook-questions">
                    {workbook.questions.length === 0 && <p className="text-sm text-stone-500">No questions for this chapter. Tap Next ➜</p>}
                    {workbook.questions.map((q, i) => (
                      <div key={i} className="workbook-question rounded-2xl border border-violet-100 bg-white p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 rounded-lg bg-violet-100 px-1.5 text-[10px] font-black uppercase text-violet-700">
                            {q.kind === 'apply' ? 'Think' : q.kind === 'long' ? 'Explain' : 'Q'}
                            {i + 1}
                          </span>
                          <p className="flex-1 text-[15px] font-bold leading-relaxed text-stone-800">{q.question}</p>
                          <HearButton text={q.question} />
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-stone-500">Say your answer aloud or tell a friend, then check.</p>
                        {state.revealed[i] ? (
                          <div className="mt-2 rounded-xl bg-emerald-50 p-2.5">
                            {q.answer ? (
                              <div className="flex items-start gap-2">
                                <p className="workbook-answer flex-1 text-sm font-semibold text-emerald-900">💡 {q.answer}</p>
                                <HearButton text={q.answer} label="Hear the answer" />
                              </div>
                            ) : (
                              <p className="text-sm font-semibold text-emerald-900">💡 Ask your teacher to check your answer.</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  soundEffects.playCorrect();
                                  update({ known: { ...state.known, [i]: true } });
                                }}
                                className={`workbook-knew rounded-xl border-2 px-3 py-1.5 text-xs font-black ${
                                  state.known[i] === true ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-200 bg-white text-emerald-800'
                                }`}
                              >
                                😀 I knew it
                              </button>
                              <button
                                type="button"
                                onClick={() => update({ known: { ...state.known, [i]: false } })}
                                className={`rounded-xl border-2 px-3 py-1.5 text-xs font-black ${
                                  state.known[i] === false ? 'border-amber-500 bg-amber-400 text-amber-950' : 'border-amber-200 bg-white text-amber-800'
                                }`}
                              >
                                🤔 Still learning
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              soundEffects.playWordPop();
                              update({ revealed: { ...state.revealed, [i]: true } });
                            }}
                            className="workbook-reveal btn-3d mt-2 bg-violet-500 px-3 py-1.5 text-xs text-white"
                          >
                            👀 Check the answer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {step.id === 'outcomes' && (
                  <div className="space-y-3" id="workbook-outcomes">
                    <p className="text-sm font-semibold text-stone-500">Tap a face for each one. Be honest — it helps your teacher help you.</p>
                    {workbook.outcomes.map((o, i) => (
                      <div key={i} className="workbook-outcome rounded-2xl border border-emerald-100 bg-white p-3">
                        <div className="flex items-start gap-2">
                          <p className="flex-1 text-[15px] font-bold text-stone-800">{o}</p>
                          <HearButton text={o} />
                        </div>
                        <div className="mt-2 flex gap-2">
                          {FACES.map((f) => (
                            <button
                              key={f.value}
                              type="button"
                              aria-label={f.label}
                              aria-pressed={state.outcomes[i] === f.value}
                              onClick={() => {
                                soundEffects.playWordPop();
                                update({ outcomes: { ...state.outcomes, [i]: f.value } });
                              }}
                              className={`flex flex-1 flex-col items-center rounded-xl border-2 py-1.5 transition ${
                                state.outcomes[i] === f.value ? 'border-emerald-500 bg-emerald-50' : 'border-stone-100 bg-stone-50'
                              }`}
                            >
                              <span className="text-2xl">{f.face}</span>
                              <span className="text-[10px] font-black text-stone-600">{f.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {step.id === 'reflect' && (
                  <div className="space-y-3" id="workbook-reflect">
                    <div className="rounded-2xl border border-amber-100 bg-white p-3">
                      <p className="mb-2 text-xs font-black uppercase tracking-wide text-amber-800">Think about these</p>
                      <ul className="space-y-2">
                        {workbook.reflection.map((r, i) => (
                          <li key={i} className="flex items-center gap-2 text-[15px] font-semibold text-stone-800">
                            <span className="flex-1">💭 {r}</span>
                            <HearButton text={r} />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-stone-100 bg-white p-3">
                      <p className="mb-2 text-sm font-black text-stone-800">How was this chapter for you?</p>
                      <div className="flex gap-2">
                        {(
                          [
                            ['easy', '😀', 'Easy'],
                            ['ok', '🙂', 'Okay'],
                            ['hard', '😟', 'Hard'],
                          ] as const
                        ).map(([value, face, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={state.feeling === value}
                            onClick={() => {
                              soundEffects.playWordPop();
                              update({ feeling: value });
                            }}
                            className={`workbook-feeling flex flex-1 flex-col items-center rounded-xl border-2 py-2 ${
                              state.feeling === value ? 'border-emerald-500 bg-emerald-50' : 'border-stone-100 bg-stone-50'
                            }`}
                          >
                            <span className="text-3xl">{face}</span>
                            <span className="text-xs font-black text-stone-600">{label}</span>
                          </button>
                        ))}
                      </div>
                      <label className="mt-3 block text-xs font-black text-stone-600" htmlFor="workbook-note">
                        ✍️ What I learned (you can skip this)
                      </label>
                      <textarea
                        id="workbook-note"
                        value={state.note}
                        maxLength={400}
                        rows={3}
                        onChange={(e) => update({ note: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-stone-200 p-2 text-sm"
                        placeholder="I learned that…"
                      />
                    </div>
                    <div className={`rounded-2xl border-2 p-3 ${state.needHelp ? 'border-rose-300 bg-rose-50' : 'border-stone-100 bg-white'}`}>
                      <button
                        type="button"
                        id="btn-workbook-need-help"
                        aria-pressed={state.needHelp}
                        onClick={() => {
                          soundEffects.playWordPop();
                          update({ needHelp: !state.needHelp });
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${state.needHelp ? '' : 'hover:bg-stone-50'}`}
                      >
                        <span className="text-3xl">🙋</span>
                        <span className="flex-1">
                          <span className="block text-sm font-black text-stone-900">I need help from my teacher</span>
                          <span className="block text-[11px] font-semibold text-stone-500">
                            {state.needHelp ? 'Your teacher will see this. ✓' : 'Tap if something was hard.'}
                          </span>
                        </span>
                      </button>
                      {state.needHelp && (
                        <textarea
                          id="workbook-help-question"
                          value={state.helpQuestion}
                          maxLength={400}
                          rows={2}
                          onChange={(e) => update({ helpQuestion: e.target.value })}
                          className="mt-2 w-full rounded-xl border border-rose-200 bg-white p-2 text-sm"
                          placeholder="What do you want to ask? (you can skip this)"
                        />
                      )}
                    </div>
                  </div>
                )}

                {step.id === 'activity' && (
                  <div className="space-y-3" id="workbook-activity">
                    <div className="rounded-2xl border border-orange-100 bg-white p-3">
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-base font-black text-stone-900">{workbook.activity.title}</p>
                        <HearButton text={[workbook.activity.title, ...workbook.activity.steps].join('. ')} />
                      </div>
                      {workbook.activity.materials.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {workbook.activity.materials.map((m) => (
                            <span key={m} className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-800">
                              🧺 {m}
                            </span>
                          ))}
                        </div>
                      )}
                      <ol className="mt-3 space-y-2">
                        {workbook.activity.steps.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-[15px] font-semibold text-stone-800">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-400 text-xs font-black text-white">{i + 1}</span>
                            <span className="flex-1">{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <button
                      type="button"
                      id="btn-workbook-activity-done"
                      aria-pressed={state.activityDone}
                      onClick={() => {
                        soundEffects.playCorrect();
                        update({ activityDone: !state.activityDone });
                      }}
                      className={`w-full rounded-2xl border-2 py-3 text-sm font-black ${
                        state.activityDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-200 bg-white text-emerald-800'
                      }`}
                    >
                      {state.activityDone ? '✅ I did the activity!' : '☐ I did the activity'}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer: Back / Next / Finish — always open, never a trap */}
        {workbook && (
          <div className="flex items-center gap-2 border-t border-stone-100 bg-white px-4 py-3">
            <button
              type="button"
              disabled={state.step === 0}
              onClick={() => goTo(state.step - 1)}
              className="flex items-center gap-1 rounded-2xl border border-stone-200 px-3 py-2.5 text-sm font-black text-stone-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <p className="flex-1 text-center text-[11px] font-black text-stone-400">
              {state.step + 1} / {STEPS.length}
            </p>
            {isLast ? (
              <button type="button" id="btn-workbook-finish" onClick={finish} className="btn-3d bg-emerald-500 px-5 py-2.5 text-sm text-white">
                🏁 Finish
              </button>
            ) : (
              <button
                type="button"
                id="btn-workbook-next"
                onClick={() => goTo(state.step + 1)}
                className="btn-3d flex items-center gap-1 bg-emerald-500 px-5 py-2.5 text-sm text-white"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <AnimatePresence>
          {celebrate && workbook && (
            <motion.div
              id="workbook-done"
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
                <img src="/shakthi-face-256.png" alt="" className="mx-auto h-20 w-20" />
                <p className="mt-2 text-xl font-black text-stone-900">Workbook done! 🎉</p>
                <p className="mt-1 text-sm font-semibold text-stone-600">
                  {workbook.blanks.length > 0 && (
                    <>
                      ✏️ {summary.blanksCorrect} of {workbook.blanks.length} blanks right first time
                      <br />
                    </>
                  )}
                  {workbook.questions.length > 0 && (
                    <>
                      ❓ {summary.questionsKnown} of {workbook.questions.length} answers known
                      <br />
                    </>
                  )}
                  ⭐ Up to 10 stars added to your collection
                </p>
                {state.needHelp && <p className="mt-2 rounded-xl bg-rose-50 p-2 text-xs font-bold text-rose-700">🙋 Your teacher will help you with this chapter.</p>}
                <button type="button" id="btn-workbook-done-close" onClick={onClose} className="btn-3d mt-4 w-full bg-emerald-500 py-3 text-sm text-white">
                  Back to my books 📚
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

/** Mounted once for a signed-in student; opens the workbook on OPEN_WORKBOOK_EVENT. */
export const UnitWorkbookHost: React.FC<{ studentId: string | null | undefined; className?: string }> = ({ studentId, className }) => {
  const [target, setTarget] = useState<WorkbookTarget | null>(null);
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<WorkbookTarget>).detail;
      if (detail?.readingId) setTarget(detail);
    };
    window.addEventListener(OPEN_WORKBOOK_EVENT, open);
    return () => window.removeEventListener(OPEN_WORKBOOK_EVENT, open);
  }, []);
  if (!studentId || studentId === 'guest') return null;
  return (
    <AnimatePresence>
      {target && (
        <UnitWorkbookPanel key={target.readingId} target={target} studentId={studentId} className={className} onClose={() => setTarget(null)} />
      )}
    </AnimatePresence>
  );
};
