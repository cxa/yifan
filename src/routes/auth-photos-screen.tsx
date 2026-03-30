import React from 'react';
import { Platform, RefreshControl, View } from 'react-native';
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
import { useThemeColor } from 'heroui-native';
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthSession } from '@/auth/auth-session';
import { get } from '@/auth/fanfou-client';
import ErrorBanner from '@/components/error-banner';
import ComposerModal from '@/components/composer-modal';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import TimelineStatusCard from '@/components/timeline-status-card';
import { CARD_PASTEL_CYCLE, type DropShadowBoxType } from '@/components/drop-shadow-box';
import useTimelineStatusInteractions from '@/components/use-timeline-status-interactions';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
import {
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
} from '@/navigation/route-names';
import useUserTimelineHeader from '@/navigation/use-user-timeline-header';
import { useTimelineListSettings } from '@/components/timeline-list-settings';
import type { AuthStackParamList } from '@/navigation/types';
import type { FanfouStatus } from '@/types/fanfou';
const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];
const hasPhoto = (status: FanfouStatus) =>
  Boolean(
    status.photo?.largeurl || status.photo?.imageurl || status.photo?.thumburl,
  );
type PhotosRouteContentProps = {
  userId: string;
  authUserId: string | null;
  backCount?: number;
};
const PHOTO_PAGE_SIZE = 60;
const PHOTO_FALLBACK_PAGE_SIZE = 80;
type PhotoTimelinePage = {
  items: FanfouStatus[];
  sourceCount: number;
  sourcePageSize: number;
};
const PhotosRouteContent = ({
  userId,
  authUserId,
  backCount,
}: PhotosRouteContentProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const queryKey: [string, string] = ['photos', userId];
  const headerHeight = useHeaderHeight();
  const timelineListSettings = useTimelineListSettings(insets, {
    hasBottomTabBar: false,
  });
  const listContentContainerStyle = {
    ...timelineListSettings.contentContainerStyle,
    paddingTop: Platform.OS === 'android' ? headerHeight : 0,
  };
  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } =
    usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      updatePullScrollY(event.contentOffset.y);
    },
  });
  useUserTimelineHeader({
    userId,
    screenTitle: t('photosTitle'),
    backCount,
  });
  const updateStatusById = (
    statusId: string,
    updater: (status: FanfouStatus) => FanfouStatus,
  ) => {
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
    photoViewerUrl,
    photoViewerVisible,
    photoViewerOriginRect,
    handlePhotoPress,
    handleClosePhotoViewer,
    handleOpenReplyComposer,
    handleOpenRepostComposer,
    handleCloseComposer,
    handleSendComposer,
    handleToggleBookmark,
  } = useTimelineStatusInteractions({ updateStatusById });
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
  const items = (data?.pages ?? []).flatMap(pageItems => pageItems.items);
  const errorMessage = error ? t('photosLoadFailed') : null;
  const technicalError = error instanceof Error ? error.message : null;
  const { isPullRefreshing, handlePullRefresh } = usePullRefreshState(refetch);
  const refreshControl = (
    <RefreshControl
      refreshing={isPullRefreshing}
      onRefresh={handlePullRefresh}
      tintColor="transparent"
      colors={['transparent']}
    />
  );
  const handleOpenStatus = (statusId: string, shadowType: DropShadowBoxType) => {
    navigation.navigate(AUTH_STACK_ROUTE.STATUS, {
      screen: AUTH_STATUS_ROUTE.DETAIL,
      params: {
        statusId,
        shadowType,
      },
    });
  };
  const handleOpenProfile = (targetUserId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId: targetUserId,
      },
    });
  };
  const handleTagPress = (tag: string) => {
    const normalizedTag = tag.trim().replace(/^#+/, '').replace(/#+$/, '');
    if (!normalizedTag) {
      return;
    }
    navigation.navigate(AUTH_STACK_ROUTE.TAG_TIMELINE, {
      screen: AUTH_TAG_TIMELINE_ROUTE.DETAIL,
      params: {
        tag: normalizedTag,
      },
    });
  };
  const removeStatusById = (statusId: string) => {
    queryClient.setQueryData<InfiniteData<PhotoTimelinePage>>(
      queryKey,
      previous =>
        previous
          ? {
            ...previous,
            pages: previous.pages.map(pageItems => ({
              ...pageItems,
              items: pageItems.items.filter(item => item.id !== statusId),
            })),
          }
          : previous,
    );
  };
  const handleDeleteStatus = (status: FanfouStatus) => {
    return deleteStatus({
      queryClient,
      statusId: status.id,
      t,
      onDeleted: () => {
        removeStatusById(status.id);
      },
    });
  };
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
              <Animated.View style={timelineListSettings.animatedItemStyle}>
                <ErrorBanner message={errorMessage} technicalDetail={technicalError} />
              </Animated.View>
            ) : null
          }
          ListEmptyComponent={
            <Animated.View style={timelineListSettings.animatedItemStyle}>
              {isPending ? (
                <TimelineSkeletonList keyPrefix="photo-skeleton" />
              ) : (
                <TimelineSkeletonCard message={t('photosEmpty')} />
              )}
            </Animated.View>
          }
          renderItem={({ item, index }) => (
            <Animated.View style={timelineListSettings.animatedItemStyle}>
              <TimelineStatusCard
                status={item}
                accent={accent}
                muted={muted}
                shadowType={CARD_PASTEL_CYCLE[index % CARD_PASTEL_CYCLE.length]}
                showAvatar={false}
                showAuthor={false}
                isBookmarkPending={pendingBookmarkIds.has(item.id)}
                onOpenPhoto={handlePhotoPress}
                onPressStatus={handleOpenStatus}
                onPressProfile={handleOpenProfile}
                onPressMention={handleOpenProfile}
                onPressTag={handleTagPress}
                onReply={handleOpenReplyComposer}
                onRepost={handleOpenRepostComposer}
                onToggleBookmark={handleToggleBookmark}
                canDelete={isStatusOwnedByUser(item, authUserId)}
                onDelete={handleDeleteStatus}
              />
            </Animated.View>
          )}
          ListFooterComponent={
            isFetchingNextPage || (isRefetching && !isPending) ? (
              <Animated.View style={timelineListSettings.animatedItemStyle}>
                <View className="items-center py-6">
                  <NeobrutalActivityIndicator size="small" />
                </View>
              </Animated.View>
            ) : null
          }
        />
        <PhotoViewerModal
          visible={photoViewerVisible}
          photoUrl={photoViewerUrl}
          onClose={handleClosePhotoViewer}
          originRect={photoViewerOriginRect}
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
        enablePhoto={composeMode === 'reply'}
        isSubmitting={isComposerSubmitting}
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
  const authUserId = accessToken?.userId ?? null;
  const route =
    useRoute<RouteProp<AuthStackParamList, typeof AUTH_STACK_ROUTE.PHOTOS>>();
  const resolvedUserId = route.params?.userId ?? accessToken?.userId;
  const backCount = route.params?.backCount;
  if (!resolvedUserId) {
    return (
      <View className="flex-1 bg-background px-6 pt-8">
        <ErrorBanner message={t('notLoggedIn')} />
      </View>
    );
  }
  return (
    <PhotosRouteContent
      userId={resolvedUserId}
      authUserId={authUserId}
      backCount={backCount}
    />
  );
};
export default PhotosRoute;
