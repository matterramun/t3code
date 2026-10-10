/**
 * Turns finished agent replies into speech for Conversation mode.
 *
 * Only the last assistant message of a run that completes after Conversation
 * mode started is read; history already on screen never is.
 */

/** Strips markdown to what is worth hearing. Code blocks are skipped, not read. */
export function toSpokenText(markdown: string): string {
  const lines = markdown
    .replace(/```[\s\S]*?(```|$)/g, "\n")
    .replace(/~~~[\s\S]*?(~~~|$)/g, "\n")
    .replace(/<[^>\n]+>/g, "")
    .split("\n")
    .flatMap((raw) => {
      let line = raw.trim();
      if (line.length === 0) return [];
      // Horizontal rules and table separator rows carry no speech.
      if (/^([-*_]\s*){3,}$/.test(line) || /^\|?[\s:|-]+\|?$/.test(line)) return [];
      line = line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^>\s?/, "")
        .replace(/^([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, "")
        .replace(/^\||\|$/g, "")
        .replace(/\s*\|\s*/g, ", ")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/https?:\/\/\S+/g, "link")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/(\*\*|__)(.+?)\1/g, "$2")
        .replace(/(\*|_)(.+?)\1/g, "$2")
        .replace(/~~(.+?)~~/g, "$1")
        .trim();
      if (line.length === 0) return [];
      return [/[.!?:;,]$/.test(line) ? line : `${line}.`];
    });
  return lines.join(" ");
}

/** Splits text at sentence ends into pieces the speech engine accepts. */
export function splitSpeechChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.length > 0) chunks.push(current);
    current = "";
  };
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const piece of splitLongSentence(sentence, maxLength)) {
      if (current.length > 0 && current.length + 1 + piece.length > maxLength) flush();
      current = current.length > 0 ? `${current} ${piece}` : piece;
    }
  }
  flush();
  return chunks;
}

function splitLongSentence(sentence: string, maxLength: number): string[] {
  if (sentence.length <= maxLength) return sentence.length > 0 ? [sentence] : [];
  const pieces: string[] = [];
  let current = "";
  for (const word of sentence.split(/\s+/)) {
    // A single token longer than the limit is cut so the engine never rejects it.
    for (let start = 0; start < word.length; start += maxLength) {
      const part = word.slice(start, start + maxLength);
      if (current.length > 0 && current.length + 1 + part.length > maxLength) {
        pieces.push(current);
        current = "";
      }
      current = current.length > 0 ? `${current} ${part}` : part;
    }
  }
  if (current.length > 0) pieces.push(current);
  return pieces;
}

export interface ConversationRun {
  readonly id: string;
  readonly status: string;
}

export interface ConversationMessage {
  readonly id: string;
  readonly runId: string | null;
  readonly role: "user" | "assistant" | "system";
  readonly text: string;
  readonly streaming: boolean;
  /** Notifications and delegated-task completions are not replies to the user. */
  readonly notification?: unknown;
  readonly delegatedCompletion?: unknown;
}

export interface SpokenReply {
  readonly runId: string;
  readonly messageId: string;
  readonly text: string;
}

/**
 * Watches a thread's runs and reports each newly completed run's final reply
 * once. The first observation only records what already finished, so opening a
 * thread or switching Conversation on never replays history.
 */
export function createConversationReplyTracker() {
  const settledRunIds = new Set<string>();
  let baselined = false;

  return {
    observe(input: {
      readonly runs: ReadonlyArray<ConversationRun>;
      readonly messages: ReadonlyArray<ConversationMessage>;
    }): SpokenReply | null {
      const completed = input.runs.filter((run) => run.status === "completed");
      if (!baselined) {
        baselined = true;
        for (const run of completed) settledRunIds.add(run.id);
        return null;
      }
      // Runs arrive oldest first; speak the newest unsettled one and settle the rest.
      let reply: SpokenReply | null = null;
      for (const run of completed) {
        if (settledRunIds.has(run.id)) continue;
        const candidate = finalReplyOf(run.id, input.messages);
        // The reply may land just after the run flips to completed: retry later.
        if (candidate === null) continue;
        settledRunIds.add(run.id);
        reply = candidate;
      }
      return reply;
    },
  };
}

function finalReplyOf(
  runId: string,
  messages: ReadonlyArray<ConversationMessage>,
): SpokenReply | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (
      message.runId !== runId ||
      message.role !== "assistant" ||
      message.streaming ||
      message.notification !== undefined ||
      message.delegatedCompletion !== undefined
    ) {
      continue;
    }
    const text = toSpokenText(message.text);
    if (text.length > 0) return { runId, messageId: message.id, text };
  }
  return null;
}
