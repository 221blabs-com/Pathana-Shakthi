import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { ArrowLeft, Lock } from 'lucide-react';
import {
  CLASS1_ENGLISH_UNITS,
  EnglishUnit,
  LESSON_STEPS,
  LessonStepId,
  englishUnitById,
  nextStep,
  unitStepsDone,
  unitUnlocked,
} from '../../data/class1English';
import { Story, Student } from '../../types';
import { completeStep, getEnglishProgress } from '../../services/class1EnglishProgress';
import { starsForScore } from '../../services/learnPlayProgress';
import { soundEffects } from '../../services/soundEffects';
import { kidSpeech } from '../../services/speechSynthesis';
import { ChunkyButton, MitraGuide } from '../learnplay/ui';
import { SayIt } from '../learnplay/SayIt';
import { AskMitra } from '../AskMitra';
import { ListenStep, PictureTalkStep, RhymeStep, SoundsStep, TraceStep, WordsStep } from './activities';

/** A unit's reading lines as a Story for the normal microphone reader (+ quiz). */
export function englishUnitStory(unit: EnglishUnit, student: Student): Story {
  return {
    id: `eng1_${unit.id}`,
    title: `${unit.title}: let’s read`,
    titleEnglish: unit.story.title,
    language: 'English',
    gradeLevel: student.grade,
    difficulty: 'Easy',
    category: 'English',
    coverEmoji: unit.emoji,
    coverColor: '#f59e0b',
    moralOrTakeaway: unit.theme,
    pages: unit.readAloud.map((text, i) => ({
      pageNumber: i + 1,
      text,
      englishTranslation: '',
      transliteration: '',
      illustrationPrompt: unit.title,
    })),
    spotlightWords: [],
    comprehensionQuiz: unit.quiz,
    isCustomGenerated: false,
  };
}

