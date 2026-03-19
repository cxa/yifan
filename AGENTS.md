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
- Use React Navigation with all navigator wiring in `src/navigation/app-navigator.tsx`.
- Keep route names centralized in `src/navigation/route-names.ts` and route param types in `src/navigation/types.ts`; avoid hardcoded route-name strings.
- Use semantic route screen filenames in `src/routes/` (for example, `auth-home-screen.tsx`, `auth-profile-screen.tsx`, `login-screen.tsx`).
- Keep route files flat under `src/routes/` and use explicit semantic names; avoid underscore/dynamic-token filename patterns.
- Route-scoped shared components live in a `-components` folder next to the route.
- Route-scoped translations live in `-translations.ts`, and each route lazily loads its own translations.

## Module Resolution
- Use the `@/` alias for absolute imports from `src` (for example, `@/auth/fanfou-client`).

## Product Scope & Source of Truth
- Build mobile clients for `fantfou.com` on iOS and Android.
- Mirror the site’s core UI and flows.
- Use the Fanfou REST API docs at https://github.com/FanfouAPI/FanFouAPIDoc/wiki for endpoints, payloads, and error behavior.
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
- We are using the React Compiler. It will add memoization to components and values within codebase. This eliminates the need for you to add any useMemo, useCallback, and React.memo hooks, so NEVER add any of these
- When `useEffectEvent` is applicable, avoid `useEffect`.
- For TanStack Query, define shared query factories with `queryOptions` and centralized query-key helpers (for example under `src/query/`); avoid inline/magic query-key arrays in screens.
- For post/compose actions (status posts, replies, reposts, and direct-message sends), use TanStack Query `useMutation`; avoid extra local loading/error state when mutation state plus toast feedback is enough.
- For required data (for example profile `user`), avoid `user?.` access in the main render path; add early returns for missing/loading/error states, then render with non-null data.
- Avoid magic numbers/strings/keys in UI/layout/logic; use shared tokens/helpers or named constants with clear intent.
- Follow DRY principle: when behavior/UI/logic repeats, extract and reuse shared components/hooks/utils instead of copy-pasting implementations.
- Use kebab-case for filenames.

## Design System (Warm Pastel Playful UI)

The visual language is warm, playful, and handcrafted — pastel card colors with a cream base, bold display typography, and illustrated icons.

- **Background**: Warm cream `#F5EDD8` (not cool gray). All screens use this as the page background.
- **Surfaces**: Cards and sheets use distinct per-category pastel fills — never uniform white. Palette:
  - Pink `#FDDBD5` — personal / social content
  - Yellow `#FDF3C8` — thoughts, reminders, drafts
  - Lavender `#E8D5F5` — recipes, lists, creative
  - Mint `#C8EDE8` — travel, outdoors, goals
  - Sky `#D0E8F5` — work, productivity
  - White `#FFFFFF` — search bars, overlays, modals only
- **Primary / CTA**: Coral `#F47060`. Used for FAB, primary buttons (SAVE, confirm), and active tab icon tint. Avoid using it for decorative elements.
- **Shapes & Corners**: Very rounded — cards use `1.5rem` (24px), FAB and pill badges use `9999px`. Never sharp corners.
- **Shadows**: Flat. Separation comes from the warm cream background vs. colored card fills. No drop shadows on cards.
- **Typography**: Bold, heavy display font for screen titles and card headings (e.g., `font-weight: 800` or a rounded bold typeface). Body copy is regular weight. Dark brown-black `#1A1208` for text to feel warm rather than stark.
- **Icons**: Illustrated / kawaii-style emoji icons for categories and folders. Line icons for navigation tabs (minimal, 2px stroke). Avoid generic Material/SF symbol style.
- **Spacing**: Page padding 16–20, card padding 16, vertical gaps 12–16. Generous whitespace inside cards.

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
