Pod::Spec.new do |s|
  s.name           = 'T3SpeechAudioFocus'
  s.version        = '1.0.0'
  s.summary        = 'Pauses other apps\' audio while T3 Code reads replies aloud.'
  s.description    = 'Holds an exclusive audio session while speech plays and hands it back afterwards.'
  s.author         = 'T3 Tools'
  s.homepage       = 'https://t3tools.com'
  s.platforms      = {
    :ios => '18.0',
  }
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
