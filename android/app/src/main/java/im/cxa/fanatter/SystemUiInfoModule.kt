package im.cxa.fanatter

import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class SystemUiInfoModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SystemUiInfo"

  override fun getConstants(): MutableMap<String, Any> =
      mutableMapOf(
          "navigationBarVisible" to isNavigationBarVisible(),
      )

  private fun isNavigationBarVisible(): Boolean {
    val activity = currentActivity ?: return true
    val decorView = activity.window?.decorView ?: return true
    val insets = ViewCompat.getRootWindowInsets(decorView) ?: return true
    return insets.isVisible(WindowInsetsCompat.Type.navigationBars())
  }
}
