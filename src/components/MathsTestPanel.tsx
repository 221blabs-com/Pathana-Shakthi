import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Printer, Volume2, X } from 'lucide-react';
import { Language, Student } from '../types';
import { backendApi } from '../services/backendApi';
import { kidSpeech } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import { progressSync } from '../services/progressSync';
import { printHtml } from '../services/printWorkbook';
import { mathsTestHtml } from '../services/printMathsTest';
import { say, uiLangOf } from '../services/kidPrefs';
import { MATHS_KIND_ICONS, MathsTest, buildMathsTest, mathsTestResults, mathsTestScore } from '../data/mathsTest';
import { t, UiLang } from '../data/uiStrings';

// A maths chapter's test and questions & answers (src/data/mathsTest.ts).
// Maths chapters have no read-aloud: the child does the chapter's own sums and
// new ones like them, one at a time, and sees how each is worked out. First
// tries go to the teacher as the chapter's quiz score.

export const OPEN_MATHS_TEST_EVENT = 'pathana:open-maths-test';
export type MathsTestMode = 'test' | 'qa';
export type MathsTestTarget = { readingId: string; chapterTitle: string; subject?: string; mode?: MathsTestMode };

/** Open a maths chapter's test (or its Q&A) from anywhere (handled by <MathsTestHost/>). */
export function openMathsTest(target: MathsTestTarget) {
  window.dispatchEvent(new CustomEvent<MathsTestTarget>(OPEN_MATHS_TEST_EVENT, { detail: target }));
}

const doneKey = (studentId: string, readingId: string) => `ps_mathstest_${studentId}_${readingId}`;

