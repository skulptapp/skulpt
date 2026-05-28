Pod::Spec.new do |s|
  s.name           = 'WorkoutCommand'
  s.version        = '1.0.0'
  s.summary        = 'Module for workout action commands'
  s.description    = 'Shared bridge for workout commands from native surfaces'
  s.homepage       = 'https://github.com/skulptapp/skulpt'
  s.license        = { :type => 'GPL-3.0' }
  s.author         = ''
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/skulptapp/skulpt.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
