#import "FanfouSecrets.h"
#import <CommonCrypto/CommonHMAC.h>
#import <React/RCTBridgeModule.h>

@interface FanfouOAuthModule : NSObject <RCTBridgeModule>
@end

@implementation FanfouOAuthModule

RCT_EXPORT_MODULE();

static NSString *const kRequestTokenURL =
    @"http://fanfou.com/oauth/request_token";
static NSString *const kAccessTokenURL =
    @"http://fanfou.com/oauth/access_token";
static NSString *const kUploadPhotoURL =
    @"http://api.fanfou.com/photos/upload.json";
static NSString *const kUploadProfileImageURL =
    @"http://api.fanfou.com/account/update_profile_image.json";
static NSString *const kMultipartBoundary = @"DAN1324567890FAN";

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

static BOOL FFResolveConsumer(RCTPromiseRejectBlock rejecter, NSString **outKey,
                              NSString **outSecret) {
  NSString *resolvedKey = FanfouSecretsConsumerKey();
  NSString *resolvedSecret = FanfouSecretsConsumerSecret();
  if (resolvedKey.length == 0 || resolvedSecret.length == 0) {
    rejecter(
        @"oauth_consumer_missing",
        @"Missing consumer key or secret. Configure native secrets in the app.",
        nil);
    return NO;
  }
  if (outKey != NULL) {
    *outKey = resolvedKey;
  }
  if (outSecret != NULL) {
    *outSecret = resolvedSecret;
  }
  return YES;
}

static NSString *FFPercentEncode(NSString *value) {
  if (value == nil) {
    return @"";
  }
  static NSCharacterSet *allowed = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSMutableCharacterSet *set =
        [[NSCharacterSet alphanumericCharacterSet] mutableCopy];
    [set addCharactersInString:@"-._~"];
    allowed = [set copy];
  });
  return [value stringByAddingPercentEncodingWithAllowedCharacters:allowed];
}

static NSArray<NSArray<NSString *> *> *
FFNormalizePairs(NSArray<NSArray<NSString *> *> *pairs) {
  return [pairs sortedArrayUsingComparator:^NSComparisonResult(
                    NSArray<NSString *> *a, NSArray<NSString *> *b) {
    NSString *keyA = a[0];
    NSString *keyB = b[0];
    NSComparisonResult keyCompare = [keyA compare:keyB];
    if (keyCompare != NSOrderedSame) {
      return keyCompare;
    }
    NSString *valA = a[1];
    NSString *valB = b[1];
    return [valA compare:valB];
  }];
}

static NSString *
FFNormalizedParameterString(NSArray<NSArray<NSString *> *> *pairs) {
  NSMutableArray<NSString *> *parts =
      [NSMutableArray arrayWithCapacity:pairs.count];
  for (NSArray<NSString *> *pair in pairs) {
    NSString *key = FFPercentEncode(pair[0]);
    NSString *value = FFPercentEncode(pair[1]);
    [parts addObject:[NSString stringWithFormat:@"%@=%@", key, value]];
  }
  return [parts componentsJoinedByString:@"&"];
}

static NSString *FFBaseURLString(NSString *urlString) {
  NSURLComponents *components =
      [NSURLComponents componentsWithString:urlString];
  components.query = nil;
  components.fragment = nil;
  return components.string ?: urlString;
}

static NSArray<NSArray<NSString *> *> *
FFCollectPairs(NSDictionary<NSString *, NSString *> *params,
               NSDictionary<NSString *, NSString *> *oauthParams,
               NSString *urlString) {
  NSMutableArray<NSArray<NSString *> *> *pairs = [NSMutableArray array];

  NSURLComponents *components =
      [NSURLComponents componentsWithString:urlString];
  for (NSURLQueryItem *item in components.queryItems ?: @[]) {
    if (item.name.length == 0) {
      continue;
    }
    NSString *value = item.value ?: @"";
    [pairs addObject:@[ item.name, value ]];
  }

  [params enumerateKeysAndObjectsUsingBlock:^(NSString *key, NSString *obj,
                                              BOOL *stop) {
    if (key.length == 0) {
      return;
    }
    [pairs addObject:@[ key, obj ?: @"" ]];
  }];

  [oauthParams enumerateKeysAndObjectsUsingBlock:^(NSString *key, NSString *obj,
                                                   BOOL *stop) {
    if (key.length == 0) {
      return;
    }
    [pairs addObject:@[ key, obj ?: @"" ]];
  }];

  return FFNormalizePairs(pairs);
}

