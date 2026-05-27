import { match as pinyinMatch } from 'pinyin-pro';
import type { FanfouUser } from '@/types/fanfou';

// Match a user against a lowercase needle, checking:
//   1. Substring match on id / screen_name / name (covers ASCII logins)
//   2. Pinyin prefix match on display names (covers Chinese names, e.g. "wan" → 万, "gxpp" → 郭小胖胖)
export const matchesMentionNeedle = (
  user: FanfouUser,
  needle: string,
): boolean => {
  // unique_id is an opaque internal Fanfou ID (~XYRzI14C2g0), not the @handle.
  // id = login handle, screen_name = display name (same as name on Fanfou).
  const fields = [user.id, user.screen_name, user.name];
  return fields.some(field => {
    if (!field) {
      return false;
    }
    if (field.toLowerCase().includes(needle)) {
      return true;
    }
    return pinyinMatch(field, needle, { precision: 'start' }) !== null;
  });
};

// Lower score = higher priority. Used to sort suggestions so direct handle
// matches (e.g. "wanhuai" for needle "wan") surface before pinyin matches
// (e.g. "守望者" whose pinyin starts with "wang").
export const scoreMentionUser = (user: FanfouUser, needle: string): number => {
  const id = user.id?.toLowerCase() ?? '';
  const display = (user.name || user.screen_name || '').toLowerCase();
  if (id.startsWith(needle)) return 0;
  if (id.includes(needle)) return 1;
  if (display.startsWith(needle)) return 2;
  if (display.includes(needle)) return 3;
  return 4; // pinyin-only match
};
