import type { IndexedUser } from '@/query/user-query-options';

// Match a user against a lowercase needle using pre-computed pinyin syllables
// (built once when the friends list loads) so no dictionary lookups occur on
// each keystroke. Handles:
//   1. Substring match on id / display name  (ASCII logins, CJK display names)
//   2. Syllable-prefix match on pinyin       ("wan" → 万, "guo" → 郭)
//   3. Initials abbreviation match           ("gxpp" → 郭小胖胖)
export const matchesMentionNeedle = (
  user: IndexedUser,
  needle: string,
): boolean => {
  if (user.id?.toLowerCase().includes(needle)) return true;
  const name = (user.name || user.screen_name || '').toLowerCase();
  if (name.includes(needle)) return true;
  if (user._pinyinSyllables.some(syl => syl.startsWith(needle))) return true;
  return user._pinyinInitials.startsWith(needle);
};

// Lower score = higher priority. Direct handle matches surface before pinyin
// matches (e.g. "wanhuai" for needle "wan" ranks above "守望者").
export const scoreMentionUser = (user: IndexedUser, needle: string): number => {
  const id = user.id?.toLowerCase() ?? '';
  const display = (user.name || user.screen_name || '').toLowerCase();
  if (id.startsWith(needle)) return 0;
  if (id.includes(needle)) return 1;
  if (display.startsWith(needle)) return 2;
  if (display.includes(needle)) return 3;
  return 4; // pinyin-only match
};
