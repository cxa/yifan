import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

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
  TIMELINE_TOP_CONTENT_GAP,
  useTimelineListSettings,
} from '@/components/timeline-list-settings';
import type { AuthStackParamList } from '@/navigation/types';
import type { FanfouStatus } from '@/types/fanfou';

const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const SCREEN_TITLE = 'Favorites';
const FAVORITES_PAGE_SIZE = 60;

const FavoritesRoute = () => {
  const queryClient = useQueryClient();
  const auth = useAuthSession();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route =
    useRoute<
      RouteProp<AuthStackParamList, typeof AUTH_STACK_ROUTE.FAVORITES>
    >();
  const resolvedUserId = route.params?.userId ?? auth.accessToken?.userId;
  const backCount = route.params?.backCount;
  const insets = useSafeAreaInsets();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const queryKey = useMemo<[string, string]>(
    () => ['favorites', resolvedUserId ?? ''],
    [resolvedUserId],
  );
  const timelineListSettings = useTimelineListSettings(insets, {
    hasBottomTabBar: false,
  });
  const listContentContainerStyle = useMemo(
    () => ({
      ...timelineListSettings.contentContainerStyle,
      paddingTop: TIMELINE_TOP_CONTENT_GAP,
    }),
    [timelineListSettings.contentContainerStyle],
  );

  useUserTimelineHeader({
    userId: resolvedUserId ?? '',
    screenTitle: SCREEN_TITLE,
    backCount,
  });

  const updateStatusById = useCallback(
    (statusId: string, updater: (status: FanfouStatus) => FanfouStatus) => {
      queryClient.setQueryData<InfiniteData<FanfouStatus[]>>(
        queryKey,
        previous =>
          previous
            ? {
                ...previous,
                pages: previous.pages.map(pageItems =>
                  pageItems.map(item =>
                    item.id === statusId ? updater(item) : item,
                  ),
                ),
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
    data: queryData,
    isPending,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery<
    FanfouStatus[],
    Error,
    InfiniteData<FanfouStatus[]>,
    [string, string],
    number
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!resolvedUserId) {
        return [];
      }
      const data = await get('/favorites', {
        id: resolvedUserId,
        count: FAVORITES_PAGE_SIZE,
        page: pageParam,
      });
      return normalizeTimelineItems(data);
    },
    enabled: Boolean(resolvedUserId),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length === FAVORITES_PAGE_SIZE ? lastPageParam + 1 : undefined,
    retry: 1,
  });
  const items = useMemo(
    () => (queryData?.pages ?? []).flatMap(pageItems => pageItems),
    [queryData],
  );

  const errorMessage = error
    ? getErrorMessage(error, 'Failed to load favorites.')
    : null;

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={async () => {
        await refetch();
      }}
      tintColor={accent}
      colors={[accent]}
      progressViewOffset={Math.max(44, insets.top)}
      progressBackgroundColor={background}
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

  const handleOpenProfile = useCallback(
    (userId: string) => {
      navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
        screen: AUTH_PROFILE_ROUTE.DETAIL,
        params: { userId },
      });
    },
    [navigation],
  );

  if (!resolvedUserId) {
    return (
      <View className="flex-1 bg-background px-6 pt-8">
        <Surface className="bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            Missing authenticated user.
          </Text>
        </Surface>
      </View>
    );
  }

  return (
    <>
      <NativeEdgeScrollShadow className="flex-1" color={background}>
        <FlatList
          className="flex-1 bg-background"
          data={items}
          keyExtractor={item => item.id}
          refreshControl={refreshControl}
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
              <TimelineSkeletonList keyPrefix="favorite-skeleton" />
            ) : (
              <TimelineSkeletonCard message="No favorites yet." />
            )
          }
          renderItem={({ item }) => (
            <TimelineStatusCard
              status={item}
              accent={accent}
              muted={muted}
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
              <View className="items-center py-4">
                <ActivityIndicator color={accent} />
              </View>
            ) : null
          }
        />
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

export default FavoritesRoute;
