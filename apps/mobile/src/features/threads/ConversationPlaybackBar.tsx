import { HeaderHeightContext } from "@react-navigation/elements";
import { useContext } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolView, type AppSymbolName } from "../../components/ui/AppSymbol";
import { AppText } from "../../components/ui/AppText";
import { cn } from "../../lib/cn";
import {
  pauseSpeaking,
  restartSpeaking,
  resumeSpeaking,
  skipSentences,
  speakText,
  useSpeechPlaybackState,
} from "../../native/speech";
import { useThreadConversation } from "../../state/use-thread-conversation";

/**
 * Sits under the thread title while Conversation mode is on: one big control to
 * pause the reply being read aloud and pick it up again, or read the last reply
 * once it has finished, with sentence skip and restart beside it. It stays in
 * place when nothing is playing so the thread below does not jump when a reply
 * starts.
 */
export function ConversationPlaybackBar(props: {
  readonly threadKey: string | null;
  /** The last finished reply as speech, or null before the agent has answered. */
  readonly lastReplyText: string | null;
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
  const canReadLast = idle && props.lastReplyText !== null;
  const mainDisabled = idle && !canReadLast;
  const label = canReadLast
    ? "Read last reply"
    : idle
      ? "Reads new replies aloud"
      : paused
        ? "Resume reading"
        : "Pause reading";
  const onMainPress = () => {
    if (canReadLast && props.lastReplyText !== null) speakText(props.lastReplyText);
    else if (paused) resumeSpeaking();
    else pauseSpeaking();
  };

  return (
    <View
      className="flex-row items-stretch gap-2 px-4 pb-2 pt-2"
      style={props.headerOverlaysContent ? { marginTop: headerHeight } : undefined}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: mainDisabled }}
        disabled={mainDisabled}
        onPress={onMainPress}
        className={cn(
          "min-h-14 flex-1 flex-row items-center justify-center gap-3 rounded-2xl px-4",
          mainDisabled ? "bg-subtle-strong" : "bg-primary active:opacity-80",
        )}
      >
        <SymbolView
          name={idle || paused ? "play" : "pause"}
          size={22}
          tintColorClassName={mainDisabled ? "accent-icon-muted" : "accent-primary-foreground"}
          type="monochrome"
        />
        <AppText
          numberOfLines={1}
          className={cn(
            "font-t3-medium text-base",
            mainDisabled ? "text-foreground-muted" : "text-primary-foreground",
          )}
        >
          {label}
        </AppText>
      </Pressable>
      <View className="flex-row overflow-hidden rounded-2xl bg-subtle-strong">
        <SkipButton
          label="Previous sentence"
          symbol="chevron.left"
          disabled={idle}
          onPress={() => skipSentences(-1)}
        />
        <SkipButton
          label="Restart reading"
          symbol="arrow.clockwise"
          disabled={idle}
          onPress={restartSpeaking}
        />
        <SkipButton
          label="Next sentence"
          symbol="chevron.right"
          disabled={idle}
          onPress={() => skipSentences(1)}
        />
      </View>
    </View>
  );
}

function SkipButton(props: {
  readonly label: string;
  readonly symbol: AppSymbolName;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      className="min-h-14 w-11 items-center justify-center active:opacity-60"
    >
      <SymbolView
        name={props.symbol}
        size={20}
        tintColorClassName={props.disabled ? "accent-icon-subtle" : "accent-icon"}
        type="monochrome"
      />
    </Pressable>
  );
}
