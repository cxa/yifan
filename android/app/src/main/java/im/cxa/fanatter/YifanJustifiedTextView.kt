package im.cxa.fanatter

import android.content.Context
import android.graphics.Typeface
import android.os.Build
import android.text.Layout
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.text.style.UnderlineSpan
import android.util.TypedValue
import android.view.MotionEvent
import androidx.appcompat.widget.AppCompatTextView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.facebook.react.common.assets.ReactFontManager

// A non-null-ish segment marker we put on the spannable alongside the
// visual spans. Hit-testing reads this back to figure out what the tap
// should fire.
class YifanSegmentSpan(val type: String, val payload: String)

// Direct event we dispatch into React Native's event pipeline.
private class YifanJustifiedTextEvent(
    surfaceId: Int,
    viewId: Int,
    private val name: String,
    private val data: WritableMap?,
) : Event<YifanJustifiedTextEvent>(surfaceId, viewId) {
  override fun getEventName(): String = name
  override fun getEventData(): WritableMap? = data
}

class YifanJustifiedTextView(context: Context) : AppCompatTextView(context) {

  var segments: List<Map<String, Any?>> = emptyList()
    set(value) { field = value; rebuildText() }
  var textColorValue: Int = 0xFF000000.toInt()
    set(value) { field = value; rebuildText() }
  var accentColorValue: Int = 0xFF007AFF.toInt()
    set(value) { field = value; rebuildText() }
  var tagActiveTextColor: Int = 0xFFFFFFFF.toInt()
    set(value) { field = value; rebuildText() }
  var tagActiveBackground: Int? = null
    set(value) { field = value; rebuildText() }
  var tagInactiveBackground: Int? = null
    set(value) { field = value; rebuildText() }
  var customFontFamily: String? = null
    set(value) { field = value; applyFont(); rebuildText() }
  var fontSizeDp: Float = 15f
    set(value) {
      field = value
      setTextSize(TypedValue.COMPLEX_UNIT_DIP, value)
      rebuildText()
    }
  var lineHeightDp: Float = 24f
    set(value) {
      field = value
      applyLineHeight()
      rebuildText()
    }
  var justifyEnabled: Boolean = true
    set(value) { field = value; applyJustification() }
  var activeTag: String? = null
    set(value) { field = value; rebuildText() }

  private var lastReportedWidth: Int = -1
  private var lastReportedHeight: Int = -1

  init {
    setPadding(0, 0, 0, 0)
    includeFontPadding = false
    setTextIsSelectable(false)
    // HIGH_QUALITY break strategy gives the justify code the best
    // chance to distribute cleanly; default SIMPLE breaks greedy.
    breakStrategy = Layout.BREAK_STRATEGY_HIGH_QUALITY
    // OpenType `halt` (Alternate Half Widths) swaps full-width CJK
    // punctuation for compact glyphs at justification time — the
    // Android sibling of what we turned on in iOS resolveFont.
    fontFeatureSettings = "'halt'"
    applyJustification()
  }

  private fun applyJustification() {
    // JUSTIFICATION_MODE_INTER_CHARACTER is API 35 (Android 15). On
    // anything older we just render left-aligned — a clean fallback.
    if (Build.VERSION.SDK_INT >= 35) {
      justificationMode = if (justifyEnabled) {
        Layout.JUSTIFICATION_MODE_INTER_CHARACTER
      } else {
        Layout.JUSTIFICATION_MODE_NONE
      }
    }
  }

  private fun applyFont() {
    val family = customFontFamily
    typeface = if (family.isNullOrEmpty()) {
      Typeface.DEFAULT
    } else {
      runCatching {
        ReactFontManager.getInstance()
            .getTypeface(family, Typeface.NORMAL, context.assets)
      }.getOrNull() ?: Typeface.DEFAULT
    }
  }

