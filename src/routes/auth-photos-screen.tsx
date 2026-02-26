import React, { useCallback, useMemo } from 'react';
import {
  RefreshControl,
  View,
} from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';

import NeobrutalActivityIndicator, { COMPACT_PULL_THRESHOLD, NeobrutalRefreshIndicator } from '@/components/neobrutal-activity-indicator';
import { usePullScrollY, usePullRefreshState } from '@/components/use-pull-to-refresh';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, useThemeColor } from 'heroui-native';
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuthSession } from '@/auth/auth-session';
import { get } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import ComposerModal from '@/components/composer-modal';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import TimelineStatusCard from '@/components/timeline-status-card';
import useTimelineStatusInteractions from '@/components/use-timeline-status-interactions';
import {
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
} from '@/navigation/route-names';
import useUserTimelineHeader from '@/navigation/use-user-timeline-header';
import {
  useTimelineListSettings,
} from '@/components/timeline-list-settings';
import type { AuthStackParamList } from '@/navigation/types';
import type { FanfouStatus } from '@/types/fanfou';

const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];

const hasPhoto = (status: FanfouStatus) =>
  Boolean(
    status.photo?.largeurl || status.photo?.imageurl || status.photo?.thumburl,
  );

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type PhotosRouteContentProps = {
  userId: string;
  backCount?: number;
};

const PHOTO_PAGE_SIZE = 60;
const PHOTO_FALLBACK_PAGE_SIZE = 80;

type PhotoTimelinePage = {
  items: FanfouStatus[];
  sourceCount: number;
  sourcePageSize: number;
};

