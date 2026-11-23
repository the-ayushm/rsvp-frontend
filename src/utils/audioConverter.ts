/**
 * Utility to convert an audio Blob (e.g. WebM/Opus recorded by browser MediaRecorder)
 * into a standard MP3 (audio/mpeg) Blob.
 *
 * This ensures compatibility with:
 * 1. Backend upload filters requiring audio/mpeg, audio/ogg, or audio/aac
 * 2. WhatsApp Cloud API which does NOT support WebM audio
 *
 * The encoder resamples to 44100 Hz before encoding, which is the standard
 * sample rate supported by lamejs. Browser MediaRecorder often records at
 * 48000 Hz, which can produce silent/corrupt MP3 output if not resampled.
 */

const TARGET_SAMPLE_RATE = 44100;

/**
 * Resample an AudioBuffer to a target sample rate using OfflineAudioContext.
 */
async function resampleAudioBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate: number,
): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer;
  }

  const duration = audioBuffer.duration;
  const targetLength = Math.round(duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    targetLength,
    targetSampleRate,
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  return offlineCtx.startRendering();
}

export async function convertAudioBlobToMp3(audioBlob: Blob): Promise<Blob> {
  // If it's already an MP3, return as is
  if (audioBlob.type === "audio/mp3" || audioBlob.type === "audio/mpeg") {
    return audioBlob;
  }

  const arrayBuffer = await audioBlob.arrayBuffer();

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser");
  }

  const audioContext = new AudioContextClass();
  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    audioContext.close().catch(() => {});
  }

  // Resample to 44100 Hz for reliable MP3 encoding
  const audioBuffer = await resampleAudioBuffer(decodedBuffer, TARGET_SAMPLE_RATE);

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate; // Should be 44100 after resampling
  const kbps = 128;

  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);

  // Convert Float32Array channel data to Int16Array
  const leftFloat = audioBuffer.getChannelData(0);
  const leftInt16 = new Int16Array(leftFloat.length);
  for (let i = 0; i < leftFloat.length; i++) {
    const s = Math.max(-1, Math.min(1, leftFloat[i]));
    leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  let rightInt16: Int16Array | undefined = undefined;
  if (channels > 1) {
    const rightFloat = audioBuffer.getChannelData(1);
    rightInt16 = new Int16Array(rightFloat.length);
    for (let i = 0; i < rightFloat.length; i++) {
      const s = Math.max(-1, Math.min(1, rightFloat[i]));
      rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }

  const mp3Data: Uint8Array[] = [];
  const chunkSize = 1152;
  for (let i = 0; i < leftInt16.length; i += chunkSize) {
    const leftChunk = leftInt16.subarray(i, i + chunkSize);
    const rightChunk = rightInt16
      ? rightInt16.subarray(i, i + chunkSize)
      : undefined;
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(endBuf);
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: "audio/mpeg" });
}
