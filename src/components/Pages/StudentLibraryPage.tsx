import React, { useEffect, useState } from 'react';

import {
  Story,
  Student,
  Language,
} from '../../types';

import { StoryCard } from '../StoryCard';
import { ReadingGrowthSprout } from '../ReadingGrowthSprout';
import { MultilingualSearchBar } from '../MultilingualSearchBar';

import ShapeGrid from '../home/ShapeGrid';
import SpotlightCard from '../SpotlightCard';
import TiltedCard from '../TiltedCard';

import {
  searchStoriesMultilingual,
} from '../../utils/multilingualSearch';

import {
  offlineStorage,
} from '../../services/offlineStorage';

import {
  soundEffects,
} from '../../services/soundEffects';

import {
  kidSpeech,
} from '../../services/speechSynthesis';

import {
  BookOpen,
  Award,
  Sparkles,
  Download,
  Mic,
  Flame,
  Trophy,
  ChevronRight,
  School,
  CircleCheck,
  Target,
  Headphones,
  Volume2,
} from 'lucide-react';

import { motion } from 'motion/react';


/* ============================================================
   PROPS
============================================================ */

interface StudentLibraryPageProps {
  stories: Story[];
  student: Student;

  onSelectStory: (story: Story) => void;

  onOpenVoiceSetup?: (story?: Story) => void;

  onToggleOffline: (storyId: string) => void;

  onOpenRewardChest: () => void;

  onOpenCertificateModal: () => void;

  onOpenOfflineModal: () => void;

  onOpenProfile: () => void;

  onRefreshStudent?: () => void;
}


/* ============================================================
   SHAKTHI MITRA SPEECH
============================================================ */

const shakthiPhrases: Record<string, string> = {
  Telugu:
    'నమస్కారం! నేను శక్తి మిత్రను. నాతో కలిసి రోజూ తెలుగు కథలు చదువుకుందాం!',

  Hindi:
    'नमस्ते! मैं शक्ति मित्र हूँ। आओ मिलकर हर दिन प्यारी-प्यारी कहानियाँ पढ़ें!',

  English:
    'Hello friends! I am Shakthi Mitra. Let us explore exciting stories and master reading fluency!',
};


/* ============================================================
   COUNT UP
============================================================ */

interface CountUpProps {
  value: number;
  duration?: number;
}

const CountUp: React.FC<CountUpProps> = ({
  value,
  duration = 900,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frameId = 0;

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;

      const progress = Math.min(
        elapsed / duration,
        1
      );

      const eased =
        1 - Math.pow(1 - progress, 3);

      setDisplayValue(
        Math.round(value * eased)
      );

      if (progress < 1) {
        frameId = requestAnimationFrame(
          animate
        );
      }
    };

    frameId = requestAnimationFrame(
      animate
    );

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [value, duration]);

  return <>{displayValue}</>;
};


/* ============================================================
   HEADER STAT
============================================================ */

interface HeaderStatProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent: string;
}

const HeaderStat: React.FC<HeaderStatProps> = ({
  icon,
  value,
  label,
  accent,
}) => {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.45,
        ease: 'easeOut',
      }}
      className="
        min-w-[108px]
        sm:min-w-[118px]
        px-3
        sm:px-4
        py-2.5
        rounded-2xl
        bg-white/[0.07]
        border
        border-white/[0.10]
        backdrop-blur-sm
        flex
        items-center
        gap-2.5
        hover:bg-white/[0.10]
        transition-colors
      "
    >
      <div
        className={`
          w-8
          h-8
          rounded-xl
          flex
          items-center
          justify-center
          shrink-0
          ${accent}
        `}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <div
          className="
            text-base
            sm:text-lg
            leading-none
            font-black
            text-white
          "
        >
          <CountUp value={value} />
        </div>

        <div
          className="
            mt-1
            text-[9px]
            sm:text-[10px]
            uppercase
            tracking-wide
            font-bold
            text-stone-400
            whitespace-nowrap
          "
        >
          {label}
        </div>
      </div>
    </motion.div>
  );
};


