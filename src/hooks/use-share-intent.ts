import { useEffect } from 'react';
import { AppState, Linking, NativeModules, Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { setShareIntentPhoto } from '@/stores/share-intent-store';

const SHARE_SCHEME = 'yifan://share-image';

type SharedImageModule = {
  readAndClear: (fileName: string) => Promise<string>;
  readAndClearPending: () => Promise<string | null>;
};

const getSharedImageModule = (): SharedImageModule | undefined =>
  NativeModules.SharedImageModule as SharedImageModule | undefined;

// iOS: check App Group container for a pending shared image.
async function checkIOSPending(): Promise<void> {
  const mod = getSharedImageModule();
  if (!mod?.readAndClearPending) return;
  try {
    const base64 = await mod.readAndClearPending();
    if (!base64) return;
    const uri = `data:image/jpeg;base64,${base64}`;
    setShareIntentPhoto({ uri, base64 });
  } catch {
    // No pending image or read failed — ignore silently
  }
}

// Android: URL carries ?file=<path> copied to cache dir.
async function resolveAndroidShareURL(url: string): Promise<void> {
  if (!url.startsWith(SHARE_SCHEME)) return;
  try {
    const parsed = new URL(url);
    const filePath = parsed.searchParams.get('file');
    if (!filePath) return;
    const base64 = await RNBlobUtil.fs.readFile(filePath, 'base64');
    const uri = `data:image/jpeg;base64,${base64}`;
    // Clean up cache file after reading
    RNBlobUtil.fs.unlink(filePath).catch(() => {});
    setShareIntentPhoto({ uri, base64 });
  } catch {
    // Silently ignore — user can pick photo manually
  }
}

export const useShareIntent = () => {
  useEffect(() => {
    if (Platform.OS === 'ios') {
      // Check once on mount (cold start or already foregrounded)
      checkIOSPending();

      // Re-check every time the app comes to the foreground
      const sub = AppState.addEventListener('change', state => {
        if (state === 'active') {
          checkIOSPending();
        }
      });
      return () => sub.remove();
    } else {
      // Android: listen to yifan:// deep links
      Linking.getInitialURL().then(url => {
        if (url) resolveAndroidShareURL(url).catch(() => {});
      });

      const sub = Linking.addEventListener('url', ({ url }) => {
        resolveAndroidShareURL(url).catch(() => {});
      });
      return () => sub.remove();
    }
  }, []);
};
