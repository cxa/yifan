package im.cxa.fanatter

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

class MainActivity : ReactActivity() {
  private var isAppReady = false
  private var launchOverlay: View? = null
  private var didHideLaunchOverlay = false

  companion object {
    private const val SPLASH_TIMEOUT_MS = 5000L
  }

  override fun getMainComponentName(): String = "yifan"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  // Resolve a share intent to a yifan:// URL, or null if not a share intent.
  @Suppress("DEPRECATION")
  private fun resolveShareIntent(intent: Intent): String? {
    if (intent.action != Intent.ACTION_SEND) return null
    val mimeType = intent.type ?: return null

    // Handle shared text
    if (mimeType == "text/plain") {
      val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return null
      if (text.isBlank()) return null
      return "yifan://share-text?text=${Uri.encode(text)}"
    }

    // Handle shared image
    if (!mimeType.startsWith("image/")) return null
    val uri: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    } ?: return null
    return try {
      val cacheFile = File(cacheDir, "share-image.jpg")
      if (uri.scheme == "file") {
        val srcPath = uri.path ?: return null
        FileInputStream(srcPath).use { input ->
          FileOutputStream(cacheFile).use { output -> input.copyTo(output) }
        }
      } else {
        contentResolver.openInputStream(uri)?.use { input ->
          FileOutputStream(cacheFile).use { output -> input.copyTo(output) }
        }
      }
      "yifan://share-image?file=${Uri.encode(cacheFile.absolutePath)}"
    } catch (_: Exception) {
      null
    }
  }

  override fun onNewIntent(intent: Intent) {
    val url = resolveShareIntent(intent)
    if (url != null) {
      val viewIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
      super.onNewIntent(viewIntent)
    } else {
      super.onNewIntent(intent)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Convert cold-start share intent to a yifan:// deep link so Linking.getInitialURL() picks it up
    intent?.let { resolveShareIntent(it) }?.let { url ->
      intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
    }

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

    // Edge-to-edge is enabled via edgeToEdgeEnabled=true in gradle.properties;
    // ReactActivityDelegate calls WindowCompat.setDecorFitsSystemWindows(false)
    // and makes the system bars transparent automatically.
    super.onCreate(savedInstanceState)
    showLaunchOverlay()
    keepSplashUntilFirstReactDraw()

    // Must run AFTER super.onCreate(): ReactActivityDelegate's edge-to-edge
    // setup re-enables isNavigationBarContrastEnforced on API 29+, so setting
    // it earlier would be overwritten and the gesture-bar scrim would remain.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }

    // Override ReactActivityDelegate's default — we want dark nav bar icons.
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
