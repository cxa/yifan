import { useSyncExternalStore } from 'react';
import * as Keychain from 'react-native-keychain';

export const APP_FONT_OPTION = {
  SYSTEM: 'system',
  XIAOLAI: 'xiaolai',
  HUIWEN_HKHEI: 'huiwen-hkhei',
  HUIWEN_MINCHO_GBK: 'huiwen-mincho-gbk',
} as const;

export type AppFontOption =
  (typeof APP_FONT_OPTION)[keyof typeof APP_FONT_OPTION];

export const APP_FONT_OPTIONS = [
  { value: APP_FONT_OPTION.SYSTEM, label: '系统字体' },
  { value: APP_FONT_OPTION.XIAOLAI, label: '小赖字体' },
  { value: APP_FONT_OPTION.HUIWEN_HKHEI, label: '匯文港黑' },
  { value: APP_FONT_OPTION.HUIWEN_MINCHO_GBK, label: '匯文明朝體' },
] as const;

const APP_FONT_CLASS_NAME: Record<AppFontOption, string | undefined> = {
  [APP_FONT_OPTION.SYSTEM]: undefined,
  [APP_FONT_OPTION.XIAOLAI]: 'font-xiaolai',
  [APP_FONT_OPTION.HUIWEN_HKHEI]: 'font-huiwen',
  [APP_FONT_OPTION.HUIWEN_MINCHO_GBK]: 'font-huiwen-mincho',
};

const APP_FONT_FAMILY: Record<AppFontOption, string | undefined> = {
  [APP_FONT_OPTION.SYSTEM]: undefined,
  [APP_FONT_OPTION.XIAOLAI]: 'Xiaolai',
  [APP_FONT_OPTION.HUIWEN_HKHEI]: 'HuiwenHKHei-Regular',
  [APP_FONT_OPTION.HUIWEN_MINCHO_GBK]: 'Huiwen-MinchoGBK-Regular',
};

const SERVICE = 'app.font-preference';

type Listener = () => void;

const listeners = new Set<Listener>();
let appFontPreference: AppFontOption = APP_FONT_OPTION.HUIWEN_HKHEI;
let hydrationPromise: Promise<void> | null = null;

const emitChange = () => {
  listeners.forEach(listener => listener());
};

const setAppFontSnapshot = (next: AppFontOption) => {
  if (appFontPreference === next) {
    return;
  }
  appFontPreference = next;
  emitChange();
};

const parseAppFontPreference = (
  value?: string | null,
): AppFontOption | null => {
  if (!value) {
    return null;
  }
  if (value === APP_FONT_OPTION.SYSTEM) {
    return APP_FONT_OPTION.SYSTEM;
  }
  if (value === APP_FONT_OPTION.XIAOLAI) {
    return APP_FONT_OPTION.XIAOLAI;
  }
  if (value === APP_FONT_OPTION.HUIWEN_HKHEI) {
    return APP_FONT_OPTION.HUIWEN_HKHEI;
  }
  if (value === APP_FONT_OPTION.HUIWEN_MINCHO_GBK) {
    return APP_FONT_OPTION.HUIWEN_MINCHO_GBK;
  }
  return null;
};

const hydrateAppFontPreference = async () => {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    const parsed = parseAppFontPreference(creds ? creds.password : null);
    if (!parsed) {
      return;
    }
    setAppFontSnapshot(parsed);
  } catch {
    // Ignore hydration failures and keep default font.
  }
};

const ensureHydrated = () => {
  if (!hydrationPromise) {
    hydrationPromise = hydrateAppFontPreference();
  }
};

export const subscribeToAppFontPreference = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAppFontPreferenceSnapshot = () => appFontPreference;

export const useAppFontPreference = () =>
  useSyncExternalStore(
    subscribeToAppFontPreference,
    getAppFontPreferenceSnapshot,
    getAppFontPreferenceSnapshot,
  );

export const useAppFontClassName = () => {
  const currentFont = useAppFontPreference();
  return APP_FONT_CLASS_NAME[currentFont];
};

export const useAppFontFamily = () => {
  const currentFont = useAppFontPreference();
  return APP_FONT_FAMILY[currentFont];
};

export const setAppFontPreference = async (next: AppFontOption) => {
  const prev = appFontPreference;
  setAppFontSnapshot(next);
  try {
    await Keychain.setGenericPassword('font', next, {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (error) {
    setAppFontSnapshot(prev);
    throw error;
  }
};

ensureHydrated();
