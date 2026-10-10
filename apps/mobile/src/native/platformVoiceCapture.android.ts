import {
  VoiceTranscriptionError,
  throwIfVoiceTranscriptionAborted,
  type VoiceTranscriber,
} from "@t3tools/client-runtime/voice-input";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

import {
  createTranscriptAccumulator,
  recognizerVolumeToMetering,
} from "./speechRecognitionTranscript";
import type {
  NativeVoiceRecorder,
  PlatformVoiceCapture,
  VoiceCaptureState,
  VoiceCaptureStatus,
} from "./voiceCaptureTypes";

const URI_PREFIX = "speech-recognition:";
// Stopping asks the recognizer for its final result, which can take a moment.
const STOP_TIMEOUT_MS = 5_000;
const VOLUME_INTERVAL_MS = 80;
// Silence and "heard nothing" end a session without a failure: dictation reports
// that as an empty transcript instead of an error.
const SILENT_END_ERRORS = new Set(["no-speech", "speech-timeout"]);

type Subscription = { remove(): void };

type RecognitionSession = {
  readonly id: string;
  readonly transcript: ReturnType<typeof createTranscriptAccumulator>;
  readonly ended: Promise<void>;
  readonly markEnded: () => void;
  isEnded: boolean;
  startedAt: number | null;
  metering: number;
};

// The controller records, then transcribes the same session by uri.
let latestSession: RecognitionSession | null = null;
let nextSessionId = 0;

/** Waits for the recognizer to report its end, but never longer than the timeout. */
function waitForEnd(session: RecognitionSession): Promise<void> {
  return Promise.race([
    session.ended,
    new Promise<void>((resolve) => setTimeout(resolve, STOP_TIMEOUT_MS)),
  ]);
}

function getDeviceLocale(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

function createSession(): RecognitionSession {
  const { promise, resolve } = Promise.withResolvers<void>();
  return {
    id: String(++nextSessionId),
    transcript: createTranscriptAccumulator(),
    ended: promise,
    markEnded: resolve,
    isEnded: false,
    startedAt: null,
    metering: Number.NEGATIVE_INFINITY,
  };
}

function createRecognizerRecorder(): NativeVoiceRecorder<VoiceCaptureStatus, VoiceCaptureState> {
  let session: RecognitionSession | null = null;
  let subscriptions: Subscription[] = [];
  let statusListener: ((status: VoiceCaptureStatus) => void) | null = null;
  let limitTimer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  const uriOf = (current: RecognitionSession) => `${URI_PREFIX}${current.id}`;
  const emit = (status: Partial<VoiceCaptureStatus>) => {
    if (settled || !session) return;
    settled = true;
    statusListener?.({
      isFinished: false,
      hasError: false,
      error: null,
      url: null,
      ...status,
    });
  };
  const clearLimit = () => {
    if (limitTimer !== null) clearTimeout(limitTimer);
    limitTimer = null;
  };
  const detach = () => {
    for (const subscription of subscriptions) subscription.remove();
    subscriptions = [];
  };

  return {
    get uri() {
      return session ? uriOf(session) : latestSession ? uriOf(latestSession) : null;
    },
    async prepareToRecordAsync() {
      detach();
      const current = createSession();
      session = current;
      latestSession = current;
      settled = false;
      subscriptions = [
        ExpoSpeechRecognitionModule.addListener("start", () => {
          current.startedAt = Date.now();
        }),
        ExpoSpeechRecognitionModule.addListener("result", (event) => {
          const best = event.results[0];
          if (best)
            current.transcript.push({ isFinal: event.isFinal, transcript: best.transcript });
        }),
        ExpoSpeechRecognitionModule.addListener("volumechange", (event) => {
          current.metering = recognizerVolumeToMetering(event.value);
        }),
        ExpoSpeechRecognitionModule.addListener("error", (event) => {
          // Aborting on release is ours, not a failure.
          if (event.error === "aborted") return;
          if (SILENT_END_ERRORS.has(event.error)) {
            emit({ isFinished: true, url: uriOf(current) });
            return;
          }
          emit({ hasError: true, error: event.message || "Voice recognition failed." });
        }),
        ExpoSpeechRecognitionModule.addListener("end", () => {
          current.isEnded = true;
          current.markEnded();
          clearLimit();
          // An end nobody asked for (the recognizer heard its fill) finishes dictation.
          emit({ isFinished: true, url: uriOf(current) });
        }),
      ];
    },
    record(options) {
      if (!session) throw new Error("Voice recorder is not prepared.");
      ExpoSpeechRecognitionModule.start({
        lang: getDeviceLocale(),
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        addsPunctuation: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: VOLUME_INTERVAL_MS },
      });
      session.startedAt = Date.now();
      limitTimer = setTimeout(
        () => ExpoSpeechRecognitionModule.stop(),
        options.forDuration * 1_000,
      );
    },
    async stop() {
      const current = session;
      if (!current || current.isEnded) return;
      clearLimit();
      ExpoSpeechRecognitionModule.stop();
      await waitForEnd(current);
    },
    // The system recognizer listens to the default microphone, so there is nothing to rank or pick.
    getAvailableInputs() {
      return [];
    },
    setInput() {},
    getStatus() {
      const current = session;
      return {
        isRecording: current !== null && !current.isEnded,
        metering: current?.metering,
        durationMillis: current?.startedAt == null ? 0 : Date.now() - current.startedAt,
      };
    },
    addListener(_eventName, listener) {
      statusListener = listener;
      return {
        remove() {
          if (statusListener === listener) statusListener = null;
        },
      };
    },
    release() {
      clearLimit();
      detach();
      if (session && !session.isEnded) ExpoSpeechRecognitionModule.abort();
      session = null;
    },
  };
}

function getTranscriber(): VoiceTranscriber | null {
  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return null;
  const locale = getDeviceLocale();
  return {
    prepare: async ({ signal }) => {
      throwIfVoiceTranscriptionAborted(signal);
      return {
        locale,
        transcribe: async (uri, options) => {
          throwIfVoiceTranscriptionAborted(options.signal);
          const session = latestSession;
          if (!session || uri !== `${URI_PREFIX}${session.id}`) {
            throw new VoiceTranscriptionError(
              "transcription-failed",
              "The voice recording is no longer available.",
            );
          }
          await waitForEnd(session);
          throwIfVoiceTranscriptionAborted(options.signal);
          return session.transcript.text();
        },
      };
    },
  };
}

export function getPlatformVoiceCapture(): PlatformVoiceCapture {
  return {
    createRecorder: createRecognizerRecorder,
    getTranscriber,
    requestPermission: async () => {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return { granted: permission.granted, canAskAgain: permission.canAskAgain };
    },
  };
}
