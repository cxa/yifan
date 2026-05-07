import { useSyncExternalStore } from 'react';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'app.hidden-statuses';
const USERNAME = 'hidden-status-ids';

type Listener = () => void;

const listeners = new Set<Listener>();
let hiddenIds: ReadonlySet<string> = new Set();
let hydrationPromise: Promise<void> | null = null;

const emitChange = () => {
  for (const listener of listeners) {
    listener();
  }
};

const persist = (next: ReadonlySet<string>) => {
  const payload = JSON.stringify(Array.from(next));
  Keychain.setGenericPassword(USERNAME, payload, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  }).catch(() => {
    // Best-effort persistence; in-memory state is already updated.
  });
};

const hydrate = async () => {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (!creds || !creds.password) {
      return;
    }
    const parsed = JSON.parse(creds.password) as unknown;
    if (!Array.isArray(parsed)) {
      return;
    }
    const ids = new Set<string>();
    for (const value of parsed) {
      if (typeof value === 'string' && value) {
        ids.add(value);
      }
    }
    if (ids.size > 0) {
      hiddenIds = ids;
      emitChange();
    }
  } catch {
    // Ignore hydration failures; user can re-report if needed.
  }
};

const ensureHydrated = () => {
  if (!hydrationPromise) {
    hydrationPromise = hydrate();
  }
};

export const subscribeToHiddenStatuses = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getHiddenStatusesSnapshot = (): ReadonlySet<string> => hiddenIds;

export const useHiddenStatuses = (): ReadonlySet<string> =>
  useSyncExternalStore(
    subscribeToHiddenStatuses,
    getHiddenStatusesSnapshot,
    getHiddenStatusesSnapshot,
  );

export const useFilterHiddenStatuses = <T extends { id: string }>(
  items: T[],
): T[] => {
  const hidden = useHiddenStatuses();
  if (hidden.size === 0) {
    return items;
  }
  return items.filter(item => !hidden.has(item.id));
};

export const addHiddenStatus = (statusId: string) => {
  if (!statusId || hiddenIds.has(statusId)) {
    return;
  }
  const next = new Set(hiddenIds);
  next.add(statusId);
  hiddenIds = next;
  emitChange();
  persist(next);
};

ensureHydrated();
