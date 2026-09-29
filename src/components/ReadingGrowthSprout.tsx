import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Check, Gift, Sprout, Star } from 'lucide-react';
import { Student } from '../types';
import { soundEffects } from '../services/soundEffects';

interface ReadingGrowthSproutProps {
  student: Student;
  dailyCertificateTarget?: number;
  onGoalAchievedReward?: (bonusStars: number) => void;
}

type GrowthStage = {
  name: string;
  subtitle: string;
  frame: number;
};

const TOTAL_FRAMES = 100;
const TREE_SRC = '/EnergyShares plant5.lottie';

// Seedling is the starting step; three daily certificates grow it to a full tree.
const CERTIFICATES_TO_GROW = 3;
const DEFAULT_DAILY_TARGET = CERTIFICATES_TO_GROW;
const BONUS_STARS = 50;

const STAGES: GrowthStage[] = [
  {
    name: 'Seedling',
    subtitle: 'Mud only — every reading journey starts here.',
    frame: 0,
  },
  {
    name: 'Little Sprout',
    subtitle: 'A tiny sprout with a few new leaves.',
    frame: 30,
  },
  {
    name: 'Growing Tree',
    subtitle: 'Your tree is growing strong branches and leaves.',
    frame: 52,
  },
  {
    name: 'Full Tree',
    subtitle: 'Three certificates grew your reading tree!',
    frame: 99,
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getTodayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTreeFrameForCertificates = (certificateCount: number) => {
  const stageIndex = clamp(Math.floor(certificateCount), 0, STAGES.length - 1);
  return STAGES[stageIndex].frame;
};

const getTreeStageIndex = (certificateCount: number) =>
  clamp(Math.floor(Math.max(0, certificateCount)), 0, STAGES.length - 1);


export const ReadingGrowthSprout: React.FC<ReadingGrowthSproutProps> = ({
  student,
  dailyCertificateTarget = DEFAULT_DAILY_TARGET,
  onGoalAchievedReward,
}) => {
  const target = dailyCertificateTarget;
  const [todayKey, setTodayKey] = useState(getTodayKey);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const today = getTodayKey();
      setTodayKey((current) => current === today ? current : today);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const dailyProgress = student.dailyCertificateDate === todayKey
    ? Math.max(0, Math.floor(student.dailyCertificatesEarned || 0))
    : 0;

  const rewardStorageKey = useMemo(
    () => `pathana_reading_reward_${student.id}_${todayKey}`,
    [student.id, todayKey],
  );

  const [rewardVisible, setRewardVisible] = useState(false);

  const playerRef = useRef<any>(null);
  const previousFrameRef = useRef(0);
  const previousCertificateCountRef = useRef(0);
  const [playerReady, setPlayerReady] = useState(false);

  const treeFrame = getTreeFrameForCertificates(dailyProgress);
  const treeStageIndex = getTreeStageIndex(dailyProgress);

  // Highlight the current certificate step.
  const getVisualStageIndex = (frame: number) => {
    if (frame <= STAGES[0].frame) return 0;
    if (frame < STAGES[2].frame) return 1;
    if (frame < STAGES[3].frame) return 2;
    return 3;
  };

  const initialVisualStage = dailyProgress === 0
    ? 0
    : getVisualStageIndex(treeFrame);
  const [visualStageIndex, setVisualStageIndex] = useState(initialVisualStage);
  const currentStage = STAGES[visualStageIndex];

  const progressPercent = Math.min(dailyProgress, target) / target * 100;

  const goalComplete = dailyProgress >= target;

  useEffect(() => {
    if (!goalComplete || typeof window === 'undefined') return;

    try {
      if (localStorage.getItem(rewardStorageKey) === 'shown') return;

      localStorage.setItem(rewardStorageKey, 'shown');
      setRewardVisible(true);
      soundEffects.playWordPop();
      onGoalAchievedReward?.(BONUS_STARS);

      const timer = window.setTimeout(() => setRewardVisible(false), 3200);
      return () => window.clearTimeout(timer);
    } catch {
      // Keep the UI working when localStorage is unavailable.
    }
  }, [goalComplete, onGoalAchievedReward, rewardStorageKey]);

  const animateTreeToFrame = (fromFrame: number, toFrame: number) => {
    const player = playerRef.current;
    if (!player || !playerReady) return;

    const from = clamp(fromFrame, 0, TOTAL_FRAMES - 1);
    const to = clamp(toFrame, 0, TOTAL_FRAMES - 1);

    try {
      player.pause();
      player.setLoop(false);
      player.setMode('forward');
      player.setFrame(from);

      if (to <= from + 0.05) {
        player.setFrame(to);
        return;
      }

      player.setSegment?.([from, to]);
      player.play();
    } catch {
      try {
        player.setFrame(to);
        player.pause();
      } catch {
        // noop
      }
    }
  };

  const attachPlayer = (player: any) => {
    playerRef.current = player;
    if (!player) return;

    let syncTimer1: number | undefined;
    let syncTimer2: number | undefined;

    const syncInitialFrame = () => {
      const desiredFrame = treeFrame;

      try {
        player.setLoop(false);
        player.setMode('forward');
        player.pause();
        player.setFrame(0);

        // Force the canvas to render frame 0 before applying the persisted
        // frame. This prevents the Lottie canvas from visually staying on its
        // first rendered pose while the React stage indicator says Seedling.
        syncTimer1 = window.setTimeout(() => {
          try {
            player.pause();
            player.setFrame(desiredFrame);
            player.pause();
          } catch {
            // noop
          }
        }, 40);

        syncTimer2 = window.setTimeout(() => {
          try {
            player.pause();
            player.setFrame(desiredFrame);
            player.pause();
          } catch {
            // noop
          }
        }, 120);

        previousFrameRef.current = desiredFrame;
        previousCertificateCountRef.current = dailyProgress;
        setVisualStageIndex(
          dailyProgress === 0 ? 0 : getVisualStageIndex(desiredFrame),
        );
      } finally {
        setPlayerReady(true);
      }
    };

    const onReady = () => syncInitialFrame();

    player.addEventListener?.('ready', onReady);
    player.addEventListener?.('load', onReady);

    if (player.isLoaded) syncInitialFrame();

    return () => {
      if (syncTimer1) window.clearTimeout(syncTimer1);
      if (syncTimer2) window.clearTimeout(syncTimer2);
      player.removeEventListener?.('ready', onReady);
      player.removeEventListener?.('load', onReady);
    };
  };

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;

    const previousCompleted = previousCertificateCountRef.current;
    const previousFrame = previousFrameRef.current;

    if (dailyProgress === previousCompleted) {
      playerRef.current.pause();
      playerRef.current.setFrame(treeFrame);
      previousFrameRef.current = treeFrame;
      setVisualStageIndex(
        dailyProgress === 0 ? 0 : getVisualStageIndex(treeFrame),
      );
      return;
    }

    if (dailyProgress > previousCompleted) {
      setVisualStageIndex(
        dailyProgress === 0 ? 0 : getVisualStageIndex(treeFrame),
      );
      animateTreeToFrame(previousFrame, treeFrame);
    } else {
      playerRef.current.pause();
      playerRef.current.setFrame(treeFrame);
      setVisualStageIndex(
        dailyProgress === 0 ? 0 : getVisualStageIndex(treeFrame),
      );
    }

    previousFrameRef.current = treeFrame;
    previousCertificateCountRef.current = dailyProgress;
  }, [dailyProgress, playerReady, treeFrame]);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.pause?.();
      } catch {
        // noop
      }
    };
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-emerald-200/80 bg-white shadow-[0_18px_55px_rgba(50,55,40,.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(57,184,141,.12),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(255,184,77,.10),transparent_26%)]" />

      <AnimatePresence>
        {rewardVisible && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            className="absolute right-4 top-4 z-30 flex items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-[0_18px_45px_rgba(245,158,11,.18)] sm:right-6 sm:top-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black text-stone-900">Daily goal achieved!</p>
              <p className="mt-0.5 text-[10px] font-black text-amber-600">+{BONUS_STARS} stars</p>
            </div>
            <motion.div
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.7, repeat: 2 }}
            >
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 p-5 sm:p-7 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-emerald-800">
              <Sprout className="h-3 w-3" />
              Daily Literacy Sprout
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
              Grow your reading garden 🌱
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-stone-500 sm:text-sm">
              Each certificate grows your tree one step. Earn three today to grow the full tree and get 50 bonus points.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-2xl border border-stone-200 bg-white px-3 py-2 shadow-sm sm:self-auto">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-stone-400">
                Today
              </p>
              <p className="text-sm font-black text-stone-900">
                {Math.min(dailyProgress, target)}/{target} certificates
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative flex min-h-[330px] items-center justify-center overflow-hidden rounded-[26px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f1f8f2_100%)] px-4 py-5">
            <div className="pointer-events-none absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full bg-emerald-200/25 blur-3xl" />
            <div className="pointer-events-none absolute bottom-3 left-1/2 h-10 w-48 -translate-x-1/2 rounded-[50%] bg-emerald-900/10 blur-xl" />

            <div className="relative h-[270px] w-[270px] sm:h-[300px] sm:w-[300px]">
              <DotLottieReact
                src={TREE_SRC}
                loop={false}
                autoplay={false}
                mode="forward"
                useFrameInterpolation={true}
                dotLottieRefCallback={attachPlayer}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-center shadow-sm ring-1 ring-stone-200">
              <p className="text-[10px] font-black text-stone-800">{currentStage.name}</p>
              <p className="mt-0.5 text-[8px] font-semibold text-stone-400">
                {currentStage.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-col rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-violet-800 ring-1 ring-violet-200">
                  Your growth journey
                </div>
                <h3 className="mt-2 text-xl font-black tracking-tight text-stone-950 sm:text-2xl">
                  Four tree steps
                </h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Every new certificate moves the tree forward one step. Three certificates complete the tree.
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Check className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-stone-100 bg-stone-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black text-stone-700">Today&apos;s progress</span>
                <span className="text-[10px] font-black text-emerald-700">
                  {goalComplete
                    ? 'Full tree grown ✨'
                    : `${Math.min(dailyProgress, target)} of ${target} certificates`}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <motion.div
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-400"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {STAGES.map((item, index) => {
                const selected = visualStageIndex === index;
                const unlocked = treeStageIndex >= index;
                const completed = index < treeStageIndex;

                return (
                  <div
                    key={item.name}
                    className={`rounded-2xl border p-3 transition-all ${
                      selected
                        ? 'border-emerald-300 bg-emerald-50 shadow-[0_8px_24px_rgba(16,185,129,.10)]'
                        : completed
                          ? 'border-stone-200 bg-white'
                          : 'border-stone-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
                          selected
                            ? 'bg-emerald-100 text-emerald-700'
                            : completed
                              ? 'bg-stone-100 text-stone-500'
                              : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {index + 1}
                      </span>

                      <span
                        className={`text-[9px] font-black ${
                          selected
                            ? 'text-emerald-700'
                            : completed
                              ? 'text-stone-400'
                              : 'text-stone-400'
                        }`}
                      >
                        {selected ? 'Current' : completed ? 'Completed' : 'Locked'}
                      </span>
                    </div>

                    <p
                      className={`mt-2 text-[10px] font-black ${
                        selected ? 'text-emerald-900' : 'text-stone-900'
                      }`}
                    >
                      {item.name}
                    </p>

                    <p className="mt-0.5 text-[8px] font-semibold leading-4 text-stone-400">
                      {item.subtitle}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReadingGrowthSprout;
