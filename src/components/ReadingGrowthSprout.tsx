import React, { useEffect, useMemo, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Check,
  Gift,
  Play,
  RotateCcw,
  Sparkles,
  Sprout,
  Star,
} from 'lucide-react';
import { Student } from '../types';
import { soundEffects } from '../services/soundEffects';

interface ReadingGrowthSproutProps {
  student: Student;
  dailyStoryTarget?: number;
  onGoalAchievedReward?: (bonusStars: number) => void;
}

type GrowthStage = {
  name: string;
  subtitle: string;
  frame: number;
};

/*
 * The supplied EnergyShares plant5.lottie is 100 frames @ 30 FPS.
 * Its own animation contains the natural growth motion; we only choose
 * where to pause it for testing.
 *
 * Checkpoints intentionally follow the visible build-up in the source animation:
 *   0  = mud / seedbed only
 *   25 = little sprout with a few leaves
 *   55 = full leafy tree
 *   99 = final blooming state
 *
 * The important part is that every forward test plays the REAL animation
 * continuously between these frames; we never cross-fade between still images.
 */
const STAGES: GrowthStage[] = [
  {
    name: 'Seedling',
    subtitle: 'Just the soil — every great tree starts here.',
    frame: 0,
  },
  {
    name: 'Little Sprout',
    subtitle: 'A tiny stem with 2–3 new leaves.',
    frame: 25,
  },
  {
    name: 'Full Leaf Tree',
    subtitle: 'Your reading habit is now growing strong branches.',
    frame: 55,
  },
  {
    name: 'Blooming Tree',
    subtitle: 'Flowers bloom as your reading journey reaches its next level.',
    frame: 99,
  },
];

const FPS = 30;
const TREE_SRC = '/EnergyShares plant5.lottie';

