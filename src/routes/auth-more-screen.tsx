import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  useColorScheme,
  View,
} from 'react-native';

import NeobrutalActivityIndicator from '@/components/neobrutal-activity-indicator';
import {
  useFocusEffect,
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollShadow, Surface, useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

import { setAuthAccessToken, useAuthSession } from '@/auth/auth-session';
import { get } from '@/auth/fanfou-client';
import { saveAuthAccessToken } from '@/auth/secure-token-storage';
import AuthActionButton from '@/components/auth-action-button';
import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';
import ProfileStatRow, {
  type ProfileStatItem,
} from '@/components/profile-stat-row';
import ProfileSummaryCard from '@/components/profile-summary-card';
import {
  AUTH_MESSAGES_ROUTE,
  AUTH_STACK_ROUTE,
} from '@/navigation/route-names';
import {
  getContentBottomPadding,
  getScrollIndicatorBottomInset,
} from '@/navigation/tab-bar-layout';
import type { AuthStackParamList, AuthTabParamList } from '@/navigation/types';
import {
  APP_FONT_OPTION,
  APP_FONT_OPTIONS,
  setAppFontPreference as persistAppFontPreference,
  type AppFontOption,
  useAppFontPreference,
} from '@/settings/app-font-preference';
import type { FanfouUser } from '@/types/fanfou';
import { formatJoinedAt } from '@/utils/fanfou-date';
import { parseHtmlToText } from '@/utils/parse-html';

const PAGE_HORIZONTAL_PADDING = 20;
const PAGE_BOTTOM_PADDING = 24;
const SECTION_TOP_MARGIN = 16;
const SECTION_GAP = 24;
const AVATAR_SIZE = 80;
const ENTRY_ICON_SIZE = 18;
const ENTRY_ICON_WRAPPER = 36;
const POSTAGE_STAMP_PATH =
  'M14 1v1.5c-.75 0-.75 1.5 0 1.5v1.25c-.75 0-.75 1.5 0 1.5v1.5c-.75 0-.75 1.5 0 1.5V11c-.75 0-.75 1.5 0 1.5V14h-1.5c0-.75-1.5-.75-1.5 0H9.75c0-.75-1.5-.75-1.5 0h-1.5c0-.75-1.5-.75-1.5 0H4c0-.75-1.5-.75-1.5 0H1v-1.5c.75 0 .75-1.5 0-1.5V9.75c.75 0 .75-1.5 0-1.5v-1.5c.75 0 .75-1.5 0-1.5V4c.75 0 .75-1.5 0-1.5V1h1.5c0 .75 1.5.75 1.5 0h1.25c0 .75 1.5.75 1.5 0h1.5c0 .75 1.5.75 1.5 0H11c0 .75 1.5.75 1.5 0z';

// Wavy cancellation lines clustered in bottom-right; last wave bleeds past bottom border
const STAMP_WAVE_LINES: { d: string; opacity: number }[] = [
  { d: 'M7.5 9.5  C9 8.7   10.5 10.5 12 9.7  C13 9.2  14.2 9.6  16 9.3',    opacity: 0.25 },
  { d: 'M6.5 11.1 C8 10.3  9.5 12.1  11 11.3 C12.2 10.7 13.5 11.2 16 10.9', opacity: 0.5  },
  { d: 'M6   12.7 C7.5 11.9 9 13.7  10.5 12.9 C11.8 12.3 13 12.8 16 12.5',  opacity: 0.3  },
];

// Hill sits low in the stamp interior; peak at y=8, base at y=12.5
const STAMP_HILL_PATH = 'M2.5 12.5 Q7.5 8 12.5 12.5';

// Moon crescent aligned right, centered around (10.5, 5.3)
const STAMP_MOON_PATH = 'M11 4.3 A2.2 2.2 0 1 1 8.2 7.3 A1.5 1.5 0 0 0 11 4.3';

const PostageStampIcon = ({ color, size }: { color: string; size: number }) => {
  const isDark = useColorScheme() === 'dark';
  return (
  <Svg width={size} height={size * (19 / 15)} viewBox="0 0 18 19">
    <Path
      d={POSTAGE_STAMP_PATH}
      fill="none"
      stroke={color}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d={STAMP_HILL_PATH}
      fill="none"
      stroke={color}
      strokeWidth="0.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {isDark ? (
      <Path
        d={STAMP_MOON_PATH}
        fill={color}
        stroke="none"
      />
    ) : (
      <>
        <Circle cx="4.5" cy="5.3" r="1.3" fill={color} />
        <Path
          d="M4.5 2.9 L4.5 2.3 M6.4 3.8 L6.8 3.3 M7.3 5.3 L7.9 5.3 M6.4 6.8 L6.8 7.3 M4.5 7.7 L4.5 8.3 M2.6 6.8 L2.2 7.3 M1.7 5.3 L1.1 5.3 M2.6 3.8 L2.2 3.3"
          fill="none"
          stroke={color}
          strokeWidth="0.5"
          strokeLinecap="round"
        />
      </>
    )}
    {STAMP_WAVE_LINES.map(({ d, opacity }, i) => (
      <Path
        key={i}
        d={d}
        fill="none"
        stroke="#E63946"
        strokeWidth="0.6"
        strokeLinecap="round"
        opacity={opacity}
      />
    ))}
  </Svg>
  );
};
const SCROLL_SHADOW_SIZE = 100;
const ENTRY_GAP = 12;
const MISSING_USER_ID_ERROR =
  'Unable to load account details. Missing user id.';
