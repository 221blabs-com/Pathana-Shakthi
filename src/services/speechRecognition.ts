import { Language } from '../types';

export interface SpeechMatchResult {
  transcript: string;
  matchedWordIndices: number[];
  currentWordIndex: number;
  isComplete: boolean;
  accuracy: number;
}

export class SpeechRecognitionService {
  private recognition: any = null;
  private isListening: boolean = false;
  private language: Language = 'Telugu';
  private targetTokens: string[] = [];
  private onResultCallback?: (result: SpeechMatchResult) => void;
  private onErrorCallback?: (err: string) => void;
  private onStatusChangeCallback?: (isListening: boolean) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.setupListeners();
      }
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  private setupListeners() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStatusChangeCallback?.(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onStatusChangeCallback?.(false);
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        this.onErrorCallback?.('Microphone access was denied. Please allow microphone permissions.');
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.onErrorCallback?.(`Speech recognition: ${event.error}`);
      }
    };

    this.recognition.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
      }
      this.processTranscript(fullTranscript);
    };
  }

  private cleanWord(w: string): string {
    return w
      .toLowerCase()
      .trim()
      .replace(/[।,!?.":;()—_`~#@%^*+=/\\<>{}[\]]/g, '');
  }

  // Normalize phonetic variations in Telugu / Hindi / English
  private wordsSimilar(spoken: string, target: string): boolean {
    const s = this.cleanWord(spoken);
    const t = this.cleanWord(target);
    if (!s || !t) return false;

    if (s === t) return true;
    if (s.includes(t) || t.includes(s)) return true;

    // Levenshtein distance tolerance
    const dist = this.levenshtein(s, t);
    const maxLen = Math.max(s.length, t.length);
    if (maxLen <= 3) return dist === 0;
    if (maxLen <= 6) return dist <= 1;
    return dist <= 2;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private processTranscript(transcript: string) {
    if (!this.targetTokens.length) return;

    const spokenWords = transcript.split(/\s+/).map((w) => this.cleanWord(w)).filter(Boolean);
    const matchedIndices: number[] = [];

    let targetIdx = 0;
    for (let s = 0; s < spokenWords.length && targetIdx < this.targetTokens.length; s++) {
      const spoken = spokenWords[s];
      // Check from targetIdx onwards
      for (let t = targetIdx; t < Math.min(this.targetTokens.length, targetIdx + 3); t++) {
        if (this.wordsSimilar(spoken, this.targetTokens[t])) {
          for (let fill = targetIdx; fill <= t; fill++) {
            if (!matchedIndices.includes(fill)) {
              matchedIndices.push(fill);
            }
          }
          targetIdx = t + 1;
          break;
        }
      }
    }

    const accuracy = this.targetTokens.length > 0 ? (matchedIndices.length / this.targetTokens.length) * 100 : 0;
    const isComplete = matchedIndices.length >= Math.max(1, Math.floor(this.targetTokens.length * 0.75));

    this.onResultCallback?.({
      transcript,
      matchedWordIndices: matchedIndices,
      currentWordIndex: Math.min(this.targetTokens.length - 1, matchedIndices.length),
      isComplete,
      accuracy,
    });
  }

  public startListening(
    lang: Language,
    targetSentence: string | string[],
    onResult: (res: SpeechMatchResult) => void,
    onError?: (err: string) => void,
    onStatusChange?: (isListening: boolean) => void
  ) {
    this.language = lang;
    const rawTokens = Array.isArray(targetSentence)
      ? targetSentence
      : (typeof targetSentence === 'string' ? targetSentence.split(/\s+/) : []);
    this.targetTokens = rawTokens.map((w) => this.cleanWord(w)).filter(Boolean);
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onStatusChangeCallback = onStatusChange;

    if (!this.recognition) {
      onError?.('Web Speech Recognition is not supported in this browser. You can still tap words to practice!');
      return;
    }

    const langCodeMap: Record<Language, string> = {
      Telugu: 'te-IN',
      Hindi: 'hi-IN',
      English: 'en-IN',
    };

    this.recognition.lang = langCodeMap[lang] || 'en-IN';

    try {
      this.recognition.start();
    } catch (e) {
      // Already running or active
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
    this.isListening = false;
    this.onStatusChangeCallback?.(false);
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const speechRecognition = new SpeechRecognitionService();
