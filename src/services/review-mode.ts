import { useSyncExternalStore } from 'react';

const CURRENT_VERSION: string = (require('../../package.json') as { version: string }).version;
const IOS_APP_ID = '541110403';

// Review mode is ON when the locally-running build is *newer than* the
// version currently published on the App Store — i.e. this build is the
// one Apple App Review is looking at, before approval. It silently turns
// itself OFF for every shipped user the moment Apple approves the build,
// because at that point the iTunes lookup will report the same version.
//
// On all non-iOS platforms this is always false (Apple is the only
// gatekeeper that needs the review-mode UI). The check is best-effort:
// network failure → assume false, so we don't accidentally show
// review-only UI to real users on a flaky connection.
type Listener = () => void;

const listeners = new Set<Listener>();
let inReviewMode = false;
let hydrated = false;

const emitChange = () => {
  for (const listener of listeners) {
    listener();
  }
};

const compareVersions = (a: string, b: string): number => {
  const aParts = a.split('.').map(p => parseInt(p, 10) || 0);
  const bParts = b.split('.').map(p => parseInt(p, 10) || 0);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ap = aParts[i] ?? 0;
    const bp = bParts[i] ?? 0;
    if (ap !== bp) {
      return ap - bp;
    }
  }
  return 0;
};

const detectReviewMode = async (): Promise<void> => {
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${IOS_APP_ID}`);
    if (!res.ok) {
      return;
    }
    const data: { results?: { version?: string }[] } = await res.json();
    const storeVersion = data.results?.[0]?.version;
    if (!storeVersion) {
      // Bundle id not on the Store yet — treat that as review mode too.
      inReviewMode = true;
      emitChange();
      return;
    }
    if (compareVersions(CURRENT_VERSION, storeVersion) > 0) {
      inReviewMode = true;
      emitChange();
    }
  } catch {
    // Network blocked / DNS down — leave inReviewMode at false so we
    // don't expose review-only UI to real users.
  }
};

const ensureHydrated = () => {
  if (hydrated) {
    return;
  }
  hydrated = true;
  detectReviewMode().catch(() => undefined);
};

export const subscribeToReviewMode = (listener: Listener) => {
  listeners.add(listener);
  ensureHydrated();
  return () => listeners.delete(listener);
};

export const getReviewModeSnapshot = () => inReviewMode;

export const useReviewMode = () =>
  useSyncExternalStore(
    subscribeToReviewMode,
    getReviewModeSnapshot,
    getReviewModeSnapshot,
  );
