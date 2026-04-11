import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
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
import { useThemeColor } from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAuthSession } from '@/auth/auth-session';
import { get } from '@/auth/fanfou-client';
import type { AuthStackParamList, AuthTabParamList } from '@/navigation/types';
import ComposerModal from '@/components/composer-modal';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
import useTimelineStatusInteractions from '@/components/use-timeline-status-interactions';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import TimelineStatusCard from '@/components/timeline-status-card';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import TimelineTitleHeader from '@/components/timeline-title-header';
import { isHydratingTimeline } from '@/components/timeline-hydration';
import {
  getTimelineItemSeparatorStyle,
  TIMELINE_AUTO_REFRESH_INTERVAL_MS,
  TIMELINE_INITIAL_PAGE_SIZE,
  TIMELINE_PAGE_SIZE,
  TIMELINE_SPACING,
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
import { Wind, Search } from 'lucide-react-native';

import type { FanfouStatus } from '@/types/fanfou';
import { CARD_PASTEL_CYCLE, type DropShadowBoxType } from '@/components/drop-shadow-box';
import { Text } from '@/components/app-text';
import { openPhotoViewer } from '@/components/photo-viewer-store';
import type { PhotoViewerOriginRect } from '@/components/photo-viewer-shared-transition';
import { getTabBarOccludedHeight } from '@/navigation/tab-bar-layout';

const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];
const getStatusId = (status: FanfouStatus): string => status.id;
const TIMELINE_SCROLL_SHADOW_SIZE = 100;
const PUBLIC_TIMELINE_BUTTON_POSITION = { position: 'absolute', right: 32 } as const;
const HOME_TOP_BUTTONS_STYLE = { flexDirection: 'row', gap: 20 } as const;
const HOME_TITLE_HEIGHT = 44; // matches titleContainerStyle animation start value
const HOME_ICON_SIZE = 22;
const TimelineItemSeparator = () => (
  <View style={getTimelineItemSeparatorStyle()} />
);
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
  const queryClient = useQueryClient();
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
  const listRef = useRef<FlatList<FanfouStatus>>(null);
  const updateStatusById = (statusId: string, updater: (s: FanfouStatus) => FanfouStatus) => {
    setTimelineItems(previous => previous.map(item => item.id === statusId ? updater(item) : item));
  };
  const {
    composeMode,
    composerTitle,
    composerPlaceholder,
    composerSubmitLabel,
    composerInitialText,
    composerResetKey,
    isComposerSubmitting,
    pendingBookmarkIds,
    handleOpenReplyComposer,
    handleOpenRepostComposer,
    handleCloseComposer,
    handleSendComposer,
    handleToggleBookmark,
  } = useTimelineStatusInteractions({ updateStatusById });
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
  const topButtonsStyle = useAnimatedStyle(() => {
    const offset = interpolate(
      scrollY.value,
      [0, HOME_TITLE_HEIGHT],
      [HOME_TITLE_HEIGHT - HOME_ICON_SIZE, 0],
      Extrapolation.CLAMP,
    );
    return { top: insets.top + offset };
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
  const handleStatusPress = (statusId: string, shadowType: DropShadowBoxType) => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.STATUS, {
      screen: AUTH_STATUS_ROUTE.DETAIL,
      params: {
        statusId,
        shadowType,
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
  const handlePhotoPress = (photoUrl: string, originRect?: PhotoViewerOriginRect | null) => {
    Image.prefetch(photoUrl).catch(() => undefined);
    openPhotoViewer(photoUrl, originRect);
  };
  const handleOpenPublicTimeline = () => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) return;
    parentNavigation.navigate(AUTH_STACK_ROUTE.PUBLIC_TIMELINE);
  };
  const handleOpenSearch = () => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) return;
    parentNavigation.navigate(AUTH_STACK_ROUTE.SEARCH);
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
  const errorMessage = error ? t('homeLoadFailed') : null;
  const technicalError = error instanceof Error ? error.message : null;
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
  const timelineListSettings = useTimelineListSettings(insets);
  const isHydratingTimelineItems = isHydratingTimeline({
    isLoading,
    renderedItems: timelineItems,
    sourceItems: initialItems,
  });
  const timelineContentContainerStyle = {
    ...timelineListSettings.contentContainerStyle,
    gap: undefined,
  };
  const timelineHeaderStyle = {
    marginBottom: TIMELINE_SPACING,
  };
  return (
    <View className="flex-1">
      <NativeEdgeScrollShadow
        className="flex-1"
        size={TIMELINE_SCROLL_SHADOW_SIZE}
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
          contentContainerStyle={timelineContentContainerStyle}
          ListHeaderComponentStyle={timelineHeaderStyle}
          ItemSeparatorComponent={TimelineItemSeparator}
          ListFooterComponent={
            isFetchingMore ? (
              <Animated.View style={timelineListSettings.animatedItemStyle}>
                <View className="items-center py-6">
                  <NeobrutalActivityIndicator size="small" />
                </View>
              </Animated.View>
            ) : hasReachedTimelineEnd && timelineItems.length > 0 ? (
              <Animated.View style={timelineListSettings.animatedItemStyle}>
                <View className="items-center py-6">
                  <Text className="text-[12px] tracking-[4px] text-muted">
                    FIN
                  </Text>
                </View>
              </Animated.View>
            ) : null
          }
          ListHeaderComponent={
            <Animated.View style={timelineListSettings.animatedItemStyle}>
              <TimelineTitleHeader
                title={t('homeTitle')}
                titleContainerStyle={titleContainerStyle}
                titleTextStyle={titleTextStyle}
                errorMessage={errorMessage}
                technicalError={technicalError}
              />
            </Animated.View>
          }
          ListEmptyComponent={
            <Animated.View style={timelineListSettings.animatedItemStyle}>
              {isLoading || isHydratingTimelineItems ? (
                <TimelineSkeletonList
                  keyPrefix="timeline-skeleton"
                  availableHeight={skeletonAvailableHeight}
                />
              ) : (
                <TimelineSkeletonCard message={t('homeEmpty')} />
              )}
            </Animated.View>
          }
          onEndReached={fetchMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item, index }) => (
            <Animated.View style={timelineListSettings.animatedItemStyle}>
              <TimelineStatusCard
                status={item}
                accent={accent}
                muted={muted}
                shadowType={CARD_PASTEL_CYCLE[index % CARD_PASTEL_CYCLE.length]}
                isBookmarkPending={pendingBookmarkIds.has(getStatusId(item))}
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
            </Animated.View>
          )}
        />
      </NativeEdgeScrollShadow>
      <NeobrutalRefreshIndicator
        refreshing={isRefreshing}
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
        initialText={composerInitialText}
        resetKey={composerResetKey}
        enablePhoto={composeMode === 'reply'}
        isSubmitting={isComposerSubmitting}
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
      <Animated.View
        style={[PUBLIC_TIMELINE_BUTTON_POSITION, HOME_TOP_BUTTONS_STYLE, topButtonsStyle]}
      >
        <Pressable onPress={handleOpenPublicTimeline} hitSlop={12}>
          <Wind size={HOME_ICON_SIZE} color={muted} strokeWidth={1.5} />
        </Pressable>
        <Pressable onPress={handleOpenSearch} hitSlop={12}>
          <Search size={HOME_ICON_SIZE} color={muted} strokeWidth={1.5} />
        </Pressable>
      </Animated.View>
    </View>
  );
};
export default AuthHomeRoute;
