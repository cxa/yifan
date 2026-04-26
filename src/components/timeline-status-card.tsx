import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import ImageShimmerPlaceholder from '@/components/image-shimmer-placeholder';
import { Reply, Repeat2, Trash2 } from 'lucide-react-native';
import { Dialog, useThemeColor } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import type { FanfouStatus } from '@/types/fanfou';
import type { PhotoViewerOriginRect } from '@/components/photo-viewer-shared-transition';
import { Text } from '@/components/app-text';
import { CARD_BG_LIGHT, CARD_BG_DARK, type DropShadowBoxType } from '@/components/drop-shadow-box';
import FavoriteHeartIcon from '@/components/favorite-heart-icon';
import JustifiedBodyText, {
  type JustifiedBodySegment,
} from '@/components/justified-body-text';
import { useAppFontFamily } from '@/settings/app-font-preference';
import { useAppFontSizeScale } from '@/settings/app-font-size-preference';
import { APP_THEME_OPTION, useAppThemePreference } from '@/settings/app-theme-preference';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import { formatTimestamp } from '@/utils/format-timestamp';
import { parseHtmlToSegments, parseHtmlToText } from '@/utils/parse-html';
// Surrogate-pair emoji regex — avoids \p{} Unicode property escapes which
// some Hermes versions parse but silently fail to match.
const EMOJI_RE = /([\uD83C-\uD83F][\uDC00-\uDFFF]|[\u2600-\u27BF]|\u2764[\uFE0F]?)/;
// Inverse approach: the content container uses NO custom font (skipFont).
// Non-emoji text spans explicitly set the CJK fontFamily; emoji spans set no
// fontFamily, so they fall back to the system default which supports emoji.
const renderTextWithEmoji = (
  text: string,
  key: string,
  fontFamily: string | undefined,
): React.ReactNode => {
  const parts = text.split(EMOJI_RE);
  if (parts.length === 1) {
    return fontFamily ? (
      <RNText key={key} style={{ fontFamily }}>{text}</RNText>
    ) : text;
  }
  return (
    <React.Fragment key={key}>
      {parts.map((part, i) => {
        if (!part) return null;
        // Odd indices are the captured emoji — no fontFamily so system default is used.
        if (i % 2 === 1) return <RNText key={i}>{part}</RNText>;
        // Even indices are plain text — apply CJK font if set.
        return fontFamily ? (
          <RNText key={i} style={{ fontFamily }}>{part}</RNText>
        ) : part;
      })}
    </React.Fragment>
  );
};
type TimelineStatusCardProps = {
  status: FanfouStatus;
  accent: string;
  showAvatar?: boolean;
  showAuthor?: boolean;
  shadowType?: DropShadowBoxType;
  isBookmarkPending: boolean;
  activeTag?: string;
  onOpenPhoto: (photoUrl: string, originRect: PhotoViewerOriginRect | null) => void;
  onPressStatus: (statusId: string, shadowType: DropShadowBoxType) => void;
  onPressProfile: (userId: string) => void;
  onPressMention: (userId: string) => void;
  onPressTag: (tag: string) => void;
  onReply: (status: FanfouStatus) => void;
  onRepost: (status: FanfouStatus) => void;
  onToggleBookmark: (status: FanfouStatus) => void;
  invertColorScheme?: boolean;
  canDelete?: boolean;
  onDelete?: (status: FanfouStatus) => Promise<void> | void;
};
// Text colors for explicit overrides when invertColorScheme is used.
// Derived from the OKLCH values in global.css.
const FOREGROUND_LIGHT = '#1A1208';
const FOREGROUND_DARK  = '#F2EDE8';
const MUTED_LIGHT      = '#7C7268';
const MUTED_DARK       = '#9C9288';

const TAG_PILL_CLASS = 'bg-accent/15 text-accent px-2 py-0.5 rounded-full';
const ACTIVE_TAG_PILL_CLASS =
  'bg-accent text-accent-foreground px-2 py-0.5 rounded-full';
