package expo.modules.t3speechaudiofocus

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Holds transient audio focus while a reply is read aloud, so music and podcasts pause and pick
 * up again when focus is released. Losing focus to another app is reported so reading can pause.
 */
class T3SpeechAudioFocusModule : Module() {
  private var request: AudioFocusRequest? = null
  private var held = false

  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    if (held && (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT)) {
      sendEvent("onFocusLost")
    }
  }

  private val audioManager: AudioManager?
    get() = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  override fun definition() = ModuleDefinition {
    Name("T3SpeechAudioFocus")
    Events("onFocusLost")

    Function("acquire") { acquire() }
    Function("release") { release() }
    OnDestroy { release() }
  }

  private fun acquire() {
    if (held) return
    val manager = audioManager ?: return
    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        )
        .setOnAudioFocusChangeListener(focusListener, Handler(Looper.getMainLooper()))
        .build()
      request = focusRequest
      manager.requestAudioFocus(focusRequest)
    } else {
      @Suppress("DEPRECATION")
      manager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    }
    // A refused request still lets reading continue; the other audio just keeps playing.
    held = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
  }

  private fun release() {
    val manager = audioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      request?.let { manager?.abandonAudioFocusRequest(it) }
      request = null
    } else if (held) {
      @Suppress("DEPRECATION")
      manager?.abandonAudioFocus(focusListener)
    }
    held = false
  }
}
