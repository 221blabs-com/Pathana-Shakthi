import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Student, Badge } from '../types';
import { DEFAULT_BADGES, offlineStorage } from '../services/offlineStorage';
import { soundEffects } from '../services/soundEffects';
import confetti from 'canvas-confetti';
import { Star, Flame, Trophy, Award, Sparkles, X, Check, FileCheck, Crown } from 'lucide-react';

interface RewardChestModalProps {
  isOpen?: boolean;
  student: Student;
  stats?: {
    durationSeconds?: number;
    wordsRead?: number;
    accuracy?: number;
    wpm?: number;
    starsEarned?: number;
    storyTitle?: string;
  } | null;
  lastSessionStats?: {
    durationSeconds?: number;
    wordsRead?: number;
    accuracy?: number;
    wpm?: number;
    starsEarned?: number;
    storyTitle?: string;
  } | null;
  onClose: () => void;
  onOpenCertificate?: () => void;
  onOpenCertificates?: () => void;
}

const ACCESSORIES: { id: Student['mascotAccessory']; name: string; icon: string; cost: number }[] = [
  { id: 'none', name: 'Original', icon: '😊', cost: 0 },
  { id: 'scholar_cap', name: 'Scholar Cap', icon: '🎓', cost: 30 },
  { id: 'star_crown', name: 'Star Crown', icon: '👑', cost: 60 },
  { id: 'glasses', name: 'Smart Glasses', icon: '👓', cost: 45 },
  { id: 'superhero_cape', name: 'Hero Cape', icon: '🦸', cost: 80 },
  { id: 'golden_wand', name: 'Star Wand', icon: '🪄', cost: 100 },
];

export const RewardChestModal: React.FC<RewardChestModalProps> = ({
  student,
  stats: passedStats,
  lastSessionStats,
  onClose,
  onOpenCertificate,
  onOpenCertificates,
}) => {
  const stats = passedStats || lastSessionStats || {
    starsEarned: 15,
    accuracy: 94,
    wpm: 42,
    storyTitle: 'BoloRead Story Adventure',
  };

  const handleCert = onOpenCertificate || onOpenCertificates || (() => {});
  const [currentAccessory, setCurrentAccessory] = useState(student.mascotAccessory || 'none');
  const [availableStars, setAvailableStars] = useState(student.stars);

  const handleEquipAccessory = (accId: Student['mascotAccessory'], cost: number) => {
    if (currentAccessory === accId) return;

    soundEffects.playStarChime();
    soundEffects.playConfettiPop();
    setCurrentAccessory(accId);
    offlineStorage.updateCurrentStudent({ mascotAccessory: accId });
    confetti({
      particleCount: 55,
      spread: 65,
      origin: { y: 0.65 },
      colors: ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#3b82f6'],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2d2d2d]/50 backdrop-blur-xs flex items-center justify-center p-4 select-none overflow-y-auto font-sans" id="reward-chest-modal">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-xl border border-[#e8e4d8] relative overflow-hidden my-auto"
        id="reward-chest-card"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          id="btn-close-rewards"
          className="absolute top-4 right-4 p-2 bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-600 rounded-full transition-all border border-[#e5e1d5]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Celebration Header */}
        <div className="text-center pt-2">
          <div className="text-4xl mb-2">🎁 🌟 🏆</div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#2d2d2d]">Story Mastered!</h2>
          <p className="text-xs sm:text-sm text-stone-500 font-medium mt-0.5">"{stats.storyTitle}"</p>
        </div>

        {/* Reading Metrics Bento Grid */}
        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-[#fff8e6] border border-[#fae2a0] p-3 rounded-2xl text-center">
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">Stars</span>
            <div className="flex items-center justify-center gap-1 mt-0.5 text-amber-950 font-black text-lg">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span>+{stats.starsEarned}</span>
            </div>
          </div>

          <div className="bg-[#edf9f2] border border-[#c4ebd1] p-3 rounded-2xl text-center">
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Accuracy</span>
            <div className="text-emerald-950 font-black text-lg mt-0.5">
              {stats.accuracy}%
            </div>
          </div>

          <div className="bg-[#fff1ec] border border-[#ffd2c4] p-3 rounded-2xl text-center">
            <span className="text-[10px] font-black text-orange-800 uppercase tracking-wider block">Speed</span>
            <div className="text-orange-950 font-black text-lg mt-0.5">
              {stats.wpm} <span className="text-xs font-normal">WPM</span>
            </div>
          </div>
        </div>

        {/* Mascot Dress Up Wardrobe Bento Tile */}
        <div className="bg-[#fcfaf4] p-4.5 rounded-3xl border border-[#e8e4d8] my-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 font-black text-xs text-[#2d2d2d]">
              <Crown className="w-4 h-4 text-amber-600" />
              <span>Dress Up Shakthi Mitra</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-amber-800 bg-[#fff8e6] px-2.5 py-0.5 rounded-lg border border-[#fae2a0]">
              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
              <span>{availableStars} Stars</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {ACCESSORIES.map((acc) => {
              const isEquipped = currentAccessory === acc.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => handleEquipAccessory(acc.id, acc.cost)}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all text-xs ${
                    isEquipped
                      ? 'bg-amber-300 border-amber-500 text-amber-950 font-black shadow-xs ring-2 ring-amber-400'
                      : 'bg-white hover:bg-[#fff8e6] border-[#e8e4d8] text-[#2d2d2d]'
                  }`}
                >
                  <span className="text-xl">{acc.icon}</span>
                  <span className="font-bold truncate text-[11px]">{acc.name}</span>
                  {isEquipped && (
                    <span className="text-[9px] bg-amber-950 text-white px-2 py-0.2 rounded-full font-black">
                      Equipped
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 mt-4">
          <button
            onClick={() => {
              soundEffects.playStarChime();
              handleCert();
            }}
            id="btn-view-certificate"
            className="w-full bg-[#eff6ff] hover:bg-[#dbeafe] text-blue-900 font-black text-xs sm:text-sm py-3.5 rounded-2xl border border-[#bfdbfe] shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileCheck className="w-4 h-4 text-blue-700" />
            <span>View & Print Reading Certificate 📜</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playPageTurn();
              onClose();
            }}
            id="btn-continue-library"
            className="w-full bg-[#2d2d2d] hover:bg-black text-white font-black text-xs sm:text-sm py-3.5 rounded-2xl shadow-xs transition-all cursor-pointer"
          >
            Back to Story Library 📚
          </button>
        </div>
      </motion.div>
    </div>
  );
};
