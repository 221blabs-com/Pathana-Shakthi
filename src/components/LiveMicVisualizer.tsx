import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Sparkles, Volume2 } from 'lucide-react';
import { Language } from '../types';

interface LiveMicVisualizerProps {
  isListening: boolean;
  language: Language;
  onToggleMic: () => void;
  accuracyRate?: number;
  lastRecognizedWord?: string;
}

export const LiveMicVisualizer: React.FC<LiveMicVisualizerProps> = ({
  isListening,
  language,
  onToggleMic,
  accuracyRate,
  lastRecognizedWord,
}) => {
  const [pulseRings, setPulseRings] = useState([1, 2, 3]);

  const langLabels = {
    Telugu: {
      active: 'శ్రద్ధగా వింటున్నాను... చదవండి!',
      idle: 'మైక్ ఆన్ చేసి స్పష్టంగా చదవండి',
      detected: 'గుర్తించిన పదం:',
    },
    Hindi: {
      active: 'ध्यान से सुन रहे हैं... पढ़िए!',
      idle: 'माइक चालू करें और जोर से पढ़ें',
      detected: 'सुना गया शब्द:',
    },
    English: {
      active: 'Listening closely... Read aloud!',
      idle: 'Turn on microphone and read clearly',
      detected: 'Heard word:',
    },
  }[language] || {
    active: 'Listening closely... Read aloud!',
    idle: 'Turn on microphone and read clearly',
    detected: 'Heard word:',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all p-3 sm:p-4 ${
        isListening
          ? 'bg-gradient-to-r from-[#edf9f2] via-[#f0fdf4] to-[#e6f4ea] border-emerald-300 shadow-sm'
          : 'bg-[#fcfbf9] border-[#e8e4d8]'
      }`}
      id="live-mic-visualizer"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Pulsing Mic Button */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            {isListening && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full bg-emerald-400 opacity-40 pointer-events-none"
                />
                <motion.div
                  animate={{ scale: [1, 2.1, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    delay: 0.4,
                    ease: 'easeOut',
                  }}
                  className="absolute inset-0 rounded-full bg-teal-400 opacity-20 pointer-events-none"
                />
              </>
            )}

            <button
              onClick={onToggleMic}
              id="btn-live-mic-action"
              className={`relative z-10 p-3 rounded-2xl font-black text-white shadow-xs transition-all flex items-center justify-center ${
                isListening
                  ? 'bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-200'
                  : 'bg-[#2d2d2d] hover:bg-black'
              }`}
              title={isListening ? 'Stop Listening' : 'Start Reading Aloud'}
            >
              {isListening ? (
                <Mic className="w-5 h-5 animate-pulse text-white" />
              ) : (
                <Mic className="w-5 h-5 text-amber-400" />
              )}
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-[#2d2d2d]">
                {isListening ? langLabels.active : langLabels.idle}
              </span>
              {isListening && (
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  LIVE
                </span>
              )}
            </div>

            <p className="text-[11px] text-stone-600 mt-0.5">
              {isListening
                ? 'Speak word-by-word at your own comfortable pace.'
                : 'Tap the microphone whenever you are ready to read.'}
            </p>
          </div>
        </div>

        {/* Right: Last Detected Word / Acc Rate */}
        {isListening && lastRecognizedWord && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 bg-white/80 backdrop-blur-xs border border-emerald-200 px-3 py-1.5 rounded-xl shadow-2xs"
          >
            <span className="text-[10px] text-stone-500 font-bold">
              {langLabels.detected}
            </span>
            <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg">
              {lastRecognizedWord}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
