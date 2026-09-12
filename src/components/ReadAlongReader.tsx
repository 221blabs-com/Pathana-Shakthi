import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Story, StoryPage, ReaderMode, SpotlightWord } from '../types';
import { MascotBuddy } from './MascotBuddy';
import { soundEffects } from '../services/soundEffects';
import { kidSpeech } from '../services/speechSynthesis';
import { speechRecognition, SpeechMatchResult } from '../services/speechRecognition';
import { StudioVoiceBar } from './StudioVoiceBar';
import { VoiceProfileModal } from './VoiceProfileModal';
import { LiveMicVisualizer } from './LiveMicVisualizer';
import { PhonicsSoundBox } from './PhonicsSoundBox';
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
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Highlighting & word matching
  const [matchedWordIndices, setMatchedWordIndices] = useState<number[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [selectedWord, setSelectedWord] = useState<SpotlightWord | null>(null);
  const [lastRecognizedWord, setLastRecognizedWord] = useState<string>('');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [mascotMood, setMascotMood] = useState<'happy' | 'listening' | 'cheering' | 'clapping' | 'celebrating'>('happy');
  const [mascotSpeech, setMascotSpeech] = useState<string>('Ready to read? Let us begin!');

  // Analytics tracking
  const startTimeRef = useRef<number>(Date.now());
  const wordsReadCountRef = useRef<number>(0);
  const struggledWordsRef = useRef<Set<string>>(new Set());
  const starsEarnedRef = useRef<number>(0);
  const [pageCompleted, setPageCompleted] = useState(false);

  const currentPage: StoryPage = story.pages[currentPageIndex] || story.pages[0];
  const words = currentPage.text.split(/\s+/).filter(Boolean);

  // Initialize page
  useEffect(() => {
    setMatchedWordIndices([]);
    setActiveWordIndex(-1);
    setPageCompleted(false);
    setSelectedWord(null);
    setIsAudioPlaying(false);
    speechRecognition.stopListening();
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
      speechRecognition.stopListening();
      kidSpeech.stop();
    };
  }, []);

  // Handle Mode Change
  const handleModeSelect = (newMode: ReaderMode) => {
    speechRecognition.stopListening();
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

    kidSpeech.speakText(currentPage.text, story.language, {
      pitch: 1.38,
      rate: 0.85,
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
  const startMicMode = () => {
    if (isMicActive) {
      speechRecognition.stopListening();
      setIsMicActive(false);
      setMascotMood('happy');
      return;
    }

    setIsMicActive(true);
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
        setActiveWordIndex(result.currentWordIndex);

        if (result.matchedWordIndices.length > 0) {
          soundEffects.playWordPop();
          wordsReadCountRef.current += 1;
          const lastIdx = result.matchedWordIndices[result.matchedWordIndices.length - 1];
          if (words[lastIdx]) {
            setLastRecognizedWord(words[lastIdx]);
          }
        }

        if (result.isComplete && !pageCompleted) {
          setPageCompleted(true);
          speechRecognition.stopListening();
          setIsMicActive(false);
          setMascotMood('celebrating');
          starsEarnedRef.current += 5;
          soundEffects.playStarChime();
          kidSpeech.playEncouragement(story.language);
          setMascotSpeech(
            story.language === 'Telugu'
              ? 'శభాష్! సూపర్ గా చదివావు! ⭐'
              : story.language === 'Hindi'
              ? 'शाबाश! बहुत सुंदर! ⭐'
              : 'Superstar! Great reading! ⭐'
          );
        }
      },
      (err) => {
        setIsMicActive(false);
        setMascotMood('happy');
        setMascotSpeech('Click any word to practice pronouncing!');
      },
      (listening) => {
        setIsMicActive(listening);
      }
    );
  };

  // 3. Word Exploration (Tap any word)
  const handleWordClick = (word: string, index: number) => {
    soundEffects.playWordPop();
    setActiveWordIndex(index);
    kidSpeech.speakSlowWord(word, story.language);

    // Look up if it is in spotlight words
    const cleanW = word.replace(/[।,!?.":;()]/g, '').trim();
    const found = story.spotlightWords.find(
      (sw) => sw.word.toLowerCase() === cleanW.toLowerCase() || sw.word.includes(cleanW)
    );

    if (found) {
      setSelectedWord(found);
    } else {
      setSelectedWord({
        word: cleanW,
        meaning: `Phonetic reading for ${story.language}`,
        pronunciation: cleanW,
        example: `From page ${currentPageIndex + 1} of ${story.title}`,
      });
    }

    // Mark as matched if practicing
    if (!matchedWordIndices.includes(index)) {
      setMatchedWordIndices([...matchedWordIndices, index]);
    }
  };

  // Next Page / Finish Story
  const handleNextPage = () => {
    soundEffects.playPageTurn();
    if (currentPageIndex < story.pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    } else {
      // Calculate final reading stats
      const totalSeconds = Math.max(5, Math.round((Date.now() - startTimeRef.current) / 1000));
      const totalStoryWords = story.pages.reduce((acc, p) => acc + p.text.split(/\s+/).length, 0);
      const wordsRead = Math.max(wordsReadCountRef.current, totalStoryWords);
      const wpm = Math.round((wordsRead / totalSeconds) * 60) || 38;
      const accuracy = Math.min(100, Math.max(78, Math.round(92 - struggledWordsRef.current.size * 3)));
      const starsEarned = Math.max(10, starsEarnedRef.current + story.pages.length * 4);

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

          {/* Mode Switcher Bar */}
          <div className="flex items-center justify-between border-b border-[#f0ece1] pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-[#f4f1e8] p-1 rounded-2xl border border-[#e5e1d5]">
              <button
                onClick={() => handleModeSelect('read_aloud')}
                id="btn-mode-read"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  mode === 'read_aloud'
                    ? 'bg-[#2d2d2d] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-[#eae5d8]'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>I'll Read (Mic)</span>
              </button>

              <button
                onClick={() => handleModeSelect('listen')}
                id="btn-mode-listen"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  mode === 'listen'
                    ? 'bg-[#2d2d2d] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-[#eae5d8]'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Read to Me</span>
              </button>
            </div>

            {/* Toggle Helper Switches */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowTransliteration(!showTransliteration)}
                title="Toggle Phonics Pronunciation Guide"
                className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                  showTransliteration
                    ? 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]'
                    : 'bg-[#f4f1e8] text-stone-500 border-[#e5e1d5]'
                }`}
              >
                Phonics {showTransliteration ? 'ON' : 'OFF'}
              </button>
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

          {/* If Read Aloud Mode Active, show Live Mic Visualizer */}
          {mode === 'read_aloud' && (
            <LiveMicVisualizer
              isListening={isMicActive}
              language={story.language}
              onToggleMic={startMicMode}
              lastRecognizedWord={lastRecognizedWord}
            />
          )}

          {/* Interactive Word Tokens Canvas */}
          <div className="flex-1 flex flex-col justify-center py-2 sm:py-3">
            <div className="flex flex-wrap gap-2.5 sm:gap-3.5 items-center justify-start leading-relaxed text-[#2d2d2d]" id="reading-sentence-tokens">
              {words.map((word, idx) => {
                const isMatched = matchedWordIndices.includes(idx);
                const isActive = activeWordIndex === idx;

                return (
                  <motion.button
                    key={`${word}-${idx}`}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleWordClick(word, idx)}
                    id={`word-token-${idx}`}
                    className={`cursor-pointer text-2xl sm:text-3xl font-black px-3.5 py-2 rounded-2xl transition-all relative select-none ${
                      isActive
                        ? 'bg-amber-300 text-amber-950 border-2 border-amber-500 shadow-sm scale-105 ring-2 ring-amber-400'
                        : isMatched
                        ? 'bg-[#edf9f2] text-emerald-950 border-2 border-[#a7f3d0] shadow-2xs'
                        : 'bg-[#f8f6f0] hover:bg-[#fff8e6] text-[#2d2d2d] border border-[#e8e4d8] hover:border-amber-400'
                    }`}
                  >
                    <span>{word}</span>
                    {isMatched && (
                      <span className="absolute -top-2 -right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Phonics Romanized Transliteration Guide */}
            {showTransliteration && currentPage.transliteration && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-3.5 bg-[#fff8e6] border border-[#fae2a0] rounded-2xl text-xs sm:text-sm font-medium text-amber-950 italic flex items-center gap-2"
                id="transliteration-box"
              >
                <span className="font-black not-italic text-amber-900 bg-[#fde68a] px-2.5 py-0.5 rounded-lg text-[11px]">
                  Phonics
                </span>
                <span>{currentPage.transliteration}</span>
              </motion.div>
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

            {/* Phonics Sound Box Drawer */}
            <AnimatePresence>
              {selectedWord && (
                <div className="mt-3">
                  <PhonicsSoundBox
                    word={selectedWord}
                    language={story.language}
                    onClose={() => setSelectedWord(null)}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Action Controls */}
          <div className="mt-2 pt-3.5 border-t border-[#f0ece1] flex items-center justify-between gap-3 flex-wrap" id="reader-action-bar">
            {/* Primary Mode Button (Mic Toggle / Speaker) */}
            <div className="flex items-center gap-2">
              {mode === 'read_aloud' ? (
                <button
                  onClick={startMicMode}
                  id="btn-toggle-mic"
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer ${
                    isMicActive
                      ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isMicActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMicActive ? 'Listening (Tap to stop)' : 'Start Reading Aloud'}</span>
                </button>
              ) : (
                <button
                  onClick={startListenMode}
                  id="btn-play-audio"
                  className="flex items-center gap-2 bg-[#2d2d2d] hover:bg-black text-white px-5 py-3 rounded-2xl font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>{isAudioPlaying ? 'Playing Story...' : 'Read Aloud to Me'}</span>
                </button>
              )}

              {/* Repeat audio button */}
              <button
                onClick={() => {
                  soundEffects.playPageTurn();
                  kidSpeech.speakText(currentPage.text, story.language);
                }}
                id="btn-replay-sentence"
                title="Hear sentence again"
                className="p-3 bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-800 rounded-2xl transition-all border border-[#e5e1d5] cursor-pointer"
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
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer ${
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
