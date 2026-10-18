import React from 'react';
import { motion } from 'motion/react';
import { Story, Student } from '../../types';
import { subjectLabel, t } from '../../data/uiStrings';
import { kidPrefs, say, uiLangOf } from '../../services/kidPrefs';
import { soundEffects } from '../../services/soundEffects';
import { TeacherMessagesCard } from '../TeacherMessagesCard';
import { LanguageSwitch, MitraSays, SayButton, useVoiceGuide } from './EasyBits';

// The student home in easy mode, for children who can't read yet: big
// pictures, one word each in the child's language, and Shakthi Mitra saying
// what to do. Every tile says its name when tapped; 🔊 says it without
// opening. Stars and streak are pictures with a number, read aloud on a tap.

const SUBJECT_ART: Record<string, { art: string; bg: string }> = {
  English: { art: '🔤', bg: 'from-violet-200 to-violet-300' },
  Maths: { art: '🔢', bg: 'from-sky-200 to-blue-300' },
  Science: { art: '🌱', bg: 'from-emerald-200 to-green-300' },
  Social: { art: '🌏', bg: 'from-orange-200 to-amber-300' },
  Hindi: { art: 'अ', bg: 'from-rose-200 to-pink-300' },
  Telugu: { art: 'అ', bg: 'from-yellow-200 to-amber-300' },
};
const SUBJECT_ORDER = ['English', 'Maths', 'Science', 'Social', 'Telugu', 'Hindi'];

export const EasyHome: React.FC<{
  student: Student;
  subjects: string[];
  onOpenSubject?: (subject: string) => void;
  onOpenDictionary?: () => void;
  onOpenRewardChest: () => void;
  onSelectStory: (story: Story) => void;
  onOpenLab?: (chapterId: string) => void;
}> = ({ student, subjects, onOpenSubject, onOpenDictionary, onOpenRewardChest, onSelectStory, onOpenLab }) => {
  const lang = uiLangOf(student);
  const firstName = String(student.name || '').split(/\s+/)[0];
  const greeting = t(lang, 'hello', { name: firstName });
  useVoiceGuide('home', `${greeting} ${t(lang, 'homeGuide')}`, lang, true, 900);

  const open = (label: string, go?: () => void) => {
    soundEffects.playWordPop();
    say(label, lang);
    go?.();
  };
  const ordered = SUBJECT_ORDER.filter((s) => subjects.includes(s)).concat(subjects.filter((s) => !SUBJECT_ORDER.includes(s)));

  return (
    <div id="easy-home" className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-sky-50 pb-16 font-sans text-stone-900">
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 sm:px-6">
        <header className="flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 to-orange-400 text-4xl shadow">
            {student.avatar}
          </span>
          <h1 className="min-w-0 flex-1 text-xl font-black leading-tight [overflow-wrap:anywhere] sm:text-3xl">{greeting}</h1>
          <button
            type="button"
            id="easy-stars"
            onClick={() => open(t(lang, 'starsSay', { n: student.stars || 0 }), onOpenRewardChest)}
            className="flex shrink-0 flex-col items-center rounded-2xl bg-white px-3 py-1.5 shadow ring-1 ring-amber-200 active:scale-95"
            aria-label={t(lang, 'myStars')}
          >
            <span className="text-2xl leading-none">⭐</span>
            <span className="text-base font-black leading-tight">{student.stars || 0}</span>
          </button>
          <button
            type="button"
            onClick={() => open(t(lang, 'streakSay', { n: student.streakDays || 0 }))}
            className="flex shrink-0 flex-col items-center rounded-2xl bg-white px-3 py-1.5 shadow ring-1 ring-orange-200 active:scale-95"
            aria-label={t(lang, 'streak')}
          >
            <span className="text-2xl leading-none">🔥</span>
            <span className="text-base font-black leading-tight">{student.streakDays || 0}</span>
          </button>
        </header>

        <MitraSays id="easy-guide" title={t(lang, 'whatToday')} text={t(lang, 'homeGuide')} lang={lang} />

        <TeacherMessagesCard student={student} onSelectStory={onSelectStory} onOpenLab={onOpenLab} onOpenDictionary={onOpenDictionary} />

        <div id="easy-subjects" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ordered.map((subject, i) => {
            const art = SUBJECT_ART[subject] || { art: '📚', bg: 'from-stone-200 to-stone-300' };
            const label = subjectLabel(lang, subject);
            return (
              <motion.div
                key={subject}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative"
              >
                <button
                  type="button"
                  data-subject={subject}
                  onClick={() => open(label, () => onOpenSubject?.(subject))}
                  className={`easy-subject card-3d flex min-h-[150px] w-full flex-col items-center justify-center gap-2 rounded-[28px] bg-gradient-to-br ${art.bg} p-3 shadow-md active:scale-[0.97]`}
                >
                  <span className="text-6xl font-black leading-none drop-shadow-sm" aria-hidden>
                    {art.art}
                  </span>
                  <span className="text-xl font-black text-stone-900">{label}</span>
                  {lang !== 'English' && <span className="-mt-1 text-[11px] font-bold text-stone-600">{subject}</span>}
                </button>
                <SayButton text={label} lang={lang} className="absolute right-2 top-2" />
              </motion.div>
            );
          })}
          <div className="relative">
            <button
              type="button"
              id="easy-words"
              onClick={() => open(t(lang, 'wordsSay'), onOpenDictionary)}
              className="easy-subject card-3d flex min-h-[150px] w-full flex-col items-center justify-center gap-2 rounded-[28px] bg-gradient-to-br from-cyan-200 to-sky-300 p-3 shadow-md active:scale-[0.97]"
            >
              <span className="text-6xl leading-none" aria-hidden>
                📖
              </span>
              <span className="text-xl font-black text-stone-900">{t(lang, 'words')}</span>
            </button>
            <SayButton text={t(lang, 'wordsSay')} lang={lang} className="absolute right-2 top-2" />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-stone-200 bg-white p-3">
          <LanguageSwitch id="easy-language" lang={lang} onChange={(l) => kidPrefs.setLanguage(l)} />
          <button
            type="button"
            id="btn-easy-off"
            onClick={() => kidPrefs.setEasy(false, lang)}
            className="rounded-2xl border-2 border-stone-200 px-3 py-2 text-xs font-black text-stone-600 hover:border-stone-400"
          >
            📚 {t(lang, 'easyOff')}
          </button>
        </footer>
      </div>
    </div>
  );
};
