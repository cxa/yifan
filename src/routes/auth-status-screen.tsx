import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';

import { get, post, uploadPhoto } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import DropShadowBox, {
  getDropShadowBorderClass,
} from '@/components/drop-shadow-box';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import TimelineStatusCard from '@/components/timeline-status-card';
import {
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
} from '@/navigation/route-names';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import { TIMELINE_SPACING } from '@/components/timeline-list-settings';
import type {
  AuthStackParamList,
  AuthStatusStackParamList,
} from '@/navigation/types';
import type { FanfouStatus } from '@/types/fanfou';
import { parseFanfouDate } from '@/utils/fanfou-date';

const STATUS_DETAIL_SECTION_GAP = 16;
const STATUS_DETAIL_TOP_PADDING = 14;
const STATUS_DETAIL_PROGRESS_OFFSET = 44;

type PhotoViewerOriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ComposerMode = 'reply' | 'repost' | null;

type ReplyTarget = {
  statusId: string;
  userId: string;
  screenName: string;
};

type RepostTarget = {
  statusId: string;
  screenName: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeStatus = (value: unknown): FanfouStatus | null =>
  isRecord(value) ? (value as FanfouStatus) : null;

const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];

const getStatusId = (status: FanfouStatus): string => status.id;

const getStatusCreatedAtMs = (status: FanfouStatus) => {
  const parsed = parseFanfouDate(status.created_at);
  if (parsed) {
    return parsed.getTime();
  }
  const fallback = new Date(status.created_at);
  return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime();
};

const mergeConversationStatuses = (
  contextItems: FanfouStatus[],
  status: FanfouStatus | null,
) => {
  const dedupedById = new Map<string, FanfouStatus>();
  for (const item of contextItems) {
    dedupedById.set(getStatusId(item), item);
  }
  if (status) {
    dedupedById.set(getStatusId(status), status);
  }
  return Array.from(dedupedById.values()).sort((left, right) => {
    return getStatusCreatedAtMs(left) - getStatusCreatedAtMs(right);
  });
};

const extractErrorField = (value: unknown) => {
  if (!isRecord(value)) {
    return null;
  }
  const message = value.error;
  return typeof message === 'string' && message.trim().length > 0
    ? message.trim()
    : null;
};

