import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { AppState } from 'react-native';
import { getLocales } from 'react-native-localize';

import {
  DEFAULT_LOCALE,
  RESOURCES,
  SUPPORTED_LOCALES,
  normalizeLocaleTag,
  type LocaleKey,
} from './translation-data';

const supportedLookup = SUPPORTED_LOCALES.map(locale =>
  normalizeLocaleTag(locale).toLowerCase(),
);

const matchSupportedLocale = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const normalized = normalizeLocaleTag(value).toLowerCase();
  const index = supportedLookup.indexOf(normalized);
  return index >= 0 ? SUPPORTED_LOCALES[index] : undefined;
};

const resolveLocale = (): LocaleKey => {
  const locales = getLocales();

  for (const locale of locales) {
    const candidates = [
      locale.languageTag,
      locale.scriptCode
        ? `${locale.languageCode}-${locale.scriptCode}`
        : undefined,
      `${locale.languageCode}-${locale.countryCode}`,
      locale.languageCode,
    ];

    for (const candidate of candidates) {
      const matched = matchSupportedLocale(candidate);
      if (matched) {
        return matched;
      }
    }

    if (locale.languageCode.toLowerCase() === 'zh') {
      return 'zh-CN';
    }
    if (locale.languageCode.toLowerCase() === 'en') {
      return 'en-US';
    }
  }

  return DEFAULT_LOCALE;
};

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  fallbackLng: DEFAULT_LOCALE,
  initImmediate: false,
  interpolation: {
    escapeValue: false,
  },
  lng: resolveLocale(),
  react: {
    useSuspense: false,
  },
  resources: RESOURCES,
  supportedLngs: [...SUPPORTED_LOCALES],
});

AppState.addEventListener('change', nextState => {
  if (nextState !== 'active') {
    return;
  }
  const nextLocale = resolveLocale();
  if (i18n.language !== nextLocale) {
    i18n.changeLanguage(nextLocale);
  }
});

export default i18n;
