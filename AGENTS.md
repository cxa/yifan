# Repository Guidelines

## Project Structure & Module Organization
- This is a monorepo with the app at the repo root and a shared package in `packages/rn-fanfou-client/`.
- `App.tsx` is the main React Native tree; `index.js` registers the app.
- `__tests__/` holds Jest tests (for example, `__tests__/App.test.tsx`).
- `android/` and `ios/` contain the app's native projects.
- `packages/rn-fanfou-client/` contains the reusable OAuth 1.0a + Fanfou client and its iOS/Android native modules.
- Shared app-level components live in `src/components/`.
- Config lives in `app.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, and `jest.config.js`.
- Shared assets live in `assets/shared/` with platform-specific assets in `assets/android/` and `assets/ios/`. Avoid duplicating shared files in native folders; use symlinks when needed.

## Architecture
- **Provider stack** (`src/routes/root-layout.tsx`): `GestureHandlerRootView → SafeAreaProvider → HeroUINativeProvider → ToastManagerSync → QueryProvider`.
- **Navigation** (`src/navigation/app-navigator.tsx`): root stack switches between `LOGIN` and `AUTH` based on `useAuthSession()`. Auth stack contains a bottom-tab navigator plus modal/push screens.
- **Auth state** (`src/auth/auth-session.ts`): custom `useSyncExternalStore` with Keychain persistence — not Redux/Zustand.
- **User preferences** (e.g. `src/settings/app-language-preference.ts`, `app-theme-preference.ts`): same `useSyncExternalStore` + Keychain pattern.
- **Data fetching**: TanStack Query v5. Query factories and centralized key helpers live in `src/query/`. Mutations use `useMutation` with toast feedback; no extra local loading state.
- **Styling**: HeroUI Native components + Tailwind CSS via Uniwind (`global.css` entry point). Use Tailwind classes; avoid inline StyleSheet for layout.

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
- Build mobile clients for `fanfou.com` on iOS and Android.
- Mirror the site's core UI and flows.
- Use the Fanfou REST API docs at https://github.com/FanfouAPI/FanFouAPIDoc/wiki for endpoints, payloads, and error behavior.
- Authentication uses OAuth 1.0; avoid Basic Auth unless docs require it.
- OAuth callback URL: `yifan://authorize_callback`.
- `rn-fanfou-client` is minimal: the app must supply the consumer key/secret and handle token persistence.
- API base URL: `http://api.fanfou.com`. OAuth endpoints use `http://fanfou.com` with mobile authorize at `https://m.fanfou.com/oauth/authorize`.
- OAuth signing/requests are native: iOS uses a custom Objective-C OAuth 1.0a signer, Android uses `com.github.scribejava:scribejava-core` (Gradle).
- OAuth flow follows the legacy Fanfou client: no `oauth_verifier` is required in the callback or access-token exchange.
- Native GET requests append `format=html` if not provided (legacy compatibility).
- Photo uploads use `/photos/upload.json` with a multipart body and the legacy boundary `DAN1324567890FAN`; OAuth signature is based on OAuth params only.
- Respect API rate limits; use `account.rate-limit-status` to check remaining quota.

## Build, Test, and Development Commands
- `npm start` — Metro bundler.
- `npm run android` — build/run Android.
- `npm run ios` — build/run iOS.
- `npm test` — Jest (run a single test file with `npm test -- __tests__/App.test.tsx`).
- `npm run lint` — ESLint.
- `npm run typecheck` — `tsc --noEmit` + ESLint deprecation/`max-warnings=0` pass.
- `npm run env:generate` — generate obfuscated native secrets (auto-runs before `start`/`test`/`android`/`ios`).
- Workspace dependencies under `packages/*` are installed via the root `npm install`.
- Android builds copy shared fonts from `assets/shared/fonts/` into generated assets via the `prepareSharedFonts` Gradle task.
- iOS native deps: `bundle install` (first time), then `bundle exec pod install` in `ios/` when native deps change.
- iOS deployment target is **16.0** (declared as `APP_IOS_TARGET` at the top of `ios/Podfile` and forced into every pod via `post_install`). This was bumped from RN's default 15.1 to admit pods that require iOS 15.5+ (e.g. `GoogleMLKit/FaceDetection`).

