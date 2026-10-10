import { describe, expect, it } from "vite-plus/test";

import { normalizeVoiceInputDecibels } from "../features/voice-input/voiceInputMetering";
import {
  createTranscriptAccumulator,
  recognizerVolumeToMetering,
} from "./speechRecognitionTranscript";

describe("createTranscriptAccumulator", () => {
  it("lets a final result replace its interim results", () => {
    const transcript = createTranscriptAccumulator();
    transcript.push({ isFinal: false, transcript: "hel" });
    transcript.push({ isFinal: false, transcript: "hello wor" });
    transcript.push({ isFinal: true, transcript: " hello world " });
    expect(transcript.text()).toBe("hello world");
  });

  it("joins utterances and keeps trailing words that were never finalized", () => {
    const transcript = createTranscriptAccumulator();
    transcript.push({ isFinal: true, transcript: "first part" });
    transcript.push({ isFinal: false, transcript: "and the rest" });
    expect(transcript.text()).toBe("first part and the rest");
  });

  it("is empty when nothing was heard", () => {
    const transcript = createTranscriptAccumulator();
    transcript.push({ isFinal: true, transcript: "  " });
    expect(transcript.text()).toBe("");
  });
});

describe("recognizerVolumeToMetering", () => {
  it("maps the recognizer's volume range onto the waveform's 0..1 height", () => {
    expect(normalizeVoiceInputDecibels(recognizerVolumeToMetering(-2))).toBe(0);
    expect(normalizeVoiceInputDecibels(recognizerVolumeToMetering(10))).toBeCloseTo(1);
    expect(normalizeVoiceInputDecibels(recognizerVolumeToMetering(4))).toBeCloseTo(0.5, 1);
    expect(normalizeVoiceInputDecibels(recognizerVolumeToMetering(-5))).toBe(0);
  });
});
