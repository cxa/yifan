import React, { useEffect, useRef, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { ImagePlus, X } from 'lucide-react-native';
import {
  AppState,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputSelectionChangeEvent,
  View,
} from 'react-native';
import {
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Switch, useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '@/components/app-text';
import ComposerMentionSuggestions from '@/components/composer-mention-suggestions';
import {
  pickImageFromLibrary,
  type PickedImage,
} from '@/utils/pick-image-from-library';
import { MAX_STATUS_LENGTH } from '@/utils/composer-send';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import { useAuthSession } from '@/auth/auth-session';
import { friendsListQueryOptions, mentionSearchQueryOptions } from '@/query/user-query-options';
import { detectMentionContext } from '@/utils/detect-mention-context';
import { matchesMentionNeedle, scoreMentionUser } from '@/utils/match-mention-user';
import type { FanfouUser } from '@/types/fanfou';

// Submit button color stays in sync with the Compose tab's active pill so
// "hit post" reads as one unified blue gesture across tab → composer.
// Dark variant lifts a touch to stay legible on the dark modal bg.
const COMPOSER_SUBMIT_BG = { light: '#4A8BF7', dark: '#5E9AFA' };
const COMPOSER_SUBMIT_FG = '#FFFFFF';

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
  allowEmptyText?: boolean;
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
  allowEmptyText = false,
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
  const isDark = useEffectiveIsDark();
  const submitBg = isDark ? COMPOSER_SUBMIT_BG.dark : COMPOSER_SUBMIT_BG.light;
  const inputRef = useRef<RNTextInput>(null);
  const [value, setValue] = useState(initialText);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [isPhotoPicking, setIsPhotoPicking] = useState(false);
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const [quotedPhotoFailed, setQuotedPhotoFailed] = useState(false);
  const [photoAspect, setPhotoAspect] = useState<number | null>(null);
  const [sendAsGif, setSendAsGif] = useState(true);
  // Selection mirrors the input cursor so the `@` autocomplete knows what
  // partial token to filter on. `pendingSelection` is set only when we
  // programmatically move the cursor (after inserting a mention) — it's
  // a one-shot controlled value that snaps back to undefined so the
  // input owns its cursor again.
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [pendingSelection, setPendingSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const auth = useAuthSession();
  const authUserId = auth.accessToken?.userId ?? '';
  const isSubmitting = controlledIsSubmitting ?? internalIsSubmitting;
  const canDismiss = !isSubmitting && !isPhotoPicking;
  const { height: keyboardHeight, progress: keyboardProgress } =
    useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();
  // paddingBottom smoothly interpolates so the toolbar's height doesn't
  // step-change at the moment the keyboard passes the "visible" threshold.
  // During Android photo picking the host Activity pauses, so keyboardProgress
  // can freeze mid-animation — force progress to 0 so the bar sits at the
  // safe-area bottom regardless of the stale shared value.
  const toolbarPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      isPhotoPicking ? 0 : keyboardProgress.value,
      [0, 1],
      [Math.max(insets.bottom, 12), 12],
    ),
  }));
  // Scroll area doesn't resize when the keyboard opens (Modal is edge-to-edge,
  // no adjustResize effect reaches it). Adding an animated bottom spacer to the
  // ScrollView content makes the scrollable range grow by the keyboard height,
  // so tall attachments like a GIF preview can be scrolled into view.
  const scrollBottomSpacerStyle = useAnimatedStyle(() => ({
    height: Math.abs(keyboardHeight.value),
  }));
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
  const hasText = value.trim().length > 0;
  const canSubmit =
    !isSubmitting &&
    !isPhotoPicking &&
    (allowEmptyText || hasText || Boolean(photoUri)) &&
    !isOverLimit;

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
    setSelection({ start: initialText.length, end: initialText.length });
  }, [initialText, initialPhoto, resetKey, visible]);

  const mentionContext = detectMentionContext(value, selection.start);

  // Start loading friends as soon as the composer opens so local character
  // matching has data ready by the time the user types '@'. Cache is 30 min
  // so re-opens are instant; only the first cold session pays the fetch cost.
  const friendsQuery = useQuery({
    ...friendsListQueryOptions(authUserId),
    enabled: visible && Boolean(authUserId),
  });

  // Debounce the needle so we don't fire a search request on every keystroke.
  const mentionPartial = mentionContext ? mentionContext.partial : '';
  const mentionNeedle = mentionPartial.trim().toLowerCase();
  const [debouncedNeedle, setDebouncedNeedle] = useState('');
  useEffect(() => {
    if (!mentionNeedle) {
      setDebouncedNeedle('');
      return;
    }
    const timer = setTimeout(() => setDebouncedNeedle(mentionNeedle), 200);
    return () => clearTimeout(timer);
  }, [mentionNeedle]);

  // Live search covers non-friends that the local list can't reach.
  const mentionSearchQuery = useQuery({
    ...mentionSearchQueryOptions(debouncedNeedle),
    enabled: Boolean(debouncedNeedle),
  });

  // True while waiting for any mention data: friends list initial load,
  // debounce timer, or remote search in flight.
  const isMentionSearching =
    Boolean(mentionContext) &&
    (friendsQuery.isLoading ||
      (Boolean(mentionNeedle) &&
        (debouncedNeedle !== mentionNeedle || mentionSearchQuery.isFetching)));

  // Merge friends (instant, local) + search results (debounced, remote).
  // Friends appear first sorted by relevance (direct handle match → display
  // name match → pinyin match); search results fill in anyone not already shown.
  // Cap at 30 to avoid rendering hundreds of rows for broad needles like "wan".
  const MENTION_SUGGESTIONS_LIMIT = 30;
  const mentionSuggestions = (() => {
    if (!mentionContext) {
      return [];
    }
    const allLocal = friendsQuery.data ?? [];
    const localMatches = mentionNeedle
      ? allLocal
          .filter(user => matchesMentionNeedle(user, mentionNeedle))
          .sort((a, b) => scoreMentionUser(a, mentionNeedle) - scoreMentionUser(b, mentionNeedle))
      : allLocal;
    if (!mentionNeedle) {
      return localMatches.slice(0, MENTION_SUGGESTIONS_LIMIT);
    }
    const localIds = new Set(localMatches.map(u => u.id));
    const remoteExtras = (mentionSearchQuery.data ?? []).filter(
      u => !localIds.has(u.id),
    );
    // IndexedUser extends FanfouUser so spreading the two arrays is safe.
    const combined: FanfouUser[] = [...localMatches, ...remoteExtras];
    return combined.slice(0, MENTION_SUGGESTIONS_LIMIT);
  })();

  const handleSelectMention = (user: FanfouUser) => {
    if (!mentionContext) {
      return;
    }
    // user.id is the login handle on Fanfou; screen_name is the display name
    const handleText = `@${user.id} `;
    const before = value.slice(0, mentionContext.start);
    const after = value.slice(mentionContext.end);
    const next = before + handleText + after;
    const cursorPos = before.length + handleText.length;
    setValue(next);
    setSelection({ start: cursorPos, end: cursorPos });
    setPendingSelection({ start: cursorPos, end: cursorPos });
  };

  useEffect(() => {
    if (!pendingSelection) {
      return;
    }
    // One-shot: clear `pendingSelection` after the input has accepted it
    // so the user regains cursor control on the next interaction.
    const id = setTimeout(() => setPendingSelection(undefined), 0);
    return () => clearTimeout(id);
  }, [pendingSelection]);

  const handleSelectionChange = (event: TextInputSelectionChangeEvent) => {
    const next = event.nativeEvent.selection;
    setSelection(previous =>
      previous.start === next.start && previous.end === next.end
        ? previous
        : next,
    );
  };

  const handleModalShow = () => {
    // Focus AFTER the Modal's slide-in animation completes on both platforms.
    // Using autoFocus instead would race the Modal animation with the keyboard
    // animation, making the sticky accessory bar overshoot then snap back.
    // A small delay lets onShow's "visible" state settle before IME opens.
    setTimeout(() => inputRef.current?.focus(), 50);
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
      }
      if (Platform.OS === 'android') {
        // After the photo picker closes on Android the EditText often still
        // holds view focus, so a plain focus() is a no-op and the soft IME
        // stays hidden. Force a blur→focus cycle on the next frame to
        // re-open the keyboard. Runs whether or not a photo was picked.
        const reopenKeyboard = () => {
          requestAnimationFrame(() => {
            inputRef.current?.blur();
            requestAnimationFrame(() => inputRef.current?.focus());
          });
        };
        if (AppState.currentState === 'active') {
          reopenKeyboard();
        } else {
          const sub = AppState.addEventListener('change', state => {
            if (state === 'active') {
              sub.remove();
              reopenKeyboard();
            }
          });
        }
      } else {
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

  const renderToolbar = () => (
    <Animated.View
      className="flex-row items-center gap-2 bg-background px-4 py-3"
      style={[styles.toolbar, { borderTopColor: border }, toolbarPaddingStyle]}
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
    </Animated.View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={handleModalShow}
      onRequestClose={() => canDismiss && onCancel()}
    >
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top || StatusBar.currentHeight || 0 }}
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
              style={{ backgroundColor: submitBg }}
              className={`items-center rounded-full px-5 py-2 ${canSubmit ? '' : 'opacity-40'}`}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              disabled={!canSubmit}
            >
              <Text className="text-[14px] font-semibold" style={{ color: COMPOSER_SUBMIT_FG }}>
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
                onSelectionChange={handleSelectionChange}
                selection={pendingSelection}
                placeholder={placeholder}
                placeholderTextColor={placeholderColor}
                multiline
                textAlignVertical="top"
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
            <Animated.View style={scrollBottomSpacerStyle} />
          </ScrollView>
      </View>

      {Platform.OS === 'android' && isPhotoPicking ? (
        // Android: while the photo picker Activity is foreground, the
        // composer Activity pauses and KeyboardStickyView's shared values
        // freeze — leaving the toolbar stranded mid-screen. Detach it into
        // a plain View pinned at the bottom so it doesn't bounce when the
        // keyboard animation resumes after the picker closes.
        <View className="bg-background">
          <ComposerMentionSuggestions
            suggestions={mentionSuggestions}
            needle={mentionNeedle}
            isSearching={isMentionSearching}
            onSelect={handleSelectMention}
          />
          {renderToolbar()}
        </View>
      ) : (
        <KeyboardStickyView className="bg-background">
          <ComposerMentionSuggestions
            suggestions={mentionSuggestions}
            needle={mentionNeedle}
            isSearching={isMentionSearching}
            onSelect={handleSelectMention}
          />
          {renderToolbar()}
          {/* iOS keyboard has rounded corners at its top-left/right — tiny
              arcs of Modal bg show through the notches. A short bg-background
              strip anchored to the toolbar's bottom bleeds into the keyboard's
              corner curve area and fills the notches (keyboard's opaque
              center simply covers the overlap). */}
          {Platform.OS === 'ios' ? (
            <View style={styles.keyboardCornerFiller} className="bg-background" />
          ) : null}
        </KeyboardStickyView>
      )}
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
  keyboardCornerFiller: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    height: 16,
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
