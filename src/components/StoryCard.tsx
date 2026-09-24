import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Story } from '../types';
import { soundEffects } from '../services/soundEffects';
import { kidSpeech } from '../services/speechSynthesis';

import SpotlightCard from './SpotlightCard';
import TiltedCard from './TiltedCard';

import {
  Star,
  CheckCircle,
  Download,
  Sparkles,
  ArrowRight,
  Volume2,
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

  useEffect(() => {
    return () => {
      if (isPlayingSummary) {
        kidSpeech.stop();
      }
    };
  }, [isPlayingSummary]);

  const handleToggleAudioSummary = (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();

    if (isPlayingSummary) {
      kidSpeech.stop();
      setIsPlayingSummary(false);
      return;
    }

    soundEffects.playWordPop();
    setIsPlayingSummary(true);

    let summaryText = '';

    if (story.language === 'Telugu') {
      summaryText = `${story.title}! కథ సంక్షిప్తం: ${
        story.moralOrTakeaway ||
        story.pages[0]?.text ||
        ''
      }`;
    } else if (story.language === 'Hindi') {
      summaryText = `${story.title}! कहानी का सारांश: ${
        story.moralOrTakeaway ||
        story.pages[0]?.text ||
        ''
      }`;
    } else {
      summaryText = `${story.title}! Story Summary: ${
        story.moralOrTakeaway ||
        story.pages[0]?.text ||
        ''
      }`;
    }

    // Same class of bug as ReadAlongReader's old startListenMode: this was
    // hardcoding pitch/rate instead of using the Voice Studio setting, so
    // the story-card preview narration never reflected the speed you picked.
    const studioSettings = kidSpeech.getSettings();
    kidSpeech.speakText(summaryText, story.language, {
      pitch: studioSettings.pitch,
      rate: studioSettings.rate,
      onEnd: () => setIsPlayingSummary(false),
      onError: () => setIsPlayingSummary(false),
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

  const handleOfflineToggle = (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();

    soundEffects.playWordPop();
    onToggleOffline?.(story.id);
  };

  const handleMicSetup = (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();

    if (isPlayingSummary) {
      kidSpeech.stop();
      setIsPlayingSummary(false);
    }

    onSetupAndRead?.(story);
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 14,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.4,
        ease: 'easeOut',
      }}
      className="w-full min-w-0"
      id={`story-card-${story.id}`}
    >
      <TiltedCard
        rotateAmplitude={5}
        scaleOnHover={1.025}
      >
        <SpotlightCard
          spotlightColor="rgba(251, 191, 36, 0.20)"
          className="
            p-0
            w-full
            bg-white
            border-[#ded9ca]
            hover:border-amber-400
            rounded-[28px]
            overflow-hidden
            shadow-[0_8px_24px_rgba(0,0,0,0.08)]
            hover:shadow-[0_18px_40px_rgba(0,0,0,0.14)]
            transition-shadow
            duration-300
            cursor-pointer
          "
        >
          <div
            className="relative z-10 p-5"
            onClick={handleCardClick}
          >
            {/* =================================================
                TOP META
            ================================================= */}

            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="
                    bg-amber-100
                    text-amber-900
                    font-black
                    text-[10px]
                    px-2.5
                    py-1
                    rounded-full
                    border
                    border-amber-200
                    whitespace-nowrap
                  "
                >
                  {story.language}
                </span>

                <span
                  className="
                    bg-stone-100
                    text-stone-700
                    font-bold
                    text-[10px]
                    px-2.5
                    py-1
                    rounded-full
                    border
                    border-stone-200
                    whitespace-nowrap
                  "
                >
                  Class {story.gradeLevel}
                </span>
              </div>

              {story.isDownloadedOffline ? (
                <span
                  className="
                    flex
                    items-center
                    gap-1
                    text-[9px]
                    font-extrabold
                    text-emerald-800
                    bg-emerald-50
                    px-2
                    py-1
                    rounded-full
                    border
                    border-emerald-200
                    whitespace-nowrap
                  "
                >
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Offline Ready
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleOfflineToggle}
                  title="Download for offline reading"
                  className="
                    text-stone-400
                    hover:text-amber-700
                    p-1.5
                    rounded-full
                    hover:bg-amber-50
                    border
                    border-transparent
                    hover:border-amber-200
                    transition-all
                    cursor-pointer
                    shrink-0
                  "
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* =================================================
                COVER
            ================================================= */}

            <div
              className={`
                relative
                w-full
                h-32
                sm:h-36
                rounded-[22px]
                bg-gradient-to-br
                ${story.coverColor || 'from-amber-400 to-orange-500'}
                flex
                items-center
                justify-center
                overflow-hidden
                shadow-inner
              `}
            >
              <div
                className="
                  absolute
                  w-32
                  h-32
                  rounded-full
                  bg-white/20
                  blur-3xl
                  -top-10
                  -right-10
                  pointer-events-none
                "
              />

              <div
                className="
                  absolute
                  w-24
                  h-24
                  rounded-full
                  bg-white/10
                  blur-2xl
                  -bottom-8
                  -left-8
                  pointer-events-none
                "
              />

              <Sparkles
                className="
                  absolute
                  top-3
                  left-3
                  w-4
                  h-4
                  text-white/70
                "
              />

              <motion.div
                whileHover={{
                  scale: 1.12,
                  rotate: [0, -5, 5, 0],
                }}
                transition={{
                  duration: 0.35,
                }}
                className="
                  relative
                  z-10
                  text-6xl
                  select-none
                  drop-shadow-lg
                "
              >
                {story.coverEmoji}
              </motion.div>

              {story.isCustomGenerated && (
                <div
                  className="
                    absolute
                    bottom-2
                    left-2
                    bg-black/70
                    backdrop-blur-sm
                    text-white
                    text-[8px]
                    font-black
                    px-2
                    py-1
                    rounded-lg
                    flex
                    items-center
                    gap-1
                    border
                    border-white/20
                  "
                >
                  <Sparkles className="w-2.5 h-2.5 text-yellow-300" />
                  Teacher OCR
                </div>
              )}
            </div>

            {/* =================================================
                TITLE
            ================================================= */}

            <div className="mt-3.5">
              <h3
                className="
                  text-lg
                  sm:text-xl
                  font-black
                  text-stone-900
                  leading-tight
                  group-hover:text-amber-700
                  transition-colors
                  line-clamp-2
                  min-h-[42px]
                "
              >
                {story.title}
              </h3>

              <p
                className="
                  text-[10px]
                  sm:text-[11px]
                  text-stone-500
                  font-medium
                  mt-1
                  truncate
                "
              >
                {story.titleEnglish}
              </p>
            </div>

            {/* =================================================
                MORAL
            ================================================= */}

            <p
              className="
                text-[10px]
                sm:text-[11px]
                text-stone-600
                line-clamp-2
                mt-2
                mb-3
                italic
                leading-relaxed
                min-h-[32px]
              "
            >
              "{story.moralOrTakeaway}"
            </p>

            {/* =================================================
                AUDIO
            ================================================= */}

            <button
              type="button"
              onClick={handleToggleAudioSummary}
              className={`
                w-full
                py-2.5
                px-3
                rounded-2xl
                border
                text-[10px]
                sm:text-[11px]
                font-black
                flex
                items-center
                justify-center
                gap-2
                transition-all
                shadow-sm
                cursor-pointer
                ${
                  isPlayingSummary
                    ? `
                      bg-amber-500
                      text-white
                      border-amber-600
                      ring-2
                      ring-amber-300/60
                    `
                    : `
                      bg-amber-50
                      hover:bg-amber-100
                      text-amber-950
                      border-amber-200
                      hover:border-amber-400
                    `
                }
              `}
              id={`btn-listen-story-${story.id}`}
            >
              {isPlayingSummary ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />

                  <span>Stop Audio</span>

                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-2.5 bg-white rounded-full animate-bounce" />

                    <span
                      className="w-1 h-4 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />

                    <span
                      className="w-1 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-amber-700" />

                  <span>
                    Listen to Story (వినండి)
                  </span>
                </>
              )}
            </button>

            {/* =================================================
                FOOTER
            ================================================= */}

            <div
              className="
                mt-3
                pt-3
                border-t
                border-stone-100
                flex
                items-center
                justify-between
                gap-2
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-1
                  text-amber-800
                  font-black
                  text-[10px]
                  shrink-0
                "
              >
                <Star
                  className="
                    w-3.5
                    h-3.5
                    fill-amber-400
                    text-amber-500
                  "
                />

                <span>
                  +{story.pages.length * 4} Stars
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {onSetupAndRead && (
                  <button
                    type="button"
                    onClick={handleMicSetup}
                    title="Calibrate Mic & Choose Voice"
                    className="
                      p-2
                      rounded-xl
                      bg-stone-100
                      hover:bg-amber-100
                      text-stone-700
                      hover:text-amber-900
                      border
                      border-stone-200
                      hover:border-amber-300
                      transition-all
                      cursor-pointer
                    "
                    id={`btn-card-setup-mic-${story.id}`}
                  >
                    <Mic className="w-3.5 h-3.5 text-amber-800" />
                  </button>
                )}

                <div
                  className="
                    flex
                    items-center
                    gap-1
                    text-[10px]
                    font-black
                    text-stone-900
                    bg-stone-100
                    hover:bg-amber-400
                    hover:text-amber-950
                    px-3
                    py-2
                    rounded-xl
                    border
                    border-stone-200
                    hover:border-amber-500/50
                    transition-all
                    whitespace-nowrap
                  "
                >
                  <span>Read Along</span>

                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </TiltedCard>
    </motion.div>
  );
};

export default StoryCard