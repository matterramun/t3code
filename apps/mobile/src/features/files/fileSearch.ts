/**
 * Find-in-file for the file viewer. Source view searches the file's lines; Preview
 * searches the markdown text that renders as text, wrapping each hit in `==…==` so the
 * markdown renderer's highlight span marks it.
 */

const MAX_OCCURRENCES = 2000;

/** Start offsets of each non-overlapping, case-insensitive occurrence of `query` in `text`. */
export function findOccurrences(text: string, query: string): number[] {
  if (query.length === 0) return [];
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  // Case folding can change a string's length; offsets would then not line up with `text`.
  if (haystack.length !== text.length || needle.length !== query.length) {
    return findExact(text, query);
  }
  const offsets: number[] = [];
  let from = 0;
  while (offsets.length < MAX_OCCURRENCES) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    offsets.push(at);
    from = at + needle.length;
  }
  return offsets;
}

function findExact(text: string, query: string): number[] {
  const offsets: number[] = [];
  let from = 0;
  while (offsets.length < MAX_OCCURRENCES) {
    const at = text.indexOf(query, from);
    if (at === -1) break;
    offsets.push(at);
    from = at + query.length;
  }
  return offsets;
}

export interface SourceFind {
  /** The line of every occurrence, in file order. One entry per occurrence. */
  readonly occurrenceLines: ReadonlyArray<number>;
  readonly matchLines: ReadonlySet<number>;
}

export function findInSource(lines: ReadonlyArray<string>, query: string): SourceFind {
  const occurrenceLines: number[] = [];
  const matchLines = new Set<number>();
  if (query.length > 0) {
    for (let index = 0; index < lines.length && occurrenceLines.length < MAX_OCCURRENCES; index++) {
      const count = findOccurrences(lines[index] ?? "", query).length;
      for (let hit = 0; hit < count; hit++) occurrenceLines.push(index);
      if (count > 0) matchLines.add(index);
    }
  }
  return { occurrenceLines, matchLines };
}

export interface MarkdownSearchSection {
  /** The section's markdown with every hit wrapped in `==…==`. */
  readonly text: string;
  readonly lineCount: number;
  /** Where each hit sits in the section, 0 at the first line and below 1 at the last. */
  readonly occurrenceFractions: ReadonlyArray<number>;
}

export interface MarkdownSearch {
  readonly sections: ReadonlyArray<MarkdownSearchSection>;
  readonly total: number;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}#{1,6}(\s|$)/;
// Inline code, link and image destinations, bare URLs and HTML tags keep their text as is:
// wrapping part of them would change what they point at or how they render.
const PROTECTED = /(`+[^`]*`+|\]\([^)\n]*\)|https?:\/\/\S+|<[^>\n]+>)/g;

function highlightLine(line: string, query: string): { text: string; count: number } {
  let count = 0;
  const text = line
    .split(PROTECTED)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      const offsets = findOccurrences(part, query);
      if (offsets.length === 0) return part;
      let result = "";
      let from = 0;
      for (const at of offsets) {
        result += `${part.slice(from, at)}==${part.slice(at, at + query.length)}==`;
        from = at + query.length;
      }
      count += offsets.length;
      return result + part.slice(from);
    })
    .join("");
  return { text, count };
}

/**
 * Splits `markdown` at headings, so the viewer can scroll to the section holding a hit,
 * and highlights hits outside fenced code. Lists and tables stay inside one section.
 * Hits inside fenced code blocks are not counted, since a code block cannot show a highlight.
 */
export function searchMarkdown(markdown: string, query: string): MarkdownSearch {
  const needle = query.trim();
  if (needle.length === 0) return { sections: [], total: 0 };
  const sections: MarkdownSearchSection[] = [];
  let lines: string[] = [];
  let hitLines: number[] = [];
  let fence: string | null = null;
  let total = 0;

  const flush = () => {
    if (lines.length === 0) return;
    const lineCount = lines.length;
    sections.push({
      text: lines.join("\n"),
      lineCount,
      occurrenceFractions: hitLines.map((line) => line / lineCount),
    });
    lines = [];
    hitLines = [];
  };

  for (const rawLine of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const fenceMatch = FENCE.exec(rawLine);
    if (fence !== null) {
      lines.push(rawLine);
      if (fenceMatch && fenceMatch[1]![0] === fence[0] && fenceMatch[1]!.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1]!;
      lines.push(rawLine);
      continue;
    }
    if (HEADING.test(rawLine)) flush();
    const { text, count } = highlightLine(rawLine, needle);
    for (let hit = 0; hit < count && total < MAX_OCCURRENCES; hit++) {
      hitLines.push(lines.length);
      total += 1;
    }
    lines.push(text);
  }
  flush();
  return { sections, total };
}

/** Which section holds hit number `index` (counted across all sections), and where in it. */
export function locateMarkdownOccurrence(
  search: MarkdownSearch,
  index: number,
): { readonly section: number; readonly fraction: number } | null {
  let remaining = index;
  for (let section = 0; section < search.sections.length; section++) {
    const fractions = search.sections[section]!.occurrenceFractions;
    if (remaining < fractions.length) return { section, fraction: fractions[remaining]! };
    remaining -= fractions.length;
  }
  return null;
}
