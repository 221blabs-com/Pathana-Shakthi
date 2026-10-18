import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Hash, Loader2 } from 'lucide-react';
import { t, UiLang } from '../../data/uiStrings';
import { deviceUiLang, say, sayKey, setDeviceUiLang } from '../../services/kidPrefs';
import { LanguageSwitch, MitraSays, useVoiceGuide } from '../easy/EasyBits';

const CLASSES = [
  { grade: 'Class 1', short: '1', emoji: '🐣', color: 'from-amber-300 to-orange-400' },
  { grade: 'Class 2', short: '2', emoji: '🐰', color: 'from-lime-300 to-emerald-400' },
  { grade: 'Class 3', short: '3', emoji: '🦊', color: 'from-sky-300 to-blue-400' },
  { grade: 'Class 4', short: '4', emoji: '🐘', color: 'from-violet-300 to-purple-400' },
  { grade: 'Class 5', short: '5', emoji: '🦁', color: 'from-rose-300 to-pink-400' },
  { grade: 'Class 6', short: '6', emoji: '🦉', color: 'from-teal-300 to-cyan-500' },
  { grade: 'Class 7', short: '7', emoji: '🐬', color: 'from-indigo-300 to-blue-500' },
  { grade: 'Class 8', short: '8', emoji: '🦅', color: 'from-fuchsia-300 to-purple-500' },
  { grade: 'Class 9', short: '9', emoji: '🐯', color: 'from-orange-300 to-red-500' },
  { grade: 'Class 10', short: '10', emoji: '🚀', color: 'from-slate-400 to-indigo-600' },
];

type RosterEntry = { rollNumber: string; name: string; avatar: string };

// Student sign-in: tap your class, then tap your name (each shows its roll
// number) or type your roll number. The card below always says who will
// sign in — name, class and roll — so a child can see it is them.
export const StudentClassRollFields: React.FC<{
  grade: string;
  rollNumber: string;
  onGradeChange: (grade: string) => void;
  onRollChange: (roll: string) => void;
}> = ({ grade, rollNumber, onGradeChange, onRollChange }) => {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // A child who can't read yet: pick a language by its letter, and every
  // tap is said aloud (class, then "Arjun, is this you?").
  const [lang, setLang] = useState<UiLang>(() => deviceUiLang());
  useVoiceGuide('login', t(lang, 'tapClass'), lang, !grade, 600);

  useEffect(() => {
    if (!grade) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setRoster([]);
    fetch(`/api/auth/class-roster?grade=${encodeURIComponent(grade)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Could not load your class.');
        if (!cancelled) setRoster(data.students || []);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load your class.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [grade]);

  const roll = rollNumber.replace(/^0+(?=\d)/, '');
  const me = roster.find((s) => s.rollNumber === roll);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-wide text-stone-500">🗣️ {t(lang, 'chooseLanguage')}</span>
        <LanguageSwitch
          id="login-language"
          lang={lang}
          onChange={(l) => {
            setLang(l);
            setDeviceUiLang(l);
            sayKey(l, grade ? 'tapName' : 'tapClass');
          }}
        />
      </div>
      <MitraSays id="login-guide" text={t(lang, grade ? 'tapName' : 'tapClass')} lang={lang} />

      <div>
        <p className="text-xs font-black uppercase tracking-wide text-stone-600">1 · Your class</p>
        <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Your class">
          {CLASSES.map((c) => {
            const active = grade === c.grade;
            return (
              <motion.button
                key={c.grade}
                type="button"
                role="radio"
                aria-checked={active}
                data-grade={c.grade}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  onGradeChange(c.grade);
                  say(`${t(lang, 'classN', { n: c.short })}. ${t(lang, 'tapName')}`, lang);
                }}
                className={`class-tile relative flex flex-col items-center justify-center rounded-2xl border-2 py-2.5 transition-all ${
                  active
                    ? `border-transparent bg-gradient-to-b ${c.color} text-white shadow-lg ring-4 ring-orange-200`
                    : 'border-stone-200 bg-white text-stone-700 hover:border-orange-300'
                }`}
              >
                <span className="text-2xl leading-none sm:text-3xl" aria-hidden="true">
                  {c.emoji}
                </span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wide opacity-80">Class</span>
                <span className="text-lg font-black leading-none">{c.short}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {grade && (
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-stone-600">2 · Tap your name</p>
          {loading && (
            <p className="mt-2 flex items-center gap-2 text-xs font-bold text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading {grade}…
            </p>
          )}
          {error && <p className="mt-2 text-xs font-bold text-rose-700">{error}</p>}
          {!loading && !error && roster.length === 0 && (
            <p className="mt-2 text-xs text-stone-500">No children are listed in {grade} yet. Ask your teacher.</p>
          )}
          <div id="class-roster" className="mt-2 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {roster.map((s) => {
              const active = s.rollNumber === roll;
              return (
                <motion.button
                  key={s.rollNumber}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    onRollChange(s.rollNumber);
                    say(t(lang, 'isThisYou', { name: s.name.split(' ')[0] }), lang);
                  }}
                  data-roll={s.rollNumber}
                  className={`roster-student flex items-center gap-2 rounded-2xl border-2 px-2.5 py-2 text-left transition-all ${
                    active ? 'border-emerald-400 bg-emerald-50 ring-4 ring-emerald-100' : 'border-stone-200 bg-white hover:border-orange-300'
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {s.avatar}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-stone-900">{s.name}</span>
                    <span className="block text-[11px] font-bold text-stone-500">Roll {s.rollNumber}</span>
                  </span>
                </motion.button>
              );
            })}
          </div>

          <label htmlFor="student-roll-input" className="mt-3 block text-[11px] font-bold text-stone-500">
            …or type your roll number
          </label>
          <div className="relative mt-1">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              id="student-roll-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={rollNumber}
              onChange={(e) => onRollChange(e.target.value)}
              placeholder="e.g. 7"
              autoComplete="off"
              className="w-full rounded-2xl border-2 border-stone-200 bg-white py-2.5 pl-11 pr-4 text-xl font-black tracking-widest text-stone-900 outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <AnimatePresence>
            {me && (
              <motion.div
                id="student-login-preview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3"
              >
                <span className="text-3xl">{me.avatar}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-black text-stone-900">{me.name}</span>
                  <span className="block text-xs font-bold text-emerald-800">
                    {grade} · Roll {me.rollNumber}
                  </span>
                </span>
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </motion.div>
            )}
          </AnimatePresence>
          {rollNumber && roster.length > 0 && !me && (
            <p className="mt-2 text-xs font-bold text-amber-700">No one in {grade} has roll number {rollNumber}. Check with your teacher.</p>
          )}
        </div>
      )}
    </div>
  );
};
