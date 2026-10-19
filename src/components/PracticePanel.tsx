import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Printer, Volume2, X } from 'lucide-react';
import { Language, Student } from '../types';
import { backendApi } from '../services/backendApi';
import { kidSpeech } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import { progressSync } from '../services/progressSync';
import { printHtml } from '../services/printWorkbook';
import { practiceHtml } from '../services/printPractice';
import { say, uiLangOf } from '../services/kidPrefs';
import { DICTIONARY_WORDS } from '../data/dictionary';
import { PRACTICE_KINDS, PracticeItem, PracticeSet, buildPractice, practiceResults } from '../data/practice';
import { t, UiLang } from '../data/uiStrings';

// FLN practice for a chapter (src/data/practice.ts): picture and word, listen
// and choose, first sound, missing letter, words in order, word and meaning —
// one item at a time, big buttons, every instruction said aloud in the
// child's screen language. First tries go to the teacher (activity
// "practice") as evidence for phonics, vocabulary, decoding and comprehension.

export const OPEN_PRACTICE_EVENT = 'pathana:open-practice';
export type PracticeTarget = { readingId: string; chapterTitle: string; subject?: string };

/** Open a chapter's practice from anywhere (handled by <PracticeHost/>). */
export function openPractice(target: PracticeTarget) {
  window.dispatchEvent(new CustomEvent<PracticeTarget>(OPEN_PRACTICE_EVENT, { detail: target }));
}

const doneKey = (studentId: string, readingId: string) => `ps_practice_${studentId}_${readingId}`;