export const ReadingGrowthSprout: React.FC<ReadingGrowthSproutProps> = ({
  student,
  dailyStoryTarget = 3,
  onGoalAchievedReward,
}) => {
  const studentProgress = student as Student & {
    dailyStoriesRead?: number;
    storiesReadToday?: number;
    dailyStoryCount?: number;
  };

  // Daily progress is intentionally 0 unless the student model provides
  // an explicit today-only counter. `completedStoryIds` is cumulative and
  // must not be used as today's progress.
  const storedDailyProgress =
    studentProgress.dailyStoriesRead ??
    studentProgress.storiesReadToday ??
    studentProgress.dailyStoryCount ??
    0;

  const target = Math.max(1, dailyStoryTarget);

  const [testDailyProgress, setTestDailyProgress] = useState<number | null>(null);
  const progressStories = Math.max(0, Math.min(target, testDailyProgress ?? storedDailyProgress));
  const stageIndex = Math.min(STAGES.length - 1, Math.floor((testDailyProgress ?? storedDailyProgress) / target));
  const stage = STAGES[stageIndex];

  const goalComplete = progressStories >= target && target > 0;
  const progressPercent = Math.min(100, (progressStories / target) * 100);

  const [previewStageIndex, setPreviewStageIndex] = useState(0);
  const previousStageIndexRef = React.useRef(stageIndex);
  const [playback, setPlayback] = useState<{
    key: number;
    from: number;
    to: number;
    autoplay: boolean;
  }>({
    key: 0,
    from: stage.frame,
    to: stage.frame,
    autoplay: false,
  });
  const [celebrating, setCelebrating] = useState(false);

  /*
   * On first mount, show the student's current checkpoint immediately.
   * When the student actually advances a milestone later, let the REAL
   * Lottie animation travel from the previous checkpoint to the new one.
   */
  useEffect(() => {
    const previousStageIndex = previousStageIndexRef.current;

    if (previousStageIndex === stageIndex) {
      setPreviewStageIndex(stageIndex);
      setPlayback((current) => ({
        ...current,
        key: current.key + 1,
        from: stage.frame,
        to: stage.frame,
        autoplay: false,
      }));
      return;
    }

    const fromFrame = STAGES[Math.max(0, Math.min(STAGES.length - 1, previousStageIndex))].frame;
    const toFrame = stage.frame;

    setPreviewStageIndex(stageIndex);

    if (stageIndex > previousStageIndex) {
      setPlayback((current) => ({
        key: current.key + 1,
        from: fromFrame,
        to: toFrame,
        autoplay: true,
      }));
    } else {
      setPlayback((current) => ({
        key: current.key + 1,
        from: toFrame,
        to: toFrame,
        autoplay: false,
      }));
    }

    previousStageIndexRef.current = stageIndex;
  }, [stageIndex, stage.frame]);

  /* Reward only once per completed milestone. */
  const rewardMilestone = Math.floor(storedDailyProgress / target);
  const rewardKey = useMemo(
    () => `pathana_reading_goal_reward_${student.id}`,
    [student.id],
  );

  useEffect(() => {
    if (!goalComplete || rewardMilestone <= 0) return;

    try {
      const previous = Number(localStorage.getItem(rewardKey) || '0');
      if (previous >= rewardMilestone) return;

      localStorage.setItem(rewardKey, String(rewardMilestone));
      setCelebrating(true);
      soundEffects.playWordPop();
      onGoalAchievedReward?.(25);

      const timer = window.setTimeout(() => setCelebrating(false), 2600);
      return () => window.clearTimeout(timer);
    } catch {
      // Rendering should continue even if storage is unavailable.
    }
  }, [goalComplete, rewardMilestone, rewardKey, onGoalAchievedReward]);

  const playFromTo = (from: number, to: number) => {
    if (to <= from) {
      setPlayback((current) => ({
        key: current.key + 1,
        from: to,
        to,
        autoplay: false,
      }));
      return;
    }

    setPlayback((current) => ({
      key: current.key + 1,
      from,
      to,
      autoplay: true,
    }));
  };

  const handleStagePreview = (nextStageIndex: number) => {
    const safeIndex = Math.max(0, Math.min(STAGES.length - 1, nextStageIndex));
    const fromFrame = STAGES[previewStageIndex].frame;
    const toFrame = STAGES[safeIndex].frame;

    // Test-only stage controls also simulate the corresponding daily
    // milestone so the progress UI stays in sync while we validate frames.
    setTestDailyProgress(Math.min(target, safeIndex * target));
    setPreviewStageIndex(safeIndex);

    if (safeIndex > previewStageIndex) {
      // Play the supplied Lottie continuously through every real frame.
      // This is the behavior we want to verify before production locking.
      playFromTo(fromFrame, toFrame);
      return;
    }

    // Backward movement is only a test reset; forward movement is always animated.
    playFromTo(toFrame, toFrame);
  };

  const handlePlayFullGrowth = () => {
    setTestDailyProgress(target);
    setPreviewStageIndex(3);
    playFromTo(0, STAGES[STAGES.length - 1].frame);
  };

  const handleResetSeedling = () => {
    setTestDailyProgress(0);
    setPreviewStageIndex(0);
    playFromTo(0, 0);
  };

  const previewStage = STAGES[previewStageIndex];
  const playbackLabel = playback.autoplay
    ? `${(playback.from / FPS).toFixed(2)}s → ${(playback.to / FPS).toFixed(2)}s`
    : `Paused at ${(previewStage.frame / FPS).toFixed(2)}s`;

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-emerald-200/80 bg-white shadow-[0_18px_55px_rgba(50,55,40,.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(57,184,141,.14),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(255,184,77,.10),transparent_26%)]" />

      <div className="relative z-10 p-5 sm:p-7 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-emerald-800">
                <Sprout className="h-3 w-3" />
                Daily Literacy Sprout
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-stone-500 ring-1 ring-stone-200">
                {progressStories} stories read
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
              Grow your reading garden 🌱
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-stone-500 sm:text-sm">
              Complete {target} stories to grow the tree to its next stage.
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
                {progressStories}/{target} stories
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
                key={playback.key}
                src={TREE_SRC}
                loop={false}
                autoplay={playback.autoplay}
                mode="forward"
                segment={[playback.from, playback.to]}
                useFrameInterpolation={true}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-center shadow-sm ring-1 ring-stone-200">
              <p className="text-[10px] font-black text-stone-800">
                {previewStage.name}
              </p>
              <p className="mt-0.5 text-[8px] font-semibold text-stone-400">
                {previewStage.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-col rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-amber-800 ring-1 ring-amber-200">
                  <Star className="h-3 w-3 fill-current" />
                  Today's reading goal
                </div>
                <h3 className="mt-2 text-xl font-black tracking-tight text-stone-950 sm:text-2xl">
                  {goalComplete ? 'Goal complete! 🎉' : 'Keep the tree growing.'}
                </h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {goalComplete
                    ? `Amazing! You completed all ${target} stories.`
                    : `${progressStories} of ${target} stories complete.`}
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                {goalComplete ? <Check className="h-5 w-5" /> : <Sprout className="h-5 w-5" />}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-stone-100 bg-stone-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black text-stone-700">Daily progress</span>
                <span className="text-[10px] font-black text-emerald-700">
                  {progressStories}/{target}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-stone-200">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.75, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-400"
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {Array.from({ length: target }, (_, index) => {
                  const done = index < progressStories;
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[9px] font-black ${
                        done
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-white text-stone-400 ring-1 ring-stone-200'
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                      Story {index + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-stone-400">
                    Animation test controls
                  </p>
                  <p className="mt-1 text-sm font-black text-stone-900">
                    Natural growth checkpoints
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold text-stone-400">
                    {playbackLabel} • {FPS} FPS • 100 frames
                  </p>
                </div>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-black text-violet-700 ring-1 ring-violet-200">
                  {previewStage.name} • {previewStage.frame}f
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STAGES.map((item, index) => {
                  const isPreview = index === previewStageIndex;
                  const isStudentStage = index === stageIndex;

                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handleStagePreview(index)}
                      className={`group rounded-2xl p-3 text-left ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        isPreview
                          ? 'bg-violet-50 ring-violet-300 shadow-sm'
                          : isStudentStage
                            ? 'bg-emerald-50 ring-emerald-200'
                            : 'bg-stone-50 ring-stone-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            isPreview
                              ? 'bg-violet-100 text-violet-700'
                              : isStudentStage
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-white text-stone-500'
                          }`}
                        >
                          <Sprout className="h-4 w-4" />
                        </div>
                        <span className="text-[8px] font-black text-stone-400">
                          {item.frame}f • {(item.frame / FPS).toFixed(2)}s
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[9px] font-black text-stone-800">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[8px] font-semibold text-stone-400">
                        {index === previewStageIndex
                          ? 'Current preview'
                          : index > previewStageIndex
                            ? `Play → ${item.frame}f`
                            : `Reset → ${item.frame}f`}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePlayFullGrowth}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-stone-900 px-3 py-2.5 text-[9px] font-black text-white transition-all hover:-translate-y-0.5 hover:bg-stone-800 hover:shadow-md"
                >
                  <Play className="h-3 w-3 fill-current" />
                  Play full growth
                </button>
                <button
                  type="button"
                  onClick={handleResetSeedling}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-stone-100 px-3 py-2.5 text-[9px] font-black text-stone-700 transition-all hover:-translate-y-0.5 hover:bg-stone-200"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to seedling
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                  <p className="text-[9px] font-bold leading-4 text-violet-800">
                    Test mode: Stage 1 is mud only, Stage 2 is the little 2–3 leaf sprout, Stage 3 is the full leafy tree, and Stage 4 is the blooming tree. Every forward button plays the real Lottie frames between those checkpoints.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {celebrating && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-5 overflow-hidden rounded-[22px] border border-amber-200 bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400 px-4 py-3 text-stone-950 shadow-[0_12px_30px_rgba(245,158,11,.18)]"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.7, repeat: 2 }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/75"
                >
                  <Gift className="h-5 w-5" />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-wider">Daily goal achieved</p>
                  <p className="text-sm font-black">+25 Star Bonus! Your tree reached a new stage 🌳</p>
                </div>
                <Sparkles className="hidden h-5 w-5 shrink-0 sm:block" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default ReadingGrowthSprout;
