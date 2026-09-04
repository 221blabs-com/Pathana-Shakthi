import React, { useState } from 'react';
import {
  Story,
  Student,
  Language,
  GradeLevel,
} from '../../types';
import { StoryCard } from '../StoryCard';
import { MascotBuddy } from '../MascotBuddy';
import { ReadingGrowthSprout } from '../ReadingGrowthSprout';
import { MultilingualSearchBar } from '../MultilingualSearchBar';
import { searchStoriesMultilingual } from '../../utils/multilingualSearch';
import { offlineStorage } from '../../services/offlineStorage';
import { soundEffects } from '../../services/soundEffects';
import {
  Search,
  BookOpen,
  Award,
  Sparkles,
  Layers,
  Flame,
  Star,
  Download,
  Filter,
  CheckCircle2,
  Mic,
} from 'lucide-react';

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

export const StudentLibraryPage: React.FC<StudentLibraryPageProps> = ({
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
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredStories = searchStoriesMultilingual(
    stories,
    searchQuery,
    selectedLanguage,
    selectedGrade
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-16 font-sans">
      {/* Student Welcome Header Banner */}
      <div className="bg-[#2d2d2d] text-white py-6 px-4 sm:px-6 lg:px-8 border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              onClick={onOpenProfile}
              className="w-16 h-16 rounded-3xl bg-amber-500 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-inner cursor-pointer hover:scale-105 transition-transform"
              title="Open Student Profile"
            >
              {student.avatar}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-stone-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  {student.grade} Reader
                </span>
                <span className="text-xs text-stone-400 font-semibold">{student.rollNumber}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                నమస్కారం, {student.name}!
              </h1>
              <p className="text-xs text-stone-300">
                {student.villageSchool} • {student.completedStoryIds.length} Stories Mastered
              </p>
            </div>
          </div>

          {/* Quick Action Badges & Chest */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEffects.playPageTurn();
                onOpenProfile();
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#fff8e6] hover:bg-amber-100 text-amber-950 font-black text-xs shadow-xs transition-all cursor-pointer border border-amber-300"
              id="btn-student-word-struggles"
            >
              <Layers className="w-4 h-4 text-amber-700" />
              <span>Word Struggles 🎯 (పదాల సాధన)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEffects.playPageTurn();
                onOpenVoiceSetup?.();
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs shadow-md transition-all cursor-pointer border border-amber-500/40"
              id="btn-student-voice-setup"
            >
              <Mic className="w-4 h-4 text-amber-900" />
              <span>Voice & Mic Setup (ధ్వని సెటప్)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEffects.playStarChime();
                onOpenRewardChest();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-md transition-all cursor-pointer"
              id="btn-student-reward-chest"
            >
              <Sparkles className="w-4 h-4" />
              <span>Reward Chest ({student.stars} ⭐)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEffects.playStarChime();
                onOpenCertificateModal();
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700 shadow-2xs transition-all cursor-pointer"
              id="btn-student-certificates"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Certificates</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Floating Mascot Buddy Spotlight */}
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300/60 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <MascotBuddy
              mood="happy"
              language={selectedLanguage === 'All' ? 'Telugu' : (selectedLanguage as Language)}
              size="md"
              showVoiceSettings={true}
            />
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-black text-stone-900">
                Ready for Today's Read Along Adventure?
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 max-w-xl">
                Listen to the words, tap any tricky syllables for phonics pronunciation, and earn stars for accurate reading!
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenOfflineModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-xs shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>Offline Download Pack</span>
            </button>
          </div>
        </div>

        {/* Daily Reading Goal Sprouting Plant Animation */}
        <ReadingGrowthSprout
          student={student}
          dailyStoryTarget={2}
          onGoalAchievedReward={(bonusStars) => {
            offlineStorage.updateCurrentStudent({
              stars: (student.stars || 0) + bonusStars,
            });
            if (onRefreshStudent) onRefreshStudent();
          }}
        />

        {/* Multilingual Decodable Search Bar & Filters */}
        <MultilingualSearchBar
          query={searchQuery}
          onQueryChange={(q) => setSearchQuery(q)}
          selectedLanguage={selectedLanguage}
          onSelectLanguage={(lang) => setSelectedLanguage(lang)}
          selectedGrade={selectedGrade}
          onSelectGrade={(grade) => setSelectedGrade(grade)}
          totalResults={filteredStories.length}
          onClear={() => setSearchQuery('')}
        />

        {/* Stories Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span>
                Decodable Storybooks ({filteredStories.length})
              </span>
            </h2>
          </div>

          {filteredStories.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-10 text-center space-y-4">
              <div className="text-5xl">🔍</div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-stone-900">
                  No matching stories found for "{searchQuery}"
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Try searching by character, subject, or language in Telugu (తెలుగు), Hindi (हिन्दी), or English.
                </p>
              </div>

              {/* Helpful One-Tap Suggestions */}
              <div className="pt-2">
                <p className="text-xs font-bold text-stone-600 mb-2">
                  Popular suggestions to try:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
                  {[
                    { label: 'కాకి (Crow)', q: 'కాకి' },
                    { label: 'సింహం (Lion)', q: 'సింహం' },
                    { label: 'कौआ (Crow)', q: 'कौआ' },
                    { label: 'शेर (Lion)', q: 'शेर' },
                    { label: 'बारिश (Rain)', q: 'बारिश' },
                    { label: 'Solar & Light', q: 'Solar' },
                    { label: 'Friendship', q: 'Friendship' },
                    { label: 'Panchatantra', q: 'Panchatantra' },
                  ].map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        soundEffects.playWordPop();
                        setSelectedLanguage('All');
                        setSelectedGrade('All');
                        setSearchQuery(sug.q);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                    >
                      {sug.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playWordPop();
                    setSelectedLanguage('All');
                    setSelectedGrade('All');
                    setSearchQuery('');
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredStories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onSelect={onSelectStory}
                  onSetupAndRead={onOpenVoiceSetup}
                  onToggleOffline={onToggleOffline}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
