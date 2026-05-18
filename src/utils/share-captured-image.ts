import { NativeModules, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import type { PickedImage } from '@/utils/pick-image-from-library';

type ShareableRef = Parameters<typeof captureRef>[0];
export const YIFAN_SHARE_EXTENSION_ACTIVITY_TYPE = 'im.cxa.fanatter.share';

export type ShareCapturedImageResult = {
  action: string;
  activityType?: string | null;
  localPhoto: PickedImage | null;
};

const IOS_SHARED_FILE_CLEANUP_DELAY_MS = 60_000;

type SharedImageModule = {
  sharedContainerPath?: () => Promise<string | null>;
  shareStatusCardImage?: (fileUrl: string) => Promise<{
    action: string;
    activityType?: string | null;
  }>;
};

const getSharedImageModule = (): SharedImageModule | undefined =>
  NativeModules.SharedImageModule as SharedImageModule | undefined;

const deleteFileQuietly = (path: string) => {
  ReactNativeBlobUtil.fs.unlink(path).catch(() => undefined);
};

const releaseCapturedTempFile = (tmpUri: string, filePath: string) => {
  releaseCapture(filePath);
  if (tmpUri !== filePath) {
    releaseCapture(tmpUri);
  }
  deleteFileQuietly(filePath);
};

const scheduleIOSSharedFileCleanup = (path: string) => {
  setTimeout(() => {
    deleteFileQuietly(path);
  }, IOS_SHARED_FILE_CLEANUP_DELAY_MS);
};

const getShareTargetPath = async (fileName: string) => {
  if (Platform.OS !== 'ios') {
    return `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
  }

  try {
    const sharedContainerPath = await getSharedImageModule()?.sharedContainerPath?.();
    if (sharedContainerPath) {
      return `${sharedContainerPath.replace(/\/+$/, '')}/${fileName}`;
    }
  } catch {
    // Fall back to cache dir; external share targets can still consume it.
  }
  return `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
};

export const captureShareCardImage = async (
  ref: ShareableRef,
): Promise<PickedImage> => {
  const tmpUri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    // Route iOS through CALayer.renderInContext: instead of
    // drawViewHierarchyInRect. Both target the same view, but the
    // latter renders backgroundColor as a full rectangle ignoring
    // cornerRadius — so the exported PNG comes out as an opaque
    // pastel block even when corners are rounded, and reposting the
    // card into the timeline shows the bleed past its rounded shape.
    // renderInContext honors cornerRadius for the layer's own fill.
    // Trade-off: no CAGradientLayer / no scroll-content expansion,
    // neither of which the share card uses.
    useRenderInContext: true,
  });

  // captureRef returns a path on Android and a file:// URI on iOS; normalize
  // both to a bare path so the existing share pipeline (which expects a path
  // on Android and a file URI on iOS) keeps working.
  const filePath = tmpUri.startsWith('file://') ? tmpUri.slice(7) : tmpUri;
  const ext = 'png';
  const mimeType = 'image/png';
  const fileName = `share_status_card_${Date.now()}.${ext}`;
  const targetPath = await getShareTargetPath(fileName);

  // captureRef may write to a path the share extension can't read. On iOS,
  // copy into the App Group so the app's own extension can consume it.
  try {
    await ReactNativeBlobUtil.fs.cp(filePath, targetPath);
  } finally {
    releaseCapturedTempFile(tmpUri, filePath);
  }

  const shareUrl = targetPath.startsWith('file://')
    ? targetPath
    : `file://${targetPath}`;
  return {
    uri: shareUrl,
    mimeType,
    fileName,
  };
};

export const shareCapturedImage = async (
  ref: ShareableRef,
): Promise<ShareCapturedImageResult> => {
  const localPhoto = await captureShareCardImage(ref);

  if (Platform.OS === 'android') {
    NativeModules.ShareFile.share(
      localPhoto.uri.replace(/^file:\/\//, ''),
      localPhoto.mimeType,
    );
    return { action: 'sharedAction', localPhoto: null };
  }

  try {
    const result =
      await getSharedImageModule()?.shareStatusCardImage?.(localPhoto.uri);
    if (!result) {
      throw new Error('Status card sharing is unavailable.');
    }
    return { ...result, localPhoto };
  } finally {
    // The selected share extension may still be resolving the item provider
    // when the share promise settles. Keep the copied cache file around long
    // enough for the extension to read it, then clean it opportunistically.
    scheduleIOSSharedFileCleanup(localPhoto.uri.replace(/^file:\/\//, ''));
  }
};
