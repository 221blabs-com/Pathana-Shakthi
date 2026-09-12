import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ComprehensionQuestion, Story, Language } from '../types';
import { soundEffects } from '../services/soundEffects';
import { kidSpeech } from '../services/speechSynthesis';
import confetti from 'canvas-confetti';
import { CheckCircle2, XCircle, Star, Sparkles, ArrowRight, Trophy, RotateCcw, Lightbulb, HeartHandshake, Check } from 'lucide-react';

interface ComprehensionModalProps {
  story?: Story;
  questions?: ComprehensionQuestion[];
  storyTitle?: string;
  language?: Language;
  isOpen?: boolean;
  onCompleteQuiz?: (score: number) => void;
  onFinishQuiz?: (score: number, total: number) => void;
  onSkip?: () => void;
  onClose?: () => void;
}

export const ComprehensionModal: React.FC<ComprehensionModalProps> = ({
  story,
  questions: passedQuestions,
  storyTitle: passedTitle,
  language: passedLang,
  onCompleteQuiz,
  onFinishQuiz,
  onSkip,
  onClose,
}) => {
  const questions: ComprehensionQuestion[] = passedQuestions || story?.comprehensionQuiz || [];
  const language: Language = passedLang || story?.language || 'Telugu';
  const storyTitle = passedTitle || story?.title || 'Story';

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isWrongAnswer, setIsWrongAnswer] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const currentQuestion = questions[currentQIndex];

  const handleFinish = (score: number) => {
    if (onCompleteQuiz) {
      onCompleteQuiz(score);
    }
    if (onFinishQuiz) {
      onFinishQuiz(score, questions.length);
    }
    if (onClose) {
      onClose();
    }
  };

  if (!questions.length || !currentQuestion) {
    handleFinish(3);
    return null;
  }

  const handleSelectOption = (index: number) => {
    if (isAnswerChecked && !isWrongAnswer) return;
    setSelectedOption(index);
    setIsAnswerChecked(false);
    setIsWrongAnswer(false);
    soundEffects.playWordPop();
  };

  const handleCheckAnswer = () => {
    if (selectedOption === null) return;
    setIsAnswerChecked(true);

    const isCorrect = selectedOption === currentQuestion.correctOptionIndex;
    if (isCorrect) {
      setIsWrongAnswer(false);
      soundEffects.playCorrect();
      setCorrectAnswersCount((prev) => prev + 1);
      kidSpeech.playEncouragement(language);
      confetti({
        particleCount: 65,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'],
      });
    } else {
      setIsWrongAnswer(true);
      soundEffects.playTryAgain();
      kidSpeech.playTryAgainEncouragement(language);
    }
  };

  const handleRetryQuestion = () => {
    setIsAnswerChecked(false);
    setIsWrongAnswer(false);
    setSelectedOption(null);
    setShowHint(true);
    soundEffects.playWordPop();
  };

  const handleNext = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerChecked(false);
      setIsWrongAnswer(false);
      setShowHint(false);
      soundEffects.playPageTurn();
    } else {
      setIsQuizCompleted(true);
      soundEffects.playVictoryFanfare();
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#fbbf24', '#f59e0b', '#10b981', '#6366f1', '#ec4899'],
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2d2d2d]/60 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans" id="comprehension-modal-overlay">
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 15 }}
        animate={{
          scale: 1,
          opacity: 1,
          y: 0,
          x: isWrongAnswer ? [-8, 8, -6, 6, -3, 3, 0] : 0,
        }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border-2 border-[#e8e4d8] relative overflow-hidden"
        id="comprehension-card"
      >
        {/* Background Decorative Glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-100/60 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-100/50 rounded-full blur-3xl -z-10 pointer-events-none" />

        {!isQuizCompleted ? (
          <div>
            {/* Top Badge & Progress */}
            <div className="flex items-center justify-between border-b border-[#f0ece1] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-[#fff8e6] border border-[#fae2a0] rounded-xl text-amber-900 font-black text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Story Quiz</span>
                </span>
                <span className="text-xs font-bold text-stone-500">
                  Question {currentQIndex + 1} of {questions.length}
                </span>
              </div>

              {/* Step indicator pills */}
              <div className="flex items-center gap-1.5">
                {questions.map((_, qIdx) => (
                  <div
                    key={qIdx}
                    className={`h-2 rounded-full transition-all ${
                      qIdx === currentQIndex
                        ? 'w-6 bg-amber-500'
                        : qIdx < currentQIndex
                        ? 'w-2 bg-emerald-500'
                        : 'w-2 bg-stone-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question Box */}
            <div className="my-3">
              <h2 className="text-xl sm:text-2xl font-black text-[#2d2d2d] leading-snug">
                {currentQuestion.question}
              </h2>
              {currentQuestion.questionEnglish && (
                <p className="text-xs sm:text-sm text-stone-500 font-semibold mt-1">
                  ({currentQuestion.questionEnglish})
                </p>
              )}
            </div>

            {/* Options List */}
            <div className="space-y-3 my-5">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrectAnswer = idx === currentQuestion.correctOptionIndex;

                let optionStyle = 'bg-[#f8f6f0] hover:bg-[#fff8e6] border-[#e8e4d8] text-[#2d2d2d]';

                if (isAnswerChecked) {
                  if (isCorrectAnswer) {
                    optionStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-300';
                  } else if (isSelected && !isCorrectAnswer) {
                    optionStyle = 'bg-rose-50 border-rose-400 text-rose-950 font-bold ring-2 ring-rose-300';
                  } else {
                    optionStyle = 'bg-[#f8f6f0]/50 border-[#e8e4d8] text-stone-400 opacity-60';
                  }
                } else if (isSelected) {
                  optionStyle = 'bg-[#fff8e6] border-amber-500 text-amber-950 font-bold ring-2 ring-amber-300 scale-[1.01]';
                }

                return (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: isAnswerChecked ? 1 : 1.015 }}
                    whileTap={{ scale: isAnswerChecked ? 1 : 0.985 }}
                    onClick={() => handleSelectOption(idx)}
                    id={`quiz-option-${idx}`}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${optionStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-white/90 border border-stone-300 text-stone-700 font-black text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-base sm:text-lg font-bold">{option}</span>
                    </div>

                    {isAnswerChecked && isCorrectAnswer && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-xl text-xs font-black"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Correct!</span>
                      </motion.div>
                    )}

                    {isAnswerChecked && isSelected && !isCorrectAnswer && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1 text-rose-700 bg-rose-100 px-2.5 py-1 rounded-xl text-xs font-black"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Try Again</span>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Wrong Answer Encouragement & Explanation */}
            <AnimatePresence>
              {isAnswerChecked && isWrongAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-950 font-medium my-3 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 font-black text-xs sm:text-sm text-amber-900">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      <span>Gentle Story Clue:</span>
                    </div>
                    <button
                      onClick={handleRetryQuestion}
                      className="flex items-center gap-1 text-xs font-black text-amber-800 bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Try Question Again</span>
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed">
                    {currentQuestion.explanation || 'Think about the characters and details in the story!'}
                  </p>
                </motion.div>
              )}

              {isAnswerChecked && !isWrongAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-950 font-medium my-3 shadow-xs flex items-start gap-2.5"
                >
                  <div className="p-1.5 bg-emerald-200 rounded-xl text-emerald-800 flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-xs sm:text-sm text-emerald-900 block mb-0.5">
                      🌟 Excellent Comprehension!
                    </span>
                    <p className="text-xs sm:text-sm text-emerald-900/90">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions Bar */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#f0ece1]">
              <button
                onClick={onSkip || onClose || (() => handleFinish(0))}
                className="text-stone-400 hover:text-stone-700 font-bold text-xs cursor-pointer py-2 px-1 transition-colors"
              >
                Skip to Rewards
              </button>

              {!isAnswerChecked ? (
                <button
                  onClick={handleCheckAnswer}
                  disabled={selectedOption === null}
                  id="btn-check-answer"
                  className="bg-[#2d2d2d] hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Check Answer</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  id="btn-next-question"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>{currentQIndex === questions.length - 1 ? 'See Results 🎉' : 'Next Question'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Quiz Results Celebration Screen */
          <div className="text-center py-4" id="quiz-results-screen">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 14 }}
              className="inline-flex p-5 bg-[#fff8e6] rounded-3xl border-2 border-[#fae2a0] mb-4 shadow-sm"
            >
              <Trophy className="w-14 h-14 text-amber-600 fill-amber-300" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl sm:text-3xl font-black text-[#2d2d2d]"
            >
              {correctAnswersCount === questions.length ? 'Super Reader Champion! 🌟' : 'Awesome Reading Effort! 👏'}
            </motion.h2>

            <p className="text-sm text-stone-600 font-medium mt-1.5">
              You answered <span className="font-extrabold text-amber-800">{correctAnswersCount}</span> out of <span className="font-extrabold">{questions.length}</span> questions correctly!
            </p>

            {/* Stars Earned Banner */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2.5 bg-[#fff8e6] text-amber-950 font-black text-base sm:text-lg px-6 py-3 rounded-2xl border-2 border-[#fae2a0] my-5 shadow-2xs"
            >
              <Star className="w-6 h-6 fill-amber-400 text-amber-500 animate-bounce" />
              <span>+{correctAnswersCount * 5 + 10} Bonus Stars Unlocked!</span>
            </motion.div>

            <div className="mt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleFinish(correctAnswersCount)}
                id="btn-claim-rewards"
                className="w-full bg-[#2d2d2d] hover:bg-black text-white font-black text-base py-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Claim Rewards & Open Treasure Chest 🎁</span>
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

