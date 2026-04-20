import { useEffect, useState } from 'react';
import ImageColors from 'react-native-image-colors';

// Shared caches so the same URL is only sampled once across the whole app
// (Profile and More can both request the same avatar/background image).
const memoryCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

const pickRepresentativeColor = async (url: string): Promise<string | null> => {
  try {
    const result = await ImageColors.getColors(url, {
      cache: true,
      key: url,
      quality: 'low',
    });
    if (result.platform === 'ios') {
      return result.background || result.primary || null;
    }
    if (result.platform === 'android') {
      return result.average || result.dominant || null;
    }
    return result.dominant || null;
  } catch {
    return null;
  }
};

const sampleOnce = (url: string): Promise<string | null> => {
  const cached = memoryCache.get(url);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = inflight.get(url);
  if (existing) return existing;
  const promise = pickRepresentativeColor(url).then(color => {
    memoryCache.set(url, color);
    inflight.delete(url);
    return color;
  });
  inflight.set(url, promise);
  return promise;
};

/**
 * Sample a representative hex color from a remote image URL so we can
 * pick a text color that contrasts with the image. Returns undefined
 * while the sample is in-flight or if sampling fails — callers should
 * fall back to a halo-based strategy during that window.
 */
export const useSampledBackgroundColor = (
  url: string | undefined,
): string | undefined => {
  const [color, setColor] = useState<string | undefined>(() => {
    if (!url) return undefined;
    const cached = memoryCache.get(url);
    return cached ?? undefined;
  });
  useEffect(() => {
    if (!url) {
      setColor(undefined);
      return;
    }
    const cached = memoryCache.get(url);
    if (cached !== undefined) {
      setColor(cached ?? undefined);
      return;
    }
    let cancelled = false;
    sampleOnce(url).then(next => {
      if (!cancelled && next) setColor(next);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return color;
};