static NSString *FFSignature(NSString *method, NSString *urlString,
                             NSDictionary<NSString *, NSString *> *params,
                             NSDictionary<NSString *, NSString *> *oauthParams,
                             NSString *consumerSecret, NSString *tokenSecret) {
  NSString *baseURL = FFBaseURLString(urlString);
  NSArray<NSArray<NSString *> *> *pairs =
      FFCollectPairs(params, oauthParams, urlString);
  NSString *paramString = FFNormalizedParameterString(pairs);
  NSString *baseString = [NSString
      stringWithFormat:@"%@&%@&%@", FFPercentEncode([method uppercaseString]),
                       FFPercentEncode(baseURL), FFPercentEncode(paramString)];

  NSString *key =
      [NSString stringWithFormat:@"%@&%@", FFPercentEncode(consumerSecret),
                                 FFPercentEncode(tokenSecret ?: @"")];

  NSData *keyData = [key dataUsingEncoding:NSUTF8StringEncoding];
  NSData *baseData = [baseString dataUsingEncoding:NSUTF8StringEncoding];
  unsigned char digest[CC_SHA1_DIGEST_LENGTH];
  CCHmac(kCCHmacAlgSHA1, keyData.bytes, keyData.length, baseData.bytes,
         baseData.length, digest);
  NSData *hmacData = [NSData dataWithBytes:digest length:CC_SHA1_DIGEST_LENGTH];
  return [hmacData base64EncodedStringWithOptions:0];
}

static NSString *
FFAuthorizationHeader(NSDictionary<NSString *, NSString *> *oauthParams) {
  NSMutableArray<NSString *> *parts =
      [NSMutableArray arrayWithCapacity:oauthParams.count];
  NSArray<NSString *> *keys =
      [[oauthParams allKeys] sortedArrayUsingSelector:@selector(compare:)];
  for (NSString *key in keys) {
    NSString *value = oauthParams[key] ?: @"";
    NSString *encodedKey = FFPercentEncode(key);
    NSString *encodedValue = FFPercentEncode(value);
    [parts addObject:[NSString stringWithFormat:@"%@=\"%@\"", encodedKey,
                                                encodedValue]];
  }
  return [NSString
      stringWithFormat:@"OAuth %@", [parts componentsJoinedByString:@", "]];
}

static NSDictionary<NSString *, NSString *> *
FFParseFormEncoded(NSString *body) {
  if (body.length == 0) {
    return @{};
  }
  NSMutableDictionary<NSString *, NSString *> *result =
      [NSMutableDictionary dictionary];
  NSArray<NSString *> *pairs = [body componentsSeparatedByString:@"&"];
  for (NSString *pair in pairs) {
    NSArray<NSString *> *parts = [pair componentsSeparatedByString:@"="];
    if (parts.count != 2) {
      continue;
    }
    NSString *key = [parts[0] stringByRemovingPercentEncoding] ?: parts[0];
    NSString *value = [parts[1] stringByRemovingPercentEncoding] ?: parts[1];
    result[key] = value;
  }
  return result;
}

static NSString *
FFQueryStringFromParams(NSDictionary<NSString *, NSString *> *params) {
  NSMutableArray<NSString *> *pairs =
      [NSMutableArray arrayWithCapacity:params.count];
  NSArray<NSString *> *keys =
      [[params allKeys] sortedArrayUsingSelector:@selector(compare:)];
  for (NSString *key in keys) {
    NSString *value = params[key] ?: @"";
    [pairs addObject:[NSString stringWithFormat:@"%@=%@", FFPercentEncode(key),
                                                FFPercentEncode(value)]];
  }
  return [pairs componentsJoinedByString:@"&"];
}