/* ============================================================
   MAIN PAGE
============================================================ */

export const StudentLibraryPage: React.FC<
  StudentLibraryPageProps
> = ({
  stories,
  student,
  onSelectStory,
  onOpenVoiceSetup,
  onToggleOffline,
  onOpenRewardChest,
  onOpenCertificateModal,
  onOpenOfflineModal,
  onOpenProfile,
  onRefreshStudent,
}) => {

  const [
    selectedLanguage,
    setSelectedLanguage,
  ] = useState<string>('All');

  const [
    selectedGrade,
    setSelectedGrade,
  ] = useState<string>('All');

  const [
    searchQuery,
    setSearchQuery,
  ] = useState<string>('');

  const [
    isMascotSpeaking,
    setIsMascotSpeaking,
  ] = useState(false);


  /* ==========================================================
     FILTER STORIES
  ========================================================== */

  const filteredStories =
    searchStoriesMultilingual(
      stories,
      searchQuery,
      selectedLanguage,
      selectedGrade
    );


  /* ==========================================================
     STUDENT STATS
  ========================================================== */

  const studentRecord =
    student as Student & {
      streak?: number;
      currentStreak?: number;
      readingStreak?: number;
    };

  const streak =
    studentRecord.streak ??
    studentRecord.currentStreak ??
    studentRecord.readingStreak ??
    0;

  const completedStories =
    student.completedStoryIds?.length ?? 0;

  const stars =
    student.stars ?? 0;


  /* ==========================================================
     SHAKTHI MITRA CLICK / TEXT TO SPEECH
  ========================================================== */

  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };

    loadVoices();

    window.speechSynthesis.addEventListener(
      'voiceschanged',
      loadVoices
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        'voiceschanged',
        loadVoices
      );
    };
  }, []);


  const handleShakthiClick = () => {
    if (isMascotSpeaking) {
      return;
    }

    soundEffects.playWordPop();

    const language =
      selectedLanguage === 'All'
        ? 'English'
        : selectedLanguage;

    const phrase =
      shakthiPhrases[language] ??
      shakthiPhrases.English;

    setIsMascotSpeaking(true);

    try {
      // Stop any speech that may still be playing.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(phrase);

      // Request the appropriate language for the selected filter.
      if (language === 'Telugu') {
        utterance.lang = 'te-IN';
      } else if (language === 'Hindi') {
        utterance.lang = 'hi-IN';
      } else {
        utterance.lang = 'en-IN';
      }

      // Child-friendly speaking settings.
      utterance.rate = 0.85;
      utterance.pitch = 1.15;
      utterance.volume = 1;

      // Prefer a voice matching the requested language.
      const voices = window.speechSynthesis.getVoices();
      const languageCode = utterance.lang
        .split('-')[0]
        .toLowerCase();

      const matchingVoice = voices.find((voice) =>
        voice.lang
          .toLowerCase()
          .startsWith(languageCode)
      );

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => {
        setIsMascotSpeaking(true);
      };

      utterance.onend = () => {
        setIsMascotSpeaking(false);
      };

      utterance.onerror = (event) => {
        console.error(
          'Shakthi Mitra speech error:',
          event.error
        );
        setIsMascotSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error(
        'Shakthi Mitra speech error:',
        error
      );
      setIsMascotSpeaking(false);
    }
  };


  return (
    <div
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-stone-50
        text-stone-900
        pb-16
        font-sans
      "
    >

      {/* =====================================================
          SHAPE GRID BACKGROUND
      ===================================================== */}

      <div
        className="
          fixed
          inset-0
          z-0
          pointer-events-none
          overflow-hidden
        "
        aria-hidden="true"
      >
        <ShapeGrid
          direction="diagonal"
          speed={0.18}
          borderColor="rgba(124, 58, 237, 0.14)"
          squareSize={52}
          hoverFillColor="rgba(236, 72, 153, 0.18)"
          shape="square"
          hoverTrailAmount={0}
        />
      </div>


      <div className="relative z-10">


        {/* ===================================================
            STUDENT HEADER
        =================================================== */}

        <motion.header
          initial={{
            opacity: 0,
            y: -18,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.55,
            ease: 'easeOut',
          }}
          className="
            relative
            overflow-hidden
            bg-[#292929]
            text-white
            border-b
            border-white/[0.06]
            shadow-xl
          "
        >

          <div
            className="
              absolute
              -top-24
              left-1/3
              w-80
              h-80
              rounded-full
              bg-amber-400/[0.07]
              blur-3xl
              pointer-events-none
            "
          />

          <div
            className="
              absolute
              -bottom-28
              right-1/4
              w-72
              h-72
              rounded-full
              bg-violet-500/[0.06]
              blur-3xl
              pointer-events-none
            "
          />


          <div
            className="
              relative
              w-full
              max-w-[1600px]
              mx-auto
              px-4
              sm:px-6
              lg:px-8
              py-4
              sm:py-5
            "
          >

            <div
              className="
                flex
                flex-col
                xl:flex-row
                xl:items-center
                gap-5
              "
            >

              {/* =================================================
                  STUDENT IDENTITY
              ================================================= */}

              <motion.div
                initial={{
                  opacity: 0,
                  x: -22,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                transition={{
                  duration: 0.55,
                  delay: 0.08,
                }}
                className="
                  flex
                  items-center
                  gap-4
                  min-w-0
                  flex-1
                "
              >

                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="
                    group
                    relative
                    w-[68px]
                    h-[68px]
                    sm:w-[76px]
                    sm:h-[76px]
                    shrink-0
                    rounded-[24px]
                    bg-gradient-to-br
                    from-amber-300
                    via-amber-400
                    to-orange-500
                    border-2
                    border-amber-200
                    flex
                    items-center
                    justify-center
                    text-[32px]
                    sm:text-[37px]
                    shadow-[0_10px_35px_rgba(245,158,11,0.22)]
                    hover:scale-[1.045]
                    transition-all
                    duration-300
                    cursor-pointer
                  "
                >

                  {student.avatar}

                  <span
                    className="
                      absolute
                      -right-1
                      -bottom-1
                      w-6
                      h-6
                      rounded-full
                      bg-[#292929]
                      flex
                      items-center
                      justify-center
                    "
                  >
                    <span
                      className="
                        w-3.5
                        h-3.5
                        rounded-full
                        bg-emerald-400
                        border-2
                        border-emerald-200
                      "
                    />
                  </span>

                </button>


                <div className="min-w-0 flex-1">

                  <div
                    className="
                      flex
                      flex-wrap
                      items-center
                      gap-2
                      mb-1.5
                    "
                  >

                    <span
                      className="
                        inline-flex
                        items-center
                        gap-1
                        bg-amber-400
                        text-amber-950
                        text-[9px]
                        sm:text-[10px]
                        font-black
                        uppercase
                        tracking-wide
                        px-2.5
                        py-1
                        rounded-full
                      "
                    >
                      <Trophy className="w-3 h-3" />

                      {student.grade} Reader
                    </span>


                    <span
                      className="
                        text-[9px]
                        sm:text-[10px]
                        text-stone-500
                        font-bold
                        tracking-wide
                      "
                    >
                      {student.rollNumber}
                    </span>


                    <span
                      className="
                        hidden
                        sm:inline-flex
                        items-center
                        gap-1
                        text-[9px]
                        uppercase
                        tracking-wider
                        text-emerald-400
                        font-black
                      "
                    >
                      <CircleCheck className="w-3 h-3" />

                      Active Reader
                    </span>

                  </div>


                  <h1
                    className="
                      text-[22px]
                      sm:text-[27px]
                      lg:text-[29px]
                      leading-[1.05]
                      font-black
                      tracking-tight
                      text-white
                    "
                  >
                    నమస్కారం,{' '}

                    <span
                      className="
                        text-amber-300
                      "
                    >
                      {student.name}!
                    </span>
                  </h1>


                  <div
                    className="
                      mt-2
                      flex
                      items-center
                      gap-1.5
                      text-[10px]
                      sm:text-[11px]
                      text-stone-400
                      font-medium
                      min-w-0
                    "
                  >

                    <School
                      className="
                        w-3.5
                        h-3.5
                        shrink-0
                        text-stone-500
                      "
                    />

                    <span
                      className="
                        truncate
                        max-w-[280px]
                        sm:max-w-[420px]
                      "
                    >
                      {student.villageSchool}
                    </span>

                    <span className="text-stone-600">
                      •
                    </span>

                    <span
                      className="
                        whitespace-nowrap
                        text-stone-500
                      "
                    >
                      Student Dashboard
                    </span>

                  </div>

                </div>

              </motion.div>


              {/* =================================================
                  PROGRESS
              ================================================= */}

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                  xl:justify-center
                "
              >

                <HeaderStat
                  icon={
                    <Sparkles
                      className="
                        w-4
                        h-4
                        text-amber-300
                      "
                    />
                  }
                  value={stars}
                  label="Stars"
                  accent="bg-amber-400/15"
                />

                <HeaderStat
                  icon={
                    <BookOpen
                      className="
                        w-4
                        h-4
                        text-sky-300
                      "
                    />
                  }
                  value={completedStories}
                  label="Stories"
                  accent="bg-sky-400/15"
                />

                <HeaderStat
                  icon={
                    <Flame
                      className="
                        w-4
                        h-4
                        text-orange-300
                      "
                    />
                  }
                  value={streak}
                  label="Day Streak"
                  accent="bg-orange-400/15"
                />

              </div>


              {/* =================================================
                  ACTIONS
              ================================================= */}

              <motion.div
                initial={{
                  opacity: 0,
                  x: 20,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                transition={{
                  duration: 0.55,
                  delay: 0.15,
                }}
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                  xl:justify-end
                "
              >

                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playPageTurn();
                    onOpenProfile();
                  }}
                  className="
                    group
                    flex
                    items-center
                    gap-1.5
                    px-3
                    sm:px-3.5
                    py-2.5
                    rounded-2xl
                    bg-white/[0.06]
                    hover:bg-white/[0.11]
                    border
                    border-white/[0.10]
                    text-stone-200
                    font-black
                    text-[10px]
                    sm:text-xs
                    transition-all
                    cursor-pointer
                  "
                >

                  <Target
                    className="
                      w-3.5
                      h-3.5
                      text-amber-300
                    "
                  />

                  Word Struggles

                </button>


                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playPageTurn();
                    onOpenVoiceSetup?.();
                  }}
                  className="
                    flex
                    items-center
                    gap-1.5
                    px-3
                    sm:px-3.5
                    py-2.5
                    rounded-2xl
                    bg-amber-400
                    hover:bg-amber-300
                    text-amber-950
                    font-black
                    text-[10px]
                    sm:text-xs
                    shadow-[0_5px_20px_rgba(245,158,11,0.15)]
                    transition-all
                    cursor-pointer
                  "
                >

                  <Mic className="w-3.5 h-3.5" />

                  Voice & Mic

                </button>


                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playStarChime();
                    onOpenRewardChest();
                  }}
                  className="
                    group
                    flex
                    items-center
                    gap-1.5
                    px-3.5
                    sm:px-4
                    py-2.5
                    rounded-2xl
                    bg-gradient-to-r
                    from-amber-500
                    to-orange-400
                    hover:from-amber-400
                    hover:to-orange-300
                    text-amber-950
                    font-black
                    text-[10px]
                    sm:text-xs
                    shadow-[0_6px_24px_rgba(245,158,11,0.20)]
                    hover:-translate-y-0.5
                    transition-all
                    cursor-pointer
                  "
                >

                  <Sparkles className="w-3.5 h-3.5" />

                  Reward Chest

                  <span>
                    ({stars} ⭐)
                  </span>

                </button>


                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playStarChime();
                    onOpenCertificateModal();
                  }}
                  className="
                    flex
                    items-center
                    gap-1.5
                    px-3
                    sm:px-3.5
                    py-2.5
                    rounded-2xl
                    bg-transparent
                    hover:bg-white/[0.07]
                    border
                    border-white/[0.10]
                    text-stone-300
                    font-bold
                    text-[10px]
                    sm:text-xs
                    transition-all
                    cursor-pointer
                  "
                >

                  <Award
                    className="
                      w-3.5
                      h-3.5
                      text-amber-300
                    "
                  />

                  Certificates

                  <ChevronRight
                    className="
                      w-3
                      h-3
                      opacity-50
                    "
                  />

                </button>

              </motion.div>

            </div>

          </div>

        </motion.header>


        {/* =====================================================
            SHAKTHI MITRA CONTAINER
        ===================================================== */}

        <motion.section
          initial={{
            opacity: 0,
            y: 25,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.65,
            delay: 0.2,
            ease: 'easeOut',
          }}
          className="
            relative
            w-full
            max-w-[1600px]
            mx-auto
            px-4
            sm:px-6
            lg:px-8
            pt-5
          "
        >

          {/* ===================================================
              SPOTLIGHT CARD

              IMPORTANT:
              spotlightColor MUST remain a single-line
              rgba template-compatible string.
          =================================================== */}

          <SpotlightCard
            spotlightColor="rgba(251, 191, 36, 0.24)"
            className="
              w-full
              rounded-[30px]
              overflow-hidden
              border
              border-amber-300/50
              bg-white/[0.48]
              backdrop-blur-xl
              shadow-[0_18px_55px_rgba(80,60,30,0.10)]
            "
          >

            <div
              className="
                relative
                overflow-hidden
              "
            >

              <div
                className="
                  absolute
                  -bottom-28
                  right-0
                  w-80
                  h-80
                  rounded-full
                  bg-orange-300/15
                  blur-3xl
                  pointer-events-none
                "
              />


              {/* CONTENT */}

              <div
                className="
                  relative
                  grid
                  grid-cols-1
                  lg:grid-cols-[250px_1fr_auto]
                  items-center
                  gap-5
                  lg:gap-8
                  px-5
                  sm:px-7
                  lg:px-9
                  py-6
                "
              >


                {/* =================================================
                    TIGER / TILTED CARD
                ================================================= */}

                <div
                  className="
                    relative
                    flex
                    items-center
                    justify-center
                    lg:justify-start
                    min-h-[165px]
                  "
                >

                  <TiltedCard
                    rotateAmplitude={8}
                    scaleOnHover={1.045}
                    className="
                      w-[190px]
                      sm:w-[205px]
                    "
                  >

                    <div
                      className="
                        relative
                        w-full
                        h-[160px]
                        sm:h-[170px]
                        flex
                        items-center
                        justify-center
                      "
                    >

                      {/* =================================================
                          CLICKABLE MASCOT
                      ================================================= */}

                      <motion.button
                        type="button"
                        onClick={
                          handleShakthiClick
                        }
                        whileHover={{
                          scale: 1.07,
                          rotate: -2,
                        }}
                        whileTap={{
                          scale: 0.91,
                          rotate: 3,
                        }}
                        animate={
                          isMascotSpeaking
                            ? {
                                scale: [
                                  1,
                                  1.08,
                                  0.97,
                                  1.04,
                                  1,
                                ],
                                rotate: [
                                  0,
                                  -4,
                                  4,
                                  -2,
                                  0,
                                ],
                              }
                            : {
                                y: [
                                  0,
                                  -4,
                                  0,
                                ],
                              }
                        }
                        transition={{
                          duration:
                            isMascotSpeaking
                              ? 0.8
                              : 3.2,
                          repeat:
                            isMascotSpeaking
                              ? 0
                              : Infinity,
                          ease: 'easeInOut',
                        }}
                        className="
                          relative
                          z-10
                          w-[150px]
                          h-[140px]
                          sm:w-[165px]
                          sm:h-[150px]
                          flex
                          items-center
                          justify-center
                          cursor-pointer
                          rounded-[32px]
                          bg-transparent
                          border-4
                          border-white
                          shadow-[0_14px_35px_rgba(100,55,20,0.16)]
                          overflow-visible
                          outline-none
                          focus-visible:ring-4
                          focus-visible:ring-amber-300/60
                        "
                        aria-label="Talk to Shakthi Mitra"
                      >

                        <img
                          src="/shakthi-face.png"
                          alt="Shakthi Mitra"
                          className="
                            w-full
                            h-full
                            object-contain
                            select-none
                            pointer-events-none
                            drop-shadow-[0_16px_22px_rgba(100,55,20,0.25)]
                          "
                          draggable={false}
                        />


                        {/* SPEAKING RING */}

                        {isMascotSpeaking && (
                          <motion.div
                            initial={{
                              opacity: 0,
                              scale: 0.8,
                            }}
                            animate={{
                              opacity: [
                                0.2,
                                0.7,
                                0.2,
                              ],
                              scale: [
                                0.9,
                                1.15,
                                0.9,
                              ],
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                            }}
                            className="
                              absolute
                              inset-1
                              rounded-full
                              border-4
                              border-amber-400/60
                              pointer-events-none
                            "
                          />
                        )}


                        {/* SPEAKER ICON */}

                        {isMascotSpeaking && (
                          <motion.div
                            animate={{
                              scale: [
                                1,
                                1.18,
                                1,
                              ],
                            }}
                            transition={{
                              duration: 0.7,
                              repeat: Infinity,
                            }}
                            className="
                              absolute
                              -top-2
                              -right-1
                              w-8
                              h-8
                              rounded-full
                              bg-white
                              border
                              border-amber-200
                              shadow-lg
                              flex
                              items-center
                              justify-center
                            "
                          >
                            <Volume2
                              className="
                                w-4
                                h-4
                                text-amber-600
                              "
                            />
                          </motion.div>
                        )}

                      </motion.button>


                      {/* SPARK */}

                      <motion.span
                        animate={{
                          scale: [
                            0.8,
                            1.15,
                            0.8,
                          ],
                          rotate: [
                            0,
                            12,
                            0,
                          ],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                        }}
                        className="
                          absolute
                          z-20
                          -top-2
                          right-1
                          text-xl
                          pointer-events-none
                        "
                      >
                        ✨
                      </motion.span>


                      {/* TAP LABEL */}

                      <motion.div
                        animate={{
                          y: [
                            0,
                            -2,
                            0,
                          ],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                        }}
                        className="
                          absolute
                          z-20
                          bottom-0
                          left-1/2
                          -translate-x-1/2
                          whitespace-nowrap
                          px-3
                          py-1
                          rounded-full
                          bg-stone-900
                          text-white
                          text-[9px]
                          sm:text-[10px]
                          font-black
                          shadow-lg
                          pointer-events-none
                        "
                      >
                        {isMascotSpeaking
                          ? 'Shakthi is speaking...'
                          : 'Tap Shakthi Mitra ✨'}
                      </motion.div>

                    </div>

                  </TiltedCard>

                </div>


                {/* =================================================
                    TEXT
                ================================================= */}

                <div
                  className="
                    min-w-0
                    text-center
                    lg:text-left
                  "
                >

                  <div
                    className="
                      inline-flex
                      items-center
                      gap-1.5
                      px-2.5
                      py-1
                      rounded-full
                      bg-amber-100/80
                      border
                      border-amber-200
                      text-amber-800
                      text-[9px]
                      sm:text-[10px]
                      font-black
                      uppercase
                      tracking-wider
                      mb-2
                      backdrop-blur-sm
                    "
                  >
                    <Sparkles className="w-3 h-3" />

                    Shakthi Mitra is ready
                  </div>


                  <h2
                    className="
                      text-xl
                      sm:text-2xl
                      lg:text-[27px]
                      leading-tight
                      font-black
                      text-stone-900
                    "
                  >
                    Ready for today's{' '}

                    <span
                      className="
                        text-amber-600
                      "
                    >
                      Read Along Adventure?
                    </span>
                  </h2>


                  <p
                    className="
                      mt-2
                      text-xs
                      sm:text-sm
                      leading-relaxed
                      text-stone-600
                      max-w-2xl
                      mx-auto
                      lg:mx-0
                    "
                  >
                    Tap Shakthi Mitra and hear
                    your reading buddy speak.
                    Listen to stories, practise
                    pronunciation, and explore
                    Telugu, Hindi, and English
                    together.
                  </p>


                  {/* FEATURE CHIPS */}

                  <div
                    className="
                      mt-4
                      flex
                      flex-wrap
                      justify-center
                      lg:justify-start
                      gap-2
                    "
                  >

                    <div
                      className="
                        inline-flex
                        items-center
                        gap-1.5
                        px-2.5
                        py-1.5
                        rounded-xl
                        bg-white/60
                        border
                        border-white/80
                        text-stone-700
                        text-[10px]
                        font-bold
                        backdrop-blur-sm
                      "
                    >
                      <Headphones
                        className="
                          w-3.5
                          h-3.5
                          text-violet-500
                        "
                      />

                      Listen & Follow
                    </div>


                    <div
                      className="
                        inline-flex
                        items-center
                        gap-1.5
                        px-2.5
                        py-1.5
                        rounded-xl
                        bg-white/60
                        border
                        border-white/80
                        text-stone-700
                        text-[10px]
                        font-bold
                        backdrop-blur-sm
                      "
                    >
                      <Volume2
                        className="
                          w-3.5
                          h-3.5
                          text-emerald-500
                        "
                      />

                      Voice Practice
                    </div>


                    <div
                      className="
                        inline-flex
                        items-center
                        gap-1.5
                        px-2.5
                        py-1.5
                        rounded-xl
                        bg-white/60
                        border
                        border-white/80
                        text-stone-700
                        text-[10px]
                        font-bold
                        backdrop-blur-sm
                      "
                    >
                      <BookOpen
                        className="
                          w-3.5
                          h-3.5
                          text-amber-500
                        "
                      />

                      Earn Stars
                    </div>

                  </div>

                </div>


                {/* =================================================
                    OFFLINE
                ================================================= */}

                <div
                  className="
                    flex
                    flex-col
                    items-center
                    lg:items-end
                    gap-2.5
                  "
                >

                  <button
                    type="button"
                    onClick={
                      onOpenOfflineModal
                    }
                    className="
                      group
                      inline-flex
                      items-center
                      justify-center
                      gap-2
                      min-w-[175px]
                      px-4
                      py-3
                      rounded-2xl
                      bg-white/75
                      hover:bg-white
                      border
                      border-white
                      text-stone-800
                      font-black
                      text-xs
                      shadow-sm
                      hover:shadow-md
                      hover:-translate-y-0.5
                      transition-all
                      cursor-pointer
                      backdrop-blur-sm
                    "
                  >

                    <Download
                      className="
                        w-4
                        h-4
                        text-amber-600
                      "
                    />

                    Offline Download Pack

                  </button>


                  <div
                    className="
                      flex
                      items-center
                      gap-1.5
                      text-[9px]
                      text-stone-500
                      font-bold
                    "
                  >

                    <CircleCheck
                      className="
                        w-3
                        h-3
                        text-emerald-500
                      "
                    />

                    Your stories work offline

                  </div>

                </div>

              </div>

            </div>

          </SpotlightCard>

        </motion.section>


        {/* =====================================================
            DAILY READING GOAL
        ===================================================== */}

        <div
          className="
            w-full
            max-w-[1600px]
            mx-auto
            px-4
            sm:px-6
            lg:px-8
            pt-6
          "
        >
          <ReadingGrowthSprout
            student={student}
            dailyStoryTarget={3}
            onGoalAchievedReward={(
              bonusStars
            ) => {

              offlineStorage.updateCurrentStudent({
                stars:
                  (student.stars || 0) +
                  bonusStars,
              });

              onRefreshStudent?.();
            }}
          />
        </div>


        {/* =====================================================
            SEARCH
        ===================================================== */}

        <div
          className="
            w-full
            max-w-[1600px]
            mx-auto
            px-4
            sm:px-6
            lg:px-8
            pt-6
          "
        >

          <MultilingualSearchBar
            query={searchQuery}
            onQueryChange={(q) =>
              setSearchQuery(q)
            }
            selectedLanguage={
              selectedLanguage
            }
            onSelectLanguage={(lang) =>
              setSelectedLanguage(lang)
            }
            selectedGrade={
              selectedGrade
            }
            onSelectGrade={(grade) =>
              setSelectedGrade(grade)
            }
            totalResults={
              filteredStories.length
            }
            onClear={() =>
              setSearchQuery('')
            }
          />

        </div>


        {/* =====================================================
            STORIES
        ===================================================== */}

        <div
          className="
            w-full
            max-w-[1600px]
            mx-auto
            px-4
            sm:px-6
            lg:px-8
            pt-6
          "
        >

          <div className="space-y-4">

            <div
              className="
                flex
                items-center
                justify-between
                px-1
              "
            >

              <h2
                className="
                  text-base
                  font-black
                  text-stone-900
                  flex
                  items-center
                  gap-2
                "
              >

                <BookOpen
                  className="
                    w-4
                    h-4
                    text-amber-600
                  "
                />

                Decodable Storybooks (
                {filteredStories.length}
                )

              </h2>

            </div>


            {filteredStories.length ===
            0 ? (

              <div
                className="
                  bg-white
                  rounded-3xl
                  border
                  border-stone-200
                  p-10
                  text-center
                  space-y-4
                  shadow-sm
                "
              >

                <div className="text-5xl">
                  🔍
                </div>

                <div className="space-y-1">

                  <h3
                    className="
                      text-base
                      font-black
                      text-stone-900
                    "
                  >
                    No matching stories found
                    for "{searchQuery}"
                  </h3>

                  <p
                    className="
                      text-xs
                      text-stone-500
                      max-w-md
                      mx-auto
                    "
                  >
                    Try searching by character,
                    subject, or language.
                  </p>

                </div>


                <button
                  type="button"
                  onClick={() => {

                    soundEffects.playWordPop();

                    setSelectedLanguage(
                      'All'
                    );

                    setSelectedGrade(
                      'All'
                    );

                    setSearchQuery('');

                  }}
                  className="
                    px-5
                    py-2.5
                    rounded-2xl
                    bg-stone-900
                    hover:bg-stone-800
                    text-white
                    font-black
                    text-xs
                    shadow-md
                    transition-all
                    cursor-pointer
                  "
                >
                  Reset Filters
                </button>

              </div>

            ) : (

              <div
                className="
                  grid
                  grid-cols-1
                  sm:grid-cols-2
                  lg:grid-cols-2
                  xl:grid-cols-3
                  2xl:grid-cols-3
                  gap-x-8
                  gap-y-8
                  w-full
                  items-start
                "
              >

                {filteredStories.map(
                  (story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      onSelect={
                        onSelectStory
                      }
                      onSetupAndRead={
                        onOpenVoiceSetup
                      }
                      onToggleOffline={
                        onToggleOffline
                      }
                    />
                  )
                )}

              </div>

            )}

          </div>

        </div>

      </div>

    </div>
  );
};

export default StudentLibraryPage;