import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Story,
  Student,
  Language,
  SarvamNeuralVoiceId,
  VoiceSettingsState,
} from '../../types';
import {
  kidSpeech,
  SARVAM_VOICES,
} from '../../services/speechSynthesis';
import { speechRecognition, SpeechMatchResult } from '../../services/speechRecognition';
import { soundEffects } from '../../services/soundEffects';
import { MascotBuddy } from '../MascotBuddy';
import { VoiceWaveformVisualizer } from '../VoiceWaveformVisualizer';
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  Sparkles,
  Sliders,
  Play,
  Square,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Zap,
  Radio,
  Check,
  AlertCircle,
  HelpCircle,
  Award,
} from 'lucide-react';

interface VoiceSetupPageProps {
  student: Student;
  pendingStory: Story | null;
  stories: Story[];
  onStartReading: (story: Story) => void;
  onNavigateBack: () => void;
  onPronunciationComplete?: (metrics: { language: Language; accuracy: number; speedWPM: number; fluency: number }) => void;
}

interface CalibrationPhrase {
  text: string;
  transliteration: string;
  english: string;
  words: string[];
}

const CLASS_PRONUNCIATION_PHRASES: Record<Language, CalibrationPhrase[]> = {
  Telugu: [
    { text: 'అమ్మ నన్ను బడికి తీసుకెళ్లింది', transliteration: 'Amma nannu badiki teesukellindi', english: 'Mother took me to school', words: ['అమ్మ', 'నన్ను', 'బడికి', 'తీసుకెళ్లింది'] },
    { text: 'చిన్న పిచ్చుక చెట్టుపై కిలకిలా పాడింది', transliteration: 'Chinna pichuka chettupai kilakila paadindi', english: 'The little sparrow sang merrily on the tree', words: ['చిన్న', 'పిచ్చుక', 'చెట్టుపై', 'కిలకిలా', 'పాడింది'] },
    { text: 'రైతు పొలంలో పచ్చని మొక్కలను జాగ్రత్తగా పెంచాడు', transliteration: 'Raitu polamlo pachchani mokkalanu jagrattaga penchaadu', english: 'The farmer carefully grew green plants in the field', words: ['రైతు', 'పొలంలో', 'పచ్చని', 'మొక్కలను', 'జాగ్రత్తగా', 'పెంచాడు'] },
    { text: 'వర్షం తర్వాత గ్రామంలోని చెరువు నిండుగా కనిపించింది', transliteration: 'Varsham tarvaata graamamlooni cheruvu ninduga kanipinchindi', english: 'After the rain, the village pond looked full', words: ['వర్షం', 'తర్వాత', 'గ్రామంలోని', 'చెరువు', 'నిండుగా', 'కనిపించింది'] },
    { text: 'పిల్లలు పుస్తకంలోని ఆసక్తికరమైన కథను స్పష్టంగా చదివారు', transliteration: 'Pillalu pustakamlooni aasaktikaramaina kathanu spashtanga chadivaaru', english: 'The children clearly read the interesting story in the book', words: ['పిల్లలు', 'పుస్తకంలోని', 'ఆసక్తికరమైన', 'కథను', 'స్పష్టంగా', 'చదివారు'] },
  ],
  Hindi: [
    { text: 'माँ मुझे स्कूल लेकर गई', transliteration: 'Maa mujhe school lekar gayi', english: 'Mother took me to school', words: ['माँ', 'मुझे', 'स्कूल', 'लेकर', 'गई'] },
    { text: 'प्यारी नन्हीं चिड़िया पेड़ पर मीठा गीत गाती है', transliteration: 'Pyaari nanhi chidiya ped par meetha geet gaati hai', english: 'The cute little bird sings a sweet song on the tree', words: ['प्यारी', 'नन्हीं', 'चिड़िया', 'पेड़', 'पर', 'मीठा', 'गीत', 'गाती', 'है'] },
    { text: 'किसान खेत में हरे पौधों की देखभाल करता है', transliteration: 'Kisaan khet mein hare paudhon ki dekhabhaal karta hai', english: 'The farmer takes care of green plants in the field', words: ['किसान', 'खेत', 'में', 'हरे', 'पौधों', 'की', 'देखभाल', 'करता', 'है'] },
    { text: 'बारिश के बाद गाँव का तालाब पानी से भर गया', transliteration: 'Baarish ke baad gaanv ka taalaab paani se bhar gaya', english: 'After the rain, the village pond filled with water', words: ['बारिश', 'के', 'बाद', 'गाँव', 'का', 'तालाब', 'पानी', 'से', 'भर', 'गया'] },
    { text: 'बच्चों ने पुस्तक की कठिन कहानी को ध्यान से और स्पष्ट पढ़ा', transliteration: 'Bachchon ne pustak ki kathin kahani ko dhyaan se aur spasht padha', english: 'The children carefully and clearly read the difficult story in the book', words: ['बच्चों', 'ने', 'पुस्तक', 'की', 'कठिन', 'कहानी', 'को', 'ध्यान', 'से', 'और', 'स्पष्ट', 'पढ़ा'] },
  ],
  English: [
    { text: 'The little girl reads a book', transliteration: 'The little girl reads a book', english: 'The little girl reads a book', words: ['The', 'little', 'girl', 'reads', 'a', 'book'] },
    { text: 'The playful puppy ran across the green garden', transliteration: 'The playful puppy ran across the green garden', english: 'The playful puppy ran across the green garden', words: ['The', 'playful', 'puppy', 'ran', 'across', 'the', 'green', 'garden'] },
    { text: 'The farmer carefully waters the young plants every morning', transliteration: 'The farmer carefully waters the young plants every morning', english: 'The farmer carefully waters the young plants every morning', words: ['The', 'farmer', 'carefully', 'waters', 'the', 'young', 'plants', 'every', 'morning'] },
    { text: 'After the rain, the children walked quietly beside the village pond', transliteration: 'After the rain, the children walked quietly beside the village pond', english: 'After the rain, the children walked quietly beside the village pond', words: ['After', 'the', 'rain', 'the', 'children', 'walked', 'quietly', 'beside', 'the', 'village', 'pond'] },
    { text: 'The curious children carefully explained why protecting trees keeps our village healthy', transliteration: 'The curious children carefully explained why protecting trees keeps our village healthy', english: 'The curious children carefully explained why protecting trees keeps our village healthy', words: ['The', 'curious', 'children', 'carefully', 'explained', 'why', 'protecting', 'trees', 'keeps', 'our', 'village', 'healthy'] },
  ],
};

