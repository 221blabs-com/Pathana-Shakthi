import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { kidSpeech } from '../services/speechSynthesis';

interface VoiceWaveformVisualizerProps {
  isActive: boolean;
  colorScheme?: 'amber' | 'emerald' | 'purple' | 'blue';
  barCount?: number;
  height?: number; // max height in px
  showDecibelGlow?: boolean;
}

export const VoiceWaveformVisualizer: React.FC<VoiceWaveformVisualizerProps> = ({
  isActive,
  colorScheme = 'amber',
  barCount = 12,
  height = 36,
  showDecibelGlow = true,
}) => {
  const [levels, setLevels] = useState<number[]>(() =>
    Array(barCount).fill(0.15)
  );

  useEffect(() => {
    if (!isActive) {
      setLevels(Array(barCount).fill(0.15));
      return;
    }

    let animationFrameId: number;

    const updateAudioMeters = () => {
      const liveLevel = kidSpeech.getLiveAudioLevel();
      // Generate pleasing dynamic wave pattern around the live audio level
      const now = Date.now() / 150;

      const newLevels = Array.from({ length: barCount }, (_, i) => {
        const wave = Math.sin(now + i * 0.6) * 0.35 + 0.5;
        const randomness = Math.random() * 0.2;
        const level = Math.max(
          0.15,
          Math.min(1.0, (liveLevel > 0.05 ? liveLevel * 1.5 : wave) + randomness)
        );
        return level;
      });

      setLevels(newLevels);
      animationFrameId = requestAnimationFrame(updateAudioMeters);
    };

    animationFrameId = requestAnimationFrame(updateAudioMeters);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, barCount]);

  const colorClasses = {
    amber: {
      bar: 'bg-gradient-to-t from-amber-500 to-amber-300',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    },
    emerald: {
      bar: 'bg-gradient-to-t from-emerald-600 to-teal-400',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.5)]',
    },
    purple: {
      bar: 'bg-gradient-to-t from-purple-600 to-indigo-400',
      glow: 'shadow-[0_0_12px_rgba(147,51,234,0.5)]',
    },
    blue: {
      bar: 'bg-gradient-to-t from-blue-600 to-sky-400',
      glow: 'shadow-[0_0_12px_rgba(59,130,246,0.5)]',
    },
  }[colorScheme];

  return (
    <div
      className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 select-none"
      id="voice-waveform-container"
      style={{ height: `${height}px` }}
    >
      {levels.map((level, i) => {
        const barHeight = Math.max(6, Math.round(level * height));
        return (
          <motion.div
            key={i}
            animate={{
              height: isActive ? `${barHeight}px` : '6px',
              opacity: isActive ? 1 : 0.4,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
            }}
            className={`w-1 sm:w-1.5 rounded-full ${colorClasses.bar} ${
              isActive && showDecibelGlow ? colorClasses.glow : ''
            }`}
          />
        );
      })}
    </div>
  );
};
