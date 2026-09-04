import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Student } from '../types';
import { soundEffects } from '../services/soundEffects';
import {
  Sparkles,
  Droplets,
  Award,
  CheckCircle2,
  ChevronRight,
  Sun,
  Flame,
  Star,
  RefreshCw,
  Trophy,
} from 'lucide-react';

interface ReadingGrowthSproutProps {
  student: Student;
  dailyStoryTarget?: number;
  onGoalAchievedReward?: (bonusStars: number) => void;
  className?: string;
}

export const ReadingGrowthSprout: React.FC<ReadingGrowthSproutProps> = ({
  student,
  dailyStoryTarget = 2,
  onGoalAchievedReward,
  className = '',
}) => {
  // Count stories completed today (or fallback to completed stories count)
  const storiesCompleted = student.completedStoryIds.length;
  // Progress ratio 0 to 1
  const progressRatio = Math.min(storiesCompleted / dailyStoryTarget, 1);

  // Growth Stage: 0 (Seed), 1 (Sprout), 2 (Sapling), 3 (Bloom / Completed)
  const calculateStage = (ratio: number) => {
    if (ratio >= 1) return 3;
    if (ratio >= 0.66) return 2;
    if (ratio >= 0.33) return 1;
    return 0;
  };

  const currentStage = calculateStage(progressRatio);
  const [activeStage, setActiveStage] = useState<number>(currentStage);
  const [isWatering, setIsWatering] = useState(false);
  const [showCelebrationBanner, setShowCelebrationBanner] = useState(false);
  const [waterDrops, setWaterDrops] = useState<{ id: number; x: number; delay: number }[]>([]);
  const [isManualStageOverride, setIsManualStageOverride] = useState(false);

  // Sync stage when student progress changes (unless manual override is active)
  useEffect(() => {
    if (!isManualStageOverride) {
      setActiveStage(currentStage);
      if (currentStage === 3 && progressRatio >= 1) {
        // Goal achieved trigger
        setShowCelebrationBanner(true);
      }
    }
  }, [currentStage, progressRatio, isManualStageOverride]);

  // Stage configurations
  const stageDetails = [
    {
      level: 0,
      name: 'Sleeping Seed',
      nameNative: 'విత్తనం (Beej)',
      description: 'Read 1 story to crack the seed and start your growth!',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: '🌱',
    },
    {
      level: 1,
      name: 'Tender Sprout',
      nameNative: 'చిగురు (Ankur)',
      description: 'First leaves have unfurled! Keep reading to nourish the stem.',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      icon: '🌿',
    },
    {
      level: 2,
      name: 'Flourishing Sapling',
      nameNative: 'మొక్క (Paudha)',
      description: 'Almost there! 1 more story to make the knowledge flower bloom.',
      badgeColor: 'bg-teal-100 text-teal-900 border-teal-300',
      icon: '🪴',
    },
    {
      level: 3,
      name: 'Golden Bloom Mastered',
      nameNative: 'పుష్పం (Phool - పూర్తి!)',
      description: 'Daily reading goal achieved! Your literacy tree is blooming vibrantly!',
      badgeColor: 'bg-amber-500 text-stone-950 border-amber-400 font-black',
      icon: '🌸',
    },
  ];

  // Handle Interactive Watering action
  const handleWaterPlant = () => {
    soundEffects.playWaterDrop();
    setIsWatering(true);

    // Create droplet particles
    const drops = Array.from({ length: 6 }).map((_, i) => ({
      id: Date.now() + i,
      x: 35 + Math.random() * 30, // center % range
      delay: i * 0.1,
    }));
    setWaterDrops(drops);

    setTimeout(() => {
      soundEffects.playPlantSprout();
      // Advance stage or celebrate
      setActiveStage((prev) => {
        const next = Math.min(prev + 1, 3);
        if (next === 3) {
          setShowCelebrationBanner(true);
          soundEffects.playStarChime();
          if (onGoalAchievedReward) onGoalAchievedReward(25);
        }
        return next;
      });
      setIsManualStageOverride(true);
      setIsWatering(false);
    }, 900);
  };

  // Reset or cycle stage for demonstration
  const handleCycleStage = () => {
    soundEffects.playWordPop();
    setIsManualStageOverride(true);
    setActiveStage((prev) => {
      const next = (prev + 1) % 4;
      if (next === 3) {
        soundEffects.playPlantSprout();
        setShowCelebrationBanner(true);
      }
      return next;
    });
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#fbfdf9] via-emerald-50/40 to-amber-50/30 border border-emerald-200/80 shadow-sm p-5 sm:p-6 ${className}`}
      id="reading-growth-plant-widget"
    >
      {/* Background Soft Sunlight Aura */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 rounded-full bg-amber-200/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-emerald-200/30 blur-3xl pointer-events-none" />

      {/* Main Container Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-emerald-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-300 flex items-center justify-center text-xl shadow-2xs">
            {stageDetails[activeStage].icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-stone-900">
                Daily Literacy Sprout (పఠన వృద్ధి)
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageDetails[activeStage].badgeColor}`}
              >
                {stageDetails[activeStage].name}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium">
              {stageDetails[activeStage].nameNative} • {stageDetails[activeStage].description}
            </p>
          </div>
        </div>

        {/* Goal Metric & Interactive Action Pills */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 shadow-2xs text-xs font-bold text-stone-700">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>
              Goal: <strong>{Math.min(storiesCompleted, dailyStoryTarget)}</strong> / {dailyStoryTarget} Stories Today
            </span>
          </div>

          <button
            type="button"
            onClick={handleWaterPlant}
            disabled={isWatering}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Nourish your reading plant with daily practice"
            id="btn-water-plant"
          >
            <Droplets className={`w-3.5 h-3.5 ${isWatering ? 'animate-bounce text-cyan-200' : 'text-cyan-300'}`} />
            <span>{isWatering ? 'Nourishing...' : 'Water Sprout 💧'}</span>
          </button>

          <button
            type="button"
            onClick={handleCycleStage}
            className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 text-xs font-semibold border border-stone-200 transition-all cursor-pointer"
            title="Cycle growth preview stages"
            id="btn-cycle-stage"
          >
            <RefreshCw className="w-3 h-3 inline mr-1" />
            <span>Stage {activeStage + 1}/4</span>
          </button>
        </div>
      </div>

      {/* Interactive Growth Visual Stage Area */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 items-center">
        {/* Left Side: Rich Dynamic SVG Sprouting Plant Animation Canvas */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 relative min-h-[220px]">
          {/* Animated Water Droplets falling */}
          <AnimatePresence>
            {isWatering &&
              waterDrops.map((drop) => (
                <motion.div
                  key={drop.id}
                  initial={{ y: -20, opacity: 0, scale: 0.5 }}
                  animate={{ y: 120, opacity: [0, 1, 1, 0], scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, delay: drop.delay, ease: 'easeIn' }}
                  style={{ left: `${drop.x}%` }}
                  className="absolute top-2 w-3 h-4 bg-cyan-400 rounded-full blur-[0.5px] shadow-sm z-30 pointer-events-none"
                />
              ))}
          </AnimatePresence>

          {/* Floating Pollen / Sparkles when Blooming */}
          {activeStage >= 2 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [-10, -80, -140],
                    x: [Math.sin(i) * 15, Math.cos(i) * 25, Math.sin(i) * 35],
                    opacity: [0, 0.8, 0],
                    scale: [0.6, 1.2, 0.4],
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.6,
                    ease: 'easeInOut',
                  }}
                  style={{
                    left: `${45 + (i - 3) * 10}%`,
                    bottom: '35%',
                  }}
                  className={`absolute w-2 h-2 rounded-full ${
                    activeStage === 3 ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Core Botanical Sprout SVG Illustration */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Sunlight Radial Halo */}
            <motion.div
              animate={{
                scale: activeStage === 3 ? [1, 1.08, 1] : [0.95, 1, 0.95],
                opacity: activeStage === 3 ? [0.6, 0.9, 0.6] : [0.3, 0.5, 0.3],
              }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className={`absolute top-4 w-32 h-32 rounded-full blur-xl pointer-events-none ${
                activeStage === 3
                  ? 'bg-gradient-to-tr from-amber-300 via-orange-300 to-yellow-200'
                  : activeStage === 2
                  ? 'bg-gradient-to-tr from-emerald-200 to-teal-100'
                  : 'bg-emerald-100/60'
              }`}
            />

            <svg
              viewBox="0 0 200 200"
              className="w-full h-full drop-shadow-md select-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Definitions for Gradients */}
              <defs>
                <linearGradient id="potGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>
                <linearGradient id="soilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#5c3a21" />
                  <stop offset="100%" stopColor="#382314" />
                </linearGradient>
                <linearGradient id="stemGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#15803d" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
                <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#16a34a" />
                </linearGradient>
                <linearGradient id="flowerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
              </defs>

              {/* Pot Shadow */}
              <ellipse cx="100" cy="188" rx="46" ry="7" fill="#00000015" />

              {/* Terracotta Pot */}
              <g id="pot-group">
                <polygon points="68,142 132,142 125,182 75,182" fill="url(#potGrad)" />
                <rect x="64" y="136" width="72" height="8" rx="3" fill="#b45309" stroke="#78350f" strokeWidth="1" />
                {/* Pot geometric rangoli band accent */}
                <path d="M 72 152 Q 80 156 88 152 Q 96 156 104 152 Q 112 156 120 152 Q 128 156 130 152" fill="none" stroke="#fde68a" strokeWidth="1.5" opacity="0.8" />
              </g>

              {/* Soil Mound */}
              <path
                d="M 66 138 C 76 130, 124 130, 134 138 Z"
                fill="url(#soilGrad)"
              />

              {/* STAGE 0: Golden Seed with pulsing roots */}
              <AnimatePresence>
                {activeStage === 0 && (
                  <motion.g
                    key="seed-stage"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    {/* Seed Root Tendrils */}
                    <path d="M 100 134 Q 96 142 92 148" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
                    <path d="M 100 134 Q 104 144 108 149" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
                    {/* Seed Shell */}
                    <ellipse cx="100" cy="133" rx="7" ry="9" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
                    <path d="M 99 126 Q 101 133 99 140" fill="none" stroke="#fef3c7" strokeWidth="1.5" />
                    {/* Tiny initial green tip */}
                    <circle cx="100" cy="125" r="2.5" fill="#4ade80" />
                  </motion.g>
                )}
              </AnimatePresence>

              {/* STAGE 1, 2, 3: Growing Living Plant Stem & Foliage */}
              {activeStage >= 1 && (
                <motion.g
                  key="living-plant"
                  initial={{ scaleY: 0.2, opacity: 0 }}
                  animate={{
                    scaleY: 1,
                    opacity: 1,
                    rotate: activeStage === 3 ? [-1, 1, -1] : [-1.5, 1.5, -1.5],
                  }}
                  transition={{
                    scaleY: { type: 'spring', damping: 14, stiffness: 90 },
                    rotate: { repeat: Infinity, duration: 4, ease: 'easeInOut' },
                  }}
                  style={{ transformOrigin: '100px 135px' }}
                >
                  {/* Stem */}
                  <motion.path
                    d={
                      activeStage === 1
                        ? 'M 100 135 Q 98 115 100 96'
                        : activeStage === 2
                        ? 'M 100 135 Q 96 105 100 75'
                        : 'M 100 135 Q 95 100 100 60'
                    }
                    fill="none"
                    stroke="url(#stemGrad)"
                    strokeWidth={activeStage === 3 ? 5 : activeStage === 2 ? 4.5 : 3.5}
                    strokeLinecap="round"
                    transition={{ duration: 0.5 }}
                  />

                  {/* Primary Leaves - Left & Right (Stage 1+) */}
                  <motion.g
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}
                    style={{ transformOrigin: '100px 110px' }}
                  >
                    {/* Left Leaf */}
                    <path
                      d={
                        activeStage === 1
                          ? 'M 99 110 C 82 106, 75 118, 88 122 C 95 120, 98 113, 99 110 Z'
                          : 'M 98 108 C 76 102, 66 118, 82 124 C 92 121, 96 112, 98 108 Z'
                      }
                      fill="url(#leafGrad)"
                      stroke="#15803d"
                      strokeWidth="1"
                    />
                    {/* Leaf Vein */}
                    <path d="M 98 110 Q 86 114 78 112" fill="none" stroke="#bbf7d0" strokeWidth="1" />

                    {/* Right Leaf */}
                    <path
                      d={
                        activeStage === 1
                          ? 'M 101 106 C 118 102, 125 114, 112 118 C 105 116, 102 109, 101 106 Z'
                          : 'M 102 104 C 124 98, 134 114, 118 120 C 108 117, 104 108, 102 104 Z'
                      }
                      fill="url(#leafGrad)"
                      stroke="#15803d"
                      strokeWidth="1"
                    />
                    {/* Leaf Vein */}
                    <path d="M 102 106 Q 114 110 122 108" fill="none" stroke="#bbf7d0" strokeWidth="1" />
                  </motion.g>

                  {/* Secondary Upper Leaves (Stage 2 & 3) */}
                  {activeStage >= 2 && (
                    <motion.g
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, type: 'spring', stiffness: 140 }}
                    >
                      {/* Upper Left Leaf */}
                      <path
                        d="M 99 82 C 78 76, 74 90, 88 94 C 95 91, 98 85, 99 82 Z"
                        fill="url(#leafGrad)"
                        stroke="#15803d"
                        strokeWidth="1"
                      />
                      {/* Upper Right Leaf */}
                      <path
                        d="M 101 78 C 122 72, 126 86, 112 90 C 105 87, 102 81, 101 78 Z"
                        fill="url(#leafGrad)"
                        stroke="#15803d"
                        strokeWidth="1"
                      />
                      {/* Glistening Dew Drops */}
                      <circle cx="82" cy="84" r="2" fill="#e0f2fe" opacity="0.9" />
                      <circle cx="118" cy="80" r="1.8" fill="#e0f2fe" opacity="0.9" />
                    </motion.g>
                  )}

                  {/* STAGE 3: Vibrant Blooming Golden Flower Head */}
                  {activeStage === 3 && (
                    <motion.g
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.2, type: 'spring', damping: 10, stiffness: 100 }}
                      style={{ transformOrigin: '100px 58px' }}
                    >
                      {/* Radiating Petals (8 radial petals) */}
                      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => (
                        <motion.ellipse
                          key={idx}
                          cx="100"
                          cy="40"
                          rx="6.5"
                          ry="13"
                          fill="url(#flowerGrad)"
                          stroke="#c2410c"
                          strokeWidth="0.8"
                          transform={`rotate(${angle} 100 58)`}
                          animate={{
                            scale: [1, 1.06, 1],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2.5,
                            delay: idx * 0.1,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}

                      {/* Golden Core Center / Pistil */}
                      <circle cx="100" cy="58" r="9" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
                      <circle cx="100" cy="58" r="6" fill="#fef08a" />
                      <circle cx="98" cy="56" r="1.5" fill="#ffffff" />

                      {/* Center Pollen Dots */}
                      <circle cx="98" cy="60" r="1" fill="#b45309" />
                      <circle cx="102" cy="59" r="1" fill="#b45309" />
                      <circle cx="100" cy="56" r="1" fill="#b45309" />
                    </motion.g>
                  )}
                </motion.g>
              )}
            </svg>
          </div>

          <p className="text-[11px] font-bold text-stone-500 mt-1 text-center">
            {activeStage === 3
              ? '✨ Knowledge Tree in Full Bloom!'
              : activeStage === 2
              ? '🌿 Buds forming with every chapter read!'
              : activeStage === 1
              ? '🌱 Sprout growing stronger each day!'
              : '🌰 Seed is ready to sprout today!'}
          </p>
        </div>

        {/* Right Side: Reading Goal Milestones & Progress Pathway */}
        <div className="lg:col-span-7 space-y-4">
          {/* Progress Bar & Stage Indicator */}
          <div className="bg-white/80 backdrop-blur-xs rounded-2xl border border-emerald-200/70 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-black text-stone-800">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Today's Reading Progress</span>
              </span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {Math.round((activeStage / 3) * 100)}% Grown
              </span>
            </div>

            {/* Custom Multi-Segment Growth Progress Bar */}
            <div className="relative w-full h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(activeStage / 3) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  activeStage === 3
                    ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500 shadow-[0_0_10px_#f59e0b]'
                    : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                }`}
              />
            </div>

            {/* Stage Steps Grid */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {stageDetails.map((stg) => {
                const isCurrent = activeStage === stg.level;
                const isPassed = activeStage >= stg.level;
                return (
                  <button
                    key={stg.level}
                    type="button"
                    onClick={() => {
                      soundEffects.playWordPop();
                      setIsManualStageOverride(true);
                      setActiveStage(stg.level);
                    }}
                    className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-500 text-white border-emerald-600 font-black shadow-2xs scale-[1.02]'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200 font-bold'
                        : 'bg-stone-50 text-stone-400 border-stone-200'
                    }`}
                  >
                    <div className="text-sm">{stg.icon}</div>
                    <div className="text-[10px] truncate leading-tight mt-0.5">
                      {stg.name.split(' ')[0]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inspirational Cultural Reading Quote */}
          <div className="bg-amber-500/10 rounded-2xl border border-amber-300/60 p-3.5 flex items-start gap-3">
            <div className="text-lg p-1 bg-amber-400/20 rounded-lg text-amber-800">
              📖
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-black text-stone-900">
                “పఠనం మనసుకు ఎరువు, జ్ఞానానికి వెలుగు”
              </h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Reading daily feeds the mind just like water nourishes a young seedling. Complete your daily reading to earn bonus stars!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Goal Completed Celebration Toast / Modal Banner */}
      <AnimatePresence>
        {showCelebrationBanner && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="mt-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-stone-950 rounded-2xl p-4 sm:p-5 shadow-lg border border-amber-300 relative z-20"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-center sm:text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/90 flex items-center justify-center text-2xl shadow-inner shrink-0">
                  🌸
                </div>
                <div>
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="bg-stone-950 text-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                      Daily Goal Achieved
                    </span>
                    <span className="text-xs font-black text-white flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-200 text-amber-200" /> +25 Star Bonus!
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white mt-0.5">
                    లక్ష్యం సాధించబడింది! (Reading Goal Completed!)
                  </h3>
                  <p className="text-xs text-amber-100 font-medium">
                    Awesome job, {student.name}! Your daily reading plant has blossomed into a glorious flower of knowledge!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playStarChime();
                    setShowCelebrationBanner(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-950 hover:bg-stone-900 text-white font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  Collect Reward ✨
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