static NSString *FFNonce(void) { return [[NSUUID UUID] UUIDString]; }

static NSString *FFTimestamp(void) {
  return [NSString stringWithFormat:@"%lld", (long long)floor([[NSDate date]
                                                 timeIntervalSince1970])];
}

static NSData *FFMultipartBodyData(NSDictionary<NSString *, NSString *> *params,
                                   NSData *imageData, NSString *boundary,
                                   NSString *fileFieldName,
                                   NSString *fileName) {
  NSMutableData *body = [NSMutableData data];
  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary]
                       dataUsingEncoding:NSUTF8StringEncoding]];
  [params enumerateKeysAndObjectsUsingBlock:^(NSString *key, NSString *obj,
                                              BOOL *stop) {
    NSString *part = [NSString
        stringWithFormat:
            @"\r\n--%@\r\nContent-Disposition:form-data; name=\"%@\"\r\n\r\n%@",
            boundary, key, obj];
    [body appendData:[part dataUsingEncoding:NSUTF8StringEncoding]];
  }];

  NSString *header = [NSString
      stringWithFormat:
          @"\r\n--%@\r\nContent-Disposition: form-data; name=\"%@\"; "
          @"filename=\"image.jpg\"\r\nContent-Length: %zu\r\nContent-Type: "
          @"image/jpeg\r\n\r\n",
          boundary, fileFieldName, imageData.length];
  if (fileName.length > 0) {
    header = [NSString
        stringWithFormat:
            @"\r\n--%@\r\nContent-Disposition: form-data; name=\"%@\"; "
            @"filename=\"%@\"\r\nContent-Length: %zu\r\nContent-Type: "
            @"image/jpeg\r\n\r\n",
            boundary, fileFieldName, fileName, imageData.length];
  }
  [body appendData:[header dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:imageData];
  [body appendData:[[NSString stringWithFormat:@"\r\n--%@--\r\n", boundary]
                       dataUsingEncoding:NSUTF8StringEncoding]];
  return body;
}

- (void)performRequest:(NSString *)method
                   url:(NSString *)urlString
                params:(NSDictionary<NSString *, NSString *> *)params
           oauthParams:
               (NSMutableDictionary<NSString *, NSString *> *)oauthParams
        consumerSecret:(NSString *)consumerSecret
           tokenSecret:(NSString *)tokenSecret
              resolver:(RCTPromiseResolveBlock)resolver
              rejecter:(RCTPromiseRejectBlock)rejecter {
  NSString *signature = FFSignature(method, urlString, params, oauthParams,
                                    consumerSecret, tokenSecret);
  oauthParams[@"oauth_signature"] = signature;

  NSMutableURLRequest *request;
  NSString *upperMethod = [method uppercaseString];
  if ([upperMethod isEqualToString:@"POST"]) {
    NSURL *url = [NSURL URLWithString:urlString];
    request = [NSMutableURLRequest requestWithURL:url];
    request.HTTPMethod = @"POST";
    if (params.count > 0) {
      NSString *body = FFQueryStringFromParams(params);
      request.HTTPBody = [body dataUsingEncoding:NSUTF8StringEncoding];
      [request setValue:@"application/x-www-form-urlencoded"
          forHTTPHeaderField:@"Content-Type"];
    }
  } else {
    NSURLComponents *components =
        [NSURLComponents componentsWithString:urlString];
    NSMutableArray<NSURLQueryItem *> *items =
        [NSMutableArray arrayWithArray:components.queryItems ?: @[]];
    [params enumerateKeysAndObjectsUsingBlock:^(NSString *key, NSString *obj,
                                                BOOL *stop) {
      if (key.length == 0) {
        return;
      }
      [items addObject:[NSURLQueryItem queryItemWithName:key value:obj]];
    }];
    components.queryItems = items.count > 0 ? items : nil;
    NSURL *url = components.URL;
    request = [NSMutableURLRequest requestWithURL:url];
    request.HTTPMethod = @"GET";
  }

  NSString *authHeader = FFAuthorizationHeader(oauthParams);
  [request setValue:authHeader forHTTPHeaderField:@"Authorization"];

  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response,
                            NSError *error) {
          if (error) {
            rejecter(@"oauth_request_failed", error.localizedDescription,
                     error);
            return;
          }
          NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
          NSString *body =
              data != nil ? [[NSString alloc] initWithData:data
                                                  encoding:NSUTF8StringEncoding]
                          : @"";
          if (httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
            NSDictionary *info = @{
              @"status" : @(httpResponse.statusCode),
              @"body" : body ?: @""
            };
            NSString *message = [NSString
                stringWithFormat:@"HTTP error %ld: %@",
                                 (long)httpResponse.statusCode, body ?: @""];
            NSError *statusError =
                [NSError errorWithDomain:@"FanfouOAuth"
                                    code:httpResponse.statusCode
                                userInfo:info];
            rejecter(@"oauth_http_error", message, statusError);
            return;
          }
          resolver(
              @{@"status" : @(httpResponse.statusCode),
                @"body" : body ?: @""});
        }];
  [task resume];
}

