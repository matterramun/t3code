import * as Speech from "expo-speech";

import { splitSpeechChunks } from "../lib/conversationReply";

/**
 * Reads text aloud with the system voice. Speaking replaces whatever was being
 * read; the engine queues the chunks of one reply in order.
 */
export function speakText(text: string): void {
  Speech.stop();
  for (const chunk of splitSpeechChunks(text, Speech.maxSpeechInputLength)) {
    Speech.speak(chunk);
  }
}

export function stopSpeaking(): void {
  Speech.stop();
}
