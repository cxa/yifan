import { launchImageLibrary } from 'react-native-image-picker';

export type PickedImage = {
  uri: string;
  base64: string;
};

const IMAGE_PICKER_OPTIONS = {
  mediaType: 'photo',
  selectionLimit: 1,
  includeBase64: true,
  quality: 1,
} as const;

export const pickImageFromLibrary = async (): Promise<PickedImage | null> => {
  const result = await launchImageLibrary(IMAGE_PICKER_OPTIONS);

  if (result.didCancel) {
    return null;
  }

  if (result.errorCode) {
    throw new Error(result.errorMessage ?? result.errorCode);
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    throw new Error('Unable to read selected photo.');
  }

  if (!asset.base64) {
    throw new Error('Selected photo is missing base64 data.');
  }

  return {
    uri: asset.uri,
    base64: asset.base64,
  };
};