const FONT_SETTING_TITLE = 'Font style';
const FONT_SETTING_HELPER = 'Choose your preferred app font.';
const SYSTEM_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

const getFontPreviewFamily = (option: AppFontOption) => {
  if (option === APP_FONT_OPTION.XIAOLAI) {
    return 'Xiaolai';
  }
  if (option === APP_FONT_OPTION.HUIWEN_HKHEI) {
    return 'HuiwenHKHei-Regular';
  }
  if (option === APP_FONT_OPTION.HUIWEN_MINCHO_GBK) {
    return 'Huiwen-MinchoGBK-Regular';
  }
  return SYSTEM_FONT_FAMILY;
};

const getUserById = async (userId: string): Promise<FanfouUser> => {
  return get('/users/show', { id: userId }) as Promise<FanfouUser>;
};

const formatCount = (value?: number) => {
  if (typeof value !== 'number') {
    return '--';
  }
  try {
    return new Intl.NumberFormat().format(value);
  } catch {
    return String(value);
  }
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type MoreEntry = {
  key: string;
  label: string;
  value: string;
  helper?: string;
  showChevron?: boolean;
  icon: React.ComponentType<{ color: string; size: number }>;
  noIconBox?: boolean;
  onPress?: () => void;
};

type EntryRowProps = MoreEntry & { iconColor: string };

type FontSettingRowProps = {
  option: { value: AppFontOption; label: string };
  isLast: boolean;
  isSelected: boolean;
  isUpdating: boolean;
  isBusy: boolean;
  mutedColor: string;
  onPress: (next: AppFontOption) => void;
};

type MoreRouteContentProps = {
  userId: string;
  displayNameFallback: string;
};

const EntryRow = ({
  label,
  value,
  helper,
  showChevron,
  icon: Icon,
  noIconBox,
  onPress,
  iconColor,
}: EntryRowProps) => {
  const isDisabled = !onPress;
  return (
    <DropShadowBox>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        accessibilityRole={isDisabled ? undefined : 'button'}
        className={
          isDisabled
            ? 'opacity-70'
            : 'active:translate-x-[-4px] active:translate-y-[4px]'
        }
      >
        <Surface className="bg-surface border-2 border-foreground dark:border-border px-4 py-4">
          <View className="flex-row items-center gap-4">
            {noIconBox ? (
              <Icon color={iconColor} size={ENTRY_ICON_WRAPPER} />
            ) : (
              <View
                className="items-center justify-center border-2 border-foreground dark:border-border bg-surface-secondary"
                style={{
                  width: ENTRY_ICON_WRAPPER,
                  height: ENTRY_ICON_WRAPPER,
                }}
              >
                <Icon color={iconColor} size={ENTRY_ICON_SIZE} />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-foreground">
                {label}
              </Text>
              {helper ? (
                <Text className="mt-0.5 text-[12px] text-muted">{helper}</Text>
              ) : null}
            </View>
            {showChevron ? (
              <ChevronRight size={16} color={iconColor} />
            ) : (
              <Text className="text-[14px] text-foreground">{value}</Text>
            )}
          </View>
        </Surface>
      </Pressable>
    </DropShadowBox>
  );
};

const FontSettingRow = ({
  option,
  isLast,
  isSelected,
  isUpdating,
  isBusy,
  mutedColor,
  onPress,
}: FontSettingRowProps) => {
  const isDisabled = isSelected || isBusy;
  const previewFamily = getFontPreviewFamily(option.value);

  return (
    <Pressable
      disabled={isDisabled}
      accessibilityRole="button"
      onPress={() => onPress(option.value)}
      className={`flex-row items-center gap-3 px-4 py-4 ${
        isLast ? '' : 'border-b-2 border-foreground dark:border-border'
      } ${isDisabled ? 'opacity-80' : 'active:bg-surface-secondary'}`}
    >
      <View
        className={`h-5 w-5 items-center justify-center border-2 border-foreground dark:border-border ${
          isSelected ? 'bg-accent' : 'bg-surface-secondary'
        }`}
      >
        {isSelected ? <View className="h-2 w-2 bg-accent-foreground" /> : null}
      </View>
      <Text
        className="flex-1 text-[15px] text-foreground"
        style={previewFamily ? { fontFamily: previewFamily } : undefined}
      >
        {option.label}
      </Text>
      {isUpdating ? (
        <NeobrutalActivityIndicator size="small" color={mutedColor} />
      ) : null}
    </Pressable>
  );
};

const MoreRouteContent = ({
  userId,
  displayNameFallback,
}: MoreRouteContentProps) => {
  const navigation = useNavigation<BottomTabNavigationProp<AuthTabParamList>>();
  const [background, muted] = useThemeColor(['background', 'muted']);
  const appFontPreference = useAppFontPreference();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [updatingFontOption, setUpdatingFontOption] =
    useState<AppFontOption | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const contentBottomPadding = getContentBottomPadding(insets.bottom, true);
  const scrollIndicatorBottom = getScrollIndicatorBottomInset(insets.bottom, true);
  useScrollToTop(scrollRef);

  const {
    data: user,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<FanfouUser>({
    queryKey: ['account', userId],
    queryFn: () => getUserById(userId),
    retry: 1,
    refetchOnMount: 'always',
  });

  useFocusEffect(
    useCallback(() => {
      refetch().catch(() => undefined);
      return undefined;
    }, [refetch]),
  );

  const errorMessage = error
    ? getErrorMessage(error, 'Unable to load account details.')
    : null;
  const displayName = user
    ? user.screen_name || user.name || displayNameFallback
    : displayNameFallback;
  const handleName = user ? `@${user.id}` : `@${userId}`;
  const location = user ? user.location : '';
  const joinedAt = user ? formatJoinedAt(user.created_at) : '';
  const profileUrl = user ? parseHtmlToText(user.url).trim() : '';
  const description = user ? parseHtmlToText(user.description).trim() : '';
  const avatarUrl = user
    ? user.profile_image_url_large || user.profile_image_url
    : null;
  const hasAvatar = Boolean(avatarUrl && avatarUrl.trim().length > 0);
  const avatarInitial = displayName
    ? displayName.slice(0, 1).toUpperCase()
    : '?';
  const accountAvatar =
    hasAvatar && avatarUrl ? (
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
        <Text className="text-[24px] text-muted">{avatarInitial}</Text>
      </View>
    );
  const showLoadingState = !user && (isLoading || isFetching);

  const contentContainerStyle = useMemo(
    () => ({
      flexGrow: 1,
      paddingHorizontal: PAGE_HORIZONTAL_PADDING,
      paddingTop: insets.top,
      paddingBottom: contentBottomPadding + PAGE_BOTTOM_PADDING,
    }),
    [insets.top, contentBottomPadding],
  );

  const handleOpenMyTimeline = useCallback(() => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.MY_TIMELINE, {
      userId,
      backCount: user?.statuses_count,
    });
  }, [navigation, user?.statuses_count, userId]);

  const handleOpenFollowing = useCallback(() => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.USER_LIST, {
      userId,
      mode: 'following',
      backCount: user?.friends_count,
    });
  }, [navigation, user?.friends_count, userId]);

  const handleOpenFollowers = useCallback(() => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.USER_LIST, {
      userId,
      mode: 'followers',
      backCount: user?.followers_count,
    });
  }, [navigation, user?.followers_count, userId]);

  const handleOpenPrivateMessages = useCallback(() => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.MESSAGES, {
      screen: AUTH_MESSAGES_ROUTE.LIST,
    });
  }, [navigation]);

  const handleOpenFavorites = useCallback(() => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.FAVORITES, {
      userId,
      backCount: user?.favourites_count,
    });
  }, [navigation, user?.favourites_count, userId]);

  const handleOpenPhotos = useCallback(() => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.PHOTOS, {
      userId,
      backCount: user?.photo_count,
    });
  }, [navigation, user?.photo_count, userId]);

  const profileStatsPrimary = useMemo<ProfileStatItem[]>(
    () => [
      {
        label: 'Posts',
        value: user ? formatCount(user.statuses_count) : '--',
        onPress: handleOpenMyTimeline,
      },
      {
        label: 'Following',
        value: user ? formatCount(user.friends_count) : '--',
        onPress: handleOpenFollowing,
      },
      {
        label: 'Followers',
        value: user ? formatCount(user.followers_count) : '--',
        onPress: handleOpenFollowers,
      },
    ],
    [handleOpenFollowers, handleOpenFollowing, handleOpenMyTimeline, user],
  );

  const profileStatsSecondary = useMemo<ProfileStatItem[]>(
    () => [
      {
        label: 'Favorites',
        value: user ? formatCount(user.favourites_count) : '--',
        onPress: handleOpenFavorites,
      },
      {
        label: 'Photos',
        value: user ? formatCount(user.photo_count) : '--',
        onPress: handleOpenPhotos,
      },
    ],
    [handleOpenFavorites, handleOpenPhotos, user],
  );

  const entries = useMemo<MoreEntry[]>(
    () => [
      {
        key: 'messages',
        label: 'Private messages',
        value: '',
        helper: 'Inbox + sent',
        showChevron: true,
        icon: PostageStampIcon,
        noIconBox: true,
        onPress: handleOpenPrivateMessages,
      },
    ],
    [handleOpenPrivateMessages],
  );

  const handleSignOut = useCallback(() => {
    if (isSigningOut) {
      return;
    }
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await saveAuthAccessToken(null);
            } finally {
              setAuthAccessToken(null);
              setIsSigningOut(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [isSigningOut]);

  const handleSelectFontPreference = useCallback(
    async (next: AppFontOption) => {
      if (updatingFontOption || appFontPreference === next) {
        return;
      }

      setUpdatingFontOption(next);
      try {
        await persistAppFontPreference(next);
      } catch (updateError) {
        Alert.alert(
          'Update failed',
          getErrorMessage(updateError, 'Failed to update font setting.'),
        );
      } finally {
        setUpdatingFontOption(null);
      }
    },
    [appFontPreference, updatingFontOption],
  );

  return (
    <ScrollShadow
      className="flex-1"
      LinearGradientComponent={LinearGradient}
      size={SCROLL_SHADOW_SIZE}
      color={background}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        scrollIndicatorInsets={{
          bottom: scrollIndicatorBottom,
        }}
        contentContainerStyle={contentContainerStyle}
      >
        <View className="flex-1" style={{ marginTop: SECTION_TOP_MARGIN }}>
          <View style={{ gap: SECTION_GAP }}>
            <DropShadowBox>
              {showLoadingState ? (
                <Surface className="bg-surface border-2 border-foreground dark:border-border px-5 py-6">
                  <View className="flex-row items-center gap-4">
                    <View
                      className="items-center justify-center rounded-full border-2 border-foreground dark:border-border bg-surface-secondary"
                      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                    >
                      <NeobrutalActivityIndicator size="small" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[16px] font-semibold text-foreground">
                        Loading account...
                      </Text>
                      {handleName ? (
                        <Text className="mt-1 text-[12px] text-muted">
                          {handleName}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {errorMessage ? (
                    <View className="mt-4 rounded-sm border border-danger bg-danger-soft px-3 py-2">
                      <Text className="text-[12px] text-danger">
                        {errorMessage}
                      </Text>
                    </View>
                  ) : null}
                </Surface>
              ) : (
                <ProfileSummaryCard
                  avatar={accountAvatar}
                  displayName={displayName}
                  handleName={handleName}
                  location={location}
                  joinedAt={joinedAt}
                  profileUrl={profileUrl}
                  description={description}
                  rightSlot={
                    isFetching ? <NeobrutalActivityIndicator size="small" /> : null
                  }
                  footer={
                    errorMessage ? (
                      <View className="mt-4 rounded-sm border border-danger bg-danger-soft px-3 py-2">
                        <Text className="text-[12px] text-danger">
                          {errorMessage}
                        </Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </DropShadowBox>

            {user ? (
              <>
                <ProfileStatRow stats={profileStatsPrimary} />
                <ProfileStatRow stats={profileStatsSecondary} />
              </>
            ) : null}

            <View style={{ gap: ENTRY_GAP }}>
              {entries.map(entry => {
                const { key, ...entryProps } = entry;
                return <EntryRow key={key} {...entryProps} iconColor={muted} />;
              })}
            </View>

            <DropShadowBox>
              <Surface className="bg-surface border-2 border-foreground dark:border-border">
                <View className="border-b-2 border-foreground dark:border-border px-4 py-4">
                  <Text className="text-[15px] font-semibold text-foreground">
                    {FONT_SETTING_TITLE}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-muted">
                    {FONT_SETTING_HELPER}
                  </Text>
                </View>
                {APP_FONT_OPTIONS.map((option, index) => (
                  <FontSettingRow
                    key={option.value}
                    option={option}
                    isLast={index === APP_FONT_OPTIONS.length - 1}
                    isSelected={appFontPreference === option.value}
                    isUpdating={updatingFontOption === option.value}
                    isBusy={Boolean(updatingFontOption)}
                    mutedColor={muted}
                    onPress={handleSelectFontPreference}
                  />
                ))}
              </Surface>
            </DropShadowBox>
          </View>

          <View className="flex-1" />

          <View className="mt-6">
            <AuthActionButton
              label="Sign out"
              loadingLabel="Signing out..."
              variant="danger"
              onPress={handleSignOut}
              isLoading={isSigningOut}
            />
          </View>
        </View>
      </ScrollView>
    </ScrollShadow>
  );
};

const MissingUserIdPlaceholder = () => {
  const [background] = useThemeColor(['background']);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const placeholderContentPadding = getContentBottomPadding(insets.bottom, true);
  const placeholderScrollInset = getScrollIndicatorBottomInset(insets.bottom, true);
  useScrollToTop(scrollRef);

  const contentContainerStyle = useMemo(
    () => ({
      flexGrow: 1,
      paddingHorizontal: PAGE_HORIZONTAL_PADDING,
      paddingTop: insets.top,
      paddingBottom: placeholderContentPadding + PAGE_BOTTOM_PADDING,
      justifyContent: 'center' as const,
    }),
    [insets.top, placeholderContentPadding],
  );

  return (
    <ScrollShadow
      className="flex-1"
      LinearGradientComponent={LinearGradient}
      size={SCROLL_SHADOW_SIZE}
      color={background}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        scrollIndicatorInsets={{
          bottom: placeholderScrollInset,
        }}
        contentContainerStyle={contentContainerStyle}
      >
        <DropShadowBox>
          <Surface className="bg-surface border-2 border-foreground dark:border-border px-5 py-6">
            <View className="rounded-sm border border-danger bg-danger-soft px-3 py-2">
              <Text className="text-[12px] text-danger">
                {MISSING_USER_ID_ERROR}
              </Text>
            </View>
          </Surface>
        </DropShadowBox>
      </ScrollView>
    </ScrollShadow>
  );
};

const MoreRoute = () => {
  const auth = useAuthSession();
  const accessToken = auth.accessToken;

  if (!accessToken) {
    return <MissingUserIdPlaceholder />;
  }

  return (
    <MoreRouteContent
      userId={accessToken.userId}
      displayNameFallback={accessToken.screenName}
    />
  );
};

export default MoreRoute;
