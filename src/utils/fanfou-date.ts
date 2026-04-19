import { getIntlLocale } from '@/i18n/intl-locale';

const FANFOU_DATE_REGEX =
  /^[A-Za-z]{3}\s([A-Za-z]{3})\s(\d{1,2})\s(\d{2}):(\d{2}):(\d{2})\s([+-]\d{4})\s(\d{4})$/;
const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export const parseFanfouDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }

  const match = value.match(FANFOU_DATE_REGEX);
  if (!match) {
    return null;
  }

  const [, monthLabel, dayRaw, hourRaw, minuteRaw, secondRaw, tzRaw, yearRaw] =
    match;
  const month = MONTHS[monthLabel];
  if (month === undefined) {
    return null;
  }

  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  const year = Number(yearRaw);
  if (
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    Number.isNaN(year)
  ) {
    return null;
  }

  const sign = tzRaw.startsWith('-') ? -1 : 1;
  const tzHours = Number(tzRaw.slice(1, 3));
  const tzMinutes = Number(tzRaw.slice(3, 5));
  if (Number.isNaN(tzHours) || Number.isNaN(tzMinutes)) {
    return null;
  }

  const offsetMinutes = sign * (tzHours * 60 + tzMinutes);
  const utcMillis =
    Date.UTC(year, month, day, hour, minute, second) -
    offsetMinutes * 60 * 1000;

  return new Date(utcMillis);
};

const parseDateWithFallback = (value?: string): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = parseFanfouDate(value);
  if (parsed) {
    return parsed;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatJoinedAt = (value?: string) => {
  const date = parseDateWithFallback(value);
  if (!date) {
    return '';
  }
  try {
    // Use the app's current i18n locale so the month label follows the UI
    // language rather than the device locale (e.g. "Nov 2010" vs "2010年11月").
    return new Intl.DateTimeFormat(getIntlLocale(), {
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 7);
  }
};
