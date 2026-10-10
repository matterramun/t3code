import AVFoundation
import ExpoModulesCore

/// Holds an exclusive audio session while a reply is read aloud, so music and podcasts pause and
/// resume when it is released. An interruption from another app is reported so reading can pause.
public final class T3SpeechAudioFocusModule: Module {
  private var held = false
  private var interruptionObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("T3SpeechAudioFocus")
    Events("onFocusLost")

    Function("acquire") { [weak self] in
      self?.acquire()
    }
    Function("release") { [weak self] in
      self?.release()
    }
    OnDestroy { [weak self] in
      self?.release()
    }
  }

  private func acquire() {
    guard !held else { return }
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, mode: .spokenAudio, options: [])
      try session.setActive(true)
    } catch {
      // Reading still works without focus; the other audio just keeps playing.
      return
    }
    held = true
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: session,
      queue: .main
    ) { [weak self] notification in
      guard
        let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        AVAudioSession.InterruptionType(rawValue: raw) == .began
      else { return }
      self?.sendEvent("onFocusLost")
    }
  }

  private func release() {
    if let observer = interruptionObserver {
      NotificationCenter.default.removeObserver(observer)
      interruptionObserver = nil
    }
    guard held else { return }
    held = false
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
