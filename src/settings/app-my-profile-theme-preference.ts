import { useSyncExternalStore } from 'react';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'app.my-profile-theme-preference';

type Listener = () => void;
const listeners = new Set<Listener>();
// Default OFF on the More tab — the user's own Fanfou theme often clashes
// with the app's coral accent and can make the settings page hard to read.
// The profile screen still defaults to ON via its own preference so that
// browsing any profile (including your own) respects the author's theme.
let followMyProfileTheme = false;
let hydrationPromise: Promise<void> | null = null;

const emitChange = () => {
  listeners.forEach(listener => listener());
};

const setSnapshot = (next: boolean) => {
  if (followMyProfileTheme === next) return;
  followMyProfileTheme = next;
  emitChange();
};

const hydrate = async () => {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (creds) {
      setSnapshot(creds.password === 'true');
    }
  } catch {
    // keep default
  }
};

const ensureHydrated = () => {
  if (!hydrationPromise) {
    hydrationPromise = hydrate();
  }
};

export const subscribeToAppMyProfileThemePreference = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAppMyProfileThemePreferenceSnapshot = () => followMyProfileTheme;

export const useAppMyProfileThemePreference = () =>
  useSyncExternalStore(
    subscribeToAppMyProfileThemePreference,
    getAppMyProfileThemePreferenceSnapshot,
    getAppMyProfileThemePreferenceSnapshot,
  );

export const setAppMyProfileThemePreference = async (next: boolean) => {
  const prev = followMyProfileTheme;
  setSnapshot(next);
  try {
    await Keychain.setGenericPassword('follow-my-profile-theme', String(next), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (error) {
    setSnapshot(prev);
    throw error;
  }
};

ensureHydrated();
