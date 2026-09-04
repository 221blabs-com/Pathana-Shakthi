/**
 * High-performance audio utilities for Gemini Studio TTS (24kHz PCM)
 * and real-time audio visualization.
 */

// Singleton AudioContext for low-latency playback
let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    try {
      audioCtx = new AudioContextClass({ sampleRate: 24000 });
    } catch {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Converts 16-bit little-endian PCM base64 string (from Gemini TTS 24kHz) to an AudioBuffer safely
 */
export function pcmBase64ToAudioBuffer(
  base64Data: string,
  sampleRate = 24000
): AudioBuffer {
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const numSamples = Math.floor(len / 2);
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, len);

  const ctx = getAudioContext();
  const audioBuffer = ctx.createBuffer(1, Math.max(1, numSamples), sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  // Read 16-bit little-endian signed integers safely into Float32 [-1.0, 1.0]
  for (let i = 0; i < numSamples; i++) {
    const sample = dataView.getInt16(i * 2, true); // true = little-endian
    channelData[i] = sample / 32768.0;
  }

  return audioBuffer;
}

/**
 * Encodes PCM 16-bit 24kHz to a standard RIFF/WAV Blob URL for universal playback
 */
export function pcmToWavBlobUrl(
  base64Data: string,
  sampleRate = 24000
): string {
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const pcmBytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    pcmBytes[i] = binaryString.charCodeAt(i);
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const wavBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(wavBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM audio data
  const wavBytes = new Uint8Array(wavBuffer);
  wavBytes.set(pcmBytes, headerSize);

  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