## Coding Style & Naming Conventions
- TypeScript/TSX; 2-space indent; single quotes — match existing files.
- Prefer arrow functions.
- Keep ESLint clean (`@react-native/eslint-config`). The `typecheck` script runs ESLint with `--max-warnings=0`, so warnings are also errors — including `react-native/no-inline-styles` for fully literal style objects (extract to `StyleSheet` or compose with variable-bearing styles).
- Deprecated TypeScript APIs are blocked by lint (`@typescript-eslint/no-deprecated`); for worklet threading use `scheduleOnRN` instead of `runOnJS`.
- **React Compiler is enabled** — never add `useMemo`, `useCallback`, or `React.memo`. ESLint will error on them.
- When `useEffectEvent` is applicable, avoid `useEffect`.
- For TanStack Query, define shared query factories with `queryOptions` and centralized query-key helpers (e.g. under `src/query/`); avoid inline/magic query-key arrays in screens.
- For post/compose actions (status posts, replies, reposts, and direct-message sends), use TanStack Query `useMutation`; avoid extra local loading/error state when mutation state plus toast feedback is enough.
- For required data (e.g. profile `user`), avoid `user?.` access in the main render path; add early returns for missing/loading/error states, then render with non-null data.
- Avoid magic numbers/strings/keys in UI/layout/logic; use shared tokens/helpers or named constants with clear intent.
- Follow DRY: when behavior/UI/logic repeats, extract and reuse shared components/hooks/utils instead of copy-pasting.
- Use kebab-case for filenames.
- HeroUI Native docs live locally at `.heroui-docs/native/` — always read them before using a HeroUI component; do not rely on memory.

## Design System (Warm Pastel Playful UI)

The visual language is warm, playful, and handcrafted — pastel card colors on a light background, bold display typography, and illustrated icons.

- **Page background**: White `#FFFFFF` (HeroUI theme default). Cards and surfaces float on top.
- **User preference — theme** (`src/settings/app-theme-preference.ts`):
  - `COLORFUL` (default) — per-category pastel card fills (see palette below).
  - `PLAIN` — neutral card fills (`#FFFFFF` light / `#1E1E1E` dark). Respect this preference; never hardcode pastel fills outside the `COLORFUL` path.
- **Card pastel palette** in `COLORFUL` mode (`src/components/drop-shadow-box.tsx`). Source semantic names — consumers should reference these, not hex literals:
  | Type      | Light     | Dark      | Flavor                       |
  | --------- | --------- | --------- | ---------------------------- |
  | `default` | `#F7EFE0` | `#2A2520` | cream                        |
  | `accent`  | `#F6D6CB` | `#5A2E23` | coral (warm red)             |
  | `warning` | `#FFECBA` | `#4A3618` | apricot (warm yellow)        |
  | `danger`  | `#E3CAEF` | `#3D2048` | lilac (cool purple)          |
  | `sky`     | `#BCDDEC` | `#1A3E5A` | crisp sky (cool blue)        |
  | `success` | `#B5E0CA` | `#1A4538` | mint (fresh green)           |
  Timelines rotate cards through `CARD_PASTEL_CYCLE` (success → accent → sky → warning → danger) for hard alternating contrast while scrolling.
- **Primary / CTA**: Coral `#F47060`. Used for FAB, primary buttons (SAVE, confirm), and active tab icon tint. Avoid for decorative elements.
- **Text**: Dark brown-black `#1A1208` (light) / `#F2EDE8` (dark). Muted `#7C7268` (light) / `#9C9288` (dark).
- **Shapes & Corners**: Very rounded — cards use `rounded-3xl` (24px), FAB and pill badges use `9999px`. Use `borderCurve: 'continuous'` on card-sized rounded rects so the superellipse reads smooth.
- **Shadows**: Flat. Separation comes from the page background vs. colored card fills. The `shadow-card` utility in `global.css` adds a strictly downward 4-pixel offset shadow; no other shadows belong on cards. Dark mode drops shadows entirely (`dark:shadow-none`).
- **Typography**: Bold/heavy display weight (`font-weight: 800`) for screen titles and card headings. Body copy is regular weight. Custom CJK fonts are loaded via Uniwind theme tokens: `font-xiaolai` (Xiaolai), `font-huiwen` (HuiwenHKHei), `font-huiwen-mincho` (Huiwen-MinchoGBK).
  - Custom fonts are **Regular-weight only** on Android (no bold variant in the TTFs). `app-text.tsx` strips `fontWeight` on Android so the renderer doesn't fall back to a system font mid-line. Don't bypass that helper.
- **Icons**: Illustrated / kawaii-style emoji icons for categories and folders. Line icons (`lucide-react-native`) for navigation tabs and action rows (2px stroke, ~18px). Avoid generic Material/SF Symbol style.
- **Share icon**: Platform-idiomatic — `Share` (box+arrow-up) on iOS, `Share2` (Material 3-node) on Android. See `timeline-status-card.tsx`.
- **Spacing**: Page padding 16–20; card padding 16; vertical gaps 12–16. Generous whitespace inside cards.

