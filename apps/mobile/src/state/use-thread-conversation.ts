import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useCallback } from "react";

import { withConversationThread } from "../lib/conversationThreads";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "./preferences";

const NO_THREADS: ReadonlyArray<string> = [];

/** Whether finished replies in this thread are read aloud, kept per thread on this device. */
export function useThreadConversation(threadKey: string | null) {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const threads = AsyncResult.isSuccess(preferences)
    ? (preferences.value.conversationThreads ?? NO_THREADS)
    : NO_THREADS;
  const enabled = threadKey !== null && threads.includes(threadKey);
  const setEnabled = useCallback(
    (value: boolean) => {
      if (threadKey === null) return;
      savePreferences({
        transform: (current) => ({
          conversationThreads: withConversationThread(
            current.conversationThreads ?? NO_THREADS,
            threadKey,
            value,
          ),
        }),
      });
    },
    [savePreferences, threadKey],
  );
  return { enabled, setEnabled };
}
