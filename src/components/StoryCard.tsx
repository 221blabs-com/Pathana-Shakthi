import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Story } from '../types';
import { soundEffects } from '../services/soundEffects';
import { kidSpeech } from '../services/speechSynthesis';
import {
  BookOpen,
  Star,
  CheckCircle,
  Download,
  Sparkles,
  ArrowRight,
  WifiOff,
  Flame,
  Volume2,
  VolumeX,
  Headphones,
  Square,
  Mic,
} from 'lucide-react';

interface StoryCardProps {
  story: Story;
  onSelect: (story: Story) => void;
  onSetupAndRead?: (story: Story) => void;
  onToggleOffline?: (storyId: string) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({
  story,
  onSelect,
  onSetupAndRead,
  onToggleOffline,
}) => {
  const [isPlayingSummary, setIsPlayingSummary] = useState(false);

  // Stop playback when unmounting
  useEffect(() => {
    return () => {
      if (isPlayingSummary) {
        kidSpeech.stop();
      }
    };
  }, [isPlayingSummary]);

  const handleToggleAudioSummary = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPlayingSummary) {
      kidSpeech.stop();
      setIsPlayingSummary(false);
      return;
    }

    soundEffects.playWordPop();
    setIsPlayingSummary(true);

    // Formulate a brief, child-friendly audio summary in the story's language
    let summaryText = '';
    if (story.language === 'Telugu') {
      summaryText = `${story.title}! కథ సంక్షిప్తం: ${story.moralOrTakeaway || story.pages[0]?.text || ''}`;
    } else if (story.language === 'Hindi') {
      summaryText = `${story.title}! कहानी का सारांश: ${story.moralOrTakeaway || story.pages[0]?.text || ''}`;
    } else {
      summaryText = `${story.title}! Story Summary: ${story.moralOrTakeaway || story.pages[0]?.text || ''}`;
    }

    kidSpeech.speakText(summaryText, story.language, {
      pitch: 1.35,
      rate: 0.9,
      onEnd: () => {
        setIsPlayingSummary(false);
      },
      onError: () => {
        setIsPlayingSummary(false);
      },
    });
  };

  const handleCardClick = () => {
    if (isPlayingSummary) {
      kidSpeech.stop();
      setIsPlayingSummary(false);
    }
    soundEffects.playPageTurn();
    onSelect(story);
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-3xl p-5 shadow-xs hover:shadow-md border border-[#e8e4d8] hover:border-amber-400 transition-all flex flex-col justify-between cursor-pointer select-none group relative overflow-hidden"
      onClick={handleCardClick}
      id={`story-card-${story.id}`}
    >
      {/* Top Meta Badges */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="bg-[#fef3c7] text-[#78350f] font-black text-[11px] px-2.5 py-0.5 rounded-xl border border-[#fde68a]">
            {story.language}
          </span>
          <span className="bg-[#f4f1e8] text-stone-700 font-bold text-[11px] px-2.5 py-0.5 rounded-xl border border-[#e8e4d8]">
            {story.gradeLevel}
          </span>
        </div>

        {/* Offline Status Pill */}
        <div className="flex items-center gap-1">
          {story.isDownloadedOffline ? (
            <span
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-[#edf9f2] px-2.5 py-0.5 rounded-xl border border-[#c4ebd1]"
              title="Saved for 100% Offline Classroom Reading"
            >
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span>Offline Ready</span>
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                soundEffects.playWordPop();
                onToggleOffline?.(story.id);
              }}
              title="Download to read offline without internet"
              className="text-stone-400 hover:text-amber-700 p-1.5 rounded-xl hover:bg-[#f4f1e8] border border-transparent hover:border-[#e8e4d8] transition-all"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Story Cover Banner Bento Tile */}
      <div className={`w-full h-32 rounded-2xl bg-gradient-to-br ${story.coverColor || 'from-amber-400 to-orange-500'} flex items-center justify-center p-3 relative shadow-inner overflow-hidden my-1`}>
        <motion.div
          whileHover={{ scale: 1.15, rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.3 }}
          className="text-5xl filter drop-shadow-sm"
        >
          {story.coverEmoji}
        </motion.div>

        {/* Custom Generated Badge */}
        {story.isCustomGenerated && (
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 border border-white/20">
            <Sparkles className="w-2.5 h-2.5 text-yellow-300" />
            <span>Teacher OCR Story</span>
          </div>
        )}
      </div>

      {/* Story Title & English Subtitle */}
      <div className="mt-3 flex-1">
        <h3 className="text-lg sm:text-xl font-black text-[#2d2d2d] leading-snug group-hover:text-amber-800 transition-colors">
          {story.title}
        </h3>
        <p className="text-xs text-stone-500 font-medium mt-0.5 truncate">
          {story.titleEnglish}
        </p>
      </div>

      {/* Moral / Summary Line */}
      <p className="text-[11px] text-stone-600 line-clamp-2 my-2 italic leading-relaxed">
        "{story.moralOrTakeaway}"
      </p>

      {/* Listen to Story Button (Audio Summary Preview) */}
      <div className="my-2">
        <button
          type="button"
          onClick={handleToggleAudioSummary}
          className={`w-full py-2 px-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all shadow-2xs ${
            isPlayingSummary
              ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300/60 animate-pulse'
              : 'bg-[#fff8e6] hover:bg-[#fae2a0] text-amber-950 border-[#fae2a0] hover:border-amber-400'
          }`}
          title={isPlayingSummary ? 'Stop listening to story summary' : 'Listen to a brief audio summary of the story'}
          id={`btn-listen-story-${story.id}`}
        >
          {isPlayingSummary ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Audio Summary</span>
              <div className="flex items-center gap-0.5 ml-1">
                <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-amber-700" />
              <span>Listen to Story (వినండి)</span>
            </>
          )}
        </button>
      </div>

      {/* Footer Info & Read CTA */}
      <div className="pt-2.5 border-t border-[#f0ece1] flex items-center justify-between mt-1 gap-2">
        <div className="flex items-center gap-1.5 text-amber-800 font-black text-xs">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
          <span>+{story.pages.length * 4} Stars</span>
        </div>

        <div className="flex items-center gap-1.5">
          {onSetupAndRead && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isPlayingSummary) {
                  kidSpeech.stop();
                  setIsPlayingSummary(false);
                }
                onSetupAndRead(story);
              }}
              title="Calibrate Mic & Choose Voice before reading"
              className="p-1.5 rounded-xl bg-[#f4f1e8] hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-[#e5e1d5] hover:border-amber-300 transition-all cursor-pointer"
              id={`btn-card-setup-mic-${story.id}`}
            >
              <Mic className="w-3.5 h-3.5 text-amber-800" />
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs font-black text-[#2d2d2d] bg-[#f4f1e8] group-hover:bg-amber-400 group-hover:text-amber-950 px-3.5 py-1.5 rounded-xl border border-[#e5e1d5] group-hover:border-amber-500/50 transition-all shadow-2xs">
            <span>Read Along</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
