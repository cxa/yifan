package im.cxa.fanatter

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class YifanJustifiedTextManager : SimpleViewManager<YifanJustifiedTextView>() {

  override fun getName(): String = NAME

  override fun createViewInstance(reactContext: ThemedReactContext): YifanJustifiedTextView {
    return YifanJustifiedTextView(reactContext)
  }

  @ReactProp(name = "segments")
  fun setSegments(view: YifanJustifiedTextView, segments: ReadableArray?) {
    val list = mutableListOf<Map<String, Any?>>()
    if (segments != null) {
      for (i in 0 until segments.size()) {
        val map = segments.getMap(i) ?: continue
        list.add(map.toHashMap())
      }
    }
    view.segments = list
  }

  @ReactProp(name = "textColor", customType = "Color")
  fun setTextColor(view: YifanJustifiedTextView, color: Int?) {
    if (color != null) view.textColorValue = color
  }

  @ReactProp(name = "accentColor", customType = "Color")
  fun setAccentColor(view: YifanJustifiedTextView, color: Int?) {
    if (color != null) view.accentColorValue = color
  }

  @ReactProp(name = "tagActiveColor", customType = "Color")
  fun setTagActiveColor(view: YifanJustifiedTextView, color: Int?) {
    if (color != null) view.tagActiveTextColor = color
  }

  @ReactProp(name = "tagActiveBackgroundColor", customType = "Color")
  fun setTagActiveBackgroundColor(view: YifanJustifiedTextView, color: Int?) {
    view.tagActiveBackground = color
  }

  @ReactProp(name = "tagInactiveBackgroundColor", customType = "Color")
  fun setTagInactiveBackgroundColor(view: YifanJustifiedTextView, color: Int?) {
    view.tagInactiveBackground = color
  }

  @ReactProp(name = "fontFamily")
  fun setFontFamily(view: YifanJustifiedTextView, family: String?) {
    view.customFontFamily = family
  }

  @ReactProp(name = "fontSize", defaultFloat = 15f)
  fun setFontSize(view: YifanJustifiedTextView, size: Float) {
    view.fontSizeDp = if (size > 0f) size else 15f
  }

  @ReactProp(name = "lineHeight", defaultFloat = 24f)
  fun setLineHeight(view: YifanJustifiedTextView, height: Float) {
    view.lineHeightDp = if (height > 0f) height else 24f
  }

  @ReactProp(name = "justify", defaultBoolean = true)
  fun setJustify(view: YifanJustifiedTextView, justify: Boolean) {
    view.justifyEnabled = justify
  }

  @ReactProp(name = "activeTag")
  fun setActiveTag(view: YifanJustifiedTextView, tag: String?) {
    view.activeTag = tag
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
      mapOf(
          "topPressMention" to mapOf("registrationName" to "onPressMention"),
          "topPressTag" to mapOf("registrationName" to "onPressTag"),
          "topPressLink" to mapOf("registrationName" to "onPressLink"),
          "topPressText" to mapOf("registrationName" to "onPressText"),
          "topContentSizeChange" to mapOf("registrationName" to "onContentSizeChange"),
      )

  companion object {
    const val NAME = "YifanJustifiedText"
  }
}
