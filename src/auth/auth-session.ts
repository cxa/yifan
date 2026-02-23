import { useSyncExternalStore } from 'react';

import { setFanfouAccessToken } from '@/auth/fanfou-client';
import {
  loadAuthAccessToken,
  type AuthAccessToken,
} from '@/auth/secure-token-storage';

export type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthSnapshot = {
  status: AuthState;
  accessToken: AuthAccessToken | null;
};

type Listener = () => void;

const listeners = new Set<Listener>();
let snapshot: AuthSnapshot = { status: 'loading', accessToken: null };
let hydrationPromise: Promise<void> | null = null;

const emitChange = () => {
  listeners.forEach(listener => listener());
};

const setSnapshot = (next: AuthSnapshot) => {
  snapshot = next;
  emitChange();
};

const hydrateAuth = async () => {
  try {
    const accessToken = await loadAuthAccessToken();
    if (!accessToken) {
      setFanfouAccessToken(null);
      setSnapshot({ status: 'unauthenticated', accessToken: null });
      return;
    }

    setFanfouAccessToken(accessToken);
    setSnapshot({
      status: 'authenticated',
      accessToken,
    });
  } catch {
    setFanfouAccessToken(null);
    setSnapshot({ status: 'unauthenticated', accessToken: null });
  }
};

const ensureHydrated = () => {
  if (!hydrationPromise) {
    hydrationPromise = hydrateAuth();
  }
};

export const subscribeToAuth = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAuthSnapshot = () => snapshot;

export const useAuthSession = () =>
  useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getAuthSnapshot);

export const setAuthAccessToken = (accessToken: AuthAccessToken | null) => {
  setFanfouAccessToken(accessToken);
  setSnapshot({
    status: accessToken ? 'authenticated' : 'unauthenticated',
    accessToken,
  });
};

export const refreshAuthSession = () => {
  hydrationPromise = null;
  ensureHydrated();
};

ensureHydrated();
