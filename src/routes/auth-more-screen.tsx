import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { showToastAlert, showVariantToast } from '@/utils/toast-alert';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  type TextStyle,
  useColorScheme,
  View,
  type ViewStyle,
} from 'react-native';
import NeobrutalActivityIndicator from '@/components/neobrutal-activity-indicator';
import {
  useIsFocused,
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollShadow, Surface, useThemeColor } from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { setAuthAccessToken, useAuthSession } from '@/auth/auth-session';
import { saveAuthAccessToken } from '@/auth/secure-token-storage';
import AuthActionButton from '@/components/auth-action-button';
import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';
import ProfilePageBackdrop from '@/components/profile-page-backdrop';
import ProfileStatRow from '@/components/profile-stat-row';
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
  accountUserQueryOptions,
  userQueryKeys,
} from '@/query/user-query-options';
import { useTranslation } from 'react-i18next';
import {
  APP_FONT_OPTION,
  APP_FONT_OPTIONS,
  setAppFontPreference as persistAppFontPreference,
  type AppFontOption,
  useAppFontPreference,
} from '@/settings/app-font-preference';
import {
  APP_LANGUAGE_OPTIONS,
  setAppLanguagePreference,
  type AppLanguageOption,
  useAppLanguagePreference,
} from '@/settings/app-language-preference';
import { formatJoinedAt } from '@/utils/fanfou-date';
import { parseHtmlToText } from '@/utils/parse-html';
import {
  createProfileThemeStyles,
  resolveProfileThemePalette,
} from '@/utils/profile-theme';
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
const STAMP_WAVE_LINES: {
  d: string;
  opacity: number;
}[] = [
  {
    d: 'M7.5 9.5  C9 8.7   10.5 10.5 12 9.7  C13 9.2  14.2 9.6  16 9.3',
    opacity: 0.25,
  },
  {
    d: 'M6.5 11.1 C8 10.3  9.5 12.1  11 11.3 C12.2 10.7 13.5 11.2 16 10.9',
    opacity: 0.5,
  },
  {
    d: 'M6   12.7 C7.5 11.9 9 13.7  10.5 12.9 C11.8 12.3 13 12.8 16 12.5',
    opacity: 0.3,
  },
];

// Sun mode: left hill taller (peak y=6.5), right hill shorter (peak y=9.5)
const STAMP_HILL_SUN_PATH = 'M3 12.5 Q6 6.5 9.5 12.5';
const STAMP_HILL2_SUN_PATH = 'M9.5 12.5 Q12 9.5 14 12.5';

// Moon mode: left hill taller (peak y=6.5), right hill shorter (peak y=9.5)
const STAMP_HILL_MOON_PATH = 'M3 12.5 Q6 6.5 9.5 12.5';
const STAMP_HILL2_MOON_PATH = 'M9.5 12.5 Q12 9.5 14 12.5';

