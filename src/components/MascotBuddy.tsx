import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MascotMood, Language, VoiceSettingsState } from '../types';
import { soundEffects } from '../services/soundEffects';
import { kidSpeech, SARVAM_VOICES, DEFAULT_KID_VOICE_PROFILES } from '../services/speechSynthesis';
import { VoiceProfileModal } from './VoiceProfileModal';
import { VoiceWaveformVisualizer } from './VoiceWaveformVisualizer';
import { Volume2, Sliders, Settings2, Sparkles } from 'lucide-react';

interface MascotBuddyProps {
  mood: MascotMood;
  language: Language;
  accessory?: string;
  speechText?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  interactive?: boolean;
  showVoiceSettings?: boolean;
}

export const MascotBuddy: React.FC<MascotBuddyProps> = ({
  mood,
  language,
  accessory = 'none',
  speechText,
  size = 'md',
  onClick,
  interactive = true,
  showVoiceSettings = true,
}) => {
  const [isTapped, setIsTapped] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [settings, setSettings] = useState<VoiceSettingsState>(() => kidSpeech.getSettings());

  useEffect(() => {
    const unsubscribe = kidSpeech.subscribe((newSettings) => {
      setSettings(newSettings);
    });
    return () => unsubscribe();
  }, []);

  const activeGeminiVoice = SARVAM_VOICES.find(v => v.id === settings.sarvamVoice) || SARVAM_VOICES[0];
  const activeKidVoice = DEFAULT_KID_VOICE_PROFILES.find(p => p.id === settings.kidProfileId) || DEFAULT_KID_VOICE_PROFILES[0];
  const activeAvatar = settings.engine === 'sarvam_hd' ? activeGeminiVoice.avatar : activeKidVoice.avatar;
  const activeName = settings.engine === 'sarvam_hd' ? activeGeminiVoice.name : activeKidVoice.name;

  const handleTap = () => {
    if (!interactive) return;
    setIsTapped(true);
    soundEffects.playWordPop();
    kidSpeech.playEncouragement(language, () => {
      setIsTapped(false);
    });
    onClick?.();
  };

  const handleOpenVoiceSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playWordPop();
    setIsVoiceModalOpen(true);
  };

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  // Expression styling based on mood
  const getEyes = () => {
    switch (mood) {
      case 'listening':
        return (
          <div className="flex gap-3 justify-center items-center">
            <motion.div
              animate={{ scaleY: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="w-3.5 h-4.5 bg-amber-950 rounded-full flex items-center justify-center"
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full translate-x-0.5 -translate-y-0.5" />
            </motion.div>
            <motion.div
              animate={{ scaleY: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: 0.1 }}
              className="w-3.5 h-4.5 bg-amber-950 rounded-full flex items-center justify-center"
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full translate-x-0.5 -translate-y-0.5" />
            </motion.div>
          </div>
        );
      case 'cheering':
      case 'celebrating':
      case 'clapping':
        return (
          <div className="flex gap-3 justify-center items-center">
            {/* Happy curved eyes ^^ */}
            <div className="w-4 h-2.5 border-t-3 border-amber-950 rounded-t-full" />
            <div className="w-4 h-2.5 border-t-3 border-amber-950 rounded-t-full" />
          </div>
        );
      case 'thinking':
        return (
          <div className="flex gap-3 justify-center items-center">
            <div className="w-3.5 h-3.5 bg-amber-950 rounded-full" />
            <div className="w-2.5 h-2.5 bg-amber-950 rounded-full -translate-y-1" />
          </div>
        );
      default:
        return (
          <div className="flex gap-3 justify-center items-center">
            <div className="w-3.5 h-4 bg-amber-950 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full -translate-x-0.5 -translate-y-0.5" />
            </div>
            <div className="w-3.5 h-4 bg-amber-950 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full -translate-x-0.5 -translate-y-0.5" />
            </div>
          </div>
        );
    }
  };

  const getMouth = () => {
    switch (mood) {
      case 'cheering':
      case 'celebrating':
      case 'clapping':
        return (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="w-5 h-4 bg-rose-500 rounded-b-full border border-amber-950 mx-auto mt-1 flex items-end justify-center overflow-hidden"
          >
            <div className="w-3 h-2 bg-rose-300 rounded-full mb-0.5" />
          </motion.div>
        );
      case 'listening':
        return (
          <div className="w-3 h-2 border-b-2 border-amber-950 rounded-b-full mx-auto mt-1" />
        );
      case 'thinking':
        return (
          <div className="w-2.5 h-1 bg-amber-950 rounded-full mx-auto mt-1 translate-x-1" />
        );
      default:
        return (
          <div className="w-4 h-2 border-b-2.5 border-amber-950 rounded-b-full mx-auto mt-1" />
        );
    }
  };

  return (
    <div className="relative inline-flex flex-col items-center select-none" id="mascot-container">
      {/* Speech Bubble */}
      <AnimatePresence>
        {speechText && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -top-14 z-20 bg-white border border-[#e8e4d8] text-[#2d2d2d] px-3.5 py-1.5 rounded-2xl text-xs sm:text-sm font-black shadow-md whitespace-nowrap flex items-center gap-1.5"
            id="mascot-speech-bubble"
          >
            <span>💬</span>
            <span>{speechText}</span>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-[#e8e4d8]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Character Body */}
      <motion.div
        onClick={handleTap}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={
          mood === 'listening'
            ? { y: [0, -3, 0], rotate: [-2, 2, -2] }
            : mood === 'cheering' || mood === 'celebrating'
            ? { y: [0, -10, 0], rotate: [-4, 4, -4] }
            : { y: [0, -3, 0] }
        }
        transition={{ repeat: Infinity, duration: mood === 'cheering' ? 0.6 : 2.5, ease: 'easeInOut' }}
        className={`relative ${sizeClasses[size]} cursor-pointer rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 shadow-md border-2 border-amber-600 flex flex-col items-center justify-center`}
      >
        {/* Glow halo when listening or celebrating */}
        {(mood === 'listening' || mood === 'celebrating') && (
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute -inset-2 rounded-full bg-yellow-300/40 -z-10 blur-xs pointer-events-none"
          />
        )}

        {/* Accessory: Hat / Crown / Glasses */}
        {accessory === 'scholar_cap' && (
          <div className="absolute -top-4 -left-1 text-2xl filter drop-shadow">🎓</div>
        )}
        {accessory === 'star_crown' && (
          <div className="absolute -top-5 text-2xl filter drop-shadow">👑</div>
        )}
        {accessory === 'glasses' && (
          <div className="absolute top-4 text-xl filter drop-shadow z-10">👓</div>
        )}
        {accessory === 'superhero_cape' && (
          <div className="absolute -bottom-1 -right-2 text-2xl filter drop-shadow">🦸</div>
        )}
        {accessory === 'golden_wand' && (
          <div className="absolute -right-3 top-2 text-2xl filter drop-shadow animate-pulse">✨🪄</div>
        )}

        {/* Cheeks / Blush */}
        <div className="absolute left-2.5 top-9 w-2.5 h-2 bg-rose-400/60 rounded-full blur-[0.5px]" />
        <div className="absolute right-2.5 top-9 w-2.5 h-2 bg-rose-400/60 rounded-full blur-[0.5px]" />

        {/* Ears */}
        <div className="absolute -left-2 top-3 w-4 h-4 bg-amber-400 border-2 border-amber-600 rounded-full" />
        <div className="absolute -right-2 top-3 w-4 h-4 bg-amber-400 border-2 border-amber-600 rounded-full" />

        {/* Listening Soundwaves */}
        {mood === 'listening' && (
          <>
            <motion.div
              animate={{ opacity: [0, 1, 0], scale: [0.8, 1.4, 0.8] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute -left-5 text-xs text-amber-700 font-bold"
            >
              〰️
            </motion.div>
            <motion.div
              animate={{ opacity: [0, 1, 0], scale: [0.8, 1.4, 0.8] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.3 }}
              className="absolute -right-5 text-xs text-amber-700 font-bold"
            >
              〰️
            </motion.div>
          </>
        )}

        {/* Eyes & Mouth */}
        <div className="mt-1">
          {getEyes()}
          {getMouth()}
        </div>

        {/* Clapping hands */}
        {mood === 'clapping' && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.4 }}
            className="absolute -bottom-1 text-sm"
          >
            👏
          </motion.div>
        )}
      </motion.div>

      {/* Mascot Name Badge & Voice Profile Selector */}
      <div className="mt-1 flex flex-col items-center gap-1">
        <div className="bg-[#2d2d2d] text-white text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full shadow-2xs border border-stone-700 flex items-center gap-1.5">
          <span>Shakthi Mitra (శక్తి మిత్ర)</span>
        </div>

        {/* Voice Setting Toggle Pill */}
        {showVoiceSettings && (
          <button
            type="button"
            onClick={handleOpenVoiceSettings}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fff8e6] hover:bg-[#fae2a0] text-amber-950 text-[10px] font-black border border-[#fae2a0] hover:border-amber-400 shadow-2xs transition-all cursor-pointer group"
            title="Change AI Voice or Accent"
            id="btn-mascot-voice-settings"
          >
            <span className="text-xs">{activeAvatar}</span>
            <span>Voice: {activeName}</span>
            {settings.engine === 'sarvam_hd' && (
              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
            )}
            <Sliders className="w-2.5 h-2.5 text-amber-700 group-hover:rotate-45 transition-transform" />
          </button>
        )}
      </div>

      {/* Voice Profile Modal */}
      <VoiceProfileModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        language={language}
      />
    </div>
  );
};