/** The child's last finished test of a chapter on this device ({right, total}), if any. */
export function loadMathsTestDone(studentId: string, readingId: string): { right: number; total: number } | null {
  try {
    const raw = localStorage.getItem(doneKey(studentId, readingId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const speak = (text: string, language: Language) => {
  kidSpeech.stop();
  void kidSpeech.speakText(text.replace(/\?$/, '').replace(/ = $/, ''), language).catch(() => undefined);
};

/** A worked answer, one step per line ("Ones: … · Tens: … ⇒ 734"). */
const Steps: React.FC<{ text: string }> = ({ text }) => {
  const [work, result] = text.split(' ⇒ ');
  return (
    <ul className="mt-1 space-y-0.5 text-sm font-bold text-emerald-900">
      {work.split(' · ').map((line, i) => (
        <li key={i}>{line}</li>
      ))}
      {result && <li className="text-base font-black text-emerald-700">= {result}</li>}
    </ul>
  );
};

interface QState {
  wrong: string[];
  solved: boolean;
  shown: boolean;
}
const FRESH: QState = { wrong: [], solved: false, shown: false };

const TestView: React.FC<{ test: MathsTest; lang: UiLang; onFinish: (right: number, total: number, results: ReturnType<typeof mathsTestResults>) => void; onClose: () => void }> = ({ test, lang, onFinish, onClose }) => {
  const language = test.language as Language;
  const [index, setIndex] = useState(0);
  const [q, setQ] = useState<QState>(FRESH);
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [shake, setShake] = useState(0);
  const current = test.questions[index];
  const score = useMemo(() => mathsTestScore(test.questions, firstTry), [test, firstTry]);

  const choose = (option: string) => {
    if (!current || q.solved || q.wrong.includes(option)) return;
    if (option === current.answer) {
      setFirstTry((f) => (index in f ? f : { ...f, [index]: q.wrong.length === 0 }));
      setQ((s) => ({ ...s, solved: true }));
      soundEffects.playCorrect();
      say(t(lang, 'practiceRight'), lang);
      return;
    }
    setFirstTry((f) => (index in f ? f : { ...f, [index]: false }));
    setShake((n) => n + 1);
    soundEffects.playTryAgain();
    setQ((s) => {
      const wrong = [...s.wrong, option];
      // Two misses: show the answer and how it is worked, so a child is never stuck.
      if (wrong.length >= 2) {
        say(t(lang, 'practiceShow'), lang);
        return { wrong, solved: true, shown: true };
      }
      say(t(lang, 'practiceTryAgain'), lang);
      return { ...s, wrong };
    });
  };

  const next = () => {
    kidSpeech.stop();
    if (index + 1 < test.questions.length) {
      setIndex(index + 1);
      setQ(FRESH);
      return;
    }
    setFinished(true);
    soundEffects.playVictoryFanfare();
    say(t(lang, 'practiceDone', { n: score.right }), lang);
    onFinish(score.right, test.questions.length, mathsTestResults(test.questions, firstTry));
  };

  const optionClass = (o: string) => {
    if (q.solved && o === current.answer) return 'border-emerald-500 bg-emerald-500 text-white';
    if (q.wrong.includes(o)) return 'border-rose-300 bg-rose-50 text-rose-400 line-through';
    return 'border-stone-200 bg-white text-stone-900 hover:border-emerald-300 active:scale-95';
  };

  if (finished)
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4 py-6 text-center" id="maths-test-done">
        <p className="text-6xl" aria-hidden>
          🏆
        </p>
        <p className="text-xl font-black text-stone-900">{t(lang, 'practiceDone', { n: score.right })}</p>
        <p className="text-3xl font-black text-emerald-700">
          {score.right} / {test.questions.length}
        </p>
        <button type="button" id="btn-maths-test-close" onClick={onClose} className="btn-3d w-full bg-emerald-500 py-3 text-base text-white">
          {t(lang, 'back')}
        </button>
      </motion.div>
    );

  return (
    <div className="space-y-5">
      <div className="flex gap-1" aria-label={`Question ${index + 1} of ${test.questions.length}`}>
        {test.questions.map((_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i in firstTry ? (firstTry[i] ? 'bg-emerald-500' : 'bg-amber-400') : i === index ? 'bg-sky-400' : 'bg-stone-200'}`} />
        ))}
      </div>
      <motion.div key={index} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5" id="maths-question" data-kind={current.kind}>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-stone-500">
          <span className="text-lg" aria-hidden>
            {MATHS_KIND_ICONS[current.kind]}
          </span>
          {current.fromChapter ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{t(lang, 'fromYourChapter')}</span> : null}
          <span className="ml-auto">
            {index + 1} / {test.questions.length}
          </span>
        </div>
        <motion.div
          animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          key={`shake-${shake}`}
          className="flex items-center gap-3 rounded-3xl border-2 border-stone-100 bg-white px-5 py-6"
        >
          <p className={`flex-1 font-black text-stone-900 ${current.prompt.length < 24 ? 'text-center text-4xl tracking-wide' : 'text-xl leading-relaxed'}`} id="maths-prompt">
            {current.prompt}
          </p>
          <button
            type="button"
            aria-label="Hear the question"
            onClick={() => speak(current.prompt, language)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200"
          >
            <Volume2 className="h-5 w-5" />
          </button>
        </motion.div>
        <div className="grid grid-cols-2 gap-3" id="maths-options">
          {current.options.map((o) => (
            <button
              key={o}
              type="button"
              aria-disabled={q.solved}
              onClick={() => choose(o)}
              className={`maths-option rounded-2xl border-2 px-3 py-4 font-black transition ${o.length > 14 ? 'text-base' : 'text-2xl'} ${optionClass(o)}`}
            >
              {o}
            </button>
          ))}
        </div>
        {q.solved && (
          <>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3" id="maths-explain">
              <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">{t(lang, 'howSolved')}</p>
              <Steps text={current.explain} />
            </div>
            <button type="button" id="btn-maths-next" onClick={next} className="btn-3d w-full bg-emerald-500 py-3.5 text-lg text-white">
              {index + 1 < test.questions.length ? `${t(lang, 'practiceNext')} ➜` : '🏁'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

const QaView: React.FC<{ test: MathsTest; lang: UiLang }> = ({ test, lang }) => {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const all = test.questions.every((_, i) => open[i]);
  return (
    <div className="space-y-3" id="maths-qa">
      <button
        type="button"
        id="btn-maths-show-all"
        onClick={() => setOpen(all ? {} : Object.fromEntries(test.questions.map((_, i) => [i, true])))}
        className="w-full rounded-2xl border-2 border-dashed border-emerald-300 py-2.5 text-sm font-black text-emerald-800 hover:bg-emerald-50"
      >
        {all ? '🙈' : '👀'} {t(lang, 'showAllAnswers')}
      </button>
      <ol className="space-y-3">
        {test.questions.map((q, i) => (
          <li key={i} className="maths-qa-item rounded-2xl border border-stone-200 bg-white p-4">
            <p className="flex items-start gap-2 text-base font-black text-stone-900">
              <span className="text-stone-400">{i + 1}.</span>
              <span className="flex-1">{q.prompt}</span>
              <span aria-hidden>{MATHS_KIND_ICONS[q.kind]}</span>
            </p>
            {open[i] ? (
              <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2">
                <p className="text-lg font-black text-emerald-800">✔ {q.answer}</p>
                <Steps text={q.explain} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [i]: true }))}
                className="maths-qa-show mt-2 rounded-xl bg-stone-100 px-3 py-1.5 text-xs font-black text-stone-700 hover:bg-stone-200"
              >
                {t(lang, 'showAnswer')}
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};

const MathsTestPanel: React.FC<{ target: MathsTestTarget; student: Student; onClose: () => void }> = ({ target, student, onClose }) => {
  const lang: UiLang = uiLangOf(student);
  const [test, setTest] = useState<MathsTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MathsTestMode>(target.mode || 'test');

  useEffect(() => {
    let cancelled = false;
    backendApi.readings
      .get(target.readingId)
      .then(({ reading }) => {
        if (cancelled) return;
        setTest(buildMathsTest({ ...reading, id: target.readingId, grade: student.grade || reading.grade }));
      })
      .catch((e: any) => !cancelled && setError(e?.message || 'Could not open this chapter.'));
    return () => {
      cancelled = true;
      kidSpeech.stop();
    };
  }, [target.readingId, student.grade]);

  useEffect(() => {
    if (test && mode === 'test') say(t(lang, 'mathsTestIntro'), lang);
  }, [test, mode, lang]);

  const finish = (right: number, total: number, results: ReturnType<typeof mathsTestResults>) => {
    try {
      localStorage.setItem(doneKey(student.id, target.readingId), JSON.stringify({ right, total }));
    } catch {
      // Storage blocked: the teacher still gets the result.
    }
    // The chapter's quiz score: stars for the child, comprehension/operations evidence for the teacher.
    progressSync.record({ type: 'quiz', storyId: `reading_${target.readingId}`, correct: right, total, maths: results as Record<string, { right: number; total: number }> });
    window.dispatchEvent(new CustomEvent(MATHS_TEST_SAVED_EVENT, { detail: { readingId: target.readingId } }));
  };

  const tab = (m: MathsTestMode, label: string, icon: string) => (
    <button
      type="button"
      id={`maths-tab-${m}`}
      aria-pressed={mode === m}
      onClick={() => {
        kidSpeech.stop();
        setMode(m);
      }}
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-black transition ${mode === m ? 'bg-white text-stone-900 shadow' : 'text-stone-500 hover:text-stone-800'}`}
    >
      <span aria-hidden>{icon}</span> {label}
    </button>
  );

  return (
    <motion.div className="fixed inset-0 z-[85] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        id="maths-test"
        role="dialog"
        aria-label={`Maths: ${target.chapterTitle}`}
        initial={{ y: 30 }}
        animate={{ y: 0 }}
        className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-[#fffdf7] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl"
      >
        <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-emerald-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              🧮
            </span>
            <p className="min-w-0 flex-1 truncate text-base font-black text-stone-900">{target.chapterTitle}</p>
            {test && test.questions.length > 0 && (
              <button
                type="button"
                id="btn-maths-print"
                aria-label="Print the test"
                onClick={() => printHtml(mathsTestHtml(target.chapterTitle, test, { answers: mode === 'qa', className: student.grade }))}
                className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
              >
                <Printer className="h-4 w-4" />
              </button>
            )}
            <button type="button" id="btn-maths-close" aria-label="Close" onClick={onClose} className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-1 rounded-2xl bg-stone-100 p-1">
            {tab('test', t(lang, 'mathsTest'), '🧮')}
            {tab('qa', t(lang, 'mathsQaShort'), '❓')}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {!test && !error && (
            <p className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-stone-500">
              <Loader2 className="h-5 w-5 animate-spin" /> …
            </p>
          )}
          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
          {test && (mode === 'test' ? <TestView test={test} lang={lang} onFinish={finish} onClose={onClose} /> : <QaView test={test} lang={lang} />)}
        </div>
      </motion.div>
    </motion.div>
  );
};

export const MATHS_TEST_SAVED_EVENT = 'pathana:maths-test-saved';

/** Mounted once for a signed-in student; opens a maths test on OPEN_MATHS_TEST_EVENT. */
export const MathsTestHost: React.FC<{ student: Student | null | undefined }> = ({ student }) => {
  const [target, setTarget] = useState<MathsTestTarget | null>(null);
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<MathsTestTarget>).detail;
      if (detail?.readingId) setTarget(detail);
    };
    window.addEventListener(OPEN_MATHS_TEST_EVENT, open);
    return () => window.removeEventListener(OPEN_MATHS_TEST_EVENT, open);
  }, []);
  if (!student || !student.id || student.id === 'guest') return null;
  return (
    <AnimatePresence>
      {target && <MathsTestPanel key={`${target.readingId}-${target.mode || 'test'}`} target={target} student={student} onClose={() => setTarget(null)} />}
    </AnimatePresence>
  );
};
