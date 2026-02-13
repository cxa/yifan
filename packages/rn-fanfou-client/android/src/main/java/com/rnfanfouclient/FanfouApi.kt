package com.rnfanfouclient

import com.github.scribejava.core.builder.api.DefaultApi10a
import com.github.scribejava.core.model.Verb

class FanfouApi : DefaultApi10a() {
  override fun getRequestTokenEndpoint(): String {
    return "http://fanfou.com/oauth/request_token"
  }

  override fun getAccessTokenEndpoint(): String {
    return "http://fanfou.com/oauth/access_token"
  }

  override fun getRequestTokenVerb(): Verb {
    return Verb.GET
  }

  override fun getAccessTokenVerb(): Verb {
    return Verb.GET
  }

  override fun getAuthorizationBaseUrl(): String {
    return "http://m.fanfou.com/oauth/authorize"
  }

  companion object {
    val instance = FanfouApi()
  }
}
