package im.cxa.fanatter

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
  private var isAppReady = false
  private var launchOverlay: View? = null
  private var didHideLaunchOverlay = false

  companion object {
    private const val SPLASH_TIMEOUT_MS = 5000L
  }

  override fun getMainComponentName(): String = "gohan"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    val splashScreen = installSplashScreen()
    splashScreen.setKeepOnScreenCondition { !isAppReady }
    splashScreen.setOnExitAnimationListener { provider ->
      // Fade out our overlay in sync with the system splash exit
      hideLaunchOverlay()
      provider.view.animate()
        .alpha(0f)
        .setDuration(200)
        .withEndAction { provider.remove() }
        .start()
    }

    Handler(Looper.getMainLooper()).postDelayed({
      isAppReady = true
    }, SPLASH_TIMEOUT_MS)

    // Draw behind both system bars (edge-to-edge).
    WindowCompat.setDecorFitsSystemWindows(window, false)

    // API < 35: set color directly. Ignored on API 35+ but kept for older devices.
    @Suppress("DEPRECATION")
    window.statusBarColor = Color.TRANSPARENT
    @Suppress("DEPRECATION")
    window.navigationBarColor = Color.TRANSPARENT

    // API 29+: disable the contrast-enforcement scrim the system adds behind
    // gesture navigation bars on some OEMs.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }

    super.onCreate(savedInstanceState)
    showLaunchOverlay()
    keepSplashUntilFirstReactDraw()

    // API 35+ (Android 15): window.navigationBarColor is fully ignored.
    // WindowInsetsControllerCompat is the only way to influence bar appearance.
    // This must be called after super.onCreate() so the decorView is attached.
    WindowInsetsControllerCompat(window, window.decorView).also { controller ->
      controller.isAppearanceLightNavigationBars = false
    }
  }

  private fun showLaunchOverlay() {
    val overlay = LayoutInflater.from(this).inflate(R.layout.launch_screen_overlay, null)
    window.addContentView(
      overlay,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    )
    launchOverlay = overlay
  }

  private fun hideLaunchOverlay() {
    if (didHideLaunchOverlay) return
    didHideLaunchOverlay = true
    val overlay = launchOverlay ?: return
    overlay.animate()
      .alpha(0f)
      .setDuration(200)
      .withEndAction {
        (overlay.parent as? ViewGroup)?.removeView(overlay)
        launchOverlay = null
      }
      .start()
  }

  private fun keepSplashUntilFirstReactDraw() {
    val contentView = findViewById<ViewGroup>(android.R.id.content)
    val preDrawListener = object : ViewTreeObserver.OnPreDrawListener {
      override fun onPreDraw(): Boolean {
        val rootView = contentView.getChildAt(0) as? ViewGroup
        val shouldReleaseSplash = isAppReady || (rootView != null && rootView.childCount > 0)
        if (shouldReleaseSplash) {
          isAppReady = true
          contentView.viewTreeObserver.removeOnPreDrawListener(this)
          return true
        }
        return false
      }
    }
    contentView.viewTreeObserver.addOnPreDrawListener(preDrawListener)
  }
}
