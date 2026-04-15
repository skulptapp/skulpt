Pod::Spec.new do |s|
  s.name           = 'ExpoWatchConnectivity'
  s.version        = '1.0.0'
  s.summary        = 'Module for WatchConnectivity'
  s.description    = 'Bridge between React Native and WatchConnectivity framework'
  s.homepage       = 'https://github.com/skulptapp/skulpt'
  s.license        = { :type => 'GPL-3.0' }
  s.author         = ''
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/skulptapp/skulpt.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'WatchConnectivity'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
