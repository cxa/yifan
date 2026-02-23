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

const SCREEN_TITLE = 'My timeline';
const TIMELINE_TITLE = 'Timeline';
const TIMELINE_PAGE_SIZE = 60;

const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type MyTimelineRouteContentProps = {
  userId: string;
  isSelf: boolean;
  backCount?: number;
};

const MyTimelineRouteContent = ({
  userId,
  isSelf,
  backCount,
}: MyTimelineRouteContentProps) => {
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const queryKey = useMemo<[string, string]>(
    () => ['my-timeline', userId],
    [userId],
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
    userId,
    screenTitle: isSelf ? SCREEN_TITLE : TIMELINE_TITLE,
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
      const data = await get('/statuses/user_timeline', {
        id: userId,
        count: TIMELINE_PAGE_SIZE,
        page: pageParam,
        mode: 'default',
      });
      return normalizeTimelineItems(data);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length === TIMELINE_PAGE_SIZE ? lastPageParam + 1 : undefined,
    retry: 1,
  });
  const items = useMemo(
    () => (queryData?.pages ?? []).flatMap(pageItems => pageItems),
    [queryData],
  );

  const errorMessage = error
    ? getErrorMessage(error, 'Failed to load timeline.')
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
              <TimelineSkeletonList keyPrefix="my-timeline-skeleton" />
            ) : (
              <TimelineSkeletonCard message="No posts yet." />
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

const MyTimelineRoute = () => {
  const auth = useAuthSession();
  const accessToken = auth.accessToken;
  const route =
    useRoute<
      RouteProp<AuthStackParamList, typeof AUTH_STACK_ROUTE.MY_TIMELINE>
    >();
  const routeUserId = route.params?.userId;
  const backCount = route.params?.backCount;
  const resolvedUserId = routeUserId ?? accessToken?.userId;

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
    <MyTimelineRouteContent
      userId={resolvedUserId}
      isSelf={Boolean(accessToken && resolvedUserId === accessToken.userId)}
      backCount={backCount}
    />
  );
};

export default MyTimelineRoute;
