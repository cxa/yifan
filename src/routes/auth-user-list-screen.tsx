import React, { useCallback, useMemo } from 'react';
import {
  Image,
  Pressable,
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
import { Surface, useThemeColor } from 'heroui-native';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { get } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';
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

const EMPTY_MESSAGE: Record<'following' | 'followers', string> = {
  following: 'No following users yet.',
  followers: 'No followers yet.',
};
const UserItemSeparator = () => <View className="h-6" />;

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
  const insets = useSafeAreaInsets();
  const [background] = useThemeColor(['background']);
  const screenTitle = mode === 'following' ? 'Following' : 'Followers';

  useUserTimelineHeader({
    userId,
    screenTitle,
    backCount,
  });

  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } = usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
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

  const items = useMemo(
    () => (data?.pages ?? []).flatMap(pageItems => pageItems),
    [data],
  );
  const errorMessage = error
    ? getErrorMessage(error, 'Failed to load users.')
    : null;

  const contentContainerStyle = useMemo(
    () => ({
      flexGrow: 1,
      paddingHorizontal: PAGE_HORIZONTAL_PADDING,
      paddingTop: 0,
      paddingBottom: insets.bottom + PAGE_BOTTOM_PADDING,
    }),
    [insets.bottom],
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
          scrollIndicatorInsets={{ bottom: insets.bottom }}
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
                <Surface className="bg-danger-soft px-4 py-3">
                  <Text className="text-[13px] text-danger-foreground">
                    {errorMessage}
                  </Text>
                </Surface>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const displayName = item.screen_name || item.name || item.id;
            const handle = `@${item.id}`;
            const avatarUrl =
              item.profile_image_url_large || item.profile_image_url;
            const description = parseHtmlToText(item.description).trim();
            const initial = displayName.slice(0, 1).toUpperCase();

            return (
              <DropShadowBox>
                <Pressable
                  onPress={() => handleOpenProfile(item.id)}
                  accessibilityRole="button"
                  className="flex-row gap-3 border-2 border-foreground bg-surface px-4 py-4 dark:border-border active:translate-x-[-4px] active:translate-y-[4px]"
                >
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      className="rounded-full bg-surface-secondary"
                      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                    />
                  ) : (
                    <View
                      className="items-center justify-center rounded-full bg-surface-secondary"
                      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
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
              <View className="items-center py-8">
                <NeobrutalActivityIndicator />
              </View>
            ) : (
              <DropShadowBox>
                <Surface className="bg-surface border-2 border-foreground px-4 py-4 dark:border-border">
                  <Text className="text-[13px] text-muted">
                    {EMPTY_MESSAGE[mode]}
                  </Text>
                </Surface>
              </DropShadowBox>
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="items-center py-6">
                <NeobrutalActivityIndicator />
              </View>
            ) : null
          }
        />
      </NativeEdgeScrollShadow>

      <NeobrutalRefreshIndicator refreshing={isPullRefreshing} scrollY={pullScrollY} safeAreaTop={safeAreaTop} scrollInsetTop={scrollInsetTop} pullThreshold={COMPACT_PULL_THRESHOLD} />
    </>
  );
};

export default UserListRoute;
