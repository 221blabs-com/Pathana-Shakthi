import {
  Language,
  KidVoiceProfile,
  KidVoiceProfileId,
  VoiceEngineType,
  GeminiNeuralVoiceId,
  GeminiVoiceOption,
  VoiceSettingsState,
} from '../types';
import {
  getAudioContext,
  pcmBase64ToAudioBuffer,
  pcmToWavBlobUrl,
} from '../utils/audioUtils';

export const GEMINI_NEURAL_VOICES: GeminiVoiceOption[] = [
  {
    id: 'Kore',
    name: 'Kore',
    nativeTitle: 'కోరే (Kore - మధుర గురువు)',
    gender: 'female',
    tone: 'Warm, inspiring primary teacher with natural Indian cadence',
    avatar: '👩‍🏫',
    bestFor: 'Story narration & primary reading guidance',
    samplePhrase: {
      Telugu: 'నమస్కారం! నేను కోరే! నాతో కలిసి ప్రతి అక్షరం స్పష్టంగా చదువుదాం!',
      Hindi: 'नमस्ते! मैं कोरे हूँ! चलो मिलकर हर शब्द को सुंदर ढंग से पढ़ें!',
      English: 'Hello wonderful learner! I am Kore! Let us read each sentence with joy and confidence!',
    },
  },
  {
    id: 'Puck',
    name: 'Puck',
    nativeTitle: 'పక్ (Puck - చురుకైన మిత్రుడు)',
    gender: 'male',
    tone: 'Playful, enthusiastic storybook companion full of spark',
    avatar: '👦',
    bestFor: 'High-engagement adventures & fun phonics',
    samplePhrase: {
      Telugu: 'హాయ్ ఫ్రెండ్! నేను పక్! ఈ రోజు ఒక సూపర్ కథ చదువుకుందామా?',
      Hindi: 'अरे दोस्त! मैं पक हूँ! आज एक मजेदार कहानी साथ में पढ़ेंगे!',
      English: 'Hey there buddy! I am Puck! Ready for an amazing story adventure?',
    },
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    nativeTitle: 'జెఫిర్ (Zephyr - శాంతమయి)',
    gender: 'female',
    tone: 'Gentle, soothing & patient guidance voice',
    avatar: '👧',
    bestFor: 'Class 1-2 beginners & slow syllable decoding',
    samplePhrase: {
      Telugu: 'హలో చిన్నారి! నేను జెఫిర్! నెమ్మదిగా, చక్కగా నేర్చుకుందాం!',
      Hindi: 'नमस्ते प्यारे बच्चे! मैं ज़ेफ़िर हूँ! धीरे-धीरे और आराम से सीखेंगे!',
      English: 'Hello little star! I am Zephyr! Let us take our time and read softly together.',
    },
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    nativeTitle: 'ఫెన్రిర్ (Fenrir - శక్తిమంతుడు)',
    gender: 'male',
    tone: 'Dynamic, confident rhythm with punchy pronunciation',
    avatar: '🧒',
    bestFor: 'Class 3-5 reading fluency & speed building',
    samplePhrase: {
      Telugu: 'జై హో! నేను ఫెన్రిర్! మన పఠన వేగాన్ని, నైపుణ్యాన్ని పెంచుకుందాం!',
      Hindi: 'शाबाश! मैं फेनरिर हूँ! चलो अपनी पढ़ने की रफ़्तार और समझ को बढ़ाते हैं!',
      English: 'Super charge! I am Fenrir! Let us master our reading fluency together!',
    },
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    nativeTitle: 'ఆయోడ్ (Aoede - గాన కోకిల)',
    gender: 'female',
    tone: 'Melodic, expressive poetic storyteller cadence',
    avatar: '✨',
    bestFor: 'Moral stories, Panchatantra & poems',
    samplePhrase: {
      Telugu: 'స్వాగతం! నేను ఆయోడ్! కథలలోని భావాన్ని అనుభవిస్తూ చదువుదాం!',
      Hindi: 'स्वागत है! मैं आओएडे हूँ! कहानियों के भाव को महसूस करते हुए पढ़ेंगे!',
      English: 'Welcome! I am Aoede! Let us explore the rhythm and music in every story.',
    },
  },
  {
    id: 'Charon',
    name: 'Charon',
    nativeTitle: 'చారోన్ (Charon - జ్ఞాన దర్శి)',
    gender: 'male',
    tone: 'Calm, steady, reassuring narrator cadence',
    avatar: '🎙️',
    bestFor: 'Science, EVS & informational chapters',
    samplePhrase: {
      Telugu: 'నమస్తే! నేను చారోన్! కొత్త విషయాలు మరియు విజ్ఞానాన్ని గ్రహిద్దాం!',
      Hindi: 'नमस्ते! मैं चारोन हूँ! आओ नए ज्ञान और विज्ञान को समझें!',
      English: 'Greetings! I am Charon! Let us discover the wonders of science and knowledge.',
    },
  },
];

