import { requireOptionalNativeModule } from "expo";

type SpeechAudioFocusModule = {
  acquire: () => void;
  release: () => void;
  addListener: (event: "onFocusLost", listener: () => void) => { remove: () => void };
};

// Missing on builds that predate the module: reading still works, other audio just keeps playing.
const focusModule = requireOptionalNativeModule<SpeechAudioFocusModule>("T3SpeechAudioFocus");

/** Pauses other apps' audio while a reply is read aloud, and lets it resume afterwards. */
export const speechAudioFocus = {
  acquire: () => focusModule?.acquire(),
  release: () => focusModule?.release(),
  /** Another app took the audio, such as a call or a podcast starting. */
  onFocusLost: (listener: () => void) => focusModule?.addListener("onFocusLost", listener),
};
