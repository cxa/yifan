import { useSyncExternalStore } from 'react';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'app.my-profile-theme-preference';

type Listener = () => void;
const listeners = new Set<Listener>();
// Default ON: the More tab picks up your Fanfou profile's palette so
// the app feels like yours out of the box. Anyone whose palette
// clashes with the settings rows can toggle it off via
// `Follow My Color Settings` in More itself.
let followMyProfileTheme = true;
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
