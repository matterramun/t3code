import { describe, expect, it } from "vite-plus/test";

import {
  createConversationReplyTracker,
  latestReply,
  splitSpeechChunks,
  splitSpeechSentences,
  toSpokenText,
  type ConversationMessage,
} from "./conversationReply";

describe("toSpokenText", () => {
  it("drops code blocks and keeps the prose around them", () => {
    expect(toSpokenText("Here is the fix:\n```ts\nconst a = 1;\n```\nThat should do it.")).toBe(
      "Here is the fix: That should do it.",
    );
  });

  it("drops an unterminated code block", () => {
    expect(toSpokenText("Run this:\n```sh\nnpm test")).toBe("Run this:");
  });

  it("reads markdown formatting as plain words", () => {
    expect(
      toSpokenText(
        "## Result\n- **Fast** and `safe`\n- See [the docs](https://example.com/docs)\n1. Done",
      ),
    ).toBe("Result. Fast and safe. See the docs. Done.");
  });

  it("says link for a bare URL and skips rules and table separators", () => {
    expect(
      toSpokenText("Open https://example.com/x now\n---\n| a | b |\n|---|---|\n| 1 | 2 |"),
    ).toBe("Open link now. a, b. 1, 2.");
  });

  it("returns an empty string when nothing is speakable", () => {
    expect(toSpokenText("```\nonly code\n```")).toBe("");
  });
});

describe("splitSpeechChunks", () => {
  it("packs whole sentences up to the limit", () => {
    expect(splitSpeechChunks("One. Two. Three.", 10)).toEqual(["One. Two.", "Three."]);
  });

  it("splits an over-long sentence on words, then cuts an over-long word", () => {
    expect(splitSpeechChunks("aaa bbb ccc", 7)).toEqual(["aaa bbb", "ccc"]);
    expect(splitSpeechChunks("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("keeps every chunk within the limit", () => {
    const chunks = splitSpeechChunks("Hello there. ".repeat(40), 50);
    expect(chunks.every((chunk) => chunk.length <= 50)).toBe(true);
    expect(chunks.join(" ")).toBe("Hello there. ".repeat(40).trim());
  });
});

describe("splitSpeechSentences", () => {
  it("gives one piece per sentence", () => {
    expect(splitSpeechSentences("One. Two! Three?", 100)).toEqual(["One.", "Two!", "Three?"]);
  });

  it("cuts a sentence longer than the limit on words", () => {
    expect(splitSpeechSentences("aaa bbb ccc. Dd.", 7)).toEqual(["aaa bbb", "ccc.", "Dd."]);
  });
});

const assistant = (
  id: string,
  runId: string,
  text: string,
  extra: Partial<ConversationMessage> = {},
): ConversationMessage => ({ id, runId, role: "assistant", text, streaming: false, ...extra });

describe("createConversationReplyTracker", () => {
  it("never replays what had already finished when it started watching", () => {
    const tracker = createConversationReplyTracker();
    const runs = [{ id: "r1", status: "completed" }];
    const messages = [assistant("m1", "r1", "Old answer")];
    expect(tracker.observe({ runs, messages })).toBeNull();
    expect(tracker.observe({ runs, messages })).toBeNull();
  });

  it("speaks the final assistant message of a newly completed run once", () => {
    const tracker = createConversationReplyTracker();
    tracker.observe({ runs: [], messages: [] });
    const messages = [
      assistant("m1", "r1", "Let me check."),
      assistant("m2", "r1", "All **done**."),
    ];
    expect(tracker.observe({ runs: [{ id: "r1", status: "running" }], messages })).toBeNull();
    const done = [{ id: "r1", status: "completed" }];
    expect(tracker.observe({ runs: done, messages })).toEqual({
      runId: "r1",
      messageId: "m2",
      text: "All done.",
    });
    expect(tracker.observe({ runs: done, messages })).toBeNull();
  });

  it("waits for the reply when the run completes before its message is final", () => {
    const tracker = createConversationReplyTracker();
    tracker.observe({ runs: [], messages: [] });
    const done = [{ id: "r1", status: "completed" }];
    expect(
      tracker.observe({
        runs: done,
        messages: [assistant("m1", "r1", "Partial", { streaming: true })],
      }),
    ).toBeNull();
    expect(
      tracker.observe({ runs: done, messages: [assistant("m1", "r1", "Final answer")] }),
    ).toEqual({
      runId: "r1",
      messageId: "m1",
      text: "Final answer.",
    });
  });

  it("ignores notifications, delegated completions, and failed runs", () => {
    const tracker = createConversationReplyTracker();
    tracker.observe({ runs: [], messages: [] });
    expect(
      tracker.observe({
        runs: [
          { id: "r1", status: "completed" },
          { id: "r2", status: "failed" },
        ],
        messages: [
          assistant("m1", "r1", "Wake up", { notification: {} }),
          assistant("m2", "r1", "Child finished", { delegatedCompletion: {} }),
          assistant("m3", "r2", "Oops"),
        ],
      }),
    ).toBeNull();
  });
});

describe("latestReply", () => {
  it("returns the newest completed run's final reply, as speech", () => {
    const runs = [
      { id: "r1", status: "completed" },
      { id: "r2", status: "completed" },
    ];
    const messages = [assistant("m1", "r1", "First"), assistant("m2", "r2", "**Second** answer")];
    expect(latestReply({ runs, messages })).toEqual({
      runId: "r2",
      messageId: "m2",
      text: "Second answer.",
    });
  });

  it("skips a run still working and falls back to the one before", () => {
    const runs = [
      { id: "r1", status: "completed" },
      { id: "r2", status: "running" },
    ];
    const messages = [assistant("m1", "r1", "Done before"), assistant("m2", "r2", "Partial")];
    expect(latestReply({ runs, messages })?.messageId).toBe("m1");
  });

  it("is null when no run has completed with a reply", () => {
    expect(latestReply({ runs: [{ id: "r1", status: "running" }], messages: [] })).toBeNull();
  });
});
