import {
  Language,
  KidVoiceProfile,
  KidVoiceProfileId,
  VoiceEngineType,
  SarvamNeuralVoiceId,
  SarvamVoiceOption,
  VoiceSettingsState,
} from '../types';
import {
  getAudioContext,
  pcmBase64ToAudioBuffer,
  pcmToWavBlobUrl,
} from '../utils/audioUtils';

export const SARVAM_VOICES: SarvamVoiceOption[] = [
  {
    id: 'Priya',
    name: 'Priya',
    nativeTitle: {
      Telugu: 'ప్రియ (మహిళా స్వరం)',
      Hindi: 'प्रिया (महिला आवाज़)',
      English: 'Priya (Female Voice)',
    },
    gender: 'female',
    tone: 'Warm, cheerful female storyteller; clear and friendly',
    avatar: '👩',
    bestFor: 'Stories, narration and reading practice',
    samplePhrase: {
      Telugu: 'నమస్కారం పిల్లలూ! మనం కలిసి ఒక మంచి కథ చదువుదాం!',
      Hindi: 'नमस्ते बच्चों! चलो मिलकर एक अच्छी कहानी पढ़ते हैं!',
      English: 'Hello children! Let us read a wonderful story together!',
    },
  },
  {
    id: 'Shubh',
    name: 'Shubh',
    nativeTitle: {
      Telugu: 'శుభ్ (పురుష స్వరం)',
      Hindi: 'शुभ (पुरुष आवाज़)',
      English: 'Shubh (Male Voice)',
    },
    gender: 'male',
    tone: 'Energetic male storyteller; bright, clear and engaging',
    avatar: '👨',
    bestFor: 'Energetic stories and reading practice',
    samplePhrase: {
      Telugu: 'హాయ్ పిల్లలూ! ఈ రోజు మనం ఒక అద్భుతమైన కథను చదువుదాం!',
      Hindi: 'नमस्ते बच्चों! आज हम एक शानदार कहानी पढ़ेंगे!',
      English: 'Hi children! Today we are going to read an amazing story!',
    },
  },
];

// Small, conservative pronunciation fixes for known Telugu compound words.
// We keep the learner-facing text unchanged and only adjust the synthesis input.
// This is intentionally exact-match so we never rewrite arbitrary story content.
//
// PROVISIONAL: 'ఒక' and 'Stream' below are best-effort respellings for two
// mispronunciations reported in QA ("ఒక" read as English "OK"; "Stream" read
// as "tream", dropping the initial consonant cluster). We don't have access
// to play the Sarvam output ourselves, so these need a listen-through after
// deploy — if the fix doesn't land right, adjust the replacement string only
// (the table format and matching logic are already correct).
const TTS_PRONUNCIATION_FIXES: Record<Language, Array<[string, string]>> = {
  Telugu: [
    ['చెట్టుపై', 'చెట్టు పై'],
    ['ఒక', 'ఒ\u200cక'], // ZWNJ breaks the cross-lingual "OK" homophone match
    ['Stream', 'Isstream'],
  ],
  Hindi: [
    ['Stream', 'Isstream'],
  ],
  English: [
    ['Stream', 'Isstream'],
  ],
};

function normalizeTtsInput(text: string, lang: Language): string {
  let result = text;
  for (const [source, spoken] of TTS_PRONUNCIATION_FIXES[lang] || []) {
    result = result.split(source).join(spoken);
  }
  return result;
}

export const KID_PROFILE_TO_SARVAM_VOICE: Record<KidVoiceProfileId, SarvamNeuralVoiceId> = {
  ananya: 'Priya',
  rohan: 'Shubh',
  chintu: 'Priya',
  deepa: 'Shubh',
};

