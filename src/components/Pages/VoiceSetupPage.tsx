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
import ShapeGrid from '../home/ShapeGrid';
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
    return pendingStory ? pendingStory.language : 'English';
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
    <div
      className="relative min-h-screen overflow-hidden bg-stone-50 text-stone-900 pb-24 font-sans select-none"
      id="voice-setup-screen"
    >
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <ShapeGrid
          direction="diagonal"
          speed={0.18}
          borderColor="rgba(124, 58, 237, 0.14)"
          squareSize={52}
          hoverFillColor="rgba(236, 72, 153, 0.18)"
          shape="square"
          hoverTrailAmount={0}
        />
      </div>
      {/* ================================================================
          TOP HEADER
          ================================================================ */}
      <header className="sticky top-0 z-40 border-b border-stone-800 bg-[#292929] text-white shadow-lg">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onNavigateBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-stone-700 bg-stone-800 text-stone-200 transition hover:bg-stone-700 hover:text-white"
              title="Return to library"
              id="btn-voice-setup-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-black sm:text-xl">
                  Audio &amp; Voice Studio
                </h1>
                <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black text-amber-950">
                  ధ్వని &amp; మైక్ సెటప్
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] font-medium text-stone-300 sm:text-xs">
                Choose a voice, check your microphone, and practise your reading
              </p>
            </div>
          </div>

          <div className="hidden shrink-0 items-center gap-1 rounded-2xl border border-stone-700 bg-stone-800 p-1 sm:flex">
            {(['English', 'Telugu', 'Hindi'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  soundEffects.playWordPop();
                  setSelectedLanguage(lang);
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all ${
                  selectedLanguage === lang
                    ? 'bg-amber-400 text-amber-950 shadow-sm'
                    : 'text-stone-300 hover:bg-stone-700 hover:text-white'
                }`}
                id={`btn-setup-lang-${lang}`}
              >
                {lang === 'Telugu' ? 'తెలుగు' : lang === 'Hindi' ? 'हिन्दी' : 'English'}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-stone-700 bg-stone-800 p-1 sm:hidden">
            {(['English', 'Telugu', 'Hindi'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  soundEffects.playWordPop();
                  setSelectedLanguage(lang);
                }}
                className={`rounded-lg px-2 py-1.5 text-[9px] font-black ${
                  selectedLanguage === lang ? 'bg-amber-400 text-amber-950' : 'text-stone-300'
                }`}
              >
                {lang === 'Telugu' ? 'తె' : lang === 'Hindi' ? 'हि' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ================================================================
          MAIN CONTENT
          ================================================================ */}
      <main className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-7">
        {/* Hero / status card */}
        <section className="relative overflow-hidden rounded-[28px] border border-[#e5dfd2] bg-white shadow-[0_12px_35px_rgba(71,61,45,0.07)]">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-100/70 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-emerald-100/40 blur-3xl" />

          <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:p-8">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <div className="shrink-0 rounded-[26px] border-2 border-white bg-[#fff8df] p-1.5 shadow-md">
                <img
                  src="/shakthi-face.png"
                  alt="Shakthi Mitra"
                  className="h-36 w-48 select-none object-contain drop-shadow-[0_12px_18px_rgba(100,55,20,0.2)]"
                  draggable={false}
                />
              </div>

              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-900">
                    Reading Practice
                  </span>
                  <span className="text-xs font-bold text-stone-500">
                    {student.name} • {student.grade}
                  </span>
                </div>

                <h2 className="max-w-2xl text-2xl font-black leading-tight text-[#262626] sm:text-3xl">
                  {readinessPercent === 100
                    ? '🌟 100% Ready! Your setup is complete.'
                    : 'Ready to practise your reading?'}
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-stone-600">
                  Choose a storyteller, make sure your microphone hears you clearly,
                  then practise the sentence below.
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="relative w-full shrink-0 rounded-2xl border border-[#e6e0d2] bg-[#fbf9f3] p-4 lg:w-[290px]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-black text-stone-700">Practice Progress</span>
                <span className="rounded-lg bg-amber-200 px-2 py-1 text-xs font-black text-amber-950">
                  {readinessPercent}%
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-stone-200">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${readinessPercent}%` }}
                  className={`h-full rounded-full ${
                    readinessPercent === 100
                      ? 'bg-emerald-500'
                      : readinessPercent >= 66
                      ? 'bg-amber-500'
                      : 'bg-amber-400'
                  }`}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-black">
                <div className={`flex items-center gap-1 ${testedSpeaker ? 'text-emerald-700' : 'text-stone-400'}`}>
                  <CheckCircle2 className={`h-3.5 w-3.5 ${testedSpeaker ? 'text-emerald-600' : 'text-stone-300'}`} />
                  Voice
                </div>
                <div className={`flex items-center gap-1 ${testedMicVolume ? 'text-emerald-700' : 'text-stone-400'}`}>
                  <CheckCircle2 className={`h-3.5 w-3.5 ${testedMicVolume ? 'text-emerald-600' : 'text-stone-300'}`} />
                  Mic
                </div>
                <div className={`flex items-center gap-1 ${testedSpeechMatch ? 'text-emerald-700' : 'text-stone-400'}`}>
                  <CheckCircle2 className={`h-3.5 w-3.5 ${testedSpeechMatch ? 'text-emerald-600' : 'text-stone-300'}`} />
                  Reading
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 1 + Step 2 */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Voice */}
          <div className="rounded-[26px] border border-[#e5dfd2] bg-white p-5 shadow-[0_10px_28px_rgba(71,61,45,0.055)] sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-black text-amber-900">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#292929]">Choose Your Storyteller</h3>
                  <p className="mt-0.5 text-xs font-medium text-stone-500">
                    Pick a Sarvam voice for {selectedLanguage}
                  </p>
                </div>
              </div>
              <span className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-black text-stone-600">
                Sarvam HD
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {VISIBLE_SARVAM_VOICES.map((voice) => {
                const isSelected =
                  voiceSettings.engine === 'sarvam_hd' &&
                  voiceSettings.sarvamVoice === voice.id;
                const isPlaying = testingVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    onClick={() => handleSelectSarvamVoice(voice.id)}
                    className={`group relative flex min-h-[300px] cursor-pointer flex-col rounded-2xl border p-4 transition-all sm:p-5 ${
                      isSelected
                        ? 'border-amber-400 bg-[#fffaf0] shadow-md ring-2 ring-amber-200'
                        : 'border-[#e8e3d8] bg-[#fbfaf7] hover:-translate-y-0.5 hover:border-amber-300 hover:bg-white hover:shadow-md'
                    }`}
                    id={`voice-card-sarvam-${voice.id}`}
                  >
                    {isSelected && (
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-1 text-[9px] font-black text-amber-950">
                        <Check className="h-3 w-3" /> Selected
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <span className="text-4xl leading-none">{voice.avatar}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-lg font-black text-[#292929]">{voice.name}</h4>
                          {isSelected && <span className="text-amber-500">✓</span>}
                        </div>
                        <p className="mt-0.5 text-[11px] font-black text-amber-800">
                          {VOICE_LANGUAGE_LABELS[voice.id]?.[selectedLanguage] ||
                            (voice.gender === 'female' ? 'Female voice' : 'Male voice')}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-stone-600">{voice.tone}</p>

                    <div className="mt-5 grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-center">
                        <div className="mb-1 text-xl">📖</div>
                        <p className="text-[11px] font-black text-stone-700">Story Time</p>
                        <p className="mt-1 text-[9px] text-stone-500">Listen to stories</p>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-center">
                        <div className="mb-1 text-xl">🎧</div>
                        <p className="text-[11px] font-black text-stone-700">Listen &amp; Repeat</p>
                        <p className="mt-1 text-[9px] text-stone-500">Hear a word, then say it</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handlePlayVoicePreview(e, voice.id)}
                      className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition-all ${
                        isPlaying
                          ? 'animate-pulse bg-amber-500 text-white'
                          : 'border border-stone-200 bg-white text-stone-800 hover:border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="h-3 w-3 fill-current" /> Playing...
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5 text-amber-700" /> Audition {voice.name}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-[#e8e3d8] bg-[#fcfbf8] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
                    <Sliders className="h-4 w-4 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#292929]">Narration Speed</p>
                    <p className="text-[10px] text-stone-500">Used for voice samples and word practice</p>
                  </div>
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <span className="text-[10px] font-bold text-stone-500">0.6x</span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.3"
                    step="0.05"
                    value={voiceSettings.rate}
                    onChange={(e) => kidSpeech.updateSettings({ rate: parseFloat(e.target.value) })}
                    className="w-full cursor-pointer accent-amber-500 sm:w-32"
                    id="voice-speed-slider-setup"
                  />
                  <span className="text-[10px] font-bold text-stone-500">1.3x</span>
                  <span className="min-w-[52px] rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-center text-xs font-black text-amber-950">
                    {voiceSettings.rate.toFixed(2)}x
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Microphone */}
          <div className="rounded-[26px] border border-[#e5dfd2] bg-white p-5 shadow-[0_10px_28px_rgba(71,61,45,0.055)] sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-black text-emerald-900">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#292929]">Check Your Microphone</h3>
                  <p className="mt-0.5 text-xs font-medium text-stone-500">Make sure your microphone can hear you</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleMicTesting}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-all ${
                  isMicTesting
                    ? 'animate-pulse bg-rose-600 text-white'
                    : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                }`}
                id="btn-test-mic-stream"
              >
                {isMicTesting ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" /> Stop Mic
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" /> Test Mic
                  </>
                )}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-[#e8e3d8] bg-[#fbfaf7] p-5">
                <div className="mb-3 flex items-center justify-between text-sm font-bold text-stone-700">
                  <span className="flex items-center gap-2">
                    <Radio className={`h-4 w-4 ${isMicTesting ? 'animate-pulse text-emerald-600' : 'text-stone-400'}`} />
                    Live Audio Input
                  </span>
                  <span className="text-lg font-black text-stone-900">{micVolumeLevel}%</span>
                </div>

                <div className="relative h-8 overflow-hidden rounded-full bg-stone-200">
                  <div className="absolute inset-y-0 left-[20%] right-[35%] border-x border-emerald-400/50 bg-emerald-400/20" />
                  <motion.div
                    animate={{ width: `${micVolumeLevel}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className={`relative z-10 h-full rounded-full ${
                      micVolumeLevel > 75
                        ? 'bg-rose-500'
                        : micVolumeLevel >= 15
                        ? 'bg-emerald-500'
                        : 'bg-amber-400'
                    }`}
                  />
                </div>

                <div className="mt-3 flex items-start justify-between gap-3 text-xs font-semibold text-stone-600">
                  <span>{micStatusMessage}</span>
                  {testedMicVolume && (
                    <span className="flex shrink-0 items-center gap-1 font-bold text-emerald-700">
                      <Check className="h-3.5 w-3.5 stroke-[3]" /> Calibrated
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                    🎤
                  </div>
                  <p className="text-base font-black text-stone-900">Let’s hear your voice!</p>
                  <p className="mt-1 text-xs text-stone-600">Tap Test Mic, then say a few words naturally.</p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-100 bg-white p-3 text-center">
                    <div className="mb-1 text-xl">🗣️</div>
                    <p className="text-[11px] font-black text-stone-800">Say it aloud</p>
                    <p className="mt-1 text-[9px] leading-relaxed text-stone-500">Use your normal reading voice.</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-white p-3 text-center">
                    <div className="mb-1 text-xl">📊</div>
                    <p className="text-[11px] font-black text-stone-800">Watch the meter</p>
                    <p className="mt-1 text-[9px] leading-relaxed text-stone-500">It moves when your mic hears you.</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-emerald-100 bg-white/90 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold text-stone-700">💡 Try saying the practice sentence below.</p>
                </div>
              </div>

              {micPermissionDenied && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>Microphone access was denied. Please allow mic permissions in your browser.</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Step 3 */}
        <section className="rounded-[26px] border border-[#e5dfd2] bg-white p-5 shadow-[0_10px_28px_rgba(71,61,45,0.055)] sm:p-6">
          <div className="flex flex-col gap-4 border-b border-stone-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sm font-black text-sky-900">
                3
              </div>
              <div>
                <h3 className="text-lg font-black text-[#292929]">Pronunciation Try-Out</h3>
                <p className="mt-0.5 text-xs font-medium text-stone-500">
                  Class {classNumber} • Practise this {selectedLanguage} sentence
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleSpeechTest}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                isRecognitionTesting
                  ? 'animate-pulse bg-rose-600 text-white'
                  : 'bg-amber-500 text-stone-950 shadow-sm hover:bg-amber-600'
              }`}
              id="btn-test-speech-rec"
            >
              {isRecognitionTesting ? (
                <>
                  <Square className="h-3.5 w-3.5 fill-current" /> Stop Listening
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" /> Speak Phrase
                </>
              )}
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-[#eee8dc] bg-[#fffdfa] p-4 sm:p-6">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-black text-sky-800">
                <HelpCircle className="h-3.5 w-3.5" />
                Tap a word to hear it, or speak the full phrase
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 py-2">
                {currentPhrase.words.map((word, idx) => {
                  const status = lastPronunciationResult?.wordStatuses?.[idx] ||
                    (matchedIndices.includes(idx) ? 'correct' : 'pending');
                  const romanWord = transliterationWords[idx] || '';

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleTestSpecificWord(word)}
                      className={`flex min-w-[82px] flex-col items-center rounded-xl border px-3 py-2.5 shadow-sm transition-all ${
                        status === 'correct'
                          ? 'scale-105 border-emerald-600 bg-emerald-500 text-white ring-2 ring-emerald-200'
                          : status === 'wrong'
                          ? 'border-rose-600 bg-rose-500 text-white ring-2 ring-rose-200'
                          : 'border-[#e8e1d4] bg-white text-stone-800 hover:border-amber-400 hover:bg-amber-50'
                      }`}
                      title={`Hear ${word} in ${selectedLanguage}; ${romanWord} is only the pronunciation guide`}
                      id={`test-word-token-${idx}`}
                    >
                      <span className="text-sm font-black sm:text-base">{word}</span>
                      <span className={`mt-0.5 text-[10px] font-semibold ${status !== 'pending' ? 'text-white/90' : 'text-stone-500'}`}>
                        {romanWord}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-5 text-xs font-semibold italic text-amber-900">
                Romanized guide: “{currentPhrase.transliteration}”
              </p>
              <p className="mt-1 text-[11px] text-stone-500">English meaning: {currentPhrase.english}</p>
            </div>
          </div>

          {pronunciationError && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{pronunciationError}</span>
            </div>
          )}

          {pronunciationCompleted && lastPronunciationResult && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-stone-900">Great job! Here’s your result.</p>
                  <p className="text-[10px] text-stone-500">Your practice score is ready.</p>
                </div>
                <Award className="h-6 w-6 text-amber-500" />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-emerald-100 bg-white p-3 text-center">
                  <div className="text-xl font-black text-emerald-800">{Math.round(lastPronunciationResult.accuracy)}%</div>
                  <div className="mt-0.5 text-[9px] font-black uppercase text-emerald-700">Accuracy</div>
                </div>
                <div className="rounded-xl border border-sky-100 bg-white p-3 text-center">
                  <div className="text-xl font-black text-sky-800">{lastPronunciationResult.wpm}</div>
                  <div className="mt-0.5 text-[9px] font-black uppercase text-sky-700">WPM</div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-white p-3 text-center">
                  <div className="text-xl font-black text-amber-800">{lastPronunciationResult.fluency}%</div>
                  <div className="mt-0.5 text-[9px] font-black uppercase text-amber-700">Fluency</div>
                </div>
              </div>

              <p className="mt-3 text-[10px] leading-relaxed text-stone-500">
                Fluency combines pronunciation accuracy with reading speed. Sarvam Saaras transcript scoring does not directly measure accent acoustics.
              </p>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleRetryPronunciation}
                  className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-stone-800 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </button>
                <button
                  type="button"
                  onClick={handleContinuePronunciation}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-700"
                >
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {isRecognitionTesting && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
              <div className="flex items-center justify-between gap-3 font-black">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-ping rounded-full bg-sky-500" />
                  Listening in {selectedLanguage}...
                </span>
                <span className="rounded-md bg-sky-200 px-2 py-1 text-sky-900">
                  {Math.round(speechAccuracy)}% Match
                </span>
              </div>
              {recognitionTranscript && (
                <p className="mt-2 text-[11px] font-medium text-sky-800">
                  Heard: <span className="font-bold">“{recognitionTranscript}”</span>
                </p>
              )}
            </div>
          )}
        </section>

        {/* Final action bar */}
        <section className="sticky bottom-3 z-20 rounded-[24px] border border-[#e2dccf] bg-white/95 p-4 shadow-[0_14px_40px_rgba(44,39,31,0.14)] backdrop-blur-md sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300 bg-amber-100 text-xl">
                {currentVoiceAvatar}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-stone-700">Active Setup</span>
                  <span className="rounded-md bg-amber-400 px-2 py-1 text-[10px] font-black text-amber-950">
                    {currentVoiceName} · {voiceSettings.rate.toFixed(2)}x
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-stone-500">
                  {pendingStory
                    ? `Ready to read: “${resolvedStoryToRead?.title ?? pendingStory.title}”`
                    : 'Settings saved for all storybooks in the library'}
                </p>
                {languageSwitchHasNoStory && (
                  <p className="mt-0.5 text-[10px] font-bold text-rose-600">
                    No {selectedLanguage} story is available yet — the original story will be used.
                  </p>
                )}
              </div>
            </div>

            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              <button
                type="button"
                onClick={onNavigateBack}
                className="rounded-xl border border-[#e5dfd2] bg-[#f6f3eb] px-4 py-2.5 text-xs font-black text-stone-700 transition hover:bg-[#ece7db] sm:px-5 sm:text-sm"
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
                  className="group flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-stone-950 shadow-sm transition hover:bg-amber-600 sm:px-6 sm:text-sm"
                  id="btn-voice-setup-start-reading"
                >
                  Start Reading Now
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onNavigateBack}
                  className="group flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-stone-950 shadow-sm transition hover:bg-amber-600 sm:px-6 sm:text-sm"
                  id="btn-voice-setup-explore-stories"
                >
                  Choose a Story to Read
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
