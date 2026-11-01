import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Loader2, Mic, Square, Volume2, X } from 'lucide-react';
import { Language, PublishedReadingImage, Student } from '../types';
import { backendApi } from '../services/backendApi';
import { speechRecognition } from '../services/speechRecognition';
import { kidSpeech } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import { say, uiLangOf } from '../services/kidPrefs';
import { t, UiLang } from '../data/uiStrings';
import {
  FlnAnswer,
  FlnCheck,
  FlnQuestion,
  FlnResult,
  FlnSentenceResult,
  OrfNorm,
  comprehensionScore,
  flnSummary,
  wordsCorrectPerMinute,
} from '../data/flnCheck';

// A chapter's FLN check for the child (src/data/flnCheck.ts): read sentences
// aloud, read a passage aloud (words correct per minute against the class's
// norm), answer questions on it, and write about a picture on paper. Each part
// is saved when it is finished, with mistakes and tries, for the teacher.

export const OPEN_FLN_EVENT = 'pathana:open-fln';
export type FlnTarget = { readingId: string; chapterTitle: string; subject?: string };

/** Open a chapter's FLN check from anywhere (handled by <FlnCheckHost/>). */
export function openFlnCheck(target: FlnTarget) {
  window.dispatchEvent(new CustomEvent<FlnTarget>(OPEN_FLN_EVENT, { detail: target }));
}

/** Fired after a part is saved, so chapter rows can refresh their results. */
export const FLN_SAVED_EVENT = 'pathana:fln-saved';

type Part = 'sentences' | 'orf' | 'questions' | 'writing';
const PARTS: { id: Part; icon: string; key: 'fln_sentences' | 'fln_orf' | 'fln_questions' | 'fln_writing' }[] = [
  { id: 'sentences', icon: '📖', key: 'fln_sentences' },
  { id: 'orf', icon: '⏱️', key: 'fln_orf' },
  { id: 'questions', icon: '❓', key: 'fln_questions' },
  { id: 'writing', icon: '✍️', key: 'fln_writing' },
];

const speechLang = (language: string): Language => (language === 'Telugu' || language === 'Hindi' ? language : 'English');
const isIndic = (language: string) => language === 'Telugu' || language === 'Hindi';

const partDone = (part: Part, r: FlnResult | null) =>
  part === 'sentences' ? !!r?.sentences?.length : part === 'orf' ? !!r?.orf : part === 'questions' ? !!r?.comprehension?.answers?.length : !!r?.writing?.done;

/* ------------------------------ read aloud ------------------------------ */

interface ReadResult {
  accuracy: number;
  correct: number;
  words: number;
  seconds: number;
  missed: string[];
}

