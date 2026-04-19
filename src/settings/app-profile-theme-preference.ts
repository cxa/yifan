import { useSyncExternalStore } from 'react';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'app.profile-theme-preference';

type Listener = () => void;
const listeners = new Set<Listener>();
// Default ON: profiles with their own theme look flatter without it, and
// the toggle lives in More for anyone who prefers the neutral palette.
let followProfileTheme = true;
let hydrationPromise: Promise<void> | null = null;

const emitChange = () => {
  listeners.forEach(listener => listener());
};

const setSnapshot = (next: boolean) => {
  if (followProfileTheme === next) return;
  followProfileTheme = next;
  emitChange();
};

const hydrate = async () => {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (creds) {
      setSnapshot(creds.password === 'true');
    }
    // No stored value → keep the default (true).
  } catch {
    // keep default
  }
};

const ensureHydrated = () => {
  if (!hydrationPromise) {
    hydrationPromise = hydrate();
  }
};

export const subscribeToAppProfileThemePreference = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAppProfileThemePreferenceSnapshot = () => followProfileTheme;

export const useAppProfileThemePreference = () =>
  useSyncExternalStore(
    subscribeToAppProfileThemePreference,
    getAppProfileThemePreferenceSnapshot,
    getAppProfileThemePreferenceSnapshot,
  );

export const setAppProfileThemePreference = async (next: boolean) => {
  const prev = followProfileTheme;
  setSnapshot(next);
  try {
    await Keychain.setGenericPassword('follow-profile-theme', String(next), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (error) {
    setSnapshot(prev);
    throw error;
  }
};

ensureHydrated();
