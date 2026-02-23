import { useLayoutEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useNavigation, type ParamListBase } from '@react-navigation/native';
import { useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { get } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import UserTimelineHeaderTitle from '@/components/user-timeline-header-title';
import { useAppFontFamily } from '@/settings/app-font-preference';
import type { FanfouUser } from '@/types/fanfou';

type UseUserTimelineHeaderOptions = {
  userId: string;
  screenTitle?: string;
  user?: FanfouUser | null;
  backCount?: number;
  useParentNavigation?: boolean;
};

const getUserById = (userId: string) =>
  get('/users/show', { id: userId }) as Promise<FanfouUser>;

const useUserTimelineHeader = ({
  userId,
  screenTitle,
  user: providedUser,
  backCount,
  useParentNavigation = false,
}: UseUserTimelineHeaderOptions) => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const [foreground] = useThemeColor(['foreground']);
  const headerFontFamily = useAppFontFamily();
  const { data: queriedUser } = useQuery<FanfouUser>({
    queryKey: ['header-owner', userId],
    queryFn: () => getUserById(userId),
    enabled: Boolean(userId) && !providedUser,
    retry: 1,
  });

  const user = providedUser || queriedUser;
  const displayName = user?.screen_name || user?.name || `@${userId}`;
  const semanticTitle = screenTitle
    ? `${displayName} · ${screenTitle}`
    : displayName;
  const handleName = `@${user?.id || userId}`;
  const rightSubtitle = screenTitle?.trim() || null;
  const avatarUrl =
    user?.profile_image_url_large || user?.profile_image_url || null;
  const avatarInitial = displayName.slice(0, 1).toUpperCase() || '?';
  const backTitle =
    typeof backCount === 'number'
      ? new Intl.NumberFormat().format(backCount)
      : undefined;

  const headerTitle = useMemo(
    () => () =>
      (
        <UserTimelineHeaderTitle
          displayName={displayName}
          handleName={handleName}
          avatarUrl={avatarUrl}
          avatarInitial={avatarInitial}
        />
      ),
    [avatarInitial, avatarUrl, displayName, handleName],
  );

  const headerRightItems = useMemo(
    () =>
      rightSubtitle
        ? () => [
            {
              type: 'custom' as const,
              element: (
                <View pointerEvents="none">
                  <Text
                    className="text-right text-[14px] leading-4"
                    style={{
                      color: foreground,
                      fontFamily: headerFontFamily,
                    }}
                    numberOfLines={1}
                  >
                    {rightSubtitle}
                  </Text>
                </View>
              ),
              hidesSharedBackground: true,
            },
          ]
        : undefined,
    [foreground, headerFontFamily, rightSubtitle],
  );

  useLayoutEffect(() => {
    const targetNavigation = useParentNavigation
      ? navigation.getParent<NativeStackNavigationProp<ParamListBase>>() ||
        navigation
      : navigation;

    if (!userId) {
      targetNavigation.setOptions({
        title: screenTitle ?? 'Profile',
        headerTitle: undefined,
        unstable_headerRightItems: headerRightItems,
        headerTitleAlign: 'center',
        headerBackTitle: backTitle,
      });
      return undefined;
    }

    targetNavigation.setOptions({
      title: semanticTitle,
      headerTitle,
      unstable_headerRightItems: headerRightItems,
      headerTitleAlign: 'center',
      headerBackTitle: backTitle,
    });

    return () => {
      targetNavigation.setOptions({
        headerTitle: undefined,
        unstable_headerRightItems: undefined,
        headerTitleAlign: undefined,
        headerBackTitle: undefined,
      });
    };
  }, [
    backTitle,
    headerRightItems,
    headerTitle,
    navigation,
    screenTitle,
    semanticTitle,
    useParentNavigation,
    userId,
  ]);
};

export default useUserTimelineHeader;
