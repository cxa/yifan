import React from 'react';
import {
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
import { getTabBarOccludedHeight } from '@/navigation/tab-bar-layout';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import TimelineStatusCard from '@/components/timeline-status-card';
import useTimelineStatusInteractions from '@/components/use-timeline-status-interactions';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
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
import { CARD_PASTEL_CYCLE, type DropShadowBoxType } from '@/components/drop-shadow-box';
const TIMELINE_PAGE_SIZE = 60;
const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
type MyTimelineRouteContentProps = {
  userId: string;
  authUserId: string | null;
  isSelf: boolean;
  backCount?: number;
};
const MyTimelineRouteContent = ({
  userId,
  authUserId,
  isSelf,
  backCount,
}: MyTimelineRouteContentProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const skeletonAvailableHeight =
    windowHeight -
    insets.top -
    TIMELINE_TOP_CONTENT_GAP -
    getTabBarOccludedHeight(insets.bottom);
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const queryKey: [string, string] = ['my-timeline', userId];
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
    screenTitle: isSelf ? t('myTimelineTitle') : t('timelineTitle'),
    backCount,
  });
  const updateStatusById = (
    statusId: string,
    updater: (status: FanfouStatus) => FanfouStatus,
  ) => {
    queryClient.setQueryData<InfiniteData<FanfouStatus[]>>(queryKey, previous =>
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
    handlePhotoPress,
    handleClosePhotoViewer,
    handleOpenReplyComposer,
    handleOpenRepostComposer,
    handleCloseComposer,
    handleSendComposer,
    handleToggleBookmark,
  } = useTimelineStatusInteractions({ updateStatusById });
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
  const items = (queryData?.pages ?? []).flatMap(pageItems => pageItems);
  const errorMessage = error
    ? getErrorMessage(error, t('timelineLoadFailed'))
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
    queryClient.setQueryData<InfiniteData<FanfouStatus[]>>(queryKey, previous =>
      previous
        ? {
          ...previous,
          pages: previous.pages.map(pageItems =>
            pageItems.filter(item => item.id !== statusId),
          ),
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
      <NativeEdgeScrollShadow className="flex-1" color={background} hasTabBar={false}>
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
              <Surface className="rounded-[16px] bg-danger-soft px-4 py-3">
                <Text className="text-[13px] text-danger-foreground">
                  {errorMessage}
                </Text>
              </Surface>
            ) : null
          }
          ListEmptyComponent={
            isPending ? (
              <TimelineSkeletonList
                keyPrefix="my-timeline-skeleton"
                availableHeight={skeletonAvailableHeight}
              />
            ) : (
              <TimelineSkeletonCard message={t('myTimelineEmpty')} />
            )
          }
          renderItem={({ item, index }) => (
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
          )}
          ListFooterComponent={
            isFetchingNextPage || (isRefetching && !isPending) ? (
              <View className="items-center py-6">
                <NeobrutalActivityIndicator size="small" />
              </View>
            ) : null
          }
        />
        <PhotoViewerModal
          visible={photoViewerVisible}
          photoUrl={photoViewerUrl}
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
        isSubmitting={isComposerSubmitting}
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
    </>
  );
};
const MyTimelineRoute = () => {
  const { t } = useTranslation();
  const auth = useAuthSession();
  const accessToken = auth.accessToken;
  const authUserId = accessToken?.userId ?? null;
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
        <Surface className="rounded-[16px] bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            {t('notLoggedIn')}
          </Text>
        </Surface>
      </View>
    );
  }
  return (
    <MyTimelineRouteContent
      userId={resolvedUserId}
      authUserId={authUserId}
      isSelf={Boolean(accessToken && resolvedUserId === accessToken.userId)}
      backCount={backCount}
    />
  );
};
export default MyTimelineRoute;
