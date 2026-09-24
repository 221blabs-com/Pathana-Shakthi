import { Language } from '../types';

export interface SpeechMatchResult {
  transcript: string;
  matchedWordIndices: number[];
  currentWordIndex: number;
  isComplete: boolean;
  accuracy: number;
  wordStatuses: Array<'pending' | 'correct' | 'wrong'>;
  durationSeconds: number;
  spokenWordCount: number;
  wpm: number;
  fluency: number;
  languageProbability?: number | null;
}

/**
 * Sarvam-backed reading recognition.
 * The browser records a short WebM clip and the server sends it to
 * Saaras v4. The API key never reaches the browser.
 */
export class SpeechRecognitionService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private isListening = false;
  private language: Language = 'Telugu';
  private targetTokens: string[] = [];
  private onResultCallback?: (result: SpeechMatchResult) => void;
  private onErrorCallback?: (err: string) => void;
  private onStatusChangeCallback?: (isListening: boolean) => void;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private recordingStartedAt = 0;

  public isSupported(): boolean {
    return typeof window !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined';
  }

  private cleanWord(w: string): string {
    return w
      .toLowerCase()
      .trim()
      .replace(/[।,!?.":;()—_`~#@%^*+=/\\<>{}[\]]/g, '');
  }

  private wordsSimilar(spoken: string, target: string): boolean {
    const s = this.cleanWord(spoken);
    const t = this.cleanWord(target);
    if (!s || !t) return false;
    if (s === t || s.includes(t) || t.includes(s)) return true;

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
        matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    return matrix[b.length][a.length];
  }

  private processTranscript(transcript: string, isFinal = false, languageProbability: number | null = null) {
    if (!this.targetTokens.length) return;

    const spokenWords = transcript.split(/\s+/).map((w) => this.cleanWord(w)).filter(Boolean);
    const matchedIndices: number[] = [];
    let targetIdx = 0;

    for (const spoken of spokenWords) {
      if (targetIdx >= this.targetTokens.length) break;
      for (let t = targetIdx; t < Math.min(this.targetTokens.length, targetIdx + 3); t++) {
        if (this.wordsSimilar(spoken, this.targetTokens[t])) {
          if (!matchedIndices.includes(t)) matchedIndices.push(t);
          targetIdx = t + 1;
          break;
        }
      }
    }

    const accuracy = (matchedIndices.length / this.targetTokens.length) * 100;
    const durationSeconds = Math.max(0.5, (Date.now() - this.recordingStartedAt) / 1000);
    const spokenWordCount = spokenWords.length;
    const wpm = Math.round((spokenWordCount / durationSeconds) * 60);
    const targetWpm = this.targetTokens.length <= 5 ? 35 : this.targetTokens.length <= 7 ? 45 : 55;
    const speedScore = Math.min(100, Math.round((wpm / targetWpm) * 100));
    // Saaras provides language probability, not a true accent score. Use it only
    // as a light clarity signal when available; never label it as accent detection.
    const clarityScore = languageProbability == null ? accuracy : Math.round(languageProbability * 100);
    const fluency = Math.round(accuracy * 0.55 + speedScore * 0.30 + clarityScore * 0.15);
    const wordStatuses: Array<'pending' | 'correct' | 'wrong'> = this.targetTokens.map((_, index) =>
      matchedIndices.includes(index) ? 'correct' : isFinal ? 'wrong' : 'pending'
    );

    this.onResultCallback?.({
      transcript,
      matchedWordIndices: matchedIndices,
      currentWordIndex: Math.min(this.targetTokens.length - 1, matchedIndices.length),
      isComplete: isFinal,
      accuracy,
      wordStatuses,
      durationSeconds,
      spokenWordCount,
      wpm,
      fluency,
      languageProbability,
    });
  }

  public async startListening(
    lang: Language,
    targetSentence: string | string[],
    onResult: (res: SpeechMatchResult) => void,
    onError?: (err: string) => void,
    onStatusChange?: (isListening: boolean) => void
  ) {
    this.stopListening();
    this.language = lang;
    const rawTokens = Array.isArray(targetSentence) ? targetSentence : targetSentence.split(/\s+/);
    this.targetTokens = rawTokens.map((w) => this.cleanWord(w)).filter(Boolean);
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onStatusChangeCallback = onStatusChange;

    if (!this.isSupported()) {
      onError?.('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this.cleanupRecording();
        if (!blob.size) {
          this.onErrorCallback?.('No audio was captured. Please try again.');
          return;
        }

        try {
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
          }
          const audioBase64 = btoa(binary);
          const response = await fetch('/api/speech/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType: 'audio/webm',
              language: this.language,
            }),
          });

          // Guard against a non-JSON response (e.g. a 404/500 HTML error
          // page from the server, or a proxy/dev-server hiccup) before
          // calling response.json(). Previously this crashed with the raw
          // "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" —
          // now it surfaces a clear, actionable message instead.
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            const bodyPreview = (await response.text()).slice(0, 200);
            console.error('STT endpoint returned non-JSON response:', response.status, bodyPreview);
            throw new Error(
              response.status === 404
                ? 'Speech recognition service is not available right now. Please try again in a moment.'
                : `Speech recognition failed (server returned status ${response.status}).`
            );
          }

          const data = await response.json();
          if (!response.ok) throw new Error(data.error || `STT API returned ${response.status}`);
          this.processTranscript(data.transcript || '', true, data.languageProbability ?? null);
        } catch (error: any) {
          this.onErrorCallback?.(error.message || 'Speech recognition failed.');
        } finally {
          this.isListening = false;
          this.onStatusChangeCallback?.(false);
        }
      };

      this.mediaRecorder.start(250);
      this.recordingStartedAt = Date.now();
      this.isListening = true;
      this.onStatusChangeCallback?.(true);

      // REST STT accepts up to 30s. Keep a safety margin.
      this.stopTimer = setTimeout(() => this.stopListening(), 25000);
    } catch (error: any) {
      this.cleanupRecording();
      this.isListening = false;
      this.onStatusChangeCallback?.(false);
      this.onErrorCallback?.(error.name === 'NotAllowedError'
        ? 'Microphone access was denied. Please allow microphone permissions.'
        : error.message || 'Unable to start microphone recording.');
    }
  }

  public stopListening() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      return;
    }
    this.cleanupRecording();
    this.isListening = false;
    this.onStatusChangeCallback?.(false);
  }

  private cleanupRecording() {
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const speechRecognition = new SpeechRecognitionService();