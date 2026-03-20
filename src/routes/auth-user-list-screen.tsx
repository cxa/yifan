import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useHeaderHeight } from '@react-navigation/elements';
import NeobrutalActivityIndicator, {
  COMPACT_PULL_THRESHOLD,
  NeobrutalRefreshIndicator,
} from '@/components/neobrutal-activity-indicator';
import UserSkeletonCard from '@/components/user-skeleton-card';
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
import { Surface, useThemeColor } from 'heroui-native';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthSession } from '@/auth/auth-session';
import { get } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import DropShadowBox, {
  CARD_BG_DARK,
  CARD_BG_LIGHT,
  CARD_PASTEL_CYCLE,
} from '@/components/drop-shadow-box';
import { countSkeletonItemsForHeight } from '@/components/timeline-skeleton-list';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import { AUTH_PROFILE_ROUTE, AUTH_STACK_ROUTE } from '@/navigation/route-names';
import useUserTimelineHeader from '@/navigation/use-user-timeline-header';
import type { AuthStackParamList } from '@/navigation/types';
import type { FanfouUser } from '@/types/fanfou';
import { parseHtmlToText } from '@/utils/parse-html';
const PAGE_HORIZONTAL_PADDING = 20;
const PAGE_BOTTOM_PADDING = 24;
const AVATAR_SIZE = 44;
const USERS_PAGE_SIZE = 60;
const USER_SKELETON_ITEM_HEIGHT = 76; // avatar(44) + py-4×2(32)
const USER_SKELETON_GAP = 16; // gap-4
const USER_SKELETON_FALLBACK_COUNT = 8;
const UserItemSeparator = () => <View className="h-4" />;
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const getUsersByMode = (
  mode: 'following' | 'followers',
  userId: string,
  page: number,
): Promise<FanfouUser[]> =>
  get(mode === 'following' ? '/users/friends' : '/users/followers', {
    id: userId,
    count: USERS_PAGE_SIZE,
    page,
  }) as Promise<FanfouUser[]>;
