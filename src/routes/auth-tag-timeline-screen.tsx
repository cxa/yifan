import React, { useEffect, useRef, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import {
  FlatList,
  Image,
  Platform,
  RefreshControl,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useHeaderHeight } from '@react-navigation/elements';
import NeobrutalActivityIndicator, {
  COMPACT_PULL_THRESHOLD,
  NeobrutalRefreshIndicator,
} from '@/components/neobrutal-activity-indicator';
import {
  usePullScrollY,
  usePullRefreshState,
} from '@/components/use-pull-to-refresh';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, useThemeColor } from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthSession } from '@/auth/auth-session';
import { get, post } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
import NativeEdgeScrollShadow, {
  resolveNativeEdgeScrollShadowSize,
} from '@/components/native-edge-scroll-shadow';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import { shouldUsePhotoSharedTransition } from '@/components/photo-viewer-shared-transition';
import { getTabBarOccludedHeight } from '@/navigation/tab-bar-layout';
import TimelineStatusCard from '@/components/timeline-status-card';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import { isHydratingTimeline } from '@/components/timeline-hydration';
import {
  TIMELINE_INITIAL_PAGE_SIZE,
  TIMELINE_PAGE_SIZE,
  TIMELINE_TOP_CONTENT_GAP,
  useTimelineListSettings,
} from '@/components/timeline-list-settings';
import {
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
} from '@/navigation/route-names';
import { useStatusUpdateMutation } from '@/query/post-mutations';
import useNativeHeaderTitle from '@/navigation/use-native-header-title';
import type {
  AuthStackParamList,
  AuthTagStackParamList,
} from '@/navigation/types';
import type { FanfouStatus } from '@/types/fanfou';
type PhotoViewerOriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type TimelineComposerMode = 'reply' | 'repost' | null;
type ReplyTarget = {
  statusId: string;
  userId: string;
  screenName: string;
};
type RepostTarget = {
  statusId: string;
  screenName: string;
};
const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];
const normalizeTag = (value: string) => {
  let decodedValue = value;
  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    decodedValue = value;
  }
  return decodedValue.trim().replace(/^#+/, '').replace(/#+$/, '').trim();
};
const getStatusId = (status: FanfouStatus): string => status.id;
const mergeTimelineItems = (
  existing: FanfouStatus[],
  incoming: FanfouStatus[],
  position: 'prepend' | 'append',
) => {
  const seen = new Set<string>();
  const nextItems =
    position === 'prepend'
      ? [...incoming, ...existing]
      : [...existing, ...incoming];
  const merged: FanfouStatus[] = [];
  for (const item of nextItems) {
    const id = getStatusId(item);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    merged.push(item);
  }
  return merged;
};
const TagTimelineRoute = () => {
  const { t } = useTranslation();
  const auth = useAuthSession();
  const authUserId = auth.accessToken?.userId ?? null;
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route =
    useRoute<
      RouteProp<AuthTagStackParamList, typeof AUTH_TAG_TIMELINE_ROUTE.DETAIL>
    >();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const skeletonAvailableHeight =
    windowHeight -
    insets.top -
    TIMELINE_TOP_CONTENT_GAP -
    getTabBarOccludedHeight(insets.bottom);
  const routeTag = normalizeTag(route.params.tag);
  const screenTitle = t('tagTimelineTitle', {
    tag: routeTag,
  });
  useNativeHeaderTitle({
    title: routeTag ? screenTitle : t('tagTimelineFallbackTitle'),
  });
  const [timelineItems, setTimelineItems] = useState<FanfouStatus[]>([]);
  const [pendingBookmarkIds, setPendingBookmarkIds] = useState<Set<string>>(
    () => new Set(),
  );
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
  const listRef = useRef<FlatList<FanfouStatus>>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasReachedTimelineEnd, setHasReachedTimelineEnd] = useState(false);
  const [composeMode, setComposeMode] = useState<TimelineComposerMode>(null);
  const [composeReplyTarget, setComposeReplyTarget] =
    useState<ReplyTarget | null>(null);
  const [composeRepostTarget, setComposeRepostTarget] =
    useState<RepostTarget | null>(null);
  const statusUpdateMutation = useStatusUpdateMutation();
  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } =
    usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      updatePullScrollY(event.contentOffset.y);
    },
  });
  const handleMentionPress = (userId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId,
      },
    });
  };
  const handleProfilePress = (userId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId,
      },
    });
  };
  const handleStatusPress = (statusId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.STATUS, {
      screen: AUTH_STATUS_ROUTE.DETAIL,
      params: {
        statusId,
      },
    });
  };
  const handleTagPress = (tag: string) => {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) {
      return;
    }
    if (normalizedTag.toLowerCase() === routeTag.toLowerCase()) {
      return;
    }
    navigation.navigate(AUTH_STACK_ROUTE.TAG_TIMELINE, {
      screen: AUTH_TAG_TIMELINE_ROUTE.DETAIL,
      params: {
        tag: normalizedTag,
      },
    });
  };
  const openPhotoViewer = (
    photoUrl: string,
    originRect: PhotoViewerOriginRect | null,
    previewKey: string,
  ) => {
    const useSharedTransition = shouldUsePhotoSharedTransition({
      originRect,
      viewportHeight: windowHeight,
      topInset: insets.top,
      bottomOccludedHeight: getTabBarOccludedHeight(insets.bottom),
      scrollShadowSize,
    });
    Image.prefetch(photoUrl).catch(() => undefined);
    setPhotoViewerPreviewKey(useSharedTransition ? previewKey : null);
    setPhotoViewerOriginRect(useSharedTransition ? originRect : null);
    setPhotoViewerUrl(photoUrl);
    setPhotoViewerVisible(true);
  };
  const registerPhotoPreviewRef = (
    key: string,
    node: React.ComponentRef<typeof View> | null,
  ) => {
    if (node) {
      photoPreviewRefs.current.set(key, node);
      return;
    }
    photoPreviewRefs.current.delete(key);
  };
  const handlePhotoPress = (photoUrl: string, previewKey: string) => {
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
        hasValidRect
          ? {
              x,
              y,
              width,
              height,
            }
          : null,
        previewKey,
      );
    });
  };
  const handleClosePhotoViewer = () => {
    setPhotoViewerPreviewKey(null);
    setPhotoViewerOriginRect(null);
    setPhotoViewerVisible(false);
    setPhotoViewerUrl(null);
  };
  const {
    data: queryItems,
    isLoading,
    error,
    refetch,
  } = useQuery<FanfouStatus[]>({
    queryKey: ['timeline', 'tag', routeTag],
    queryFn: async () => {
      const data = await get('/search/public_timeline', {
        q: routeTag,
        count: TIMELINE_INITIAL_PAGE_SIZE,
        mode: 'default',
      });
      return normalizeTimelineItems(data);
    },
    enabled: Boolean(routeTag),
    retry: 1,
  });
  useEffect(() => {
    if (!queryItems) {
      return;
    }
    setTimelineItems(queryItems);
    setHasReachedTimelineEnd(false);
  }, [queryItems]);
  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : t('tagTimelineLoadFailed')
    : null;
  const setBookmarkPending = (statusId: string, pending: boolean) => {
    setPendingBookmarkIds(previous => {
      const next = new Set(previous);
      if (pending) {
        next.add(statusId);
      } else {
        next.delete(statusId);
      }
      return next;
    });
  };
  const handleOpenReplyComposer = (status: FanfouStatus) => {
    const statusId = getStatusId(status);
    const userId = status.user.id.trim();
    const screenName = status.user.screen_name.trim();
    setComposeMode('reply');
    setComposeReplyTarget({
      statusId,
      userId,
      screenName,
    });
    setComposeRepostTarget(null);
  };
  const handleOpenRepostComposer = (status: FanfouStatus) => {
    const statusId = getStatusId(status);
    const screenName = status.user.screen_name.trim();
    setComposeMode('repost');
    setComposeRepostTarget({
      statusId,
      screenName,
    });
    setComposeReplyTarget(null);
  };
  const handleCloseComposer = () => {
    setComposeMode(null);
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
  };
  const handleSendComposer = async ({
    text,
    photo,
  }: ComposerModalSubmitPayload) => {
    if (!composeMode) {
      return;
    }
    const trimmedText = text.trim();
    const hasPhoto = Boolean(photo?.base64);
    if (composeMode === 'reply') {
      if (!composeReplyTarget) {
        showVariantToast(
          'danger',
          t('cannotReplyTitle'),
          t('replyMissingTarget'),
        );
        return;
      }
      if (!trimmedText && !hasPhoto) {
        showVariantToast(
          'danger',
          t('cannotReplyTitle'),
          t('replyNeedsContent'),
        );
        return;
      }
    }
    if (composeMode === 'repost' && !composeRepostTarget) {
      showVariantToast(
        'danger',
        t('cannotRepostTitle'),
        t('repostMissingTarget'),
      );
      return;
    }
    try {
      if (composeMode === 'reply' && composeReplyTarget) {
        await statusUpdateMutation.mutateAsync({
          status: photo?.base64 ? trimmedText || undefined : trimmedText,
          photoBase64: photo?.base64,
          params: {
            in_reply_to_status_id: composeReplyTarget.statusId,
            in_reply_to_user_id: composeReplyTarget.userId,
          },
        });
      }
      if (composeMode === 'repost' && composeRepostTarget) {
        await statusUpdateMutation.mutateAsync({
          status: trimmedText || undefined,
          params: {
            repost_status_id: composeRepostTarget.statusId,
          },
        });
      }
      setComposeMode(null);
      setComposeReplyTarget(null);
      setComposeRepostTarget(null);
      showVariantToast(
        'success',
        t('sentTitle'),
        composeMode === 'reply' ? t('replySent') : t('repostSent'),
      );
    } catch (requestError) {
      showVariantToast(
        'danger',
        composeMode === 'reply'
          ? t('replyFailedTitle')
          : t('repostFailedTitle'),
        requestError instanceof Error
          ? requestError.message
          : t('retryMessage'),
      );
    }
  };
  const handleToggleBookmark = async (status: FanfouStatus) => {
    const statusId = getStatusId(status);
    if (pendingBookmarkIds.has(statusId)) {
      return;
    }
    const nextFavorited = !status.favorited;
    setBookmarkPending(statusId, true);
    setTimelineItems(previous =>
      previous.map(item =>
        getStatusId(item) === statusId
          ? {
              ...item,
              favorited: nextFavorited,
            }
          : item,
      ),
    );
    try {
      await post(nextFavorited ? '/favorites/create' : '/favorites/destroy', {
        id: statusId,
      });
    } catch (requestError) {
      setTimelineItems(previous =>
        previous.map(item =>
          getStatusId(item) === statusId
            ? {
                ...item,
                favorited: !nextFavorited,
              }
            : item,
        ),
      );
      showVariantToast(
        'danger',
        t('bookmarkFailedTitle'),
        requestError instanceof Error
          ? requestError.message
          : t('retryMessage'),
      );
    } finally {
      setBookmarkPending(statusId, false);
    }
  };
  const handleDeleteStatus = (status: FanfouStatus) => {
    const statusId = getStatusId(status);
    return deleteStatus({
      queryClient,
      statusId,
      t,
      onDeleted: () => {
        setTimelineItems(previous =>
          previous.filter(item => getStatusId(item) !== statusId),
        );
      },
    });
  };
  const fetchMore = async () => {
    if (isFetchingMore || isLoading || hasReachedTimelineEnd) {
      return;
    }
    const maxId =
      timelineItems.length > 0
        ? getStatusId(timelineItems[timelineItems.length - 1])
        : null;
    if (!maxId) {
      return;
    }
    setIsFetchingMore(true);
    try {
      const data = await get('/search/public_timeline', {
        q: routeTag,
        count: TIMELINE_PAGE_SIZE,
        max_id: maxId,
        mode: 'default',
      });
      const nextItems = normalizeTimelineItems(data);
      if (nextItems.length === 0) {
        setHasReachedTimelineEnd(true);
        return;
      }
      let hasAppended = false;
      setTimelineItems(previous => {
        const merged = mergeTimelineItems(previous, nextItems, 'append');
        hasAppended = merged.length > previous.length;
        return merged;
      });
      if (!hasAppended) {
        setHasReachedTimelineEnd(true);
      }
    } finally {
      setIsFetchingMore(false);
    }
  };
  const { isPullRefreshing, handlePullRefresh } = usePullRefreshState(refetch);
  const refreshControl = (
    <RefreshControl
      refreshing={isPullRefreshing}
      onRefresh={handlePullRefresh}
      tintColor="transparent"
      colors={['transparent']}
    />
  );
  const headerHeight = useHeaderHeight();
  const scrollShadowSize = resolveNativeEdgeScrollShadowSize({
    headerHeight,
  });
  const timelineListSettings = useTimelineListSettings(insets, {
    hasBottomTabBar: false,
  });
  const listContentContainerStyle = {
    ...timelineListSettings.contentContainerStyle,
    paddingTop: Platform.OS === 'android' ? headerHeight : 0,
  };
  const composerTitle =
    composeMode === 'reply'
      ? composeReplyTarget
        ? t('composerReplyTo', {
            name: composeReplyTarget.screenName,
          })
        : t('composerReply')
      : composeMode === 'repost'
      ? composeRepostTarget?.screenName
        ? t('composerRepostTo', {
            name: composeRepostTarget.screenName,
          })
        : t('composerRepost')
      : t('composerWritePost');
  const composerPlaceholder =
    composeMode === 'reply'
      ? t('composerReplyPlaceholder')
      : t('composerCommentPlaceholder');
  const composerSubmitLabel =
    composeMode === 'reply'
      ? t('composerSubmitReply')
      : t('composerSubmitRepost');
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
  const isHydratingTimelineItems = isHydratingTimeline({
    isLoading,
    renderedItems: timelineItems,
    sourceItems: queryItems,
  });
  if (!routeTag) {
    return (
      <View className="flex-1 bg-background px-4 pt-8">
        <View>
          <Surface className="bg-danger-soft px-4 py-3">
            <Text className="text-[13px] text-danger-foreground">
              {t('tagMissing')}
            </Text>
          </Surface>
        </View>
      </View>
    );
  }
  return (
    <>
      <NativeEdgeScrollShadow className="flex-1" color={background}>
        <Animated.FlatList
          ref={listRef}
          className="flex-1 bg-background"
          data={timelineItems}
          keyExtractor={item => getStatusId(item)}
          refreshControl={refreshControl}
          onScroll={scrollHandler}
          contentInsetAdjustmentBehavior="automatic"
          scrollEventThrottle={timelineListSettings.scrollEventThrottle}
          scrollIndicatorInsets={timelineListSettings.scrollIndicatorInsets}
          contentContainerStyle={listContentContainerStyle}
          ListFooterComponent={
            isFetchingMore ? (
              <View className="items-center py-6">
                <NeobrutalActivityIndicator size="small" />
              </View>
            ) : hasReachedTimelineEnd && timelineItems.length > 0 ? (
              <View className="items-center py-6">
                <Text className="text-[12px] tracking-[4px] text-muted">
                  FIN
                </Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            errorMessage ? (
              <Surface className="bg-danger-soft px-4 py-3">
                <Text className="text-[13px] text-danger-foreground">
                  {errorMessage}
                </Text>
              </Surface>
            ) : null
          }
          ListEmptyComponent={
            isLoading || isHydratingTimelineItems ? (
              <TimelineSkeletonList
                keyPrefix="tag-timeline-skeleton"
                availableHeight={skeletonAvailableHeight}
              />
            ) : (
              <TimelineSkeletonCard message={t('tagTimelineEmpty')} />
            )
          }
          onEndReached={fetchMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <TimelineStatusCard
              status={item}
              accent={accent}
              muted={muted}
              isBookmarkPending={pendingBookmarkIds.has(getStatusId(item))}
              photoViewerVisible={photoViewerVisible}
              photoViewerPreviewKey={photoViewerPreviewKey}
              activeTag={routeTag}
              registerPhotoPreviewRef={registerPhotoPreviewRef}
              onOpenPhoto={handlePhotoPress}
              onPressStatus={handleStatusPress}
              onPressProfile={handleProfilePress}
              onPressMention={handleMentionPress}
              onPressTag={handleTagPress}
              onReply={handleOpenReplyComposer}
              onRepost={handleOpenRepostComposer}
              onToggleBookmark={handleToggleBookmark}
              canDelete={isStatusOwnedByUser(item, authUserId)}
              onDelete={handleDeleteStatus}
            />
          )}
        />
        <PhotoViewerModal
          visible={photoViewerVisible}
          photoUrl={photoViewerUrl}
          topInset={insets.top}
          bottomOccludedHeight={getTabBarOccludedHeight(insets.bottom)}
          scrollShadowSize={scrollShadowSize}
          originRect={photoViewerOriginRect}
          onClose={handleClosePhotoViewer}
        />
      </NativeEdgeScrollShadow>

      <NeobrutalRefreshIndicator
        refreshing={isPullRefreshing}
        scrollY={pullScrollY}
        safeAreaTop={safeAreaTop}
        scrollInsetTop={scrollInsetTop}
        pullThreshold={COMPACT_PULL_THRESHOLD}
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
        isSubmitting={statusUpdateMutation.isPending}
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
    </>
  );
};
export default TagTimelineRoute;
