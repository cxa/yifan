Pod::Spec.new do |s|
  s.name         = 'rn-fanfou-client'
  s.version      = '0.0.1'
  s.summary      = 'Fanfou OAuth client for React Native'
  s.license      = { :type => 'MIT' }
  s.author       = { 'realazy' => 'xianan.chen@gmail.com' }
  s.homepage     = 'https://realazy.com'
  s.platforms    = { :ios => '13.0' }
  s.source       = { :path => '.' }
  s.source_files = 'ios/**/*.{h,m}'
  s.requires_arc = true
  s.dependency 'React-Core'
end
