# rn-fanfou-client

A tiny React Native client for the Fanfou API with native OAuth 1.0 signing.

## What It Does

- Handles the OAuth flow in a single `getAccessToken` call.
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

## Usage

```ts
import { FanfouClient } from 'rn-fanfou-client';

const CALLBACK_URL = 'gohan://authorize_callback';

const client = new FanfouClient(
  process.env.FANFOU_CONSUMER_KEY!,
  process.env.FANFOU_CONSUMER_SECRET!,
);

// One call: opens authorize URL, waits for callback, exchanges tokens.
const tokens = await client.getAccessToken(CALLBACK_URL);

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
