import React, { useEffect, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { ImagePlus, X } from 'lucide-react-native';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export type ComposerQuotedStatus = {
  screenName: string;
  plainText: string;
  photoUrl: string | null;
};

type ComposerModalProps = {
  visible: boolean;
  title: string;
  placeholder: string;
  submitLabel: string;
  initialText?: string;
  initialPhoto?: PickedImage | null;
  quotedStatus?: ComposerQuotedStatus | null;
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
  initialText = '',
  initialPhoto = null,
  quotedStatus = null,
  resetKey = null,
  enablePhoto = false,
  isSubmitting: controlledIsSubmitting,
  onCancel,
  onSubmit,
}: ComposerModalProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [placeholderColor, foreground, muted, border] = useThemeColor([
    'muted',
    'foreground',
    'muted',
    'border',
  ]);
  const [value, setValue] = useState(initialText);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [isPhotoPicking, setIsPhotoPicking] = useState(false);
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const [quotedPhotoFailed, setQuotedPhotoFailed] = useState(false);
  const isSubmitting = controlledIsSubmitting ?? internalIsSubmitting;
  const canDismiss = !isSubmitting && !isPhotoPicking;
  const photoUri = photo?.uri ?? null;

  useEffect(() => {
    if (!visible) {
      return;
    }
    setValue(initialText);
    setPhoto(initialPhoto ?? null);
    setIsPhotoPicking(false);
    setInternalIsSubmitting(false);
    setQuotedPhotoFailed(false);
  }, [initialText, initialPhoto, resetKey, visible]);

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
      await onSubmit({ text: value, photo });
      return;
    }
    setInternalIsSubmitting(true);
    try {
      await onSubmit({ text: value, photo });
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => canDismiss && onCancel()}
    >
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center gap-2 px-4 py-3">
            <Pressable
              onPress={canDismiss ? onCancel : undefined}
              className="items-center justify-center rounded-full p-1"
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('composerCancel')}
            >
              <X size={20} color={muted} />
            </Pressable>
            <Text
              className="flex-1 text-center text-[16px] font-semibold text-foreground"
              numberOfLines={1}
            >
              {title}
            </Text>
            <Pressable
              onPress={!isSubmitting ? handleSubmit : undefined}
              className={`items-center rounded-full bg-accent px-5 py-2 ${isSubmitting ? 'opacity-70' : ''}`}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
            >
              <Text className="text-[14px] font-semibold text-accent-foreground">
                {isSubmitting ? t('composerSending') : submitLabel}
              </Text>
            </Pressable>
          </View>

          {/* Content area */}
          <ScrollView
            className="flex-1 px-4"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Quoted status preview */}
            {quotedStatus ? (
              <View
                className="mb-2 rounded-2xl bg-surface-secondary px-4 py-3"
                style={[styles.quotedStatus, { borderLeftColor: border }]}
                accessibilityLabel={t('composerQuotedStatusA11y', { name: quotedStatus.screenName })}
                accessibilityRole="summary"
              >
                <Text className="text-[13px] font-semibold text-muted" numberOfLines={1}>
                  @{quotedStatus.screenName}
                </Text>
                {quotedStatus.plainText || (quotedStatus.photoUrl && !quotedPhotoFailed) ? (
                  <View className="mt-1 flex-row">
                    {quotedStatus.plainText ? (
                      <Text className="flex-1 text-[14px] leading-snug text-foreground" numberOfLines={4}>
                        {quotedStatus.plainText}
                      </Text>
                    ) : null}
                    {quotedStatus.photoUrl && !quotedPhotoFailed ? (
                      <Image
                        source={{ uri: quotedStatus.photoUrl }}
                        className={`h-14 w-14 rounded-xl bg-surface-secondary${quotedStatus.plainText ? ' ml-3' : ''}`}
                        resizeMode="cover"
                        onError={() => setQuotedPhotoFailed(true)}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={placeholderColor}
              multiline
              textAlignVertical="top"
              autoFocus
              className="min-h-[160px] py-2 text-[17px] leading-relaxed text-foreground"
              style={Platform.OS === 'android' ? styles.textInputAndroid : undefined}
              editable={!isSubmitting}
              scrollEnabled={false}
            />
            {photoUri ? (
              <View className="mb-4 overflow-hidden rounded-2xl">
                <Image
                  source={{ uri: photoUri }}
                  className="h-[260px] w-full bg-surface-secondary"
                  resizeMode="cover"
                />
              </View>
            ) : null}
          </ScrollView>

          {/* Bottom toolbar */}
          {enablePhoto ? (
            <View
              className="flex-row items-center gap-2 px-4 py-3"
              style={[
                styles.toolbar,
                { borderTopColor: border, paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <Pressable
                onPress={canDismiss && !isPhotoPicking ? handlePickPhoto : undefined}
                className={`h-10 w-10 items-center justify-center rounded-full bg-surface-secondary ${isPhotoPicking ? 'opacity-60' : ''}`}
                accessibilityRole="button"
                accessibilityLabel={photoUri ? t('composerChangePhoto') : t('composerAttachPhoto')}
              >
                <ImagePlus size={20} color={foreground} />
              </Pressable>
              {photoUri ? (
                <Pressable
                  onPress={canDismiss ? handleRemovePhoto : undefined}
                  className="rounded-full bg-surface-secondary px-4 py-2"
                  accessibilityRole="button"
                  accessibilityLabel={t('composerRemovePhotoA11y')}
                >
                  <Text className="text-[13px] text-foreground">
                    {t('composerRemovePhoto')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  quotedStatus: {
    borderLeftWidth: 3,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  textInputAndroid: {
    includeFontPadding: false,
  },
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default ComposerModal;
