import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { FanfouStatus } from '@/types/fanfou';

/**
 * Event scope:
 * - `'home'`  — only the home feed should react (unfollow)
 * - `'all'`   — every timeline should react (block)
 */
type FilterScope = 'home' | 'all';
type UserFilteredListener = (userId: string, scope: FilterScope) => void;
const userFilteredListeners = new Set<UserFilteredListener>();

const emitUserFiltered = (userId: string, scope: FilterScope) => {
  for (const listener of userFilteredListeners) {
    listener(userId, scope);
  }
};

/**
 * Subscribe a local `FanfouStatus[]` state setter so it immediately
 * removes statuses from a user that was just blocked / unfollowed.
 *
 * @param timeline — `'home'` reacts to both home-scoped and all-scoped events;
 *                    any other value reacts only to all-scoped events (block).
 */
export const useUserFilterEffect = (
  setter: Dispatch<SetStateAction<FanfouStatus[]>>,
  timeline: 'home' | 'other' = 'other',
) => {
  useEffect(() => {
    const listener: UserFilteredListener = (userId, scope) => {
      if (scope === 'home' && timeline !== 'home') {
        return;
      }
      setter(prev => prev.filter(s => s.user?.id !== userId));
    };
    userFilteredListeners.add(listener);
    return () => {
      userFilteredListeners.delete(listener);
    };
  }, [setter, timeline]);
};

const isStatusRelatedQueryKey = (queryKey: QueryKey) => {
  if (queryKey.length === 0) {
    return false;
  }

  const [root, scope] = queryKey;
  if (root === 'timeline') {
    return true;
  }
  if (root === 'my-timeline' || root === 'favorites' || root === 'photos') {
    return true;
  }
  if (root === 'profile' && scope === 'recent-statuses') {
    return true;
  }
  if (root === 'status' && (scope === 'detail' || scope === 'context')) {
    return true;
  }
  return false;
};

const isStatusArray = (data: unknown): data is FanfouStatus[] =>
  Array.isArray(data) &&
  (data.length === 0 || (data[0] != null && typeof data[0] === 'object' && 'user' in data[0]));

const filterStatuses = (
  statuses: FanfouStatus[],
  userId: string,
): FanfouStatus[] => statuses.filter(s => s.user?.id !== userId);

/**
 * Filter infinite-query caches (`{ pages, pageParams }`) that render
 * directly from query data (favorites, my-timeline, photos).
 * Regular-query screens use local state and are handled by the event.
 */
const filterInfiniteQueryCaches = (
  queryClient: QueryClient,
  userId: string,
) => {
  const cache = queryClient.getQueryCache();
  for (const query of cache.getAll()) {
    if (!isStatusRelatedQueryKey(query.queryKey)) {
      continue;
    }
    const data = query.state.data;
    if (
      data == null ||
      typeof data !== 'object' ||
      !('pages' in data) ||
      !Array.isArray((data as { pages: unknown[] }).pages)
    ) {
      continue;
    }
    const infiniteData = data as { pages: unknown[]; pageParams: unknown[] };
    let changed = false;
    const nextPages = infiniteData.pages.map(page => {
      if (!isStatusArray(page)) {
        return page;
      }
      const filtered = filterStatuses(page, userId);
      if (filtered.length !== page.length) {
        changed = true;
      }
      return filtered;
    });
    if (changed) {
      queryClient.setQueryData(query.queryKey, {
        ...infiniteData,
        pages: nextPages,
      });
    }
  }
};

/**
 * Block: remove the user from every timeline cache + local state.
 */
export const filterBlockedUserFromCaches = (
  queryClient: QueryClient,
  userId: string,
) => {
  filterInfiniteQueryCaches(queryClient, userId);
  emitUserFiltered(userId, 'all');
};

type StatusFilteredListener = (statusId: string) => void;
const statusFilteredListeners = new Set<StatusFilteredListener>();

const emitStatusFiltered = (statusId: string) => {
  for (const listener of statusFilteredListeners) {
    listener(statusId);
  }
};

/**
 * Subscribe a local `FanfouStatus[]` state setter so it immediately
 * removes a status that was just hidden (e.g. reported in review mode).
 */
export const useStatusFilterEffect = (
  setter: Dispatch<SetStateAction<FanfouStatus[]>>,
) => {
  useEffect(() => {
    const listener: StatusFilteredListener = statusId => {
      setter(prev => prev.filter(s => s.id !== statusId));
    };
    statusFilteredListeners.add(listener);
    return () => {
      statusFilteredListeners.delete(listener);
    };
  }, [setter]);
};

const filterStatusesById = (
  statuses: FanfouStatus[],
  statusId: string,
): FanfouStatus[] => statuses.filter(s => s.id !== statusId);

const filterInfiniteQueryCachesById = (
  queryClient: QueryClient,
  statusId: string,
) => {
  const cache = queryClient.getQueryCache();
  for (const query of cache.getAll()) {
    if (!isStatusRelatedQueryKey(query.queryKey)) {
      continue;
    }
    const data = query.state.data;
    if (
      data == null ||
      typeof data !== 'object' ||
      !('pages' in data) ||
      !Array.isArray((data as { pages: unknown[] }).pages)
    ) {
      continue;
    }
    const infiniteData = data as { pages: unknown[]; pageParams: unknown[] };
    let changed = false;
    const nextPages = infiniteData.pages.map(page => {
      if (!isStatusArray(page)) {
        return page;
      }
      const filtered = filterStatusesById(page, statusId);
      if (filtered.length !== page.length) {
        changed = true;
      }
      return filtered;
    });
    if (changed) {
      queryClient.setQueryData(query.queryKey, {
        ...infiniteData,
        pages: nextPages,
      });
    }
  }
};

/**
 * Hide a single status from every timeline cache + local state.
 * Used by the in-app Report flow (review mode).
 */
export const filterHiddenStatusFromCaches = (
  queryClient: QueryClient,
  statusId: string,
) => {
  filterInfiniteQueryCachesById(queryClient, statusId);
  emitStatusFiltered(statusId);
};

/**
 * Unfollow: remove the user only from the home feed local state.
 * Other timelines (public, mentions, search, tags) are unaffected.
 */
export const filterUnfollowedUserFromHome = (userId: string) => {
  emitUserFiltered(userId, 'home');
};

export const invalidateStatusRelatedQueries = async (
  queryClient: QueryClient,
) => {
  await queryClient.invalidateQueries({
    predicate: query => isStatusRelatedQueryKey(query.queryKey),
  });
};

export const refetchStatusRelatedQueries = async (
  queryClient: QueryClient,
) => {
  await queryClient.refetchQueries({
    predicate: query => isStatusRelatedQueryKey(query.queryKey),
  });
};
