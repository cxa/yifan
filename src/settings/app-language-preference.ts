import { useSyncExternalStore } from 'react';
import * as Keychain from 'react-native-keychain';

import { type LocaleKey, SUPPORTED_LOCALES } from '@/i18n/translation-data';

export type AppLanguageOption = LocaleKey | 'system';

export const APP_LANGUAGE_OPTION = {
  SYSTEM: 'system' as AppLanguageOption,
  EN_US: 'en-US' as AppLanguageOption,
  ZH_CN: 'zh-CN' as AppLanguageOption,
} as const;

export const APP_LANGUAGE_OPTIONS: ReadonlyArray<{
  value: AppLanguageOption;
  label: string;
  nativeLabel: string;
}> = [
  {
    value: APP_LANGUAGE_OPTION.SYSTEM,
    label: 'System Default',
    nativeLabel: '跟随系统',
  },
  {
    value: APP_LANGUAGE_OPTION.EN_US,
    label: 'English',
    nativeLabel: 'English',
  },
  {
    value: APP_LANGUAGE_OPTION.ZH_CN,
    label: 'Simplified Chinese',
    nativeLabel: '简体中文',
  },
];

const SERVICE = 'app.language-preference';

type Listener = () => void;

const listeners = new Set<Listener>();
let appLanguagePreference: AppLanguageOption = APP_LANGUAGE_OPTION.SYSTEM;
let hydrationPromise: Promise<void> | null = null;

const emitChange = () => {
  listeners.forEach(listener => listener());
};

const setAppLanguageSnapshot = (next: AppLanguageOption) => {
  if (appLanguagePreference === next) {
    return;
  }
  appLanguagePreference = next;
  emitChange();
};

const parseAppLanguagePreference = (
  value?: string | null,
): AppLanguageOption | null => {
  if (!value) {
    return null;
  }
  if (value === APP_LANGUAGE_OPTION.SYSTEM) {
    return APP_LANGUAGE_OPTION.SYSTEM;
  }
  if ((SUPPORTED_LOCALES as ReadonlyArray<string>).includes(value)) {
    return value as LocaleKey;
  }
  return null;
};

const hydrateAppLanguagePreference = async () => {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    const parsed = parseAppLanguagePreference(creds ? creds.password : null);
    if (!parsed) {
      return;
    }
    setAppLanguageSnapshot(parsed);
  } catch {
    // Ignore hydration failures and keep default.
  }
};

const ensureHydrated = () => {
  if (!hydrationPromise) {
    hydrationPromise = hydrateAppLanguagePreference();
  }
};

export const subscribeToAppLanguagePreference = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAppLanguagePreferenceSnapshot = () => appLanguagePreference;

export const useAppLanguagePreference = () =>
  useSyncExternalStore(
    subscribeToAppLanguagePreference,
    getAppLanguagePreferenceSnapshot,
    getAppLanguagePreferenceSnapshot,
  );

export const setAppLanguagePreference = async (next: AppLanguageOption) => {
  const prev = appLanguagePreference;
  setAppLanguageSnapshot(next);
  try {
    await Keychain.setGenericPassword('language', next, {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (error) {
    setAppLanguageSnapshot(prev);
    throw error;
  }
};

ensureHydrated();
