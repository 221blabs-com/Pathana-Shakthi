import { Language } from '../types';

export interface ListenOptions {
  /** Safety hard stop for the recording (ms). Default 29000. */
  maxDurationMs?: number;
  /** Stop recording after this much detected silence. */
  silenceTimeoutMs?: number;
  /**
   * When set, the growing recording is re-transcribed every N ms so words can
   * be ticked correct/wrong while the child is still reading.
   */
  interimIntervalMs?: number;
  /** Finish as soon as every target word has been matched. */
  stopWhenAllMatched?: boolean;
  /** 'recording' while the mic is open, 'processing' while the final clip is checked, then 'idle'. */
  onPhase?: (phase: 'recording' | 'processing' | 'idle') => void;
}

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
  private silenceTimer: ReturnType<typeof setInterval> | null = null;
  private recordingStartedAt = 0;

  // Live (interim) feedback state
  private options: ListenOptions = {};
  private interimTimer: ReturnType<typeof setInterval> | null = null;
  private interimInFlight = false;
  private recording = false;
  private sessionId = 0;
  private stickyCorrect = new Set<number>();

  // Voice-activity tracking (used only to measure how long the child actually
  // spoke, so WPM is not diluted by the silent part of a fixed listening window)
  private vadCtx: AudioContext | null = null;
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private firstVoiceAt = 0;
  private lastVoiceAt = 0;

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
    if (s === t) return true;
    // Substring matches only count for reasonably long words of similar
    // length. Before, a spoken "a" matched any target containing the letter
    // "a" (e.g. "elephant"), which ticked words that were never read.
    const shorter = Math.min(s.length, t.length);
    const longer = Math.max(s.length, t.length);
    if (shorter >= 4 && shorter / longer >= 0.7 && (s.includes(t) || t.includes(s))) return true;

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
    let targetIdx = 0;
    let liveLastWordMismatch = -1;

    for (let spokenIndex = 0; spokenIndex < spokenWords.length; spokenIndex++) {
      const spoken = spokenWords[spokenIndex];
      if (targetIdx >= this.targetTokens.length) break;
      let matched = false;
      for (let t = targetIdx; t < Math.min(this.targetTokens.length, targetIdx + 3); t++) {
        if (this.wordsSimilar(spoken, this.targetTokens[t])) {
          this.stickyCorrect.add(t);
          targetIdx = t + 1;
          matched = true;
          break;
        }
      }
      // Give feedback for a current misread word during recording too. This
      // status is provisional: a later interim transcript can still correct it.
      if (!matched && !isFinal && spokenIndex === spokenWords.length - 1) {
        liveLastWordMismatch = targetIdx;
      }
    }

    // A tick that was shown while the child was reading is never taken back.
    const matchedIndices = Array.from(this.stickyCorrect).sort((a, b) => a - b);
    const highestMatched = matchedIndices.length ? matchedIndices[matchedIndices.length - 1] : -1;

    const accuracy = (matchedIndices.length / this.targetTokens.length) * 100;

    // Speaking time = first to last voiced moment (falls back to the whole
    // recording if the voice detector was unavailable).
    const voicedSeconds =
      this.firstVoiceAt && this.lastVoiceAt > this.firstVoiceAt
        ? (this.lastVoiceAt - this.firstVoiceAt) / 1000
        : 0;
    const wallSeconds = (Date.now() - this.recordingStartedAt) / 1000;
    const durationSeconds = Math.max(0.5, voicedSeconds || wallSeconds);
    const spokenWordCount = spokenWords.length;
    const wpm = Math.round((spokenWordCount / durationSeconds) * 60);
    const targetWpm = this.targetTokens.length <= 5 ? 35 : this.targetTokens.length <= 7 ? 45 : 55;
    const speedScore = Math.min(100, Math.round((wpm / targetWpm) * 100));
    // Saaras provides language probability, not a true accent score. Use it only
    // as a light clarity signal when available; never label it as accent detection.
    const clarityScore = languageProbability == null ? accuracy : Math.round(languageProbability * 100);
    const fluency = Math.round(accuracy * 0.55 + speedScore * 0.30 + clarityScore * 0.15);

    // correct  = recognised
    // wrong    = skipped/mispronounced (a later word was already matched) or, on
    //            the final pass, anything not recognised
    // pending  = not reached yet
    const wordStatuses: Array<'pending' | 'correct' | 'wrong'> = this.targetTokens.map((_, index) =>
      this.stickyCorrect.has(index)
        ? 'correct'
        : isFinal || index < highestMatched || index === liveLastWordMismatch
          ? 'wrong'
          : 'pending'
    );
    const firstPending = wordStatuses.indexOf('pending');

    this.onResultCallback?.({
      transcript,
      matchedWordIndices: matchedIndices,
      currentWordIndex: firstPending === -1 ? this.targetTokens.length - 1 : firstPending,
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

  private async blobToBase64(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
    }
    return btoa(binary);
  }

  private async transcribeBlob(blob: Blob): Promise<{ transcript: string; languageProbability: number | null }> {
    const audioBase64 = await this.blobToBase64(blob);
    const response = await fetch('/api/speech/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType: 'audio/webm', language: this.language }),
    });

    // Guard against a non-JSON response (404/500 HTML page, proxy hiccup)
    // before calling response.json().
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
    return { transcript: data.transcript || '', languageProbability: data.languageProbability ?? null };
  }

  private startVoiceDetector(stream: MediaStream) {
    this.firstVoiceAt = 0;
    this.lastVoiceAt = 0;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = new Ctx();
      this.vadCtx = ctx;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 140;
      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 3800;
      ctx.createMediaStreamSource(stream).connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(analyser); // speech-band analysis only; never reaches speakers
      const buf = new Uint8Array(analyser.fftSize);
      this.vadTimer = setInterval(() => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        // Focus on speech energy and ignore quieter room noise so the silence
        // clock is not extended by low-frequency hum or faint background sound.
        if (rms > 0.02) {
          const now = Date.now();
          if (!this.firstVoiceAt) this.firstVoiceAt = now;
          this.lastVoiceAt = now;
        }
      }, 50);
    } catch {
      // Voice detection is optional — WPM falls back to the recording length.
    }
  }

  private stopVoiceDetector() {
    if (this.vadTimer) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    if (this.vadCtx) {
      this.vadCtx.close().catch(() => {});
      this.vadCtx = null;
    }
  }

  private clearTimers() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.interimTimer) {
      clearInterval(this.interimTimer);
      this.interimTimer = null;
    }
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public async startListening(
    lang: Language,
    targetSentence: string | string[],
    onResult: (res: SpeechMatchResult) => void,
    onError?: (err: string) => void,
    onStatusChange?: (isListening: boolean) => void,
    options: ListenOptions = {}
  ) {
    this.cancel(false);
    const session = ++this.sessionId;
    this.language = lang;
    const rawTokens = Array.isArray(targetSentence) ? targetSentence : targetSentence.split(/\s+/);
    this.targetTokens = rawTokens.map((w) => this.cleanWord(w)).filter(Boolean);
    this.stickyCorrect = new Set<number>();
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onStatusChangeCallback = onStatusChange;
    this.options = options;

    if (!this.isSupported()) {
      onError?.('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (session !== this.sessionId) {
        // Cancelled (page changed / another attempt started) while the
        // permission prompt was open.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.mediaStream = stream;
      // Per-session chunk list: a late onstop from a cancelled session must
      // never touch a newer session's recorder, stream or chunks.
      const sessionChunks: Blob[] = [];
      this.chunks = sessionChunks;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) sessionChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(sessionChunks, { type: 'audio/webm' });
        if (session !== this.sessionId) {
          // Cancelled: release this session's microphone only, drop the audio.
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        this.cleanupRecording();
        if (!blob.size) {
          this.isListening = false;
          this.options.onPhase?.('idle');
          this.onStatusChangeCallback?.(false);
          this.onErrorCallback?.('No audio was captured. Please try again.');
          return;
        }

        this.options.onPhase?.('processing');
        try {
          const { transcript, languageProbability } = await this.transcribeBlob(blob);
          if (session !== this.sessionId) return;
          this.processTranscript(transcript, true, languageProbability);
        } catch (error: any) {
          if (session === this.sessionId) {
            this.onErrorCallback?.(error.message || 'Speech recognition failed.');
          }
        } finally {
          if (session === this.sessionId) {
            this.isListening = false;
            this.options.onPhase?.('idle');
            this.onStatusChangeCallback?.(false);
          }
        }
      };

      this.mediaRecorder.start(250);
      this.recordingStartedAt = Date.now();
      this.lastVoiceAt = 0;
      this.recording = true;
      this.isListening = true;
      this.startVoiceDetector(stream);
      this.silenceTimer = setInterval(() => {
        const silenceStartedAt = this.lastVoiceAt || this.recordingStartedAt;
        if (
          this.recording &&
          silenceStartedAt > 0 &&
          Date.now() - silenceStartedAt >= (this.options.silenceTimeoutMs ?? 7000)
        ) {
          this.stopListening();
        }
      }, 100);
      this.options.onPhase?.('recording');
      this.onStatusChangeCallback?.(true);

      // Live per-word feedback: re-check the growing recording every few
      // seconds. Only one request is in flight at a time; late replies from a
      // stopped/cancelled session are ignored.
      if (this.options.interimIntervalMs) {
        this.interimTimer = setInterval(async () => {
          if (!this.recording || this.interimInFlight || this.chunks.length < 4) return;
          this.interimInFlight = true;
          try {
            const { transcript, languageProbability } = await this.transcribeBlob(
              new Blob(this.chunks, { type: 'audio/webm' })
            );
            if (session !== this.sessionId || !this.recording) return;
            this.processTranscript(transcript, false, languageProbability);
            if (
              this.options.stopWhenAllMatched &&
              this.stickyCorrect.size >= this.targetTokens.length
            ) {
              this.stopListening();
            }
          } catch {
            // Interim checks are best-effort; the final pass reports real errors.
          } finally {
            this.interimInFlight = false;
          }
        }, this.options.interimIntervalMs);
      }

      // Silence normally ends the attempt; this is only a safety cap.
      this.stopTimer = setTimeout(() => this.stopListening(), this.options.maxDurationMs ?? 29000);
    } catch (error: any) {
      this.cleanupRecording();
      this.isListening = false;
      this.recording = false;
      this.options.onPhase?.('idle');
      this.onStatusChangeCallback?.(false);
      this.onErrorCallback?.(error.name === 'NotAllowedError'
        ? 'Microphone access was denied. Please allow microphone permissions.'
        : error.message || 'Unable to start microphone recording.');
    }
  }

  /** Stop recording and check what was said (a final result is delivered). */
  public stopListening() {
    this.clearTimers();
    this.recording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      return;
    }
    if (!this.isListening) return;
    this.cleanupRecording();
    this.isListening = false;
    this.onStatusChangeCallback?.(false);
  }

  /** Abort without delivering any result (page change, unmount, restart). */
  public cancel(notify = true) {
    this.sessionId++;
    this.clearTimers();
    this.recording = false;
    const wasListening = this.isListening;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.cleanupRecording();
    this.isListening = false;
    if (notify && wasListening) {
      this.options.onPhase?.('idle');
      this.onStatusChangeCallback?.(false);
    }
  }

  private cleanupRecording() {
    this.stopVoiceDetector();
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