const parseErrorPayloadFromMessage = (message: string) => {
  const firstBraceIndex = message.indexOf('{');
  const lastBraceIndex = message.lastIndexOf('}');
  if (firstBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    return null;
  }
  const payloadText = message.slice(firstBraceIndex, lastBraceIndex + 1);
  try {
    const payload = JSON.parse(payloadText);
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const directError = extractErrorField(error);
  if (directError) {
    return directError;
  }
  if (!(error instanceof Error)) {
    return fallback;
  }
  const payload = parseErrorPayloadFromMessage(error.message);
  const payloadError = extractErrorField(payload);
  if (payloadError) {
    return payloadError;
  }
  return error.message || fallback;
};

const StatusDetailRoute = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route =
    useRoute<
      RouteProp<AuthStatusStackParamList, typeof AUTH_STATUS_ROUTE.DETAIL>
    >();
  const insets = useSafeAreaInsets();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const routeStatusId = route.params.statusId.trim();

  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerPreviewKey, setPhotoViewerPreviewKey] = useState<
    string | null
  >(null);
  const [photoViewerOriginRect, setPhotoViewerOriginRect] =
    useState<PhotoViewerOriginRect | null>(null);
  const photoPreviewRefs = useRef(
    new Map<string, React.ComponentRef<typeof View>>(),
  );

  const [composeMode, setComposeMode] = useState<ComposerMode>(null);
  const [composeReplyTarget, setComposeReplyTarget] =
    useState<ReplyTarget | null>(null);
  const [composeRepostTarget, setComposeRepostTarget] =
    useState<RepostTarget | null>(null);

  const [pendingBookmarkIds, setPendingBookmarkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoritedOverrides, setFavoritedOverrides] = useState<
    Record<string, boolean>
  >({});

  const statusQueryKey = useMemo(
    () => ['status', 'detail', routeStatusId] as const,
    [routeStatusId],
  );
  const contextQueryKey = useMemo(
    () => ['status', 'context', routeStatusId] as const,
    [routeStatusId],
  );

  const {
    data: status,
    isLoading: isStatusLoading,
    isRefetching: isStatusRefetching,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery<FanfouStatus | null>({
    queryKey: statusQueryKey,
    queryFn: async () => {
      const data = await get('/statuses/show', {
        id: routeStatusId,
        mode: 'default',
      });
      return normalizeStatus(data);
    },
    enabled: Boolean(routeStatusId),
  });

  const {
    data: contextStatuses,
    isLoading: isContextLoading,
    isRefetching: isContextRefetching,
    error: contextError,
    refetch: refetchContext,
  } = useQuery<FanfouStatus[]>({
    queryKey: contextQueryKey,
    queryFn: async () => {
      const data = await get('/statuses/context_timeline', {
        id: routeStatusId,
        mode: 'default',
      });
      return normalizeTimelineItems(data);
    },
    enabled: Boolean(routeStatusId),
  });

  const contextItems = useMemo(() => contextStatuses ?? [], [contextStatuses]);
  const conversationItems = useMemo(
    () => mergeConversationStatuses(contextItems, status ?? null),
    [contextItems, status],
  );

  const mainStatus = useMemo(() => {
    const fromConversation = conversationItems.find(
      item => getStatusId(item) === routeStatusId,
    );
    return fromConversation ?? status;
  }, [conversationItems, routeStatusId, status]);

  const mainStatusId = mainStatus ? getStatusId(mainStatus) : routeStatusId;

  const { beforeStatuses, afterStatuses } = useMemo(() => {
    if (conversationItems.length === 0) {
      return {
        beforeStatuses: [] as FanfouStatus[],
        afterStatuses: [] as FanfouStatus[],
      };
    }

    const pivotIndex = conversationItems.findIndex(
      item => getStatusId(item) === mainStatusId,
    );

    if (pivotIndex === -1) {
      return {
        beforeStatuses: [] as FanfouStatus[],
        afterStatuses: conversationItems,
      };
    }

    return {
      beforeStatuses: conversationItems.slice(0, pivotIndex),
      afterStatuses: conversationItems.slice(pivotIndex + 1),
    };
  }, [conversationItems, mainStatusId]);

  const statusErrorMessage = statusError
    ? getErrorMessage(statusError, 'Failed to load status.')
    : null;
  const contextErrorMessage = contextError
    ? getErrorMessage(contextError, 'Failed to load conversation.')
    : null;
  const isHydratingStatus =
    !mainStatus && (isStatusLoading || isContextLoading);
  const isPullToRefreshing = isStatusRefetching || isContextRefetching;

  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingTop: STATUS_DETAIL_TOP_PADDING,
      paddingBottom: insets.bottom + TIMELINE_SPACING,
      gap: STATUS_DETAIL_SECTION_GAP,
    }),
    [insets.bottom],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchStatus(), refetchContext()]);
  }, [refetchContext, refetchStatus]);

  const handleMentionPress = useCallback(
    (userId: string) => {
      navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
        screen: AUTH_PROFILE_ROUTE.DETAIL,
        params: { userId },
      });
    },
    [navigation],
  );

  const handleProfilePress = useCallback(
    (userId: string) => {
      navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
        screen: AUTH_PROFILE_ROUTE.DETAIL,
        params: { userId },
      });
    },
    [navigation],
  );

  const handleOpenStatusDetail = useCallback(
    (statusId: string) => {
      if (statusId === routeStatusId) {
        return;
      }
      navigation.navigate(AUTH_STACK_ROUTE.STATUS, {
        screen: AUTH_STATUS_ROUTE.DETAIL,
        params: { statusId },
      });
    },
    [navigation, routeStatusId],
  );

  const handleTagPress = useCallback(
    (tag: string) => {
      const normalizedTag = tag.trim().replace(/^#+/, '').replace(/#+$/, '');
      if (!normalizedTag) {
        return;
      }
      navigation.navigate(AUTH_STACK_ROUTE.TAG_TIMELINE, {
        screen: AUTH_TAG_TIMELINE_ROUTE.DETAIL,
        params: { tag: normalizedTag },
      });
    },
    [navigation],
  );

  const registerPhotoPreviewRef = useCallback(
    (key: string, node: React.ComponentRef<typeof View> | null) => {
      if (node) {
        photoPreviewRefs.current.set(key, node);
        return;
      }
      photoPreviewRefs.current.delete(key);
    },
    [],
  );

  const openPhotoViewer = useCallback(
    (
      photoUrl: string,
      originRect: PhotoViewerOriginRect | null,
      previewKey: string,
    ) => {
      Image.prefetch(photoUrl).catch(() => undefined);
      setPhotoViewerPreviewKey(previewKey);
      setPhotoViewerOriginRect(originRect);
      setPhotoViewerUrl(photoUrl);
      setPhotoViewerVisible(true);
    },
    [],
  );

  const handlePhotoPress = useCallback(
    (photoUrl: string, previewKey: string) => {
      const previewNode = photoPreviewRefs.current.get(previewKey);
      if (!previewNode || typeof previewNode.measureInWindow !== 'function') {
        openPhotoViewer(photoUrl, null, previewKey);
        return;
      }

      previewNode.measureInWindow((x, y, width, height) => {
        const hasValidRect =
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(width) &&
          Number.isFinite(height) &&
          width > 0 &&
          height > 0;

        openPhotoViewer(
          photoUrl,
          hasValidRect ? { x, y, width, height } : null,
          previewKey,
        );
      });
    },
    [openPhotoViewer],
  );

  const handleClosePhotoViewer = useCallback(() => {
    setPhotoViewerPreviewKey(null);
    setPhotoViewerOriginRect(null);
    setPhotoViewerVisible(false);
    setPhotoViewerUrl(null);
  }, []);

  const setBookmarkPending = useCallback(
    (statusId: string, pending: boolean) => {
      setPendingBookmarkIds(previous => {
        const next = new Set(previous);
        if (pending) {
          next.add(statusId);
        } else {
          next.delete(statusId);
        }
        return next;
      });
    },
    [],
  );

  const getIsFavorited = useCallback(
    (statusItem: FanfouStatus) => {
      const override = favoritedOverrides[getStatusId(statusItem)];
      return override ?? statusItem.favorited;
    },
    [favoritedOverrides],
  );

  const handleToggleBookmark = useCallback(
    async (statusItem: FanfouStatus) => {
      const statusId = getStatusId(statusItem);
      if (pendingBookmarkIds.has(statusId)) {
        return;
      }

      const currentFavorited = getIsFavorited(statusItem);
      const nextFavorited = !currentFavorited;

      setBookmarkPending(statusId, true);
      setFavoritedOverrides(previous => ({
        ...previous,
        [statusId]: nextFavorited,
      }));

      try {
        await post(nextFavorited ? '/favorites/create' : '/favorites/destroy', {
          id: statusId,
        });
      } catch (requestError) {
        setFavoritedOverrides(previous => ({
          ...previous,
          [statusId]: currentFavorited,
        }));
        Alert.alert(
          'Bookmark failed',
          getErrorMessage(requestError, 'Please try again.'),
        );
      } finally {
        setBookmarkPending(statusId, false);
      }
    },
    [getIsFavorited, pendingBookmarkIds, setBookmarkPending],
  );

  const handleOpenReplyComposer = useCallback((statusItem: FanfouStatus) => {
    const statusId = getStatusId(statusItem);
    const userId = statusItem.user.id.trim();
    const screenName = statusItem.user.screen_name.trim();
    if (!userId || !screenName) {
      Alert.alert('Cannot reply', 'Missing reply target.');
      return;
    }

    setComposeMode('reply');
    setComposeReplyTarget({ statusId, userId, screenName });
    setComposeRepostTarget(null);
  }, []);

  const handleOpenRepostComposer = useCallback((statusItem: FanfouStatus) => {
    const statusId = getStatusId(statusItem);
    const screenName = statusItem.user.screen_name.trim();
    setComposeMode('repost');
    setComposeRepostTarget({ statusId, screenName });
    setComposeReplyTarget(null);
  }, []);

  const handleCloseComposer = useCallback(() => {
    setComposeMode(null);
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
  }, []);

  const handleSendComposer = useCallback(
    async ({ text, photo }: ComposerModalSubmitPayload) => {
      if (!composeMode) {
        return;
      }

      const trimmedText = text.trim();
      const hasPhoto = Boolean(photo?.base64);

      if (composeMode === 'reply') {
        if (!composeReplyTarget) {
          Alert.alert('Cannot reply', 'Missing reply target.');
          return;
        }
        if (!trimmedText && !hasPhoto) {
          Alert.alert('Cannot reply', 'Please enter text or attach a photo.');
          return;
        }
      }

      if (composeMode === 'repost' && !composeRepostTarget) {
        Alert.alert('Cannot repost', 'Missing repost target.');
        return;
      }

      try {
        if (composeMode === 'reply' && composeReplyTarget) {
          if (photo?.base64) {
            await uploadPhoto({
              photoBase64: photo.base64,
              status: trimmedText || undefined,
              params: {
                in_reply_to_status_id: composeReplyTarget.statusId,
                in_reply_to_user_id: composeReplyTarget.userId,
              },
            });
          } else {
            await post('/statuses/update', {
              status: trimmedText,
              in_reply_to_status_id: composeReplyTarget.statusId,
              in_reply_to_user_id: composeReplyTarget.userId,
            });
          }
        }

        if (composeMode === 'repost' && composeRepostTarget) {
          await post('/statuses/update', {
            status: trimmedText || undefined,
            repost_status_id: composeRepostTarget.statusId,
          });
        }

        setComposeMode(null);
        setComposeReplyTarget(null);
        setComposeRepostTarget(null);
        Alert.alert(
          'Sent',
          composeMode === 'reply' ? 'Reply posted.' : 'Reposted.',
        );
      } catch (requestError) {
        Alert.alert(
          composeMode === 'reply' ? 'Reply failed' : 'Repost failed',
          getErrorMessage(requestError, 'Please try again.'),
        );
      }
    },
    [composeMode, composeReplyTarget, composeRepostTarget],
  );

  const renderStatusCard = useCallback(
    (statusItem: FanfouStatus, isMainStatus: boolean) => {
      const statusId = getStatusId(statusItem);
      const isFavorited = getIsFavorited(statusItem);
      const cardStatus =
        statusItem.favorited === isFavorited
          ? statusItem
          : { ...statusItem, favorited: isFavorited };

      return (
        <TimelineStatusCard
          key={`${statusId}-${isMainStatus ? 'main' : 'context'}`}
          status={cardStatus}
          accent={accent}
          muted={muted}
          shadowType={isMainStatus ? 'accent' : 'default'}
          isBookmarkPending={pendingBookmarkIds.has(statusId)}
          photoViewerVisible={photoViewerVisible}
          photoViewerPreviewKey={photoViewerPreviewKey}
          registerPhotoPreviewRef={registerPhotoPreviewRef}
          onOpenPhoto={handlePhotoPress}
          onPressStatus={handleOpenStatusDetail}
          onPressProfile={handleProfilePress}
          onPressMention={handleMentionPress}
          onPressTag={handleTagPress}
          onReply={handleOpenReplyComposer}
          onRepost={handleOpenRepostComposer}
          onToggleBookmark={handleToggleBookmark}
        />
      );
    },
    [
      accent,
      getIsFavorited,
      handleMentionPress,
      handleOpenReplyComposer,
      handleOpenRepostComposer,
      handleOpenStatusDetail,
      handlePhotoPress,
      handleProfilePress,
      handleTagPress,
      handleToggleBookmark,
      muted,
      pendingBookmarkIds,
      photoViewerPreviewKey,
      photoViewerVisible,
      registerPhotoPreviewRef,
    ],
  );

  const composerTitle =
    composeMode === 'reply'
      ? composeReplyTarget
        ? `Reply @${composeReplyTarget.screenName}`
        : 'Reply'
      : composeRepostTarget?.screenName
      ? `Repost @${composeRepostTarget.screenName}`
      : 'Repost';
  const composerPlaceholder =
    composeMode === 'reply'
      ? 'Write your reply...'
      : 'Add a comment (optional)...';
  const composerSubmitLabel = composeMode === 'reply' ? 'Reply' : 'Repost';
  const composerInitialText =
    composeMode === 'reply' && composeReplyTarget
      ? `@${composeReplyTarget.screenName} `
      : '';
  const composerResetKey =
    composeMode === 'reply'
      ? `reply:${composeReplyTarget?.statusId ?? ''}`
      : composeMode === 'repost'
      ? `repost:${composeRepostTarget?.statusId ?? ''}`
      : 'closed';

  if (!routeStatusId) {
    return (
      <View className="flex-1 bg-background px-4 pt-8">
        <Surface className="bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            Missing status id.
          </Text>
        </Surface>
      </View>
    );
  }

  return (
    <>
      <NativeEdgeScrollShadow
        className="flex-1 bg-background"
        color={background}
      >
        <ScrollView
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={contentContainerStyle}
          refreshControl={
            <RefreshControl
              refreshing={isPullToRefreshing}
              onRefresh={handleRefresh}
              tintColor={accent}
              colors={[accent]}
              progressViewOffset={Math.max(
                STATUS_DETAIL_PROGRESS_OFFSET,
                insets.top,
              )}
              progressBackgroundColor={background}
            />
          }
        >
          {isHydratingStatus ? (
            <TimelineSkeletonList
              keyPrefix="status-detail-skeleton"
              count={1}
            />
          ) : null}

          {!mainStatus && !isStatusLoading && !isContextLoading ? (
            <DropShadowBox type="danger" containerClassName="pb-2">
              <Surface
                className={`bg-surface border-2 ${getDropShadowBorderClass(
                  'danger',
                )} px-4 py-3`}
              >
                <Text className="text-[13px] text-danger">
                  {statusErrorMessage ?? 'Failed to load status.'}
                </Text>
              </Surface>
            </DropShadowBox>
          ) : null}

          {mainStatus ? (
            <View style={{ gap: TIMELINE_SPACING }}>
              {beforeStatuses.map(item => renderStatusCard(item, false))}
              {renderStatusCard(mainStatus, true)}
              {afterStatuses.map(item => renderStatusCard(item, false))}
            </View>
          ) : null}

          {contextErrorMessage && mainStatus ? (
            <Surface className="bg-danger-soft px-4 py-3">
              <Text className="text-[13px] text-danger-foreground">
                {contextErrorMessage}
              </Text>
            </Surface>
          ) : null}

          {isContextLoading && mainStatus ? (
            <View className="items-center py-3 flex-row justify-center gap-2">
              <ActivityIndicator color={accent} />
              <Text className="text-[12px] text-muted">
                Loading conversation...
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </NativeEdgeScrollShadow>

      <PhotoViewerModal
        visible={photoViewerVisible}
        photoUrl={photoViewerUrl}
        topInset={insets.top}
        originRect={photoViewerOriginRect}
        onClose={handleClosePhotoViewer}
      />

      <ComposerModal
        visible={composeMode !== null}
        title={composerTitle}
        placeholder={composerPlaceholder}
        submitLabel={composerSubmitLabel}
        topInset={insets.top}
        initialText={composerInitialText}
        resetKey={composerResetKey}
        enablePhoto={composeMode === 'reply'}
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
    </>
  );
};

export default StatusDetailRoute;
