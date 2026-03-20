import React from 'react';
import { Image, Pressable, Text as RNText, useColorScheme, View } from 'react-native';
import { MessageCircle, Repeat2, Trash2 } from 'lucide-react-native';
import { Dialog, useThemeColor } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import type { FanfouStatus } from '@/types/fanfou';
import { Text } from '@/components/app-text';
import type { DropShadowBoxType } from '@/components/drop-shadow-box';
import FavoriteHeartIcon from '@/components/favorite-heart-icon';
import { useAppFontFamily } from '@/settings/app-font-preference';
import { formatTimestamp } from '@/utils/format-timestamp';
import { parseHtmlToSegments, parseHtmlToText } from '@/utils/parse-html';
import { openLink } from '@/utils/open-link';
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
  muted: string;
  showAvatar?: boolean;
  showAuthor?: boolean;
  shadowType?: DropShadowBoxType;
  isBookmarkPending: boolean;
  photoViewerVisible: boolean;
  photoViewerPreviewKey: string | null;
  activeTag?: string;
  registerPhotoPreviewRef: (
    key: string,
    node: React.ComponentRef<typeof View> | null,
  ) => void;
  onOpenPhoto: (photoUrl: string, previewKey: string) => void;
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

// Pastel card background colors — directly matching the reference design system
const CARD_BG_LIGHT: Record<DropShadowBoxType, string> = {
  default: '#F7EFE0', // warm cream fallback
  accent:  '#FDDBD5', // soft pink/peach
  warning: '#FDF3C8', // warm yellow
  danger:  '#E8D5F5', // soft lavender
  sky:     '#D0E8F5', // sky blue
  success: '#C8EDE8', // mint
};
const CARD_BG_DARK: Record<DropShadowBoxType, string> = {
  default: '#2A2520',
  accent:  '#3D2820',
  warning: '#352E18',
  danger:  '#2D1E38',
  sky:     '#1A2E3D',
  success: '#1A3530',
};
const TAG_PILL_CLASS = 'bg-accent/15 text-accent px-2 py-0.5 rounded-full';
const ACTIVE_TAG_PILL_CLASS =
  'bg-accent text-accent-foreground px-2 py-0.5 rounded-full';
