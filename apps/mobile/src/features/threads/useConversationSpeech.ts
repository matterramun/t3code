import { useEffect, useRef } from "react";

import {
  createConversationReplyTracker,
  type ConversationMessage,
  type ConversationRun,
} from "../../lib/conversationReply";
import { speakText, stopSpeaking } from "../../native/speech";
import { useThreadConversation } from "../../state/use-thread-conversation";

const ACTIVE_RUN_STATUSES = new Set(["preparing", "starting", "running"]);

/**
 * Conversation mode: reads each finished reply of this thread aloud while the
 * thread is on screen. A new turn starting, switching the mode off, or leaving
 * the thread cuts the speech.
 */
export function useConversationSpeech(input: {
  readonly threadKey: string | null;
  readonly detail: {
    readonly runs: ReadonlyArray<ConversationRun>;
    readonly messages: ReadonlyArray<ConversationMessage>;
  } | null;
}) {
  const { enabled } = useThreadConversation(input.threadKey);
  const trackerRef = useRef<ReturnType<typeof createConversationReplyTracker> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    trackerRef.current = createConversationReplyTracker();
    return () => {
      trackerRef.current = null;
      stopSpeaking();
    };
  }, [enabled, input.threadKey]);

  const runs = input.detail?.runs;
  const messages = input.detail?.messages;
  useEffect(() => {
    const tracker = trackerRef.current;
    if (!tracker || !runs || !messages) return;
    if (runs.some((run) => ACTIVE_RUN_STATUSES.has(run.status))) stopSpeaking();
    const reply = tracker.observe({ runs, messages });
    if (reply) speakText(reply.text);
  }, [enabled, runs, messages]);
}