const getClassNumber = (grade: string): number => Number((grade.match(/\d+/) || ['1'])[0]);

const VISIBLE_SARVAM_VOICES = SARVAM_VOICES.filter((voice) =>
  voice.id === 'Priya' || voice.id === 'Shubh'
);

const VOICE_LANGUAGE_LABELS: Record<string, Record<Language, string>> = {
  Priya: {
    Telugu: 'స్నేహపూర్వక మహిళా స్వరం',
    Hindi: 'प्यारी महिला आवाज़',
    English: 'Warm female storyteller voice',
  },
  Shubh: {
    Telugu: 'ఉత్సాహభరిత పురుష స్వరం',
    Hindi: 'ऊर्जावान पुरुष आवाज़',
    English: 'Energetic male storyteller voice',
  },
};


export const VoiceSetupPage: React.FC<VoiceSetupPageProps> = ({
  student,
  pendingStory,
  stories,
  onStartReading,
  onNavigateBack,
  onPronunciationComplete,
}) => {
  // Active Language for calibration test
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => {
    return pendingStory ? pendingStory.language : 'Telugu';
  });

  // Active Voice Settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsState>(() =>
    kidSpeech.getSettings()
  );
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);

  // Calibration Steps Completed Tracking
  const [testedSpeaker, setTestedSpeaker] = useState<boolean>(false);
  const [testedMicVolume, setTestedMicVolume] = useState<boolean>(false);
  const [testedSpeechMatch, setTestedSpeechMatch] = useState<boolean>(false);

  // Web Audio API Live Mic Volume Metering
  const [isMicTesting, setIsMicTesting] = useState<boolean>(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0); // 0 - 100
  const [micStatusMessage, setMicStatusMessage] = useState<string>('Tap "Test Microphone" to begin');
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Speech Recognition Calibration
  const [isRecognitionTesting, setIsRecognitionTesting] = useState<boolean>(false);
  const [matchedIndices, setMatchedIndices] = useState<number[]>([]);
  const [recognitionTranscript, setRecognitionTranscript] = useState<string>('');
  const [speechAccuracy, setSpeechAccuracy] = useState<number>(0);
  const [lastSpokenWord, setLastSpokenWord] = useState<string>('');
  const [pronunciationCompleted, setPronunciationCompleted] = useState(false);
  const [pronunciationError, setPronunciationError] = useState('');
  const [lastPronunciationResult, setLastPronunciationResult] = useState<SpeechMatchResult | null>(null);

  const classNumber = getClassNumber(student.grade);
  const currentPhrase = CLASS_PRONUNCIATION_PHRASES[selectedLanguage][Math.min(5, Math.max(1, classNumber)) - 1];

  // Resolve which story "Start Reading Now" should open. Previously this
  // button always reopened the original `pendingStory` regardless of the
  // language picked in this screen's language switcher, so tapping Hindi
  // here and then "Start Reading Now" kept reading the old-language story.
  // Now: if the switcher has picked a different language than the pending
  // story, look for a same-grade story in that language and read that
  // instead; otherwise fall back to the pending story unchanged.
  const resolvedStoryToRead: Story | null = (() => {
    if (!pendingStory) return null;
    if (pendingStory.language === selectedLanguage) return pendingStory;
    const sameGradeMatch = stories.find(
      (s) => s.language === selectedLanguage && s.gradeLevel === pendingStory.gradeLevel
    );
    if (sameGradeMatch) return sameGradeMatch;
    const anyMatch = stories.find((s) => s.language === selectedLanguage);
    return anyMatch || pendingStory;
  })();
  const languageSwitchHasNoStory =
    !!pendingStory &&
    pendingStory.language !== selectedLanguage &&
    resolvedStoryToRead?.language !== selectedLanguage;

  // Preload the selected class phrase and all character samples when the voice page opens.
  useEffect(() => {
    kidSpeech.preloadLanguageAssets(selectedLanguage, currentPhrase.words);
  }, [selectedLanguage, currentPhrase.words.join('|')]);

  // Subscribe to voice changes
  useEffect(() => {
    const unsub = kidSpeech.subscribe((newSettings) => {
      setVoiceSettings(newSettings);
    });
    return () => {
      unsub();
      kidSpeech.stop();
      stopMicMetering();
      if (speechRecognition.isSupported()) {
        speechRecognition.stopListening();
      }
    };
  }, []);

  // Web Audio API Realtime Volume Meter
  const startMicMetering = async () => {
    try {
      soundEffects.playWordPop();
      setMicPermissionDenied(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsMicTesting(true);
      setMicStatusMessage('Microphone active! Speak something...');

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Compute average amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolumeLevel(normalized);

        if (normalized > 15) {
          setTestedMicVolume(true);
        }

        if (normalized < 8) {
          setMicStatusMessage('Quiet / Whispering... speak a little louder');
        } else if (normalized >= 8 && normalized <= 65) {
          setMicStatusMessage('✨ Perfect Reading Volume! Clear & Balanced');
        } else {
          setMicStatusMessage('⚠️ High volume / Background noise detected');
        }

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err: any) {
      console.error('Mic access error:', err);
      setMicPermissionDenied(true);
      setMicStatusMessage('Microphone permission required for speech practice.');
      setIsMicTesting(false);
    }
  };

  const stopMicMetering = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsMicTesting(false);
    setMicVolumeLevel(0);
  };

  const handleToggleMicTesting = () => {
    if (isMicTesting) {
      stopMicMetering();
    } else {
      startMicMetering();
    }
  };

  // Speech Recognition Testing for the class-specific phrase
  const handleToggleSpeechTest = () => {
    if (isRecognitionTesting) {
      speechRecognition.stopListening();
      return;
    }

    soundEffects.playWordPop();
    setMatchedIndices([]);
    setRecognitionTranscript('');
    setSpeechAccuracy(0);
    setLastSpokenWord('');
    setLastPronunciationResult(null);
    setPronunciationCompleted(false);
    setPronunciationError('');
    setIsRecognitionTesting(true);

    speechRecognition.startListening(
      selectedLanguage,
      currentPhrase.words,
      (result: SpeechMatchResult) => {
        setRecognitionTranscript(result.transcript);
        setMatchedIndices(result.matchedWordIndices);
        setSpeechAccuracy(result.accuracy);
        setLastPronunciationResult(result);

        if (result.matchedWordIndices.length > 0) {
          const lastIdx = result.matchedWordIndices[result.matchedWordIndices.length - 1];
          setLastSpokenWord(currentPhrase.words[lastIdx] || '');
          soundEffects.playWordPop();
        }

        if (result.isComplete) {
          soundEffects.playStarChime();
          setIsRecognitionTesting(false);
          setPronunciationCompleted(true);
          setTestedSpeechMatch(result.accuracy >= 70);
        }
      },
      (err: string) => {
        setIsRecognitionTesting(false);
        setPronunciationError(err);
      }
    );
  };

  const handleRetryPronunciation = () => {
    setPronunciationCompleted(false);
    setLastPronunciationResult(null);
    setMatchedIndices([]);
    setRecognitionTranscript('');
    setSpeechAccuracy(0);
    setPronunciationError('');
  };

  const handleContinuePronunciation = () => {
    if (!lastPronunciationResult) return;
    onPronunciationComplete?.({
      language: selectedLanguage,
      accuracy: Math.round(lastPronunciationResult.accuracy),
      speedWPM: lastPronunciationResult.wpm,
      fluency: lastPronunciationResult.fluency,
    });
    setTestedSpeechMatch(true);
    // Previously "Continue" recorded the score and did nothing else visible —
    // the result card stayed on screen with no feedback, which is why it
    // looked broken. Now it collapses the result card (the checklist tick
    // for this step stays on via testedSpeechMatch above) and scrolls the
    // user down to the "Start Reading Now" / "Choose a Story to Read" call
    // to action, since that's the actual next step of this flow — not a
    // full redirect to Home, which would skip past voice/mic setup they may
    // still want to review.
    setPronunciationCompleted(false);
    requestAnimationFrame(() => {
      const target =
        document.getElementById('btn-voice-setup-start-reading') ||
        document.getElementById('btn-voice-setup-explore-stories');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  // Voice Audition & Selection
  const handleSelectSarvamVoice = (voiceId: SarvamNeuralVoiceId) => {
    soundEffects.playStarChime();
    kidSpeech.updateSettings({
      engine: 'sarvam_hd',
      sarvamVoice: voiceId,
    });
    setTestedSpeaker(true);
    setTestingVoiceId(voiceId);

    kidSpeech.previewSarvamVoice(voiceId, selectedLanguage, () => {
      setTestingVoiceId(null);
    });
  };


  const handlePlayVoicePreview = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    soundEffects.playWordPop();
    setTestedSpeaker(true);

    if (testingVoiceId === id) {
      kidSpeech.stop();
      setTestingVoiceId(null);
      return;
    }

    setTestingVoiceId(id);
    kidSpeech.previewSarvamVoice(id as SarvamNeuralVoiceId, selectedLanguage, () => {
      setTestingVoiceId(null);
    });
  };

  const handleTestSpecificWord = (word: string) => {
    // Always synthesize the original-script word. The Roman transliteration is
    // only a learner guide and must never be sent to TTS as English text.
    soundEffects.playWordPop();
    kidSpeech.speakSlowWord(word, selectedLanguage);
  };

  const transliterationWords = currentPhrase.transliteration.split(/\s+/);

  // Calculate Overall Readiness
  const completedStepsCount =
    (testedSpeaker ? 1 : 0) + (testedMicVolume ? 1 : 0) + (testedSpeechMatch ? 1 : 0);
  const readinessPercent = Math.round((completedStepsCount / 3) * 100);

  const activeSarvamVoice =
    VISIBLE_SARVAM_VOICES.find((v) => v.id === voiceSettings.sarvamVoice) ||
    VISIBLE_SARVAM_VOICES[0];
  const currentVoiceName = activeSarvamVoice.name;
  const currentVoiceAvatar = activeSarvamVoice.avatar;

  // Keep this page permanently on the two supported Sarvam voices.
  useEffect(() => {
    const selectedIsSupported = VISIBLE_SARVAM_VOICES.some(
      (voice) => voice.id === voiceSettings.sarvamVoice
    );
    if (voiceSettings.engine !== 'sarvam_hd' || !selectedIsSupported) {
      kidSpeech.updateSettings({
        engine: 'sarvam_hd',
        sarvamVoice: selectedIsSupported ? voiceSettings.sarvamVoice : 'Priya',
      });
    }
  }, [voiceSettings.engine, voiceSettings.sarvamVoice]);

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-20 font-sans select-none" id="voice-setup-screen">
      {/* Header Bar */}
      <div className="bg-[#2d2d2d] text-white py-5 px-4 sm:px-6 lg:px-8 border-b border-stone-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateBack}
              className="p-2.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all cursor-pointer border border-stone-700"
              title="Return to library"
              id="btn-voice-setup-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white">
                  Audio & Voice Studio Setup
                </h1>
                <span className="bg-amber-400 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                  ధ్వని & మైక్ సెటప్
                </span>
              </div>
              <p className="text-xs text-stone-300 font-medium">
                Choose a voice, try the microphone, and practise your reading
              </p>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-1.5 bg-stone-800 p-1 rounded-2xl border border-stone-700">
            {(['Telugu', 'Hindi', 'English'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  soundEffects.playWordPop();
                  setSelectedLanguage(lang);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  selectedLanguage === lang
                    ? 'bg-amber-400 text-amber-950 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
                id={`btn-setup-lang-${lang}`}
              >
                {lang === 'Telugu' ? 'తెలుగు' : lang === 'Hindi' ? 'हिन्दी' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Top Status & Mascot Banner */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#e8e4d8] shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <MascotBuddy
              mood={readinessPercent === 100 ? 'celebrating' : isMicTesting ? 'listening' : 'happy'}
              language={selectedLanguage}
              size="md"
              showVoiceSettings={false}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="text-xs font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Reading Practice
                </span>
                <span className="text-xs font-bold text-stone-500">
                  {student.name} • {student.grade}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#2d2d2d]">
                {readinessPercent === 100
                  ? '🌟 100% Ready! Your voice and audio are perfectly tuned!'
                  : 'Ready to practise your reading?'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 max-w-xl">
                Pick a storyteller, check your microphone, and practise the sentence below.
              </p>
            </div>
          </div>

          {/* Readiness Meter Gauge Card */}
          <div className="bg-[#f9f7f0] border border-[#e5e0d0] rounded-2xl p-4 min-w-[240px] text-center space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-stone-700">
              <span>Practice Progress</span>
              <span className="text-amber-900 bg-amber-200 px-2 py-0.5 rounded-md font-black">
                {readinessPercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${readinessPercent}%` }}
                className={`h-full transition-all rounded-full ${
                  readinessPercent === 100
                    ? 'bg-emerald-500'
                    : readinessPercent >= 66
                    ? 'bg-amber-500'
                    : 'bg-amber-400'
                }`}
              />
            </div>

            {/* 3 Step Icons */}
            <div className="flex items-center justify-between pt-1 text-[11px] font-bold">
              <span className={`flex items-center gap-1 ${testedSpeaker ? 'text-emerald-700' : 'text-stone-400'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${testedSpeaker ? 'text-emerald-600' : 'text-stone-300'}`} />
                1. Voice
              </span>
              <span className={`flex items-center gap-1 ${testedMicVolume ? 'text-emerald-700' : 'text-stone-400'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${testedMicVolume ? 'text-emerald-600' : 'text-stone-300'}`} />
                2. Microphone
              </span>
              <span className={`flex items-center gap-1 ${testedSpeechMatch ? 'text-emerald-700' : 'text-stone-400'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${testedSpeechMatch ? 'text-emerald-600' : 'text-stone-300'}`} />
                3. Reading
              </span>
            </div>
          </div>
        </div>

        {/* Balanced Workspace: top half is Voice + Mic, bottom half is Pronunciation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Step 1: Storyteller Voice */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#e8e4d8] shadow-xs flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-[#f0ece1] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black text-sm">
                  1
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2d2d2d]">
                    Choose Your Storyteller Voice
                  </h3>
                  <p className="text-xs text-stone-500 font-medium">
                    Choose a female or male Sarvam voice for {selectedLanguage}
                  </p>
                </div>
              </div>
              <span className="bg-stone-100 text-stone-700 border border-stone-200 text-[10px] font-black px-2 py-1 rounded-lg">
                Sarvam HD
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 flex-1">
              {VISIBLE_SARVAM_VOICES.map((voice) => {
                const isSelected =
                  voiceSettings.engine === 'sarvam_hd' &&
                  voiceSettings.sarvamVoice === voice.id;
                const isPlaying = testingVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    onClick={() => handleSelectSarvamVoice(voice.id)}
                    className={`min-h-[315px] p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#fffbf0] border-amber-500 ring-2 ring-amber-400/40 shadow-xs'
                        : 'bg-[#faf8f5] border-[#e8e4d8] hover:border-amber-300 hover:bg-white'
                    }`}
                    id={`voice-card-sarvam-${voice.id}`}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">{voice.avatar}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-lg font-black text-[#2d2d2d]">
                                {voice.name}
                              </h4>
                              {isSelected && (
                                <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px]">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-bold text-amber-800">
                              {VOICE_LANGUAGE_LABELS[voice.id]?.[selectedLanguage] ||
                                (voice.gender === 'female' ? 'Female voice' : 'Male voice')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-stone-600 leading-relaxed mb-3">
                        {voice.tone}
                      </p>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-3 text-center">
                          <span className="block text-xl mb-1">📖</span>
                          <span className="text-[11px] font-black text-stone-700">Story Time</span>
                          <p className="text-[9px] text-stone-500 mt-1">Listen to stories</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-3 text-center">
                          <span className="block text-xl mb-1">🎧</span>
                          <span className="text-[11px] font-black text-stone-700">Listen & Repeat</span>
                          <p className="text-[9px] text-stone-500 mt-1">Hear a word, then say it</p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handlePlayVoicePreview(e, voice.id)}
                      className={`mt-4 w-full text-xs font-black px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                        isPlaying
                          ? 'bg-amber-500 text-white animate-pulse'
                          : 'bg-white hover:bg-amber-100 border border-stone-200 text-stone-800'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>Playing...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-amber-700" />
                          <span>Audition {voice.name}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Narration Speed stays with voice selection */}
            <div className="bg-[#fcfbf9] border border-[#e8e4d8] rounded-2xl p-3.5 mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-700" />
                <div>
                  <span className="text-xs font-black text-[#2d2d2d]">Narration Speed</span>
                  <p className="text-[10px] text-stone-500">Applies to voice samples and pronunciation words</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <span className="text-[10px] font-bold text-stone-500">0.6x</span>
                <input
                  type="range"
                  min="0.6"
                  max="1.3"
                  step="0.05"
                  value={voiceSettings.rate}
                  onChange={(e) => {
                    const newRate = parseFloat(e.target.value);
                    kidSpeech.updateSettings({ rate: newRate });
                  }}
                  className="accent-amber-500 cursor-pointer w-28"
                  id="voice-speed-slider-setup"
                />
                <span className="text-[10px] font-bold text-stone-500">1.3x</span>
                <span className="bg-amber-100 text-amber-950 font-black text-xs px-2 py-0.5 rounded-md border border-amber-300">
                  {voiceSettings.rate.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>

          {/* Step 2: Check Your Microphone — balanced with the voice panel */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#e8e4d8] shadow-xs min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#f0ece1] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-black text-sm">
                  2
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2d2d2d]">
                    Check Your Microphone
                  </h3>
                  <p className="text-[11px] text-stone-500 font-medium">
                    Make sure your microphone can hear you
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleMicTesting}
                className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  isMicTesting
                    ? 'bg-rose-600 text-white animate-pulse shadow-xs'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                }`}
                id="btn-test-mic-stream"
              >
                {isMicTesting ? (
                  <>
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Stop Mic</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>Test Mic</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-between pt-5">
              <div className="space-y-4">
                <div className="bg-[#faf8f5] p-5 rounded-2xl border border-[#e8e4d8]">
                  <div className="flex items-center justify-between text-sm font-bold text-stone-700 mb-3">
                    <span className="flex items-center gap-2">
                      <Radio className={`w-4 h-4 ${isMicTesting ? 'text-emerald-600 animate-pulse' : 'text-stone-400'}`} />
                      Live Audio Input Level
                    </span>
                    <span className="font-black text-stone-800 text-lg">{micVolumeLevel}%</span>
                  </div>

                  <div className="relative w-full h-7 bg-stone-200 rounded-full overflow-hidden">
                    <div className="absolute top-0 bottom-0 left-[20%] right-[35%] bg-emerald-400/20 border-x border-emerald-400/50 z-0" />
                    <motion.div
                      animate={{ width: `${micVolumeLevel}%` }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      className={`h-full rounded-full transition-all z-10 relative ${
                        micVolumeLevel > 75
                          ? 'bg-rose-500'
                          : micVolumeLevel >= 15
                          ? 'bg-emerald-500'
                          : 'bg-amber-400'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-stone-600 pt-3">
                    <span>{micStatusMessage}</span>
                    {testedMicVolume && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Calibrated
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 flex-1 flex flex-col justify-center">
                  <div className="text-center mb-4">
                    <div className="text-3xl mb-1">🎤</div>
                    <p className="text-sm font-black text-stone-800">Let’s hear your voice!</p>
                    <p className="text-[11px] text-stone-600 mt-1">Tap <b>Test Mic</b>, then say a few words.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white border border-emerald-100 p-3 text-center">
                      <div className="text-xl mb-1">🗣️</div>
                      <p className="text-[11px] font-black text-stone-800">Say it aloud</p>
                      <p className="text-[9px] leading-relaxed text-stone-500 mt-1">Use your normal reading voice.</p>
                    </div>
                    <div className="rounded-xl bg-white border border-emerald-100 p-3 text-center">
                      <div className="text-xl mb-1">📊</div>
                      <p className="text-[11px] font-black text-stone-800">See your voice</p>
                      <p className="text-[9px] leading-relaxed text-stone-500 mt-1">The meter moves when the mic hears you.</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-white/90 border border-emerald-100 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-stone-700">💡 Try saying the sentence shown below!</p>
                  </div>
                </div>

                {micPermissionDenied && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Microphone access was denied. Please allow mic permissions in your browser.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Full-width Pronunciation Practice */}
          <div className="lg:col-span-2">
            {/* Step 3: Live Speech Recognition Try-Out */}
            <div className="bg-white rounded-3xl p-5 border border-[#e8e4d8] shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#f0ece1] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-900 flex items-center justify-center font-black text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2d2d2d]">
                      Pronunciation Try-Out
                    </h3>
                    <p className="text-[11px] text-stone-500 font-medium">
                      Class {classNumber} • Practice this {selectedLanguage} sentence
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleSpeechTest}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    isRecognitionTesting
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-xs'
                  }`}
                  id="btn-test-speech-rec"
                >
                  {isRecognitionTesting ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Listening</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>Speak Phrase</span>
                    </>
                  )}
                </button>
              </div>

              {/* Interactive Word Tokens */}
              <div className="bg-[#fffdfa] border border-[#f0ece1] rounded-2xl p-4 text-center space-y-3">
                <p className="text-xs font-bold text-stone-500">
                  Tap a word to hear it at the selected Narration Speed, or tap "Speak Phrase" to record and analyse the sentence:
                </p>

                <div className="flex flex-nowrap items-center justify-center gap-2 py-2 overflow-x-auto px-2">
                  {currentPhrase.words.map((word, idx) => {
                    const status = lastPronunciationResult?.wordStatuses?.[idx] || (matchedIndices.includes(idx) ? 'correct' : 'pending');
                    const romanWord = transliterationWords[idx] || '';
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleTestSpecificWord(word)}
                        className={`px-3 py-2 rounded-xl border transition-all cursor-pointer shadow-2xs flex flex-col items-center min-w-[72px] ${
                          status === 'correct'
                            ? 'bg-emerald-500 text-white border-emerald-600 scale-105 ring-2 ring-emerald-300'
                            : status === 'wrong'
                            ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-200'
                            : 'bg-white hover:bg-amber-50 text-stone-800 border-[#e8e4d8] hover:border-amber-400'
                        }`}
                        title={`Hear ${word} in ${selectedLanguage}; ${romanWord} is only the pronunciation guide`}
                        id={`test-word-token-${idx}`}
                      >
                        <span className="font-black text-sm sm:text-base">{word}</span>
                        <span className={`text-[10px] font-semibold ${status !== 'pending' ? 'text-white/90' : 'text-stone-500'}`}>{romanWord}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Romanized pronunciation guide — display only; never sent to TTS */}
                <p className="text-xs text-amber-900 font-semibold italic">
                  Romanized guide: "{currentPhrase.transliteration}"
                </p>
                <p className="text-[11px] text-stone-500">
                  English meaning: {currentPhrase.english}
                </p>
              </div>

              {pronunciationError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pronunciationError}</span>
                </div>
              )}

              {pronunciationCompleted && lastPronunciationResult && (
                <div className="bg-white border border-emerald-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2 text-center">
                      <div className="text-lg font-black text-emerald-800">{Math.round(lastPronunciationResult.accuracy)}%</div>
                      <div className="text-[9px] font-black uppercase text-emerald-700">Accuracy</div>
                    </div>
                    <div className="rounded-xl bg-sky-50 border border-sky-100 p-2 text-center">
                      <div className="text-lg font-black text-sky-800">{lastPronunciationResult.wpm}</div>
                      <div className="text-[9px] font-black uppercase text-sky-700">WPM</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-2 text-center">
                      <div className="text-lg font-black text-amber-800">{lastPronunciationResult.fluency}%</div>
                      <div className="text-[9px] font-black uppercase text-amber-700">Fluency</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-stone-500">Fluency combines pronunciation accuracy with reading speed. Sarvam Saaras transcript scoring does not directly measure accent acoustics.</p>
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={handleRetryPronunciation} className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-black flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> Retry
                    </button>
                    <button type="button" onClick={handleContinuePronunciation} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5">
                      Continue <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Real-time Recognition Match Score */}
              {isRecognitionTesting && (
                <div className="bg-sky-50 border border-sky-200 text-sky-950 p-3 rounded-2xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-black">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                      Listening in {selectedLanguage}...
                    </span>
                    <span className="bg-sky-200 px-2 py-0.5 rounded-md text-sky-900">
                      {Math.round(speechAccuracy)}% Match
                    </span>
                  </div>
                  {recognitionTranscript && (
                    <p className="text-[11px] text-sky-800 font-medium">
                      Heard: <span className="font-bold">"{recognitionTranscript}"</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Floating Launch Action Bar */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#e8e4d8] shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-2xl shadow-2xs">
              {currentVoiceAvatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-stone-700">Active Setup:</span>
                <span className="bg-amber-400 text-amber-950 font-black text-xs px-2 py-0.5 rounded-md">
                  {currentVoiceName} ({voiceSettings.rate.toFixed(2)}x)
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium">
                {pendingStory
                  ? `Ready to read: "${resolvedStoryToRead?.title ?? pendingStory.title}" (${resolvedStoryToRead?.language ?? pendingStory.language})`
                  : 'Settings saved for all storybooks in the library'}
              </p>
              {languageSwitchHasNoStory && (
                <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                  No {selectedLanguage} story available yet — this will open the {pendingStory?.language} version instead.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onNavigateBack}
              className="px-5 py-3 rounded-2xl bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-700 font-black text-xs sm:text-sm transition-all border border-[#e5e1d5] cursor-pointer"
              id="btn-voice-setup-cancel"
            >
              Back to Library
            </button>

            {pendingStory ? (
              <button
                type="button"
                onClick={() => {
                  soundEffects.playStarChime();
                  onStartReading(resolvedStoryToRead ?? pendingStory);
                }}
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer group"
                id="btn-voice-setup-start-reading"
              >
                <span>Start Reading Now</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateBack}
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer group"
                id="btn-voice-setup-explore-stories"
              >
                <span>Choose a Story to Read</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};