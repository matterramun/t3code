import type { PlatformVoiceCapture } from "./voiceCaptureTypes";

/** Android supplies its own capture; other platforms use the shared recording path. */
export function getPlatformVoiceCapture(): PlatformVoiceCapture | null {
  return null;
}
