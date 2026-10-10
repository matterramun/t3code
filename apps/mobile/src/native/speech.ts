import * as Speech from "expo-speech";
import { useSyncExternalStore } from "react";

import { splitSpeechSentences } from "../lib/conversationReply";
import { createSpeechPlayback } from "../lib/speechPlayback";
import { speechAudioFocus } from "./speechAudioFocus";

// One sentence per chunk, so pause, resume and skipping all move by a sentence.
const MAX_SENTENCE_LENGTH = 400;

const playback = createSpeechPlayback({
  engine: {
    speak: (chunk, handlers) =>
      Speech.speak(chunk, {
        onDone: handlers.onDone,
        onError: handlers.onError,
        // Stopping fires this instead of `onDone`; the queue was already told to stop.
        onStopped: () => {},
      }),
    stop: () => {
      void Speech.stop();
    },
  },
  focus: speechAudioFocus,
  split: (text) =>
    splitSpeechSentences(text, Math.min(MAX_SENTENCE_LENGTH, Speech.maxSpeechInputLength)),
});

speechAudioFocus.onFocusLost(() => playback.pause());

/** Reads text aloud with the system voice, replacing whatever was being read. */
export function speakText(text: string): void {
  playback.speak(text);
}

export function stopSpeaking(): void {
  playback.stop();
}

export function pauseSpeaking(): void {
  playback.pause();
}

export function resumeSpeaking(): void {
  playback.resume();
}

/** Jumps by whole sentences: -1 goes back one, 1 forward one. */
export function skipSentences(by: number): void {
  playback.skip(by);
}

/** Starts the reply being read over from its first sentence. */
export function restartSpeaking(): void {
  playback.restart();
}

/** Whether a reply is being read, paused part way, or nothing is playing. */
export function useSpeechPlaybackState() {
  return useSyncExternalStore(playback.subscribe, playback.getState, playback.getState);
}