export const DEFAULT_KID_VOICE_PROFILES: KidVoiceProfile[] = [
  {
    id: 'ananya',
    name: 'Ananya',
    nativeName: 'అనన్య (చిరునవ్వు బాలిక)',
    avatar: '👧',
    gender: 'girl',
    pitch: 1.55,
    rate: 0.90,
    accent: 'Telugu & Indian Cadence',
    description: 'High-energy, cheerful girl voice with bright enthusiastic tone',
    samplePhrase: {
      Telugu: 'హాయ్! నేను అనన్యని! నాతో కలిసి సరదాగా కథలు చదువుదాం!',
      Hindi: 'नमस्ते! मैं अनन्या हूँ! चलो मिलकर मज़ेदार कहानियाँ पढ़ते हैं!',
      English: 'Hi! I am Ananya! Let us read wonderful stories together!',
    },
  },
  {
    id: 'rohan',
    name: 'Rohan',
    nativeName: 'రోహన్ (చురుకైన బాలుడు)',
    avatar: '👦',
    gender: 'boy',
    pitch: 1.25,
    rate: 0.88,
    accent: 'Indian National Cadence',
    description: 'Playful boy buddy with engaging, friendly storytelling cadence',
    samplePhrase: {
      Telugu: 'నమస్కారం! నేను రోహన్! మనం కొత్త పదాలు నేర్చుకుందాం!',
      Hindi: 'नमस्ते! मैं रोहन हूँ! चलो आज नए शब्द सीखते हैं!',
      English: 'Hello! I am Rohan! Ready to discover exciting new words?',
    },
  },
  {
    id: 'chintu',
    name: 'Chintu',
    nativeName: 'చింటూ (చిన్నారి మిత్రుడు)',
    avatar: '🧒',
    gender: 'boy',
    pitch: 1.70,
    rate: 0.80,
    accent: 'Gentle Phonics Pace',
    description: 'Extra clear, slow kid voice ideal for Class 1-2 early phonics',
    samplePhrase: {
      Telugu: 'హలో దోస్త్! నేను చింటూని! నెమ్మదిగా అక్షరాలు పలుకుదాం!',
      Hindi: 'हेलो दोस्त! मैं चिंटू हूँ! आराम से धीरे-धीरे पढ़ेंगे!',
      English: 'Hello friend! I am Chintu! Let us pronounce words step by step!',
    },
  },
  {
    id: 'deepa',
    name: 'Deepa Akka',
    nativeName: 'దీపా అక్క (మార్గదర్శి)',
    avatar: '👩‍🏫',
    gender: 'girl',
    pitch: 1.35,
    rate: 0.84,
    accent: 'Melodic Storyteller',
    description: 'Warm, patient elder sister voice for supportive guidance',
    samplePhrase: {
      Telugu: 'నమస్తే పిల్లలూ! నేను దీపా అక్కని! శ్రద్ధగా చదివి చాంపియన్ అవుదాం!',
      Hindi: 'नमस्ते बच्चों! मैं दीपा दीदी हूँ! ध्यान से पढ़ेंगे और आगे बढ़ेंगे!',
      English: 'Welcome little stars! I am Deepa! Let us read with confidence and joy!',
    },
  },
];

export interface KidSpeechOptions {
  pitch?: number; // 0.5 to 2.0
  rate?: number; // 0.5 to 2.0
  volume?: number;
  engine?: VoiceEngineType;
  geminiVoice?: GeminiNeuralVoiceId;
  style?: 'cheerful_teacher' | 'gentle_storyteller' | 'slow_phonics';
  onStart?: () => void;
  onWordBoundary?: (charIndex: number, word: string) => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

class KidSpeechService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;

