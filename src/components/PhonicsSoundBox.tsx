import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Volume2, Sparkles, BookOpen, Check } from 'lucide-react';
import { Language, SpotlightWord } from '../types';
import { kidSpeech } from '../services/speechSynthesis';
import { VoiceWaveformVisualizer } from './VoiceWaveformVisualizer';

interface PhonicsSoundBoxProps {
  word: SpotlightWord;
  language: Language;
  onClose?: () => void;
}

export const PhonicsSoundBox: React.FC<PhonicsSoundBoxProps> = ({
  word,
  language,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Split into syllables/phonetic units
  const syllables = word.phonetic
    ? word.phonetic.split(/[-·\s]+/).filter(Boolean)
    : [word.word];

  const handlePlaySlow = () => {
    setIsPlaying(true);
    kidSpeech.speakSlowWord(word.word, language, () => {
      setIsPlaying(false);
    });
  };

  const handlePlayNormal = () => {
    setIsPlaying(true);
    kidSpeech.speakText(word.word, language, {
      style: 'cheerful_teacher',
      onEnd: () => setIsPlaying(false),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-[#fffdf7] border-2 border-[#fae2a0] rounded-2xl p-4 shadow-sm"
      id="phonics-sound-box"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {/* Main Word Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-black text-[#2d2d2d] bg-[#fef3c7] px-3 py-1 rounded-xl border border-[#fde68a]">
              {word.word}
            </span>
            <span className="text-xs font-black text-amber-900 bg-[#fef3c7] px-2.5 py-1 rounded-lg">
              {language} Vocabulary
            </span>
          </div>

          {/* Phonics Syllables Breakdown */}
          {syllables.length > 1 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-stone-500 mr-1">
                Phonics Syllables:
              </span>
              {syllables.map((syl, i) => (
                <button
                  key={i}
                  onClick={() => kidSpeech.speakSlowWord(syl, language)}
                  className="bg-[#f4f1e8] hover:bg-[#ffeeba] text-[#2d2d2d] border border-[#e5dfce] px-2.5 py-1 rounded-lg text-sm font-black transition-all hover:scale-105"
                  title={`Hear "${syl}" syllable`}
                >
                  {syl}
                </button>
              ))}
            </div>
          )}

          {/* Meaning & Child Example */}
          <div className="mt-2.5 space-y-1">
            <p className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <span className="font-black text-amber-900">Meaning:</span>{' '}
              {word.meaning}
            </p>
            {word.example && (
              <p className="text-[11px] text-stone-600 italic bg-[#fcfbf9] p-2 rounded-xl border border-[#e8e4d8]">
                "{word.example}"
              </p>
            )}
          </div>
        </div>

        {/* Audio Action Buttons & Waveform */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePlaySlow}
              disabled={isPlaying}
              id="btn-play-slow-phonics"
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-amber-950 px-3.5 py-2 rounded-xl font-black text-xs shadow-2xs transition-all hover:scale-105"
              title="Hear slow syllable pronunciation"
            >
              <Volume2 className="w-4 h-4" />
              <span>Slow Phonics</span>
            </button>

            <button
              onClick={handlePlayNormal}
              disabled={isPlaying}
              id="btn-play-normal-phonics"
              className="p-2 bg-[#2d2d2d] hover:bg-black text-white rounded-xl shadow-2xs transition-all hover:scale-105"
              title="Hear normal speed"
            >
              <Volume2 className="w-4 h-4 text-amber-400" />
            </button>
          </div>

          <VoiceWaveformVisualizer
            isActive={isPlaying}
            colorScheme="amber"
            barCount={8}
            height={20}
          />
        </div>
      </div>
    </motion.div>
  );
};