const PhotosRouteContent = ({ userId, backCount }: PhotosRouteContentProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const queryKey = useMemo<[string, string]>(
    () => ['photos', userId],
    [userId],
  );
  const timelineListSettings = useTimelineListSettings(insets, {
    hasBottomTabBar: false,
  });
  const listContentContainerStyle = useMemo(
    () => ({
      ...timelineListSettings.contentContainerStyle,
      paddingTop: 0,
    }),
    [timelineListSettings.contentContainerStyle],
  );

  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } = usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      updatePullScrollY(event.contentOffset.y);
    },
  });

  useUserTimelineHeader({
    userId,
    screenTitle: t('photosTitle'),
    backCount,
  });

  const updateStatusById = useCallback(
    (statusId: string, updater: (status: FanfouStatus) => FanfouStatus) => {
      queryClient.setQueryData<InfiniteData<PhotoTimelinePage>>(
        queryKey,
        previous =>
          previous
            ? {
              ...previous,
              pages: previous.pages.map(pageItems => ({
                ...pageItems,
                items: pageItems.items.map(item =>
                  item.id === statusId ? updater(item) : item,
                ),
              })),
            }
            : previous,
      );
    },
    [queryClient, queryKey],
  );

  const {
    composeMode,
    composerTitle,
    composerPlaceholder,
    composerSubmitLabel,
    composerInitialText,
    composerResetKey,
    pendingBookmarkIds,
    photoViewerUrl,
    photoViewerVisible,
    photoViewerPreviewKey,
    photoViewerOriginRect,
    registerPhotoPreviewRef,
    handlePhotoPress,
    handleClosePhotoViewer,
    handleOpenReplyComposer,
    handleOpenRepostComposer,
    handleCloseComposer,
    handleSendComposer,
    handleToggleBookmark,
  } = useTimelineStatusInteractions({
    updateStatusById,
  });

  const {
    data,
    isPending,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery<
    PhotoTimelinePage,
    Error,
    InfiniteData<PhotoTimelinePage>,
    [string, string],
    number
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      try {
        const photoTimelineData = await get('/photos/user_timeline', {
          id: userId,
          count: PHOTO_PAGE_SIZE,
          page: pageParam,
          mode: 'default',
        });
        const photoTimelineItems = normalizeTimelineItems(photoTimelineData);
        return {
          items: photoTimelineItems,
          sourceCount: photoTimelineItems.length,
          sourcePageSize: PHOTO_PAGE_SIZE,
        };
      } catch {
        // Fall back to user timeline and filter photo statuses.
      }

      const userTimelineData = await get('/statuses/user_timeline', {
        id: userId,
        count: PHOTO_FALLBACK_PAGE_SIZE,
        page: pageParam,
        mode: 'default',
      });
      const sourceItems = normalizeTimelineItems(userTimelineData);
      return {
        items: sourceItems.filter(hasPhoto),
        sourceCount: sourceItems.length,
        sourcePageSize: PHOTO_FALLBACK_PAGE_SIZE,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.sourceCount === lastPage.sourcePageSize
        ? lastPageParam + 1
        : undefined,
    retry: 1,
  });
  const items = useMemo(
    () => (data?.pages ?? []).flatMap(pageItems => pageItems.items),
    [data],
  );

  const errorMessage = error
    ? getErrorMessage(error, t('photosLoadFailed'))
    : null;

  const { isPullRefreshing, handlePullRefresh } = usePullRefreshState(refetch);
  const refreshControl = (
    <RefreshControl
      refreshing={isPullRefreshing}
      onRefresh={handlePullRefresh}
      tintColor="transparent"
      colors={['transparent']}
    />
  );

  const handleOpenStatus = useCallback(
    (statusId: string) => {
      navigation.navigate(AUTH_STACK_ROUTE.STATUS, {
        screen: AUTH_STATUS_ROUTE.DETAIL,
        params: { statusId },
      });
    },
    [navigation],
  );

  const handleOpenProfile = useCallback(
    (targetUserId: string) => {
      navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
        screen: AUTH_PROFILE_ROUTE.DETAIL,
        params: { userId: targetUserId },
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
      navigation.navigate(AUTH_STACK_ROUTE.TAG_TIMELINE, {
        screen: AUTH_TAG_TIMELINE_ROUTE.DETAIL,
        params: { tag: normalizedTag },
      });
    },
    [navigation],
  );

  return (
    <>
      <NativeEdgeScrollShadow className="flex-1" color={background}>
        <Animated.FlatList
          className="flex-1 bg-background"
          data={items}
          keyExtractor={item => item.id}
          refreshControl={refreshControl}
          onScroll={scrollHandler}
          contentInsetAdjustmentBehavior="automatic"
          scrollEventThrottle={timelineListSettings.scrollEventThrottle}
          scrollIndicatorInsets={timelineListSettings.scrollIndicatorInsets}
          contentContainerStyle={listContentContainerStyle}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (!hasNextPage || isFetchingNextPage || isPending) {
              return;
            }
            fetchNextPage().catch(() => undefined);
          }}
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
            isPending ? (
              <TimelineSkeletonList keyPrefix="photo-skeleton" />
            ) : (
              <TimelineSkeletonCard message={t('photosEmpty')} />
            )
          }
          renderItem={({ item }) => (
            <TimelineStatusCard
              status={item}
              accent={accent}
              muted={muted}
              showAvatar={false}
              showAuthor={false}
              isBookmarkPending={pendingBookmarkIds.has(item.id)}
              photoViewerVisible={photoViewerVisible}
              photoViewerPreviewKey={photoViewerPreviewKey}
              registerPhotoPreviewRef={registerPhotoPreviewRef}
              onOpenPhoto={handlePhotoPress}
              onPressStatus={handleOpenStatus}
              onPressProfile={handleOpenProfile}
              onPressMention={handleOpenProfile}
              onPressTag={handleTagPress}
              onReply={handleOpenReplyComposer}
              onRepost={handleOpenRepostComposer}
              onToggleBookmark={handleToggleBookmark}
            />
          )}
          ListFooterComponent={
            isFetchingNextPage || (isRefetching && !isPending) ? (
              <View className="items-center py-6">
                <NeobrutalActivityIndicator size="small" />
              </View>
            ) : null
          }
        />
      </NativeEdgeScrollShadow>

      <NeobrutalRefreshIndicator refreshing={isPullRefreshing} scrollY={pullScrollY} safeAreaTop={safeAreaTop} scrollInsetTop={scrollInsetTop} pullThreshold={COMPACT_PULL_THRESHOLD} />
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

const PhotosRoute = () => {
  const { t } = useTranslation();
  const auth = useAuthSession();
  const accessToken = auth.accessToken;
  const route =
    useRoute<RouteProp<AuthStackParamList, typeof AUTH_STACK_ROUTE.PHOTOS>>();
  const resolvedUserId = route.params?.userId ?? accessToken?.userId;
  const backCount = route.params?.backCount;

  if (!resolvedUserId) {
    return (
      <View className="flex-1 bg-background px-6 pt-8">
        <Surface className="bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            {t('notLoggedIn')}
          </Text>
        </Surface>
      </View>
    );
  }

  return <PhotosRouteContent userId={resolvedUserId} backCount={backCount} />;
};

export default PhotosRoute;
