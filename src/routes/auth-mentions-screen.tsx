import React, { useEffect, useRef, useState } from 'react';
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
import {
  usePullScrollY,
  usePullRefreshState,
} from '@/components/use-pull-to-refresh';
import {
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useAuthSession } from '@/auth/auth-session';
import { get } from '@/auth/fanfou-client';
import type { AuthStackParamList, AuthTabParamList } from '@/navigation/types';
import ComposerModal from '@/components/composer-modal';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
import useTimelineStatusInteractions from '@/components/use-timeline-status-interactions';
import TimelineStatusCard from '@/components/timeline-status-card';
import { CARD_PASTEL_CYCLE, type DropShadowBoxType } from '@/components/drop-shadow-box';
import TimelineEmptyPlaceholder from '@/components/timeline-empty-placeholder';
import { AlertCircle, AtSign } from 'lucide-react-native';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import { useUserFilterEffect } from '@/query/status-query-invalidation';
import TimelineTitleHeader from '@/components/timeline-title-header';
import { isHydratingTimeline } from '@/components/timeline-hydration';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
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
import { openPhotoViewer } from '@/components/photo-viewer-store';
import type { PhotoViewerOriginRect } from '@/components/photo-viewer-shared-transition';
import { getTabBarOccludedHeight } from '@/navigation/tab-bar-layout';
import type { FanfouStatus } from '@/types/fanfou';
import { Text } from '@/components/app-text';
import { useTranslation } from 'react-i18next';
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
const MentionsRoute = () => {
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
  const [timelineItems, setTimelineItems] = useState<FanfouStatus[]>([]);
  useUserFilterEffect(setTimelineItems);
  const listRef = useRef<FlatList<FanfouStatus>>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasReachedTimelineEnd, setHasReachedTimelineEnd] = useState(false);
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
    composerQuotedStatus,
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
  const scrollY = useSharedValue(0);
  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } =
    usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
      updatePullScrollY(event.contentOffset.y);
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
  const {
    data: queryItems,
    isLoading,
    error,
    refetch,
  } = useQuery<FanfouStatus[]>({
    queryKey: ['timeline', 'mentions', authUserId ?? ''],
    queryFn: async () => {
      if (!authUserId) {
        return [];
      }
      const data = await get('/statuses/mentions', {
        count: TIMELINE_INITIAL_PAGE_SIZE,
        mode: 'default',
      });
      return normalizeTimelineItems(data);
    },
    enabled: Boolean(authUserId),
    retry: 1,
  });
  useEffect(() => {
    if (!queryItems) {
      return;
    }
    setTimelineItems(queryItems);
    setHasReachedTimelineEnd(false);
  }, [queryItems]);
  const errorMessage = error ? t('mentionsLoadFailed') : null;
  const technicalError = error instanceof Error ? error.message : null;
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
      const data = await get('/statuses/mentions', {
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
  const timelineListSettings = useTimelineListSettings(insets);
  const isHydratingTimelineItems = isHydratingTimeline({
    isLoading,
    renderedItems: timelineItems,
    sourceItems: queryItems,
  });
  return (
    <>
      <NativeEdgeScrollShadow
        className="flex-1"
        color={background}
      >
        <FlatList
          ref={listRef}
          className="bg-background"
          data={timelineItems}
          keyExtractor={item => getStatusId(item)}
          refreshControl={refreshControl}
          onScroll={scrollHandler}
          scrollEventThrottle={timelineListSettings.scrollEventThrottle}
          scrollIndicatorInsets={timelineListSettings.scrollIndicatorInsets}
          contentContainerStyle={timelineListSettings.contentContainerStyle}
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
                title={t('mentionsTitle')}
                titleContainerStyle={titleContainerStyle}
                titleTextStyle={titleTextStyle}
                errorMessage={timelineItems.length > 0 ? errorMessage : null}
                technicalError={technicalError}
              />
            </Animated.View>
          }
          ListEmptyComponent={
            errorMessage ? (
              <Animated.View style={timelineListSettings.animatedItemStyle}>
                <TimelineEmptyPlaceholder icon={AlertCircle} message={errorMessage} detail={technicalError} tone="danger" />
              </Animated.View>
            ) : (
              <Animated.View style={timelineListSettings.animatedItemStyle}>
                {isLoading || isHydratingTimelineItems ? (
                  <TimelineSkeletonList
                    keyPrefix="mentions-skeleton"
                    availableHeight={skeletonAvailableHeight}
                  />
                ) : (
                  <TimelineEmptyPlaceholder icon={AtSign} message={t('mentionsEmpty')} />
                )}
              </Animated.View>
            )
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
        initialText={composerInitialText}
        resetKey={composerResetKey}
        quotedStatus={composerQuotedStatus}
        enablePhoto={composeMode === 'reply'}
        allowEmptyText={composeMode === 'repost'}
        isSubmitting={isComposerSubmitting}
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
    </>
  );
};
export default MentionsRoute;
