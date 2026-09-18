import React, { useEffect, useMemo, useState } from 'react';

import {
  Story,
  Student,
  Language,
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

import { backendApi } from '../../services/backendApi';

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
  Calculator,
  Leaf,
  Languages,
  Map as MapIcon,
  Play,
  X,
  ArrowLeft,
  Clock3,
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
    'à°¨à°®à°¸à±à°•à°¾à°°à°‚! à°¨à±‡à°¨à± à°¶à°•à±à°¤à°¿ à°®à°¿à°¤à±à°°à°¨à±. à°¨à°¾à°¤à±‹ à°•à°²à°¿à°¸à°¿ à°°à±‹à°œà±‚ à°¤à±†à°²à±à°—à± à°•à°¥à°²à± à°šà°¦à±à°µà±à°•à±à°‚à°¦à°¾à°‚!',

  Hindi:
    'à¤¨à¤®à¤¸à¥à¤¤à¥‡! à¤®à¥ˆà¤‚ à¤¶à¤•à¥à¤¤à¤¿ à¤®à¤¿à¤¤à¥à¤° à¤¹à¥‚à¤à¥¤ à¤†à¤“ à¤®à¤¿à¤²à¤•à¤° à¤¹à¤° à¤¦à¤¿à¤¨ à¤ªà¥à¤¯à¤¾à¤°à¥€-à¤ªà¥à¤¯à¤¾à¤°à¥€ à¤•à¤¹à¤¾à¤¨à¤¿à¤¯à¤¾à¤ à¤ªà¤¢à¤¼à¥‡à¤‚!',

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
    selectedSubject,
    setSelectedSubject,
  ] = useState<string>('All');

  const [
    isMascotSpeaking,
    setIsMascotSpeaking,
  ] = useState(false);

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
     FIREBASE CURRICULUM
  ========================================================== */

  interface FirebaseLesson {
    id: string;
    title: string;
    subject: string;
    grade: string;
    lessonNumber: number;
    summary?: string;
    description?: string;
    language?: string;
  }

  const [firebaseLessons, setFirebaseLessons] = useState<FirebaseLesson[]>([]);
  const [curriculumLoading, setCurriculumLoading] = useState(true);
  const [curriculumError, setCurriculumError] = useState('');
  const [selectedCurriculumSubject, setSelectedCurriculumSubject] = useState('All');
  const [selectedLesson, setselectedLesson] = useState<FirebaseLesson | null>(null);
  const [lessonDetail, setLessonDetail] = useState<Record<string, unknown> | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonStarted, setLessonStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCurriculum = async () => {
      setCurriculumLoading(true);
      setCurriculumError('');

      try {
        const response = await backendApi.curriculum(student.grade);
        const lessons = Array.isArray(response?.lessons)
          ? response.lessons
          : [];

        if (!cancelled) {
          setFirebaseLessons(lessons as FirebaseLesson[]);
        }
      } catch (error) {
        console.error('Failed to load Firebase curriculum:', error);
        if (!cancelled) {
          setCurriculumError('Your class curriculum could not be loaded right now.');
          setFirebaseLessons([]);
        }
      } finally {
        if (!cancelled) {
          setCurriculumLoading(false);
        }
      }
    };

    void loadCurriculum();

    return () => {
      cancelled = true;
    };
  }, [student.grade]);

  const curriculumSubjects = [
    'All',
    ...Array.from(
      new Set(firebaseLessons.map((lesson) => lesson.subject).filter(Boolean))
    ),
  ];

  const filteredCurriculumLessons = firebaseLessons.filter((lesson) =>
    selectedCurriculumSubject === 'All'
      ? true
      : lesson.subject === selectedCurriculumSubject
  );

  const subjectVisuals: Record<string, { icon: React.ReactNode; iconClass: string; badgeClass: string }> = {
    English: {
      icon: <BookOpen className="w-4 h-4" />,
      iconClass: 'bg-sky-100 text-sky-700',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-100',
    },
    Hindi: {
      icon: <Languages className="w-4 h-4" />,
      iconClass: 'bg-pink-100 text-pink-700',
      badgeClass: 'bg-pink-50 text-pink-700 border-pink-100',
    },
    Telugu: {
      icon: <Languages className="w-4 h-4" />,
      iconClass: 'bg-orange-100 text-orange-700',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-100',
    },
    Mathematics: {
      icon: <Calculator className="w-4 h-4" />,
      iconClass: 'bg-violet-100 text-violet-700',
      badgeClass: 'bg-violet-50 text-violet-700 border-violet-100',
    },
    'Social Studies': {
      icon: <MapIcon className="w-4 h-4" />,
      iconClass: 'bg-emerald-100 text-emerald-700',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
  };

  const getSubjectVisual = (subject: string) =>
    subjectVisuals[subject] ?? {
      icon: <BookOpen className="w-4 h-4" />,
      iconClass: 'bg-stone-100 text-stone-700',
      badgeClass: 'bg-stone-50 text-stone-700 border-stone-100',
    };

  const handleOpenCurriculumLesson = async (lesson: FirebaseLesson) => {
    soundEffects.playPageTurn();
    setselectedLesson(lesson);
    setLessonDetail(null);
    setLessonStarted(false);
    setLessonLoading(true);

    try {
      const response = await backendApi.lesson(lesson.id);
      const detail = response?.lesson;
      setLessonDetail(
        detail && typeof detail === 'object'
          ? (detail as Record<string, unknown>)
          : null
      );
    } catch (error) {
      console.error('Failed to load lesson details:', error);
      setLessonDetail(null);
    } finally {
      setLessonLoading(false);
    }
  };

  const handleStartCurriculumLesson = () => {
    if (!selectedLesson) return;

    soundEffects.playStarChime();
    setLessonStarted(true);

    const detailDescription =
      typeof lessonDetail?.description === 'string'
        ? lessonDetail.description
        : selectedLesson.description ?? selectedLesson.summary ?? '';

    const speechText = detailDescription
      ? `${selectedLesson.title}. ${detailDescription}`
      : selectedLesson.title;

    kidSpeech.speakText(
      speechText,
      (selectedLesson.language || selectedLesson.subject || 'English') as Language
    );
  };

  const closeCurriculumLesson = () => {
    setselectedLesson(null);
    setLessonDetail(null);
    setLessonStarted(false);
  };


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

    const language: Language = 'Telugu';

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
        overflow-x-hidden
        bg-stone-50
        text-stone-900
        pb-16
        font-sans
        md:pl-[84px]
        box-border
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
                    à°¨à°®à°¸à±à°•à°¾à°°à°‚,{' '}

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
                      â€¢
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
                    ({stars} â­)
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
                        âœ¨
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
                          : 'Tap Shakthi Mitra âœ¨'}
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
            dailyStoryTarget={4}
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
            FIREBASE CLASS CURRICULUM
        ===================================================== */}

        <section
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
          <div className="rounded-[28px] bg-white border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-7 py-5 border-b border-stone-100">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" />
                    Your Class Curriculum
                  </div>
                  <h2 className="mt-2 text-lg sm:text-xl font-black text-stone-900">
                    Class {student.grade.replace('Class ', '')} lessons
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Pick a subject, choose a lesson, and start learning with Shakthi Mitra.
                  </p>
                </div>

                {!curriculumLoading && firebaseLessons.length > 0 && (
                  <div className="text-xs font-black text-stone-500">
                    {filteredCurriculumLessons.length} lesson{filteredCurriculumLessons.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>

              {!curriculumLoading && firebaseLessons.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {curriculumSubjects.map((subject) => {
                    const visual = getSubjectVisual(subject);
                    return (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => {
                          soundEffects.playWordPop();
                          setSelectedCurriculumSubject(subject);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer border ${
                          selectedCurriculumSubject === subject
                            ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                            : `${visual.badgeClass} hover:-translate-y-0.5`
                        }`}
                      >
                        {subject === 'All' ? <BookOpen className="w-3.5 h-3.5" /> : visual.icon}
                        {subject}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-5 sm:p-7">
              {curriculumLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-36 rounded-2xl bg-stone-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : curriculumError ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5 text-center">
                  <div className="text-2xl mb-2">ðŸ“š</div>
                  <p className="text-xs font-bold text-stone-600">{curriculumError}</p>
                  <p className="mt-1 text-[10px] text-stone-400">
                    Your story library is still available below.
                  </p>
                </div>
              ) : filteredCurriculumLessons.length === 0 ? (
                <div className="rounded-2xl bg-stone-50 border border-stone-100 p-6 text-center">
                  <div className="text-2xl mb-2">ðŸ“–</div>
                  <p className="text-xs font-black text-stone-700">
                    No lessons found for this subject yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredCurriculumLessons.map((lesson) => {
                    const visual = getSubjectVisual(lesson.subject);

                    return (
                      <motion.button
                        key={lesson.id}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => void handleOpenCurriculumLesson(lesson)}
                        className="group text-left rounded-2xl border border-stone-200 bg-stone-50/70 p-4 hover:bg-white hover:border-amber-200 hover:shadow-lg transition-all cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${visual.iconClass}`}>
                            {visual.icon}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[8px] uppercase tracking-wider font-black ${visual.badgeClass}`}>
                            {lesson.subject}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-[9px] font-black text-stone-400 uppercase tracking-wider">
                          <span>Lesson {lesson.lessonNumber}</span>
                          <span>â€¢</span>
                          <span>{lesson.subject || 'Learning'}</span>
                        </div>

                        <h3 className="mt-1.5 text-sm font-black text-stone-900 leading-snug">
                          {lesson.title}
                        </h3>

                        {(lesson.summary || lesson.description) && (
                          <p className="mt-1.5 text-[10px] leading-relaxed text-stone-500 line-clamp-2">
                            {lesson.summary || lesson.description}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-600">
                            <CircleCheck className="w-3 h-3" />
                            Ready to learn
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 opacity-80 group-hover:opacity-100">
                            Open <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {selectedLesson && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="curriculum-lesson-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeCurriculumLesson();
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-[30px] bg-white shadow-2xl border border-white/70"
            >
              <button
                type="button"
                onClick={closeCurriculumLesson}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close lesson"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative overflow-hidden bg-[#292929] px-6 sm:px-8 py-7 text-white">
                <div className="absolute -top-20 -right-10 w-48 h-48 rounded-full bg-amber-400/10 blur-3xl" />
                <div className="relative">
                  <button
                    type="button"
                    onClick={closeCurriculumLesson}
                    className="inline-flex items-center gap-1.5 text-[10px] font-black text-stone-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to curriculum
                  </button>

                  <div className="mt-5 flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getSubjectVisual(selectedLesson.subject).iconClass}`}>
                      {getSubjectVisual(selectedLesson.subject).icon}
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-widest font-black text-amber-300">
                        {selectedLesson.subject} â€¢ Lesson {selectedLesson.lessonNumber}
                      </div>
                      <h2 id="curriculum-lesson-title" className="mt-1 text-xl sm:text-2xl font-black leading-tight">
                        {selectedLesson.title}
                      </h2>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                {lessonLoading ? (
                  <div className="space-y-4">
                    <div className="h-5 w-32 rounded bg-stone-100 animate-pulse" />
                    <div className="h-24 rounded-2xl bg-stone-100 animate-pulse" />
                    <div className="h-12 rounded-2xl bg-stone-100 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-[9px] font-black">
                        <BookOpen className="w-3 h-3" />
                        {selectedLesson.subject || 'Learning'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-100 text-stone-600 text-[9px] font-black">
                        <Clock3 className="w-3 h-3" />
                        Self-paced
                      </span>
                    </div>

                    <div className="mt-5 rounded-2xl bg-stone-50 border border-stone-100 p-5">
                      <div className="text-[9px] uppercase tracking-widest font-black text-stone-400">
                        Lesson focus
                      </div>
                      <p className="mt-2 text-sm leading-relaxed font-semibold text-stone-700">
                        {typeof lessonDetail?.description === 'string'
                          ? lessonDetail.description
                          : selectedLesson.description || selectedLesson.summary || 'Letâ€™s explore this lesson together.'}
                      </p>
                    </div>

                    {lessonStarted && (
                      <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <CircleCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-emerald-800">
                            Shakthi Mitra has started the lesson!
                          </p>
                          <p className="mt-1 text-[10px] leading-relaxed text-emerald-700">
                            Listen to the lesson focus, then use the reading and practice tools below as we build the full lesson activity experience.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={handleStartCurriculumLesson}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 px-5 py-3.5 text-sm font-black text-amber-950 shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        {lessonStarted ? 'Listen Again' : 'Start Learning'}
                      </button>
                      <button
                        type="button"
                        onClick={closeCurriculumLesson}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-100 hover:bg-stone-200 px-5 py-3.5 text-sm font-black text-stone-700 transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}




        {/* =====================================================
            SUBJECT-WISE STORY LIBRARY
        ===================================================== */}

        <div
          className="
            w-full
            max-w-[1600px]
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
