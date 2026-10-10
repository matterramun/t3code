import { HeaderHeightContext } from "@react-navigation/elements";
import { useContext } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText } from "../../components/ui/AppText";
import { cn } from "../../lib/cn";
import { pauseSpeaking, resumeSpeaking, useSpeechPlaybackState } from "../../native/speech";
import { useThreadConversation } from "../../state/use-thread-conversation";

/**
 * Sits under the thread title while Conversation mode is on: one big control to
 * pause the reply being read aloud and pick it up again. It stays in place when
 * nothing is playing so the thread below does not jump when a reply starts.
 */
export function ConversationPlaybackBar(props: {
  readonly threadKey: string | null;
  /** The glass header floats over the thread, so the bar starts below it. */
  readonly headerOverlaysContent: boolean;
}) {
  const { enabled } = useThreadConversation(props.threadKey);
  const playback = useSpeechPlaybackState();
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext) ?? insets.top + 44;
  if (!enabled) return null;

  const idle = playback === "idle";
  const paused = playback === "paused";
  const label = idle ? "Reads new replies aloud" : paused ? "Resume reading" : "Pause reading";
  return (
    <View
      className="px-4 pb-2 pt-2"
      style={props.headerOverlaysContent ? { marginTop: headerHeight } : undefined}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: idle }}
        disabled={idle}
        onPress={paused ? resumeSpeaking : pauseSpeaking}
        className={cn(
          "min-h-14 flex-row items-center justify-center gap-3 rounded-2xl px-5",
          idle ? "bg-subtle-strong" : "bg-primary active:opacity-80",
        )}
      >
        <SymbolView
          name={paused ? "play" : "pause"}
          size={22}
          tintColorClassName={idle ? "accent-icon-muted" : "accent-primary-foreground"}
          type="monochrome"
        />
        <AppText
          className={cn(
            "font-t3-medium text-base",
            idle ? "text-foreground-muted" : "text-primary-foreground",
          )}
        >
          {label}
        </AppText>
      </Pressable>
    </View>
  );
}
