import CoreSpotlight
import React
import ReactAppDependencyProvider
import React_RCTAppDelegate
import UIKit
import UniformTypeIdentifiers

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  // Required by UIApplicationDelegate protocol; used by RCTLogBoxView.dealloc
  // to restore the key window after dismissing the LogBox overlay.
  var window: UIWindow?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

    donateSpotlightItem()

    return true
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
  }

  func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return RCTLinkingManager.application(application, open: url, options: options)
  }

  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    return RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }

  private func donateSpotlightItem() {
    let attributes = CSSearchableItemAttributeSet(contentType: UTType.application)
    attributes.title = "一饭"
    attributes.contentDescription = "饭否客户端"
    attributes.keywords = ["fanfou", "饭否", "yifan", "一饭", "Fanfou", "饭唠"]
    let item = CSSearchableItem(
      uniqueIdentifier: "im.cxa.fanatter.app",
      domainIdentifier: "app",
      attributeSet: attributes
    )
    item.expirationDate = .distantFuture
    CSSearchableIndex.default().indexSearchableItems([item]) { _ in }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
    #if DEBUG
      RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
      resolveProductionBundleURL()
    #endif
  }

  private func resolveProductionBundleURL() -> URL? {
    let fm = FileManager.default
    guard let docs = fm.urls(for: .documentDirectory, in: .userDomainMask).first else {
      return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    }
    let otaDir = docs.appendingPathComponent("ota")
    let otaBundle = otaDir.appendingPathComponent("main.jsbundle")
    let nativeVersionFile = otaDir.appendingPathComponent("native-version.txt")

    if fm.fileExists(atPath: otaBundle.path),
       let storedVersion = try? String(contentsOf: nativeVersionFile, encoding: .utf8)
         .trimmingCharacters(in: .whitespacesAndNewlines),
       let currentNativeVersion = Bundle.main.infoDictionary?["NativeVersion"] as? String,
       storedVersion == currentNativeVersion {
      return otaBundle
    }

    // OTA bundle absent or stale (native was updated) — clean up and use packaged bundle
    if fm.fileExists(atPath: otaDir.path) {
      try? fm.removeItem(at: otaDir)
    }
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
  }
}

