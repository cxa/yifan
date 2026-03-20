import { useSyncExternalStore } from 'react';
import * as Keychain from 'react-native-keychain';

export const APP_THEME_OPTION = {
  COLORFUL: 'colorful',
  PLAIN: 'plain',
} as const;

export type AppThemeOption =
  (typeof APP_THEME_OPTION)[keyof typeof APP_THEME_OPTION];

export const APP_THEME_OPTIONS: ReadonlyArray<{
  value: AppThemeOption;
  label: string;
  nativeLabel: string;
}> = [
  { value: APP_THEME_OPTION.COLORFUL, label: 'Colorful', nativeLabel: '多彩' },
  { value: APP_THEME_OPTION.PLAIN, label: 'Plain', nativeLabel: '纯色' },
];

const SERVICE = 'app.theme-preference';

type Listener = () => void;

const listeners = new Set<Listener>();
let appThemePreference: AppThemeOption = APP_THEME_OPTION.COLORFUL;
let hydrationPromise: Promise<void> | null = null;

const emitChange = () => {
  listeners.forEach(listener => listener());
};

const setAppThemeSnapshot = (next: AppThemeOption) => {
  if (appThemePreference === next) {
    return;
  }
  appThemePreference = next;
  emitChange();
};

const parseAppThemePreference = (
  value?: string | null,
): AppThemeOption | null => {
  if (value === APP_THEME_OPTION.COLORFUL) return APP_THEME_OPTION.COLORFUL;
  if (value === APP_THEME_OPTION.PLAIN) return APP_THEME_OPTION.PLAIN;
  return null;
};

const hydrateAppThemePreference = async () => {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    const parsed = parseAppThemePreference(creds ? creds.password : null);
    if (!parsed) {
      return;
    }
    setAppThemeSnapshot(parsed);
  } catch {
    // Ignore hydration failures and keep default.
  }
};

const ensureHydrated = () => {
  if (!hydrationPromise) {
    hydrationPromise = hydrateAppThemePreference();
  }
};

export const subscribeToAppThemePreference = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAppThemePreferenceSnapshot = () => appThemePreference;

export const useAppThemePreference = () =>
  useSyncExternalStore(
    subscribeToAppThemePreference,
    getAppThemePreferenceSnapshot,
    getAppThemePreferenceSnapshot,
  );

export const setAppThemePreference = async (next: AppThemeOption) => {
  const prev = appThemePreference;
  setAppThemeSnapshot(next);
  try {
    await Keychain.setGenericPassword('theme', next, {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (error) {
    setAppThemeSnapshot(prev);
    throw error;
  }
};

ensureHydrated();
