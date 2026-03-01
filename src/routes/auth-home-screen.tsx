import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { showToastAlert } from '@/utils/toast-alert';
import {
  FlatList,
  Image,
  RefreshControl,
  useWindowDimensions,
  View,
} from 'react-native';
import NeobrutalActivityIndicator, {
  COMPACT_PULL_THRESHOLD,
  NeobrutalRefreshIndicator,
} from '@/components/neobrutal-activity-indicator';
import { usePullScrollY } from '@/components/use-pull-to-refresh';
import {
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollShadow, useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import { scheduleOnRN } from 'react-native-worklets';
import {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAuthSession } from '@/auth/auth-session';
import { get, post, uploadPhoto } from '@/auth/fanfou-client';
import type { AuthStackParamList, AuthTabParamList } from '@/navigation/types';
import LinearGradient from 'react-native-linear-gradient';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
import TimelineStatusCard from '@/components/timeline-status-card';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import TimelineTitleHeader from '@/components/timeline-title-header';
import { isHydratingTimeline } from '@/components/timeline-hydration';
import {
  TIMELINE_AUTO_REFRESH_INTERVAL_MS,
  TIMELINE_INITIAL_PAGE_SIZE,
  TIMELINE_PAGE_SIZE,
  TIMELINE_SCROLL_TOP_THRESHOLD,
  TIMELINE_TOP_CONTENT_GAP,
  useTimelineListSettings,
} from '@/components/timeline-list-settings';
import {
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
} from '@/navigation/route-names';
import type { FanfouStatus } from '@/types/fanfou';
import { Text } from '@/components/app-text';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import { getTabBarOccludedHeight } from '@/navigation/tab-bar-layout';
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
const AuthHomeRoute = () => {
  const { t } = useTranslation();
  const auth = useAuthSession();
  const authUserId = auth.accessToken?.userId ?? null;
  const navigation = useNavigation<BottomTabNavigationProp<AuthTabParamList>>();
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
  const scrollY = useSharedValue(0);
  const isAtTop = useSharedValue(true);
  const [isAtTopState, setIsAtTopState] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isFetchingLatest, setIsFetchingLatest] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasReachedTimelineEnd, setHasReachedTimelineEnd] = useState(false);
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
  const [composeMode, setComposeMode] = useState<TimelineComposerMode>(null);
  const [composeReplyTarget, setComposeReplyTarget] =
    useState<ReplyTarget | null>(null);
  const [composeRepostTarget, setComposeRepostTarget] =
    useState<RepostTarget | null>(null);
  useEffect(() => {
    setTimelineItems([]);
    setHasReachedTimelineEnd(false);
  }, [authUserId]);
  useScrollToTop(listRef);
  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } =
    usePullScrollY();
  const updateIsAtTop = (value: boolean) => {
    setIsAtTopState(value);
  };
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
      updatePullScrollY(event.contentOffset.y);
      const atTop = event.contentOffset.y <= TIMELINE_SCROLL_TOP_THRESHOLD;
      if (atTop !== isAtTop.value) {
        isAtTop.value = atTop;
        scheduleOnRN(updateIsAtTop, atTop);
      }
    },
  });
  const titleContainerStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, 88],
      [44, 0],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollY.value,
      [0, 70],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const marginBottom = interpolate(
      scrollY.value,
      [0, 88],
      [0, 0],
      Extrapolation.CLAMP,
    );
    return {
      height,
      opacity,
      marginBottom,
    };
  });
  const titleTextStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 88],
      [1, 0.6],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        {
          scale,
        },
      ],
      transformOrigin: 'top left',
    };
  });
  const handleMentionPress = (userId: string) => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId,
      },
    });
  };
  const handleProfilePress = (userId: string) => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId,
      },
    });
  };
  const handleStatusPress = (statusId: string) => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.STATUS, {
      screen: AUTH_STATUS_ROUTE.DETAIL,
      params: {
        statusId,
      },
    });
  };
  const handleTagPress = (tag: string) => {
    const normalizedTag = tag.trim().replace(/^#+/, '').replace(/#+$/, '');
    if (!normalizedTag) {
      return;
    }
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.TAG_TIMELINE, {
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
    Image.prefetch(photoUrl).catch(() => undefined);
    setPhotoViewerPreviewKey(previewKey);
    setPhotoViewerOriginRect(originRect);
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
    data: initialItems = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['timeline', 'home', authUserId ?? ''],
    queryFn: async () => {
      if (!authUserId) {
        return [];
      }
      const data = await get('/statuses/home_timeline', {
        count: TIMELINE_INITIAL_PAGE_SIZE,
        mode: 'default',
      });
      return normalizeTimelineItems(data);
    },
    enabled: Boolean(authUserId),
    retry: 1,
  });
  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : t('homeLoadFailed')
    : null;
  useEffect(() => {
    if (initialItems.length === 0 || timelineItems.length > 0) {
      return;
    }
    setTimelineItems(initialItems);
    setHasReachedTimelineEnd(false);
  }, [initialItems, timelineItems.length]);
  const fetchLatest = async () => {
    if (!authUserId || isFetchingLatest || isLoading) {
      return;
    }
    const sinceId =
      timelineItems.length > 0 ? getStatusId(timelineItems[0]) : null;
    if (!sinceId) {
      await refetch();
      return;
    }
    setIsFetchingLatest(true);
    try {
      const data = await get('/statuses/home_timeline', {
        count: TIMELINE_PAGE_SIZE,
        since_id: sinceId,
        mode: 'default',
      });
      const nextItems = normalizeTimelineItems(data);
      if (nextItems.length === 0) {
        return;
      }
      setTimelineItems(prev => mergeTimelineItems(prev, nextItems, 'prepend'));
    } finally {
      setIsFetchingLatest(false);
    }
  };
  const fetchMore = async () => {
    if (!authUserId || isFetchingMore || isLoading || hasReachedTimelineEnd) {
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
      const data = await get('/statuses/home_timeline', {
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
      setTimelineItems(prev => {
        const merged = mergeTimelineItems(prev, nextItems, 'append');
        hasAppended = merged.length > prev.length;
        return merged;
      });
      if (!hasAppended) {
        setHasReachedTimelineEnd(true);
      }
    } finally {
      setIsFetchingMore(false);
    }
  };
  const runFetchLatestEffect = useEffectEvent(() => {
    fetchLatest().catch(() => undefined);
  });
  useEffect(() => {
    if (!isAtTopState || isLoading) {
      return;
    }
    const interval = setInterval(() => {
      runFetchLatestEffect();
    }, TIMELINE_AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAtTopState, isLoading]);
  useEffect(() => {
    if (!isAtTopState || isLoading) {
      return;
    }
    runFetchLatestEffect();
  }, [isAtTopState, isLoading]);
  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    try {
      await fetchLatest();
    } finally {
      setIsRefreshing(false);
    }
  };
  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      tintColor="transparent"
      colors={['transparent']}
    />
  );
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
        showToastAlert(t('cannotReplyTitle'), t('replyMissingTarget'));
        return;
      }
      if (!trimmedText && !hasPhoto) {
        showToastAlert(t('cannotReplyTitle'), t('replyNeedsContent'));
        return;
      }
    }
    if (composeMode === 'repost' && !composeRepostTarget) {
      showToastAlert(t('cannotRepostTitle'), t('repostMissingTarget'));
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
      showToastAlert(
        t('sentTitle'),
        composeMode === 'reply' ? t('replySent') : t('repostSent'),
      );
    } catch (requestError) {
      showToastAlert(
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
      showToastAlert(
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
      statusId,
      t,
      onDeleted: () => {
        setTimelineItems(previous =>
          previous.filter(item => getStatusId(item) !== statusId),
        );
      },
    });
  };
  const timelineListSettings = useTimelineListSettings(insets);
  const isHydratingTimelineItems = isHydratingTimeline({
    isLoading,
    renderedItems: timelineItems,
    sourceItems: initialItems,
  });
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
  return (
    <>
      <ScrollShadow
        LinearGradientComponent={LinearGradient}
        size={100}
        color={background}
      >
        <FlatList
          ref={listRef}
          data={timelineItems}
          keyExtractor={item => getStatusId(item)}
          refreshControl={refreshControl}
          onScroll={scrollHandler}
          scrollEventThrottle={timelineListSettings.scrollEventThrottle}
          scrollIndicatorInsets={timelineListSettings.scrollIndicatorInsets}
          contentContainerStyle={timelineListSettings.contentContainerStyle}
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
            <TimelineTitleHeader
              title={t('homeTitle')}
              titleContainerStyle={titleContainerStyle}
              titleTextStyle={titleTextStyle}
              errorMessage={errorMessage}
            />
          }
          ListEmptyComponent={
            isLoading || isHydratingTimelineItems ? (
              <TimelineSkeletonList
                keyPrefix="timeline-skeleton"
                availableHeight={skeletonAvailableHeight}
              />
            ) : (
              <TimelineSkeletonCard message={t('homeEmpty')} />
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
      </ScrollShadow>
      <NeobrutalRefreshIndicator
        refreshing={isRefreshing}
        scrollY={pullScrollY}
        safeAreaTop={safeAreaTop}
        scrollInsetTop={scrollInsetTop}
        pullThreshold={COMPACT_PULL_THRESHOLD}
      />
      <PhotoViewerModal
        visible={photoViewerVisible}
        photoUrl={photoViewerUrl}
        topInset={insets.top}
        bottomOccludedHeight={getTabBarOccludedHeight(insets.bottom)}
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
export default AuthHomeRoute;
