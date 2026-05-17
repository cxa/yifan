import { NativeModules, Platform, Share } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { captureRef } from 'react-native-view-shot';

type ShareableRef = Parameters<typeof captureRef>[0];

export const shareCapturedImage = async (ref: ShareableRef): Promise<void> => {
  const tmpUri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  // captureRef returns a path on Android and a file:// URI on iOS; normalize
  // both to a bare path so the existing share pipeline (which expects a path
  // on Android and a file URI on iOS) keeps working.
  const filePath = tmpUri.startsWith('file://') ? tmpUri.slice(7) : tmpUri;
  const ext = 'png';
  const mimeType = 'image/png';
  const targetPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/share_status_card_${Date.now()}.${ext}`;

  // captureRef may write to a path the system share intent can't read; copy
  // into our own cache dir to mirror the photo-viewer share path semantics.
  await ReactNativeBlobUtil.fs.cp(filePath, targetPath);

  if (Platform.OS === 'android') {
    NativeModules.ShareFile.share(targetPath, mimeType);
    return;
  }

  try {
    await Share.share({ url: targetPath });
  } finally {
    ReactNativeBlobUtil.fs.unlink(targetPath).catch(() => undefined);
    ReactNativeBlobUtil.fs.unlink(filePath).catch(() => undefined);
  }
};
