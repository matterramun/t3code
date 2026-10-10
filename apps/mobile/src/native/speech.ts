import * as Speech from "expo-speech";
import { useSyncExternalStore } from "react";

import { splitSpeechChunks } from "../lib/conversationReply";
import { createSpeechPlayback } from "../lib/speechPlayback";
import { speechAudioFocus } from "./speechAudioFocus";

// Short chunks keep pause and resume close to where the listener stopped.
const PLAYBACK_CHUNK_LENGTH = 400;

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
    splitSpeechChunks(text, Math.min(PLAYBACK_CHUNK_LENGTH, Speech.maxSpeechInputLength)),
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

/** Whether a reply is being read, paused part way, or nothing is playing. */
export function useSpeechPlaybackState() {
  return useSyncExternalStore(playback.subscribe, playback.getState, playback.getState);
}