## Android Image Loading
- Fanfou photo CDNs (`photo[1-4].fanfou.com`) speak only plain HTTP — `https://photo3.fanfou.com/` returns a connection error. The Android cleartext config (`android/app/src/main/res/xml/network_security_config.xml`) whitelists `fanfou.com` with `includeSubdomains="true"`, so plain HTTP works as-is. **Don't rewrite photo URLs to HTTPS on Android** — the upgrade kills the request.
- Use `normalizeFanfouImageUrl` (`src/utils/normalize-fanfou-image-url.ts`) to trim and null-check Fanfou-served image URLs before handing them to `<Image>`.
- Fresco occasionally swallows fetch failures (no `onError`, no `onLoad`) — the photo container stays on the shimmer until the app is restarted. The timeline status card retries up to `MAX_PHOTO_RETRIES` times on error AND on a 5s wall-clock timeout, re-keying the `<Image>` to force Fresco to issue a fresh request. Reuse the same pattern for any new screen that renders Fanfou photos directly.

## Testing Guidelines
- Jest with the React Native preset.
- Put tests in `__tests__/` and name `*.test.tsx`.
- No coverage threshold; add focused tests for new logic.
- After each change, run `npm run lint` and `npm run typecheck` (the latter doubles as the deprecation/`max-warnings=0` gate).

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat(scope): …`, `fix(scope): …`, `chore: …`, `ui(scope): …`).
- PRs should describe the change, list testing, and include screenshots for UI updates.
- **After each code change**, run `/codex:review` for an independent second opinion before moving on.

## Releasing
- **Always use `node scripts/release.js`.** Never manually run bump-version + tag + push. The script:
  1. `bump-version.js` — version + `nativeVersion` auto-detection.
  2. `generate-changelog.js` — changelog from previous tag.
  3. Writes `RELEASE_NOTES.md` — edit before confirming.
  4. Commit, tag, push.
- The GitHub Release workflow reads `RELEASE_NOTES.md` for release notes.
- App Store Connect-facing text must never mention Android, Google Play, APKs, or Android download/QR-code availability. This includes release notes, review notes, metadata, screenshots, preview text, and any `asc`-submitted fields. Reword cross-platform changes as iOS-only or omit the Android-specific detail for App Store Connect.
- When submitting iOS builds with `asc publish appstore`, always pass an explicit `--build-number` matching the release tag's git commit count (for example, `git rev-list --count v2605.17`). Never allow `asc` local-build mode to default `CURRENT_PROJECT_VERSION` / `CFBundleVersion` to `1`.
- Version format `YYMM.DD`; same-day re-releases append `.1`, `.2`, … (e.g. `2604.10.1`).

## Documentation Hygiene
- When new conventions are introduced (API contracts, auth rules, design rules, build steps, native-platform quirks), update `AGENTS.md`.
- `CLAUDE.md` is a symlink to `AGENTS.md`; edit only `AGENTS.md`.

## Environment Notes
- Node.js: `>= 22.11.0` (see `package.json`).
- Keep `.env` out of version control; do not add a `.env.example` unless explicitly requested.
- `scripts/generate-env.js` writes native obfuscated secrets for the app:
  - `android/app/src/main/java/im/cxa/fanatter/EnvSecrets.kt`
  - `ios/yifan/EnvSecrets.h`
  - `ios/yifan/EnvSecrets.m`
- Fanfou consumer credentials are stored in those native files (obfuscated, no plain strings in JS).
- App native startup config loads these secrets into `rn-fanfou-client`; JS never reads them.

<!-- HEROUI-NATIVE-AGENTS-MD-START -->
[HeroUI Native Docs Index]|root: ./.heroui-docs/native|STOP. What you remember about HeroUI Native is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --native --output AGENTS.md|components/(buttons):{button.mdx,close-button.mdx}|components/(data-display):{chip.mdx}|components/(feedback):{alert.mdx,skeleton-group.mdx,skeleton.mdx,spinner.mdx}|components/(forms):{checkbox.mdx,control-field.mdx,description.mdx,field-error.mdx,input-otp.mdx,input.mdx,label.mdx,radio-group.mdx,select.mdx,switch.mdx,text-area.mdx,text-field.mdx}|components/(layout):{card.mdx,separator.mdx,surface.mdx}|components/(media):{avatar.mdx}|components/(navigation):{accordion.mdx,tabs.mdx}|components/(overlays):{bottom-sheet.mdx,dialog.mdx,popover.mdx,toast.mdx}|components/(utilities):{pressable-feedback.mdx,scroll-shadow.mdx}|getting-started/(handbook):{animation.mdx,colors.mdx,composition.mdx,portal.mdx,provider.mdx,styling.mdx,theming.mdx}|getting-started/(overview):{design-principles.mdx,quick-start.mdx}|getting-started/(ui-for-agents):{agent-skills.mdx,agents-md.mdx,llms-txt.mdx,mcp-server.mdx}|releases:{beta-10.mdx,beta-11.mdx,beta-12.mdx,beta-13.mdx,rc-1.mdx}
<!-- HEROUI-NATIVE-AGENTS-MD-END -->
