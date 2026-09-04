import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Mic,
  MicOff,
  X,
  Sparkles,
  BookOpen,
  Globe2,
  Tag,
  Volume2,
  Check,
} from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

interface MultilingualSearchBarProps {
  query: string;
  onQueryChange: (newQuery: string) => void;
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
  selectedGrade: string;
  onSelectGrade: (grade: string) => void;
  totalResults: number;
  onClear: () => void;
  className?: string;
}

interface QuickTopic {
  id: string;
  emoji: string;
  labelEn: string;
  labelTe: string;
  labelHi: string;
  query: string;
}

const QUICK_TOPICS: QuickTopic[] = [
  {
    id: 'animals',
    emoji: '🦁',
    labelEn: 'Animals',
    labelTe: 'జంతువులు',
    labelHi: 'पशु-पक्षी',
    query: 'Animal',
  },
  {
    id: 'morals',
    emoji: '📜',
    labelEn: 'Morals & Panchatantra',
    labelTe: 'నీతి కథలు',
    labelHi: 'पंचतंत्र',
    query: 'Moral',
  },
  {
    id: 'nature',
    emoji: '🌿',
    labelEn: 'Nature & Trees',
    labelTe: 'ప్రకృతి & చెట్లు',
    labelHi: 'प्रकृति व पेड़',
    query: 'Nature',
  },
  {
    id: 'science',
    emoji: '☀️',
    labelEn: 'Science & Light',
    labelTe: 'విజ్ఞానం & సౌరశక్తి',
    labelHi: 'विज्ञान व ऊर्जा',
    query: 'Science',
  },
  {
    id: 'friendship',
    emoji: '🤝',
    labelEn: 'Friendship',
    labelTe: 'స్నేహం',
    labelHi: 'दोस्ती',
    query: 'Friendship',
  },
  {
    id: 'crow',
    emoji: '🦅',
    labelEn: 'Clever Crow',
    labelTe: 'కాకి ఉపాయం',
    labelHi: 'चतुर कौआ',
    query: 'Crow',
  },
];

