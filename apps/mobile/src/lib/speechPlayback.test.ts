import { describe, expect, it } from "vite-plus/test";

import { createSpeechPlayback } from "./speechPlayback";

function setup() {
  const spoken: string[] = [];
  const events: string[] = [];
  let pending: { onDone: () => void; onError: () => void } | null = null;
  const playback = createSpeechPlayback({
    engine: {
      speak: (chunk, handlers) => {
        spoken.push(chunk);
        pending = handlers;
      },
      stop: () => {
        events.push("engine-stop");
      },
    },
    focus: {
      acquire: () => events.push("focus-acquire"),
      release: () => events.push("focus-release"),
    },
    split: (text) => text.split("|").filter((chunk) => chunk.length > 0),
  });
  return {
    playback,
    spoken,
    events,
    finishChunk: () => pending?.onDone(),
    failChunk: () => pending?.onError(),
    // A stopped chunk's late callback, as the speech engine can still deliver it.
    staleCallbacks: () => pending,
  };
}

describe("createSpeechPlayback", () => {
  it("reads chunks in order and releases focus once the reply ends", () => {
    const { playback, spoken, events, finishChunk } = setup();
    playback.speak("one|two");
    expect(playback.getState()).toBe("speaking");
    expect(spoken).toEqual(["one"]);
    finishChunk();
    expect(spoken).toEqual(["one", "two"]);
    finishChunk();
    expect(playback.getState()).toBe("idle");
    expect(events.filter((event) => event.startsWith("focus"))).toEqual([
      "focus-acquire",
      "focus-release",
    ]);
  });

  it("pauses by releasing focus and resumes at the interrupted chunk", () => {
    const { playback, spoken, events, finishChunk } = setup();
    playback.speak("one|two|three");
    finishChunk();
    playback.pause();
    expect(playback.getState()).toBe("paused");
    expect(events.at(-1)).toBe("focus-release");

    playback.resume();
    expect(playback.getState()).toBe("speaking");
    expect(events.at(-1)).toBe("focus-acquire");
    expect(spoken).toEqual(["one", "two", "two"]);
    finishChunk();
    expect(spoken.at(-1)).toBe("three");
  });

  it("ignores a stopped chunk finishing late", () => {
    const { playback, spoken, staleCallbacks } = setup();
    playback.speak("one|two");
    const stale = staleCallbacks();
    playback.pause();
    stale?.onDone();
    expect(spoken).toEqual(["one"]);
    expect(playback.getState()).toBe("paused");
  });

  it("starting a new reply replaces the old one without releasing focus in between", () => {
    const { playback, spoken, events } = setup();
    playback.speak("old|older");
    playback.speak("new");
    expect(spoken).toEqual(["old", "new"]);
    expect(events.filter((event) => event.startsWith("focus"))).toEqual(["focus-acquire"]);
  });

  it("skips a chunk the engine fails to read", () => {
    const { playback, spoken, failChunk } = setup();
    playback.speak("one|two");
    failChunk();
    expect(spoken).toEqual(["one", "two"]);
  });

  it("stops from a paused or speaking state back to idle", () => {
    const { playback, events } = setup();
    playback.speak("one|two");
    playback.pause();
    playback.stop();
    expect(playback.getState()).toBe("idle");
    playback.resume();
    expect(playback.getState()).toBe("idle");
    expect(events.filter((event) => event === "focus-release")).toHaveLength(1);
  });

  it("goes idle without taking focus for empty text", () => {
    const { playback, events } = setup();
    playback.speak("");
    expect(playback.getState()).toBe("idle");
    expect(events.some((event) => event.startsWith("focus"))).toBe(false);
  });

  it("skips forward and back by a chunk while reading", () => {
    const { playback, spoken } = setup();
    playback.speak("one|two|three");
    playback.skip(1);
    expect(spoken).toEqual(["one", "two"]);
    playback.skip(-1);
    expect(spoken).toEqual(["one", "two", "one"]);
    playback.skip(-1);
    expect(spoken.at(-1)).toBe("one");
    expect(playback.getState()).toBe("speaking");
  });

  it("skipping past the last chunk ends the reply and releases focus", () => {
    const { playback, events } = setup();
    playback.speak("one|two");
    playback.skip(1);
    playback.skip(1);
    expect(playback.getState()).toBe("idle");
    expect(events.at(-1)).toBe("focus-release");
  });

  it("moves the resume point while paused without speaking", () => {
    const { playback, spoken } = setup();
    playback.speak("one|two|three");
    playback.pause();
    playback.skip(2);
    expect(playback.getState()).toBe("paused");
    expect(spoken).toEqual(["one"]);
    playback.resume();
    expect(spoken).toEqual(["one", "three"]);
  });

  it("restarts from the first chunk, including from a pause", () => {
    const { playback, spoken, finishChunk } = setup();
    playback.speak("one|two");
    finishChunk();
    playback.restart();
    expect(spoken).toEqual(["one", "two", "one"]);
    playback.pause();
    playback.restart();
    expect(playback.getState()).toBe("speaking");
    expect(spoken.at(-1)).toBe("one");
  });

  it("ignores skip and restart when nothing is playing", () => {
    const { playback, spoken } = setup();
    playback.skip(1);
    playback.restart();
    expect(spoken).toEqual([]);
    expect(playback.getState()).toBe("idle");
  });

  it("tells subscribers about each state change", () => {
    const { playback, finishChunk } = setup();
    const seen: string[] = [];
    playback.subscribe(() => seen.push(playback.getState()));
    playback.speak("one");
    playback.pause();
    playback.resume();
    finishChunk();
    expect(seen).toEqual(["speaking", "paused", "speaking", "idle"]);
  });
});
