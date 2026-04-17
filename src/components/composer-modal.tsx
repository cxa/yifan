import React, { useEffect, useRef, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { ImagePlus, X } from 'lucide-react-native';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import {
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { Switch, useThemeColor } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '@/components/app-text';
import {
  pickImageFromLibrary,
  type PickedImage,
} from '@/utils/pick-image-from-library';
import { MAX_STATUS_LENGTH } from '@/utils/composer-send';

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
  const [placeholderColor, foreground, muted, border] = useThemeColor([
    'muted',
    'foreground',
    'muted',
    'border',
  ]);
  const inputRef = useRef<RNTextInput>(null);
  const [value, setValue] = useState(initialText);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [isPhotoPicking, setIsPhotoPicking] = useState(false);
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const [quotedPhotoFailed, setQuotedPhotoFailed] = useState(false);
  const [photoAspect, setPhotoAspect] = useState<number | null>(null);
  const [sendAsGif, setSendAsGif] = useState(true);
  const isSubmitting = controlledIsSubmitting ?? internalIsSubmitting;
  const canDismiss = !isSubmitting && !isPhotoPicking;
  const isKeyboardVisible = useKeyboardState(state => state.isVisible);
  const isLivePhotoGif = photo?.mimeType === 'image/gif' && Boolean(photo?.stillImage);
  const effectivePhoto = isLivePhotoGif && !sendAsGif && photo?.stillImage
    ? { ...photo, ...photo.stillImage }
    : photo;
  const photoUri = effectivePhoto?.uri ?? null;
  const isGifPhoto = effectivePhoto?.mimeType === 'image/gif';
  const shouldShowLivePhotoStaticHint =
    effectivePhoto?.livePhotoStaticFallback === true && !isGifPhoto;
  const charCount = value.length;
  const isOverLimit = charCount > MAX_STATUS_LENGTH;
  const canSubmit = !isSubmitting && !isPhotoPicking && value.trim().length > 0 && !isOverLimit;

  useEffect(() => {
    if (!visible) {
      return;
    }
    setValue(initialText);
    setPhoto(initialPhoto ?? null);
    setPhotoAspect(null);
    setSendAsGif(true);
    setIsPhotoPicking(false);
    setInternalIsSubmitting(false);
    setQuotedPhotoFailed(false);
  }, [initialText, initialPhoto, resetKey, visible]);

  const handleModalShow = () => {
    if (Platform.OS !== 'android') {
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handlePickPhoto = async () => {
    if (!enablePhoto || !canDismiss) {
      return;
    }
    setIsPhotoPicking(true);
    try {
      const pickedPhoto = await pickImageFromLibrary();
      if (pickedPhoto) {
        setPhoto(pickedPhoto);
        inputRef.current?.focus();
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
      await onSubmit({ text: value, photo: effectivePhoto });
      return;
    }
    setInternalIsSubmitting(true);
    try {
      await onSubmit({ text: value, photo: effectivePhoto });
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={handleModalShow}
      onRequestClose={() => canDismiss && onCancel()}
    >
      <SafeAreaProvider>
        <SafeAreaInsetsContext.Consumer>
          {(insets) => {
            const topPad = insets?.top ?? StatusBar.currentHeight ?? 0;
            const bottomInset = insets?.bottom ?? 0;
            const toolbarBottomPad = isKeyboardVisible ? 12 : Math.max(bottomInset, 12);
            return (
              <>
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: topPad }}
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
              onPress={canSubmit ? handleSubmit : undefined}
              className={`items-center rounded-full bg-accent px-5 py-2 ${canSubmit ? '' : 'opacity-40'}`}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              disabled={!canSubmit}
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
                className="mb-2 rounded-3xl bg-surface-secondary px-4 py-3"
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
                        className={`size-14 rounded-2xl bg-surface-secondary${quotedStatus.plainText ? ' ml-3' : ''}`}
                        resizeMode="cover"
                        onError={() => setQuotedPhotoFailed(true)}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
            <View>
              {/* Background highlight layer: non-editable TextInput for identical line breaking */}
              {isOverLimit ? (
                <TextInput
                  editable={false}
                  scrollEnabled={false}
                  multiline
                  textAlignVertical="top"
                  pointerEvents="none"
                  className="absolute inset-0 py-2 text-[17px] leading-relaxed"
                  style={Platform.OS === 'android' ? styles.textInputAndroid : undefined}
                >
                  <Text style={styles.hiddenText}>{value.slice(0, MAX_STATUS_LENGTH)}</Text>
                  <Text style={styles.overLimitBg}>{value.slice(MAX_STATUS_LENGTH)}</Text>
                </TextInput>
              ) : null}
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={setValue}
                placeholder={placeholder}
                placeholderTextColor={placeholderColor}
                multiline
                textAlignVertical="top"
                autoFocus={Platform.OS === 'ios'}
                className="min-h-[160px] py-2 text-[17px] leading-relaxed text-foreground"
                style={[
                  styles.textInputTransparentBg,
                  Platform.OS === 'android' ? styles.textInputAndroid : undefined,
                ]}
                editable={!isSubmitting}
                scrollEnabled={false}
              />
            </View>
            {photoUri ? (
              <View className="mb-4">
                <View className="overflow-hidden rounded-3xl">
                  <Image
                    source={{ uri: photoUri }}
                    className="w-full bg-surface-secondary"
                    style={photoAspect ? { aspectRatio: photoAspect } : styles.photoFallback}
                    resizeMode="contain"
                    onLoad={e => {
                      const { width, height } = e.nativeEvent.source;
                      if (width > 0 && height > 0) {
                        setPhotoAspect(width / height);
                      }
                    }}
                  />
                  {isGifPhoto ? (
                    <View className="bg-foreground" style={styles.gifBadge}>
                      <Text className="text-background" style={styles.gifBadgeText}>GIF</Text>
                    </View>
                  ) : null}
                </View>
                {shouldShowLivePhotoStaticHint ? (
                  <Text className="mt-2 px-1 text-[13px] leading-snug text-muted">
                    {t('composerLivePhotoStaticHint')}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
      </View>

      {/* Bottom toolbar — sticks to keyboard top when visible. Modal is
          edge-to-edge (navigationBarTranslucent), so IME height alone is the
          correct translateY; no offset needed. */}
      <KeyboardStickyView className="bg-background">
        <View
          className="flex-row items-center gap-2 px-4 py-3"
          style={[
            styles.toolbar,
            { borderTopColor: border, paddingBottom: toolbarBottomPad },
          ]}
        >
          {enablePhoto ? (
            <>
              <Pressable
                onPress={canDismiss && !isPhotoPicking ? handlePickPhoto : undefined}
                className={`items-center justify-center rounded-full p-1 ${isPhotoPicking ? 'opacity-60' : ''}`}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={photoUri ? t('composerChangePhoto') : t('composerAttachPhoto')}
              >
                <ImagePlus size={22} color={foreground} />
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
              {isLivePhotoGif ? (
                <View className="flex-row items-center gap-2">
                  <Switch
                    isSelected={sendAsGif}
                    onSelectedChange={setSendAsGif}
                  />
                  <Text className="text-[13px] font-semibold text-foreground">GIF</Text>
                </View>
              ) : null}
            </>
          ) : null}
          <Text
            className={`ml-auto text-[13px] font-semibold ${isOverLimit ? 'text-danger' : 'text-muted'}`}
            style={styles.charCount}
            numberOfLines={1}
          >
            {charCount}/{MAX_STATUS_LENGTH}
          </Text>
        </View>
      </KeyboardStickyView>
              </>
            );
          }}
        </SafeAreaInsetsContext.Consumer>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  quotedStatus: {
    borderLeftWidth: 3,
  },
  gifBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gifBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
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
  charCount: {
    width: 72,
    textAlign: 'right',
  },
  photoFallback: {
    aspectRatio: 1,
  },
  textInputTransparentBg: {
    backgroundColor: 'transparent',
  },
  hiddenText: {
    color: 'transparent',
  },
  overLimitBg: {
    color: 'transparent',
    backgroundColor: '#FF000033',
    borderRadius: 2,
  },
});

export default ComposerModal;
