import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Story, StoryPage, ReaderMode } from '../types';
import { MascotBuddy } from './MascotBuddy';
import { soundEffects } from '../services/soundEffects';
import { kidSpeech } from '../services/speechSynthesis';
import { speechRecognition, SpeechMatchResult } from '../services/speechRecognition';
import { StudioVoiceBar } from './StudioVoiceBar';
import { VoiceProfileModal } from './VoiceProfileModal';
import {
  Volume2,
  Mic,
  MicOff,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  BookOpen,
  HelpCircle,
  Star,
  CheckCircle2,
  VolumeX,
  Languages,
  Check,
  X,
  ChevronRight,
  Info,
} from 'lucide-react';

interface ReadAlongReaderProps {
  story: Story;
  onBack?: () => void;
  onClose?: () => void;
  onFinishStory?: (sessionStats: {
    durationSeconds: number;
    wordsRead: number;
    totalWords: number;
    accuracy: number;
    wpm: number;
    starsEarned: number;
    struggledWords: string[];
  }) => void;
  onComplete?: (sessionStats: {
    durationSeconds: number;
    wordsRead: number;
    totalWords: number;
    accuracy: number;
    wpm: number;
    starsEarned: number;
    struggledWords: string[];
  }) => void;
}

export const ReadAlongReader: React.FC<ReadAlongReaderProps> = ({
  story,
  onBack,
  onClose,
  onFinishStory,
  onComplete,
}) => {
  const handleExit = onBack || onClose || (() => {});
  const handleFinish = onFinishStory || onComplete || (() => {});

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [mode, setMode] = useState<ReaderMode>('read_aloud');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);

  // Highlighting & word matching
  const [matchedWordIndices, setMatchedWordIndices] = useState<number[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  // Per-word result of the current reading attempt (tick / cross / not reached yet)
  const [wordStatuses, setWordStatuses] = useState<Array<'pending' | 'correct' | 'wrong'>>([]);
  const [micPhase, setMicPhase] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [micError, setMicError] = useState<string | null>(null);
  const [pageResult, setPageResult] = useState<{ accuracy: number; correct: number; total: number; wpm: number } | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [mascotMood, setMascotMood] = useState<'happy' | 'listening' | 'cheering' | 'clapping' | 'celebrating'>('happy');
  const [mascotSpeech, setMascotSpeech] = useState<string>('Ready to read? Let us begin!');

  // Analytics tracking
  const startTimeRef = useRef<number>(Date.now());
  // Best number of correctly read words per page (sum = words read for the story)
  const pageCorrectRef = useRef<Record<number, number>>({});
  // Real speaking time/words across all attempts, used for the story's WPM
  const speechStatsRef = useRef<{ words: number; seconds: number }>({ words: 0, seconds: 0 });
  const starsAwardedPagesRef = useRef<Set<number>>(new Set());
  const prevCorrectCountRef = useRef<number>(0);
  const struggledWordsRef = useRef<Set<string>>(new Set());
  const starsEarnedRef = useRef<number>(0);
  // Real per-page accuracy from the mic (Sarvam STT), one entry per page
  // once that page's Reading Aloud attempt finishes. The final certificate
  // accuracy is the average of these — not a hardcoded number.
  const pageAccuraciesRef = useRef<Record<number, number>>({});
  const [pageCompleted, setPageCompleted] = useState(false);
  const [showRetryPrompt, setShowRetryPrompt] = useState(false);

  const currentPage: StoryPage = story.pages[currentPageIndex] || story.pages[0];
  const words = currentPage.text.split(/\s+/).filter(Boolean);

  // Initialize page
  useEffect(() => {
    setMatchedWordIndices([]);
    setWordStatuses([]);
    setActiveWordIndex(-1);
    setPageCompleted(false);
    setShowRetryPrompt(false);
    setIsAudioPlaying(false);
    setMicPhase('idle');
    setMicError(null);
    setPageResult(null);
    setIsMicActive(false);
    prevCorrectCountRef.current = 0;
    speechRecognition.cancel(false);
    kidSpeech.stop();

    // Default friendly prompt
    if (mode === 'read_aloud') {
      setMascotMood('happy');
      setMascotSpeech(
        story.language === 'Telugu'
          ? 'మైక్ ఆన్ చేసి చదువుదాం!'
          : story.language === 'Hindi'
          ? 'माइक ऑन करो और पढ़ो!'
          : 'Turn on mic and read aloud!'
      );
    }
  }, [currentPageIndex, mode, story]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      speechRecognition.cancel(false);
      kidSpeech.stop();
    };
  }, []);

  // Handle Mode Change
  const handleModeSelect = (newMode: ReaderMode) => {
    speechRecognition.cancel(false);
    kidSpeech.stop();
    setIsMicActive(false);
    setIsAudioPlaying(false);
    setMode(newMode);
    setMatchedWordIndices([]);
    setActiveWordIndex(-1);

    if (newMode === 'listen') {
      startListenMode();
    } else if (newMode === 'read_aloud') {
      startMicMode();
    }
  };

  // 1. Listen & Follow along (Karaoke with Kid Voice)
  const startListenMode = () => {
    setIsAudioPlaying(true);
    setMascotMood('cheering');
    setMascotSpeech('Listen carefully and follow along!');
    soundEffects.playPageTurn();

    // Use the speed/pitch the user picked in the Voice & Narration Studio
    // instead of a fixed rate — this hardcoded rate: 0.85 is why narration
    // speed looked "stuck" on the story reading screen regardless of the
    // studio setting (reported for the Kaziranga elephant story).
    const studioSettings = kidSpeech.getSettings();
    kidSpeech.speakText(currentPage.text, story.language, {
      pitch: studioSettings.pitch,
      rate: studioSettings.rate,
      onWordBoundary: (charIndex, word) => {
        // Find approximate word index
        const sub = currentPage.text.substring(0, charIndex);
        const idx = sub.trim().split(/\s+/).length - 1;
        setActiveWordIndex(Math.max(0, idx));
        soundEffects.playWordPop();
      },
      onEnd: () => {
        setIsAudioPlaying(false);
        setActiveWordIndex(-1);
        setMatchedWordIndices(words.map((_, i) => i));
        setPageCompleted(true);
        setMascotMood('clapping');
        soundEffects.playStarChime();
        kidSpeech.playEncouragement(story.language);
      },
    });
  };

  // 2. Microphone Read Aloud Mode
  // One tap starts listening. Recording stops after seven seconds of silence
  // (or as soon as every word has been read); words are ticked
  // / crossed while the child reads, and the result is shown at the end.
  // Tapping the button again while listening simply finishes early.
  const startMicMode = () => {
    if (micPhase === 'processing') return;
    if (micPhase === 'recording') {
      speechRecognition.stopListening();
      return;
    }

    // Silence ends a read after seven quiet seconds. Keep a generous safety
    // cap so a slow reader is not cut off by a short fixed recording window.
    const windowMs = 5 * 60 * 1000;
    setMicError(null);
    setPageResult(null);
    setShowRetryPrompt(false);
    setMatchedWordIndices([]);
    setWordStatuses([]);
    setActiveWordIndex(0);
    prevCorrectCountRef.current = 0;
    setMascotMood('listening');
    setMascotSpeech(
      story.language === 'Telugu'
        ? 'నేను వింటున్నాను... చదువు!'
        : story.language === 'Hindi'
        ? 'मैं सुन रहा हूँ... पढ़ो!'
        : "I am listening... go ahead!"
    );

    speechRecognition.startListening(
      story.language,
      currentPage.text,
      (result: SpeechMatchResult) => {
        setMatchedWordIndices(result.matchedWordIndices);
        setWordStatuses(result.wordStatuses);
        setActiveWordIndex(result.currentWordIndex);

        // Pop sound only when a NEW word was ticked
        if (result.matchedWordIndices.length > prevCorrectCountRef.current) {
          soundEffects.playWordPop();
        }
        prevCorrectCountRef.current = result.matchedWordIndices.length;

        if (!result.isComplete) return; // live update — wait for the final check

        // ---- Final result for this attempt ----
        const correctCount = result.matchedWordIndices.length;
        const accuracy = Math.round(result.accuracy);

        // Keep the BEST accuracy / correct-word count per page across retries
        pageAccuraciesRef.current[currentPageIndex] = Math.max(
          pageAccuraciesRef.current[currentPageIndex] ?? 0,
          result.accuracy
        );
        pageCorrectRef.current[currentPageIndex] = Math.max(
          pageCorrectRef.current[currentPageIndex] ?? 0,
          correctCount
        );
        speechStatsRef.current.words += result.spokenWordCount;
        speechStatsRef.current.seconds += result.durationSeconds;

        result.wordStatuses.forEach((status, idx) => {
          if (status === 'wrong' && words[idx]) {
            struggledWordsRef.current.add(words[idx]);
          }
        });

        setPageResult({ accuracy, correct: correctCount, total: words.length, wpm: result.wpm });

        if (result.accuracy < 70) {
          // Below the 70% bar: ask the child to try this page again
          setPageCompleted(false);
          setShowRetryPrompt(true);
          setMascotMood('happy');
          kidSpeech.playTryAgainEncouragement(story.language);
          setMascotSpeech(
            story.language === 'Telugu'
              ? 'పర్వాలేదు! మళ్ళీ ప్రయత్నిద్దాం!'
              : story.language === 'Hindi'
              ? 'कोई बात नहीं! फिर कोशिश करते हैं!'
              : 'Almost there — let\'s try this page again!'
          );
          return;
        }

        setPageCompleted(true);
        setShowRetryPrompt(false);
        setMascotMood('celebrating');
        if (!starsAwardedPagesRef.current.has(currentPageIndex)) {
          starsAwardedPagesRef.current.add(currentPageIndex); // stars once per page, not per retry
          starsEarnedRef.current += 5;
        }
        soundEffects.playStarChime();
        kidSpeech.playEncouragement(story.language);
        setMascotSpeech(
          story.language === 'Telugu'
            ? 'శభాష్! సూపర్ గా చదివావు! ⭐'
            : story.language === 'Hindi'
            ? 'शाबाश! बहुत सुंदर! ⭐'
            : 'Superstar! Great reading! ⭐'
        );
      },
      (err) => {
        setMicPhase('idle');
        setMicError(err || 'The microphone could not be used. Please try again.');
        setMascotMood('happy');
        setMascotSpeech('Click any word to practice pronouncing!');
      },
      (listening) => {
        setIsMicActive(listening);
      },
      {
        maxDurationMs: windowMs,
        silenceTimeoutMs: 7000,
        interimIntervalMs: 2000,
        stopWhenAllMatched: false,
        onPhase: (phase) => {
          setMicPhase(phase);
        },
      }
    );
  };

  // 3. Word Exploration (Tap any word)
  const handleWordClick = (word: string, index: number) => {
    // Playing a word aloud while the microphone is open would be picked up by
    // the mic and scored as the child's own reading.
    if (micPhase !== 'idle') return;
    soundEffects.playWordPop();
    setActiveWordIndex(index);
    kidSpeech.speakSlowWord(word, story.language);

    // (Tapping a word to hear it no longer ticks it as "read" — a tick now
    // only ever comes from what the microphone actually heard.)
  };

  // Next Page / Finish Story
  const handleNextPage = () => {
    soundEffects.playPageTurn();
    if (currentPageIndex < story.pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    } else {
      // Calculate final reading stats from REAL per-page accuracy captured
      // from the mic (Sarvam STT), not a hardcoded value. Previously this
      // was `Math.max(78, ...)`, which floored accuracy at 78% no matter
      // what was actually read — that's why every child got a "brilliant
      // pronunciation" certificate regardless of stars/accuracy/speed.
      const totalSeconds = Math.max(5, Math.round((Date.now() - startTimeRef.current) / 1000));
      const totalStoryWords = story.pages.reduce((acc, p) => acc + p.text.split(/\s+/).length, 0);
      const wordsRead = Object.values(pageCorrectRef.current).reduce((sum, n) => sum + n, 0);
      // WPM from the time the child actually spoke, not from how long the
      // story screen was open
      const wpm =
        speechStatsRef.current.seconds > 0
          ? Math.round((speechStatsRef.current.words / speechStatsRef.current.seconds) * 60)
          : 0;

      const recordedAccuracies = Object.values(pageAccuraciesRef.current);
      // If the child used Listen mode (no mic) for some/all pages, we have
      // no real accuracy signal for those pages — don't fabricate one.
      const accuracy =
        recordedAccuracies.length > 0
          ? Math.round(
              recordedAccuracies.reduce((sum, a) => sum + a, 0) / recordedAccuracies.length
            )
          : 0;
      const starsEarned = starsEarnedRef.current;

      soundEffects.playVictoryFanfare();
      handleFinish({
        durationSeconds: totalSeconds,
        wordsRead,
        totalWords: totalStoryWords,
        accuracy,
        wpm,
        starsEarned,
        struggledWords: Array.from(struggledWordsRef.current),
      });
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      soundEffects.playPageTurn();
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcf6] text-[#2d2d2d] flex flex-col justify-between p-3 sm:p-6 select-none font-sans" id="read-along-reader">
      {/* Top Reader Navigation Bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-3xl shadow-xs border border-[#e8e4d8]" id="reader-top-bar">
        <button
          onClick={handleExit}
          id="btn-reader-back"
          className="flex items-center gap-2 text-stone-700 hover:text-[#2d2d2d] bg-[#f4f1e8] hover:bg-[#eae5d8] px-4 py-2 rounded-2xl font-bold text-xs sm:text-sm transition-all border border-[#e5e1d5] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Library</span>
        </button>

        {/* Story Title & Page Counter */}
        <div className="text-center flex-1 min-w-0 px-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">{story.coverEmoji}</span>
            <h1 className="font-black text-[#2d2d2d] text-sm sm:text-base truncate">{story.title}</h1>
            <span className="bg-[#fff8e6] text-amber-900 text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg border border-[#fae2a0]">
              {story.language}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 truncate font-medium mt-0.5">{story.titleEnglish}</p>
        </div>

        {/* Progress Bar & Page Number */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-black text-[#2d2d2d] bg-[#f4f1e8] px-3.5 py-1.5 rounded-2xl border border-[#e5e1d5]">
            <span>Page {currentPageIndex + 1}</span>
            <span className="text-stone-400">/</span>
            <span>{story.pages.length}</span>
          </div>
        </div>
      </div>

      {/* Main Reading Stage */}
      <div className="w-full max-w-5xl mx-auto my-4 flex-1 flex flex-col lg:flex-row gap-5 items-stretch" id="reading-stage">
        {/* Left Column: Visual Scene & Mascot Companion */}
        <div className="w-full lg:w-5/12 bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-[#e8e4d8] flex flex-col justify-between items-center relative overflow-hidden" id="reader-scene-panel">
          {/* Header Theme Tag */}
          <div className="w-full flex items-center justify-between text-xs font-bold">
            <span className="bg-[#fef6ee] text-[#9a3412] px-3 py-1 rounded-xl border border-[#fed7aa]">
              {story.category}
            </span>
            <div className="flex items-center gap-1 text-amber-700 font-extrabold bg-[#fff8e6] px-2.5 py-1 rounded-xl border border-[#fae2a0]">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>+{story.pages.length * 3} Stars</span>
            </div>
          </div>

          {/* Illustrated Scene Banner */}
          <div className="my-4 w-full h-40 sm:h-48 rounded-2xl bg-[#fffbf0] border border-[#fae2a0] p-4 flex flex-col items-center justify-center text-center relative">
            <motion.div
              key={`scene-${currentPageIndex}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <div className="text-5xl sm:text-6xl mb-2 filter drop-shadow-sm">
                {currentPageIndex === 0 ? story.coverEmoji : currentPageIndex === story.pages.length - 1 ? '🎉' : '📖'}
              </div>
              <p className="text-xs text-[#2d2d2d] font-semibold line-clamp-2 px-3 bg-white/90 py-1 rounded-xl border border-[#e8e4d8] shadow-xs">
                "{currentPage.illustrationPrompt}"
              </p>
            </motion.div>
          </div>

          {/* Interactive Mascot Companion */}
          <div className="w-full flex items-center justify-center pt-2">
            <MascotBuddy
              mood={mascotMood}
              language={story.language}
              speechText={mascotSpeech}
              size="md"
            />
          </div>
        </div>

        {/* Right Column: High-Contrast Read-Along Text Board */}
        <div className="w-full lg:w-7/12 bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-[#e8e4d8] flex flex-col justify-between relative gap-4" id="reader-text-board">
          {/* Top: Studio Voice Bar */}
          <StudioVoiceBar
            language={story.language}
            isAudioPlaying={isAudioPlaying}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          />

          {/* Mode indicator + toggles bar */}
          {/* Per earlier request: consolidated the two "speaking" buttons
              into one. That left this top pill saying "Start Reading Aloud"
              right next to the ACTUAL functional "Start Reading Aloud"
              button further down (next to the mic visualizer) — two buttons
              with the identical label, only one of which did anything. That
              was a real bug from my own last edit, not by design. Replaced
              the dead duplicate with a plain (non-clickable) status label,
              since there's only one mode now and a button that does nothing
              when tapped is worse than no button at all. */}
          <div className="flex items-center justify-between border-b border-[#f0ece1] pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-[#f4f1e8] px-3 py-1.5 rounded-2xl border border-[#e5e1d5] text-xs font-extrabold text-stone-700">
              <Mic className="w-3.5 h-3.5" />
              <span>Reading Practice Mode</span>
            </div>

            {/* Toggle Helper Switches */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                title="Toggle English Translation"
                className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                  showTranslation
                    ? 'bg-[#e0e7ff] text-[#3730a3] border-[#c7d2fe]'
                    : 'bg-[#f4f1e8] text-stone-500 border-[#e5e1d5]'
                }`}
              >
                English {showTranslation ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Retry prompt: shown when a Reading Aloud attempt scored below the
              70% accuracy bar for this page. The single "Start Reading Aloud"
              button at the bottom is the only mic control on the page. */}
          {showRetryPrompt && (
            <div
              id="reading-retry-banner"
              className="mt-2 p-3 bg-[#fff1f2] border border-rose-200 rounded-2xl text-xs sm:text-sm font-bold text-rose-900 flex items-center gap-2"
            >
              <span>That was below 70% — tap Start Reading Aloud to read this page again!</span>
            </div>
          )}

          {/* Interactive Word Tokens Canvas */}
          <div className="flex-1 flex flex-col justify-center py-2 sm:py-3">
            <div className="flex flex-wrap gap-2.5 sm:gap-3.5 items-center justify-start leading-relaxed text-[#2d2d2d]" id="reading-sentence-tokens">
              {words.map((word, idx) => {
                const status = wordStatuses[idx];
                const isMatched = status === 'correct' || (status === undefined && matchedWordIndices.includes(idx));
                const isWrong = status === 'wrong';
                const isActive = activeWordIndex === idx && !isMatched && !isWrong;

                return (
                  <motion.button
                    key={`${word}-${idx}`}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleWordClick(word, idx)}
                    id={`word-token-${idx}`}
                    className={`cursor-pointer text-2xl sm:text-3xl font-black px-3.5 py-2 rounded-2xl transition-all relative select-none ${
                      isMatched
                        ? 'bg-[#edf9f2] text-emerald-950 border-2 border-[#a7f3d0] shadow-2xs'
                        : isWrong
                        ? 'bg-[#fff1f2] text-rose-900 border-2 border-rose-300 shadow-2xs'
                        : isActive
                        ? 'bg-amber-300 text-amber-950 border-2 border-amber-500 shadow-sm scale-105 ring-2 ring-amber-400'
                        : 'bg-[#f8f6f0] hover:bg-[#fff8e6] text-[#2d2d2d] border border-[#e8e4d8] hover:border-amber-400'
                    }`}
                  >
                    <span>{word}</span>
                    {isMatched && (
                      <span className="absolute -top-2 -right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-xs" title="Read correctly">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                    {isWrong && (
                      <span className="absolute -top-2 -right-1 bg-rose-600 text-white rounded-full p-0.5 shadow-xs" title="Needs practice">
                        <X className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Mic problem (permission denied, service down, nothing heard...) */}
            {micError && (
              <div
                id="mic-error-banner"
                className="mt-3 p-3 bg-[#fff1f2] border border-rose-200 rounded-2xl text-xs sm:text-sm font-bold text-rose-900"
              >
                {micError}
              </div>
            )}

            {/* Result of the latest reading attempt */}
            {pageResult && (
              <div
                id="reading-result-card"
                className={`mt-3 p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-x-5 gap-y-1 flex-wrap ${
                  pageResult.accuracy >= 70
                    ? 'bg-[#edf9f2] border-emerald-200 text-emerald-950'
                    : 'bg-[#fff8e6] border-amber-200 text-amber-950'
                }`}
              >
                <span className="text-base font-black">Accuracy {pageResult.accuracy}%</span>
                <span>✓ {pageResult.correct} correct</span>
                <span>✗ {pageResult.total - pageResult.correct} to practise</span>
                <span>{pageResult.wpm} words/min</span>
              </div>
            )}

            {/* English Translation */}
            {showTranslation && currentPage.englishTranslation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2.5 p-3.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-2xl text-xs sm:text-sm font-medium text-blue-950 flex items-center gap-2"
                id="translation-box"
              >
                <span className="font-black text-blue-900 bg-[#dbeafe] px-2.5 py-0.5 rounded-lg text-[11px]">
                  Meaning
                </span>
                <span>{currentPage.englishTranslation}</span>
              </motion.div>
            )}

          </div>

          {/* Bottom Action Controls */}
          <div className="mt-2 pt-3.5 border-t border-[#f0ece1] flex items-center justify-between gap-3 flex-wrap" id="reader-action-bar">
            {/* Primary Mode Button (Mic Toggle) */}
            <div className="flex items-center gap-2">
              {/* The `mode === 'read_aloud' ? ... : ...` branch here used to
                  switch between this mic button and a separate "Read Aloud
                  to Me" button, back when there were two reading modes.
                  Mode is now always 'read_aloud' (the mode switcher was
                  consolidated to one option earlier), so the "Read Aloud to
                  Me" branch was dead code that could never actually render —
                  removed it instead of leaving unreachable code behind. */}
              <button
                onClick={startMicMode}
                id="btn-toggle-mic"
                disabled={micPhase === 'processing'}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer disabled:cursor-wait ${
                  micPhase === 'recording'
                    ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                    : micPhase === 'processing'
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {micPhase === 'recording' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>
                  {micPhase === 'recording'
                    ? 'Listening…'
                    : micPhase === 'processing'
                    ? 'Checking your reading…'
                    : pageResult
                    ? 'Read Again'
                    : 'Start Reading Aloud'}
                </span>
              </button>

              {/* Repeat audio button */}
              <button
                onClick={() => {
                  soundEffects.playPageTurn();
                  kidSpeech.speakText(currentPage.text, story.language);
                }}
                id="btn-replay-sentence"
                disabled={micPhase !== 'idle'}
                title="Hear sentence again"
                className="p-3 bg-[#f4f1e8] hover:bg-[#eae5d8] disabled:opacity-40 disabled:cursor-not-allowed text-stone-800 rounded-2xl transition-all border border-[#e5e1d5] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Page Navigation Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPageIndex === 0}
                id="btn-prev-page"
                className="p-3 bg-[#f4f1e8] hover:bg-[#eae5d8] disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 rounded-2xl font-bold transition-all border border-[#e5e1d5] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <button
                onClick={handleNextPage}
                id="btn-next-page"
                disabled={mode === 'read_aloud' && !pageCompleted}
                title={
                  mode === 'read_aloud' && !pageCompleted
                    ? 'Read this page aloud (70%+ accuracy) to continue'
                    : undefined
                }
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  pageCompleted
                    ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 ring-4 ring-amber-200'
                    : 'bg-[#2d2d2d] hover:bg-black text-white'
                }`}
              >
                <span>{currentPageIndex === story.pages.length - 1 ? 'Finish Story ⭐' : 'Next Page'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Voice Studio Modal */}
      <VoiceProfileModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        language={story.language}
      />
    </div>
  );
};