  private fun applyLineHeight() {
    val px = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, lineHeightDp, resources.displayMetrics).toInt()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      lineHeight = px
    } else {
      // Approximate: pad the natural line height up to the requested
      // value. OK for pre-28 since we don't justify there anyway.
      val tsPx = TypedValue.applyDimension(
          TypedValue.COMPLEX_UNIT_DIP, fontSizeDp, resources.displayMetrics)
      val extra = (px - tsPx).coerceAtLeast(0f)
      setLineSpacing(extra, 1.0f)
    }
  }

  private fun rebuildText() {
    val builder = SpannableStringBuilder()
    val activeLower = activeTag?.lowercase()

    for (seg in segments) {
      val type = seg["type"] as? String ?: "text"
      val text = seg["text"] as? String ?: continue
      if (text.isEmpty()) continue
      val start = builder.length
      builder.append(text)
      val end = builder.length

      when (type) {
        "mention" -> {
          val screenName = seg["screenName"] as? String ?: ""
          builder.setSpan(
              ForegroundColorSpan(accentColorValue),
              start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
          builder.setSpan(
              YifanSegmentSpan("mention", screenName),
              start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        "tag" -> {
          val tag = seg["tag"] as? String ?: ""
          val isActive = activeLower != null && activeLower == tag.lowercase()
          val fg = if (isActive) tagActiveTextColor else accentColorValue
          val bg = if (isActive) tagActiveBackground else tagInactiveBackground
          builder.setSpan(
              ForegroundColorSpan(fg),
              start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
          if (bg != null) {
            builder.setSpan(
                BackgroundColorSpan(bg),
                start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
          }
          builder.setSpan(
              YifanSegmentSpan("tag", tag),
              start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        "link" -> {
          val href = seg["href"] as? String ?: ""
          builder.setSpan(
              ForegroundColorSpan(accentColorValue),
              start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
          builder.setSpan(
              UnderlineSpan(),
              start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
          builder.setSpan(
              YifanSegmentSpan("link", href),
              start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
      }
    }

    setTextColor(textColorValue)
    text = builder
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.action) {
      MotionEvent.ACTION_DOWN ->
          // Claim the touch only if it's on a segment. When we return
          // false here the parent ViewGroup (the card Pressable) gets
          // the DOWN instead and handles the tap normally.
          return findSegmentAt(event.x, event.y) != null
      MotionEvent.ACTION_UP -> {
        val hit = findSegmentAt(event.x, event.y)
        if (hit != null) dispatchSegmentEvent(hit)
        return true
      }
      MotionEvent.ACTION_CANCEL -> return true
    }
    return super.onTouchEvent(event)
  }

  private fun findSegmentAt(x: Float, y: Float): YifanSegmentSpan? {
    val spannable = text as? Spannable ?: return null
    val layout = layout ?: return null
    val adjX = x - totalPaddingLeft + scrollX
    val adjY = y - totalPaddingTop + scrollY
    val line = layout.getLineForVertical(adjY.toInt())
    val offset = layout.getOffsetForHorizontal(line, adjX)
    return spannable
        .getSpans(offset, offset, YifanSegmentSpan::class.java)
        .firstOrNull()
  }

  private fun dispatchSegmentEvent(hit: YifanSegmentSpan) {
    val payload = Arguments.createMap()
    when (hit.type) {
      "mention" -> {
        payload.putString("screenName", hit.payload)
        emit("topPressMention", payload)
      }
      "tag" -> {
        payload.putString("tag", hit.payload)
        emit("topPressTag", payload)
      }
      "link" -> {
        payload.putString("href", hit.payload)
        emit("topPressLink", payload)
      }
    }
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    reportContentSize(w, h)
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    super.onLayout(changed, l, t, r, b)
    reportContentSize(width, height)
  }

  private fun reportContentSize(w: Int, h: Int) {
    if (w <= 0) return
    if (w == lastReportedWidth && h == lastReportedHeight) return
    lastReportedWidth = w
    lastReportedHeight = h
    val density = resources.displayMetrics.density
    val map = Arguments.createMap().apply {
      putDouble("width", w / density.toDouble())
      putDouble("height", h / density.toDouble())
    }
    emit("topContentSizeChange", map)
  }

  private fun emit(eventName: String, data: WritableMap?) {
    val reactContext = context as? ReactContext ?: return
    val dispatcher = UIManagerHelper.getEventDispatcher(reactContext) ?: return
    val surfaceId = UIManagerHelper.getSurfaceId(this)
    dispatcher.dispatchEvent(
        YifanJustifiedTextEvent(surfaceId, id, eventName, data))
  }
}
