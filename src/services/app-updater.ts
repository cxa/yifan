import { Linking, NativeModules, Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import RNRestart from 'react-native-restart';

const CURRENT_VERSION: string = (require('../../package.json') as { version: string }).version;
const NATIVE_VERSION: string = (require('../../package.json') as { nativeVersion: string })
  .nativeVersion;

const GITHUB_OWNER = 'cxa';
const GITHUB_REPO = 'yifan';
const IOS_APP_ID = '541110403';
const IOS_APP_STORE_URL =
  'https://apps.apple.com/us/app/一饭-岁静饭否客户端/id541110403';

export type UpdateType = 'native' | 'js';

export type UpdateInfo = {
  version: string;
  updateType: UpdateType;
  /** Android APK download URL (native update only) */
  apkUrl?: string;
  /** JS bundle download URL (OTA update only) */
  bundleUrl?: string;
};

function isNewer(latest: string, current: string): boolean {
  const lParts = latest.split('.').map(p => parseInt(p, 10));
  const cParts = current.split('.').map(p => parseInt(p, 10));
  const len = Math.max(lParts.length, cParts.length);
  for (let i = 0; i < len; i++) {
    const l = lParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (l !== c) return l > c;
  }
  return false;
}

// Allows the manual "Check for Updates" button in settings to open AppUpdateDialog.
type UpdateFoundListener = (info: UpdateInfo) => void;
let updateFoundListener: UpdateFoundListener | null = null;

export const setUpdateFoundListener = (fn: UpdateFoundListener | null) => {
  updateFoundListener = fn;
};

export const notifyUpdateFound = (info: UpdateInfo) => {
  updateFoundListener?.(info);
};

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
    { headers: { Accept: 'application/vnd.github+json' } },
  );
  if (!res.ok) return null;

  const release: {
    tag_name: string;
    assets: { name: string; browser_download_url: string }[];
  } = await res.json();

  const latestVersion = release.tag_name.replace(/^v/, '');
  if (!isNewer(latestVersion, CURRENT_VERSION)) return null;

  // manifest.json declares minNativeVersion for this release.
  // Absent on older releases — treat as native update required for backward compat.
  const manifestAsset = release.assets.find(a => a.name === 'manifest.json');
  let needsNativeUpdate = true;
  if (manifestAsset) {
    const manifestRes = await fetch(manifestAsset.browser_download_url);
    if (manifestRes.ok) {
      const manifest: { minNativeVersion: string } = await manifestRes.json();
      needsNativeUpdate = isNewer(manifest.minNativeVersion, NATIVE_VERSION);
    }
  }

  if (needsNativeUpdate) {
    if (Platform.OS === 'ios') {
      // iOS: direct to App Store
      return { version: latestVersion, updateType: 'native' };
    }
    // Android: download APK
    const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));
    if (!apkAsset) return null;
    return { version: latestVersion, updateType: 'native', apkUrl: apkAsset.browser_download_url };
  }

  // JS-only OTA — find platform bundle (named yifan.{version}.ios/android.jsbundle)
  const bundleAsset = release.assets.find(a =>
    Platform.OS === 'ios'
      ? a.name.endsWith('.ios.jsbundle')
      : a.name.endsWith('.android.jsbundle'),
  );
  if (!bundleAsset) return null;

  return {
    version: latestVersion,
    updateType: 'js',
    bundleUrl: bundleAsset.browser_download_url,
  };
}

export async function openAppStore(): Promise<void> {
  const mod = NativeModules.AppStoreProductModule as
    | { show: (appId: string) => Promise<void> }
    | undefined;
  if (mod?.show) {
    try {
      await mod.show(IOS_APP_ID);
      return;
    } catch {
      // fall through to Linking (e.g. simulator, or app not in current storefront)
    }
  }
  await Linking.openURL(IOS_APP_STORE_URL);
}

export async function downloadAndInstall(
  apkUrl: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const destPath = `${RNBlobUtil.fs.dirs.CacheDir}/yifan-update.apk`;

  if (await RNBlobUtil.fs.exists(destPath)) {
    await RNBlobUtil.fs.unlink(destPath);
  }

  await RNBlobUtil.config({ path: destPath })
    .fetch('GET', apkUrl)
    .progress({ interval: 300 }, (received, total) => {
      const t = Number(total);
      if (t > 0) onProgress(Math.floor((Number(received) / t) * 100));
    });

  await RNBlobUtil.android.actionViewIntent(
    destPath,
    'application/vnd.android.package-archive',
  );
}

export async function downloadAndApplyOTA(
  bundleUrl: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const otaDir = `${RNBlobUtil.fs.dirs.DocumentDir}/ota`;
  const bundleFileName =
    Platform.OS === 'ios' ? 'main.jsbundle' : 'index.android.bundle';
  const bundlePath = `${otaDir}/${bundleFileName}`;
  const nativeVersionPath = `${otaDir}/native-version.txt`;

  if (!(await RNBlobUtil.fs.isDir(otaDir))) {
    await RNBlobUtil.fs.mkdir(otaDir);
  }

  if (await RNBlobUtil.fs.exists(bundlePath)) {
    await RNBlobUtil.fs.unlink(bundlePath);
  }

  await RNBlobUtil.config({ path: bundlePath })
    .fetch('GET', bundleUrl)
    .progress({ interval: 300 }, (received, total) => {
      const t = Number(total);
      if (t > 0) onProgress(Math.floor((Number(received) / t) * 100));
    });

  // Write native version marker so native code can detect stale bundles after a native upgrade
  await RNBlobUtil.fs.writeFile(nativeVersionPath, NATIVE_VERSION, 'utf8');

  RNRestart.restart();
}