export const MultilingualSearchBar: React.FC<MultilingualSearchBarProps> = ({
  query,
  onQueryChange,
  selectedLanguage,
  onSelectLanguage,
  selectedGrade,
  onSelectGrade,
  totalResults,
  onClear,
  className = '',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [activeVoiceLang, setActiveVoiceLang] = useState<'te-IN' | 'hi-IN' | 'en-IN'>('te-IN');
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Language options
  const languageOptions = [
    { id: 'All', label: 'All Languages (అన్నీ)', native: 'అన్నీ / सभी' },
    { id: 'Telugu', label: 'Telugu (తెలుగు)', native: 'తెలుగు' },
    { id: 'Hindi', label: 'Hindi (हिन्दी)', native: 'हिन्दी' },
    { id: 'English', label: 'English', native: 'English' },
  ];

  const gradeOptions = ['All', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = activeVoiceLang;

        rec.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };

        rec.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            onQueryChange(transcript.trim());
          }
        };

        rec.onerror = (event: any) => {
          console.warn('Voice search error:', event.error);
          setIsListening(false);
          if (event.error !== 'no-speech') {
            setSpeechError('Microphone not detected or permission denied.');
          }
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [activeVoiceLang, onQueryChange]);

  const toggleVoiceSearch = () => {
    if (!recognitionRef.current) {
      setSpeechError('Voice search is not supported in this browser.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsListening(false);
    } else {
      soundEffects.playWordPop();
      try {
        // Map selected language to Speech API locale
        let locale: 'te-IN' | 'hi-IN' | 'en-IN' = 'te-IN';
        if (selectedLanguage === 'Hindi') locale = 'hi-IN';
        else if (selectedLanguage === 'English') locale = 'en-IN';
        else if (selectedLanguage === 'Telugu') locale = 'te-IN';
        setActiveVoiceLang(locale);
        recognitionRef.current.lang = locale;
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start voice search:', err);
      }
    }
  };

  return (
    <div
      className={`bg-white rounded-3xl border border-stone-200 shadow-sm p-4 sm:p-5 space-y-4 ${className}`}
      id="multilingual-story-search-widget"
    >
      {/* Search Header Row with Input, Voice Search, and Language Tabs */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
        {/* Main Search Input Box with Multi-Language Support */}
        <div className="relative flex-1">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              id="input-story-search"
              placeholder="Search in తెలుగు (కాకి, సింహం), हिन्दी (कौआ, शेर), English, or topics..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="w-full pl-10 pr-24 py-3 rounded-2xl border border-stone-300 bg-stone-50/70 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-2xs"
            />

            {/* Clear Button */}
            {query && (
              <button
                type="button"
                onClick={() => {
                  soundEffects.playWordPop();
                  onClear();
                }}
                className="absolute right-12 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
                title="Clear Search"
                id="btn-clear-search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Voice Search Button with Active Microphone Indicator */}
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`absolute right-2 p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-md scale-105'
                  : 'bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-stone-200'
              }`}
              title={isListening ? 'Listening... Speak now!' : 'Search by Voice in Telugu, Hindi, or English'}
              id="btn-voice-search"
            >
              {isListening ? (
                <Mic className="w-4 h-4 animate-bounce" />
              ) : (
                <Mic className="w-4 h-4 text-amber-600" />
              )}
            </button>
          </div>

          {/* Voice Listening Banner */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute left-0 right-0 -bottom-8 z-30 flex items-center justify-between px-3 py-1 bg-red-600 text-white rounded-lg text-[11px] font-bold shadow-md"
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  Listening in {activeVoiceLang === 'te-IN' ? 'Telugu (తెలుగు)' : activeVoiceLang === 'hi-IN' ? 'Hindi (हिन्दी)' : 'English'}... Speak a story or animal name!
                </span>
                <button
                  type="button"
                  onClick={toggleVoiceSearch}
                  className="underline hover:text-red-100 text-[10px]"
                >
                  Stop
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Language Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {languageOptions.map((lang) => {
            const isSelected = selectedLanguage === lang.id;
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => {
                  soundEffects.playWordPop();
                  onSelectLanguage(lang.id);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 font-black shadow-2xs ring-1 ring-amber-400 scale-[1.02]'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 border border-stone-200/80'
                }`}
              >
                <span>{lang.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade Level Selector & Match Count */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-stone-100">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 shrink-0">
            Grade:
          </span>
          <div className="flex items-center gap-1">
            {gradeOptions.map((grade) => {
              const isSelected = selectedGrade === grade;
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => {
                    soundEffects.playWordPop();
                    onSelectGrade(grade);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-stone-900 text-white font-black shadow-2xs'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  {grade}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Counter & Active Filter Badge */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {query && (
            <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
              Query: <strong className="text-amber-700 font-bold">"{query}"</strong>
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-black">
            {totalResults} {totalResults === 1 ? 'Story' : 'Stories'} Found
          </span>
        </div>
      </div>

      {/* Quick Multilingual Subject & Topic Chips */}
      <div className="pt-2 border-t border-stone-100 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-stone-500 flex items-center gap-1">
            <Tag className="w-3 h-3 text-amber-600" />
            <span>Popular Subjects & Topics (విషయాలు / विषय):</span>
          </span>
          {query && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer"
            >
              Reset Search
            </button>
          )}
        </div>

        {/* Scrollable Quick Search Topic Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
          {QUICK_TOPICS.map((topic) => {
            const isActive = query.toLowerCase() === topic.query.toLowerCase();
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  soundEffects.playWordPop();
                  if (isActive) {
                    onClear();
                  } else {
                    onQueryChange(topic.query);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isActive
                    ? 'bg-amber-100 border-amber-400 text-amber-950 font-black shadow-2xs scale-[1.02]'
                    : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700 hover:text-stone-900'
                }`}
                title={`Search stories about ${topic.labelEn} (${topic.labelTe} / ${topic.labelHi})`}
              >
                <span>{topic.emoji}</span>
                <span>{topic.labelEn}</span>
                <span className="text-[10px] text-stone-400 font-normal">
                  ({selectedLanguage === 'Telugu' ? topic.labelTe : selectedLanguage === 'Hindi' ? topic.labelHi : `${topic.labelTe} / ${topic.labelHi}`})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