const UserListRoute = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route =
    useRoute<
      RouteProp<AuthStackParamList, typeof AUTH_STACK_ROUTE.USER_LIST>
    >();
  const { userId, mode, backCount } = route.params;
  const auth = useAuthSession();
  const authUserId = auth.accessToken?.userId?.trim().toLowerCase() ?? '';
  const normalizedRouteUserId = userId.trim().toLowerCase();
  const isSelf = authUserId.length > 0 && authUserId === normalizedRouteUserId;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { height: windowHeight } = useWindowDimensions();
  const skeletonAvailableHeight =
    windowHeight - insets.top - PAGE_BOTTOM_PADDING - insets.bottom;
  const isDark = useColorScheme() === 'dark';
  const [background] = useThemeColor(['background']);
  const { t } = useTranslation();
  const screenTitle =
    mode === 'following'
      ? t(isSelf ? 'followingTitle' : 'followingTitleOther')
      : t(isSelf ? 'followersTitle' : 'followersTitleOther');
  useUserTimelineHeader({
    userId,
    screenTitle,
    backCount,
  });
  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } =
    usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      updatePullScrollY(event.contentOffset.y);
    },
  });
  const {
    data,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery<
    FanfouUser[],
    Error,
    InfiniteData<FanfouUser[]>,
    [string, 'following' | 'followers', string],
    number
  >({
    queryKey: ['user-list', mode, userId],
    queryFn: ({ pageParam }) => getUsersByMode(mode, userId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length === USERS_PAGE_SIZE ? lastPageParam + 1 : undefined,
    retry: 1,
  });
  const items = (data?.pages ?? []).flatMap(pageItems => pageItems);
  const errorMessage = error
    ? getErrorMessage(error, t('userListLoadFailed'))
    : null;
  const contentContainerStyle = {
    flexGrow: 1,
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingTop: Platform.OS === 'android' ? headerHeight : 0,
    paddingBottom: insets.bottom + PAGE_BOTTOM_PADDING,
  };
  const handleOpenProfile = (targetUserId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId: targetUserId,
      },
    });
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
  return (
    <>
      <NativeEdgeScrollShadow className="flex-1" color={background}>
        <Animated.FlatList
          className="flex-1 bg-background"
          data={items}
          keyExtractor={item => item.id}
          onScroll={scrollHandler}
          contentInsetAdjustmentBehavior="automatic"
          scrollIndicatorInsets={{
            bottom: insets.bottom,
          }}
          contentContainerStyle={contentContainerStyle}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (!hasNextPage || isFetchingNextPage || isPending) {
              return;
            }
            fetchNextPage().catch(() => undefined);
          }}
          refreshControl={refreshControl}
          ItemSeparatorComponent={UserItemSeparator}
          ListHeaderComponent={
            errorMessage ? (
              <View className="mb-4">
                <Surface className="rounded-[16px] bg-danger-soft px-4 py-3">
                  <Text className="text-[13px] text-danger-foreground">
                    {errorMessage}
                  </Text>
                </Surface>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const displayName = item.screen_name || item.name || item.id;
            const handle = `@${item.id}`;
            const avatarUrl =
              item.profile_image_url_large || item.profile_image_url;
            const description = parseHtmlToText(item.description).trim();
            const initial = displayName.slice(0, 1).toUpperCase();
            const shadowType =
              CARD_PASTEL_CYCLE[index % CARD_PASTEL_CYCLE.length];
            const cardBgStyle = {
              backgroundColor: (isDark ? CARD_BG_DARK : CARD_BG_LIGHT)[
                shadowType
              ],
            };
            return (
              <DropShadowBox>
                <Pressable
                  onPress={() => handleOpenProfile(item.id)}
                  style={cardBgStyle}
                  accessibilityRole="button"
                  className="flex-row gap-3 overflow-hidden rounded-[24px] px-4 py-4 active:translate-x-[-4px] active:translate-y-[4px]"
                >
                  {avatarUrl ? (
                    <Image
                      source={{
                        uri: avatarUrl,
                      }}
                      className="rounded-full bg-surface-secondary"
                      style={{
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                      }}
                    />
                  ) : (
                    <View
                      className="items-center justify-center rounded-full bg-surface-secondary"
                      style={{
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                      }}
                    >
                      <Text className="text-[14px] text-muted">{initial}</Text>
                    </View>
                  )}

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="min-w-0 shrink text-[15px] font-semibold text-foreground">
                        {displayName}
                      </Text>
                      <Text className="shrink-0 text-[12px] text-muted">
                        {handle}
                      </Text>
                    </View>
                    {description ? (
                      <Text
                        className="mt-1 text-[13px] text-muted"
                        numberOfLines={2}
                      >
                        {description}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </DropShadowBox>
            );
          }}
          ListEmptyComponent={
            isPending ? (
              <View className="gap-4">
                {Array.from({
                  length: countSkeletonItemsForHeight(
                    skeletonAvailableHeight,
                    USER_SKELETON_ITEM_HEIGHT,
                    USER_SKELETON_GAP,
                    USER_SKELETON_FALLBACK_COUNT,
                  ),
                }).map((_, i) => (
                  <UserSkeletonCard key={i} colorIndex={i} />
                ))}
              </View>
            ) : (
              <DropShadowBox>
                <Surface className="rounded-[24px] bg-surface-secondary px-4 py-4">
                  <Text className="text-[13px] text-muted">
                    {mode === 'following'
                      ? t(isSelf ? 'followingEmpty' : 'followingEmptyOther')
                      : t(isSelf ? 'followersEmpty' : 'followersEmptyOther')}
                  </Text>
                </Surface>
              </DropShadowBox>
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="items-center py-6">
                <NeobrutalActivityIndicator size="small" />
              </View>
            ) : null
          }
        />
      </NativeEdgeScrollShadow>

      <NeobrutalRefreshIndicator
        refreshing={isPullRefreshing}
        scrollY={pullScrollY}
        safeAreaTop={safeAreaTop}
        scrollInsetTop={scrollInsetTop}
        pullThreshold={COMPACT_PULL_THRESHOLD}
      />
    </>
  );
};
export default UserListRoute;
