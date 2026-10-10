/**
 * Collects what a streaming recognizer heard. Each utterance arrives as
 * interim results that a final result then replaces, so the text is the
 * finals plus the latest interim one that was never finalized (a recognizer
 * stopped by the user may end without finalizing its last words).
 */
export function createTranscriptAccumulator() {
  const finals: string[] = [];
  let interim = "";
  return {
    push(result: { readonly isFinal: boolean; readonly transcript: string }) {
      const transcript = result.transcript.trim();
      if (result.isFinal) {
        if (transcript.length > 0) finals.push(transcript);
        interim = "";
      } else {
        interim = transcript;
      }
    },
    text(): string {
      return [...finals, interim].filter((part) => part.length > 0).join(" ");
    },
  };
}

/**
 * The recognizer reports input volume from -2 (inaudible) to 10. Dictation's
 * waveform expects decibels and takes a square root of the amplitude, so this
 * returns the decibel value whose waveform height equals the 0..1 level.
 */
export function recognizerVolumeToMetering(value: number): number {
  const level = Math.min(1, Math.max(0, (value + 2) / 12));
  return level === 0 ? Number.NEGATIVE_INFINITY : 40 * Math.log10(level);
}
