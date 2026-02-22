import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
  View,
} from 'react-native';
import {
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollShadow, Surface, useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { get, post, uploadPhoto } from '@/auth/fanfou-client';
import type { AuthStackParamList, AuthTabParamList } from '@/navigation/types';
import LinearGradient from 'react-native-linear-gradient';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import TimelineStatusCard from '@/components/timeline-status-card';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import { isHydratingTimeline } from '@/components/timeline-hydration';
import {
  TIMELINE_AUTO_REFRESH_INTERVAL_MS,
  TIMELINE_HORIZONTAL_PADDING,
  TIMELINE_INITIAL_PAGE_SIZE,
  TIMELINE_PAGE_SIZE,
  TIMELINE_SCROLL_TOP_THRESHOLD,
  useTimelineListSettings,
} from '@/components/timeline-list-settings';
import type { FanfouStatus } from '@/types/fanfou';
import { AnimatedText, Text } from '@/components/app-text';
import PhotoViewerModal from '@/components/photo-viewer-modal';

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
  const navigation = useNavigation<BottomTabNavigationProp<AuthTabParamList>>();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const insets = useSafeAreaInsets();
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
  const latestIdRef = useRef<string | null>(null);
  const oldestIdRef = useRef<string | null>(null);
  const [composeMode, setComposeMode] = useState<TimelineComposerMode>(null);
  const [composeReplyTarget, setComposeReplyTarget] =
    useState<ReplyTarget | null>(null);
  const [composeRepostTarget, setComposeRepostTarget] =
    useState<RepostTarget | null>(null);
  useScrollToTop(listRef);
  const updateIsAtTop = useCallback((value: boolean) => {
    setIsAtTopState(value);
  }, []);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
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
      transform: [{ scale }],
      transformOrigin: 'top left',
    };
  });
  const handleMentionPress = useCallback(
    (userId: string) => {
      const parentNavigation =
        navigation.getParent<NavigationProp<AuthStackParamList>>();
      if (!parentNavigation) {
        return;
      }
      parentNavigation.navigate('route_root._auth.profile', {
        screen: 'route_root._auth.profile._handle',
        params: { userId },
      });
    },
    [navigation],
  );
  const handleProfilePress = useCallback(
    (userId: string) => {
      const parentNavigation =
        navigation.getParent<NavigationProp<AuthStackParamList>>();
      if (!parentNavigation) {
        return;
      }
      parentNavigation.navigate('route_root._auth.profile', {
        screen: 'route_root._auth.profile._handle',
        params: { userId },
      });
    },
    [navigation],
  );
  const handleStatusPress = useCallback(
    (statusId: string) => {
      const parentNavigation =
        navigation.getParent<NavigationProp<AuthStackParamList>>();
      if (!parentNavigation) {
        return;
      }
      parentNavigation.navigate('route_root._auth.status', {
        screen: 'route_root._auth.status._statusId',
        params: { statusId },
      });
    },
    [navigation],
  );
  const handleTagPress = useCallback(
    (tag: string) => {
      const normalizedTag = tag.trim().replace(/^#+/, '').replace(/#+$/, '');
      if (!normalizedTag) {
        return;
      }
      const parentNavigation =
        navigation.getParent<NavigationProp<AuthStackParamList>>();
      if (!parentNavigation) {
        return;
      }
      parentNavigation.navigate('route_root._auth.tag', {
        screen: 'route_root._auth.tag._tag',
        params: { tag: normalizedTag },
      });
    },
    [navigation],
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
  const {
    data: initialItems = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['timeline', 'home'],
    queryFn: async () => {
      const data = await get('/statuses/home_timeline', {
        count: TIMELINE_INITIAL_PAGE_SIZE,
        mode: 'default',
      });
      return normalizeTimelineItems(data);
    },
    retry: 1,
  });

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : 'Failed to load timeline.'
    : null;

  useEffect(() => {
    if (initialItems.length === 0 || timelineItems.length > 0) {
      return;
    }
    setTimelineItems(initialItems);
    setHasReachedTimelineEnd(false);
  }, [initialItems, timelineItems.length]);

  useEffect(() => {
    if (timelineItems.length === 0) {
      latestIdRef.current = null;
      oldestIdRef.current = null;
      return;
    }
    latestIdRef.current = getStatusId(timelineItems[0]);
    oldestIdRef.current = getStatusId(timelineItems[timelineItems.length - 1]);
  }, [timelineItems]);

  const fetchLatest = useCallback(async () => {
    if (isFetchingLatest || isLoading) {
      return;
    }
    const sinceId = latestIdRef.current;
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
  }, [isFetchingLatest, isLoading, refetch]);

  const fetchMore = useCallback(async () => {
    if (isFetchingMore || isLoading || hasReachedTimelineEnd) {
      return;
    }
    const maxId = oldestIdRef.current;
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
  }, [hasReachedTimelineEnd, isFetchingMore, isLoading]);

  useEffect(() => {
    if (!isAtTopState || isLoading) {
      return;
    }
    const interval = setInterval(() => {
      fetchLatest();
    }, TIMELINE_AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchLatest, isAtTopState, isLoading]);

  useEffect(() => {
    if (!isAtTopState || isLoading) {
      return;
    }
    fetchLatest();
  }, [fetchLatest, isAtTopState, isLoading]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    try {
      await fetchLatest();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchLatest, isRefreshing]);

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

  const handleOpenReplyComposer = useCallback((status: FanfouStatus) => {
    const statusId = getStatusId(status);
    const userId = status.user.id.trim();
    const screenName = status.user.screen_name.trim();

    setComposeMode('reply');
    setComposeReplyTarget({ statusId, userId, screenName });
    setComposeRepostTarget(null);
  }, []);

  const handleOpenRepostComposer = useCallback((status: FanfouStatus) => {
    const statusId = getStatusId(status);
    const screenName = status.user.screen_name.trim();
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
          requestError instanceof Error
            ? requestError.message
            : 'Please try again.',
        );
      }
    },
    [composeMode, composeReplyTarget, composeRepostTarget],
  );

  const handleToggleBookmark = useCallback(
    async (status: FanfouStatus) => {
      const statusId = getStatusId(status);
      if (pendingBookmarkIds.has(statusId)) {
        return;
      }

      const nextFavorited = !status.favorited;
      setBookmarkPending(statusId, true);
      setTimelineItems(previous =>
        previous.map(item =>
          getStatusId(item) === statusId
            ? { ...item, favorited: nextFavorited }
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
              ? { ...item, favorited: !nextFavorited }
              : item,
          ),
        );
        Alert.alert(
          'Bookmark failed',
          requestError instanceof Error
            ? requestError.message
            : 'Please try again.',
        );
      } finally {
        setBookmarkPending(statusId, false);
      }
    },
    [pendingBookmarkIds, setBookmarkPending],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        tintColor={accent}
        colors={[accent]}
        progressViewOffset={Math.max(insets.top, TIMELINE_HORIZONTAL_PADDING)}
        progressBackgroundColor={background}
      />
    ),
    [accent, background, handleRefresh, insets.top, isRefreshing],
  );
  const timelineListSettings = useTimelineListSettings(insets);
  const isHydratingTimelineItems = isHydratingTimeline({
    isLoading,
    renderedItems: timelineItems,
    sourceItems: initialItems,
  });
  const composerTitle =
    composeMode === 'reply'
      ? composeReplyTarget
        ? `Reply @${composeReplyTarget.screenName}`
        : 'Reply'
      : composeMode === 'repost'
      ? composeRepostTarget?.screenName
        ? `Repost @${composeRepostTarget.screenName}`
        : 'Repost'
      : 'Compose';
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
                <ActivityIndicator color={accent} />
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
            <View className="px-1 relative -bottom-2">
              <Animated.View
                className="overflow-hidden justify-end"
                style={titleContainerStyle}
              >
                <AnimatedText
                  className="text-[34px] font-bold text-foreground leading-[40px]"
                  style={titleTextStyle}
                >
                  Home
                </AnimatedText>
              </Animated.View>
              {errorMessage ? (
                <Surface className="mt-4 bg-danger-soft px-4 py-3">
                  <Text className="text-[13px] text-danger-foreground">
                    {errorMessage}
                  </Text>
                </Surface>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            isLoading || isHydratingTimelineItems ? (
              <View className="gap-8">
                {Array.from({ length: 6 }).map((_, index) => (
                  <TimelineSkeletonCard
                    key={`timeline-skeleton-${index}`}
                    lineCount={index % 2 === 0 ? 2 : 3}
                  />
                ))}
              </View>
            ) : (
              <TimelineSkeletonCard message="Nothing here yet." />
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
            />
          )}
        />
      </ScrollShadow>
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

export default AuthHomeRoute;
