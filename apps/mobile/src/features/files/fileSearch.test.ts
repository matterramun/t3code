import { describe, expect, it } from "vite-plus/test";

import {
  findInSource,
  findOccurrences,
  locateMarkdownOccurrence,
  searchMarkdown,
} from "./fileSearch";

describe("findOccurrences", () => {
  it("matches ignoring case without overlapping", () => {
    expect(findOccurrences("Foo foo FOO", "foo")).toEqual([0, 4, 8]);
    expect(findOccurrences("aaaa", "aa")).toEqual([0, 2]);
  });

  it("finds nothing for an empty query", () => {
    expect(findOccurrences("abc", "")).toEqual([]);
  });
});

describe("findInSource", () => {
  it("lists each occurrence's line and the set of matching lines", () => {
    const result = findInSource(["alpha beta", "gamma", "beta beta"], "beta");
    expect(result.occurrenceLines).toEqual([0, 2, 2]);
    expect([...result.matchLines]).toEqual([0, 2]);
  });
});

describe("searchMarkdown", () => {
  it("wraps hits in highlight markers and counts them", () => {
    const result = searchMarkdown("one two\nTwo again", "two");
    expect(result.total).toBe(2);
    expect(result.sections[0]!.text).toBe("one ==two==\n==Two== again");
  });

  it("leaves inline code, link targets and bare URLs alone", () => {
    const result = searchMarkdown(
      "see `two` and [two](http://two.example/two) at https://two.test",
      "two",
    );
    expect(result.sections[0]!.text).toBe(
      "see `two` and [==two==](http://two.example/two) at https://two.test",
    );
    expect(result.total).toBe(1);
  });

  it("skips fenced code blocks", () => {
    const result = searchMarkdown("two\n```\ntwo\n```\ntwo", "two");
    expect(result.sections[0]!.text).toBe("==two==\n```\ntwo\n```\n==two==");
    expect(result.total).toBe(2);
  });

  it("splits sections at headings but not inside code fences", () => {
    const result = searchMarkdown("# A\nx\n```\n# not heading\n```\n## B\nx x", "x");
    expect(result.sections.map((section) => section.text.split("\n")[0])).toEqual(["# A", "## B"]);
    expect(result.total).toBe(3);
  });

  it("locates a hit by its index across sections", () => {
    const result = searchMarkdown("# A\nx\n## B\nfiller\nx", "x");
    expect(locateMarkdownOccurrence(result, 0)).toEqual({ section: 0, fraction: 0.5 });
    expect(locateMarkdownOccurrence(result, 1)).toEqual({ section: 1, fraction: 2 / 3 });
    expect(locateMarkdownOccurrence(result, 2)).toBeNull();
  });

  it("ignores a blank query", () => {
    expect(searchMarkdown("text", "  ")).toEqual({ sections: [], total: 0 });
  });
});