const UnitMap: React.FC<{ student: Student; onOpen: (unit: EnglishUnit) => void }> = ({ student, onOpen }) => {
  const progress = useMemo(() => getEnglishProgress(student.id), [student.id]);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {CLASS1_ENGLISH_UNITS.map((unit, i) => {
        const p = progress[unit.id];
        const done = unitStepsDone(p) + (student.completedStoryIds?.includes(`eng1_${unit.id}`) && !p?.steps.read ? 1 : 0);
        const open = unitUnlocked(unit.number, progress);
        return (
          <motion.button
            key={unit.id}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={open ? { y: -4 } : {}}
            whileTap={open ? { scale: 0.97 } : {}}
            onClick={() => {
              if (!open) {
                soundEffects.playTryAgain();
                void kidSpeech.speakText(`Finish ${CLASS1_ENGLISH_UNITS[i - 1].title} first.`, 'English').catch(() => undefined);
                return;
              }
              soundEffects.playWordPop();
              onOpen(unit);
            }}
            className={`card-3d relative overflow-hidden bg-gradient-to-br ${unit.gradient} p-4 text-left ${open ? '' : 'opacity-60 grayscale'}`}
            id={`eng1-unit-${unit.number}`}
          >
            <span className="absolute -right-2 -top-3 text-7xl opacity-30" aria-hidden="true">
              {unit.emoji}
            </span>
            <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-black text-stone-700">Unit {unit.number}</span>
            <h3 className="mt-2 flex items-center gap-2 text-xl font-black text-stone-900">
              <span className="text-4xl">{unit.emoji}</span> {unit.title}
            </h3>
            <p className="mt-1 text-sm font-bold text-stone-700">
              Letters {unit.letters.map((l) => l.letter.toUpperCase() + l.letter).join(' ')} · Words {unit.sightWords.join(', ')}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/70">
                <div className="h-full bg-emerald-500" style={{ width: `${(Math.min(done, LESSON_STEPS.length) / LESSON_STEPS.length) * 100}%` }} />
              </div>
              <span className="text-xs font-black text-stone-700">
                {open ? `${Math.min(done, LESSON_STEPS.length)}/${LESSON_STEPS.length}` : <Lock className="inline h-4 w-4" />}
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

const UnitLesson: React.FC<{
  unit: EnglishUnit;
  student: Student;
  onReadAloud: (story: Story) => void;
  onStudentChanged: () => void;
  onNextUnit?: () => void;
}> = ({ unit, student, onReadAloud, onStudentChanged, onNextUnit }) => {
  const [progress, setProgress] = useState(() => getEnglishProgress(student.id)[unit.id]);
  const [step, setStep] = useState<LessonStepId>(() => nextStep(progress));
  const [mascot, setMascot] = useState<{ text: string; mood: 'happy' | 'cheer' | 'think' | 'sad' }>({
    text: `Hi ${student.name.split(' ')[0] || 'friend'}! Unit ${unit.number}: ${unit.title}.`,
    mood: 'happy',
  });
  const [result, setResult] = useState<{ score: number; total: number; gained: number } | null>(null);
  const readDone = student.completedStoryIds?.includes(`eng1_${unit.id}`);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setResult(null);
    return () => kidSpeech.stop();
  }, [step]);

  const onMascot = (text: string, mood: 'happy' | 'cheer' | 'think' | 'sad' = 'happy') => setMascot({ text, mood });

  const goNext = () => {
    const i = LESSON_STEPS.findIndex((s) => s.id === step);
    if (i + 1 < LESSON_STEPS.length) setStep(LESSON_STEPS[i + 1].id);
  };

  const finish = (score?: number, total?: number) => {
    const gained = completeStep(student.id, unit.id, step, score !== undefined && total !== undefined ? [score, total] : undefined);
    setProgress(getEnglishProgress(student.id)[unit.id]);
    onStudentChanged();
    if (score === undefined || total === undefined) {
      soundEffects.playCheerChime();
      goNext();
      return;
    }
    const stars = starsForScore(score, total);
    if (stars >= 2) {
      soundEffects.playVictoryFanfare();
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
    } else soundEffects.playCheerChime();
    onMascot(stars === 3 ? 'Perfect! ⭐⭐⭐' : stars === 2 ? 'Great job!' : 'Good try! You can play again.', 'cheer');
    setResult({ score, total, gained });
  };

  const body = () => {
    if (result) {
      const stars = starsForScore(result.score, result.total);
      return (
        <div className="rounded-3xl border-2 border-emerald-200 bg-white p-6 text-center">
          <p className="text-5xl text-amber-500">
            {'★'.repeat(stars)}
            <span className="text-stone-200">{'★'.repeat(3 - stars)}</span>
          </p>
          <p className="mt-2 text-xl font-black text-stone-900">
            {result.score} of {result.total} right
          </p>
          <p className="text-sm font-bold text-stone-500">{result.gained > 0 ? `+${result.gained * 5} ⭐ added to your collection` : 'Stars already earned — well practised!'}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ChunkyButton color="white" onClick={() => setResult(null)}>
              ↻ Play again
            </ChunkyButton>
            <ChunkyButton color="emerald" onClick={goNext}>
              Next →
            </ChunkyButton>
          </div>
        </div>
      );
    }
    switch (step) {
      case 'talk':
        return <PictureTalkStep unit={unit} onDone={() => finish()} onMascot={onMascot} />;
      case 'listen':
        return <ListenStep unit={unit} onDone={finish} onMascot={onMascot} />;
      case 'rhyme':
        return <RhymeStep unit={unit} onDone={() => finish()} onMascot={onMascot} />;
      case 'sounds':
        return <SoundsStep unit={unit} onDone={finish} onMascot={onMascot} />;
      case 'trace':
        return <TraceStep unit={unit} onDone={finish} onMascot={onMascot} />;
      case 'words':
        return <WordsStep unit={unit} onDone={finish} onMascot={onMascot} />;
      case 'read':
        return (
          <div className="rounded-3xl border-2 border-violet-200 bg-white p-4">
            <h3 className="text-lg font-black text-stone-900">🎤 Read it yourself</h3>
            <p className="text-sm font-bold text-stone-500">Tap a word to hear it. Then read the whole page with the microphone.</p>
            <div className="mt-3 space-y-4">
              {unit.readAloud.slice(0, 2).map((line) => (
                <SayIt key={line} text={line} language="English" size="md" onMascot={onMascot} />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {readDone && onNextUnit && (
                <ChunkyButton color="white" onClick={onNextUnit}>
                  Next unit →
                </ChunkyButton>
              )}
              <ChunkyButton
                color="violet"
                id="eng1-open-reader"
                onClick={() => {
                  completeStep(student.id, unit.id, 'read');
                  onReadAloud(englishUnitStory(unit, student));
                }}
              >
                📖 Read all {unit.readAloud.length} pages + quiz
              </ChunkyButton>
            </div>
          </div>
        );
    }
  };

  return (
    <div>
      <AskMitra context={{ kind: 'lesson', title: unit.title, text: [...unit.story.lines, ...unit.readAloud].join(' '), language: 'English' }} />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {LESSON_STEPS.map((s) => {
          const done = progress?.steps[s.id] || (s.id === 'read' && readDone);
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={step === s.id}
              title={s.tholimettu}
              onClick={() => {
                soundEffects.playPageTurn();
                setStep(s.id);
              }}
              className={`eng1-step-tab inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-sm font-black ${
                step === s.id ? 'bg-stone-900 text-white shadow-[0_4px_0_rgba(0,0,0,0.2)]' : 'bg-white text-stone-700'
              }`}
            >
              {s.emoji} {s.label} {done && <span className="text-emerald-500">✓</span>}
            </button>
          );
        })}
      </div>
      <MitraGuide message={mascot.text} mood={mascot.mood} size={60} className="mb-4" />
      <motion.div key={`${step}-${result ? 'r' : 'p'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {body()}
      </motion.div>
    </div>
  );
};

export const EnglishCoursePage: React.FC<{
  student: Student;
  unitId?: string | null;
  onOpenUnit: (unitId: string | null) => void;
  onBack: () => void;
  onReadAloud: (story: Story) => void;
  onStudentChanged: () => void;
}> = ({ student, unitId, onOpenUnit, onBack, onReadAloud, onStudentChanged }) => {
  const unit = unitId ? englishUnitById(unitId) : undefined;
  const next = unit ? CLASS1_ENGLISH_UNITS.find((u) => u.number === unit.number + 1) : undefined;
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-sky-50 pb-28 font-sans" id="english-course-page">
      <div className="mx-auto w-full max-w-4xl px-3 pt-5 sm:px-6 sm:pt-8">
        <div className={`card-3d relative mb-5 overflow-hidden bg-gradient-to-br ${unit ? unit.gradient : 'from-amber-200 via-rose-200 to-sky-200'} p-4 sm:p-6`}>
          <div className="absolute -right-4 -top-6 text-[7rem] opacity-25" aria-hidden="true">
            {unit ? unit.emoji : '🔤'}
          </div>
          <button
            type="button"
            onClick={() => (unit ? onOpenUnit(null) : onBack())}
            id="btn-eng1-back"
            className="relative inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-xs font-black text-stone-700 shadow hover:bg-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {unit ? 'All units' : 'English'}
          </button>
          <h1 className="relative mt-3 text-2xl font-black text-stone-900 sm:text-4xl">{unit ? `Unit ${unit.number}: ${unit.title}` : 'My English Book · Class 1'}</h1>
          <p className="relative mt-1 text-sm font-bold text-stone-800/80">
            {unit ? `Theme: ${unit.theme}` : '8 units · all 26 letter sounds · rhymes, stories, writing and reading'}
          </p>
        </div>
        {unit ? (
          <UnitLesson
            key={unit.id}
            unit={unit}
            student={student}
            onReadAloud={onReadAloud}
            onStudentChanged={onStudentChanged}
            onNextUnit={next ? () => onOpenUnit(next.id) : undefined}
          />
        ) : (
          <UnitMap student={student} onOpen={(u) => onOpenUnit(u.id)} />
        )}
      </div>
    </div>
  );
};
