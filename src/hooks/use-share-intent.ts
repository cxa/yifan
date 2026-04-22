import { useEffect } from 'react';
import { AppState, Linking, NativeModules, Platform } from 'react-native';
import { setShareIntentPhoto, setShareIntentText } from '@/stores/share-intent-store';

const SHARE_IMAGE_SCHEME = 'yifan://share-image';
const SHARE_TEXT_SCHEME = 'yifan://share-text';

type SharedImageResult = {
  base64: string;
  mimeType: string;
  fileName: string;
  fileUrl?: string;
  livePhotoStaticFallback?: boolean;
};

type SharedImageModule = {
  readAndClear: (fileName: string) => Promise<string>;
  readAndClearPending: () => Promise<SharedImageResult | null>;
  readAndClearPendingText: () => Promise<string | null>;
  readDebugLog?: () => Promise<string | null>;
};

const getSharedImageModule = (): SharedImageModule | undefined =>
  NativeModules.SharedImageModule as SharedImageModule | undefined;

// iOS: check App Group container for a pending shared image.
async function checkIOSPending(): Promise<void> {
  const mod = getSharedImageModule();
  if (!mod) return;

  if (mod.readDebugLog) {
    try {
      const debugLog = await mod.readDebugLog();
      if (debugLog) {
        console.info(`[ShareExtension]\n${debugLog}`);
      }
    } catch {
      // Debug log is optional.
    }
  }

  // Check for pending image
  if (mod.readAndClearPending) {
    try {
      const result = await mod.readAndClearPending();
      if (result) {
        // The share extension converts Live Photos to GIF directly,
        // so we just use whatever file it saved (gif or jpg). When
        // the extension doesn't hand back a file URL we fall back to
        // a data URI — the native upload layer unpacks that format
        // so we never have to carry raw base64 in JS.
        const uri = result.fileUrl ?? `data:${result.mimeType};base64,${result.base64}`;
        setShareIntentPhoto({
          uri,
          mimeType: result.mimeType,
          fileName: result.fileName,
          livePhotoStaticFallback: result.livePhotoStaticFallback,
        });
        return;
      }
    } catch {
      // No pending image or read failed; ignore silently.
    }
  }

  // Check for pending text
  if (mod.readAndClearPendingText) {
    try {
      const text = await mod.readAndClearPendingText();
      if (text) {
        setShareIntentText(text);
      }
    } catch {
      // No pending text or read failed; ignore silently.
    }
  }
}

// Android: URL carries ?file=<path> copied to cache dir.
async function resolveAndroidShareURL(url: string): Promise<void> {
  if (url.startsWith(SHARE_IMAGE_SCHEME)) {
    try {
      const parsed = new URL(url);
      const filePath = parsed.searchParams.get('file');
      if (!filePath) return;
      // Hand the native upload layer a file:// URI directly so it can
      // stream off disk — no round-trip through base64 in JS.
      const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      setShareIntentPhoto({ uri, mimeType: 'image/jpeg', fileName: 'shared.jpg' });
    } catch {
      // Silently ignore; user can pick photo manually.
    }
    return;
  }

  if (url.startsWith(SHARE_TEXT_SCHEME)) {
    try {
      const parsed = new URL(url);
      const text = parsed.searchParams.get('text');
      if (text) {
        setShareIntentText(text);
      }
    } catch {
      // Silently ignore
    }
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