RCT_EXPORT_METHOD(getRequestToken : (NSString *)
                      callbackUrl resolver : (RCTPromiseResolveBlock)
                          resolver rejecter : (RCTPromiseRejectBlock)rejecter) {
  NSString *resolvedKey = nil;
  NSString *resolvedSecret = nil;
  if (!FFResolveConsumer(rejecter, &resolvedKey, &resolvedSecret)) {
    return;
  }
  NSMutableDictionary<NSString *, NSString *> *oauthParams = [@{
    @"oauth_consumer_key" : resolvedKey,
    @"oauth_nonce" : FFNonce(),
    @"oauth_signature_method" : @"HMAC-SHA1",
    @"oauth_timestamp" : FFTimestamp(),
    @"oauth_version" : @"1.0"
  } mutableCopy];

  [self performRequest:@"GET"
      url:kRequestTokenURL
      params:@{}
      oauthParams:oauthParams
      consumerSecret:resolvedSecret
      tokenSecret:nil
      resolver:^(id result) {
        NSString *body = [result objectForKey:@"body"];
        NSDictionary *data = FFParseFormEncoded(body);
        NSString *token = data[@"oauth_token"];
        NSString *secret = data[@"oauth_token_secret"];
        if (token.length == 0 || secret.length == 0) {
          rejecter(@"oauth_request_token_invalid",
                   @"Invalid request token response", nil);
          return;
        }
        resolver(@{@"oauthToken" : token, @"oauthTokenSecret" : secret});
      }
      rejecter:rejecter];
}

RCT_EXPORT_METHOD(
    getAccessToken : (NSString *)requestToken requestTokenSecret : (NSString *)
        requestTokenSecret resolver : (RCTPromiseResolveBlock)
            resolver rejecter : (RCTPromiseRejectBlock)rejecter) {
  NSString *resolvedKey = nil;
  NSString *resolvedSecret = nil;
  if (!FFResolveConsumer(rejecter, &resolvedKey, &resolvedSecret)) {
    return;
  }
  NSMutableDictionary<NSString *, NSString *> *oauthParams = [@{
    @"oauth_consumer_key" : resolvedKey,
    @"oauth_token" : requestToken,
    @"oauth_nonce" : FFNonce(),
    @"oauth_signature_method" : @"HMAC-SHA1",
    @"oauth_timestamp" : FFTimestamp(),
    @"oauth_version" : @"1.0"
  } mutableCopy];

  [self performRequest:@"GET"
      url:kAccessTokenURL
      params:@{}
      oauthParams:oauthParams
      consumerSecret:resolvedSecret
      tokenSecret:requestTokenSecret
      resolver:^(id result) {
        NSString *body = [result objectForKey:@"body"];
        NSDictionary *data = FFParseFormEncoded(body);
        NSString *token = data[@"oauth_token"];
        NSString *secret = data[@"oauth_token_secret"];
        NSString *userId = data[@"user_id"];
        if (userId.length == 0) {
          userId = data[@"id"];
        }
        NSString *screenName = data[@"screen_name"];
        if (screenName.length == 0) {
          screenName = data[@"name"];
        }
        if (token.length == 0 || secret.length == 0) {
          rejecter(@"oauth_access_token_invalid",
                   @"Invalid access token response", nil);
          return;
        }
        NSMutableDictionary *accessToken =
            [@{@"oauthToken" : token, @"oauthTokenSecret" : secret}
                mutableCopy];
        if (userId.length > 0) {
          accessToken[@"userId"] = userId;
        }
        if (screenName.length > 0) {
          accessToken[@"screenName"] = screenName;
        }
        resolver(accessToken);
      }
      rejecter:rejecter];
}

