import type { VoiceTranscriber } from "@t3tools/client-runtime/voice-input";

type Subscription = { remove(): void };

export interface VoiceRecordingInput {
  readonly uid: string;
  readonly name: string;
  readonly type: string;
}

// The subset of expo-audio's native `AudioRecorder` the voice input hook uses.
export interface NativeVoiceRecorder<TStatus, TRecorderState> {
  readonly uri: string | null;
  prepareToRecordAsync(): Promise<void>;
  record(options: { readonly forDuration: number }): void;
  stop(): Promise<void>;
  getStatus(): TRecorderState;
  addListener(
    eventName: "recordingStatusUpdate",
    listener: (status: TStatus) => void,
  ): Subscription;
  getAvailableInputs(): ReadonlyArray<VoiceRecordingInput>;
  setInput(uid: string): void;
  release(): void;
}

/** The recorder status fields dictation reads; expo-audio's `RecordingStatus` satisfies it. */
export type VoiceCaptureStatus = {
  readonly isFinished: boolean;
  readonly hasError: boolean;
  readonly mediaServicesDidReset?: boolean;
  readonly error: string | null;
  readonly url: string | null;
};

/** The recorder state dictation samples for its waveform and timer. */
export type VoiceCaptureState = {
  readonly isRecording: boolean;
  readonly metering?: number | undefined;
  readonly durationMillis: number;
};

/**
 * Speech-to-text a platform provides in place of "record with expo-audio, then
 * transcribe the file". Its recorder listens through the platform recognizer
 * and its transcriber returns what that recognizer heard.
 */
export type PlatformVoiceCapture = {
  readonly createRecorder: () => NativeVoiceRecorder<VoiceCaptureStatus, VoiceCaptureState>;
  readonly getTranscriber: () => VoiceTranscriber | null;
  readonly requestPermission: () => Promise<{
    readonly granted: boolean;
    readonly canAskAgain: boolean;
  }>;
};
