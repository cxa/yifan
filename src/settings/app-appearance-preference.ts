import { Appearance } from 'react-native';
import { useSyncExternalStore } from 'react';
import * as Keychain from 'react-native-keychain';

export const APP_APPEARANCE_OPTION = {
  AUTO: 'auto',
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type AppAppearanceOption =
  (typeof APP_APPEARANCE_OPTION)[keyof typeof APP_APPEARANCE_OPTION];

export const APP_APPEARANCE_OPTIONS: ReadonlyArray<{
  value: AppAppearanceOption;
}> = [
  { value: APP_APPEARANCE_OPTION.AUTO },
  { value: APP_APPEARANCE_OPTION.LIGHT },
  { value: APP_APPEARANCE_OPTION.DARK },
];

const SERVICE = 'app.appearance-preference';

type Listener = () => void;

const listeners = new Set<Listener>();
let appAppearancePreference: AppAppearanceOption = APP_APPEARANCE_OPTION.AUTO;
let hydrationPromise: Promise<void> | null = null;

// Track the current color scheme via Appearance listener so we always have
// the latest value synchronously — without depending on useColorScheme() which
// can lag behind when switching from forced dark/light back to auto.
let systemColorScheme = Appearance.getColorScheme();

Appearance.addChangeListener(({ colorScheme }) => {
  systemColorScheme = colorScheme;
  emitChange();
});

const emitChange = () => {
  listeners.forEach(listener => listener());
};

const setAppAppearanceSnapshot = (next: AppAppearanceOption) => {
  if (appAppearancePreference === next) {
    return;
  }
  appAppearancePreference = next;
  emitChange();
};

const applyAppearance = (value: AppAppearanceOption) => {
  Appearance.setColorScheme(
    value === APP_APPEARANCE_OPTION.AUTO ? 'unspecified' : value,
  );
};

const parseAppAppearancePreference = (
  value?: string | null,
): AppAppearanceOption | null => {
  if (value === APP_APPEARANCE_OPTION.AUTO) return APP_APPEARANCE_OPTION.AUTO;
  if (value === APP_APPEARANCE_OPTION.LIGHT) return APP_APPEARANCE_OPTION.LIGHT;
  if (value === APP_APPEARANCE_OPTION.DARK) return APP_APPEARANCE_OPTION.DARK;
  return null;
};

const hydrateAppAppearancePreference = async () => {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    const parsed = parseAppAppearancePreference(creds ? creds.password : null);
    if (!parsed) {
      return;
    }
    // Apply Appearance first so systemColorScheme updates before snapshot emits.
    applyAppearance(parsed);
    setAppAppearanceSnapshot(parsed);
  } catch {
    // Ignore hydration failures and keep default.
  }
};

const ensureHydrated = () => {
  if (!hydrationPromise) {
    hydrationPromise = hydrateAppAppearancePreference();
  }
};

export const subscribeToAppAppearancePreference = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAppAppearancePreferenceSnapshot = () =>
  appAppearancePreference;

export const useAppAppearancePreference = () =>
  useSyncExternalStore(
    subscribeToAppAppearancePreference,
    getAppAppearancePreferenceSnapshot,
    getAppAppearancePreferenceSnapshot,
  );

const getIsDarkSnapshot = (): boolean => {
  if (appAppearancePreference === APP_APPEARANCE_OPTION.DARK) return true;
  if (appAppearancePreference === APP_APPEARANCE_OPTION.LIGHT) return false;
  return systemColorScheme === 'dark';
};

export const useEffectiveIsDark = (): boolean =>
  useSyncExternalStore(
    subscribeToAppAppearancePreference,
    getIsDarkSnapshot,
    getIsDarkSnapshot,
  );

export const setAppAppearancePreference = async (
  next: AppAppearanceOption,
) => {
  const prev = appAppearancePreference;
  // Apply Appearance first — if setColorScheme fires addChangeListener synchronously,
  // systemColorScheme is already correct before setAppAppearanceSnapshot triggers re-renders.
  applyAppearance(next);
  setAppAppearanceSnapshot(next);
  try {
    await Keychain.setGenericPassword('appearance', next, {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (error) {
    applyAppearance(prev);
    setAppAppearanceSnapshot(prev);
    throw error;
  }
};

ensureHydrated();