RCT_EXPORT_METHOD(
    request : (NSString *)token tokenSecret : (NSString *)tokenSecret method : (
        NSString *)method url : (NSString *)url params : (NSDictionary *)
        params resolver : (RCTPromiseResolveBlock)
            resolver rejecter : (RCTPromiseRejectBlock)rejecter) {
  NSString *resolvedKey = nil;
  NSString *resolvedSecret = nil;
  if (!FFResolveConsumer(rejecter, &resolvedKey, &resolvedSecret)) {
    return;
  }
  NSMutableDictionary<NSString *, NSString *> *oauthParams = [@{
    @"oauth_consumer_key" : resolvedKey,
    @"oauth_token" : token,
    @"oauth_nonce" : FFNonce(),
    @"oauth_signature_method" : @"HMAC-SHA1",
    @"oauth_timestamp" : FFTimestamp(),
    @"oauth_version" : @"1.0"
  } mutableCopy];

  NSMutableDictionary<NSString *, NSString *> *stringParams =
      [NSMutableDictionary dictionary];
  if ([params isKindOfClass:[NSDictionary class]]) {
    [params enumerateKeysAndObjectsUsingBlock:^(id key, id obj, BOOL *stop) {
      if (![key isKindOfClass:[NSString class]]) {
        return;
      }
      NSString *value = obj != nil ? [obj description] : @"";
      stringParams[key] = value;
    }];
  }

  [self performRequest:method
                   url:url
                params:stringParams
           oauthParams:oauthParams
        consumerSecret:resolvedSecret
           tokenSecret:tokenSecret
              resolver:resolver
              rejecter:rejecter];
}

RCT_EXPORT_METHOD(
    uploadPhoto : (NSString *)token tokenSecret : (NSString *)
        tokenSecret photoBase64 : (NSString *)photoBase64 status : (NSString *)
            status params : (NSDictionary *)
                params resolver : (RCTPromiseResolveBlock)
                    resolver rejecter : (RCTPromiseRejectBlock)rejecter) {
  NSString *resolvedKey = nil;
  NSString *resolvedSecret = nil;
  if (!FFResolveConsumer(rejecter, &resolvedKey, &resolvedSecret)) {
    return;
  }
  NSData *imageData = [[NSData alloc] initWithBase64EncodedString:photoBase64
                                                          options:0];
  if (imageData.length == 0) {
    rejecter(@"photo_invalid", @"Invalid photo data", nil);
    return;
  }

  NSMutableDictionary<NSString *, NSString *> *stringParams =
      [NSMutableDictionary dictionary];
  if (status.length > 0) {
    stringParams[@"status"] = status;
  }
  if ([params isKindOfClass:[NSDictionary class]]) {
    [params enumerateKeysAndObjectsUsingBlock:^(id key, id obj, BOOL *stop) {
      if (![key isKindOfClass:[NSString class]]) {
        return;
      }
      NSString *value = obj != nil ? [obj description] : @"";
      stringParams[key] = value;
    }];
  }

  NSMutableDictionary<NSString *, NSString *> *oauthParams = [@{
    @"oauth_consumer_key" : resolvedKey,
    @"oauth_token" : token,
    @"oauth_nonce" : FFNonce(),
    @"oauth_signature_method" : @"HMAC-SHA1",
    @"oauth_timestamp" : FFTimestamp(),
    @"oauth_version" : @"1.0"
  } mutableCopy];

  NSString *signature = FFSignature(@"POST", kUploadPhotoURL, @{}, oauthParams,
                                    resolvedSecret, tokenSecret);
  oauthParams[@"oauth_signature"] = signature;

  NSMutableURLRequest *request = [NSMutableURLRequest
      requestWithURL:[NSURL URLWithString:kUploadPhotoURL]];
  request.HTTPMethod = @"POST";
  [request setValue:[NSString
                        stringWithFormat:@"multipart/form-data; boundary=%@",
                                         kMultipartBoundary]
      forHTTPHeaderField:@"Content-Type"];
  [request setValue:FFAuthorizationHeader(oauthParams)
      forHTTPHeaderField:@"Authorization"];
  request.HTTPBody = FFMultipartBodyData(
      stringParams, imageData, kMultipartBoundary, @"photo", @"image.jpg");

  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response,
                            NSError *error) {
          if (error) {
            rejecter(@"photo_upload_failed", error.localizedDescription, error);
            return;
          }
          NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
          NSString *body =
              data != nil ? [[NSString alloc] initWithData:data
                                                  encoding:NSUTF8StringEncoding]
                          : @"";
          resolver(
              @{@"status" : @(httpResponse.statusCode),
                @"body" : body ?: @""});
        }];
  [task resume];
}

