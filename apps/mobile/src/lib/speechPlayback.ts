/**
 * Plays one spoken reply as a queue of short chunks so it can pause and resume.
 * The system speech engines cannot pause on every platform, so pausing stops at
 * the current chunk and resuming starts that chunk again.
 */

export type SpeechPlaybackState = "idle" | "speaking" | "paused";

export interface SpeechEngine {
  /** Reads one chunk, then calls `onDone`. A chunk the engine cannot read calls `onError`. */
  readonly speak: (chunk: string, handlers: { onDone: () => void; onError: () => void }) => void;
  readonly stop: () => void;
}

export interface SpeechAudioFocus {
  /** Takes audio focus so other apps pause their audio. */
  readonly acquire: () => void;
  /** Gives focus back so other apps resume. */
  readonly release: () => void;
}

export function createSpeechPlayback(input: {
  readonly engine: SpeechEngine;
  readonly focus: SpeechAudioFocus;
  readonly split: (text: string) => ReadonlyArray<string>;
}) {
  let state: SpeechPlaybackState = "idle";
  let chunks: ReadonlyArray<string> = [];
  let index = 0;
  // Callbacks from a chunk that was stopped or replaced must not advance the queue.
  let generation = 0;
  let focused = false;
  const listeners = new Set<() => void>();

  const setState = (next: SpeechPlaybackState) => {
    if (state === next) return;
    state = next;
    for (const listener of listeners) listener();
  };
  const holdFocus = () => {
    if (focused) return;
    focused = true;
    input.focus.acquire();
  };
  const dropFocus = () => {
    if (!focused) return;
    focused = false;
    input.focus.release();
  };
  const finish = () => {
    chunks = [];
    index = 0;
    setState("idle");
    dropFocus();
  };
  const playCurrent = () => {
    const chunk = chunks[index];
    if (chunk === undefined) {
      finish();
      return;
    }
    const mine = ++generation;
    const next = () => {
      if (mine !== generation) return;
      index += 1;
      playCurrent();
    };
    input.engine.speak(chunk, {
      onDone: next,
      // A chunk that fails is skipped so one bad sentence does not silence the reply.
      onError: next,
    });
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Replaces whatever is being read with this text. */
    speak(text: string) {
      generation += 1;
      input.engine.stop();
      chunks = input.split(text);
      index = 0;
      if (chunks.length === 0) {
        finish();
        return;
      }
      holdFocus();
      setState("speaking");
      playCurrent();
    },
    pause() {
      if (state !== "speaking") return;
      generation += 1;
      input.engine.stop();
      setState("paused");
      dropFocus();
    },
    resume() {
      if (state !== "paused") return;
      holdFocus();
      setState("speaking");
      playCurrent();
    },
    /**
     * Moves by whole chunks. While reading it carries on from the new spot; while paused
     * it only moves the resume point. Skipping past the last chunk ends the reply, and
     * skipping back from the first one starts it over.
     */
    skip(by: number) {
      if (state === "idle") return;
      index = Math.max(0, index + by);
      if (state === "paused") {
        if (index >= chunks.length) finish();
        return;
      }
      generation += 1;
      input.engine.stop();
      playCurrent();
    },
    /** Starts the current reply over from its first chunk, even if it is paused. */
    restart() {
      if (state === "idle") return;
      index = 0;
      generation += 1;
      input.engine.stop();
      holdFocus();
      setState("speaking");
      playCurrent();
    },
    stop() {
      if (state === "idle") return;
      generation += 1;
      input.engine.stop();
      finish();
    },
  };
}
