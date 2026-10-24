import { useRef } from "react";
import { Pressable, type TextInputInstance, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { SearchField } from "../../components/ui/SearchField";

/** Find-in-file controls: the query, "n of m", previous and next hit, and close. */
export function FileFindBar(props: {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  /** 0-based position of the active hit, or null when there is none. */
  readonly activeIndex: number | null;
  readonly total: number;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onClose: () => void;
}) {
  const inputRef = useRef<TextInputInstance>(null);
  const hasQuery = props.query.trim().length > 0;
  const disabled = props.total === 0;
  return (
    <View className="flex-row items-center gap-1 bg-sheet px-3 pb-2 pt-1">
      <SearchField
        inputRef={inputRef}
        accessibilityLabel="Find in file"
        clearAccessibilityLabel="Clear find"
        placeholder="Find in file"
        value={props.query}
        onChangeText={props.onQueryChange}
      />
      <Text className="min-w-[56px] text-center text-sm text-foreground-muted">
        {!hasQuery
          ? ""
          : props.total === 0
            ? "None"
            : `${(props.activeIndex ?? 0) + 1}/${props.total}`}
      </Text>
      <Pressable
        accessibilityLabel="Previous match"
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={8}
        className="p-2"
        style={{ opacity: disabled ? 0.35 : 1 }}
        onPress={props.onPrevious}
      >
        <SymbolView name="chevron.up" size={20} tintColorClassName="accent-foreground" />
      </Pressable>
      <Pressable
        accessibilityLabel="Next match"
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={8}
        className="p-2"
        style={{ opacity: disabled ? 0.35 : 1 }}
        onPress={props.onNext}
      >
        <SymbolView name="chevron.down" size={20} tintColorClassName="accent-foreground" />
      </Pressable>
      <Pressable
        accessibilityLabel="Close find"
        accessibilityRole="button"
        hitSlop={8}
        className="p-2"
        onPress={props.onClose}
      >
        <SymbolView name="xmark" size={20} tintColorClassName="accent-foreground" />
      </Pressable>
    </View>
  );
}
