import { authHeaders } from './backendApi';
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

// Speech-band RMS below this for a whole recording means the microphone is
// delivering (near) digital silence; any real voice or room tone is higher.
const SILENT_MIC_RMS = 0.004;

// English articles: often transcribed as "uh"/"ah" or left out entirely.
const ARTICLES = new Set(['a', 'an', 'the']);
const ARTICLE_SPELLINGS = new Set(['a', 'an', 'uh', 'ah', 'eh', 'ay', 'aa', 'er']);

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
  private language: Language = 'English';
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
  private skipTokens = new Set<number>();

  // Voice-activity tracking (used only to measure how long the child actually
  // spoke, so WPM is not diluted by the silent part of a fixed listening window)
  private vadCtx: AudioContext | null = null;
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private firstVoiceAt = 0;
  private lastVoiceAt = 0;
  // Loudest level seen and how many level samples were taken, to tell a
  // microphone that delivers pure silence (muted, wrong input device, OS
  // permission blocked) apart from a child who simply wasn't recognised.
  private peakRms = 0;
  private vadSamples = 0;

  public isSupported(): boolean {
    return typeof window !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined';
  }

  private cleanWord(w: string): string {
    // Speech recognition spells some sounds differently from the book:
    // हूं for हूँ / मां for माँ (anusvara vs chandrabindu), पेड for पेड़ (nukta),
    // and zero-width joiners in Telugu/Hindi. They are the same word to a
    // child reading aloud, so both sides are compared in one spelling.
    return w
      .normalize('NFC')
      .toLowerCase()
      .trim()
      .replace(/\u0901/g, '\u0902')
      .replace(/[\u093C\u200C\u200D]/g, '')
      .replace(/[\p{P}\p{S}]+/gu, '');
  }

  private wordsSimilar(spoken: string, target: string): boolean {
    const s = this.cleanWord(spoken);
    const t = this.cleanWord(target);
    if (!s || !t) return false;
    if (s === t) return true;
    // A spoken English "a"/"an" is transcribed in many ways.
    if (this.language === 'English' && (t === 'a' || t === 'an') && ARTICLE_SPELLINGS.has(s)) return true;
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

  private matchJoinedWords(
    spoken: string,
    nextSpoken: string | undefined,
    fromTarget: number
  ): { targets: number[]; usedNextSpoken: boolean } | null {
    const window = Math.min(this.targetTokens.length, fromTarget + 3 + this.skipTokens.size);
    for (let t = fromTarget; t < window; t++) {
      if (this.skipTokens.has(t)) continue;
      // one spoken token = two or three consecutive target words
      const run: number[] = [t];
      for (let k = t + 1; k < this.targetTokens.length && run.length < 3; k++) {
        if (this.skipTokens.has(k)) continue;
        run.push(k);
        const joined = run.map((i) => this.targetTokens[i]).join('');
        if (this.wordsSimilar(spoken, joined)) return { targets: [...run], usedNextSpoken: false };
      }
      // two spoken tokens = one target word
      if (nextSpoken && this.targetTokens[t].length >= 4 && this.wordsSimilar(spoken + nextSpoken, this.targetTokens[t])) {
        return { targets: [t], usedNextSpoken: true };
      }
    }
    return null;
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
      for (let t = targetIdx; t < Math.min(this.targetTokens.length, targetIdx + 3 + this.skipTokens.size); t++) {
        if (this.skipTokens.has(t)) continue;
        if (this.wordsSimilar(spoken, this.targetTokens[t])) {
          this.stickyCorrect.add(t);
          targetIdx = t + 1;
          matched = true;
          break;
        }
      }
      // Speech recognition sometimes joins two read words into one
      // ("పిల్లి పాలు" heard as "పిల్లిపాలు") or splits one word in two
      // ("చెట్టుపై" as "చెట్టు పై"); both mean the child read them.
      if (!matched) {
        const joined = this.matchJoinedWords(spoken, spokenWords[spokenIndex + 1], targetIdx);
        if (joined) {
          joined.targets.forEach((t) => this.stickyCorrect.add(t));
          targetIdx = joined.targets[joined.targets.length - 1] + 1;
          if (joined.usedNextSpoken) spokenIndex++;
          matched = true;
        }
      }
      // Give feedback for a current misread word during recording too. This
      // status is provisional: a later interim transcript can still correct it.
      if (!matched && !isFinal && spokenIndex === spokenWords.length - 1) {
        liveLastWordMismatch = targetIdx;
      }
    }

    // Speech recognition often leaves out a short "a", "an" or "the" that was
    // read: when the words on both sides were read, count it as read too.
    if (this.language === 'English') {
      this.targetTokens.forEach((token, i) => {
        if (!ARTICLES.has(token) || this.stickyCorrect.has(i)) return;
        const before = i === 0 || this.stickyCorrect.has(i - 1);
        const after = i + 1 < this.targetTokens.length && this.stickyCorrect.has(i + 1);
        if (before && after) this.stickyCorrect.add(i);
      });
    }

    // A tick that was shown while the child was reading is never taken back.
    const matchedIndices = Array.from(this.stickyCorrect).sort((a, b) => a - b);
    const readMatched = matchedIndices.filter((i) => !this.skipTokens.has(i));
    const highestMatched = readMatched.length ? readMatched[readMatched.length - 1] : -1;

    const readableCount = this.targetTokens.length - this.skipTokens.size;
    const accuracy = readableCount > 0 ? (readMatched.length / readableCount) * 100 : 100;

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
    const targetWpm = readableCount <= 5 ? 35 : readableCount <= 7 ? 45 : 55;
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
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
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
    this.peakRms = 0;
    this.vadSamples = 0;
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
        // A suspended context reads as flat silence; don't count it as mic data.
        if (ctx.state !== 'running') return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        this.vadSamples += 1;
        if (rms > this.peakRms) this.peakRms = rms;
        // Focus on speech energy and ignore quieter room noise so the silence
        // clock is not extended by low-frequency hum or faint background sound.
        if (rms > 0.035) {
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
    // One token per displayed word, so word i on screen is always token i
    // (filtering out a lone "—" used to shift every highlight after it).
    // Punctuation-only "words" ("–", "—") can't be read aloud: they start
    // as read and are left out of the score.
    this.targetTokens = rawTokens.filter((w) => w.trim()).map((w) => this.cleanWord(w));
    this.skipTokens = new Set(
      this.targetTokens.map((t, i) => (/[\p{L}\p{N}]/u.test(t) ? -1 : i)).filter((i) => i >= 0)
    );
    this.stickyCorrect = new Set<number>(this.skipTokens);
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
        // Read before cleanupRecording() stops the voice detector.
        const micWasSilent = this.vadSamples >= 20 && this.peakRms < SILENT_MIC_RMS;
        this.cleanupRecording();
        if (!blob.size || micWasSilent) {
          this.isListening = false;
          this.options.onPhase?.('idle');
          this.onStatusChangeCallback?.(false);
          this.onErrorCallback?.(
            micWasSilent
              ? "Your microphone isn't picking up any sound. Check it isn't muted, that the right microphone is selected, and that this browser is allowed to use it in your computer's settings."
              : 'No audio was captured. Please try again.'
          );
          return;
        }

        this.options.onPhase?.('processing');
        try {
          const { transcript, languageProbability } = await this.transcribeBlob(blob);
          if (session !== this.sessionId) return;
          if (!transcript.trim() && this.stickyCorrect.size <= this.skipTokens.size) {
            // Nothing recognisable was heard: don't mark every word wrong.
            this.onErrorCallback?.(
              "I couldn't hear any words. Please read a little louder, closer to the microphone, and try again."
            );
            return;
          }
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
          // No speech detected yet: don't pay to transcribe silence (a model
          // can hallucinate a word from room noise and mark a word wrong).
          if (this.vadSamples > 0 && this.firstVoiceAt === 0) return;
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
