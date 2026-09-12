import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, ReadingSessionLog, Language } from '../types';
import {
  aggregateClassroomPhonicsStruggles,
  analyzeWordPhonics,
  PhonicsClusterCategory,
  PhonicsClusterInfo,
  StruggledWordAnalysis,
  LanguagePhonicsSummary,
} from '../utils/phonicsCategorizer';
import { kidSpeech } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Volume2,
  AlertTriangle,
  BookOpen,
  Filter,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Zap,
  TrendingDown,
  Info,
  Languages,
  X,
  Play,
  ArrowRight,
  Flame,
  Award,
} from 'lucide-react';

interface WordStruggleVisualizationProps {
  readingLogs: ReadingSessionLog[];
  students?: Student[];
  currentStudent?: Student | null;
  mode?: 'teacher_classroom' | 'student_personal';
  defaultLanguage?: Language | 'All';
  onLaunchTargetedStory?: (language: Language, cluster: string) => void;
}

export const WordStruggleVisualization: React.FC<WordStruggleVisualizationProps> = ({
  readingLogs,
  students = [],
  currentStudent = null,
  mode = 'teacher_classroom',
  defaultLanguage = 'All',
  onLaunchTargetedStory,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language | 'All'>(defaultLanguage);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeDrillWord, setActiveDrillWord] = useState<StruggledWordAnalysis | null>(null);
  const [selectedClusterDetail, setSelectedClusterDetail] = useState<{
    cluster: string;
    category: PhonicsClusterCategory;
    info?: PhonicsClusterInfo;
    words: string[];
    count: number;
  } | null>(null);
  const [masteredWords, setMasteredWords] = useState<Set<string>>(new Set());

  // Filter reading logs if in student mode
  const relevantLogs = currentStudent
    ? readingLogs.filter((log) => log.studentId === currentStudent.id)
    : readingLogs;

  // Aggregate structured phonics struggle data
  const aggregatedData = aggregateClassroomPhonicsStruggles(
    relevantLogs,
    students.map((s) => ({ id: s.id, name: s.name }))
  );

  // Available languages with struggle data
  const languagesList: Language[] = ['Telugu', 'Hindi', 'English'];

  // Calculate totals
  const totalClassStruggles = Object.values(aggregatedData).reduce(
    (acc, curr) => acc + curr.totalStruggles,
    0
  );

  const activeSummary: LanguagePhonicsSummary[] =
    selectedLanguage === 'All'
      ? Object.values(aggregatedData)
      : [aggregatedData[selectedLanguage]];

  // Flattened words for display
  const allFilteredWords: StruggledWordAnalysis[] = [];
  activeSummary.forEach((sum) => {
    sum.topStruggledWords.forEach((wordObj) => {
      if (selectedCategory === 'all' || wordObj.primaryCategory === selectedCategory) {
        allFilteredWords.push(wordObj);
      }
    });
  });

  // Handle word pronunciation audio
  const handlePlayWordAudio = (word: string, lang: Language) => {
    soundEffects.playWordPop();
    kidSpeech.speakSlowWord(word, lang);
  };

  // Mark word as mastered in practice drill
  const handleMarkMastered = (word: string) => {
    soundEffects.playCorrect();
    setMasteredWords((prev) => new Set(prev).add(word));
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#10b981', '#f59e0b', '#6366f1'],
    });
  };

  return (
    <div
      className="bg-white rounded-3xl border border-[#e8e4d8] p-5 sm:p-7 shadow-xs font-sans space-y-6"
      id="word-struggle-visualization-root"
    >
      {/* Top Header & Context Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#f0ece1] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Phonics Diagnostic Matrix</span>
            </span>
            <span className="text-xs font-bold text-stone-500">
              {mode === 'student_personal' && currentStudent
                ? `${currentStudent.name}'s Personal Struggle Log`
                : 'Classroom Word & Cluster Difficulty Map'}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-[#2d2d2d] flex items-center gap-2">
            <span>Multilingual Phonics & Word Struggle Analysis</span>
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 max-w-3xl leading-relaxed">
            Detailed breakdown of pronunciation hurdles by language. Identifies orthographic hotspots such as{' '}
            <strong className="text-amber-900 font-extrabold">Telugu Conjunct Consonants (ఒత్తులు)</strong>,{' '}
            <strong className="text-orange-900 font-extrabold">Hindi Samyuktakshar (संयुक्ताक्षर)</strong>, and{' '}
            <strong className="text-indigo-900 font-extrabold">English Triple Blends & Silent Letters</strong>.
          </p>
        </div>

        {/* Language Tabs Selector */}
        <div className="flex items-center gap-1 bg-[#f4f1e8] p-1.5 rounded-2xl border border-[#e5e1d5] self-start md:self-auto flex-wrap">
          {(['All', 'Telugu', 'Hindi', 'English'] as (Language | 'All')[]).map((lang) => {
            const isSelected = selectedLanguage === lang;
            const struggleCount =
              lang === 'All'
                ? totalClassStruggles
                : aggregatedData[lang]?.totalStruggles || 0;

            return (
              <button
                key={lang}
                onClick={() => {
                  soundEffects.playWordPop();
                  setSelectedLanguage(lang);
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-white text-stone-900 shadow-xs border border-[#ded9c5]'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
                }`}
              >
                <span>{lang === 'All' ? '🌐 All' : lang === 'Telugu' ? '🦚 Telugu (తెలుగు)' : lang === 'Hindi' ? '🦁 Hindi (हिन्दी)' : '🚀 English'}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                    isSelected ? 'bg-amber-100 text-amber-900' : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {struggleCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Phonics Cluster Highlights by Language */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {languagesList
          .filter((l) => selectedLanguage === 'All' || selectedLanguage === l)
          .map((lang) => {
            const summary = aggregatedData[lang];
            const isTelugu = lang === 'Telugu';
            const isHindi = lang === 'Hindi';

            return (
              <div
                key={lang}
                className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between ${
                  isTelugu
                    ? 'bg-[#fffcf4] border-amber-200/80 shadow-2xs'
                    : isHindi
                    ? 'bg-[#fffaf5] border-orange-200/80 shadow-2xs'
                    : 'bg-[#f7f9ff] border-indigo-200/80 shadow-2xs'
                }`}
              >
                <div>
                  {/* Language Card Header */}
                  <div className="flex items-center justify-between border-b border-black/5 pb-3 mb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {isTelugu ? '🦚' : isHindi ? '🦁' : '🚀'}
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-[#2d2d2d]">
                          {isTelugu ? 'Telugu (తెలుగు వాచకం)' : isHindi ? 'Hindi (हिन्दी रिमझिम)' : 'English Phonics'}
                        </h3>
                        <span className="text-[10px] font-bold text-stone-500">
                          {summary.uniqueWordsCount} unique challenge words recorded
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-amber-900 bg-white px-2 py-0.5 rounded-lg border border-stone-200 shadow-2xs">
                        {summary.totalStruggles} Hesitations
                      </span>
                    </div>
                  </div>

                  {/* Top Hardest Clusters within this language */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                      Hardest Orthographic Clusters:
                    </span>

                    {summary.clusterCategories.length === 0 ? (
                      <div className="p-3 bg-white/80 rounded-2xl text-center text-xs text-stone-500 font-medium">
                        ✨ No significant phonics hesitations in this language yet!
                      </div>
                    ) : (
                      summary.clusterCategories.slice(0, 3).map((cat, idx) => (
                        <div
                          key={cat.category}
                          className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-black text-[#2d2d2d] block">
                                {cat.name}
                              </span>
                              <span className="text-[10px] text-stone-500 font-bold">
                                {cat.nameNative}
                              </span>
                            </div>
                            <span className="text-[11px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                              {cat.count} occurrences ({cat.percentage}%)
                            </span>
                          </div>

                          {/* Specific sub-cluster pills (e.g. ళ్ల, ట్టి, త్ర్య, str, क्ष) */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {cat.hardestClusters.slice(0, 4).map((cObj) => (
                              <button
                                key={cObj.cluster}
                                onClick={() => {
                                  soundEffects.playWordPop();
                                  setSelectedClusterDetail({
                                    cluster: cObj.cluster,
                                    category: cat.category,
                                    words: cObj.words,
                                    count: cObj.count,
                                  });
                                }}
                                className="px-2 py-1 rounded-xl bg-[#f8f6f0] hover:bg-amber-100 border border-[#e8e4d8] text-xs font-black text-stone-800 transition-all flex items-center gap-1 cursor-pointer group"
                              >
                                <span className="text-amber-900 group-hover:scale-110 transition-transform">
                                  {cObj.cluster}
                                </span>
                                <span className="text-[9px] bg-stone-200 group-hover:bg-amber-200 px-1 rounded font-bold text-stone-600">
                                  ×{cObj.count}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Remediation prompt button */}
                <div className="pt-3 mt-3 border-t border-black/5">
                  <button
                    onClick={() => {
                      soundEffects.playWordPop();
                      setSelectedLanguage(lang);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>View All {lang} Challenge Words</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Cluster Detail Drill-Down Modal / Banner */}
      <AnimatePresence>
        {selectedClusterDetail && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-300 rounded-3xl shadow-xs relative"
          >
            <button
              onClick={() => setSelectedClusterDetail(null)}
              className="absolute top-4 right-4 p-1.5 bg-white/80 hover:bg-white text-stone-600 rounded-full border border-stone-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-amber-950 bg-white px-3 py-1 rounded-2xl border border-amber-300 shadow-2xs">
                    Cluster Spotlight: "{selectedClusterDetail.cluster}"
                  </span>
                  <span className="text-xs font-black text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-xl">
                    {selectedClusterDetail.count} Total Student Hesitations
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-stone-700 font-medium">
                  Occurs in words:{' '}
                  <span className="font-extrabold text-stone-900">
                    {selectedClusterDetail.words.join(', ')}
                  </span>
                </p>
              </div>

              {/* Action */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const firstW = selectedClusterDetail.words[0];
                    if (firstW) {
                      const analysis = analyzeWordPhonics(firstW, selectedLanguage === 'All' ? 'Telugu' : selectedLanguage);
                      setActiveDrillWord(analysis);
                      handlePlayWordAudio(firstW, analysis.language);
                    }
                  }}
                  className="px-4 py-2 bg-[#2d2d2d] hover:bg-black text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Practice Drill</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Individual Struggled Words Roster */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0ece1] pb-3">
          <div>
            <h3 className="text-base font-black text-[#2d2d2d] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span>
                Identified Challenge Words ({allFilteredWords.length})
              </span>
            </h3>
            <p className="text-xs text-stone-500 font-medium">
              Click audio to hear native phonetic articulation or click a word to launch an interactive practice drill.
            </p>
          </div>

          {/* Quick Filter by Category */}
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-stone-400 text-[11px] uppercase tracking-wider">Filter Cluster:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#f4f1e8] border border-[#e5e1d5] rounded-xl px-2.5 py-1 text-xs font-bold text-stone-800 outline-none"
            >
              <option value="all">All Phonics Categories</option>
              <option value="telugu_conjunct_ottu">Telugu Conjuncts (ఒత్తులు)</option>
              <option value="telugu_mahaprana_aspirated">Telugu Aspirated (మహా ప్రాణాలు)</option>
              <option value="telugu_gunintham_vowel">Telugu Vowel Elongation</option>
              <option value="hindi_samyuktakshar">Hindi Samyuktakshar (संयुक्ताक्षर)</option>
              <option value="hindi_matra_nasal">Hindi Matras & Anusvara</option>
              <option value="english_complex_blend">English Triple Blends</option>
              <option value="english_digraph_diphthong">English Digraphs</option>
              <option value="english_silent_letter">English Silent Letters</option>
            </select>
          </div>
        </div>

        {/* Word Cards Grid */}
        {allFilteredWords.length === 0 ? (
          <div className="bg-[#fcfaf4] border border-[#e8e4d8] rounded-3xl p-8 text-center text-stone-500 space-y-2">
            <div className="text-3xl">🎉</div>
            <p className="text-sm font-bold text-stone-700">No word struggles recorded for this category!</p>
            <p className="text-xs text-stone-400">Students are reading these storybooks with high decodable accuracy.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {allFilteredWords.map((wordObj) => {
              const isMastered = masteredWords.has(wordObj.word);
              const primaryCluster = wordObj.detectedClusters[0];

              return (
                <div
                  key={wordObj.word}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                    isMastered
                      ? 'bg-emerald-50/60 border-emerald-300/80 shadow-2xs'
                      : 'bg-white hover:bg-[#fffdfa] border-[#e8e4d8] shadow-2xs'
                  }`}
                >
                  <div>
                    {/* Top word title & audio button */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-black text-[#2d2d2d]">
                            {wordObj.word}
                          </h4>
                          {isMastered && (
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Mastered</span>
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-amber-800 font-bold block">
                          {wordObj.primaryCategoryName}
                        </span>
                      </div>

                      {/* Pronounce Button */}
                      <button
                        onClick={() => handlePlayWordAudio(wordObj.word, wordObj.language)}
                        title={`Listen to ${wordObj.word}`}
                        className="p-2 bg-[#fff8e6] hover:bg-amber-200 text-amber-900 rounded-xl border border-[#fae2a0] transition-all cursor-pointer shadow-2xs flex-shrink-0"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Detected Cluster Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 my-2">
                      {wordObj.detectedClusters.map((cl, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 bg-[#f4f1e8] text-stone-800 rounded-lg text-[10px] font-black border border-[#e5e1d5]"
                        >
                          Focus: <strong className="text-amber-900">{cl.cluster}</strong>
                        </span>
                      ))}
                    </div>

                    {/* Teaching Tip / Clue */}
                    {primaryCluster && (
                      <p className="text-[11px] text-stone-600 bg-stone-50 p-2 rounded-xl border border-stone-200/60 leading-relaxed my-2">
                        💡 <strong className="text-stone-800 font-bold">Phonics Tip:</strong> {primaryCluster.teachingTip}
                      </p>
                    )}
                  </div>

                  {/* Bottom Footer & Students List */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] mt-2">
                    <span className="text-stone-500 font-medium">
                      {wordObj.attemptsCount} hesitations recorded
                      {wordObj.studentsList && wordObj.studentsList.length > 0 && (
                        <span className="block text-[10px] text-stone-400 font-bold">
                          Students: {wordObj.studentsList.slice(0, 2).join(', ')}
                          {wordObj.studentsList.length > 2 ? ` +${wordObj.studentsList.length - 2}` : ''}
                        </span>
                      )}
                    </span>

                    <button
                      onClick={() => {
                        setActiveDrillWord(wordObj);
                        handlePlayWordAudio(wordObj.word, wordObj.language);
                      }}
                      className="text-amber-800 hover:text-amber-950 font-black text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>Drill</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Flashcard Practice Modal */}
      <AnimatePresence>
        {activeDrillWord && (
          <div className="fixed inset-0 z-50 bg-[#2d2d2d]/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-amber-200 relative overflow-hidden"
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveDrillWord(null)}
                className="absolute top-4 right-4 p-2 bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-600 rounded-full border border-[#e5e1d5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-4">
                <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black uppercase">
                  🎯 Phonics Practice Drill
                </span>

                <div className="p-6 bg-[#fffcf4] border-2 border-amber-200 rounded-3xl shadow-xs space-y-2">
                  <div className="text-3xl sm:text-4xl font-black text-[#2d2d2d] tracking-wide">
                    {activeDrillWord.word}
                  </div>
                  <span className="text-xs font-extrabold text-amber-800 block">
                    {activeDrillWord.primaryCategoryName} ({activeDrillWord.primaryCategoryNameNative})
                  </span>

                  <button
                    onClick={() => handlePlayWordAudio(activeDrillWord.word, activeDrillWord.language)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer mt-2"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Slow Phonics Pronunciation</span>
                  </button>
                </div>

                {/* Phonics Guidance */}
                <div className="text-left bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs space-y-1.5">
                  <span className="font-black text-stone-800 block">Teacher / Student Remediation:</span>
                  <p className="text-stone-600 leading-relaxed">
                    {activeDrillWord.detectedClusters[0]?.teachingTip || 'Pronounce each syllable distinctly and blend smoothly.'}
                  </p>
                  <p className="text-amber-900 font-bold pt-1">
                    {activeDrillWord.detectedClusters[0]?.practiceExample}
                  </p>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    onClick={() => handlePlayWordAudio(activeDrillWord.word, activeDrillWord.language)}
                    className="py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-black text-xs rounded-2xl border border-stone-300 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Repeat Audio</span>
                  </button>

                  <button
                    onClick={() => {
                      handleMarkMastered(activeDrillWord.word);
                      setActiveDrillWord(null);
                    }}
                    className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>I Mastered This! ⭐</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
