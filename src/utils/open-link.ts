import { Alert, Linking } from 'react-native';

const URL_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

export const normalizeLinkUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('/')) {
    return `https://fanfou.com${trimmed}`;
  }
  if (URL_SCHEME_REGEX.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const openLink = async (value: string) => {
  const normalizedUrl = normalizeLinkUrl(value);
  if (!normalizedUrl) {
    return;
  }
  try {
    const canOpen = await Linking.canOpenURL(normalizedUrl);
    if (!canOpen) {
      Alert.alert('Unable to open link', normalizedUrl);
      return;
    }
    await Linking.openURL(normalizedUrl);
  } catch {
    Alert.alert('Unable to open link', normalizedUrl);
  }
};