// Chinese ideographs are ~1em wide, so snapping the body column to an
// integer multiple of the body font size keeps the right edge flush.
const BODY_FONT_SIZE = 15;
const getStatusId = (status: FanfouStatus): string => status.id;
const getStatusPhotoUrl = (status: FanfouStatus): string | null => {
  const getUrl = (...candidates: Array<string | undefined>) => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }
    return null;
  };
  return getUrl(
    status.photo?.largeurl,
    status.photo?.imageurl,
    status.photo?.thumburl,
  );
};
const TimelineStatusCard = ({
  status,
  accent,
  showAvatar = true,
  showAuthor = true,
  shadowType = 'default',
  isBookmarkPending,
  activeTag,
  onOpenPhoto,
  onPressStatus,
  onPressProfile,
  onPressMention,
  onPressTag,
  onReply,
  onRepost,
  onToggleBookmark,
  invertColorScheme = false,
  canDelete = false,
  onDelete,
}: TimelineStatusCardProps) => {
  const { t } = useTranslation();
  const isDark = useEffectiveIsDark();
  const effectiveIsDark = invertColorScheme ? !isDark : isDark;
  // Pastel card fills need a specific contrast-safe pair; derive the
  // effective foreground directly from the effective dark mode so the
  // JS <Text> instances and the native JustifiedBodyText both get the
  // same concrete hex — no `undefined` fallbacks.
  const textColor = effectiveIsDark ? FOREGROUND_DARK : FOREGROUND_LIGHT;
  const mutedColor = effectiveIsDark ? MUTED_DARK : MUTED_LIGHT;
  const themePreference = useAppThemePreference();
  const cardBgColor = themePreference === APP_THEME_OPTION.PLAIN
    ? (effectiveIsDark ? '#1E1E1E' : '#FFFFFF')
    : (effectiveIsDark ? CARD_BG_DARK : CARD_BG_LIGHT)[shadowType];
  const [danger, accentForeground] = useThemeColor([
    'danger',
    'accent-foreground',
  ]);
  const fontFamily = useAppFontFamily();
  const fontSizeScale = useAppFontSizeScale();
  // Body column / CJK snap / justify-text all reference this effective
  // size. Multiply the base size by the user's in-app font scale so
  // the native view matches every surrounding AppText (which applies
  // the same multiplier via sizeOverride in app-text.tsx).
  const bodyFontSize = Math.round(BODY_FONT_SIZE * fontSizeScale);
  const bodyLineHeight = Math.round(24 * fontSizeScale);
  const photoRef = useRef<View>(null);
  const [photoAspectRatio, setPhotoAspectRatio] = useState<number | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [bodyColumnWidth, setBodyColumnWidth] = useState<number | null>(null);
  // Snap the body column to a multiple of the body font size so CJK
  // text reaches the same right edge on every line. iOS uses the
  // snapped width for inter-character justify; Android can't justify
  // CJK but the snap still narrows the right-edge gap because rows of
  // full-width glyphs tile cleanly into a column that's an integer
  // multiple of one glyph wide.
  // Only snap the body column when an author header is rendered.
  // Snap shaves sub-glyph leftover off the right edge for tighter CJK
  // justify, but on headerless cards (profile recent activity / my
  // timeline) it also splits that leftover into visible left+right
  // padding that doesn't match the card's 16dp p-4. Without an author
  // anchoring the top, the card reads better when every edge stays at
  // exactly p-4.
  const snappedBodyWidth = showAuthor && bodyColumnWidth
    ? Math.floor(bodyColumnWidth / bodyFontSize) * bodyFontSize
    : null;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const statusId = getStatusId(status);
  const user = status.user;
  const displayName = user.screen_name || user.name;
  const screenName = user.screen_name;
  const userId = user.id;
  const handle = `@${userId}`;
  const avatarUrl = user.profile_image_url;
  const photoUrl = getStatusPhotoUrl(status);
  const isRepost = Boolean(status.repost_status_id);
  const repostScreenName = status.repost_screen_name ?? '';
  const repostUserId = status.repost_user_id ?? '';
  const segments = parseHtmlToSegments(status.text || status.status);
  const timestamp = formatTimestamp(status.created_at);
  const sourceClient = parseHtmlToText(status.source).trim();
  const viaLabel = sourceClient ? t('statusVia', { source: sourceClient }) : '';
  const handleDeletePress = () => {
    setIsDeleteDialogOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (!onDelete || isDeleting) {
      return;
    }
    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(status));
      setIsDeleteDialogOpen(false);
    } catch {
      // Delete failure is surfaced via toast in the delete handler.
    } finally {
      setIsDeleting(false);
    }
  };
  const handleDeleteDialogOpenChange = (nextIsOpen: boolean) => {
    if (isDeleting) {
      return;
    }
    setIsDeleteDialogOpen(nextIsOpen);
  };
  return (
    <>
      <Pressable
        onPress={() => onPressStatus(statusId, shadowType)}
        unstable_pressDelay={100}
        className="rounded-3xl p-4 shadow-card active:scale-[0.98] active:opacity-75 dark:shadow-none"
        style={[{ backgroundColor: cardBgColor }, styles.card]}
      >
        <View className={showAvatar ? 'flex-row gap-4' : undefined}>
          {showAvatar ? (
            <Pressable
              onPress={event => {
                event.stopPropagation();
                onPressProfile(userId);
              }}
              className="size-10"
              accessibilityRole="button"
              accessibilityLabel={`Open profile ${screenName || userId}`}
            >
              <Image
                source={{
                  uri: avatarUrl,
                }}
                className="size-10 rounded-full bg-surface-secondary"
              />
            </Pressable>
          ) : null}

          <View
            className={showAvatar ? 'flex-1' : undefined}
            onLayout={event => {
              // Measure the *available* column width here, never
              // the snapped content width — otherwise the measured
              // value collapses to the previous snap and changing
              // font size (which changes the snap multiple) can't
              // grow back to the full available width.
              const next = event.nativeEvent.layout.width;
              setBodyColumnWidth(previous =>
                previous === next ? previous : next,
              );
            }}
          >
            <View
              className={snappedBodyWidth ? 'self-center' : undefined}
              style={snappedBodyWidth ? { width: snappedBodyWidth } : undefined}
            >
            {showAuthor ? (
              <Pressable
                onPress={event => {
                  event.stopPropagation();
                  onPressProfile(userId);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Open profile ${screenName || userId}`}
                className="flex-row items-baseline gap-2"
              >
                <Text
                  className="shrink text-[17px] font-extrabold text-foreground"
                  style={{ color: textColor }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text
                  className="shrink-0 text-[13px] text-muted"
                  style={{ color: mutedColor }}
                  numberOfLines={1}
                >
                  {handle}
                </Text>
              </Pressable>
            ) : null}
            {/* Body / photo / actions share the regular 12dp rhythm;
                the author block sits outside this wrapper so its
                gap to *text* body can stay tight (mt-1 = 4dp) while
                pure-photo cards still get the normal 12dp separation
                between the author header and the image. */}
            <View
              className={`gap-3${
                showAuthor
                  ? segments.length > 0 || isRepost
                    ? ' mt-1'
                    : ' mt-3'
                  : ''
              }`}
            >
            {isRepost && repostScreenName ? (
              <Pressable
                onPress={event => {
                  event.stopPropagation();
                  if (repostUserId) {
                    onPressMention(repostUserId);
                  }
                }}
                className="flex-row items-center gap-1.5"
                accessibilityRole="button"
                accessibilityLabel={t('statusRepostFrom', { name: repostScreenName })}
              >
                <Repeat2 size={12} color={mutedColor} />
                <Text
                  className="text-[12px] leading-[16px] text-muted"
                  style={{ color: mutedColor }}
                  numberOfLines={1}
                >
                  {t('statusRepostFrom', { name: repostScreenName })}
                </Text>
              </Pressable>
            ) : null}
            {segments.length > 0 ? (
              <JustifiedBodyText
                segments={segments as JustifiedBodySegment[]}
                textColor={textColor}
                accentColor={accent}
                activeTag={activeTag ?? null}
                tagActivePillClass={ACTIVE_TAG_PILL_CLASS}
                tagInactivePillClass={TAG_PILL_CLASS}
                tagActiveBackgroundColor={accent}
                tagInactiveBackgroundColor={`${accent}26`}
                tagActiveTextColor={accentForeground}
                fontFamily={fontFamily ?? undefined}
                fontSize={bodyFontSize}
                lineHeight={bodyLineHeight}
                justify
                onPressMention={onPressMention}
                onPressTag={onPressTag}
                onPressText={() => onPressStatus(statusId, shadowType)}
                renderPlainTextSegment={(text, key) =>
                  renderTextWithEmoji(text, `${statusId}-${key}`, fontFamily)
                }
              />
            ) : null}
            {photoUrl ? (
              <Pressable
                ref={photoRef}
                onPress={() => {
                  if (photoRef.current) {
                    photoRef.current.measureInWindow((x, y, width, height) => {
                      onOpenPhoto(photoUrl, { x, y, width, height, borderRadius: 16 });
                    });
                  } else {
                    onOpenPhoto(photoUrl, null);
                  }
                }}
                className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10"
                style={styles.photo}
                accessibilityRole="button"
                accessibilityLabel="Open photo"
              >
                <View
                  className="w-full bg-surface-secondary"
                  style={
                    photoAspectRatio
                      ? { aspectRatio: Math.min(Math.max(photoAspectRatio, 0.4), 2) }
                      : styles.photoPlaceholder
                  }
                >
                  <Image
                    source={{ uri: photoUrl }}
                    className="h-full w-full"
                    resizeMode="cover"
                    onLoad={event => {
                      const { width, height } = event.nativeEvent.source;
                      if (width > 0 && height > 0) {
                        setPhotoAspectRatio(width / height);
                      }
                      setPhotoLoaded(true);
                    }}
                  />
                  <ImageShimmerPlaceholder visible={!photoLoaded} />
                </View>
              </Pressable>
            ) : null}
            <View className="flex-row items-end justify-between">
              <View className="flex-row items-center gap-4">
                <Pressable
                  onPress={() => onReply(status)}
                  className="pr-1.5 pt-1.5"
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Reply"
                >
                  <Reply size={18} color={mutedColor} />
                </Pressable>
                <Pressable
                  onPress={() => onRepost(status)}
                  className="px-1.5 pt-1.5"
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Repost"
                >
                  <Repeat2 size={18} color={mutedColor} />
                </Pressable>
                <Pressable
                  onPress={() => onToggleBookmark(status)}
                  disabled={isBookmarkPending}
                  className={`px-1.5 pt-1.5 ${isBookmarkPending ? 'opacity-50' : ''}`}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    status.favorited ? 'Remove bookmark' : 'Bookmark'
                  }
                >
                  <FavoriteHeartIcon
                    size={18}
                    isFavorited={status.favorited}
                    activeColor={accent}
                    inactiveColor={mutedColor}
                  />
                </Pressable>
                {canDelete && onDelete ? (
                  <Pressable
                    onPress={event => {
                      event.stopPropagation();
                      handleDeletePress();
                    }}
                    className="px-1.5 pt-1.5"
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('statusDeleteTitle')}
                  >
                    <Trash2 size={18} color={danger} />
                  </Pressable>
                ) : null}
              </View>
              <View className="ml-3 shrink-0 items-end gap-0.5">
                <Text
                  className="text-[11px] leading-[14px] text-muted"
                  style={{ color: mutedColor }}
                >
                  {timestamp}
                </Text>
                {viaLabel ? (
                  <Text
                    className="text-[11px] leading-[14px] text-muted"
                    style={[
                      { maxWidth: 160 * fontSizeScale },
                      { color: mutedColor },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {viaLabel}
                  </Text>
                ) : null}
              </View>
            </View>
            </View>
            </View>
          </View>
        </View>
      </Pressable>
      <Dialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="bg-foreground/55 dark:bg-background/85" />
          <Dialog.Content className="w-[92%] max-w-[360px] self-center rounded-3xl bg-surface p-4">
            <View className="gap-1">
              <Dialog.Title
                className="text-[20px] leading-[24px] font-bold text-foreground"
                style={fontFamily ? { fontFamily } : undefined}
              >
                {t('statusDeleteTitle')}
              </Dialog.Title>
            </View>
            <Dialog.Description
              className="mt-3 text-[14px] leading-5 text-danger"
              style={fontFamily ? { fontFamily } : undefined}
            >
              {t('statusDeleteConfirm')}
            </Dialog.Description>
            <View className="mt-5 flex-row gap-2">
              <Pressable
                onPress={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
                className={`flex-1 items-center justify-center rounded-full bg-surface-secondary px-3 py-2 active:opacity-75 ${isDeleting ? 'opacity-50' : ''
                  }`}
                accessibilityRole="button"
                accessibilityLabel={t('messageDeleteCancel')}
              >
                <Text className="text-[13px] font-semibold text-foreground">
                  {t('messageDeleteCancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmDelete}
                disabled={isDeleting}
                className={`flex-[2] items-center justify-center rounded-full bg-danger-soft px-3 py-2 active:opacity-75 ${isDeleting ? 'opacity-70' : ''
                  }`}
                accessibilityRole="button"
                accessibilityLabel={
                  isDeleting
                    ? t('statusDeleting')
                    : t('statusDeleteConfirmButton')
                }
              >
                <Text className="text-[13px] font-semibold text-danger">
                  {isDeleting
                    ? t('statusDeleting')
                    : t('statusDeleteConfirmButton')}
                </Text>
              </Pressable>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
};
const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
  },
  // Match the card's superellipse curve — default circular corners
  // at 16dp look visibly less smooth than the card around them.
  photo: {
    borderCurve: 'continuous',
  },
  photoPlaceholder: {
    height: 220,
  },
});
export default TimelineStatusCard;
