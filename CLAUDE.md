# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Follow all rules in AGENTS.md.** This file summarizes the most important points and adds architectural context not captured there.

---

## Commands

```bash
npm start              # Metro bundler
npm run android        # Build & run Android
npm run ios            # Build & run iOS
npm test               # Jest (env:generate runs first)
npm run lint           # ESLint
npm run typecheck      # TypeScript + deprecation checks
npm run env:generate   # Generate obfuscated native secrets (auto-runs before start/test/android/ios)
```

iOS setup (first time or when native deps change):
```bash
bundle install          # once
bundle exec pod install # in ios/ when native deps change
```

Run a single test file: `npm test -- __tests__/App.test.tsx`

---

## Architecture

**Monorepo**: app at repo root + `packages/rn-fanfou-client/` (OAuth 1.0a & Fanfou API client with native modules for iOS/Android).

**Provider stack** (`src/routes/root-layout.tsx`):
```
GestureHandlerRootView → SafeAreaProvider → HeroUINativeProvider → ToastManagerSync → QueryProvider
```

**Navigation** (`src/navigation/app-navigator.tsx`): root stack switches between `LOGIN` and `AUTH` based on `useAuthSession()`. Auth stack contains a bottom-tab navigator plus modal/push screens.

**Auth state** (`src/auth/auth-session.ts`): custom `useSyncExternalStore` with Keychain persistence — not Redux/Zustand.

**User preferences** (e.g., `src/settings/app-language-preference.ts`): same `useSyncExternalStore` + Keychain pattern.

**Data fetching**: TanStack Query v5. Query factories and centralized key helpers live in `src/query/`. Mutations use `useMutation` with toast feedback; no extra local loading state.

**Styling**: HeroUI Native components + Tailwind CSS via Uniwind (`global.css` entry point). Use Tailwind classes; avoid inline StyleSheet for layout.

---

## Key Constraints

- **React Compiler is enabled** — never add `useMemo`, `useCallback`, or `React.memo`. ESLint will error on them.
- **No deprecated APIs** — `@typescript-eslint/no-deprecated` is set to `error`. Use `scheduleOnRN` instead of `runOnJS` for worklet threading.
- **`@/` alias** maps to `src/` — use it for all cross-directory imports.
- **Early returns for required data** — add loading/error guards, then access data without `?.` in the main render path.
- **HeroUI Native docs** are local at `.heroui-docs/native/` — always read them before using a component; do not rely on memory.

---

## Design System

See AGENTS.md §"Design System" for full rules. Summary:
- Background: `#F5EDD8` (warm cream), surfaces: per-category pastel fills (pink, yellow, lavender, mint, sky) — never uniform white
- Primary/CTA: Coral `#F47060` (FAB, primary buttons, active tab)
- Text: Dark brown-black `#1A1208`
- Border radius: `1.5rem` / `24px` on cards; `9999px` pill on FAB and badges
- No drop shadows — separation via cream bg vs. colored card fills
- Typography: bold/heavy display font (`font-weight: 800`) for titles; warm and playful tone
- Icons: illustrated/kawaii style for categories, minimal line icons for nav tabs
