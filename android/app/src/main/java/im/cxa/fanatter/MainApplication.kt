package im.cxa.fanatter

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.rnfanfouclient.FanfouSecrets
import java.io.File

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    val packageList = PackageList(this).packages
    packageList.add(SystemUiInfoPackage())

    // Load OTA JS bundle if available and compatible with current native version
    val otaDir = File(filesDir, "ota")
    val otaBundle = File(otaDir, "index.android.bundle")
    val nativeVersionFile = File(otaDir, "native-version.txt")
    val jsBundleFile: String? = when {
      otaBundle.exists() && nativeVersionFile.exists() -> {
        val storedNativeVersion = nativeVersionFile.readText().trim()
        if (storedNativeVersion == BuildConfig.NATIVE_VERSION) {
          otaBundle.absolutePath
        } else {
          // Native was updated since OTA was applied — clear stale bundle
          otaDir.deleteRecursively()
          null
        }
      }
      else -> null
    }

    getDefaultReactHost(
      context = applicationContext,
      packageList = packageList,
      jsBundleFilePath = jsBundleFile,
    )
  }

  override fun onCreate() {
    super.onCreate()
    FanfouSecrets.configure(EnvSecrets.consumerKey(), EnvSecrets.consumerSecret())
    loadReactNative(this)
  }
}
