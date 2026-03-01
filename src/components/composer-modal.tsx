import React, { useEffect, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { ImagePlus, X } from 'lucide-react-native';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useThemeColor } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '@/components/app-text';
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
  isSubmitting?: boolean;
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
  isSubmitting: controlledIsSubmitting,
  onCancel,
  onSubmit,
}: ComposerModalProps) => {
  const { t } = useTranslation();
  const [placeholderColor, foreground, danger] = useThemeColor([
    'muted',
    'foreground',
    'danger',
  ]);
  const [value, setValue] = useState(initialText);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [isPhotoPicking, setIsPhotoPicking] = useState(false);
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const isSubmitting = controlledIsSubmitting ?? internalIsSubmitting;
  const canDismiss = !isSubmitting && !isPhotoPicking;
  const containerStyle = {
    marginTop: Math.max(topInset + 10, 24),
  };
  const photoUri = photo?.uri ?? null;
  useEffect(() => {
    if (!visible) {
      return;
    }
    setValue(initialText);
    setPhoto(null);
    setIsPhotoPicking(false);
    setInternalIsSubmitting(false);
  }, [initialText, resetKey, visible]);
  const handlePickPhoto = async () => {
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
      showVariantToast(
        'danger',
        t('composerPhotoError'),
        error instanceof Error ? error.message : t('retryMessage'),
      );
    } finally {
      setIsPhotoPicking(false);
    }
  };
  const handleRemovePhoto = () => {
    if (!canDismiss) {
      return;
    }
    setPhoto(null);
  };
  const handleSubmit = async () => {
    if (isSubmitting || isPhotoPicking) {
      return;
    }
    if (controlledIsSubmitting !== undefined) {
      await onSubmit({
        text: value,
        photo,
      });
      return;
    }
    setInternalIsSubmitting(true);
    try {
      await onSubmit({
        text: value,
        photo,
      });
    } finally {
      setInternalIsSubmitting(false);
    }
  };
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
            className="relative border-4 border-border bg-surface p-[14px] gap-[10px]"
            style={containerStyle}
          >
            <Pressable
              onPress={canDismiss ? onCancel : undefined}
              className="absolute right-[2px] top-[2px] z-10 h-9 w-9 items-center justify-center"
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('composerCancel')}
            >
              <X size={18} color={danger} />
            </Pressable>
            <View className="flex-row items-center gap-3 pr-10">
              <Text
                className="flex-1 text-[22px] leading-[28px] font-semibold text-foreground"
                dynamicTypeRamp="title2"
              >
                {title}
              </Text>
            </View>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={placeholderColor}
              multiline
              textAlignVertical="top"
              autoFocus
              className="min-h-[120px] max-h-[260px] border-2 border-border bg-surface-secondary px-2.5 py-2 text-[15px] text-foreground"
              style={
                Platform.OS === 'android' ? styles.textInputAndroid : undefined
              }
              editable={!isSubmitting}
            />

            {photoUri ? (
              <View className="overflow-hidden border-2 border-border bg-surface-secondary">
                <Image
                  source={{
                    uri: photoUri,
                  }}
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
                    className={`w-10 items-center justify-center border-2 border-border bg-surface-secondary py-2 ${
                      isPhotoPicking ? 'opacity-60' : ''
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      photoUri
                        ? t('composerChangePhoto')
                        : t('composerAttachPhoto')
                    }
                  >
                    <ImagePlus size={18} color={foreground} />
                  </Pressable>
                ) : null}

                {photoUri ? (
                  <Pressable
                    onPress={canDismiss ? handleRemovePhoto : undefined}
                    className="border-2 border-border bg-surface-secondary px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={t('composerRemovePhotoA11y')}
                  >
                    <Text className="text-[13px] text-foreground">
                      {t('composerRemovePhoto')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  onPress={!isSubmitting ? handleSubmit : undefined}
                  className="min-w-[120px] items-center border-2 border-border bg-accent px-5 py-2"
                  accessibilityRole="button"
                  accessibilityLabel={submitLabel}
                >
                  <Text className="text-[13px] font-semibold text-accent-foreground">
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

const styles = StyleSheet.create({
  textInputAndroid: {
    includeFontPadding: false,
  },
});

export default ComposerModal;
