import { getIntlLocale, onIntlLocaleChange } from '@/i18n/intl-locale';
import { parseFanfouDate } from '@/utils/fanfou-date';

const RELATIVE_CUTOFF_SECONDS = 60 * 60 * 24 * 7;

type RelativeUnit = 'second' | 'minute' | 'hour' | 'day';

const getRelativeUnit = (
  seconds: number,
): { unit: RelativeUnit; value: number } => {
  const absSeconds = Math.abs(seconds);
  if (absSeconds < 60) {
    return { unit: 'second', value: Math.round(seconds) };
  }
  if (absSeconds < 3600) {
    return { unit: 'minute', value: Math.round(seconds / 60) };
  }
  if (absSeconds < 86400) {
    return { unit: 'hour', value: Math.round(seconds / 3600) };
  }
  return { unit: 'day', value: Math.round(seconds / 86400) };
};

const hasRelativeFormat =
  typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function';
const hasDateFormat =
  typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';

let cachedRelative: Intl.RelativeTimeFormat | null = null;
let cachedWithYear: Intl.DateTimeFormat | null = null;
let cachedWithoutYear: Intl.DateTimeFormat | null = null;
let disposeLocaleListener: (() => void) | null = null;

const ensureLocaleListener = () => {
  if (disposeLocaleListener) {
    return;
  }
  disposeLocaleListener = onIntlLocaleChange(() => {
    cachedRelative = null;
    cachedWithYear = null;
    cachedWithoutYear = null;
  });
};

const getRelativeFormatter = () => {
  if (!hasRelativeFormat) {
    return null;
  }
  ensureLocaleListener();
  if (!cachedRelative) {
    cachedRelative = new Intl.RelativeTimeFormat(getIntlLocale(), {
      numeric: 'auto',
    });
  }
  return cachedRelative;
};

const getDateFormatter = (includeYear: boolean) => {
  if (!hasDateFormat) {
    return null;
  }
  ensureLocaleListener();
  if (includeYear) {
    if (!cachedWithYear) {
      cachedWithYear = new Intl.DateTimeFormat(getIntlLocale(), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    return cachedWithYear;
  }
  if (!cachedWithoutYear) {
    cachedWithoutYear = new Intl.DateTimeFormat(getIntlLocale(), {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return cachedWithoutYear;
};

const stripTimezone = (value: string) =>
  value.replace(/\s[+-]\d{4}\b/, '').trim();

export const formatTimestamp = (value?: string) => {
  if (!value) {
    return '';
  }
  const date = parseFanfouDate(value) ?? new Date(value);
  if (Number.isNaN(date.getTime())) {
    return stripTimezone(value);
  }
  const now = Date.now();
  const deltaSeconds = Math.round((date.getTime() - now) / 1000);
  const absSeconds = Math.abs(deltaSeconds);
  if (absSeconds < RELATIVE_CUTOFF_SECONDS) {
    const relativeFormatter = getRelativeFormatter();
    if (relativeFormatter) {
      const { unit, value: relativeValue } = getRelativeUnit(deltaSeconds);
      return relativeFormatter.format(relativeValue, unit);
    }
  }
  const includeYear = date.getFullYear() !== new Date(now).getFullYear();
  const dateFormatter = getDateFormatter(includeYear);
  if (dateFormatter) {
    return dateFormatter.format(date);
  }
  return stripTimezone(value);
};
