import CoreSpotlight
import React
import ReactAppDependencyProvider
import React_RCTAppDelegate
import UIKit
import UniformTypeIdentifiers

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  private var launchScreenView: UIView?
  private var didHideLaunchScreen = false

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  private static let reactContentDidAppearNotification =
    Notification.Name("RCTContentDidAppearNotification")
  private static let launchScreenTimeout: TimeInterval = 5

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)
    observeReactContentDidAppear()
    showLaunchScreenOverlayIfNeeded()

    factory.startReactNative(
      withModuleName: "gohan",
      in: window,
      launchOptions: launchOptions
    )
    scheduleLaunchScreenFallbackHide()
    donateSpotlightItem()

    return true
  }

  private func donateSpotlightItem() {
    let attributes = CSSearchableItemAttributeSet(contentType: UTType.application)
    attributes.title = "Gohan"
    attributes.contentDescription = "饭否客户端"
    attributes.keywords = ["fanfou", "饭否", "gohan", "悟饭", "Fanfou", "饭唠"]
    let item = CSSearchableItem(
      uniqueIdentifier: "im.cxa.fanatter.app",
      domainIdentifier: "app",
      attributeSet: attributes
    )
    item.expirationDate = .distantFuture
    CSSearchableIndex.default().indexSearchableItems([item]) { _ in }
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

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  private func observeReactContentDidAppear() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleReactContentDidAppear),
      name: Self.reactContentDidAppearNotification,
      object: nil
    )
  }

  private func showLaunchScreenOverlayIfNeeded() {
    guard let window, launchScreenView == nil else {
      return
    }

    let storyboard = UIStoryboard(name: "LaunchScreen", bundle: nil)
    guard let launchViewController = storyboard.instantiateInitialViewController() else {
      return
    }

    let overlay = launchViewController.view
    overlay?.frame = window.bounds
    overlay?.autoresizingMask = [.flexibleWidth, .flexibleHeight]

    guard let overlay else {
      return
    }

    window.addSubview(overlay)
    window.bringSubviewToFront(overlay)
    launchScreenView = overlay
  }

  private func scheduleLaunchScreenFallbackHide() {
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.launchScreenTimeout) { [weak self] in
      self?.hideLaunchScreenOverlay()
    }
  }

  @objc private func handleReactContentDidAppear() {
    hideLaunchScreenOverlay()
  }

  private func hideLaunchScreenOverlay() {
    guard !didHideLaunchScreen else {
      return
    }

    didHideLaunchScreen = true
    NotificationCenter.default.removeObserver(
      self,
      name: Self.reactContentDidAppearNotification,
      object: nil
    )

    guard let overlay = launchScreenView else {
      return
    }

    UIView.animate(
      withDuration: 0.2,
      delay: 0,
      options: [.beginFromCurrentState, .curveEaseOut]
    ) {
      overlay.alpha = 0
    } completion: { [weak self] _ in
      overlay.removeFromSuperview()
      self?.launchScreenView = nil
    }
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
      Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
