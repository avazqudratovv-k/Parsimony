// Records a short voice clip and returns it as 16 kHz mono 16-bit WAV.
// Phones record in different formats (webm on Android/Chrome, mp4 on iPhone), so we decode what the
// browser produced and re-encode it to one tiny, universal format the server accepts. A 30 s clip is ~1 MB.
export const MAX_SECONDS = 30;
const SAMPLE_RATE = 16000;

export class MicError extends Error {
  kind: "denied" | "unsupported" | "failed";
  constructor(kind: "denied" | "unsupported" | "failed") {
    super(kind);
    this.kind = kind;
  }
}

export type Recorder = {
  /** Stop and get the clip as WAV. */
  stop: () => Promise<Blob>;
  /** Stop and throw everything away. */
  cancel: () => void;
};

export async function startRecording(): Promise<Recorder> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new MicError("unsupported");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    throw new MicError(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "failed");
  }
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const release = () => stream.getTracks().forEach((t) => t.stop());
  const finished = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  recorder.start();

  return {
    async stop() {
      if (recorder.state !== "inactive") recorder.stop();
      await finished;
      release();
      try {
        return await toWav(new Blob(chunks, { type: recorder.mimeType }));
      } catch {
        throw new MicError("failed");
      }
    },
    cancel() {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

async function toWav(recorded: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await recorded.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, frames, SAMPLE_RATE); // mixes down to mono and resamples
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), SAMPLE_RATE);
  } finally {
    void ctx.close();
  }
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true));
  return new Blob([buffer], { type: "audio/wav" });
}
