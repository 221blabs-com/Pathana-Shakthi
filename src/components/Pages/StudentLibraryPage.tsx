import React, { useEffect, useMemo, useState } from 'react';

import {
  Story,
  Student,
} from '../../types';

import { StoryCard } from '../StoryCard';
import { ReadingGrowthSprout } from '../ReadingGrowthSprout';

import ShapeGrid from '../home/ShapeGrid';
import SpotlightCard from '../SpotlightCard';
import TiltedCard from '../TiltedCard';

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

import { motion, AnimatePresence } from 'motion/react';


/* ============================================================
   ROTATING GREETINGS (Telugu, Hindi, English)
============================================================ */

const STUDENT_GREETINGS = [
  'నమస్కారం', // Telugu
  'नमस्ते',   // Hindi
  'Hello',    // English
];


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
    selectedSubject,
    setSelectedSubject,
  ] = useState<string>('All');

  const [
    isMascotSpeaking,
    setIsMascotSpeaking,
  ] = useState(false);

  const [
    greetingIndex,
    setGreetingIndex,
  ] = useState(0);

  // Automatically cycle greeting between Telugu, Hindi, English every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setGreetingIndex((prev) => (prev + 1) % STUDENT_GREETINGS.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // Always start at the top on page load / reload
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, []);


  /* ==========================================================
     SUBJECT-WISE LIBRARY
  ========================================================== */

  const subjectGroups = useMemo(() => {
    const groups = new Map<string, Story[]>();

    stories.forEach((story) => {
      const subject =
        story.category?.trim() || 'Other Stories';

      if (!groups.has(subject)) {
        groups.set(subject, []);
      }

      groups.get(subject)!.push(story);
    });

    return Array.from(groups.entries()).map(
      ([subject, subjectStories]) => ({
        subject,
        stories: subjectStories,
      })
    );
  }, [stories]);

  const subjects = useMemo(
    () => [
      'All',
      ...subjectGroups.map(
        (group) => group.subject
      ),
    ],
    [subjectGroups]
  );

  const visibleSubjectGroups =
    selectedSubject === 'All'
      ? subjectGroups
      : subjectGroups.filter(
          (group) =>
            group.subject === selectedSubject
        );

  const visibleStoryCount =
    visibleSubjectGroups.reduce(
      (total, group) =>
        total + group.stories.length,
      0
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

  const handleShakthiClick = () => {
    if (isMascotSpeaking) {
      return;
    }

    soundEffects.playWordPop();

    setIsMascotSpeaking(true);

    const language = 'Telugu';

    const phrase =
      shakthiPhrases[language] ??
      shakthiPhrases.English;

    kidSpeech.speakText(
      phrase,
      language,
      {
        onEnd: () => {
          setIsMascotSpeaking(false);
        },

        onError: () => {
          setIsMascotSpeaking(false);
        },
      }
    );
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
        md:pl-[76px]
        transition-[padding-left]
        duration-300
        ease-out
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
              max-w-7xl
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
                items-center
                justify-between
                gap-5
              "
            >

              {/* =================================================
                  STUDENT IDENTITY & WELCOME
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
                    w-[64px]
                    h-[64px]
                    sm:w-[72px]
                    sm:h-[72px]
                    shrink-0
                    rounded-[22px]
                    bg-gradient-to-br
                    from-amber-300
                    via-amber-400
                    to-orange-500
                    border-2
                    border-amber-200
                    flex
                    items-center
                    justify-center
                    text-[30px]
                    sm:text-[36px]
                    shadow-[0_10px_35px_rgba(245,158,11,0.22)]
                    hover:scale-[1.045]
                    transition-all
                    duration-300
                    cursor-pointer
                  "
                  title="View Student Profile"
                >

                  {student.avatar}

                  <span
                    className="
                      absolute
                      -right-1
                      -bottom-1
                      w-5
                      h-5
                      rounded-full
                      bg-[#292929]
                      flex
                      items-center
                      justify-center
                    "
                  >
                    <span
                      className="
                        w-3
                        h-3
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
                      mb-1
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
                        py-0.5
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
                      sm:text-[26px]
                      lg:text-[28px]
                      leading-tight
                      font-black
                      tracking-tight
                      text-white
                      flex
                      items-center
                      flex-wrap
                      gap-x-1.5
                    "
                  >
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={STUDENT_GREETINGS[greetingIndex]}
                        initial={{
                          opacity: 0,
                          y: -5,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        exit={{
                          opacity: 0,
                          y: 5,
                        }}
                        transition={{
                          duration: 0.3,
                          ease: 'easeOut',
                        }}
                        className="inline-block"
                      >
                        {STUDENT_GREETINGS[greetingIndex]},
                      </motion.span>
                    </AnimatePresence>

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
                      mt-1.5
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
                        text-stone-400
                      "
                    >
                      Student Reading Space
                    </span>

                  </div>

                </div>

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
            max-w-7xl
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
            STUDENT PROGRESS & ACTIVITIES HUB (INTEGRATED INTO PAGE)
        ===================================================== */}

        <div
          className="
            w-full
            max-w-7xl
            mx-auto
            px-4
            sm:px-6
            lg:px-8
            pt-6
          "
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">

            {/* Reading Milestones (Stars, Streak, Stories) */}
            <div className="lg:col-span-6 grid grid-cols-3 gap-3">

              {/* 1. Stars */}
              <motion.div
                whileHover={{ y: -2 }}
                className="
                  flex
                  flex-col
                  justify-between
                  p-3.5
                  sm:p-4
                  rounded-[24px]
                  bg-white/80
                  border
                  border-amber-200/80
                  shadow-[0_8px_25px_rgba(245,158,11,0.08)]
                  backdrop-blur-sm
                  transition-all
                "
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-black text-amber-800 uppercase tracking-wider">
                    Stars
                  </span>
                  <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-950 flex items-center gap-1">
                    <CountUp value={stars} />
                    <span className="text-base sm:text-lg">⭐</span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-amber-700/80 font-bold mt-0.5">
                    Stars Collected
                  </p>
                </div>
              </motion.div>

              {/* 2. Reading Streak */}
              <motion.div
                whileHover={{ y: -2 }}
                className="
                  flex
                  flex-col
                  justify-between
                  p-3.5
                  sm:p-4
                  rounded-[24px]
                  bg-white/80
                  border
                  border-orange-200/80
                  shadow-[0_8px_25px_rgba(249,115,22,0.08)]
                  backdrop-blur-sm
                  transition-all
                "
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-black text-orange-800 uppercase tracking-wider">
                    Streak
                  </span>
                  <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Flame className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-black text-orange-950 flex items-baseline gap-1">
                    <CountUp value={streak} />
                    <span className="text-xs sm:text-sm font-bold text-orange-600">days</span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-orange-700/80 font-bold mt-0.5">
                    Daily Reading
                  </p>
                </div>
              </motion.div>

              {/* 3. Completed Stories */}
              <motion.div
                whileHover={{ y: -2 }}
                className="
                  flex
                  flex-col
                  justify-between
                  p-3.5
                  sm:p-4
                  rounded-[24px]
                  bg-white/80
                  border
                  border-sky-200/80
                  shadow-[0_8px_25px_rgba(14,165,233,0.08)]
                  backdrop-blur-sm
                  transition-all
                "
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-black text-sky-800 uppercase tracking-wider">
                    Stories
                  </span>
                  <div className="w-7 h-7 rounded-xl bg-sky-100 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-black text-sky-950 flex items-baseline gap-1">
                    <CountUp value={completedStories} />
                    <span className="text-xs sm:text-sm font-bold text-sky-600">read</span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-sky-700/80 font-bold mt-0.5">
                    Completed
                  </p>
                </div>
              </motion.div>

            </div>

            {/* Quick Actions (Word Struggles, Voice & Mic, Reward Chest, Certificates) */}
            <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">

              {/* 4. Word Struggles */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.025, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  soundEffects.playPageTurn();
                  onOpenProfile();
                }}
                className="
                  flex
                  flex-col
                  items-center
                  justify-center
                  text-center
                  p-3
                  sm:p-3.5
                  rounded-[22px]
                  bg-white/90
                  hover:bg-white
                  border
                  border-stone-200/80
                  hover:border-amber-300
                  shadow-[0_4px_16px_rgba(0,0,0,0.04)]
                  hover:shadow-[0_8px_24px_rgba(245,158,11,0.12)]
                  transition-all
                  cursor-pointer
                  group
                "
              >
                <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-700 group-hover:bg-amber-100 transition-colors">
                  <Target className="w-4 h-4" />
                </div>
                <span className="mt-2 text-xs font-black text-stone-900 leading-tight">
                  Word Struggles
                </span>
                <span className="mt-0.5 text-[9px] font-semibold text-stone-500">
                  Phonics & Words
                </span>
              </motion.button>

              {/* 5. Voice & Mic */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.025, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  soundEffects.playPageTurn();
                  onOpenVoiceSetup?.();
                }}
                className="
                  flex
                  flex-col
                  items-center
                  justify-center
                  text-center
                  p-3
                  sm:p-3.5
                  rounded-[22px]
                  bg-amber-400
                  hover:bg-amber-300
                  border
                  border-amber-300
                  shadow-[0_4px_18px_rgba(245,158,11,0.22)]
                  hover:shadow-[0_8px_25px_rgba(245,158,11,0.32)]
                  text-amber-950
                  transition-all
                  cursor-pointer
                "
              >
                <div className="w-9 h-9 rounded-2xl bg-amber-950/10 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-amber-950" />
                </div>
                <span className="mt-2 text-xs font-black text-amber-950 leading-tight">
                  Voice & Mic
                </span>
                <span className="mt-0.5 text-[9px] font-bold text-amber-900/80">
                  Speech Practice
                </span>
              </motion.button>

              {/* 6. Reward Chest */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.025, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  soundEffects.playStarChime();
                  onOpenRewardChest();
                }}
                className="
                  flex
                  flex-col
                  items-center
                  justify-center
                  text-center
                  p-3
                  sm:p-3.5
                  rounded-[22px]
                  bg-gradient-to-br
                  from-amber-500
                  to-orange-500
                  hover:from-amber-400
                  hover:to-orange-400
                  border
                  border-amber-300/40
                  shadow-[0_6px_20px_rgba(245,158,11,0.25)]
                  hover:shadow-[0_10px_28px_rgba(245,158,11,0.35)]
                  text-white
                  transition-all
                  cursor-pointer
                "
              >
                <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-100" />
                </div>
                <span className="mt-2 text-xs font-black text-white leading-tight">
                  Reward Chest
                </span>
                <span className="mt-0.5 text-[9px] font-bold text-amber-100">
                  {stars} ⭐ Available
                </span>
              </motion.button>

              {/* 7. Certificates */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.025, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  soundEffects.playStarChime();
                  onOpenCertificateModal();
                }}
                className="
                  flex
                  flex-col
                  items-center
                  justify-center
                  text-center
                  p-3
                  sm:p-3.5
                  rounded-[22px]
                  bg-white/90
                  hover:bg-white
                  border
                  border-stone-200/80
                  hover:border-emerald-300
                  shadow-[0_4px_16px_rgba(0,0,0,0.04)]
                  hover:shadow-[0_8px_24px_rgba(16,185,129,0.12)]
                  transition-all
                  cursor-pointer
                  group
                "
              >
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-100 transition-colors">
                  <Award className="w-4 h-4" />
                </div>
                <span className="mt-2 text-xs font-black text-stone-900 leading-tight">
                  Certificates
                </span>
                <span className="mt-0.5 text-[9px] font-semibold text-stone-500">
                  Badges & Honors
                </span>
              </motion.button>

            </div>

          </div>
        </div>


        {/* =====================================================
            DAILY READING GOAL
        ===================================================== */}

        <div
          className="
            w-full
            max-w-7xl
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
            SUBJECT-WISE STORY LIBRARY
        ===================================================== */}

        <div
          className="
            w-full
            max-w-7xl
            mx-auto
            px-4
            sm:px-6
            lg:px-8
            pt-7
          "
        >
          <section
            className="
              overflow-hidden
              rounded-[30px]
              border
              border-stone-200/80
              bg-white
              shadow-[0_18px_55px_rgba(50,45,35,0.07)]
            "
          >
            {/* Library heading */}
            <div
              className="
                border-b
                border-stone-100
                bg-gradient-to-r
                from-white
                via-amber-50/35
                to-orange-50/30
                px-5
                py-5
                sm:px-7
                sm:py-6
              "
            >
              <div
                className="
                  flex
                  flex-col
                  gap-4
                  lg:flex-row
                  lg:items-end
                  lg:justify-between
                "
              >
                <div>
                  <div
                    className="
                      inline-flex
                      items-center
                      gap-1.5
                      rounded-full
                      bg-amber-50
                      px-3
                      py-1.5
                      text-[9px]
                      font-black
                      uppercase
                      tracking-[0.16em]
                      text-amber-700
                      ring-1
                      ring-amber-200
                    "
                  >
                    <BookOpen className="h-3 w-3" />
                    Story library
                  </div>

                  <h2
                    className="
                      mt-2
                      text-xl
                      font-black
                      tracking-tight
                      text-stone-950
                      sm:text-2xl
                    "
                  >
                    Explore by subject
                  </h2>

                  <p
                    className="
                      mt-1
                      max-w-2xl
                      text-xs
                      leading-5
                      text-stone-500
                      sm:text-sm
                    "
                  >
                    Choose a subject and discover stories
                    made for your reading journey.
                  </p>
                </div>

                <div
                  className="
                    inline-flex
                    shrink-0
                    items-center
                    gap-2
                    self-start
                    rounded-2xl
                    border
                    border-emerald-100
                    bg-emerald-50
                    px-3
                    py-2
                  "
                >
                  <CircleCheck className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wide text-emerald-700">
                      Stories available
                    </p>
                    <p className="text-xs font-black text-emerald-900">
                      {visibleStoryCount} ready to read
                    </p>
                  </div>
                </div>
              </div>

              {/* SUBJECT NAVIGATION */}
              {subjects.length > 1 && (
                <div
                  className="
                    mt-5
                    flex
                    gap-2
                    overflow-x-auto
                    pb-1
                    scrollbar-thin
                  "
                >
                  {subjects.map((subject) => {
                    const active =
                      selectedSubject === subject;

                    const subjectIcon =
                      subject === 'All'
                        ? '✨'
                        : subject.toLowerCase().includes('animal')
                          ? '🐯'
                          : subject.toLowerCase().includes('moral') ||
                            subject.toLowerCase().includes('panch')
                            ? '📖'
                            : subject.toLowerCase().includes('nature') ||
                              subject.toLowerCase().includes('tree')
                              ? '🌿'
                              : subject.toLowerCase().includes('science') ||
                                subject.toLowerCase().includes('light')
                                ? '🔬'
                                : subject.toLowerCase().includes('friend')
                                  ? '🤝'
                                  : '🌟';

                    return (
                      <motion.button
                        key={subject}
                        type="button"
                        onClick={() => {
                          if (!active) {
                            soundEffects.playWordPop();
                            setSelectedSubject(subject);
                          }
                        }}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className={`
                          inline-flex
                          shrink-0
                          cursor-pointer
                          items-center
                          gap-1.5
                          rounded-full
                          border
                          px-3.5
                          py-2
                          text-[10px]
                          font-black
                          transition-all
                          ${
                            active
                              ? 'border-stone-900 bg-stone-900 text-white shadow-[0_8px_20px_rgba(28,25,23,0.16)]'
                              : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50 hover:text-stone-900'
                          }
                        `}
                      >
                        <span>{subjectIcon}</span>
                        {subject}
                        <span
                          className={`
                            rounded-full
                            px-1.5
                            py-0.5
                            text-[8px]
                            ${
                              active
                                ? 'bg-white/15 text-white/70'
                                : 'bg-stone-100 text-stone-400'
                            }
                          `}
                        >
                          {subject === 'All'
                            ? stories.length
                            : subjectGroups.find(
                                (group) =>
                                  group.subject ===
                                  subject
                              )?.stories.length || 0}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SUBJECT SECTIONS */}
            <div className="space-y-8 p-5 sm:p-7">
              {visibleSubjectGroups.length === 0 ? (
                <div
                  className="
                    rounded-[24px]
                    border
                    border-stone-200
                    bg-stone-50
                    px-6
                    py-12
                    text-center
                  "
                >
                  <div className="text-5xl">📚</div>
                  <h3
                    className="
                      mt-3
                      text-base
                      font-black
                      text-stone-900
                    "
                  >
                    No stories in this subject yet
                  </h3>
                  <p className="mt-1 text-xs text-stone-500">
                    More reading adventures will appear here soon.
                  </p>
                </div>
              ) : (
                visibleSubjectGroups.map(
                  (group, groupIndex) => (
                    <section
                      key={group.subject}
                      className="space-y-4"
                    >
                      <div
                        className="
                          flex
                          flex-col
                          gap-2
                          sm:flex-row
                          sm:items-end
                          sm:justify-between
                        "
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="
                                flex
                                h-9
                                w-9
                                shrink-0
                                items-center
                                justify-center
                                rounded-2xl
                                bg-amber-50
                                text-lg
                                ring-1
                                ring-amber-100
                              "
                            >
                              {group.subject
                                .toLowerCase()
                                .includes('animal')
                                ? '🐯'
                                : group.subject
                                    .toLowerCase()
                                    .includes('moral') ||
                                  group.subject
                                    .toLowerCase()
                                    .includes('panch')
                                  ? '📖'
                                  : group.subject
                                      .toLowerCase()
                                      .includes('nature') ||
                                    group.subject
                                      .toLowerCase()
                                      .includes('tree')
                                    ? '🌿'
                                    : group.subject
                                        .toLowerCase()
                                        .includes('science') ||
                                      group.subject
                                        .toLowerCase()
                                        .includes('light')
                                      ? '🔬'
                                      : group.subject
                                          .toLowerCase()
                                          .includes('friend')
                                        ? '🤝'
                                        : '🌟'}
                            </span>

                            <div className="min-w-0">
                              <h3
                                className="
                                  truncate
                                  text-base
                                  font-black
                                  text-stone-950
                                  sm:text-lg
                                "
                              >
                                {group.subject}
                              </h3>

                              <p className="text-[10px] font-semibold text-stone-400">
                                {group.stories.length}{' '}
                                {group.stories.length === 1
                                  ? 'story'
                                  : 'stories'}{' '}
                                to explore
                              </p>
                            </div>
                          </div>
                        </div>

                        <span
                          className="
                            inline-flex
                            w-fit
                            items-center
                            rounded-full
                            bg-stone-100
                            px-2.5
                            py-1
                            text-[9px]
                            font-black
                            text-stone-500
                          "
                        >
                          Subject {groupIndex + 1}
                        </span>
                      </div>

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
                          duration: 0.3,
                          delay:
                            groupIndex * 0.04,
                        }}
                        className="
                          grid
                          grid-cols-1
                          gap-5
                          sm:grid-cols-2
                          lg:grid-cols-3
                          xl:grid-cols-4
                        "
                      >
                        {group.stories.map(
                          (story, index) => (
                            <motion.div
                              key={story.id}
                              layout
                              initial={{
                                opacity: 0,
                                y: 12,
                              }}
                              animate={{
                                opacity: 1,
                                y: 0,
                              }}
                              transition={{
                                delay: Math.min(
                                  index * 0.035,
                                  0.18
                                ),
                                duration: 0.25,
                              }}
                              className="relative"
                            >
                              {student.completedStoryIds?.includes(
                                story.id
                              ) && (
                                <div
                                  className="
                                    pointer-events-none
                                    absolute
                                    right-3
                                    top-3
                                    z-20
                                    inline-flex
                                    items-center
                                    gap-1
                                    rounded-full
                                    bg-emerald-500
                                    px-2
                                    py-1
                                    text-[8px]
                                    font-black
                                    text-white
                                    shadow-sm
                                  "
                                >
                                  <CircleCheck className="h-3 w-3" />
                                  Read
                                </div>
                              )}

                              <StoryCard
                                story={story}
                                onSelect={onSelectStory}
                                onSetupAndRead={
                                  onOpenVoiceSetup
                                }
                                onToggleOffline={
                                  onToggleOffline
                                }
                              />
                            </motion.div>
                          )
                        )}
                      </motion.div>
                    </section>
                  )
                )
              )}
            </div>
          </section>
        </div>

      </div>

    </div>
  );
};

export default StudentLibraryPage;