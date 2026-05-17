/**
 * Trim/null-normalize a Fanfou image URL. Previously also rewrote
 * `http://` to `https://` on Android — that was a regression: the photo
 * CDNs (photo1..4.fanfou.com) don't speak HTTPS at all, so the upgrade
 * killed the connection. The android/app cleartext config already
 * whitelists fanfou.com with includeSubdomains=true, so plain HTTP works.
 */
export const normalizeFanfouImageUrl = (
  url: string | null | undefined,
): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
};
