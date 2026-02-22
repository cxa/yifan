# Repository Guidelines

## Project Structure & Module Organization
- This is a monorepo with the app at the repo root and a shared package in `packages/rn-fanfou-client/`.
- `App.tsx` is the main React Native tree; `index.js` registers the app.
- `__tests__/` holds Jest tests (for example, `__tests__/App.test.tsx`).
- `android/` and `ios/` contain the app’s native projects.
- `packages/rn-fanfou-client/` contains the reusable client library and native modules.
- Shared app-level components live in `src/components/`.
- Config lives in `app.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, and `jest.config.js`.
- Shared assets live in `assets/shared/` with platform-specific assets in `assets/android/` and `assets/ios/`. Avoid duplicating shared files in native folders; use symlinks when needed.

## Routing Conventions
- Prefer flat route folders (for example, `src/routes/_auth.home`, `src/routes/_auth.mentions`).
- Use flat files for auth routes (for example, `src/routes/_auth.tsx` and `src/routes/_auth.index.tsx`); avoid nesting under `src/routes/_auth/`.
- Use `index.tsx` as the route entry screen.
- Use `route.tsx` as the layout when needed.
- Route-scoped shared components live in a `-components` folder next to the route.
- Route-scoped translations live in `-translations.ts`, and each route lazily loads its own translations.

## Module Resolution
- Use the `@/` alias for absolute imports from `src` (for example, `@/auth/fanfou-client`).

## Product Scope & Source of Truth
- Build mobile clients for `fantfou.com` on iOS and Android.
- Mirror the site’s core UI and flows.
- Use the Fanfou REST API docs for endpoints, payloads, and error behavior.
- Authentication uses OAuth 1.0; avoid Basic Auth unless docs require it.
- OAuth callback URL: `gohan://authorize_callback`.
- `rn-fanfou-client` is minimal: the app must supply the consumer key/secret and handle token persistence.
- API base URL: `http://api.fanfou.com`. OAuth endpoints use `http://fanfou.com` with mobile authorize at `https://m.fanfou.com/oauth/authorize`.
- OAuth signing/requests are native: iOS uses a custom Objective-C OAuth 1.0a signer, Android uses `com.github.scribejava:scribejava-core` (Gradle).
- OAuth flow follows the legacy Fanfou client: no `oauth_verifier` is required in the callback or access-token exchange.
- Native GET requests append `format=html` if not provided (legacy compatibility).
- Photo uploads use `/photos/upload.json` with a multipart body and the legacy boundary `DAN1324567890FAN`; OAuth signature is based on OAuth params only.
- Respect API rate limits; use `account.rate-limit-status` to check remaining quota.

## Build, Test, and Development Commands
- `npm start`: Metro bundler.
- `npm run android`: build/run Android.
- `npm run ios`: build/run iOS.
- `npm run env:generate`: generate native obfuscated secrets for the app (runs automatically before start/test/android/ios).
- Android builds copy shared fonts from `assets/shared/fonts/` into generated assets via the `prepareSharedFonts` Gradle task.
- `npm test`: Jest.
- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript typecheck plus deprecation checks for TypeScript APIs.
- Workspace dependencies live under `packages/*` and are installed via the root `npm install`.
- iOS native deps: `bundle install` (first time), then `bundle exec pod install` in `ios/` when native deps change.

## Coding Style & Naming Conventions
- Use TypeScript/TSX; keep 2-space indentation and single quotes to match existing files.
- Prefer arrow functions
- Keep ESLint clean (`@react-native/eslint-config`).
- Deprecated TypeScript APIs are blocked by lint (`@typescript-eslint/no-deprecated`); for worklets threading use `scheduleOnRN` instead of `runOnJS`.
- For required data (for example profile `user`), avoid `user?.` access in the main render path; add early returns for missing/loading/error states, then render with non-null data.
- Avoid magic numbers in UI/layout/logic; use shared tokens/helpers or named constants with clear intent.
- Follow DRY principle: when behavior/UI/logic repeats, extract and reuse shared components/hooks/utils instead of copy-pasting implementations.
- Use kebab-case for filenames.

## Design System (Neobrutalism)
- The app visual language is neobrutalism; do not soften it into generic modern UI.
- Use strong contrast blocks with visible borders (typically `border-2` + `border-foreground` or `dark:border-border`).
- Prefer hard, offset depth over blur shadows (for example the existing offset background block pattern).
- Keep corners mostly sharp; only use rounded shapes where semantically expected (avatars, pills, media masks).
- Keep spacing bold and consistent: outer page padding 16-20, card padding 16-20, vertical gaps usually 12-16.
- Keep typography direct and high-contrast; use muted text only for secondary metadata.
- For new screens/components, match existing neobrutalist primitives before introducing new visual patterns.

## Testing Guidelines
- Jest with the React Native preset.
- Put tests in `__tests__/` and name `*.test.tsx`.
- No coverage threshold; add focused tests for new logic.
- After each change, run `npm run lint` and `npm run typecheck`.

## Commit & Pull Request Guidelines
- Use "Conventional Commits"
- PRs should describe the change, list testing, and include screenshots for UI updates.

## Documentation Hygiene
- When new conventions are introduced (API contracts, auth rules, design rules, build steps), update `AGENTS.md`.
## Environment Notes
- Node.js: `>= 22.11.0` (see `package.json`).
- Keep `.env` out of version control; do not add a `.env.example` unless explicitly requested.
- `scripts/generate-env.js` writes native obfuscated secrets for the app:
  - `android/app/src/main/java/com/gohan/EnvSecrets.kt`
  - `ios/gohan/EnvSecrets.h`
  - `ios/gohan/EnvSecrets.m`
- Fanfou consumer credentials are stored in those native files (obfuscated, no plain strings in JS).
- App native startup config loads these secrets into `rn-fanfou-client`; JS never reads them.

<!-- HEROUI-NATIVE-AGENTS-MD-START -->
[HeroUI Native Docs Index]|root: ./.heroui-docs/native|STOP. What you remember about HeroUI Native is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --native --output AGENTS.md|components/(buttons):{button.mdx,close-button.mdx}|components/(data-display):{chip.mdx}|components/(feedback):{alert.mdx,skeleton-group.mdx,skeleton.mdx,spinner.mdx}|components/(forms):{checkbox.mdx,control-field.mdx,description.mdx,field-error.mdx,input-otp.mdx,input.mdx,label.mdx,radio-group.mdx,select.mdx,switch.mdx,text-area.mdx,text-field.mdx}|components/(layout):{card.mdx,separator.mdx,surface.mdx}|components/(media):{avatar.mdx}|components/(navigation):{accordion.mdx,tabs.mdx}|components/(overlays):{bottom-sheet.mdx,dialog.mdx,popover.mdx,toast.mdx}|components/(utilities):{pressable-feedback.mdx,scroll-shadow.mdx}|getting-started/(handbook):{animation.mdx,colors.mdx,composition.mdx,portal.mdx,provider.mdx,styling.mdx,theming.mdx}|getting-started/(overview):{design-principles.mdx,quick-start.mdx}|getting-started/(ui-for-agents):{agent-skills.mdx,agents-md.mdx,llms-txt.mdx,mcp-server.mdx}|releases:{beta-10.mdx,beta-11.mdx,beta-12.mdx,beta-13.mdx,rc-1.mdx}
<!-- HEROUI-NATIVE-AGENTS-MD-END -->
