package com.rnfanfouclient

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.github.scribejava.core.builder.ServiceBuilder
import com.github.scribejava.core.model.OAuth1AccessToken
import com.github.scribejava.core.model.OAuth1RequestToken
import com.github.scribejava.core.model.OAuthRequest
import com.github.scribejava.core.model.Verb
import com.github.scribejava.core.oauth.OAuth10aService
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import com.github.scribejava.core.model.Response as OAuthResponse
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.net.URLDecoder
import java.nio.charset.Charset
import kotlin.math.max
import kotlin.math.sqrt

class FanfouOAuthModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    // Mirrors ios/yifan/LivePhotoModule.m's photo-upload rule:
    //   - cap encoded file at 2MB
    //   - initial long-edge 1920px, JPEG quality 0.85
    //   - if still too big, scale by sqrt(targetSize / actualSize) * 0.9
    //     and retry a few times, never below 320px
    private const val MAX_PHOTO_BYTES = 2 * 1024 * 1024
    private const val MAX_STILL_DIMENSION = 1920
    private const val MIN_STILL_DIMENSION = 320
    private const val JPEG_QUALITY = 85
    private const val MAX_COMPRESSION_ATTEMPTS = 3
  }
  override fun getName(): String = "FanfouOAuthModule"

  private val uploadPhotoUrl = "http://api.fanfou.com/photos/upload.json"
  private val uploadProfileImageUrl = "http://api.fanfou.com/account/update_profile_image.json"
  private val multipartBoundary = "DAN1324567890FAN"

  private fun resolveConsumer(
    promise: Promise,
  ): Pair<String, String>? {
    val resolvedKey = FanfouSecrets.resolveConsumerKey()
    val resolvedSecret = FanfouSecrets.resolveConsumerSecret()
    if (resolvedKey.isBlank() || resolvedSecret.isBlank()) {
      promise.reject(
        "oauth_consumer_missing",
        "Missing consumer key or secret. Configure native secrets in the app.",
      )
      return null
    }
    return resolvedKey to resolvedSecret
  }

  private fun buildService(
    consumerKey: String,
    consumerSecret: String,
    callbackUrl: String?,
  ): OAuth10aService {
    val builder = ServiceBuilder(consumerKey)
      .apiSecret(consumerSecret)
    if (!callbackUrl.isNullOrBlank()) {
      builder.callback(callbackUrl)
    }
    return builder.build(FanfouApi.instance)
  }

  private fun parseFormEncoded(body: String?): Map<String, String> {
    if (body.isNullOrEmpty()) {
      return emptyMap()
    }
    val result = mutableMapOf<String, String>()
    body.split("&").forEach { pair ->
      val parts = pair.split("=", limit = 2)
      if (parts.size == 2) {
        val key = URLDecoder.decode(parts[0], "UTF-8")
        val value = URLDecoder.decode(parts[1], "UTF-8")
        result[key] = value
      }
    }
    return result
  }

  @ReactMethod
  fun getRequestToken(
    callbackUrl: String,
    promise: Promise,
  ) {
    Thread {
      try {
        val resolved = resolveConsumer(promise) ?: return@Thread
        val service = buildService(resolved.first, resolved.second, null)
        val requestToken = service.requestToken
        val result = Arguments.createMap().apply {
          putString("oauthToken", requestToken.token)
          putString("oauthTokenSecret", requestToken.tokenSecret)
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("oauth_request_token_failed", e)
      }
    }.start()
  }

  @ReactMethod
  fun getAccessToken(
    requestToken: String,
    requestTokenSecret: String,
    promise: Promise,
  ) {
    Thread {
      try {
        val resolved = resolveConsumer(promise) ?: return@Thread
        val service = buildService(resolved.first, resolved.second, null)
        val request = OAuthRequest(Verb.GET, service.api.accessTokenEndpoint)
        val requestTokenObj = OAuth1AccessToken(requestToken, requestTokenSecret)
        service.signRequest(requestTokenObj, request)
        val response = service.execute(request)
        if (response.code < 200 || response.code >= 300) {
          promise.reject(
            "oauth_access_token_failed",
            "HTTP ${response.code}: ${response.body}",
          )
          return@Thread
        }
        val parsed = parseFormEncoded(response.body)
        val token = parsed["oauth_token"]
        val secret = parsed["oauth_token_secret"]
        val userId = parsed["user_id"] ?: parsed["id"]
        val screenName = parsed["screen_name"] ?: parsed["name"]
        if (token.isNullOrBlank() || secret.isNullOrBlank()) {
          promise.reject("oauth_access_token_invalid", "Invalid access token response")
          return@Thread
        }
        val result = Arguments.createMap().apply {
          putString("oauthToken", token)
          putString("oauthTokenSecret", secret)
          if (!userId.isNullOrBlank()) {
            putString("userId", userId)
          }
          if (!screenName.isNullOrBlank()) {
            putString("screenName", screenName)
          }
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("oauth_access_token_failed", e)
      }
    }.start()
  }

  @ReactMethod
  fun request(
    token: String,
    tokenSecret: String,
    method: String,
    url: String,
    params: ReadableMap,
    promise: Promise,
  ) {
    Thread {
      try {
        val resolved = resolveConsumer(promise) ?: return@Thread
        val service = buildService(resolved.first, resolved.second, "oob")
        val accessToken = OAuth1AccessToken(token, tokenSecret)
        val verb = if (method.equals("POST", ignoreCase = true)) Verb.POST else Verb.GET
        val request = OAuthRequest(verb, url)
        val paramMap = params.toHashMap()
        paramMap.forEach { (key, value) ->
          val strValue = value?.toString() ?: return@forEach
          if (verb == Verb.GET) {
            request.addQuerystringParameter(key, strValue)
          } else {
            request.addBodyParameter(key, strValue)
          }
        }
        service.signRequest(accessToken, request)
        val response = service.execute(request)
        val result = Arguments.createMap().apply {
          putInt("status", response.code)
          putString("body", response.body)
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("oauth_request_failed", e)
      }
    }.start()
  }

  @ReactMethod
  fun uploadPhoto(
    token: String,
    tokenSecret: String,
    photoBase64: String,
    status: String?,
    mimeType: String,
    fileName: String,
    params: ReadableMap,
    promise: Promise,
  ) {
    Thread {
      try {
        val imageBytes = try {
          Base64.decode(photoBase64, Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
          promise.reject("photo_invalid", "Invalid photo data")
          return@Thread
        }
        val prepared = compressForUpload(imageBytes, mimeType, fileName)
        sendPhotoMultipart(
          token = token,
          tokenSecret = tokenSecret,
          imageBytes = prepared.bytes,
          status = status,
          mimeType = prepared.mimeType,
          fileName = prepared.fileName,
          params = params,
          promise = promise,
        )
      } catch (e: Exception) {
        promise.reject("photo_upload_failed", e)
      }
    }.start()
  }

  @ReactMethod
  fun uploadPhotoFromUri(
    token: String,
    tokenSecret: String,
    photoUri: String,
    status: String?,
    mimeType: String,
    fileName: String,
    params: ReadableMap,
    promise: Promise,
  ) {
    Thread {
      try {
        val imageBytes = try {
          readBytesFromUri(photoUri)
        } catch (e: Exception) {
          promise.reject("photo_invalid", "Unable to read photo from URI: $photoUri", e)
          return@Thread
        }
        if (imageBytes.isEmpty()) {
          promise.reject("photo_invalid", "Empty photo at URI: $photoUri")
          return@Thread
        }
        val prepared = compressForUpload(imageBytes, mimeType, fileName)
        sendPhotoMultipart(
          token = token,
          tokenSecret = tokenSecret,
          imageBytes = prepared.bytes,
          status = status,
          mimeType = prepared.mimeType,
          fileName = prepared.fileName,
          params = params,
          promise = promise,
        )
      } catch (e: Exception) {
        promise.reject("photo_upload_failed", e)
      }
    }.start()
  }

  private data class PreparedPhoto(
    val bytes: ByteArray,
    val mimeType: String,
    val fileName: String,
  )

  /**
   * Ports the iOS [YFUploadableImageResult] rule to Android: clamp still
   * photos to [MAX_STILL_DIMENSION] / [JPEG_QUALITY] JPEG, and if the
   * resulting file is still over [MAX_PHOTO_BYTES] re-run with a dimension
   * scaled by `sqrt(MAX / current) * 0.9` up to [MAX_COMPRESSION_ATTEMPTS]
   * times. GIFs bypass compression so animation survives.
   */
  private fun compressForUpload(
    rawBytes: ByteArray,
    mimeType: String,
    fileName: String,
  ): PreparedPhoto {
    val normalizedMime = mimeType.lowercase()
    if (normalizedMime == "image/gif") {
      return PreparedPhoto(rawBytes, mimeType, fileName)
    }

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size, bounds)
    val sourceW = bounds.outWidth
    val sourceH = bounds.outHeight
    if (sourceW <= 0 || sourceH <= 0) {
      // Unreadable image data; let the server reject it with its own error.
      return PreparedPhoto(rawBytes, mimeType, fileName)
    }

    // Pass-through for small-enough JPEGs that already fit the cap.
    val sourceLongest = max(sourceW, sourceH)
    val alreadyFits =
      rawBytes.size <= MAX_PHOTO_BYTES &&
        sourceLongest <= MAX_STILL_DIMENSION &&
        normalizedMime == "image/jpeg"
    if (alreadyFits) {
      return PreparedPhoto(rawBytes, mimeType, fileName)
    }

    val orientation = readExifOrientation(rawBytes)
    var maxDim = MAX_STILL_DIMENSION
    var lastJpeg: ByteArray? = null
    for (attempt in 0 until MAX_COMPRESSION_ATTEMPTS) {
      val targetLongest = maxDim
      val scale =
        if (sourceLongest > targetLongest) targetLongest.toFloat() / sourceLongest else 1f
      val targetW = max(1, (sourceW * scale).toInt())
      val targetH = max(1, (sourceH * scale).toInt())

      val sample = computeInSampleSize(sourceW, sourceH, targetW, targetH)
      val decodeOpts = BitmapFactory.Options().apply {
        inSampleSize = sample
        inPreferredConfig = Bitmap.Config.ARGB_8888
      }
      val decoded =
        BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size, decodeOpts)
          ?: return PreparedPhoto(rawBytes, mimeType, fileName)

      val rotated = applyExifRotation(decoded, orientation)
      val finalBitmap = if (rotated.width != targetW || rotated.height != targetH) {
        val scaled = Bitmap.createScaledBitmap(rotated, targetW, targetH, true)
        if (rotated !== decoded) rotated.recycle()
        if (scaled !== decoded) decoded.recycle()
        scaled
      } else {
        if (rotated !== decoded) decoded.recycle()
        rotated
      }

      val out = ByteArrayOutputStream()
      finalBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
      finalBitmap.recycle()
      val bytes = out.toByteArray()
      lastJpeg = bytes
      if (bytes.size <= MAX_PHOTO_BYTES) break

      val ratio = sqrt(MAX_PHOTO_BYTES.toDouble() / bytes.size.toDouble()) * 0.9
      val next = max((maxDim * ratio).toInt(), MIN_STILL_DIMENSION)
      if (next >= maxDim) break
      maxDim = next
    }

    val finalBytes = lastJpeg ?: return PreparedPhoto(rawBytes, mimeType, fileName)
    val finalName = replaceExtension(fileName, "jpg")
    return PreparedPhoto(finalBytes, "image/jpeg", finalName)
  }

  private fun readExifOrientation(bytes: ByteArray): Int =
    try {
      ByteArrayInputStream(bytes).use { stream ->
        ExifInterface(stream).getAttributeInt(
          ExifInterface.TAG_ORIENTATION,
          ExifInterface.ORIENTATION_NORMAL,
        )
      }
    } catch (_: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }

  private fun applyExifRotation(bitmap: Bitmap, orientation: Int): Bitmap {
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
      else -> return bitmap
    }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  private fun computeInSampleSize(srcW: Int, srcH: Int, targetW: Int, targetH: Int): Int {
    var sample = 1
    while (srcW / (sample * 2) >= targetW && srcH / (sample * 2) >= targetH) {
      sample *= 2
    }
    return sample
  }

  private fun replaceExtension(fileName: String, newExt: String): String {
    if (fileName.isBlank()) return "image.$newExt"
    val dot = fileName.lastIndexOf('.')
    val base = if (dot > 0) fileName.substring(0, dot) else fileName
    return "$base.$newExt"
  }

  private fun readBytesFromUri(photoUri: String): ByteArray {
    val uri = Uri.parse(photoUri)
    val stream: InputStream? = when (uri.scheme) {
      null, "file" -> {
        val path = uri.path ?: throw IllegalArgumentException("Missing path in URI")
        File(path).inputStream()
      }
      "content" -> reactContext.contentResolver.openInputStream(uri)
      else -> throw IllegalArgumentException("Unsupported URI scheme: ${uri.scheme}")
    }
    return stream?.use { it.readBytes() }
      ?: throw java.io.IOException("Cannot open URI: $photoUri")
  }

  private fun sendPhotoMultipart(
    token: String,
    tokenSecret: String,
    imageBytes: ByteArray,
    status: String?,
    mimeType: String,
    fileName: String,
    params: ReadableMap,
    promise: Promise,
  ) {
    val resolved = resolveConsumer(promise) ?: return

    val extraParams = mutableMapOf<String, String>()
    if (!status.isNullOrBlank()) {
      extraParams["status"] = status
    }
    params.toHashMap().forEach { (key, value) ->
      if (key.isNotBlank()) {
        extraParams[key] = value?.toString() ?: ""
      }
    }

    val resolvedMimeType = mimeType.ifBlank { "image/jpeg" }
    val resolvedFileName = fileName.ifBlank { "image.jpg" }
    val body = ByteArrayOutputStream()
    extraParams.forEach { (key, value) ->
      val part =
        "--$multipartBoundary\r\nContent-Disposition: form-data; name=\"$key\"\r\n\r\n$value\r\n"
      body.write(part.toByteArray(Charset.forName("UTF-8")))
    }
    val header =
      "--$multipartBoundary\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"$resolvedFileName\"\r\nContent-Length: ${imageBytes.size}\r\nContent-Type: $resolvedMimeType\r\n\r\n"
    body.write(header.toByteArray(Charset.forName("UTF-8")))
    body.write(imageBytes)
    body.write(("\r\n--$multipartBoundary--\r\n").toByteArray(Charset.forName("UTF-8")))

    val service = buildService(resolved.first, resolved.second, null)
    val accessToken = OAuth1AccessToken(token, tokenSecret)
    val request = OAuthRequest(Verb.POST, uploadPhotoUrl)
    request.addHeader(
      "Content-Type",
      "multipart/form-data; boundary=$multipartBoundary",
    )
    request.setPayload(body.toByteArray())
    service.signRequest(accessToken, request)
    val response: OAuthResponse = service.execute(request)
    val result = Arguments.createMap().apply {
      putInt("status", response.code)
      putString("body", response.body)
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun uploadProfileImage(
    token: String,
    tokenSecret: String,
    imageBase64: String,
    params: ReadableMap,
    promise: Promise,
  ) {
    Thread {
      try {
        val resolved = resolveConsumer(promise) ?: return@Thread
        val imageBytes = try {
          Base64.decode(imageBase64, Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
          promise.reject("profile_image_invalid", "Invalid image data")
          return@Thread
        }

        val extraParams = mutableMapOf<String, String>()
        params.toHashMap().forEach { (key, value) ->
          if (key.isNotBlank()) {
            extraParams[key] = value?.toString() ?: ""
          }
        }

        val body = ByteArrayOutputStream()
        extraParams.forEach { (key, value) ->
          val part =
            "--$multipartBoundary\r\nContent-Disposition: form-data; name=\"$key\"\r\n\r\n$value\r\n"
          body.write(part.toByteArray(Charset.forName("UTF-8")))
        }
        val header =
          "--$multipartBoundary\r\nContent-Disposition: form-data; name=\"image\"; filename=\"avatar.jpg\"\r\nContent-Length: ${imageBytes.size}\r\nContent-Type: image/jpeg\r\n\r\n"
        body.write(header.toByteArray(Charset.forName("UTF-8")))
        body.write(imageBytes)
        body.write(("\r\n--$multipartBoundary--\r\n").toByteArray(Charset.forName("UTF-8")))

        val service = buildService(resolved.first, resolved.second, null)
        val accessToken = OAuth1AccessToken(token, tokenSecret)
        val request = OAuthRequest(Verb.POST, uploadProfileImageUrl)
        request.addHeader(
          "Content-Type",
          "multipart/form-data; boundary=$multipartBoundary",
        )
        request.setPayload(body.toByteArray())
        service.signRequest(accessToken, request)
        val response = service.execute(request)
        val result = Arguments.createMap().apply {
          putInt("status", response.code)
          putString("body", response.body)
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("profile_image_upload_failed", e)
      }
    }.start()
  }
}
