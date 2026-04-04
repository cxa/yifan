# 一饭

A React Native client for [Fanfou](https://fanfou.com), the Chinese microblogging platform.

## Requirements

- Node >= 22.11.0
- React Native development environment — see [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment)

## Getting Started

### Configure credentials

The app uses Fanfou's OAuth 1.0a API. You need a consumer key and secret from [Fanfou's developer platform](https://fanfou.com/apps).

Create a `.env` file in the repo root:

```sh
FANFOU_CONSUMER_KEY=your_consumer_key
FANFOU_CONSUMER_SECRET=your_consumer_secret
```

This file is gitignored. The `env:generate` script reads it and produces obfuscated native source files (`EnvSecrets.kt` for Android, `EnvSecrets.h`/`EnvSecrets.m` for iOS) that are also gitignored. The script runs automatically before `start`, `test`, `android`, and `ios` — you only need to run it manually if you change `.env` without triggering those commands:

```sh
npm run env:generate
```

### Install dependencies

```sh
npm install
```

For iOS, also install CocoaPods dependencies:

```sh
bundle install          # once
bundle exec pod install # in ios/ when native deps change
```

### Run

```sh
npm start              # Metro bundler
npm run android        # Build & run Android
npm run ios            # Build & run iOS
```

## Development

```sh
npm test               # Jest
npm run lint           # ESLint
npm run typecheck      # TypeScript + deprecation checks
npm run env:generate   # Generate obfuscated native secrets (runs automatically before start/test/android/ios)
```

Run a single test file:

```sh
npm test -- __tests__/App.test.tsx
```

## Architecture

**Monorepo**: app at repo root + `packages/rn-fanfou-client/` (OAuth 1.0a & Fanfou API client with native modules for iOS/Android).

**Tech stack**:
- React Native 0.84 with React 19 and React Compiler
- TanStack Query v5 for data fetching
- React Navigation (bottom tabs + native stack)
- HeroUI Native + Tailwind CSS via Uniwind for styling
- Keychain for auth state and user preferences persistence
- i18next for internationalization