const FOOTER_META_GAP = 12;
const FOOTER_META_ITEM_GAP = 4;
const FOOTER_META_VIA_VISIBILITY_BUFFER = 6;
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
  muted,
  showAvatar = true,
  showAuthor = true,
  shadowType = 'default',
  isBookmarkPending,
  photoViewerVisible,
  photoViewerPreviewKey,
  activeTag,
  registerPhotoPreviewRef,
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
  const isDark = useColorScheme() === 'dark';
  const effectiveIsDark = invertColorScheme ? !isDark : isDark;
  const textColor = invertColorScheme
    ? isDark ? FOREGROUND_LIGHT : FOREGROUND_DARK
    : undefined;
  const mutedColor = invertColorScheme
    ? isDark ? MUTED_LIGHT : MUTED_DARK
    : undefined;
  const effectiveMuted = mutedColor ?? muted;
  const cardBgColor = (effectiveIsDark ? CARD_BG_DARK : CARD_BG_LIGHT)[shadowType];
  const [danger] = useThemeColor(['danger']);
  const fontFamily = useAppFontFamily();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [footerWidth, setFooterWidth] = React.useState(0);
  const [actionsWidth, setActionsWidth] = React.useState(0);
  const [timestampWidth, setTimestampWidth] = React.useState(0);
  const [viaWidth, setViaWidth] = React.useState(0);
  const updateMeasuredWidth = (
    setWidth: React.Dispatch<React.SetStateAction<number>>,
    value: number,
  ) => {
    const next = Math.round(value);
    setWidth(previous => (previous === next ? previous : next));
  };
  const statusId = getStatusId(status);
  const user = status.user;
  const displayName = user.screen_name || user.name;
  const screenName = user.screen_name;
  const userId = user.id;
  const handle = `@${userId}`;
  const avatarUrl = user.profile_image_url;
  const photoUrl = getStatusPhotoUrl(status);
  const photoPreviewKey = `${statusId}-photo`;
  const segments = parseHtmlToSegments(status.text || status.status);
  const timestamp = formatTimestamp(status.created_at);
  const sourceClient = parseHtmlToText(status.source).trim();
  const viaLabel = sourceClient ? `via ${sourceClient}` : '';
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
  const normalizedActiveTag = activeTag?.toLowerCase();
  const canShowVia = (() => {
    if (!viaLabel) {
      return false;
    }
    if (!footerWidth || !actionsWidth || !timestampWidth || !viaWidth) {
      return false;
    }
    const availableMetaWidth = footerWidth - actionsWidth - FOOTER_META_GAP;
    const requiredMetaWidth = timestampWidth + FOOTER_META_ITEM_GAP + viaWidth;
    return (
      availableMetaWidth >=
      requiredMetaWidth + FOOTER_META_VIA_VISIBILITY_BUFFER
    );
  })();

  return (
    <>
      <Pressable
        onPress={() => onPressStatus(statusId, shadowType)}
        unstable_pressDelay={100}
        className="rounded-[24px] px-5 py-4 active:opacity-75"
        style={{ backgroundColor: cardBgColor }}
      >
        {canDelete && onDelete ? (
          <Pressable
            onPress={event => {
              event.stopPropagation();
              handleDeletePress();
            }}
            className="absolute right-4 top-3 z-10 p-1"
            accessibilityRole="button"
            accessibilityLabel={t('statusDeleteTitle')}
          >
            <Trash2 size={16} color={danger} />
          </Pressable>
        ) : null}
        <View className={showAvatar ? 'flex-row gap-3' : undefined}>
          {showAvatar ? (
            <Pressable
              onPress={event => {
                event.stopPropagation();
                onPressProfile(userId);
              }}
              className="h-10 w-10"
              accessibilityRole="button"
              accessibilityLabel={`Open profile ${screenName || userId}`}
            >
              <Image
                source={{
                  uri: avatarUrl,
                }}
                className="h-10 w-10 rounded-full bg-surface-secondary"
              />
            </Pressable>
          ) : null}

          <View className={showAvatar ? 'flex-1' : undefined}>
            {showAuthor ? (
              <View className="mt-0.5 flex-row items-center gap-2">
                <Pressable
                  onPress={event => {
                    event.stopPropagation();
                    onPressProfile(userId);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Open profile ${screenName || userId}`}
                  className="min-w-0 shrink"
                >
                  <Text
                    className="text-[17px] font-bold text-foreground"
                    style={textColor ? { color: textColor } : undefined}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                </Pressable>
                <Text
                  className="min-w-0 shrink text-[14px] text-muted"
                  style={mutedColor ? { color: mutedColor } : undefined}
                  numberOfLines={1}
                >
                  {handle}
                </Text>
              </View>
            ) : null}
            <Text skipFont className="mt-1 text-[15px] leading-6 text-foreground" style={textColor ? { color: textColor } : undefined}>
              {segments.length > 0
                ? segments.map((segment, segmentIndex) => {
                  if (segment.type === 'mention') {
                    return (
                      <Text
                        key={`${statusId}-${segmentIndex}`}
                        className="text-accent"
                        onPress={event => {
                          event.stopPropagation();
                          onPressMention(segment.screenName);
                        }}
                      >
                        {segment.text}
                      </Text>
                    );
                  }
                  if (segment.type === 'tag') {
                    const isActiveTag =
                      Boolean(normalizedActiveTag) &&
                      normalizedActiveTag === segment.tag.toLowerCase();
                    return (
                      <Text
                        key={`${statusId}-${segmentIndex}`}
                        className={
                          isActiveTag
                            ? ACTIVE_TAG_PILL_CLASS
                            : TAG_PILL_CLASS
                        }
                        onPress={event => {
                          event.stopPropagation();
                          onPressTag(segment.tag);
                        }}
                      >
                        {segment.text}
                      </Text>
                    );
                  }
                  if (segment.type === 'link') {
                    return (
                      <Text
                        key={`${statusId}-${segmentIndex}`}
                        className="text-accent underline"
                        onPress={event => {
                          event.stopPropagation();
                          openLink(segment.href);
                        }}
                      >
                        {segment.text}
                      </Text>
                    );
                  }
                  return renderTextWithEmoji(segment.text, `${statusId}-${segmentIndex}`, fontFamily);
                })
                : ''}
            </Text>
            {photoUrl ? (
              <View
                className={
                  photoViewerVisible &&
                    photoViewerPreviewKey === photoPreviewKey
                    ? 'opacity-0'
                    : undefined
                }
              >
                <Pressable
                  onPress={() => onOpenPhoto(photoUrl, photoPreviewKey)}
                  className="mt-3 overflow-hidden rounded-[16px]"
                  accessibilityRole="button"
                  accessibilityLabel="Open photo"
                >
                  <View
                    ref={node =>
                      registerPhotoPreviewRef(photoPreviewKey, node)
                    }
                    collapsable={false}
                    className="h-[220px] w-full"
                  >
                    <Image
                      source={{
                        uri: photoUrl,
                      }}
                      className="h-full w-full bg-surface-secondary"
                      resizeMode="cover"
                    />
                  </View>
                </Pressable>
              </View>
            ) : null}
            <View className="absolute opacity-0" pointerEvents="none">
              <View
                className="flex-row items-center"
                onLayout={event => {
                  updateMeasuredWidth(
                    setTimestampWidth,
                    event.nativeEvent.layout.width,
                  );
                }}
              >
                <Text className="text-[12px] text-muted" style={mutedColor ? { color: mutedColor } : undefined}>{timestamp}</Text>
              </View>
              {viaLabel ? (
                <View
                  className="flex-row items-center"
                  onLayout={event => {
                    updateMeasuredWidth(
                      setViaWidth,
                      event.nativeEvent.layout.width,
                    );
                  }}
                >
                  <Text className="text-[12px] text-muted" style={mutedColor ? { color: mutedColor } : undefined}>{viaLabel}</Text>
                </View>
              ) : null}
            </View>
            <View
              className="mt-3 flex-row items-center justify-between"
              onLayout={event => {
                updateMeasuredWidth(
                  setFooterWidth,
                  event.nativeEvent.layout.width,
                );
              }}
            >
              <View
                className="flex-row items-center gap-4"
                onLayout={event => {
                  updateMeasuredWidth(
                    setActionsWidth,
                    event.nativeEvent.layout.width,
                  );
                }}
              >
                <Pressable
                  onPress={() => onReply(status)}
                  className="p-1"
                  accessibilityRole="button"
                  accessibilityLabel="Reply"
                >
                  <MessageCircle size={16} color={effectiveMuted} />
                </Pressable>
                <Pressable
                  onPress={() => onRepost(status)}
                  className="p-1"
                  accessibilityRole="button"
                  accessibilityLabel="Repost"
                >
                  <Repeat2 size={16} color={effectiveMuted} />
                </Pressable>
                <Pressable
                  onPress={() => onToggleBookmark(status)}
                  disabled={isBookmarkPending}
                  className={`p-1 ${isBookmarkPending ? 'opacity-50' : ''}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    status.favorited ? 'Remove bookmark' : 'Bookmark'
                  }
                >
                  <FavoriteHeartIcon
                    size={16}
                    isFavorited={status.favorited}
                    activeColor={accent}
                    inactiveColor={effectiveMuted}
                  />
                </Pressable>
              </View>
              <View className="ml-3 flex-1 min-w-0 items-end">
                <View className="flex-row items-center gap-1">
                  <Text className="text-[12px] text-muted" style={mutedColor ? { color: mutedColor } : undefined}>{timestamp}</Text>
                  {canShowVia ? (
                    <Text className="text-[12px] text-muted" style={mutedColor ? { color: mutedColor } : undefined}>{viaLabel}</Text>
                  ) : null}
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
          <Dialog.Content className="w-[92%] max-w-[360px] self-center rounded-[24px] bg-surface px-4 py-4">
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
                className={`flex-1 items-center justify-center rounded-[16px] bg-surface-secondary px-3 py-2 active:opacity-75 ${isDeleting ? 'opacity-50' : ''
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
                className={`flex-[2] items-center justify-center rounded-[16px] bg-danger-soft px-3 py-2 active:opacity-75 ${isDeleting ? 'opacity-70' : ''
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
export default TimelineStatusCard;
