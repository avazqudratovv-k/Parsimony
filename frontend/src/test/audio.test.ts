import { describe, expect, it } from "vitest";
import { encodeWav } from "../lib/audio";

describe("encodeWav", () => {
  it("writes a valid 16-bit mono WAV header and clamps samples", async () => {
    const blob = encodeWav(new Float32Array([0, 1, -1, 2]), 16000);
    const view = new DataView(await blob.arrayBuffer());
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(o + i)));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(40, true)).toBe(8); // 4 samples x 2 bytes
    expect(view.getInt16(46, true)).toBe(32767); // 1.0
    expect(view.getInt16(48, true)).toBe(-32767); // -1.0
    expect(view.getInt16(50, true)).toBe(32767); // 2.0 clamped
    expect(blob.type).toBe("audio/wav");
  });
});
