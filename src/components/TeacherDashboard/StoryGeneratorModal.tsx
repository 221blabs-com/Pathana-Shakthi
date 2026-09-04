import React, { useState } from 'react';
import { motion } from 'motion/react';
import { TextbookAnalysis, Story, Language, GradeLevel, Difficulty } from '../../types';
import { soundEffects } from '../../services/soundEffects';
import {
  Sparkles,
  BookOpen,
  Loader2,
  CheckCircle2,
  X,
  Volume2,
  Check,
  Languages,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';

interface StoryGeneratorModalProps {
  analysis: TextbookAnalysis;
  onClose: () => void;
  onStorySaved: (story: Story) => void;
}

export const StoryGeneratorModal: React.FC<StoryGeneratorModalProps> = ({
  analysis,
  onClose,
  onStorySaved,
}) => {
  const [targetLanguage, setTargetLanguage] = useState<Language>(
    analysis.primaryLanguage === 'Bilingual' ? 'Telugu' : (analysis.primaryLanguage as Language) || 'Telugu'
  );
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [storyType, setStoryType] = useState('Moral & Adventure');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<Story | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    soundEffects.playPageTurn();

    try {
      const res = await fetch('/api/stories/generate-from-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterTitle: analysis.chapterTitle,
          subject: analysis.subject,
          grade: analysis.grade,
          summary: analysis.summary,
          targetLanguage,
          difficulty,
          storyType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate story from summary.');
      }

      const rawStory = data.story;
      const completeStory: Story = {
        id: `story_gen_${Date.now()}`,
        title: rawStory.title || analysis.chapterTitle,
        titleEnglish: rawStory.titleEnglish || analysis.chapterTitle,
        language: targetLanguage,
        gradeLevel: (analysis.grade as GradeLevel) || 'Class 2',
        difficulty,
        category: analysis.subject || 'Textbook Story',
        coverEmoji: targetLanguage === 'Telugu' ? '🦚' : targetLanguage === 'Hindi' ? '🦁' : '🌟',
        coverColor: 'from-amber-500 to-orange-600',
        coverIllustrationPrompt: rawStory.coverIllustrationPrompt || analysis.summary,
        moralOrTakeaway: rawStory.moralOrTakeaway || 'Learning from our textbook concept.',
        pages: rawStory.pages || [],
        spotlightWords: rawStory.spotlightWords || [],
        comprehensionQuiz: rawStory.comprehensionQuiz || [],
        isDownloadedOffline: true,
        isCustomGenerated: true,
        sourceChapter: `${analysis.chapterNumber || ''} ${analysis.chapterTitle}`,
        createdDate: new Date().toISOString(),
      };

      setGeneratedStory(completeStory);
      soundEffects.playVictoryFanfare();
    } catch (err: any) {
      console.warn('Story generation error:', err);
      setErrorMsg(err.message || 'Generation failed. Using offline template generator.');
      // Fallback local story construction
      const fallbackStory: Story = {
        id: `story_fallback_${Date.now()}`,
        title: targetLanguage === 'Telugu' ? `కథ: ${analysis.chapterTitle}` : targetLanguage === 'Hindi' ? `कहानी: ${analysis.chapterTitle}` : `Story of ${analysis.chapterTitle}`,
        titleEnglish: `Story of ${analysis.chapterTitle}`,
        language: targetLanguage,
        gradeLevel: (analysis.grade as GradeLevel) || 'Class 2',
        difficulty,
        category: analysis.subject || 'Textbook Reading',
        coverEmoji: '📖',
        coverColor: 'from-emerald-500 to-teal-700',
        coverIllustrationPrompt: analysis.summary,
        moralOrTakeaway: 'Understanding nature and knowledge through stories.',
        pages: [
          {
            pageNumber: 1,
            text: targetLanguage === 'Telugu' ? `మా బడిలో ఉపాధ్యాయులు ${analysis.chapterTitle} గురించి చెప్పారు.` : targetLanguage === 'Hindi' ? `हमारे स्कूल में शिक्षक ने ${analysis.chapterTitle} के बारे में बताया।` : `In our school, teacher explained about ${analysis.chapterTitle}.`,
            englishTranslation: `In our school, the teacher explained about ${analysis.chapterTitle}.`,
            transliteration: `Maa badilo upadhyaayulu chepparu.`,
            illustrationPrompt: 'Children reading books in a village primary classroom.',
          },
          {
            pageNumber: 2,
            text: targetLanguage === 'Telugu' ? `పిల్లలందరూ ఎంతో ఆసక్తిగా ఈ కథను నేర్చుకున్నారు.` : targetLanguage === 'Hindi' ? `सभी बच्चों ने बहुत ध्यान से इस कहानी को समझा।` : `All children enthusiastically learned the story together.`,
            englishTranslation: `All children enthusiastically learned the story together.`,
            transliteration: `Pillalandaroo aasaktigaa nerchukunnaru.`,
            illustrationPrompt: 'Happy primary students smiling together with books.',
          }
        ],
        spotlightWords: [
          { word: 'బడి', meaning: 'School', pronunciation: 'Ba-di', example: 'మా బడి చాలా బాగుంటుంది.' }
        ],
        comprehensionQuiz: [
          {
            question: 'ఈ కథ దేని గురించి?',
            questionEnglish: 'What is this story about?',
            options: [analysis.chapterTitle, 'ఆటలు', 'నిద్ర', 'సినిమా'],
            correctOptionIndex: 0,
            explanation: 'ఈ కథ పాఠ్యాంశానికి సంబంధించింది.',
          }
        ],
        isDownloadedOffline: true,
        isCustomGenerated: true,
        sourceChapter: analysis.chapterTitle,
        createdDate: new Date().toISOString(),
      };
      setGeneratedStory(fallbackStory);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAndAdd = () => {
    if (!generatedStory) return;
    soundEffects.playStarChime();
    onStorySaved(generatedStory);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2d2d2d]/50 backdrop-blur-xs flex items-center justify-center p-4 select-none overflow-y-auto font-sans" id="story-generator-modal">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-xl border border-[#e8e4d8] relative my-auto max-h-[90vh] flex flex-col justify-between overflow-y-auto"
        id="story-generator-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0ece1] pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#fff8e6] text-amber-900 rounded-2xl border border-[#fae2a0]">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#2d2d2d]">
                AI Story Builder from Chapter Summary
              </h2>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Transform curriculum concepts into decodable Read-Along stories
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-600 rounded-full transition-all border border-[#e5e1d5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Generator Controls */}
        {!generatedStory ? (
          <div className="space-y-4">
            {/* Source Chapter Info */}
            <div className="p-4 bg-[#fff8e6] border border-[#fae2a0] rounded-3xl">
              <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block">Source Chapter</span>
              <p className="text-sm font-black text-[#2d2d2d] mt-0.5">{analysis.chapterTitle}</p>
              <p className="text-xs text-stone-600 mt-1 line-clamp-2">{analysis.summary}</p>
            </div>

            {/* Target Language Selection */}
            <div>
              <label className="text-xs font-black text-stone-700 uppercase tracking-wider block mb-2">
                Target Story Language:
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['Telugu', 'Hindi', 'English'] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setTargetLanguage(lang)}
                    className={`p-3 rounded-2xl border font-bold text-xs sm:text-sm flex flex-col items-center gap-1 transition-all ${
                      targetLanguage === lang
                        ? 'bg-[#2d2d2d] text-white border-black shadow-xs'
                        : 'bg-[#fbf9f4] hover:bg-[#fff8e6] text-[#2d2d2d] border-[#e8e4d8]'
                    }`}
                  >
                    <span className="font-black">{lang === 'Telugu' ? 'తెలుగు' : lang === 'Hindi' ? 'हिन्दी' : 'English'}</span>
                    <span className="text-[10px] opacity-70">{lang}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Level */}
            <div>
              <label className="text-xs font-black text-stone-700 uppercase tracking-wider block mb-2">
                Reading Level / Difficulty:
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['Easy', 'Medium', 'Challenging'] as Difficulty[]).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`p-2.5 rounded-2xl border font-black text-xs transition-all ${
                      difficulty === diff
                        ? 'bg-[#2d2d2d] text-white border-black shadow-xs'
                        : 'bg-[#fbf9f4] hover:bg-[#fff8e6] text-[#2d2d2d] border-[#e8e4d8]'
                    }`}
                  >
                    {diff} ({diff === 'Easy' ? 'Class 1-2' : diff === 'Medium' ? 'Class 3' : 'Class 4-5'})
                  </button>
                ))}
              </div>
            </div>

            {/* Narrative Theme */}
            <div>
              <label className="text-xs font-black text-stone-700 uppercase tracking-wider block mb-2">
                Narrative Theme:
              </label>
              <select
                value={storyType}
                onChange={(e) => setStoryType(e.target.value)}
                className="w-full p-3 bg-[#fbf9f4] border border-[#e8e4d8] rounded-2xl text-xs font-bold text-[#2d2d2d] focus:border-[#2d2d2d] outline-none"
              >
                <option value="Moral & Adventure">Moral & Adventure (Panchatantra Style)</option>
                <option value="Village Life & Friends">Village Life & Friends (Rural Classroom)</option>
                <option value="Science Discovery">Science & Nature Discovery</option>
                <option value="Folk Tale & Riddle">Folk Tale & Riddle</option>
              </select>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Generate Action Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-[#2d2d2d] hover:bg-black disabled:opacity-50 text-white font-black py-3.5 rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Gemini Building Multilingual Storybook...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Generate Illustrated Read-Along Story</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Preview Generated Story */
          <div className="space-y-4" id="story-preview-screen">
            <div className="flex items-center justify-between bg-[#edf9f2] border border-[#c4ebd1] p-3.5 rounded-2xl">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-black text-emerald-950">
                  Story Successfully Created ({generatedStory.pages.length} Pages)!
                </span>
              </div>
              <span className="text-[11px] font-black bg-[#fff8e6] text-amber-950 px-2.5 py-0.5 rounded-lg border border-[#fae2a0]">
                {generatedStory.language}
              </span>
            </div>

            {/* Story Title Card */}
            <div className="p-4 bg-[#fbf9f4] rounded-2xl border border-[#e8e4d8]">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{generatedStory.coverEmoji}</span>
                <div>
                  <h3 className="text-lg font-black text-[#2d2d2d]">{generatedStory.title}</h3>
                  <p className="text-xs text-stone-500 font-medium">{generatedStory.titleEnglish}</p>
                </div>
              </div>
            </div>

            {/* Page Previews */}
            <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1">
              {generatedStory.pages.map((p, idx) => (
                <div key={idx} className="p-3.5 bg-[#f8f6f0] border border-[#e8e4d8] rounded-2xl text-xs">
                  <div className="flex items-center justify-between text-amber-800 font-black mb-1">
                    <span>Page {p.pageNumber}</span>
                  </div>
                  <p className="font-black text-[#2d2d2d] text-sm">{p.text}</p>
                  {p.transliteration && (
                    <p className="text-stone-500 italic mt-0.5">({p.transliteration})</p>
                  )}
                </div>
              ))}
            </div>

            {/* Action to Save to School Library */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#f0ece1]">
              <button
                onClick={() => setGeneratedStory(null)}
                className="text-xs font-bold text-stone-500 hover:text-stone-800"
              >
                ← Edit & Regenerate
              </button>

              <button
                onClick={handleSaveAndAdd}
                id="btn-save-to-library"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-xs transition-all flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Save to Rural School Library 📚</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