  // Active voice settings
  private settings: VoiceSettingsState = {
    engine: 'gemini_neural', // Default to best Gemini Neural Voice!
    kidProfileId: 'ananya',
    geminiVoice: 'Kore',
    rate: 0.90,
    pitch: 1.35,
    volume: 1.0,
    autoPronounceSlowPhonics: true,
    streamNeuralAudio: true,
  };

  // Audio Node & Buffer tracking for Web Audio API playback
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isSpeaking = false;
  private audioCache = new Map<string, AudioBuffer>();
  private wordTimer: any = null;

  private listeners: Array<(settings: VoiceSettingsState) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pathana_shakthi_voice_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.settings = { ...this.settings, ...parsed };
        } catch (e) {
          console.warn('Failed to parse saved voice settings', e);
        }
      }

      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
          speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    this.isInitialized = true;
  }

  public getSettings(): VoiceSettingsState {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<VoiceSettingsState>) {
    this.settings = { ...this.settings, ...partial };
    if (typeof window !== 'undefined') {
      localStorage.setItem('pathana_shakthi_voice_settings', JSON.stringify(this.settings));
    }
    this.notifyListeners();
  }

  public subscribe(listener: (settings: VoiceSettingsState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getSettings());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    const curr = this.getSettings();
    this.listeners.forEach((fn) => fn(curr));
  }

  public getActiveGeminiVoice(): GeminiVoiceOption {
    return (
      GEMINI_NEURAL_VOICES.find((v) => v.id === this.settings.geminiVoice) ||
      GEMINI_NEURAL_VOICES[0]
    );
  }

  public getActiveKidProfile(): KidVoiceProfile {
    return (
      DEFAULT_KID_VOICE_PROFILES.find((p) => p.id === this.settings.kidProfileId) ||
      DEFAULT_KID_VOICE_PROFILES[0]
    );
  }

  public getAllGeminiVoices(): GeminiVoiceOption[] {
    return GEMINI_NEURAL_VOICES;
  }

  public getAllKidProfiles(): KidVoiceProfile[] {
    return DEFAULT_KID_VOICE_PROFILES;
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking || (this.synth ? this.synth.speaking : false);
  }

  /**
   * Primary Smart Speak Router:
   * Uses Gemini Studio Neural Voice (24kHz HD) when online & enabled,
   * with seamless fallback to client-side Web Speech Synthesis.
   */
  public async speakText(
    text: string,
    lang: Language,
    options: KidSpeechOptions = {}
  ): Promise<void> {
    this.stop(); // Clear any ongoing audio

    const engine = options.engine || this.settings.engine;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (engine === 'gemini_neural' && isOnline) {
      try {
        await this.speakGeminiNeuralAudio(text, lang, options);
        return;
      } catch (err) {
        // Graceful fallback to browser native speech synthesis
      }
    }

    // Browser Native Speech Synthesis fallback
    this.speakNativeBrowser(text, lang, options);
  }

  /**
   * High-Fidelity Gemini Studio TTS Engine (24kHz Studio Quality)
   */
  public async speakGeminiNeuralAudio(
    text: string,
    lang: Language,
    options: KidSpeechOptions = {}
  ): Promise<void> {
    const voiceName = options.geminiVoice || this.settings.geminiVoice || 'Kore';
    const style = options.style || 'cheerful_teacher';
    const cacheKey = `${voiceName}_${lang}_${style}_${text.trim()}`;

    options.onStart?.();
    this.isSpeaking = true;

    try {
      let audioBuffer = this.audioCache.get(cacheKey);

      if (!audioBuffer) {
        // Fetch from backend Gemini Studio TTS endpoint
        const response = await fetch('/api/speech/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            language: lang,
            voiceName,
            style,
          }),
        });

        if (!response.ok) {
          throw new Error(`TTS API returned status ${response.status}`);
        }

        const data = await response.json();
        if (!data.audioBase64) {
          throw new Error('No audio data returned from Gemini TTS');
        }

        audioBuffer = pcmBase64ToAudioBuffer(data.audioBase64, data.sampleRate || 24000);
        this.audioCache.set(cacheKey, audioBuffer);
      }

      // Play via Web Audio API with Analyser Node for Live Waveform Visualization
      const ctx = getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Rate playback adjustment
      const targetRate = options.rate ?? this.settings.rate;
      source.playbackRate.value = Math.max(0.6, Math.min(1.4, targetRate));

      const gainNode = ctx.createGain();
      gainNode.gain.value = options.volume ?? this.settings.volume;

      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 64;

      source.connect(gainNode);
      gainNode.connect(this.analyserNode);
      this.analyserNode.connect(ctx.destination);

      this.currentSourceNode = source;

      // Calculate approximate word boundaries for synchronized karaoke highlight
      const duration = audioBuffer.duration / source.playbackRate.value;
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length > 0 && options.onWordBoundary) {
        const timePerWord = (duration * 1000) / words.length;
        let wordIdx = 0;
        let charCounter = 0;

        this.wordTimer = setInterval(() => {
          if (wordIdx < words.length && this.isSpeaking) {
            const currentWord = words[wordIdx];
            options.onWordBoundary?.(charCounter, currentWord);
            charCounter += currentWord.length + 1;
            wordIdx++;
          } else {
            clearInterval(this.wordTimer);
          }
        }, timePerWord);
      }

      source.onended = () => {
        this.isSpeaking = false;
        clearInterval(this.wordTimer);
        this.currentSourceNode = null;
        options.onEnd?.();
      };

      source.start(0);
    } catch (err) {
      this.isSpeaking = false;
      clearInterval(this.wordTimer);
      options.onError?.(err);
      throw err;
    }
  }

  /**
   * Browser Speech Synthesis fallback (Client-side offline)
   */
  public speakNativeBrowser(text: string, lang: Language, options: KidSpeechOptions = {}) {
    if (!this.synth) {
      options.onEnd?.();
      return;
    }

    this.stop();
    this.isSpeaking = true;
    options.onStart?.();

    const profile = this.getActiveKidProfile();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.getBestVoiceForLanguage(lang);
    if (voice) {
      utterance.voice = voice;
    }

    const langCodeMap: Record<Language, string> = {
      Telugu: 'te-IN',
      Hindi: 'hi-IN',
      English: 'en-IN',
    };
    utterance.lang = langCodeMap[lang] || 'en-US';

    utterance.pitch = options.pitch ?? this.settings.pitch;
    utterance.rate = options.rate ?? this.settings.rate;
    utterance.volume = options.volume ?? this.settings.volume;

    if (options.onWordBoundary) {
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const charIdx = event.charIndex;
          const sub = text.substring(charIdx);
          const word = sub.split(/[\s,।!?.]+/)[0] || '';
          options.onWordBoundary!(charIdx, word);
        }
      };
    }

    utterance.onend = () => {
      this.isSpeaking = false;
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isSpeaking = false;
      options.onError?.(e);
      options.onEnd?.();
    };

    this.synth.speak(utterance);
  }

  /**
   * Get audio frequency level (0 to 1) for live waveform & visualizer animation
   */
  public getLiveAudioLevel(): number {
    if (!this.analyserNode || !this.isSpeaking) return 0;
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / (data.length * 255);
  }

  public getBestVoiceForLanguage(lang: Language): SpeechSynthesisVoice | null {
    if (!this.voices.length) this.loadVoices();
    const profile = this.getActiveKidProfile();
    const isGirl = profile.gender === 'girl';

    const langCodeMap: Record<Language, string[]> = {
      Telugu: ['te-IN', 'te', 'hi-IN', 'en-IN'],
      Hindi: ['hi-IN', 'hi', 'en-IN', 'hi_IN'],
      English: ['en-IN', 'en-US', 'en-GB', 'en-AU'],
    };

    const targetCodes = langCodeMap[lang] || ['en-US'];

    for (const code of targetCodes) {
      const matches = this.voices.filter(
        (v) =>
          v.lang.toLowerCase().startsWith(code.toLowerCase()) ||
          v.lang.toLowerCase().replace('_', '-').startsWith(code.toLowerCase())
      );
      if (matches.length > 0) {
        const genderMatch = matches.find((v) =>
          isGirl
            ? /female|woman|zira|sangeeta|heera|priya|swara/i.test(v.name)
            : /male|man|david|ravi|george|mark|karan/i.test(v.name)
        );
        if (genderMatch) return genderMatch;
        return matches[0];
      }
    }

    const indianVoices = this.voices.filter((v) => v.lang.includes('IN') || v.name.includes('India'));
    if (indianVoices.length > 0) {
      const genderMatch = indianVoices.find((v) =>
        isGirl ? /female|woman|sangeeta|heera/i.test(v.name) : /male|man|ravi/i.test(v.name)
      );
      if (genderMatch) return genderMatch;
      return indianVoices[0];
    }

    return this.voices[0] || null;
  }

  // Speak single word slowly with high kid pitch for phonics exploration
  public speakSlowWord(word: string, lang: Language, onEnd?: () => void) {
    this.speakText(word, lang, {
      style: 'slow_phonics',
      rate: this.settings.rate * 0.75,
      pitch: Math.min(1.8, this.settings.pitch * 1.08),
      onEnd,
    });
  }

  // Preview a specific Gemini Neural Voice with sample phrase
  public previewGeminiVoice(voiceId: GeminiNeuralVoiceId, lang: Language, onEnd?: () => void) {
    const voice = GEMINI_NEURAL_VOICES.find((v) => v.id === voiceId) || GEMINI_NEURAL_VOICES[0];
    const phrase = voice.samplePhrase[lang] || voice.samplePhrase.English;
    this.speakText(phrase, lang, {
      engine: 'gemini_neural',
      geminiVoice: voiceId,
      onEnd,
    });
  }

  // Preview a specific Kid Profile with sample phrase
  public previewKidProfile(profileId: KidVoiceProfileId, lang: Language, onEnd?: () => void) {
    const profile = DEFAULT_KID_VOICE_PROFILES.find((p) => p.id === profileId);
    if (!profile) return;

    const sample = profile.samplePhrase[lang] || profile.samplePhrase.English;
    this.speakText(sample, lang, {
      engine: 'browser_native',
      pitch: profile.pitch,
      rate: profile.rate,
      onEnd,
    });
  }

  // Cheerful kid encouragement phrases
  public playEncouragement(lang: Language, onEnd?: () => void) {
    const praises: Record<Language, string[]> = {
      Telugu: [
        'శభాష్! చాలా బాగా చదివావు!',
        'సూపర్! నువ్వు స్టార్ రీడర్ వి!',
        'అద్భుతం! భలే చదివావు!',
        'వావ్! ఇంకోటి చదువుదామా!',
      ],
      Hindi: [
        'शाबाश! बहुत अच्छा पढ़ा!',
        'वाह! तुम तो स्टार रीडर हो!',
        'बहुत बढ़िया! कमाल कर दिया!',
        'अरे वाह! सुपर प्रयास!',
      ],
      English: [
        'Awesome reading! You are a superstar!',
        'High five! Fantastic job!',
        'Super clear reading! You got it!',
        'Brilliant! Keep shining!',
      ],
    };

    const list = praises[lang] || praises.English;
    const randomPhrase = list[Math.floor(Math.random() * list.length)];

    this.speakText(randomPhrase, lang, {
      style: 'cheerful_teacher',
      pitch: Math.min(1.8, this.settings.pitch * 1.05),
      rate: this.settings.rate * 1.05,
      onEnd,
    });
  }

  // Gentle kid encouragement for try again
  public playTryAgainEncouragement(lang: Language, onEnd?: () => void) {
    const hints: Record<Language, string[]> = {
      Telugu: ['పర్వాలేదు! ఇంకోసారి నెమ్మదిగా చదువుదాం!', 'మళ్ళీ ప్రయత్నించు, నువ్వు చేయగలవు!'],
      Hindi: ['कोई बात नहीं! एक बार फिर आराम से पढ़ेंगे!', 'फिर से कोशिश करो, तुम कर सकते हो!'],
      English: ['No worries! Let us try reading it once more together!', 'You can do it! Give it another shot!'],
    };

    const list = hints[lang] || hints.English;
    const phrase = list[Math.floor(Math.random() * list.length)];

    this.speakText(phrase, lang, {
      style: 'cheerful_teacher',
      rate: this.settings.rate * 0.95,
      onEnd,
    });
  }

  public stop() {
    this.isSpeaking = false;
    if (this.wordTimer) {
      clearInterval(this.wordTimer);
      this.wordTimer = null;
    }
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
      } catch (e) {}
      this.currentSourceNode = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public pause() {
    if (this.synth) {
      this.synth.pause();
    }
  }

  public resume() {
    if (this.synth) {
      this.synth.resume();
    }
  }
}

export const kidSpeech = new KidSpeechService();