RCT_EXPORT_METHOD(
    uploadProfileImage : (NSString *)token tokenSecret : (NSString *)
        tokenSecret imageBase64 : (NSString *)imageBase64 params : (
            NSDictionary *)params resolver : (RCTPromiseResolveBlock)
            resolver rejecter : (RCTPromiseRejectBlock)rejecter) {
  NSString *resolvedKey = nil;
  NSString *resolvedSecret = nil;
  if (!FFResolveConsumer(rejecter, &resolvedKey, &resolvedSecret)) {
    return;
  }
  NSData *imageData = [[NSData alloc] initWithBase64EncodedString:imageBase64
                                                          options:0];
  if (imageData.length == 0) {
    rejecter(@"profile_image_invalid", @"Invalid image data", nil);
    return;
  }

  NSMutableDictionary<NSString *, NSString *> *stringParams =
      [NSMutableDictionary dictionary];
  if ([params isKindOfClass:[NSDictionary class]]) {
    [params enumerateKeysAndObjectsUsingBlock:^(id key, id obj, BOOL *stop) {
      if (![key isKindOfClass:[NSString class]]) {
        return;
      }
      NSString *value = obj != nil ? [obj description] : @"";
      stringParams[key] = value;
    }];
  }

  NSMutableDictionary<NSString *, NSString *> *oauthParams = [@{
    @"oauth_consumer_key" : resolvedKey,
    @"oauth_token" : token,
    @"oauth_nonce" : FFNonce(),
    @"oauth_signature_method" : @"HMAC-SHA1",
    @"oauth_timestamp" : FFTimestamp(),
    @"oauth_version" : @"1.0"
  } mutableCopy];

  NSString *signature = FFSignature(@"POST", kUploadProfileImageURL, @{},
                                    oauthParams, resolvedSecret, tokenSecret);
  oauthParams[@"oauth_signature"] = signature;

  NSMutableURLRequest *request = [NSMutableURLRequest
      requestWithURL:[NSURL URLWithString:kUploadProfileImageURL]];
  request.HTTPMethod = @"POST";
  [request setValue:[NSString
                        stringWithFormat:@"multipart/form-data; boundary=%@",
                                         kMultipartBoundary]
      forHTTPHeaderField:@"Content-Type"];
  [request setValue:FFAuthorizationHeader(oauthParams)
      forHTTPHeaderField:@"Authorization"];
  request.HTTPBody = FFMultipartBodyData(
      stringParams, imageData, kMultipartBoundary, @"image", @"avatar.jpg");

  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response,
                            NSError *error) {
          if (error) {
            rejecter(@"profile_image_upload_failed", error.localizedDescription,
                     error);
            return;
          }
          NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
          NSString *body =
              data != nil ? [[NSString alloc] initWithData:data
                                                  encoding:NSUTF8StringEncoding]
                          : @"";
          resolver(
              @{@"status" : @(httpResponse.statusCode),
                @"body" : body ?: @""});
        }];
  [task resume];
}

@end
