import { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { useNavigation, type ParamListBase } from '@react-navigation/native';
import { useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '@/components/app-text';
import UserTimelineHeaderTitle from '@/components/user-timeline-header-title';
import { headerOwnerUserQueryOptions } from '@/query/user-query-options';
import { useAppFontFamily } from '@/settings/app-font-preference';
import type { FanfouUser } from '@/types/fanfou';
type UseUserTimelineHeaderOptions = {
  userId: string;
  screenTitle?: string;
  user?: FanfouUser | null;
  backCount?: number;
  useParentNavigation?: boolean;
  headerTintColor?: string;
  headerBackgroundColor?: string;
  showHeaderTitle?: boolean;
};
const useUserTimelineHeader = ({
  userId,
  screenTitle,
  user: providedUser,
  backCount,
  useParentNavigation = false,
  headerTintColor,
  headerBackgroundColor,
  showHeaderTitle = true,
}: UseUserTimelineHeaderOptions) => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const [foreground] = useThemeColor(['foreground']);
  const headerFontFamily = useAppFontFamily();
  const { data: queriedUser } = useQuery({
    ...headerOwnerUserQueryOptions(userId),
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
  const resolvedHeaderTintColor = headerTintColor ?? foreground;
  const headerBackgroundStyle = headerBackgroundColor
    ? { backgroundColor: headerBackgroundColor }
    : undefined;
  const headerBackground = headerBackgroundStyle
    ? () => <View pointerEvents="none" style={headerBackgroundStyle} />
    : undefined;
  const headerTitle = () => (
    <UserTimelineHeaderTitle
      displayName={displayName}
      handleName={handleName}
      avatarUrl={avatarUrl}
      avatarInitial={avatarInitial}
      textColor={resolvedHeaderTintColor}
      isVisible={showHeaderTitle}
    />
  );
  const headerRightItems = rightSubtitle
    ? () => [
        {
          type: 'custom' as const,
          element: (
            <View pointerEvents="none">
              <Text
                className="text-right text-[14px] leading-4"
                style={{
                  color: resolvedHeaderTintColor,
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
    : undefined;
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
        headerTintColor: resolvedHeaderTintColor,
        headerBackground,
      });
      return undefined;
    }
    targetNavigation.setOptions({
      title: semanticTitle,
      headerTitle,
      unstable_headerRightItems: headerRightItems,
      headerTitleAlign: 'center',
      headerBackTitle: backTitle,
      headerTintColor: resolvedHeaderTintColor,
      headerBackground,
    });
    return () => {
      targetNavigation.setOptions({
        headerTitle: undefined,
        unstable_headerRightItems: undefined,
        headerTitleAlign: undefined,
        headerBackTitle: undefined,
        headerTintColor: undefined,
        headerBackground: undefined,
      });
    };
  }, [
    backTitle,
    headerBackground,
    resolvedHeaderTintColor,
    headerRightItems,
    headerTitle,
    navigation,
    screenTitle,
    semanticTitle,
    showHeaderTitle,
    useParentNavigation,
    userId,
  ]);
};
export default useUserTimelineHeader;
