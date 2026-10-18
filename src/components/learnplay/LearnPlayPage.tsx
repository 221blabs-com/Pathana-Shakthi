import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { ArrowLeft, ArrowRight, Mic, RotateCcw, Volume2 } from 'lucide-react';
import { LabChapter, labCardsFor } from '../../data/learnPlay';
import { Story, Student } from '../../types';
import { soundEffects } from '../../services/soundEffects';
import { progressSync } from '../../services/progressSync';
import { offlineStorage } from '../../services/offlineStorage';
import { kidSpeech } from '../../services/speechSynthesis';
import { getLabProgress, markLearned, recordGame, starsForScore } from '../../services/learnPlayProgress';
import { resumeKey, resumePoints } from '../../services/resumePoints';
import { ChunkyButton, MitraGuide } from './ui';
import { SayIt } from './SayIt';
import { AskMitra } from '../AskMitra';
import { LearnScene } from './LearnScene';
import { AdditionGame } from './games/AdditionGame';
import { SubtractionGame } from './games/SubtractionGame';
import { NumberLineGame } from './games/NumberLineGame';
import { Shapes3DGame } from './games/Shapes3DGame';
import { PlantPartsGame } from './games/PlantPartsGame';
import { SequenceGame } from './games/SequenceGame';
import { MatchGame } from './games/MatchGame';
import { GridWalkGame } from './games/GridWalkGame';
import { WordBuildGame } from './games/WordBuildGame';
import { SimChallenge, SimExplore } from './sims';

type Step = 'learn' | 'play' | 'result' | 'read';

// The read-aloud part of a chapter as a Story, so it runs through the
// normal reader (microphone scoring, quiz, rewards).
export function labStory(chapter: LabChapter, student: Student): Story {
  return {
    id: `lab_${chapter.id}`,
    title: chapter.title,
    titleEnglish: chapter.subtitle,
    language: chapter.language,
    gradeLevel: student.grade,
    difficulty: 'Easy',
    category: chapter.subject,
    coverEmoji: chapter.emoji,
    coverColor: '#f59e0b',
    moralOrTakeaway: chapter.subtitle,
    pages: chapter.readAloud.map((text, i) => ({
      pageNumber: i + 1,
      text,
      englishTranslation: '',
      transliteration: '',
      illustrationPrompt: chapter.title,
    })),
    spotlightWords: [],
    comprehensionQuiz: chapter.quiz,
    isCustomGenerated: false,
  };
}

const STEPS: { id: Step; label: string; emoji: string }[] = [
  { id: 'learn', label: 'Learn', emoji: '📖' },
  { id: 'play', label: 'Play', emoji: '🎮' },
  { id: 'read', label: 'Read', emoji: '🎤' },
];

