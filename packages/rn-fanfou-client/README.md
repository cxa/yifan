# rn-fanfou-client

A tiny React Native client for the Fanfou API with native OAuth 1.0 signing.

## What It Does

- Handles the OAuth flow with a `getAccessToken` helper.
- Provides signed `get`, `post`, and `uploadPhoto` helpers.
- Throws `FanfouApiError` for non-2xx API responses.

## Installation

Install the package:

```sh
npm install rn-fanfou-client
```

Or with yarn:

```sh
yarn add rn-fanfou-client
```

Or with pnpm:

```sh
pnpm add rn-fanfou-client
```

Install iOS pods after adding the dependency:

```sh
cd ios
bundle exec pod install
```

## Native Secret Configuration

This package does not read consumer keys from JS. Configure them in native code
and keep them out of the JS bundle.

### Android

Call the native configurator at app startup:

```kt
import com.rnfanfouclient.FanfouSecrets

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    FanfouSecrets.configure(
      /* consumerKey */ "...",
      /* consumerSecret */ "...",
    )
  }
}
```

### iOS

Configure once at startup (e.g., a small loader file in your app target):

```objc
#import <rn-fanfou-client/FanfouSecrets.h>

__attribute__((constructor)) static void FFConfigureFanfouSecrets(void) {
  FanfouSecretsConfigure(@"...", @"...");
}
```

If the secrets are missing, native calls will reject with
`oauth_consumer_missing`.

### Where to Store Secrets

Keep the consumer key/secret in native-only storage and pass them into
`FanfouSecrets.configure`/`FanfouSecretsConfigure`. Avoid exposing them to JS or
bundled assets. This is still not fully safe—client apps can be reverse
engineered—so use caution. Obfuscation should be treated as a last resort, not a
security boundary.

## Usage

```ts
import { FanfouClient, getAccessToken } from 'rn-fanfou-client';

const CALLBACK_URL = 'yifan://authorize_callback';

// One call: opens authorize URL, waits for callback, exchanges access token.
const accessToken = await getAccessToken({
  callbackUrl: CALLBACK_URL,
});

const client = new FanfouClient(accessToken);

// Signed API calls.
const me = await client.get('/account/verify_credentials');
const timeline = await client.get('/statuses/home_timeline');
const status = await client.post('/statuses/update', { status: 'hi' });

// Photo upload.
const photo = await client.uploadPhoto({
  photoBase64: '<base64>',
  status: 'photo',
});
```

## Notes

- React Native autolinking should pick up the native module. If it does not, run `cd ios && pod install` and rebuild the app.
- OAuth is handled by the native module `FanfouOAuthModule`, so you must run native builds.
- The OAuth callback URL must match the app’s deep link configuration.
