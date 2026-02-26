import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useThemeColor } from 'heroui-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/app-text';
import {
  pickImageFromLibrary,
  type PickedImage,
} from '@/utils/pick-image-from-library';

export type ComposerModalSubmitPayload = {
  text: string;
  photo: PickedImage | null;
};

type ComposerModalProps = {
  visible: boolean;
  title: string;
  placeholder: string;
  submitLabel: string;
  topInset: number;
  initialText?: string;
  resetKey?: string | null;
  enablePhoto?: boolean;
  onCancel: () => void;
  onSubmit: (payload: ComposerModalSubmitPayload) => Promise<void> | void;
};

const ComposerModal = ({
  visible,
  title,
  placeholder,
  submitLabel,
  topInset,
  initialText = '',
  resetKey = null,
  enablePhoto = false,
  onCancel,
  onSubmit,
}: ComposerModalProps) => {
  const { t } = useTranslation();
  const [placeholderColor] = useThemeColor(['muted']);
  const [value, setValue] = useState(initialText);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [isPhotoPicking, setIsPhotoPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canDismiss = !isSubmitting && !isPhotoPicking;
  const containerStyle = useMemo(
    () => ({ marginTop: Math.max(topInset + 20, 40) }),
    [topInset],
  );
  const photoUri = photo?.uri ?? null;

  useEffect(() => {
    if (!visible) {
      return;
    }
    setValue(initialText);
    setPhoto(null);
    setIsPhotoPicking(false);
    setIsSubmitting(false);
  }, [initialText, resetKey, visible]);

  const handlePickPhoto = useCallback(async () => {
    if (!enablePhoto || !canDismiss) {
      return;
    }
    setIsPhotoPicking(true);
    try {
      const pickedPhoto = await pickImageFromLibrary();
      if (pickedPhoto) {
        setPhoto(pickedPhoto);
      }
    } catch (error) {
      Alert.alert(
        t('composerPhotoError'),
        error instanceof Error ? error.message : t('retryMessage'),
      );
    } finally {
      setIsPhotoPicking(false);
    }
  }, [canDismiss, enablePhoto, t]);

  const handleRemovePhoto = useCallback(() => {
    if (!canDismiss) {
      return;
    }
    setPhoto(null);
  }, [canDismiss]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || isPhotoPicking) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        text: value,
        photo,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isPhotoPicking, isSubmitting, onSubmit, photo, value]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <Pressable className="flex-1 bg-foreground/45 dark:bg-background/85 px-[18px] pb-6">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <Pressable
            onPress={event => event.stopPropagation()}
            className="border border-border bg-surface p-[14px] gap-[10px]"
            style={containerStyle}
          >
            <View className="flex-row items-center justify-between gap-3">
              <Text
                className="text-[22px] leading-[28px] font-semibold text-foreground"
                dynamicTypeRamp="title2"
              >
                {title}
              </Text>
              <Pressable
                onPress={canDismiss ? onCancel : undefined}
                className="border border-border bg-surface-secondary px-3 py-2"
                accessibilityRole="button"
                accessibilityLabel={t('composerCancel')}
              >
                <Text className="text-[13px] text-foreground">{t('composerCancel')}</Text>
              </Pressable>
            </View>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={placeholderColor}
              multiline
              autoFocus
              className="min-h-[120px] max-h-[260px] border border-border bg-surface-secondary px-2.5 py-2 text-[15px] text-foreground"
              editable={!isSubmitting}
            />

            {photoUri ? (
              <View className="overflow-hidden border border-border bg-surface-secondary">
                <Image
                  source={{ uri: photoUri }}
                  className="h-[180px] w-full bg-surface-secondary"
                  resizeMode="cover"
                />
              </View>
            ) : null}

            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <View className="flex-row gap-2">
                {enablePhoto ? (
                  <Pressable
                    onPress={
                      canDismiss && !isPhotoPicking
                        ? handlePickPhoto
                        : undefined
                    }
                    className="border border-border bg-surface-secondary px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={
                      photoUri ? t('composerChangePhoto') : t('composerAttachPhoto')
                    }
                  >
                    <Text className="text-[13px] text-foreground">
                      {isPhotoPicking
                        ? t('composerPickingPhoto')
                        : photoUri
                        ? t('composerChangePhoto')
                        : t('composerAttachPhoto')}
                    </Text>
                  </Pressable>
                ) : null}

                {photoUri ? (
                  <Pressable
                    onPress={canDismiss ? handleRemovePhoto : undefined}
                    className="border border-border bg-surface-secondary px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={t('composerRemovePhotoA11y')}
                  >
                    <Text className="text-[13px] text-foreground">{t('composerRemovePhoto')}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  onPress={!isSubmitting ? handleSubmit : undefined}
                  className="border border-border bg-accent px-3 py-2"
                  accessibilityRole="button"
                  accessibilityLabel={submitLabel}
                >
                  <Text className="text-[13px] text-accent-foreground">
                    {isSubmitting ? t('composerSending') : submitLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

export default ComposerModal;
