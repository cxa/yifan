package im.cxa.fanatter

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.rnfanfouclient.FanfouSecrets

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    val packageList = PackageList(this).packages
    packageList.add(SystemUiInfoPackage())
    getDefaultReactHost(
      context = applicationContext,
      packageList = packageList,
    )
  }

  override fun onCreate() {
    super.onCreate()
    FanfouSecrets.configure(EnvSecrets.consumerKey(), EnvSecrets.consumerSecret())
    loadReactNative(this)
  }
}
