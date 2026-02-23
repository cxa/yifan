import { Platform } from 'react-native';

const IOS_NATIVE_SCROLL_EDGE_MIN_VERSION = 26;

const parseIOSMajorVersion = (value: string | number) => {
  if (typeof value === 'number') {
    return value;
  }
  const major = Number(value.split('.')[0]);
  return Number.isFinite(major) ? major : 0;
};

export const isNativeScrollEdgeEffectAvailable =
  Platform.OS === 'ios' &&
  parseIOSMajorVersion(Platform.Version) >= IOS_NATIVE_SCROLL_EDGE_MIN_VERSION;
