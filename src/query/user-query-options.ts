import { queryOptions } from '@tanstack/react-query';
import { pinyin } from 'pinyin-pro';
import { get } from '@/auth/fanfou-client';
import type { FanfouUser } from '@/types/fanfou';

// FanfouUser augmented with pre-computed pinyin so matchesMentionNeedle avoids
// calling getPinyin on every keystroke (once per ~6 000 users = visible lag).
// Built by `select` in friendsListQueryOptions — runs once on data load, not
// on every render or keystroke.
export type IndexedUser = FanfouUser & {
  readonly _pinyinSyllables: readonly string[]; // ["guo","xiao","pang","pang"]
  readonly _pinyinInitials: string;             // "gxpp"
};

export const indexUser = (user: FanfouUser): IndexedUser => {
  const name = user.name || user.screen_name || '';
  if (!name) {
    return { ...user, _pinyinSyllables: [], _pinyinInitials: '' };
  }
  const syllables = pinyin(name, { toneType: 'none', separator: ' ' })
    .toLowerCase()
    .split(' ')
    .filter((s): s is string => s.length > 0);
  return {
    ...user,
    _pinyinSyllables: syllables,
    _pinyinInitials: syllables.map((s: string) => s[0] ?? '').join(''),
  };
};

export const userQueryKeys = {
  account: (userId: string) => ['account', userId] as const,
  profile: (userId: string) => ['profile', 'user', userId] as const,
  headerOwner: (userId: string) => ['header-owner', userId] as const,
  friendsList: (userId: string) => ['friends-list', userId] as const,
  mentionSearch: (q: string) => ['mention-search', q] as const,
};

const fetchUserById = async (userId: string): Promise<FanfouUser> =>
  get('/users/show', {
    id: userId,
  }) as Promise<FanfouUser>;

export const accountUserQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: userQueryKeys.account(userId),
    queryFn: () => fetchUserById(userId),
  });

export const profileUserQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: userQueryKeys.profile(userId),
    queryFn: () => fetchUserById(userId),
  });

export const headerOwnerUserQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: userQueryKeys.headerOwner(userId),
    queryFn: () => fetchUserById(userId),
  });

// Fanfou silently caps per-page results at ~60 regardless of the requested
// count. The safety cap guards against runaway loops; 100 pages × 60 = 6 000
// users max per endpoint, well above any realistic social graph.
const FRIENDS_PAGE_SIZE = 60;
const FRIENDS_MAX_PAGES = 100;
// Fetch this many pages in parallel per batch. Cuts the crawl from 2-4 min
// (sequential) down to ~20-30 s while staying well under Fanfou rate limits.
const FRIENDS_BATCH_SIZE = 5;

const fetchOnePage = async (
  endpoint: string,
  userId: string,
  page: number,
): Promise<FanfouUser[]> => {
  try {
    const res = (await get(endpoint, {
      id: userId,
      count: FRIENDS_PAGE_SIZE,
      page,
    })) as FanfouUser[];
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
};

const fetchAllPages = async (
  endpoint: string,
  userId: string,
): Promise<FanfouUser[]> => {
  const all: FanfouUser[] = [];
  for (let batchStart = 1; batchStart <= FRIENDS_MAX_PAGES; batchStart += FRIENDS_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + FRIENDS_BATCH_SIZE - 1, FRIENDS_MAX_PAGES);
    const pageNums = Array.from(
      { length: batchEnd - batchStart + 1 },
      (_, i) => batchStart + i,
    );
    const results = await Promise.all(
      pageNums.map(page => fetchOnePage(endpoint, userId, page)),
    );
    let hitEnd = false;
    for (const pageItems of results) {
      if (pageItems.length === 0) {
        hitEnd = true;
        break;
      }
      all.push(...pageItems);
    }
    if (hitEnd) break;
  }
  return all;
};

// Mirrors fanfou.com's home.ac_friends behaviour: merge following + followers
// so @-mention autocomplete covers both directions of the relationship.
// Followers-only users (people who follow you but you don't follow back) are
// appended after following so the following list sorts first in the UI.
const fetchAllContacts = async (userId: string): Promise<FanfouUser[]> => {
  const [following, followers] = await Promise.all([
    fetchAllPages('/users/friends', userId),
    fetchAllPages('/users/followers', userId),
  ]);
  const seen = new Set(following.map(u => u.id));
  const extra = followers.filter(u => !seen.has(u.id));
  return [...following, ...extra];
};

// `/search/users` returns `{ total_number, users: [...] }`.
// mode=default is required to get full user objects (same as public_timeline search).
const fetchMentionSearch = async (q: string): Promise<FanfouUser[]> => {
  const res = await get('/search/users', { q, count: 20, mode: 'default' });
  // Defensive: handle both the documented object shape and an accidental array.
  if (Array.isArray(res)) {
    return res as FanfouUser[];
  }
  const typed = res as { total_number: number; users?: FanfouUser[] };
  return typed.users ?? [];
};

export const mentionSearchQueryOptions = (q: string) =>
  queryOptions({
    queryKey: userQueryKeys.mentionSearch(q),
    queryFn: () => fetchMentionSearch(q),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

// Cached aggressively because the follow list rarely changes mid-session
// and the composer needs the full set for autocomplete. staleTime keeps
// the cache fresh-enough that repeated composer opens reuse it; gcTime
// keeps it around even when the composer is closed and no observer
// holds the query.
export const friendsListQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: userQueryKeys.friendsList(userId),
    queryFn: () => fetchAllContacts(userId),
    // Build the pinyin index once when the data arrives (or is rehydrated from
    // AsyncStorage). select is memoized by TanStack Query — it only reruns
    // when the raw FanfouUser[] changes, not on every render.
    select: (data): IndexedUser[] => data.map(indexUser),
    // Concurrent batch fetch takes ~20-30 s; stale after 4 h so the
    // crawl only runs a few times per day across sessions.
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
