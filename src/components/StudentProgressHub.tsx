import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Award, BookOpen, Flame, Mic, Sparkles, Target } from 'lucide-react';
import { Student } from '../types';
import { soundEffects } from '../services/soundEffects';
import { offlineStorage } from '../services/offlineStorage';
import { ReadingGrowthSprout } from './ReadingGrowthSprout';

// A child's stars, streak, stories, quick actions (word struggles, voice and
// mic, reward chest, certificates) and the daily reading garden. They live on
// the child's profile page; the home page is for choosing what to learn.

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


export interface StudentProgressHubProps {
  student: Student;
  onOpenProfile: () => void;
  onOpenVoiceSetup?: () => void;
  onOpenRewardChest: () => void;
  onOpenCertificateModal: () => void;
  onRefreshStudent?: () => void;
}

export const StudentProgressHub: React.FC<StudentProgressHubProps> = ({
  student,
  onOpenProfile,
  onOpenVoiceSetup,
  onOpenRewardChest,
  onOpenCertificateModal,
  onRefreshStudent,
}) => {
  const streak = student.streakDays ?? 0;
  const completedStories = student.completedStoryIds?.length ?? 0;
  const stars = student.stars ?? 0;

  return (
    <>
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
            dailyCertificateTarget={3}
            onGoalAchievedReward={(
              bonusStars
            ) => {

              const current = offlineStorage.getCurrentStudent();
              offlineStorage.updateCurrentStudent({
                stars:
                  (current?.stars ?? student.stars ?? 0) +
                  bonusStars,
              });

              onRefreshStudent?.();
            }}
          />
        </div>
    </>
  );
};