export const LearnPlayPage: React.FC<{
  chapter: LabChapter;
  student: Student;
  onBack: () => void;
  onReadAloud: (story: Story) => void;
  onStudentChanged: () => void;
}> = ({ chapter, student, onBack, onReadAloud, onStudentChanged }) => {
  // Cards for this class (a Class 6-10 lab shows some cards only to some classes).
  const cards = useMemo(() => labCardsFor(chapter, student.grade), [chapter, student.grade]);
  // Reopen at the step and card where the child stopped (any device).
  const placeKey = resumeKey('lab', chapter.id);
  const [resumed] = useState(() => {
    const p = resumePoints.get(student.id, placeKey);
    return p && p.total === cards.length ? p : null;
  });
  const [step, setStep] = useState<Step>(() =>
    resumed?.step === 'play' || resumed?.step === 'read' ? (resumed.step as Step) : 'learn'
  );
  const [card, setCard] = useState(() => (resumed && resumed.page < cards.length ? resumed.page : 0));
  // The card leaving the screen still has its buttons during the flip
  // animation; reading the live index from a ref keeps a quick second tap
  // from being lost.
  const cardRef = useRef(0);
  cardRef.current = card;
  // Cards the child said well. Saying a card is encouraged, never required:
  // Next is always open.
  const [saidCards, setSaidCards] = useState<Record<number, boolean>>({});
  const [mascot, setMascot] = useState<{ text: string; mood: 'happy' | 'cheer' | 'think' | 'sad' }>({
    text: `Hi ${student.name.split(' ')[0] || 'friend'}! Let's learn "${chapter.title}" together!`,
    mood: 'happy',
  });
  const [gameKey, setGameKey] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number; gained: number } | null>(null);
  const progress = useMemo(() => getLabProgress(student.id)[chapter.id], [student.id, chapter.id, result]);
  const readDone = student.completedStoryIds?.includes(`lab_${chapter.id}`);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Remember the step and card (a finished game resumes at Read).
  useEffect(() => {
    resumePoints.save(student.id, placeKey, { page: card, total: cards.length, step: step === 'result' ? 'read' : step });
  }, [step, card, student.id, placeKey, cards.length]);

  // Each flashcard reads itself aloud when it opens, so the child hears it
  // before saying it.
  useEffect(() => {
    if (step !== 'learn') return;
    const text = cards[card]?.text;
    // Fetch the next cards' audio now so each one speaks the moment it opens.
    for (const next of cards.slice(card + 1, card + 2)) {
      kidSpeech.prefetch(next.text, chapter.language);
    }
    const timer = window.setTimeout(() => {
      if (text) void kidSpeech.speakText(text, chapter.language).catch(() => undefined);
    }, 150);
    return () => {
      window.clearTimeout(timer);
      kidSpeech.stop();
    };
  }, [step, card, chapter, cards]);

  const speak = (text: string) => {
    soundEffects.playWordPop();
    void kidSpeech.speakText(text, chapter.language).catch(() => undefined);
  };

  const nextCard = () => {
    soundEffects.playPageTurn();
    const index = cardRef.current;
    if (index + 1 < cards.length) {
      cardRef.current = index + 1;
      setCard(index + 1);
      return;
    }
    markLearned(student.id, chapter.id);
    setStep('play');
    setMascot({ text: `Game time! ${chapter.gameTitle} 🎮`, mood: 'cheer' });
  };

  const finishGame = (score: number, total: number) => {
    const gained = recordGame(student.id, chapter.id, score, total);
    // A finished game grows today's learning tree (once per chapter/day).
    offlineStorage.recordDailyActivity(`game_${chapter.id}`);
    progressSync.record({ type: 'game', chapterId: chapter.id, subject: chapter.subject, score, total, stars: starsForScore(score, total) });
    onStudentChanged();
    setResult({ score, total, gained });
    setStep('result');
    const stars = starsForScore(score, total);
    if (stars >= 2) {
      soundEffects.playVictoryFanfare();
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
    } else {
      soundEffects.playCheerChime();
    }
    setMascot({
      text: stars === 3 ? 'Perfect! You are a superstar! 🌟' : stars === 2 ? 'Great job! Play again for 3 stars!' : 'Good try! Practice makes perfect.',
      mood: 'cheer',
    });
  };

  const gameProps = {
    grade: student.grade,
    language: chapter.language,
    onFinish: finishGame,
    onMascot: (text: string, mood: 'happy' | 'cheer' | 'think' | 'sad' = 'happy') => setMascot({ text, mood }),
  };

  const game = () => {
    const g = chapter.game;
    switch (g.kind) {
      case 'addition':
        return <AdditionGame {...gameProps} />;
      case 'subtraction':
        return <SubtractionGame {...gameProps} />;
      case 'numberline':
        return <NumberLineGame {...gameProps} />;
      case 'shapes3d':
        return <Shapes3DGame {...gameProps} />;
      case 'plantparts':
        return <PlantPartsGame {...gameProps} />;
      case 'sequence':
        return <SequenceGame {...gameProps} steps={g.steps} />;
      case 'match':
        return <MatchGame {...gameProps} prompt={g.prompt} pairs={g.pairs} />;
      case 'gridwalk':
        return <GridWalkGame {...gameProps} />;
      case 'wordbuild':
        return <WordBuildGame {...gameProps} words={g.words} />;
      case 'sim':
        return <SimChallenge kind={g.sim.kind} variant={g.sim.variant} grade={student.grade} onFinish={finishGame} onMascot={gameProps.onMascot} />;
    }
  };

  const current = cards[card];
  const activeIndex = step === 'learn' ? 0 : step === 'read' ? 2 : 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-sky-50 pb-16 font-sans" id="learn-play-page">
      <AskMitra
        context={{
          kind: 'lesson',
          title: chapter.title,
          text: step === 'learn' && current ? `${current.title}. ${current.text}` : cards.map((c) => c.text).join(' '),
          language: chapter.language,
        }}
      />
      <div className="mx-auto w-full max-w-4xl px-3 pt-5 sm:px-6 sm:pt-8">
        {/* Header */}
        <div className={`card-3d relative overflow-hidden bg-gradient-to-br ${chapter.gradient} p-4 sm:p-6`}>
          <div className="absolute -right-6 -top-6 text-[7rem] opacity-25 sm:text-[9rem]" aria-hidden="true">
            {chapter.emoji}
          </div>
          <button
            type="button"
            onClick={onBack}
            id="btn-learn-back"
            className="relative inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-xs font-black text-stone-700 shadow hover:bg-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {chapter.subject}
          </button>
          <h1 className="relative mt-3 text-2xl font-black text-stone-900 sm:text-4xl">{chapter.title}</h1>
          <p className="relative mt-1 text-sm font-bold text-stone-800/80 sm:text-base">{chapter.subtitle}</p>
          <div className="relative mt-4 flex flex-wrap gap-2" role="tablist">
            {STEPS.map((s, i) => {
              const done =
                (s.id === 'learn' && (progress?.learned || activeIndex > 0)) ||
                (s.id === 'play' && (progress?.stars || 0) > 0) ||
                (s.id === 'read' && readDone);
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={activeIndex === i}
                  onClick={() => {
                    soundEffects.playPageTurn();
                    setStep(s.id);
                    if (s.id === 'play') setGameKey((k) => k + 1);
                  }}
                  className={`learn-step-tab inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-sm font-black transition-all ${
                    activeIndex === i ? 'bg-white text-stone-900 shadow-[0_4px_0_rgba(0,0,0,0.15)]' : 'bg-white/45 text-stone-800'
                  }`}
                >
                  {s.emoji} {s.label} {done && <span className="text-emerald-600">✓</span>}
                </button>
              );
            })}
            {(progress?.stars || 0) > 0 && (
              <span className="ml-auto inline-flex items-center rounded-2xl bg-white/85 px-3 py-1.5 text-sm font-black text-amber-600">
                {'★'.repeat(progress!.stars)}
                <span className="text-stone-300">{'★'.repeat(3 - progress!.stars)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Mascot */}
        <div className="mt-4">
          <MitraGuide message={mascot.text} mood={mascot.mood} size={64} />
        </div>

        <AnimatePresence mode="wait">
          {step === 'learn' && (
            <motion.section key={`learn-${card}`} className="scene-3d mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                initial={{ rotateY: -70, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 70, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 170, damping: 20 }}
                className="card-3d overflow-hidden bg-white"
                id="learn-card"
              >
                {current.sim ? (
                  <div className="relative bg-white" id="learn-sim">
                    <SimExplore kind={current.sim.kind} variant={current.sim.variant} grade={student.grade} />
                  </div>
                ) : (
                  <div className="relative h-52 bg-gradient-to-b from-sky-50 to-amber-50 sm:h-64">
                    <LearnScene card={current} />
                  </div>
                )}
                <div className="p-5 sm:p-7">
                  <p className="text-xs font-black uppercase tracking-widest text-stone-400">
                    Card {card + 1} of {cards.length}
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-stone-900 sm:text-3xl">{current.title}</h2>
                  <div className="mt-3">
                    <SayIt
                      key={`${chapter.id}-${card}`}
                      id="learn-card-text"
                      text={current.text}
                      language={chapter.language}
                      listenOnly={chapter.subject === 'Maths'}
                      onMascot={(text, mood) => setMascot({ text, mood: mood || 'happy' })}
                      onUnlock={(passed) => passed && setSaidCards((u) => ({ ...u, [card]: true }))}
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-bold text-stone-500" id="learn-say-hint">
                      {chapter.subject === 'Maths'
                        ? '👀 Look, listen, then tap Next.'
                        : saidCards[card]
                        ? '⭐ Well said!'
                        : '🎤 Want to try? Press Say it — or just tap Next.'}
                    </span>
                    <div className="ml-auto flex gap-2">
                      <ChunkyButton color="white" onClick={() => {
                          cardRef.current = Math.max(0, cardRef.current - 1);
                          setCard(cardRef.current);
                        }} disabled={card === 0} aria-label="Previous card">
                        <ArrowLeft className="h-5 w-5" />
                      </ChunkyButton>
                      <ChunkyButton color="emerald" onClick={nextCard} className="inline-flex items-center gap-2" id="btn-learn-next">
                        {card + 1 < cards.length ? 'Next' : "Let's play!"} <ArrowRight className="h-5 w-5" />
                      </ChunkyButton>
                    </div>
                  </div>
                </div>
              </motion.div>
              <div className="mt-3 flex justify-center gap-2">
                {cards.map((_, i) => (
                  <span key={i} className={`h-2.5 rounded-full transition-all ${i === card ? 'w-8 bg-amber-500' : 'w-2.5 bg-stone-300'}`} />
                ))}
              </div>
            </motion.section>
          )}

          {step === 'play' && (
            <motion.section
              key={`play-${gameKey}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="card-3d mt-3 bg-white p-4 sm:p-6"
              id="game-area"
            >
              <h2 className="mb-3 text-center text-xl font-black text-stone-900 sm:text-2xl">🎮 {chapter.gameTitle}</h2>
              {game()}
            </motion.section>
          )}

          {step === 'result' && result && (
            <motion.section key="result" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-3d mt-3 bg-white p-6 text-center sm:p-8" id="game-result">
              <div className="flex justify-center gap-2 text-6xl sm:text-7xl">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2 + i * 0.25, type: 'spring' }}
                    className={i < starsForScore(result.score, result.total) ? 'text-amber-400 drop-shadow-[0_5px_0_rgba(180,83,9,0.35)]' : 'text-stone-200'}
                  >
                    ★
                  </motion.span>
                ))}
              </div>
              {/* Game rating (out of 3) and collection reward are different things;
                  say which is which so "3 stars" and "+15" never look like a mismatch. */}
              <p className="mt-2 text-sm font-black uppercase tracking-wide text-stone-500">
                Game rating: {starsForScore(result.score, result.total)} of 3 stars
              </p>
              <p className="mt-2 text-2xl font-black text-stone-900">
                {result.score} of {result.total} answers right on the first try
              </p>
              {result.gained > 0 ? (
                <p className="mt-1 font-black text-emerald-600">+{result.gained * 5} ⭐ added to your star collection!</p>
              ) : (
                <p className="mt-1 font-bold text-stone-500">
                  {(progress?.stars || 0) >= 3
                    ? 'You already earned all the stars for this game. Now read it aloud!'
                    : `Your best is still ${progress?.stars || 0} of 3 stars. Play again to beat it!`}
                </p>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ChunkyButton
                  color="white"
                  onClick={() => {
                    setGameKey((k) => k + 1);
                    setStep('play');
                  }}
                  className="inline-flex items-center gap-2"
                  id="btn-play-again"
                >
                  <RotateCcw className="h-5 w-5" /> Play again
                </ChunkyButton>
                <ChunkyButton color="violet" onClick={() => setStep('read')} className="inline-flex items-center gap-2" id="btn-go-read">
                  <Mic className="h-5 w-5" /> Now read aloud
                </ChunkyButton>
              </div>
            </motion.section>
          )}

          {step === 'read' && (
            <motion.section key="read" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-3d mt-3 bg-white p-5 sm:p-8" id="read-step">
              <h2 className="text-xl font-black text-stone-900 sm:text-2xl">🎤 Read it aloud</h2>
              <p className="mt-1 text-sm font-semibold text-stone-500">
                Read these {chapter.readAloud.length} lines to Shakthi Mitra. Then answer 3 questions!
              </p>
              <ol className="mt-4 space-y-2">
                {chapter.readAloud.map((line, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-2xl bg-amber-50 p-3 text-lg font-bold text-stone-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-amber-950">{i + 1}</span>
                    <span className="flex-1">{line}</span>
                    <button type="button" onClick={() => speak(line)} aria-label="Listen to this line" className="shrink-0 rounded-xl bg-white p-1.5 text-sky-600 shadow">
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <ChunkyButton color="emerald" onClick={() => onReadAloud(labStory(chapter, student))} className="inline-flex items-center gap-2 text-lg" id="btn-start-read-aloud">
                  <Mic className="h-5 w-5" /> Start reading
                </ChunkyButton>
                {readDone && <span className="font-black text-emerald-600">✓ You read this chapter already!</span>}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
