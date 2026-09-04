import React, { useState } from 'react';
import { motion } from 'motion/react';
import { PathanaShakthiLogo } from '../PathanaShakthiLogo';
import { kidSpeech } from '../../services/speechSynthesis';
import { soundEffects } from '../../services/soundEffects';
import {
  BookOpen,
  Sparkles,
  GraduationCap,
  Volume2,
  WifiOff,
  Award,
  ShieldCheck,
  Languages,
  CheckCircle2,
  ArrowRight,
  School,
  Play,
  Users,
  BrainCircuit,
  FileSpreadsheet,
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (route: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeSampleLang, setActiveSampleLang] = useState<'Telugu' | 'Hindi' | 'English'>('Telugu');

  const samplePhrases = {
    Telugu: {
      text: 'నమస్కారం! నేను శక్తి మిత్రను. నాతో కలిసి రోజూ తెలుగు కథలు చదువుకుందాం!',
      translit: 'Namaskaaram! Nenu Shakthi Mitranu. Naatho kalisi rooju Telugu kathalu chaduvukundaam!',
      meaning: 'Hello! I am Shakthi Mitra. Let us read Telugu stories together every day!',
    },
    Hindi: {
      text: 'नमस्ते! मैं शक्ति मित्र हूँ। आओ मिलकर हर दिन प्यारी-प्यारी कहानियाँ पढ़ें!',
      translit: 'Namaste! Main Shakthi Mitra hoon. Aao milkar har din pyaari-pyaari kahaaniyaan padhein!',
      meaning: 'Hello! I am Shakthi Mitra. Let us read lovely stories together every day!',
    },
    English: {
      text: 'Hello friends! I am Shakthi Mitra. Let us explore exciting stories and master reading fluency!',
      translit: 'Hello friends! I am Shakthi Mitra.',
      meaning: 'Interactive read-along companion for Class 1 to 5 children.',
    },
  };

  const handlePlaySample = () => {
    soundEffects.playWordPop();
    setIsPlayingAudio(true);
    kidSpeech.speakText(samplePhrases[activeSampleLang].text, activeSampleLang, {
      onEnd: () => {
        setIsPlayingAudio(false);
      },
      onError: () => {
        setIsPlayingAudio(false);
      },
    });
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col selection:bg-amber-200">
      {/* Top Banner / Product Focus Announcement */}
      <div className="bg-[#2d2d2d] text-amber-300 text-xs sm:text-sm font-semibold py-2 px-4 text-center border-b border-stone-800 flex items-center justify-center gap-2">
        <span className="bg-amber-500 text-stone-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
          Interactive Read-Along
        </span>
        <span>Listen, Speak, and Read Along in Telugu, Hindi & English</span>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headlines & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-[#fff8e6] border border-[#fae2a0] text-amber-950 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>Interactive Story Reading with Natural Indian Dialect Kid Voices</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 tracking-tight leading-tight">
              Helping Young Readers Read Fluently in{' '}
              <span className="text-[#a83210] underline decoration-[#fae2a0] decoration-wavy decoration-2">
                Telugu
              </span>
              , Hindi & English
            </h1>

            <p className="text-stone-700 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0">
              <strong>Pathana Shakthi (పఠన శక్తి)</strong> turns every story into an interactive karaoke read-along experience.
              Featuring synchronized word highlighting, real-time speech recognition, child-calibrated voice narration,
              tap-to-hear word vocabulary, and 100% offline support.
            </p>

            {/* Quick Action Navigation Grid */}
            <div className="pt-2 flex flex-wrap gap-3.5 justify-center lg:justify-start">
              <button
                type="button"
                onClick={() => onNavigate('student_library')}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-base shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
                id="btn-hero-student-portal"
              >
                <BookOpen className="w-5 h-5 text-stone-950" />
                <span>Open Student Library</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('faculty_dashboard')}
                className="flex items-center gap-2.5 px-5 py-3.5 rounded-xl bg-white hover:bg-stone-100 text-stone-800 font-bold text-base border border-stone-300 shadow-2xs transition-all cursor-pointer"
                id="btn-hero-faculty-room"
              >
                <GraduationCap className="w-5 h-5 text-amber-700" />
                <span>Faculty & Teacher Room</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('school_admin')}
                className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm border border-stone-300 transition-all cursor-pointer"
                id="btn-hero-school-admin"
              >
                <School className="w-4 h-4 text-stone-600" />
                <span>School Admin</span>
              </button>
            </div>

            {/* Credibility highlights */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-stone-600 font-semibold border-t border-stone-200">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Class 1 to 5 Foundational Literacy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Offline Classroom Synchronization</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>OCR Textbook-to-Story Pipeline</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Mascot & Audio Preview Showcase */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-stone-200 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100 rounded-full blur-2xl -mr-10 -mt-10" />

              <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-2xl shadow-inner border border-amber-400">
                    🦁
                  </div>
                  <div>
                    <h2 className="text-base font-black text-stone-900">Shakthi Mitra (శక్తి మిత్ర)</h2>
                    <p className="text-xs text-stone-500 font-medium">Interactive Kid Voice Tutor</p>
                  </div>
                </div>
                <span className="text-[11px] font-black uppercase px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                  Ready to Speak
                </span>
              </div>

              {/* Language Selector for Live Preview */}
              <div className="flex rounded-xl bg-stone-100 p-1 mb-4 gap-1">
                {(['Telugu', 'Hindi', 'English'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      soundEffects.playWordPop();
                      setActiveSampleLang(lang);
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activeSampleLang === lang
                        ? 'bg-amber-500 text-stone-950 shadow-2xs font-black'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {lang === 'Telugu' ? 'తెలుగు' : lang === 'Hindi' ? 'हिन्दी' : 'English'}
                  </button>
                ))}
              </div>

              {/* Preview Box */}
              <div className="bg-[#fffdf7] border border-amber-200 rounded-2xl p-4 mb-5 space-y-2">
                <p className="text-lg sm:text-xl font-bold text-stone-900 leading-snug">
                  {samplePhrases[activeSampleLang].text}
                </p>
                {activeSampleLang !== 'English' && (
                  <p className="text-xs text-stone-500 italic">
                    {samplePhrases[activeSampleLang].translit}
                  </p>
                )}
                <p className="text-xs text-amber-900/80 font-medium">
                  {samplePhrases[activeSampleLang].meaning}
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handlePlaySample}
                disabled={isPlayingAudio}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                id="btn-play-voice-sample"
              >
                <Volume2 className={`w-4 h-4 text-amber-400 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                <span>{isPlayingAudio ? 'Speaking in Kid Voice...' : 'Listen to Live Audio Sample'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Core Educational Pillars Section */}
      <section className="bg-white border-y border-stone-200 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900">
              Designed for Pure, Joyful Read-Along Practice
            </h2>
            <p className="text-stone-600 text-sm sm:text-base">
              Empowering young learners to build pronunciation, fluency, and reading confidence through interactive storytelling.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl font-bold">
                📖
              </div>
              <h3 className="text-lg font-bold text-stone-900">Interactive Read-Along Stories</h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Graded stories across multiple difficulty levels. Features synchronized word-by-word highlight karaoke, native speech, and tap-to-hear word vocabulary.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl font-bold">
                📷
              </div>
              <h3 className="text-lg font-bold text-stone-900">Story Creator & Book Scanner</h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Easily scan or upload any storybook page. AI extracts vocabulary, generates decodable sentences, and creates read-along story cards.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl font-bold">
                📡
              </div>
              <h3 className="text-lg font-bold text-stone-900">100% Offline Read-Along</h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Download story packs directly to your device. Reading streaks, voice speech practice, and vocabulary quizzes work anywhere without internet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Role-Based Gateway Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-stone-900 rounded-3xl text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="max-w-3xl space-y-4">
            <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
              Explore Spaces
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
              Ready to Start Reading?
            </h2>
            <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
              Choose your space below to explore stories, manage classroom reading, or view learning progress.
            </p>

            <div className="pt-6 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => onNavigate('student_library')}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm transition-all cursor-pointer"
                id="btn-gateway-student"
              >
                I am a Student (విద్యార్థి)
              </button>

              <button
                type="button"
                onClick={() => onNavigate('faculty_dashboard')}
                className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm border border-stone-700 transition-all cursor-pointer"
                id="btn-gateway-faculty"
              >
                Teacher & Story Creator (ఉపాధ్యాయులు)
              </button>

              <button
                type="button"
                onClick={() => onNavigate('school_admin')}
                className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm border border-stone-700 transition-all cursor-pointer"
                id="btn-gateway-admin"
              >
                School Admin (పాఠశాల నిర్వహణ)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-stone-200 py-8 px-4 sm:px-6 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <PathanaShakthiLogo size="sm" showSubtitle={false} />
            <span>— Interactive Multilingual Read-Along Companion</span>
          </div>
          <div>
            <span>Telugu • Hindi • English Reading & Voice Practice</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
