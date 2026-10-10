import { describe, expect, it } from "vite-plus/test";

import { withConversationThread } from "./conversationThreads";

describe("withConversationThread", () => {
  it("adds a thread once", () => {
    expect(withConversationThread(["a"], "b", true)).toEqual(["a", "b"]);
    expect(withConversationThread(["a", "b"], "b", true)).toEqual(["a", "b"]);
  });

  it("removes a thread and leaves the others", () => {
    expect(withConversationThread(["a", "b"], "a", false)).toEqual(["b"]);
    const keys = ["a"];
    expect(withConversationThread(keys, "z", false)).toBe(keys);
  });
});
