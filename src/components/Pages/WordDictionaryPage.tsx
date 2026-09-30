import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Search, Snail, Volume2, X } from 'lucide-react';
import { Language, Student } from '../../types';
import { DictionaryWord, dictionaryFor } from '../../data/dictionary';
import { backendApi } from '../../services/backendApi';
import { kidSpeech } from '../../services/speechSynthesis';
import { offlineStorage } from '../../services/offlineStorage';
import { progressSync, localDay } from '../../services/progressSync';
import { soundEffects } from '../../services/soundEffects';
import { SayIt } from '../learnplay/SayIt';

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'English', label: 'English' },
  { id: 'Telugu', label: 'తెలుగు Telugu' },
  { id: 'Hindi', label: 'हिन्दी Hindi' },
];

const scriptOf = (text: string): Language =>
  /[ఀ-౿]/.test(text) ? 'Telugu' : /[ऀ-ॿ]/.test(text) ? 'Hindi' : 'English';
const cleanWord = (w: string) => w.replace(/[.,!?;:"'“”‘’()।॥—–-]+/g, '').trim();

type Mastery = Record<string, { best: number; date: string }>;
const masteryKey = (id: string) => `ps_words_${id}`;
const readMastery = (id: string): Mastery => {
  try {
    return JSON.parse(localStorage.getItem(masteryKey(id)) || '{}') || {};
  } catch {
    return {};
  }
};

// Word Dictionary: tap a word to hear it slowly, read its meaning, then say
// it into the microphone. Words come from a built-in list for the child's
// class, the key vocabulary of their class's published books, and the words
// they found hard while reading.
export const WordDictionaryPage: React.FC<{
  student: Student;
  onBack: () => void;
  onStudentChanged: () => void;
}> = ({ student, onBack, onStudentChanged }) => {
  const [language, setLanguage] = useState<Language>('English');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [selected, setSelected] = useState<DictionaryWord | null>(null);
  const [bookWords, setBookWords] = useState<DictionaryWord[]>([]);
  const [mastery, setMastery] = useState<Mastery>(() => readMastery(student.id));
  const [mitra, setMitra] = useState('Tap a word to hear it slowly. Then say it back to me!');

  useEffect(() => setMastery(readMastery(student.id)), [student.id]);

  // Key vocabulary from books published for this class.
  useEffect(() => {
    let cancelled = false;
    backendApi.readings
      .list(student.grade)
      .then((res) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const words: DictionaryWord[] = [];
        for (const r of res.readings || []) {
          for (const v of r.keyVocabulary || []) {
            const word = cleanWord(v.word);
            if (!word || word.split(/\s+/).length > 3 || seen.has(word.toLowerCase())) continue;
            seen.add(word.toLowerCase());
            words.push({
              word,
              language: scriptOf(word),
              meaning: v.meaning || `From "${r.chapterTitle}"`,
              emoji: '📘',
              category: 'From my books',
              grades: [1, 5],
            });
          }
        }
        setBookWords(words);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [student.grade]);

  // Words this child missed while reading.
  const hardWords: DictionaryWord[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of offlineStorage.getReadingLogs().filter((l) => l.studentId === student.id)) {
      for (const raw of log.struggledWords || []) {
        const w = cleanWord(raw);
        if (w.length > 1) counts.set(w, (counts.get(w) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([word, n]) => ({
        word,
        language: scriptOf(word),
        meaning: `You found this word hard ${n} time${n === 1 ? '' : 's'}. Let's practise!`,
        emoji: '🎯',
        category: 'My hard words',
        grades: [1, 5] as [number, number],
      }));
  }, [student.id]);

  const words = useMemo(() => {
    const all = [
      ...hardWords.filter((w) => w.language === language),
      ...bookWords.filter((w) => w.language === language),
      ...dictionaryFor(language, student.grade),
    ];
    const q = query.trim().toLowerCase();
    return all.filter(
      (w) =>
        (category === 'All' || w.category === category) &&
        (!q || w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q) || (w.sounds || '').includes(q))
    );
  }, [hardWords, bookWords, language, student.grade, query, category]);

  const categories = useMemo(() => {
    const all = [
      ...hardWords.filter((w) => w.language === language),
      ...bookWords.filter((w) => w.language === language),
      ...dictionaryFor(language, student.grade),
    ];
    return ['All', ...Array.from(new Set(all.map((w) => w.category)))];
  }, [hardWords, bookWords, language, student.grade]);

  // Have the first words' slow clips ready so a tap speaks at once.
  useEffect(() => {
    kidSpeech.prefetchWords(words.slice(0, 24).map((w) => w.word).join(' '), language);
  }, [words, language]);

  useEffect(() => {
    setCategory('All');
  }, [language]);

  const open = (w: DictionaryWord) => {
    soundEffects.playWordPop();
    setSelected(w);
    kidSpeech.speakSlowWord(w.word, w.language);
    setMitra(`"${w.word}" — listen, then press Say it!`);
  };

  const onPracticed = (w: DictionaryWord, passed: boolean, accuracy: number) => {
    const key = `${w.language}:${w.word}`;
    const next = { ...mastery };
    if (passed && accuracy >= (next[key]?.best || 0)) next[key] = { best: accuracy, date: localDay() };
    setMastery(next);
    try {
      localStorage.setItem(masteryKey(student.id), JSON.stringify(next));
    } catch {
      // Not remembered on this device; the server still records it.
    }
    progressSync.record({ type: 'word', word: w.word, language: w.language, accuracy });
    // Practising words counts as one activity toward today's tree.
    offlineStorage.recordDailyActivity(`words_${localDay()}`);
    onStudentChanged();
    setMitra(passed ? `Super! You said "${w.word}" well! ⭐` : `Good try! Tap the word to hear it slowly again.`);
  };

  const masteredCount = Object.keys(mastery).filter((k) => k.startsWith(`${language}:`)).length;

  return (
    <div id="word-dictionary-page" className="min-h-screen bg-gradient-to-b from-sky-50 via-amber-50/40 to-white pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="btn-3d inline-flex items-center gap-1.5 border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-2xl font-black text-stone-900 sm:text-3xl">Word Dictionary</h1>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-3xl border-2 border-amber-200 bg-white p-3 shadow-sm sm:p-4">
          <motion.img
            src="/shakthi-face-256.png"
            alt="Shakthi Mitra"
            className="h-16 w-16 shrink-0 rounded-full bg-amber-50 object-contain p-1 sm:h-20 sm:w-20"
            animate={{ rotate: [0, -4, 4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2 }}
          />
          <div className="min-w-0 flex-1">
            <p id="dictionary-mitra" className="text-sm font-black text-stone-800 sm:text-base">
              {mitra}
            </p>
            <p className="mt-1 text-xs font-bold text-amber-700">
              ⭐ {masteredCount} {language} word{masteredCount === 1 ? '' : 's'} said well
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div role="tablist" aria-label="Language" className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={language === l.id}
                onClick={() => {
                  soundEffects.playWordPop();
                  setLanguage(l.id);
                  setSelected(null);
                }}
                className={`dictionary-lang btn-3d px-4 py-2 text-sm ${
                  language === l.id ? 'bg-sky-500 text-white' : 'border-2 border-stone-200 bg-white text-stone-700'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              id="dictionary-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a word…"
              className="w-full rounded-2xl border-2 border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-sky-400"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-black ${
                category === c ? 'bg-amber-500 text-stone-950' : 'border border-stone-200 bg-white text-stone-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {words.map((w) => {
            const done = mastery[`${w.language}:${w.word}`];
            return (
              <motion.button
                key={`${w.category}-${w.word}`}
                type="button"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => open(w)}
                className={`dictionary-word card-3d relative flex flex-col items-center rounded-3xl border-2 bg-white p-3 text-center ${
                  selected?.word === w.word ? 'border-sky-400 ring-4 ring-sky-100' : 'border-stone-200'
                }`}
              >
                {done && <span className="absolute right-2 top-2 text-xs font-black text-emerald-600">✓ {done.best}%</span>}
                <span className="text-4xl" aria-hidden="true">
                  {w.emoji}
                </span>
                <span className="mt-1 text-xl font-black text-stone-900">{w.word}</span>
                {w.sounds && <span className="text-[11px] font-bold text-sky-700">{w.sounds}</span>}
                <span className="mt-0.5 line-clamp-2 text-[11px] text-stone-500">{w.meaning}</span>
              </motion.button>
            );
          })}
          {words.length === 0 && <p className="col-span-full py-8 text-center text-sm text-stone-500">No words match. Try another search.</p>}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
            <motion.div
              id="dictionary-practice"
              role="dialog"
              aria-label={`Practise ${selected.word}`}
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-start justify-between">
                <span className="text-6xl">{selected.emoji}</span>
                <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="rounded-xl border border-stone-200 p-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-4xl font-black text-stone-900">{selected.word}</p>
              {selected.sounds && <p className="text-sm font-bold text-sky-700">sounds like “{selected.sounds}”</p>}
              <p className="mt-1 text-sm text-stone-700">{selected.meaning}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => kidSpeech.speakText(selected.word, selected.language)}
                  className="btn-3d inline-flex items-center gap-2 border-2 border-stone-200 bg-white px-4 py-2 text-sm text-stone-800"
                >
                  <Volume2 className="h-4 w-4 text-sky-600" /> Listen
                </button>
                <button
                  type="button"
                  onClick={() => kidSpeech.speakSlowWord(selected.word, selected.language)}
                  className="btn-3d inline-flex items-center gap-2 border-2 border-stone-200 bg-white px-4 py-2 text-sm text-stone-800"
                >
                  <Snail className="h-4 w-4 text-emerald-600" /> Slowly
                </button>
              </div>

              <div className="mt-5 rounded-2xl bg-sky-50 p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-sky-800">Now you say it</p>
                <SayIt
                  key={`${selected.language}-${selected.word}`}
                  text={selected.word}
                  language={selected.language}
                  onUnlock={(passed, accuracy) => onPracticed(selected, passed, accuracy)}
                  onMascot={(m) => setMitra(m)}
                />
              </div>

              {selected.example && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-amber-800">Read the sentence</p>
                  <SayIt key={`ex-${selected.word}`} text={selected.example} language={selected.language} size="md" onMascot={(m) => setMitra(m)} />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