// Moon crescent aligned left, centered higher around (4.5, 3.8)
const STAMP_MOON_PATH = 'M6 2.8 A2.2 2.2 0 1 1 3.2 5.8 A1.5 1.5 0 0 0 6 2.8';
const PostageStampIcon = ({ color, size }: { color: string; size: number }) => {
  const isDark = useColorScheme() === 'dark';
  return (
    <Svg width={size} height={size} viewBox="-1.5 -1 21 19">
      <Path
        d={POSTAGE_STAMP_PATH}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={isDark ? STAMP_HILL_MOON_PATH : STAMP_HILL_SUN_PATH}
        fill="none"
        stroke={color}
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={isDark ? STAMP_HILL2_MOON_PATH : STAMP_HILL2_SUN_PATH}
        fill="none"
        stroke={color}
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {isDark ? (
        <Path d={STAMP_MOON_PATH} fill={color} stroke="none" />
      ) : (
        <>
          <Circle cx="10.5" cy="5.3" r="1.3" fill={color} />
          <Path
            d="M10.5 2.9 L10.5 2.3 M12.4 3.8 L12.8 3.3 M13.3 5.3 L13.9 5.3 M12.4 6.8 L12.8 7.3 M10.5 7.7 L10.5 8.3 M8.6 6.8 L8.2 7.3 M7.7 5.3 L7.1 5.3 M8.6 3.8 L8.2 3.3"
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
  icon: React.ComponentType<{
    color: string;
    size: number;
  }>;
  noIconBox?: boolean;
  onPress?: () => void;
};
type EntryRowProps = MoreEntry & {
  iconColor: string;
  panelStyle?: StyleProp<ViewStyle>;
  primaryTextStyle?: StyleProp<TextStyle>;
  mutedTextStyle?: StyleProp<TextStyle>;
};
type FontSettingRowProps = {
  option: {
    value: AppFontOption;
    label: string;
  };
  isLast: boolean;
  isSelected: boolean;
  isBusy: boolean;
  onPress: (next: AppFontOption) => void;
  primaryTextStyle?: StyleProp<TextStyle>;
};
type LanguageSettingRowProps = {
  option: {
    value: AppLanguageOption;
    label: string;
    nativeLabel: string;
  };
  isLast: boolean;
  isSelected: boolean;
  isBusy: boolean;
  onPress: (next: AppLanguageOption) => void;
  primaryTextStyle?: StyleProp<TextStyle>;
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
  panelStyle,
  primaryTextStyle,
  mutedTextStyle,
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
        <Surface
          className="bg-surface border-2 border-foreground dark:border-border px-4 py-4"
          style={panelStyle}
        >
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
              <Text
                className="text-[15px] font-semibold text-foreground"
                style={primaryTextStyle}
              >
                {label}
              </Text>
              {helper ? (
                <Text
                  className="mt-0.5 text-[12px] text-muted"
                  style={mutedTextStyle}
                >
                  {helper}
                </Text>
              ) : null}
            </View>
            {showChevron ? (
              <ChevronRight size={16} color={iconColor} />
            ) : (
              <Text
                className="text-[14px] text-foreground"
                style={primaryTextStyle}
              >
                {value}
              </Text>
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
  isBusy,
  onPress,
  primaryTextStyle,
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
        style={[
          primaryTextStyle,
          previewFamily
            ? {
                fontFamily: previewFamily,
              }
            : undefined,
        ]}
      >
        {option.label}
      </Text>
    </Pressable>
  );
};
const LanguageSettingRow = ({
  option,
  isLast,
  isSelected,
  isBusy,
  onPress,
  primaryTextStyle,
}: LanguageSettingRowProps) => {
  const { t } = useTranslation();
  const isDisabled = isSelected || isBusy;
  const label =
    option.value === 'system'
      ? t('moreLanguageSystemDefault')
      : option.nativeLabel;
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
        style={primaryTextStyle}
      >
        {label}
      </Text>
    </Pressable>
  );
};
const MoreRouteContent = ({
  userId,
  displayNameFallback,
}: MoreRouteContentProps) => {
  const { t } = useTranslation();
  const navigation = useNavigation<BottomTabNavigationProp<AuthTabParamList>>();
  const queryClient = useQueryClient();
  const [background, muted] = useThemeColor(['background', 'muted']);
  const appFontPreference = useAppFontPreference();
  const appLanguagePreference = useAppLanguagePreference();
  const isFocused = useIsFocused();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [updatingFontOption, setUpdatingFontOption] =
    useState<AppFontOption | null>(null);
  const [updatingLanguageOption, setUpdatingLanguageOption] =
    useState<AppLanguageOption | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const contentBottomPadding = getContentBottomPadding(insets.bottom, true);
  const scrollIndicatorBottom = getScrollIndicatorBottomInset(
    insets.bottom,
    true,
  );
  useScrollToTop(scrollRef);
  const {
    data: user,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    ...accountUserQueryOptions(userId),
    retry: 1,
    refetchOnMount: 'always',
  });

  const invalidateFocusedAccountQuery = useEffectEvent(() => {
    queryClient.invalidateQueries({
      queryKey: userQueryKeys.account(userId),
    });
  });

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    invalidateFocusedAccountQuery();
  }, [isFocused, userId]);

  const errorMessage = error
    ? getErrorMessage(error, t('moreAccountLoadFailed'))
    : null;
  const profileThemePalette = resolveProfileThemePalette(user);
  const profileThemeStyles = createProfileThemeStyles(profileThemePalette);
  const pageBackgroundColor =
    profileThemePalette.pageBackgroundColor ?? background;
  const entryIconColor = profileThemePalette.linkColor ?? muted;
  const displayName = user
    ? user.name || user.screen_name || displayNameFallback
    : displayNameFallback;
  const handleName = user ? `@${user.screen_name || user.id}` : `@${userId}`;
  const location = user?.location || '';
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
        <Text className="text-[24px] text-muted">{avatarInitial}</Text>
      </View>
    );
  const showLoadingState = !user && (isLoading || isFetching);
  const contentContainerStyle = {
    flexGrow: 1,
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingTop: insets.top,
    paddingBottom: contentBottomPadding + PAGE_BOTTOM_PADDING,
  };
  const handleOpenMyTimeline = () => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.MY_TIMELINE, {
      userId,
      backCount: user?.statuses_count,
    });
  };
  const handleOpenFollowing = () => {
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
  };
  const handleOpenFollowers = () => {
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
  };
  const handleOpenPrivateMessages = () => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.MESSAGES, {
      screen: AUTH_MESSAGES_ROUTE.LIST,
    });
  };
  const handleOpenFavorites = () => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.FAVORITES, {
      userId,
      backCount: user?.favourites_count,
    });
  };
  const handleOpenPhotos = () => {
    const parentNavigation =
      navigation.getParent<NavigationProp<AuthStackParamList>>();
    if (!parentNavigation) {
      return;
    }
    parentNavigation.navigate(AUTH_STACK_ROUTE.PHOTOS, {
      userId,
      backCount: user?.photo_count,
    });
  };
  const profileStatsPrimary = [
    {
      label: t('profileStatPosts'),
      value: user ? formatCount(user.statuses_count) : '--',
      onPress: handleOpenMyTimeline,
    },
    {
      label: t('profileStatFollowing'),
      value: user ? formatCount(user.friends_count) : '--',
      onPress: handleOpenFollowing,
    },
    {
      label: t('profileStatFollowers'),
      value: user ? formatCount(user.followers_count) : '--',
      onPress: handleOpenFollowers,
    },
  ];
  const profileStatsSecondary = [
    {
      label: t('profileStatFavorites'),
      value: user ? formatCount(user.favourites_count) : '--',
      onPress: handleOpenFavorites,
    },
    {
      label: t('profileStatPhotos'),
      value: user ? formatCount(user.photo_count) : '--',
      onPress: handleOpenPhotos,
    },
  ];
  const entries = [
    {
      key: 'messages',
      label: t('morePrivateMessages'),
      value: '',
      helper: t('morePrivateMessagesHelper'),
      showChevron: true,
      icon: PostageStampIcon,
      noIconBox: true,
      onPress: handleOpenPrivateMessages,
    },
  ];
  const handleSignOut = () => {
    if (isSigningOut) {
      return;
    }
    showToastAlert(
      t('moreSignOutConfirmTitle'),
      t('moreSignOutConfirmMessage'),
      [
        {
          text: t('messageDeleteCancel'),
          style: 'cancel',
        },
        {
          text: t('moreSignOut'),
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await saveAuthAccessToken(null);
            } finally {
              queryClient.clear();
              setAuthAccessToken(null);
              setIsSigningOut(false);
            }
          },
        },
      ],
      {
        cancelable: true,
      },
    );
  };
  const handleSelectFontPreference = async (next: AppFontOption) => {
    if (updatingFontOption || appFontPreference === next) {
      return;
    }
    setUpdatingFontOption(next);
    try {
      await persistAppFontPreference(next);
    } catch (updateError) {
      showVariantToast(
        'danger',
        t('moreFontUpdateFailed'),
        getErrorMessage(updateError, t('moreFontUpdateFailedMessage')),
      );
    } finally {
      setUpdatingFontOption(null);
    }
  };
  const handleSelectLanguagePreference = async (next: AppLanguageOption) => {
    if (updatingLanguageOption || appLanguagePreference === next) {
      return;
    }
    setUpdatingLanguageOption(next);
    try {
      await setAppLanguagePreference(next);
    } catch (updateError) {
      showVariantToast(
        'danger',
        t('moreFontUpdateFailed'),
        getErrorMessage(updateError, t('moreFontUpdateFailedMessage')),
      );
    } finally {
      setUpdatingLanguageOption(null);
    }
  };
  return (
    <ProfilePageBackdrop
      backgroundColor={pageBackgroundColor}
      backgroundImageUrl={profileThemePalette.backgroundImageUrl}
      isBackgroundImageTiled={profileThemePalette.isBackgroundImageTiled}
    >
      <ScrollShadow
        className="flex-1"
        LinearGradientComponent={LinearGradient}
        size={SCROLL_SHADOW_SIZE}
        color={pageBackgroundColor}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          scrollIndicatorInsets={{
            bottom: scrollIndicatorBottom,
          }}
          contentContainerStyle={contentContainerStyle}
        >
          <View
            className="flex-1"
            style={{
              marginTop: SECTION_TOP_MARGIN,
            }}
          >
            <View
              style={{
                gap: SECTION_GAP,
              }}
            >
              <DropShadowBox>
                {showLoadingState ? (
                  <Surface
                    className="bg-surface border-2 border-foreground dark:border-border px-5 py-6"
                    style={profileThemeStyles.panelStyle}
                  >
                    <View className="flex-row items-center gap-4">
                      <View
                        className="items-center justify-center rounded-full border-2 border-foreground dark:border-border bg-surface-secondary"
                        style={{
                          width: AVATAR_SIZE,
                          height: AVATAR_SIZE,
                        }}
                      >
                        <NeobrutalActivityIndicator size="small" />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-[16px] font-semibold text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreAccountLoading')}
                        </Text>
                        {handleName ? (
                          <Text
                            className="mt-1 text-[12px] text-muted"
                            style={profileThemeStyles.mutedTextStyle}
                          >
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
                    panelStyle={profileThemeStyles.panelStyle}
                    primaryTextStyle={profileThemeStyles.primaryTextStyle}
                    mutedTextStyle={profileThemeStyles.mutedTextStyle}
                    linkTextStyle={profileThemeStyles.linkTextStyle}
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
                  <ProfileStatRow
                    stats={profileStatsPrimary}
                    panelStyle={profileThemeStyles.panelStyle}
                    valueTextStyle={profileThemeStyles.primaryTextStyle}
                    labelTextStyle={profileThemeStyles.primaryTextStyle}
                  />
                  <ProfileStatRow
                    stats={profileStatsSecondary}
                    panelStyle={profileThemeStyles.panelStyle}
                    valueTextStyle={profileThemeStyles.primaryTextStyle}
                    labelTextStyle={profileThemeStyles.primaryTextStyle}
                  />
                </>
              ) : showLoadingState ? (
                <>
                  <ProfileStatRow
                    stats={[]}
                    skeleton
                    itemCount={3}
                    panelStyle={profileThemeStyles.panelStyle}
                  />
                  <ProfileStatRow
                    stats={[]}
                    skeleton
                    itemCount={2}
                    panelStyle={profileThemeStyles.panelStyle}
                  />
                </>
              ) : null}

              <View
                style={{
                  gap: ENTRY_GAP,
                }}
              >
                {entries.map(entry => {
                  const { key, ...entryProps } = entry;
                  return (
                    <EntryRow
                      key={key}
                      {...entryProps}
                      iconColor={entryIconColor}
                      panelStyle={profileThemeStyles.panelStyle}
                      primaryTextStyle={profileThemeStyles.primaryTextStyle}
                      mutedTextStyle={profileThemeStyles.mutedTextStyle}
                    />
                  );
                })}
              </View>

              <DropShadowBox>
                <Surface
                  className="bg-surface border-2 border-foreground dark:border-border"
                  style={profileThemeStyles.panelStyle}
                >
                  <View className="border-b-2 border-foreground dark:border-border px-4 py-4">
                    <Text
                      className="text-[15px] font-semibold text-foreground"
                      style={profileThemeStyles.primaryTextStyle}
                    >
                      {t('moreFontStyle')}
                    </Text>
                    <Text
                      className="mt-0.5 text-[12px] text-muted"
                      style={profileThemeStyles.mutedTextStyle}
                    >
                      {t('moreFontStyleHelper')}
                    </Text>
                  </View>
                  {APP_FONT_OPTIONS.map((option, index) => (
                    <FontSettingRow
                      key={option.value}
                      option={option}
                      isLast={index === APP_FONT_OPTIONS.length - 1}
                      isSelected={appFontPreference === option.value}
                      isBusy={Boolean(updatingFontOption)}
                      onPress={handleSelectFontPreference}
                      primaryTextStyle={profileThemeStyles.primaryTextStyle}
                    />
                  ))}
                </Surface>
              </DropShadowBox>

              <DropShadowBox>
                <Surface
                  className="bg-surface border-2 border-foreground dark:border-border"
                  style={profileThemeStyles.panelStyle}
                >
                  <View className="border-b-2 border-foreground dark:border-border px-4 py-4">
                    <Text
                      className="text-[15px] font-semibold text-foreground"
                      style={profileThemeStyles.primaryTextStyle}
                    >
                      {t('moreLanguage')}
                    </Text>
                    <Text
                      className="mt-0.5 text-[12px] text-muted"
                      style={profileThemeStyles.mutedTextStyle}
                    >
                      {t('moreLanguageHelper')}
                    </Text>
                  </View>
                  {APP_LANGUAGE_OPTIONS.map((option, index) => (
                    <LanguageSettingRow
                      key={option.value}
                      option={option}
                      isLast={index === APP_LANGUAGE_OPTIONS.length - 1}
                      isSelected={appLanguagePreference === option.value}
                      isBusy={Boolean(updatingLanguageOption)}
                      onPress={handleSelectLanguagePreference}
                      primaryTextStyle={profileThemeStyles.primaryTextStyle}
                    />
                  ))}
                </Surface>
              </DropShadowBox>
            </View>

            <View className="flex-1" />

            <View className="mt-6">
              <AuthActionButton
                label={t('moreSignOut')}
                loadingLabel={t('moreSigningOut')}
                variant="danger"
                onPress={handleSignOut}
                isLoading={isSigningOut}
              />
            </View>
          </View>
        </ScrollView>
      </ScrollShadow>
    </ProfilePageBackdrop>
  );
};
const MissingUserIdPlaceholder = () => {
  const { t } = useTranslation();
  const [background] = useThemeColor(['background']);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const placeholderContentPadding = getContentBottomPadding(
    insets.bottom,
    true,
  );
  const placeholderScrollInset = getScrollIndicatorBottomInset(
    insets.bottom,
    true,
  );
  useScrollToTop(scrollRef);
  const contentContainerStyle = {
    flexGrow: 1,
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingTop: insets.top,
    paddingBottom: placeholderContentPadding + PAGE_BOTTOM_PADDING,
    justifyContent: 'center' as const,
  };
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
                {t('moreAccountLoadFailedNoId')}
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