/** The child's last practice of a chapter on this device ({right, total}), if any. */
export function loadPracticeDone(studentId: string, readingId: string): { right: number; total: number } | null {
  try {
    const raw = localStorage.getItem(doneKey(studentId, readingId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const speakWord = (word: string, language: Language) => {
  kidSpeech.stop();
  void kidSpeech.speakText(word, language).catch(() => undefined);
};

const indic = (language: Language) => language !== 'English';

interface ItemState {
  wrong: string[];
  solved: boolean;
  shown: boolean;
  /** Words in order: indexes of the tiles tapped so far. */
  built: number[];
}
const FRESH: ItemState = { wrong: [], solved: false, shown: false, built: [] };

const PracticePanel: React.FC<{ target: PracticeTarget; student: Student; onClose: () => void }> = ({ target, student, onClose }) => {
  const lang: UiLang = uiLangOf(student);
  const [set, setSet] = useState<PracticeSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [item, setItem] = useState<ItemState>(FRESH);
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    let cancelled = false;
    backendApi.readings
      .get(target.readingId)
      .then(({ reading }) => {
        if (cancelled) return;
        setSet(
          buildPractice(
            {
              id: target.readingId,
              grade: student.grade || reading.grade,
              paragraphs: reading.paragraphs || [],
              keyVocabulary: reading.keyVocabulary || [],
            },
            DICTIONARY_WORDS
          )
        );
      })
      .catch((e: any) => !cancelled && setError(e?.message || 'Could not open this chapter.'));
    return () => {
      cancelled = true;
      kidSpeech.stop();
    };
  }, [target.readingId, student.grade]);

  const current: PracticeItem | undefined = set?.items[index];
  const language = (set?.language || 'English') as Language;

  // Say the instruction when an item opens; for listening items, then the word.
  const introduce = useCallback(
    (it: PracticeItem) => {
      const hear = it.kind === 'listen_choose' || it.kind === 'first_sound';
      say(t(lang, `practice_${it.kind}` as any), lang, hear ? () => setTimeout(() => speakWord(it.word, language), 250) : undefined);
    },
    [lang, language]
  );
  useEffect(() => {
    if (current && !finished) introduce(current);
  }, [current, finished, introduce]);

  const results = useMemo(() => (set ? practiceResults(set.items, firstTry) : {}), [set, firstTry]);
  const right = Object.values(results).reduce((n, r) => n + (r?.right || 0), 0);

  const solve = (wasFirstTry: boolean) => {
    setFirstTry((f) => (index in f ? f : { ...f, [index]: wasFirstTry }));
    setItem((s) => ({ ...s, solved: true }));
    soundEffects.playCorrect();
    say(t(lang, 'practiceRight'), lang);
  };
  const miss = (option?: string) => {
    setFirstTry((f) => (index in f ? f : { ...f, [index]: false }));
    setShake((n) => n + 1);
    soundEffects.playTryAgain();
    setItem((s) => {
      const wrong = option ? [...s.wrong, option] : [...s.wrong, `try${s.wrong.length}`];
      // After two misses the answer is shown, so a child is never stuck.
      if (wrong.length >= 2) {
        say(t(lang, 'practiceShow'), lang);
        return { ...s, wrong, solved: true, shown: true, built: [] };
      }
      say(t(lang, 'practiceTryAgain'), lang);
      return { ...s, wrong, built: [] };
    });
  };

  const choose = (option: string) => {
    if (!current || item.solved || item.wrong.includes(option)) return;
    if (option === current.answer) solve(item.wrong.length === 0);
    else miss(option);
  };

  const tapTile = (tile: number) => {
    if (!current || item.solved || item.built.includes(tile)) return;
    soundEffects.playWordPop();
    const built = [...item.built, tile];
    setItem((s) => ({ ...s, built }));
    if (built.length === current.options.length) {
      const sentence = built.map((i) => current.options[i]).join(' ');
      if (sentence === current.answer) {
        solve(item.wrong.length === 0);
        speakWord(sentence, language);
      } else setTimeout(() => miss(), 350);
    }
  };

  const next = () => {
    if (!set) return;
    kidSpeech.stop();
    if (index + 1 < set.items.length) {
      setIndex(index + 1);
      setItem(FRESH);
      return;
    }
    setFinished(true);
    soundEffects.playVictoryFanfare();
    say(t(lang, 'practiceDone', { n: right }), lang);
    try {
      localStorage.setItem(doneKey(student.id, target.readingId), JSON.stringify({ right, total: set.items.length }));
    } catch {
      // Storage blocked: the teacher still gets the result.
    }
    progressSync.record({
      type: 'practice',
      readingId: target.readingId,
      chapterTitle: target.chapterTitle,
      subject: target.subject,
      results,
    });
  };

  const optionClass = (o: string) => {
    if (!current) return '';
    if (item.solved && o === current.answer) return 'border-emerald-500 bg-emerald-500 text-white';
    if (item.wrong.includes(o)) return 'border-rose-300 bg-rose-50 text-rose-400 line-through';
    return 'border-stone-200 bg-white text-stone-900 hover:border-emerald-300 active:scale-95';
  };
  const big = indic(language) ? 'leading-[1.9]' : '';

  return (
    <motion.div
      className="fixed inset-0 z-[85] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        id="chapter-practice"
        role="dialog"
        aria-label={`Practice: ${target.chapterTitle}`}
        initial={{ y: 30 }}
        animate={{ y: 0 }}
        className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-[#fffdf7] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl"
      >
        <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 to-emerald-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              🎯
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">{t(lang, 'practice')}</p>
              <p className="truncate text-base font-black text-stone-900">{target.chapterTitle}</p>
            </div>
            {set && set.items.length > 0 && (
              <button
                type="button"
                id="btn-practice-print"
                aria-label="Print the practice sheet"
                onClick={() => printHtml(practiceHtml(target.chapterTitle, set, { className: student.grade }))}
                className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
              >
                <Printer className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              id="btn-practice-close"
              aria-label="Close"
              onClick={onClose}
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {set && set.items.length > 0 && (
            <div className="mt-3 flex gap-1" aria-label={`Item ${Math.min(index + 1, set.items.length)} of ${set.items.length}`}>
              {set.items.map((it, i) => (
                <span
                  key={i}
                  title={PRACTICE_KINDS[it.kind].name}
                  className={`h-2 flex-1 rounded-full ${
                    i in firstTry ? (firstTry[i] ? 'bg-emerald-500' : 'bg-amber-400') : i === index && !finished ? 'bg-sky-400' : 'bg-stone-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {!set && !error && (
            <p className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-stone-500">
              <Loader2 className="h-5 w-5 animate-spin" /> …
            </p>
          )}
          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
          {set && set.items.length === 0 && (
            <p className="py-12 text-center text-base font-bold text-stone-600" id="practice-none">
              {t(lang, 'practiceNone')}
            </p>
          )}

          {current && !finished && (
            <motion.div key={index} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5" id="practice-item" data-kind={current.kind}>
              <div className="flex items-start gap-2">
                <span className="text-2xl" aria-hidden>
                  {PRACTICE_KINDS[current.kind].icon}
                </span>
                <p className="flex-1 text-lg font-black text-stone-800">{t(lang, `practice_${current.kind}` as any)}</p>
                <button
                  type="button"
                  aria-label="Hear the instruction again"
                  onClick={() => introduce(current)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>

              {/* What the child looks at: a picture, the gapped word, the word, or a big "hear it" button. */}
              <motion.div
                animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                key={`shake-${shake}`}
                className="flex flex-col items-center gap-3 rounded-3xl border-2 border-stone-100 bg-white px-4 py-6 text-center"
              >
                {current.emoji && current.kind !== 'listen_choose' && (
                  <span className="text-7xl" aria-hidden>
                    {current.emoji}
                  </span>
                )}
                {current.kind === 'missing_letter' && (
                  <p className={`text-4xl font-black tracking-wide text-stone-900 ${big}`}>
                    {item.solved ? current.display!.replace('_', current.answer) : current.display}
                  </p>
                )}
                {current.kind === 'word_meaning' && <p className={`text-4xl font-black text-stone-900 ${big}`}>{current.word}</p>}
                {(current.kind === 'listen_choose' || current.kind === 'first_sound' || current.kind === 'missing_letter' || current.kind === 'word_meaning') && (
                  <button
                    type="button"
                    id="btn-practice-hear"
                    onClick={() => speakWord(current.word, language)}
                    className="btn-3d inline-flex items-center gap-2 bg-sky-500 px-5 py-3 text-base text-white"
                  >
                    <Volume2 className="h-5 w-5" /> {t(lang, 'hearWord')}
                  </button>
                )}
                {(item.solved && (current.kind === 'first_sound' || current.kind === 'listen_choose')) && (
                  <p className={`text-3xl font-black text-emerald-700 ${big}`}>{current.word}</p>
                )}
                {current.kind === 'word_order' && (
                  <p className={`min-h-[3rem] text-2xl font-black text-stone-900 ${big}`} id="practice-built">
                    {(item.shown ? current.answer.split(' ') : item.built.map((i) => current.options[i])).join(' ') || '…'}
                  </p>
                )}
              </motion.div>

              {current.kind === 'word_order' ? (
                <div className="flex flex-wrap justify-center gap-2" id="practice-options">
                  {current.options.map((w, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={item.solved || item.built.includes(i)}
                      onClick={() => tapTile(i)}
                      className={`practice-option rounded-2xl border-2 px-4 py-3 text-xl font-black transition ${big} ${
                        item.built.includes(i) || item.solved ? 'border-stone-100 bg-stone-50 text-stone-300' : 'border-stone-200 bg-white text-stone-900 active:scale-95'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`grid gap-3 ${current.kind === 'word_meaning' ? 'grid-cols-1' : 'grid-cols-3'}`} id="practice-options">
                  {current.options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      // Not "disabled" once solved: that would fade the right answer the child should see.
                      aria-disabled={item.solved}
                      onClick={() => choose(o)}
                      className={`practice-option rounded-2xl border-2 px-3 py-4 font-black transition ${big} ${
                        current.kind === 'word_meaning' ? 'text-left text-base' : 'text-2xl'
                      } ${optionClass(o)}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}

              {item.solved && (
                <button type="button" id="btn-practice-next" onClick={next} className="btn-3d w-full bg-emerald-500 py-3.5 text-lg text-white">
                  {index + 1 < (set?.items.length || 0) ? `${t(lang, 'practiceNext')} ➜` : '🏁'}
                </button>
              )}
            </motion.div>
          )}

          <AnimatePresence>
            {finished && set && (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4 py-6 text-center" id="practice-done">
                <p className="text-6xl" aria-hidden>
                  🏆
                </p>
                <p className="text-xl font-black text-stone-900">{t(lang, 'practiceDone', { n: right })}</p>
                <p className="text-sm font-bold text-amber-700">⭐ +{Math.min(right, 12)}</p>
                <ul className="mx-auto max-w-sm space-y-1 text-left">
                  {Object.entries(results).map(([kind, r]) => (
                    <li key={kind} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-stone-700">
                      <span aria-hidden>{PRACTICE_KINDS[kind as keyof typeof PRACTICE_KINDS].icon}</span>
                      <span className="flex-1">{PRACTICE_KINDS[kind as keyof typeof PRACTICE_KINDS].name}</span>
                      <span>
                        {r!.right} / {r!.total}
                      </span>
                    </li>
                  ))}
                </ul>
                <button type="button" id="btn-practice-done-close" onClick={onClose} className="btn-3d w-full bg-emerald-500 py-3 text-base text-white">
                  {t(lang, 'back')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

/** Mounted once for a signed-in student; opens practice on OPEN_PRACTICE_EVENT. */
export const PracticeHost: React.FC<{ student: Student | null | undefined }> = ({ student }) => {
  const [target, setTarget] = useState<PracticeTarget | null>(null);
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<PracticeTarget>).detail;
      if (detail?.readingId) setTarget(detail);
    };
    window.addEventListener(OPEN_PRACTICE_EVENT, open);
    return () => window.removeEventListener(OPEN_PRACTICE_EVENT, open);
  }, []);
  if (!student || !student.id || student.id === 'guest') return null;
  return (
    <AnimatePresence>
      {target && <PracticePanel key={target.readingId} target={target} student={student} onClose={() => setTarget(null)} />}
    </AnimatePresence>
  );
};
