/**
 * Android's URL parser treats '@' as a user-info separator in the authority,
 * so CDN URLs like '...jpg@100w_100h_1l.jpg' fail to load on Android.
 * This encodes '@' only in the path portion (after the host).
 */
export function fixImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const pathStart = url.indexOf('/', url.indexOf('//') + 2);
  if (pathStart === -1) return url;
  return url.slice(0, pathStart) + url.slice(pathStart).replace(/@/g, '%40');
}
