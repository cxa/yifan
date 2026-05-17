import React
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  private var launchScreenView: UIView?
  private var didHideLaunchScreen = false

  private static let reactContentDidAppearNotification =
    Notification.Name("RCTContentDidAppearNotification")
  private static let launchScreenTimeout: TimeInterval = 5

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let appDelegate = UIApplication.shared.delegate as! AppDelegate

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    observeReactContentDidAppear()
    showLaunchScreenOverlayIfNeeded()

    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "yifan",
      in: window,
      launchOptions: appDelegate.launchOptions
    )
    scheduleLaunchScreenFallbackHide()

    // Forward URLs that arrived as the cold-launch trigger (e.g. share
    // extension fired `yifan://compose` while the host wasn't running).
    // Scene-based apps short-circuit AppDelegate.application(_:open:options:),
    // so without this RCTLinkingManager never sees the URL and JS Linking
    // listeners stay silent.
    for urlContext in connectionOptions.urlContexts {
      forwardURLToLinkingManager(urlContext.url)
    }
  }

  // Warm-launch URL deliveries (the host app is already running). Same
  // story: AppDelegate.application(_:open:options:) is bypassed in
  // scene-based apps, so we have to hand the URL to RCTLinkingManager
  // ourselves.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for urlContext in URLContexts {
      forwardURLToLinkingManager(urlContext.url)
    }
  }

  // NSUserActivity-based deep links (universal links, Handoff). Not
  // strictly required for the share-extension flow, but cheap insurance.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

  private func forwardURLToLinkingManager(_ url: URL) {
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
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
    guard let window, launchScreenView == nil else { return }
    let storyboard = UIStoryboard(name: "LaunchScreen", bundle: nil)
    guard let launchViewController = storyboard.instantiateInitialViewController() else { return }
    let overlay = launchViewController.view
    overlay?.frame = window.bounds
    overlay?.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    guard let overlay else { return }
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
    guard !didHideLaunchScreen else { return }
    didHideLaunchScreen = true
    NotificationCenter.default.removeObserver(
      self,
      name: Self.reactContentDidAppearNotification,
      object: nil
    )
    guard let overlay = launchScreenView else { return }
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
