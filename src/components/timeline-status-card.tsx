import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { MessageCircle, Repeat2, Trash2 } from 'lucide-react-native';
import { Dialog, useThemeColor } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import type { FanfouStatus } from '@/types/fanfou';
import { Text } from '@/components/app-text';
import DropShadowBox, {
  getDropShadowBorderClass,
  type DropShadowBoxType,
} from '@/components/drop-shadow-box';
import FavoriteHeartIcon from '@/components/favorite-heart-icon';
import { formatTimestamp } from '@/utils/format-timestamp';
import { parseHtmlToSegments, parseHtmlToText } from '@/utils/parse-html';
import { openLink } from '@/utils/open-link';
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
  onPressStatus: (statusId: string) => void;
  onPressProfile: (userId: string) => void;
  onPressMention: (userId: string) => void;
  onPressTag: (tag: string) => void;
  onReply: (status: FanfouStatus) => void;
  onRepost: (status: FanfouStatus) => void;
  onToggleBookmark: (status: FanfouStatus) => void;
  canDelete?: boolean;
  onDelete?: (status: FanfouStatus) => Promise<void> | void;
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
  canDelete = false,
  onDelete,
}: TimelineStatusCardProps) => {
  const { t } = useTranslation();
  const [danger] = useThemeColor(['danger']);
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
      <DropShadowBox type={shadowType}>
        <Pressable
          onPress={() => onPressStatus(statusId)}
          unstable_pressDelay={100}
          className={`bg-surface border-2 ${getDropShadowBorderClass(
            shadowType,
          )} px-5 py-4 active:translate-x-[-4px] active:translate-y-[4px]`}
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
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>
                  </Pressable>
                  <Text
                    className="min-w-0 shrink text-[14px] text-muted"
                    numberOfLines={1}
                  >
                    {handle}
                  </Text>
                </View>
              ) : null}
              <Text className="mt-1 text-[15px] leading-6 text-foreground">
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
                      return segment.text;
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
                    className="mt-3 overflow-hidden border border-border bg-surface-secondary"
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
                  <Text className="text-[12px] text-muted">{timestamp}</Text>
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
                    <Text className="text-[12px] text-muted">{viaLabel}</Text>
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
                    <MessageCircle size={16} color={muted} />
                  </Pressable>
                  <Pressable
                    onPress={() => onRepost(status)}
                    className="p-1"
                    accessibilityRole="button"
                    accessibilityLabel="Repost"
                  >
                    <Repeat2 size={16} color={muted} />
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
                      inactiveColor={muted}
                    />
                  </Pressable>
                </View>
                <View className="ml-3 flex-1 min-w-0 items-end">
                  <View className="flex-row items-center gap-1">
                    <Text className="text-[12px] text-muted">{timestamp}</Text>
                    {canShowVia ? (
                      <Text className="text-[12px] text-muted">{viaLabel}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      </DropShadowBox>
      <Dialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="bg-foreground/55 dark:bg-background/85" />
          <Dialog.Content className="w-[92%] max-w-[360px] self-center border-[6px] border-danger bg-surface px-4 py-4">
            <View className="gap-1">
              <Dialog.Title className="text-[20px] leading-[24px] font-bold text-foreground">
                {t('statusDeleteTitle')}
              </Dialog.Title>
            </View>
            <Dialog.Description className="mt-3 text-[14px] leading-5 text-danger">
              {t('statusDeleteConfirm')}
            </Dialog.Description>
            <View className="mt-5 flex-row gap-2">
              <Pressable
                onPress={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
                className={`flex-1 items-center justify-center border-2 border-border bg-surface-secondary px-3 py-2 active:translate-x-[-2px] active:translate-y-[2px] ${
                  isDeleting ? 'opacity-50' : ''
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
                className={`flex-[2] items-center justify-center border-2 border-danger bg-danger-soft px-3 py-2 active:translate-x-[-2px] active:translate-y-[2px] ${
                  isDeleting ? 'opacity-70' : ''
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