/** Shows a text word by word, listens to the child read it and colours each word. */
const MicReader: React.FC<{ text: string; language: string; big?: boolean; onResult: (r: ReadResult) => void; autoFocus?: boolean }> = ({ text, language, big, onResult }) => {
  const tokens = text.split(/\s+/).filter(Boolean);
  const [statuses, setStatuses] = useState<Array<'pending' | 'correct' | 'wrong'>>(tokens.map(() => 'pending'));
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const endedAt = useRef(0);

  useEffect(() => () => speechRecognition.cancel(false), []);
  useEffect(() => {
    setStatuses(text.split(/\s+/).filter(Boolean).map(() => 'pending'));
    setError(null);
  }, [text]);

  const start = () => {
    soundEffects.playWordPop();
    setError(null);
    setStatuses(tokens.map(() => 'pending'));
    startedAt.current = 0;
    endedAt.current = 0;
    void speechRecognition.startListening(
      speechLang(language),
      tokens,
      (res) => {
        setStatuses(res.wordStatuses);
        if (!res.isComplete) return;
        // Reading time: the longer of the wall clock and the speech the voice detector heard
        // (a fast stop must never make the words-per-minute look higher than it was).
        const wall = ((endedAt.current || Date.now()) - (startedAt.current || Date.now())) / 1000;
        const seconds = Math.min(29, Math.max(1, wall, res.durationSeconds || 0));
        const correct = res.wordStatuses.filter((s) => s === 'correct').length;
        onResult({
          accuracy: Math.round(res.accuracy),
          correct,
          words: tokens.length,
          seconds: Math.round(seconds),
          missed: tokens.filter((_, i) => res.wordStatuses[i] === 'wrong').map((w) => w.replace(/[^\p{L}\p{M}\p{N}'-]/gu, '')).filter(Boolean),
        });
      },
      (err) => {
        setPhase('idle');
        setError(err || 'The microphone could not hear you. Try again!');
      },
      undefined,
      {
        maxDurationMs: 29000,
        silenceTimeoutMs: 5000,
        interimIntervalMs: 4000,
        stopWhenAllMatched: true,
        onPhase: (p) => {
          if (p === 'recording' && !startedAt.current) startedAt.current = Date.now();
          if (p === 'processing' && !endedAt.current) endedAt.current = Date.now();
          setPhase(p);
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      <p className={`flex flex-wrap gap-x-2 gap-y-1 rounded-3xl border-2 border-stone-100 bg-white p-4 font-bold text-stone-900 ${big ? 'text-3xl' : 'text-xl'} ${isIndic(language) ? 'leading-[1.9]' : 'leading-relaxed'}`} id="fln-read-text">
        {tokens.map((w, i) => (
          <span key={i} className={statuses[i] === 'correct' ? 'text-emerald-600' : statuses[i] === 'wrong' ? 'text-rose-600 underline decoration-wavy' : ''}>
            {w}
          </span>
        ))}
      </p>
      <div className="flex justify-center">
        {phase === 'recording' ? (
          <button type="button" onClick={() => speechRecognition.stopListening()} className="btn-3d inline-flex items-center gap-2 bg-rose-500 px-6 py-3 text-lg text-white" id="btn-fln-stop">
            <Square className="h-5 w-5" /> Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={phase === 'processing'}
            onClick={start}
            className="btn-3d inline-flex items-center gap-2 bg-sky-500 px-6 py-3 text-lg text-white disabled:opacity-60"
            id="btn-fln-mic"
          >
            {phase === 'processing' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />} Read
          </button>
        )}
      </div>
      {error && <p className="text-center text-sm font-bold text-rose-700">{error}</p>}
    </div>
  );
};

/* ------------------------------ the panel ------------------------------ */

const FlnCheckPanel: React.FC<{ target: FlnTarget; student: Student; onClose: () => void }> = ({ target, student, onClose }) => {
  const lang: UiLang = uiLangOf(student);
  const [check, setCheck] = useState<FlnCheck | null>(null);
  const [norm, setNorm] = useState<OrfNorm | null>(null);
  const [result, setResult] = useState<FlnResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<Part | 'menu' | 'done'>('menu');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([backendApi.readings.flnCheck(target.readingId), backendApi.fln.mine().catch(() => ({ results: {} as Record<string, FlnResult> }))])
      .then(([c, mine]) => {
        if (cancelled) return;
        setCheck(c.check);
        setNorm(c.norm);
        setResult(mine.results[target.readingId] || null);
      })
      .catch((e) => !cancelled && setError(e?.message || 'Could not open the reading check.'));
    return () => {
      cancelled = true;
      kidSpeech.stop();
    };
  }, [target.readingId]);

  const nextAfter = (part: Part, r: FlnResult | null): Part | 'done' => {
    const order = PARTS.map((p) => p.id);
    const later = order.slice(order.indexOf(part) + 1).find((p) => !partDone(p, r));
    return later || order.find((p) => !partDone(p, r)) || 'done';
  };

  const save = async (part: Part, body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const r = await backendApi.fln.save(target.readingId, { part: part === 'questions' ? 'comprehension' : part, ...body });
      setResult(r.result);
      window.dispatchEvent(new CustomEvent(FLN_SAVED_EVENT, { detail: { readingId: target.readingId, result: r.result } }));
      soundEffects.playStarChime();
      return r.result;
    } catch (e: any) {
      setError(e?.message || 'Could not save. Try again.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const go = (part: Part | 'menu' | 'done') => {
    setView(part);
    if (part === 'sentences') say(t(lang, 'fln_tapMic'), lang);
    if (part === 'orf') say(t(lang, 'fln_orfIntro'), lang);
    if (part === 'writing') say(t(lang, 'fln_writeOnPaper'), lang);
    if (part === 'done') say(t(lang, 'fln_allDone'), lang);
  };

  const summary = flnSummary(result);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#fffaf0] p-4 shadow-2xl sm:rounded-3xl"
        id="fln-check"
      >
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-sky-700">🧪 {t(lang, 'fln')}</p>
            <h2 className="truncate text-lg font-black text-stone-900">{target.chapterTitle}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white p-2 text-stone-500 shadow" id="btn-fln-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>}
        {!check && !error && (
          <p className="flex items-center gap-2 py-10 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> …
          </p>
        )}

        {check && view === 'menu' && (
          <div className="space-y-2" id="fln-menu">
            {PARTS.map((p) => {
              const done = partDone(p.id, result);
              const metric =
                p.id === 'sentences' && summary.sentences !== null
                  ? `${summary.sentences}%`
                  : p.id === 'orf' && summary.wcpm !== null
                    ? `${summary.wcpm} / ${summary.target}`
                    : p.id === 'questions' && summary.comprehension
                      ? `${summary.comprehension.score}/${summary.comprehension.max}${summary.comprehension.unmarked ? ' …' : ''}`
                      : p.id === 'writing' && summary.writing
                        ? summary.writing.score !== null
                          ? `${summary.writing.score}/10`
                          : '✓'
                        : '';
              const empty = (p.id === 'sentences' && !check.sentences.length) || ((p.id === 'orf' || p.id === 'questions') && !check.passage);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={empty}
                  onClick={() => go(p.id)}
                  className={`fln-part flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left disabled:opacity-40 ${done ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white'}`}
                  data-part={p.id}
                >
                  <span className="text-3xl" aria-hidden>
                    {p.icon}
                  </span>
                  <span className="flex-1 text-base font-black text-stone-900">{t(lang, p.key)}</span>
                  {metric && <span className="text-sm font-black text-emerald-700">{metric}</span>}
                  {done && <Check className="h-5 w-5 text-emerald-600" />}
                </button>
              );
            })}
            <button
              type="button"
              id="btn-fln-start"
              onClick={() => go(PARTS.map((p) => p.id).find((p) => !partDone(p, result)) || 'sentences')}
              className="btn-3d mt-2 w-full bg-emerald-500 py-3.5 text-lg text-white"
            >
              ▶
            </button>
          </div>
        )}

        {check && view === 'sentences' && (
          <SentencesPart
            check={check}
            lang={lang}
            saving={saving}
            onSave={async (sentences) => {
              const r = await save('sentences', { sentences });
              if (r) go(nextAfter('sentences', r));
            }}
          />
        )}
        {check && view === 'orf' && norm && (
          <OrfPart
            check={check}
            norm={norm}
            lang={lang}
            saving={saving}
            onSave={async (orf) => {
              const r = await save('orf', { orf });
              if (r) return r;
              return null;
            }}
            onNext={() => go(nextAfter('orf', result))}
          />
        )}
        {check && view === 'questions' && (
          <QuestionsPart
            check={check}
            lang={lang}
            saving={saving}
            onSave={(answers) => save('questions', { answers })}
            onNext={() => go(nextAfter('questions', result))}
          />
        )}
        {check && view === 'writing' && (
          <WritingPart
            check={check}
            readingId={target.readingId}
            lang={lang}
            saving={saving}
            done={!!result?.writing?.done}
            onSave={async () => {
              const r = await save('writing', {});
              if (r) go(nextAfter('writing', r));
            }}
          />
        )}
        {view === 'done' && (
          <div className="space-y-4 py-6 text-center" id="fln-done">
            <p className="text-6xl" aria-hidden>
              🏆
            </p>
            <p className="text-xl font-black text-stone-900">{t(lang, 'fln_allDone')}</p>
            <button type="button" onClick={() => setView('menu')} className="btn-3d w-full bg-emerald-500 py-3 text-base text-white">
              ✓
            </button>
          </div>
        )}
        {check && view !== 'menu' && view !== 'done' && (
          <button type="button" onClick={() => setView('menu')} className="mt-4 w-full rounded-2xl border border-stone-200 bg-white py-2 text-sm font-black text-stone-600">
            ☰ {t(lang, 'fln')}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};

/* ------------------------------ 📖 sentences ------------------------------ */

const SentencesPart: React.FC<{ check: FlnCheck; lang: UiLang; saving: boolean; onSave: (s: FlnSentenceResult[]) => void }> = ({ check, lang, saving, onSave }) => {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<FlnSentenceResult[]>([]);
  const [tries, setTries] = useState(0);
  const [best, setBest] = useState<ReadResult | null>(null);
  const text = check.sentences[index];

  const onResult = (r: ReadResult) => {
    setTries((n) => n + 1);
    setBest((b) => (!b || r.accuracy > b.accuracy ? r : b));
    if (r.accuracy >= 80) soundEffects.playStarChime();
  };
  const next = () => {
    const entry: FlnSentenceResult = { text, accuracy: best?.accuracy ?? 0, tries: Math.max(1, tries), missed: best?.missed ?? [] };
    const all = [...done, entry];
    if (index + 1 < check.sentences.length) {
      setDone(all);
      setIndex(index + 1);
      setTries(0);
      setBest(null);
    } else onSave(all);
  };

  return (
    <div className="space-y-3" id="fln-sentences">
      <p className="text-sm font-black text-stone-600">
        📖 {t(lang, 'fln_sentences')} · {index + 1}/{check.sentences.length}
      </p>
      <MicReader text={text} language={check.language} big onResult={onResult} />
      {best && (
        <p className="text-center text-sm font-black text-stone-700" id="fln-sentence-score">
          {best.accuracy}% {best.accuracy >= 80 ? '🌟' : ''} · tries {tries}
        </p>
      )}
      {(best || tries > 0) && (
        <button type="button" disabled={saving} onClick={next} className="btn-3d w-full bg-emerald-500 py-3 text-lg text-white disabled:opacity-60" id="btn-fln-next">
          {saving ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : '➜'}
        </button>
      )}
    </div>
  );
};

/* ------------------------------ ⏱️ ORF ------------------------------ */

const OrfPart: React.FC<{
  check: FlnCheck;
  norm: OrfNorm;
  lang: UiLang;
  saving: boolean;
  onSave: (orf: Record<string, unknown>) => Promise<FlnResult | null>;
  onNext: () => void;
}> = ({ check, norm, lang, saving, onSave, onNext }) => {
  const [read, setRead] = useState<ReadResult | null>(null);
  const [saved, setSaved] = useState<FlnResult | null>(null);
  const wcpm = read ? wordsCorrectPerMinute(read.correct, read.seconds) : 0;

  const onResult = async (r: ReadResult) => {
    setRead(r);
    const s = await onSave({ words: r.words, correct: r.correct, seconds: r.seconds, missed: r.missed });
    if (s) {
      setSaved(s);
      say(t(lang, 'fln_orfResult', { n: s.orf?.wcpm ?? wordsCorrectPerMinute(r.correct, r.seconds) }), lang);
    }
  };

  return (
    <div className="space-y-3" id="fln-orf">
      <p className="text-sm font-black text-stone-600">⏱️ {t(lang, 'fln_orf')}</p>
      {!read && <MicReader text={check.passage} language={check.language} onResult={onResult} />}
      {read && (
        <div className="space-y-3 rounded-3xl border-2 border-sky-100 bg-white p-4 text-center" id="fln-orf-result">
          <p className="text-5xl font-black text-sky-700">{saved?.orf?.wcpm ?? wcpm}</p>
          <p className="text-sm font-bold text-stone-600">{t(lang, 'fln_orfResult', { n: saved?.orf?.wcpm ?? wcpm })}</p>
          <p className="text-xs text-stone-500">
            {read.correct}/{read.words} · {read.seconds} s · 🎯 {norm.target}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setRead(null); setSaved(null); }} className="flex-1 rounded-2xl border border-stone-200 bg-white py-3 text-sm font-black text-stone-700">
              {t(lang, 'fln_tryAgain')}
            </button>
            <button type="button" disabled={saving || !saved} onClick={onNext} className="btn-3d flex-1 bg-emerald-500 py-3 text-lg text-white disabled:opacity-60" id="btn-fln-next">
              {saving ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : '➜'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------ ❓ questions ------------------------------ */

const QuestionsPart: React.FC<{
  check: FlnCheck;
  lang: UiLang;
  saving: boolean;
  onSave: (answers: FlnAnswer[]) => Promise<FlnResult | null>;
  onNext: () => void;
}> = ({ check, lang, saving, onSave, onNext }) => {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FlnAnswer[]>([]);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState<FlnResult | null>(null);
  const q: FlnQuestion | undefined = check.questions[index];

  const hear = useCallback((s: string) => {
    kidSpeech.stop();
    void kidSpeech.speakText(s, speechLang(check.language)).catch(() => undefined);
  }, [check.language]);

  useEffect(() => {
    if (q) hear(q.question);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (i: number) => {
    if (!q || solved) return;
    if (i === q.answer) {
      soundEffects.playStarChime();
      setSolved(true);
    } else {
      soundEffects.playWordPop();
      setWrong((w) => (w.includes(i) ? w : [...w, i]));
    }
  };

  const listen = () => {
    if (!q) return;
    setListening(true);
    void speechRecognition.startListening(
      speechLang(check.language),
      q.question,
      (res) => {
        if (!res.isComplete) return;
        setListening(false);
        if (res.transcript) setText((prev) => `${prev ? `${prev} ` : ''}${res.transcript}`.trim());
      },
      () => setListening(false),
      undefined,
      { maxDurationMs: 29000, silenceTimeoutMs: 3500 }
    );
  };

  const next = async () => {
    if (!q) return;
    const entry: FlnAnswer =
      q.kind === 'open'
        ? { kind: 'open', question: q.question, text: text.trim(), max: 2 }
        : { kind: q.kind, question: q.question, options: q.options, chosen: q.answer, correct: wrong.length === 0, tries: wrong.length + 1, max: 1 };
    const all = [...answers, entry];
    setAnswers(all);
    setWrong([]);
    setSolved(false);
    setText('');
    if (index + 1 < check.questions.length) setIndex(index + 1);
    else {
      const r = await onSave(all);
      if (r) setSaved(r);
      setIndex(index + 1);
    }
  };

  if (!q) {
    const list = saved?.comprehension?.answers || answers;
    const sc = comprehensionScore(list);
    return (
      <div className="space-y-3" id="fln-questions-result">
        {saving && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
          </p>
        )}
        {!saving && (
          <>
            <p className="text-center text-4xl font-black text-emerald-700">
              {sc.score}/{sc.max}
            </p>
            <ul className="space-y-2">
              {list.map((a, i) => (
                <li key={i} className="rounded-2xl bg-white px-3 py-2 text-sm">
                  <p className="font-bold text-stone-800">{a.question}</p>
                  {a.kind === 'open' ? (
                    <p className="text-stone-600">
                      “{a.text || '—'}” ·{' '}
                      {typeof a.aiScore === 'number' ? <b className="text-amber-600">{'⭐'.repeat(Math.max(1, a.aiScore))}</b> : <span className="text-stone-500">{t(lang, 'fln_teacherMarks')}</span>}
                    </p>
                  ) : (
                    <p className={a.correct ? 'font-black text-emerald-700' : 'font-black text-amber-700'}>
                      {a.correct ? '✓' : '↻'} {a.options?.[a.chosen ?? 0]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" onClick={onNext} className="btn-3d w-full bg-emerald-500 py-3 text-lg text-white" id="btn-fln-next">
              ➜
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" id="fln-questions">
      <details className="rounded-2xl border border-stone-200 bg-white p-3 text-sm text-stone-700" open={index === 0}>
        <summary className="cursor-pointer font-black">📄</summary>
        <p className={`mt-2 ${isIndic(check.language) ? 'leading-[1.9]' : 'leading-relaxed'}`}>{check.passage}</p>
      </details>
      <p className="text-xs font-black uppercase text-stone-500">
        ❓ {index + 1}/{check.questions.length} · {q.kind === 'direct' ? 'In the story' : q.kind === 'indirect' ? 'Think' : 'Your own answer'}
      </p>
      <div className="flex items-start gap-2 rounded-2xl bg-white p-3">
        <p className={`flex-1 text-lg font-black text-stone-900 ${isIndic(check.language) ? 'leading-[1.9]' : ''}`} id="fln-question">
          {q.question}
        </p>
        <button type="button" onClick={() => hear(q.question)} aria-label="Hear the question" className="rounded-full bg-sky-100 p-2 text-sky-700">
          <Volume2 className="h-5 w-5" />
        </button>
      </div>
      {q.kind !== 'open' ? (
        <div className="grid gap-2" id="fln-options">
          {q.options!.map((o, i) => (
            <button
              key={i}
              type="button"
              aria-disabled={solved}
              onClick={() => choose(i)}
              className={`fln-option rounded-2xl border-2 px-4 py-3 text-left text-lg font-black ${
                solved && i === q.answer ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : wrong.includes(i) ? 'border-rose-200 bg-rose-50 text-rose-400 line-through' : 'border-stone-200 bg-white text-stone-900'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold text-stone-500">{t(lang, 'fln_answerAloud')}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-2xl border-2 border-stone-200 bg-white p-3 text-base" id="fln-open-answer" />
          <button type="button" onClick={listening ? () => speechRecognition.stopListening() : listen} className={`btn-3d inline-flex items-center gap-2 px-4 py-2 text-sm text-white ${listening ? 'bg-rose-500' : 'bg-sky-500'}`}>
            {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {listening ? 'Stop' : '🎤'}
          </button>
        </div>
      )}
      {(solved || q.kind === 'open') && (
        <button type="button" disabled={saving} onClick={next} className="btn-3d w-full bg-emerald-500 py-3 text-lg text-white disabled:opacity-60" id="btn-fln-next">
          ➜
        </button>
      )}
    </div>
  );
};

/* ------------------------------ ✍️ writing ------------------------------ */

const WritingPart: React.FC<{ check: FlnCheck; readingId: string; lang: UiLang; saving: boolean; done: boolean; onSave: () => void }> = ({ check, readingId, lang, saving, done, onSave }) => {
  const [picture, setPicture] = useState<PublishedReadingImage | null | undefined>(undefined);
  useEffect(() => {
    if (!check.writing.useChapterPicture) return setPicture(null);
    let cancelled = false;
    backendApi.readings
      .images(readingId)
      .then((r) => !cancelled && setPicture(r.images?.[0] || null))
      .catch(() => !cancelled && setPicture(null));
    return () => {
      cancelled = true;
    };
  }, [readingId, check.writing.useChapterPicture]);

  return (
    <div className="space-y-3" id="fln-writing">
      <p className="text-sm font-black text-stone-600">✍️ {t(lang, 'fln_writing')}</p>
      <div className="flex min-h-[10rem] items-center justify-center overflow-hidden rounded-3xl border-2 border-stone-100 bg-white">
        {picture === undefined ? (
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        ) : picture ? (
          <img src={`data:${picture.mimeType};base64,${picture.base64}`} alt={picture.caption || 'Picture from the chapter'} className="max-h-72 w-full object-contain" id="fln-writing-picture" />
        ) : (
          <span className="text-7xl" aria-hidden>
            🖼️
          </span>
        )}
      </div>
      <ol className="space-y-1 rounded-2xl bg-white p-3 text-base font-bold text-stone-800">
        {check.writing.prompts.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <button type="button" aria-label="Hear" onClick={() => say(p, lang)} className="rounded-full bg-sky-100 p-1.5 text-sky-700">
              <Volume2 className="h-4 w-4" />
            </button>
            <span className={isIndic(check.language) ? 'leading-[1.9]' : ''}>{p}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs font-bold text-stone-500">{t(lang, 'fln_teacherMarks')}</p>
      <button type="button" disabled={saving} onClick={onSave} className="btn-3d w-full bg-emerald-500 py-3 text-lg text-white disabled:opacity-60" id="btn-fln-wrote">
        {saving ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : `${done ? '✓ ' : ''}${t(lang, 'fln_wroteIt')}`}
      </button>
    </div>
  );
};

/** Mounted once for a signed-in student; opens the FLN check on OPEN_FLN_EVENT. */
export const FlnCheckHost: React.FC<{ student: Student | null | undefined }> = ({ student }) => {
  const [target, setTarget] = useState<FlnTarget | null>(null);
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<FlnTarget>).detail;
      if (detail?.readingId) setTarget(detail);
    };
    window.addEventListener(OPEN_FLN_EVENT, open);
    return () => window.removeEventListener(OPEN_FLN_EVENT, open);
  }, []);
  if (!student || !student.id || student.id === 'guest') return null;
  return (
    <AnimatePresence>
      {target && <FlnCheckPanel key={target.readingId} target={target} student={student} onClose={() => setTarget(null)} />}
    </AnimatePresence>
  );
};

const BAND_CLASS = { meets: 'text-emerald-700', approaching: 'text-amber-700', below: 'text-rose-700' } as const;

/** The FLN results of a chapter as small chips, next to its title (child's own or one child's for the teacher). */
export const FlnChips: React.FC<{ summary: ReturnType<typeof flnSummary>; className?: string }> = ({ summary: s, className = '' }) => {
  const chips: React.ReactNode[] = [];
  if (s.sentences !== null) chips.push(<span key="s" title="Reading sentences">📖 {s.sentences}%</span>);
  if (s.wcpm !== null)
    chips.push(
      <span key="o" title={`Oral reading fluency: words correct per minute (goal ${s.target})`} className={s.band ? BAND_CLASS[s.band] : ''}>
        ⏱️ {s.wcpm}/{s.target} wpm
      </span>
    );
  if (s.comprehension)
    chips.push(
      <span key="c" title="Reading comprehension">
        ❓ {s.comprehension.score}/{s.comprehension.max}
        {s.comprehension.unmarked ? '+' : ''}
      </span>
    );
  if (s.writing) chips.push(<span key="w" title="Writing (marked by the teacher)">✍️ {s.writing.score !== null ? `${s.writing.score}/10` : '…'}</span>);
  if (!chips.length) return null;
  return <span className={`fln-chips flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-black text-sky-800 ${className}`}>{chips}</span>;
};