// The visible Voice Studio uses only Priya and Shubh. Legacy kid-profile
// mappings are retained internally for compatibility with older stored settings.

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
  sarvamVoice?: SarvamNeuralVoiceId;
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
    engine: 'sarvam_hd',
    kidProfileId: 'ananya',
    sarvamVoice: 'Priya',
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
  // Bumped on every speakText/speakSarvamAudio call. A pending async TTS
  // request checks its own snapshot against this before it plays audio, so a
  // slower earlier request can never start playing over a newer one. Without
  // this, tapping "Read Aloud" twice quickly (or a re-render firing it again)
  // let two fetches resolve independently and both call source.start(0),
  // producing the reported "Priya is echoing" double-voice playback.
  private playbackGeneration = 0;

  private listeners: Array<(settings: VoiceSettingsState) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pathana_shakthi_voice_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Migrate older builds that stored the Sarvam engine under the old Gemini name.
          if (parsed.engine === 'gemini_neural' || parsed.engine === 'kid_buddies' || parsed.engine === 'browser_native') {
            parsed.engine = 'sarvam_hd';
          }
          if (parsed.sarvamVoice !== 'Priya' && parsed.sarvamVoice !== 'Shubh') {
            parsed.sarvamVoice = 'Priya';
          }
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

  public getActiveSarvamVoice(): SarvamVoiceOption {
    return (
      SARVAM_VOICES.find((v) => v.id === this.settings.sarvamVoice) ||
      SARVAM_VOICES[0]
    );
  }

  public getActiveKidProfile(): KidVoiceProfile {
    return (
      DEFAULT_KID_VOICE_PROFILES.find((p) => p.id === this.settings.kidProfileId) ||
      DEFAULT_KID_VOICE_PROFILES[0]
    );
  }

  public getAllSarvamVoices(): SarvamVoiceOption[] {
    return SARVAM_VOICES;
  }

  public getAllKidProfiles(): KidVoiceProfile[] {
    return DEFAULT_KID_VOICE_PROFILES;
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking || (this.synth ? this.synth.speaking : false);
  }

  /**
   * Primary Smart Speak Router:
   * Uses Sarvam Bulbul v3 (24kHz HD) when online & enabled,
   * with browser speech used only when the device is offline.
   */
  public async speakText(
    text: string,
    lang: Language,
    options: KidSpeechOptions = {}
  ): Promise<void> {
    this.stop(); // Clear any ongoing audio

    const engine = options.engine || this.settings.engine;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if ((engine === 'sarvam_hd' || engine === 'kid_buddies') && isOnline) {
      await this.speakSarvamAudio(text, lang, options);
      return;
    }

    if ((engine === 'sarvam_hd' || engine === 'kid_buddies') && !isOnline) {
      // Offline mode is the only case where the browser voice is used.
      this.speakNativeBrowser(text, lang, options);
      return;
    }

    this.speakNativeBrowser(text, lang, options);
  }

  /**
   * High-Fidelity Sarvam Bulbul v3 TTS Engine (24kHz)
   */
  public async speakSarvamAudio(
    text: string,
    lang: Language,
    options: KidSpeechOptions = {}
  ): Promise<void> {
    const requestedVoice = options.sarvamVoice || this.settings.sarvamVoice || 'Priya';
    const voiceName: SarvamNeuralVoiceId = requestedVoice === 'Shubh' ? 'Shubh' : 'Priya';
    const style = options.style || 'cheerful_teacher';
    const ttsText = normalizeTtsInput(text, lang);
    const pace = options.rate ?? this.settings.rate;
    const cacheKey = `${voiceName}_${lang}_${style}_${pace}_${ttsText.trim()}`;

    // Claim this playback slot. If another speakText/speakSarvamAudio call
    // starts before this one finishes fetching, myGeneration will no longer
    // match this.playbackGeneration and this call bails out instead of
    // playing over the newer request.
    const myGeneration = ++this.playbackGeneration;

    options.onStart?.();
    this.isSpeaking = true;

    // Resume Web Audio during the user gesture, before the async network request.
    // Safari/macOS can keep an AudioContext suspended if it is first created after await.
    const audioCtx = getAudioContext();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    if (audioCtx.state !== 'running') {
      throw new Error(`Audio output is not available (AudioContext state: ${audioCtx.state}).`);
    }

    try {
      let audioBuffer = this.audioCache.get(cacheKey);

      if (!audioBuffer) {
        // Fetch from backend Sarvam Bulbul v3 TTS endpoint
        const response = await fetch('/api/speech/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: ttsText,
            language: lang,
            voiceName,
            style,
            pace,
          }),
        });

        if (!response.ok) {
          throw new Error(`TTS API returned status ${response.status}`);
        }

        // Same non-JSON guard as speechRecognition.ts: fail with a clear
        // message instead of a raw "Unexpected token" JSON parse crash.
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const bodyPreview = (await response.text()).slice(0, 200);
          console.error('TTS endpoint returned non-JSON response:', response.status, bodyPreview);
          throw new Error('Narration service is not available right now. Please try again in a moment.');
        }

        const data = await response.json();
        if (!data.audioBase64) {
          throw new Error('No audio data returned from Sarvam TTS');
        }

        const wavBytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
        const wavBuffer = wavBytes.buffer;
        audioBuffer = await audioCtx.decodeAudioData(wavBuffer.slice(0));
        this.audioCache.set(cacheKey, audioBuffer);
      }

      // Play via Web Audio API with Analyser Node for Live Waveform Visualization
      if ((audioCtx.state as AudioContextState) === 'suspended') {
        await audioCtx.resume();
      }
      if (audioCtx.state !== 'running') {
        throw new Error(`Audio output is not available (AudioContext state: ${audioCtx.state}).`);
      }

      // A newer speakText call superseded this one while we were fetching/
      // decoding — drop this audio instead of playing it (fixes echoing).
      if (myGeneration !== this.playbackGeneration) {
        this.isSpeaking = false;
        return;
      }

      const ctx = audioCtx;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = options.volume ?? this.settings.volume;

      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 64;

      source.connect(gainNode);
      gainNode.connect(this.analyserNode);
      this.analyserNode.connect(ctx.destination);

      this.currentSourceNode = source;

      // Calculate approximate word boundaries for synchronized karaoke highlight
      const duration = audioBuffer.duration;
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

  // Pronunciation Try-Out follows the selected Narration Speed exactly.
  public speakSlowWord(word: string, lang: Language, onEnd?: () => void) {
    this.speakText(word, lang, {
      style: 'slow_phonics',
      rate: this.settings.rate,
      pitch: Math.min(1.8, this.settings.pitch * 1.08),
      onEnd,
    });
  }

  /**
   * Warm the Sarvam cache after login so the first character/word tap is fast.
   * Only the selected language is prefetched to avoid wasting API credits.
   */
  public async preloadLanguageAssets(lang: Language, pronunciationWords: string[] = []): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const jobs: Promise<unknown>[] = [];
    for (const voice of SARVAM_VOICES) {
      const phrase = voice.samplePhrase[lang] || voice.samplePhrase.English;
      jobs.push(this.preloadSarvamAudio(phrase, lang, voice.id, 'cheerful_teacher'));
    }


    for (const word of pronunciationWords.slice(0, 12)) {
      jobs.push(this.preloadSarvamAudio(word, lang, this.settings.sarvamVoice, 'slow_phonics'));
    }

    await Promise.allSettled(jobs);
  }

  private async preloadSarvamAudio(
    text: string,
    lang: Language,
    voiceName: SarvamNeuralVoiceId,
    style: KidSpeechOptions['style']
  ): Promise<void> {
    const ttsText = normalizeTtsInput(text, lang);
    const pace = this.settings.rate;
    const cacheKey = `${voiceName}_${lang}_${style}_${pace}_${ttsText.trim()}`;
    if (this.audioCache.has(cacheKey)) return;

    try {
      const response = await fetch('/api/speech/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ttsText,
          language: lang,
          voiceName,
          style,
          pace: this.settings.rate,
        }),
      });
      if (!response.ok) return;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return; // preload is best-effort
      const data = await response.json();
      if (!data.audioBase64) return;
      const wavBytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
      const audioCtx = getAudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(wavBytes.buffer.slice(0));
      this.audioCache.set(cacheKey, audioBuffer);
    } catch {
      // Preloading is an optimization. Playback will retry normally when tapped.
    }
  }

  // Preview a specific Sarvam voice with sample phrase
  public previewSarvamVoice(voiceId: SarvamNeuralVoiceId, lang: Language, onEnd?: () => void) {
    const voice = SARVAM_VOICES.find((v) => v.id === voiceId) || SARVAM_VOICES[0];
    const phrase = voice.samplePhrase[lang] || voice.samplePhrase.English;
    this.speakText(phrase, lang, {
      engine: 'sarvam_hd',
      sarvamVoice: voiceId,
      onEnd,
    });
  }

  // Preview a specific Kid Profile with sample phrase
  public previewKidProfile(profileId: KidVoiceProfileId, lang: Language, onEnd?: () => void) {
    const profile = DEFAULT_KID_VOICE_PROFILES.find((p) => p.id === profileId);
    if (!profile) return;

    const sample = profile.samplePhrase[lang] || profile.samplePhrase.English;
    this.speakText(sample, lang, {
      engine: 'kid_buddies',
      sarvamVoice: KID_PROFILE_TO_SARVAM_VOICE[profileId],
      pitch: profile.pitch,
      rate: this.settings.rate,
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
    this.playbackGeneration++;
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