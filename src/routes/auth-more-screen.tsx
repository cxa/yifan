import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { useThemeTransition } from '@/context/theme-transition';
import {
  Image,
  NativeModules,
  Platform,
  StatusBar,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useHeaderHeight } from '@react-navigation/elements';
import NeobrutalActivityIndicator from '@/components/neobrutal-activity-indicator';
import {
  useIsFocused,
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Dialog, PressableFeedback, Select, Separator, Surface, Switch, useThemeColor } from 'heroui-native';
import ErrorBanner from '@/components/error-banner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Leaf } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { setAuthAccessToken, useAuthSession } from '@/auth/auth-session';
import { saveAuthAccessToken } from '@/auth/secure-token-storage';
import AuthActionButton from '@/components/auth-action-button';
import { Text } from '@/components/app-text';
import { CARD_BG_DARK, CARD_BG_LIGHT, CARD_PASTEL_CYCLE } from '@/components/drop-shadow-box';
import ProfilePageBackdrop from '@/components/profile-page-backdrop';
import ProfileStatRow from '@/components/profile-stat-row';
import ProfileSummaryCard from '@/components/profile-summary-card';
import TimelineTitleHeader from '@/components/timeline-title-header';
import {
  AUTH_MESSAGES_ROUTE,
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
} from '@/navigation/route-names';
import useUserTimelineHeader from '@/navigation/use-user-timeline-header';
import {
  getContentBottomPadding,
  getScrollIndicatorBottomInset,
} from '@/navigation/tab-bar-layout';
import type { AuthStackParamList, AuthTabParamList } from '@/navigation/types';
import NativeEdgeScrollShadow, {
  resolveNativeEdgeScrollShadowSize,
} from '@/components/native-edge-scroll-shadow';
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
  APP_FONT_SIZE_OPTION,
  APP_FONT_SIZE_OPTIONS,
  setAppFontSizePreference,
  type AppFontSizeOption,
  useAppFontSizePreference,
} from '@/settings/app-font-size-preference';
import {
  APP_LANGUAGE_OPTIONS,
  setAppLanguagePreference,
  type AppLanguageOption,
  useAppLanguagePreference,
} from '@/settings/app-language-preference';
import {
  APP_THEME_OPTION,
  APP_THEME_OPTIONS,
  setAppThemePreference,
  type AppThemeOption,
  useAppThemePreference,
} from '@/settings/app-theme-preference';
import {
  APP_APPEARANCE_OPTIONS,
  setAppAppearancePreference,
  type AppAppearanceOption,
  useAppAppearancePreference,
  useEffectiveIsDark,
} from '@/settings/app-appearance-preference';
import {
  setAppProfileThemePreference,
  useAppProfileThemePreference,
} from '@/settings/app-profile-theme-preference';
import {
  APP_UI_STYLE_OPTIONS,
  setAppUiStylePreference,
  type AppUiStyleOption,
  useAppUiStylePreference,
} from '@/settings/app-ui-style-preference';
import { formatJoinedAt } from '@/utils/fanfou-date';
import { parseHtmlToText } from '@/utils/parse-html';
import {
  adaptProfilePaletteForDarkMode,
  createProfileThemeStyles,
  isColorDark,
  resolveReadableTextColor,
  resolveProfileThemePalette,
} from '@/utils/profile-theme';
const PAGE_HORIZONTAL_PADDING = 20;
const PAGE_BOTTOM_PADDING = 24;
const SECTION_GAP = 20;
const AVATAR_SIZE = 96;
const IOS_TOP_CONTENT_OFFSET = 0.1;
const IOS_TOP_CONTENT_EQUAL_STATUS_BAR_PADDING = 4;
const IOS_TOP_CONTENT_LARGER_SAFE_AREA_PADDING = 0;
const getStatusBarHeight = (): number | undefined => {
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight;
  }
  if (Platform.OS === 'ios') {
    const statusBarManager = NativeModules.StatusBarManager as
      | {
        statusBarFrame?: {
          height?: number;
        };
        HEIGHT?: number;
      }
      | undefined;
    const frameHeight = statusBarManager?.statusBarFrame?.height;
    if (typeof frameHeight === 'number' && frameHeight > 0) {
      return frameHeight;
    }
    const legacyHeight = statusBarManager?.HEIGHT;
    if (typeof legacyHeight === 'number' && legacyHeight > 0) {
      return legacyHeight;
    }
  }
  return undefined;
};
const resolveTopContentPadding = ({
  safeAreaTop,
  statusBarHeight,
}: {
  safeAreaTop: number;
  statusBarHeight?: number;
}) => {
  const hasStatusBarHeight =
    typeof statusBarHeight === 'number' && statusBarHeight > 0;
  let extraPadding = IOS_TOP_CONTENT_EQUAL_STATUS_BAR_PADDING;
  if (hasStatusBarHeight && safeAreaTop > statusBarHeight) {
    extraPadding = IOS_TOP_CONTENT_LARGER_SAFE_AREA_PADDING;
  }
  return safeAreaTop + extraPadding + IOS_TOP_CONTENT_OFFSET;
};
const POSTAGE_STAMP_PATH =
  'M14 1' +
  'v1.4 a.75.75 0 0 0 0 1.5 v1.4 a.75.75 0 0 0 0 1.5 v1.4 a.75.75 0 0 0 0 1.5 v1.4 a.75.75 0 0 0 0 1.5 v1.4' +
  'h-1.4 a.75.75 0 0 0-1.5 0 h-1.4 a.75.75 0 0 0-1.5 0 h-1.4 a.75.75 0 0 0-1.5 0 h-1.4 a.75.75 0 0 0-1.5 0 h-1.4' +
  'v-1.4 a.75.75 0 0 0 0-1.5 v-1.4 a.75.75 0 0 0 0-1.5 v-1.4 a.75.75 0 0 0 0-1.5 v-1.4 a.75.75 0 0 0 0-1.5 v-1.4' +
  'h1.4 a.75.75 0 0 0 1.5 0 h1.4 a.75.75 0 0 0 1.5 0 h1.4 a.75.75 0 0 0 1.5 0 h1.4 a.75.75 0 0 0 1.5 0 h1.4z';

// Wavy cancellation lines clustered in bottom-right, clipped within stamp bounds (x≤12.8)
const STAMP_WAVE_LINES: {
  d: string;
  opacity: number;
}[] = [
    {
      d: 'M7.5 9.5 C9 8.7 10.5 10.5 12 9.7 C12.5 9.4 12.8 9.5 12.8 9.5',
      opacity: 0.25,
    },
    {
      d: 'M6.5 11.1 C8 10.3 9.5 12.1 11 11.3 C12 10.8 12.8 11.1 12.8 11.1',
      opacity: 0.5,
    },
    {
      d: 'M6 12.7 C7.5 11.9 9 13.7 10.5 12.9 C11.5 12.4 12.8 12.7 12.8 12.7',
      opacity: 0.3,
    },
  ];

// Sun mode: left hill taller (peak y=6.5), right hill shorter (peak y=9.5)
const STAMP_HILL_SUN_PATH = 'M3 12.5 Q6 6.5 9.5 12.5';
const STAMP_HILL2_SUN_PATH = 'M9.5 12.5 Q12 9.5 13 12.5';

// Moon mode: left hill taller (peak y=6.5), right hill shorter (peak y=9.5)
const STAMP_HILL_MOON_PATH = 'M3 12.5 Q6 6.5 9.5 12.5';
const STAMP_HILL2_MOON_PATH = 'M9.5 12.5 Q12 9.5 13 12.5';

// Moon crescent aligned left, centered higher around (4.5, 3.8)
const STAMP_MOON_PATH = 'M6 2.8 A2.2 2.2 0 1 1 3.2 5.8 A1.5 1.5 0 0 0 6 2.8';
const PostageStampIcon = ({ color, size }: { color: string; size: number }) => {
  const isDark = useEffectiveIsDark();
  return (
    <Svg width={size} height={size} viewBox="0 0 15 15">
      <Path
        d={POSTAGE_STAMP_PATH}
        fill="none"
        stroke={color}
        strokeWidth="0.8"
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
const PROFILE_GROUP_GAP = SECTION_GAP;
const HEADER_TITLE_REVEAL_RATIO = 0.25;
const SYSTEM_FONT_FAMILY = Platform.select({
  ios: 'ui-rounded',
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
type MoreRouteContentProps = {
  userId: string;
  displayNameFallback: string;
};
const MoreRouteContent = ({
  userId,
  displayNameFallback,
}: MoreRouteContentProps) => {
  const { t } = useTranslation();
  const fontOptionLabels: Record<AppFontOption, string> = {
    [APP_FONT_OPTION.SYSTEM]: t('moreFontOptionSystem'),
    [APP_FONT_OPTION.XIAOLAI]: '小赖字体',
    [APP_FONT_OPTION.HUIWEN_HKHEI]: '匯文港黑',
    [APP_FONT_OPTION.HUIWEN_MINCHO_GBK]: '匯文明朝體',
  };
  const fontSizeLabels: Record<AppFontSizeOption, string> = {
    [APP_FONT_SIZE_OPTION.XS]: t('moreFontSizeXS'),
    [APP_FONT_SIZE_OPTION.SM]: t('moreFontSizeSM'),
    [APP_FONT_SIZE_OPTION.MD]: t('moreFontSizeMD'),
    [APP_FONT_SIZE_OPTION.LG]: t('moreFontSizeLG'),
    [APP_FONT_SIZE_OPTION.XL]: t('moreFontSizeXL'),
  };
  const navigation = useNavigation<BottomTabNavigationProp<AuthTabParamList>>();
  const headerHeight = useHeaderHeight();
  const scrollShadowSize = resolveNativeEdgeScrollShadowSize({
    headerHeight,
  });
  const queryClient = useQueryClient();
  const [background, muted] = useThemeColor(['background', 'muted']);
  const { prepareSnapshot, requestTransition } = useThemeTransition();
  const isDark = useEffectiveIsDark();
  const followProfileTheme = useAppProfileThemePreference();
  const appFontPreference = useAppFontPreference();
  const appFontSizePreference = useAppFontSizePreference();
  const appLanguagePreference = useAppLanguagePreference();
  const appThemePreference = useAppThemePreference();
  const appAppearancePreference = useAppAppearancePreference();
  const appUiStylePreference = useAppUiStylePreference();
  const isFocused = useIsFocused();
  const scrollY = useSharedValue(0);
  const headerTitleVisible = useSharedValue(false);
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPostcardExpanded, setIsPostcardExpanded] = useState(false);
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const scrollRef =
    useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);
  const insets = useSafeAreaInsets();
  const statusBarHeight = getStatusBarHeight();
  const contentBottomPadding = getContentBottomPadding(insets.bottom, true);
  const scrollIndicatorBottom = getScrollIndicatorBottomInset(
    insets.bottom,
    true,
  );
  useScrollToTop(scrollRef);
  const updateShowHeaderTitle = (nextVisibility: boolean) => {
    setShowHeaderTitle(nextVisibility);
  };
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
      const shouldShowHeaderTitle =
        event.contentOffset.y >= scrollShadowSize * HEADER_TITLE_REVEAL_RATIO;
      if (shouldShowHeaderTitle !== headerTitleVisible.value) {
        headerTitleVisible.value = shouldShowHeaderTitle;
        scheduleOnRN(updateShowHeaderTitle, shouldShowHeaderTitle);
      }
    },
  });
  const titleContainerStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, 88], [44, 0], Extrapolation.CLAMP),
    opacity: interpolate(scrollY.value, [0, 70], [1, 0], Extrapolation.CLAMP),
  }));
  const titleTextStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(scrollY.value, [0, 88], [1, 0.6], Extrapolation.CLAMP),
      },
    ],
    transformOrigin: 'top left',
  }));
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

  const errorMessage = error ? t('moreAccountLoadFailed') : null;
  const technicalError = error instanceof Error ? error.message : null;
  const profileThemePalette = (() => {
    const palette = followProfileTheme
      ? resolveProfileThemePalette(user)
      : resolveProfileThemePalette(undefined);
    return followProfileTheme && isDark
      ? adaptProfilePaletteForDarkMode(palette)
      : palette;
  })();
  // Shuffle pastels once on mount so sections get a fresh random combo each visit.
  const colorfulPaletteRef = useRef<typeof CARD_PASTEL_CYCLE | null>(null);
  if (colorfulPaletteRef.current === null) {
    colorfulPaletteRef.current = [...CARD_PASTEL_CYCLE].sort(() => Math.random() - 0.5);
  }
  const shuffledPalette = colorfulPaletteRef.current;
  const colorfulSectionStyles = !followProfileTheme && appThemePreference === APP_THEME_OPTION.COLORFUL
    ? {
        profile:  { backgroundColor: isDark ? CARD_BG_DARK[shuffledPalette[0]] : CARD_BG_LIGHT[shuffledPalette[0]] },
        stats:    { backgroundColor: isDark ? CARD_BG_DARK[shuffledPalette[1]] : CARD_BG_LIGHT[shuffledPalette[1]] },
        messages: { backgroundColor: isDark ? CARD_BG_DARK[shuffledPalette[2]] : CARD_BG_LIGHT[shuffledPalette[2]] },
        settings: { backgroundColor: isDark ? CARD_BG_DARK[shuffledPalette[3]] : CARD_BG_LIGHT[shuffledPalette[3]] },
      }
    : null;
  const hasBackgroundImage = Boolean(profileThemePalette.backgroundImageUrl);
  const preferredHeaderTintColor =
    profileThemePalette.linkColor ?? profileThemePalette.textColor;
  const headerTintColor = hasBackgroundImage
    ? preferredHeaderTintColor ?? '#FFFFFF'
    : preferredHeaderTintColor ??
    (profileThemePalette.pageBackgroundColor
      ? resolveReadableTextColor({
        backgroundColor: profileThemePalette.pageBackgroundColor,
      })
      : undefined);
  const isHeaderTintDark = headerTintColor
    ? isColorDark(headerTintColor)
    : undefined;
  const headerBackgroundColor = hasBackgroundImage
    ? isHeaderTintDark
      ? 'rgba(255, 255, 255, 0.58)'
      : 'rgba(0, 0, 0, 0.44)'
    : undefined;
  useUserTimelineHeader({
    userId,
    user,
    headerTintColor,
    headerBackgroundColor,
    showHeaderTitle,
  });
  const profileThemeStyles = createProfileThemeStyles(profileThemePalette);
  const panelStyle = {
    profile:  colorfulSectionStyles?.profile  ?? profileThemeStyles.panelStyle,
    stats:    colorfulSectionStyles?.stats    ?? profileThemeStyles.panelStyle,
    messages: colorfulSectionStyles?.messages ?? profileThemeStyles.panelStyle,
    settings: colorfulSectionStyles?.settings ?? profileThemeStyles.panelStyle,
  };
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
    paddingTop: resolveTopContentPadding({
      safeAreaTop: insets.top,
      statusBarHeight,
    }),
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
  const handleSignOut = () => {
    if (isSigningOut) {
      return;
    }
    setIsSignOutDialogOpen(true);
  };
  const handleConfirmSignOut = async () => {
    setIsSignOutDialogOpen(false);
    setIsSigningOut(true);
    try {
      await saveAuthAccessToken(null);
    } finally {
      queryClient.clear();
      setAuthAccessToken(null);
      setIsSigningOut(false);
    }
  };
  const handleToggleFollowProfile = async (next: boolean) => {
    try {
      await setAppProfileThemePreference(next);
    } catch {
      // ignore — UI already reverted optimistically inside the store
    }
  };
  const handleSelectFontSizePreference = async (next: AppFontSizeOption) => {
    if (appFontSizePreference === next) {
      return;
    }
    try {
      await setAppFontSizePreference(next);
    } catch (updateError) {
      showVariantToast(
        'danger',
        t('moreFontUpdateFailed'),
        getErrorMessage(updateError, t('moreFontUpdateFailedMessage')),
      );
    }
  };
  const handleSelectFontPreference = async (next: AppFontOption) => {
    if (appFontPreference === next) {
      return;
    }
    try {
      await persistAppFontPreference(next);
    } catch (updateError) {
      showVariantToast(
        'danger',
        t('moreFontUpdateFailed'),
        getErrorMessage(updateError, t('moreFontUpdateFailedMessage')),
      );
    }
  };
  const handleSelectLanguagePreference = async (next: AppLanguageOption) => {
    if (appLanguagePreference === next) {
      return;
    }
    try {
      await setAppLanguagePreference(next);
    } catch (updateError) {
      showVariantToast(
        'danger',
        t('moreFontUpdateFailed'),
        getErrorMessage(updateError, t('moreFontUpdateFailedMessage')),
      );
    }
  };
  const handleSelectThemePreference = async (next: AppThemeOption) => {
    if (appThemePreference === next) {
      return;
    }
    try {
      await setAppThemePreference(next);
    } catch (updateError) {
      showVariantToast(
        'danger',
        t('moreFontUpdateFailed'),
        getErrorMessage(updateError, t('moreFontUpdateFailedMessage')),
      );
    }
  };
  const handleSelectAppearancePreference = (next: AppAppearanceOption) => {
    if (appAppearancePreference === next) {
      return;
    }
    requestTransition(() =>
      setAppAppearancePreference(next).catch(updateError => {
        showVariantToast(
          'danger',
          t('moreFontUpdateFailed'),
          getErrorMessage(updateError, t('moreFontUpdateFailedMessage')),
        );
      }),
    );
  };
  const handleSelectUiStylePreference = async (next: AppUiStyleOption) => {
    if (appUiStylePreference === next) {
      return;
    }
    try {
      await setAppUiStylePreference(next);
    } catch (updateError) {
      showVariantToast(
        'danger',
        t('moreFontUpdateFailed'),
        getErrorMessage(updateError, t('moreFontUpdateFailedMessage')),
      );
    }
  };
  const fontSelectValue = (() => {
    const opt = APP_FONT_OPTIONS.find(o => o.value === appFontPreference);
    return opt ? { value: opt.value, label: fontOptionLabels[opt.value] } : undefined;
  })();
  const fontSizeSelectValue = (() => {
    const opt = APP_FONT_SIZE_OPTIONS.find(o => o.value === appFontSizePreference);
    return opt ? { value: opt.value, label: fontSizeLabels[opt.value] } : undefined;
  })();
  const languageSelectValue = {
    value: appLanguagePreference,
    label:
      appLanguagePreference === 'system'
        ? t('moreLanguageSystemDefault')
        : APP_LANGUAGE_OPTIONS.find(o => o.value === appLanguagePreference)
            ?.nativeLabel ?? appLanguagePreference,
  };
  const appearanceLabels = {
    auto: t('moreAppearanceAuto'),
    light: t('moreAppearanceLight'),
    dark: t('moreAppearanceDark'),
  } as const;
  const appearanceSelectValue = {
    value: appAppearancePreference,
    label: appearanceLabels[appAppearancePreference],
  };
  const themeSelectValue = {
    value: appThemePreference,
    label:
      appThemePreference === 'colorful'
        ? t('moreThemeColorful')
        : t('moreThemePlain'),
  };
  const uiStyleSelectValue = {
    value: appUiStylePreference,
    label:
      appUiStylePreference === 'soft'
        ? t('moreStyleSoft')
        : t('moreStyleSharp'),
  };
  return (
    <ProfilePageBackdrop
      backgroundColor={pageBackgroundColor}
      backgroundImageUrl={profileThemePalette.backgroundImageUrl}
      isBackgroundImageTiled={profileThemePalette.isBackgroundImageTiled}
      isDark={isDark}
    >
      <NativeEdgeScrollShadow
        className="flex-1"
        color={pageBackgroundColor}
        size={scrollShadowSize}
      >
        <Animated.ScrollView
          ref={scrollRef}
          className="flex-1"
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustsScrollIndicatorInsets={false}
          scrollIndicatorInsets={{
            top: insets.top,
            bottom: scrollIndicatorBottom,
          }}
          contentContainerStyle={contentContainerStyle}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <View className="flex-1">
            <View style={{ gap: SECTION_GAP }}>
              <TimelineTitleHeader
                title={user?.screen_name || displayNameFallback}
                titleContainerStyle={titleContainerStyle}
                titleTextStyle={titleTextStyle}
              />
              {/* Profile block: summary card + stat rows */}
              <View style={{ gap: PROFILE_GROUP_GAP }}>
                {showLoadingState ? (
                    <Surface
                      className="bg-surface-secondary px-4 py-6"
                      style={panelStyle.profile}
                    >
                      <View className="flex-row items-center gap-4">
                        <View
                          className="items-center justify-center rounded-full bg-surface-tertiary"
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
                          <Text
                            className="mt-1 text-[12px] text-muted"
                            style={profileThemeStyles.mutedTextStyle}
                          >
                            {handleName}
                          </Text>
                        </View>
                      </View>
                      {errorMessage ? (
                        <View className="mt-4">
                          <ErrorBanner message={errorMessage} technicalDetail={technicalError} />
                        </View>
                      ) : null}
                    </Surface>
                  ) : (
                    <ProfileSummaryCard
                      containerClassName="bg-accent/10 px-4 py-6"
                      avatar={accountAvatar}
                      handleName={handleName}
                      location={location}
                      joinedAt={joinedAt}
                      profileUrl={profileUrl}
                      description={description}
                      panelStyle={panelStyle.profile}
                      primaryTextStyle={profileThemeStyles.primaryTextStyle}
                      mutedTextStyle={profileThemeStyles.mutedTextStyle}
                      linkTextStyle={profileThemeStyles.linkTextStyle}
                      footer={
                        errorMessage ? (
                          <View className="mt-4">
                            <ErrorBanner message={errorMessage} technicalDetail={technicalError} />
                          </View>
                        ) : null
                      }
                    />
                  )}

                {user ? (
                  <>
                    <ProfileStatRow
                      stats={profileStatsPrimary}
                      panelStyle={panelStyle.stats}
                      valueTextStyle={profileThemeStyles.primaryTextStyle}
                      labelTextStyle={profileThemeStyles.primaryTextStyle}
                    />
                    <ProfileStatRow
                      stats={profileStatsSecondary}
                      panelStyle={panelStyle.stats}
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
                      panelStyle={panelStyle.stats}
                    />
                    <ProfileStatRow
                      stats={[]}
                      skeleton
                      itemCount={2}
                      panelStyle={panelStyle.stats}
                    />
                  </>
                ) : null}
              </View>

              {/* Messages */}
              <PressableFeedback
                onPress={handleOpenPrivateMessages}
                accessibilityRole="button"
                className="rounded-3xl overflow-hidden"
              >
                <Surface
                  className="bg-surface-secondary overflow-hidden"
                  style={panelStyle.messages}
                >
                  <PressableFeedback.Highlight />
                  <View className="flex-row items-center gap-3 px-4">
                    <PostageStampIcon color={entryIconColor} size={32} />
                    <View className="flex-1">
                      <Text
                        className="text-[15px] font-semibold text-foreground"
                        style={profileThemeStyles.primaryTextStyle}
                      >
                        {t('morePrivateMessages')}
                      </Text>
                      <Text
                        className="mt-0.5 text-[12px] text-muted"
                        style={profileThemeStyles.mutedTextStyle}
                      >
                        {t('morePrivateMessagesHelper')}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={entryIconColor} />
                  </View>
                </Surface>
              </PressableFeedback>

              {/* Settings */}
              <Surface
                className="bg-surface-secondary overflow-hidden"
                style={panelStyle.settings}
              >
                    <Select
                      value={fontSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectFontPreference(opt.value as AppFontOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        <Text
                          className="flex-1 text-[15px] font-semibold text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreFontStyle')}
                        </Text>
                        <Text className="text-[13px] text-muted">{fontSelectValue?.label}</Text>
                        <ChevronDown size={13} color={muted} />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" placement="top" width="trigger" className="rounded-3xl">
                          {APP_FONT_OPTIONS.map(option => {
                            const fontFamily = getFontPreviewFamily(option.value);
                            return (
                              <Select.Item key={option.value} value={option.value} label={fontOptionLabels[option.value]}>
                                <Select.ItemLabel style={fontFamily ? { fontFamily } : undefined} />
                                <Select.ItemIndicator />
                              </Select.Item>
                            );
                          })}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
                    <Separator />
                    <Select
                      value={fontSizeSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectFontSizePreference(opt.value as AppFontSizeOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        <Text
                          className="flex-1 text-[15px] font-semibold text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreFontSize')}
                        </Text>
                        <Text className="text-[13px] text-muted">{fontSizeSelectValue?.label}</Text>
                        <ChevronDown size={13} color={muted} />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" placement="top" width="trigger" className="rounded-3xl">
                          {APP_FONT_SIZE_OPTIONS.map(option => (
                            <Select.Item key={option.value} value={option.value} label={fontSizeLabels[option.value]} />
                          ))}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
                    <Separator />
                    <Select
                      value={languageSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectLanguagePreference(opt.value as AppLanguageOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        <Text
                          className="flex-1 text-[15px] font-semibold text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreLanguage')}
                        </Text>
                        <Text className="text-[13px] text-muted">{languageSelectValue.label}</Text>
                        <ChevronDown size={13} color={muted} />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" placement="top" width="trigger" className="rounded-3xl">
                          {APP_LANGUAGE_OPTIONS.map(option => (
                            <Select.Item
                              key={option.value}
                              value={option.value}
                              label={option.value === 'system' ? t('moreLanguageSystemDefault') : option.nativeLabel}
                            />
                          ))}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
                    <Separator />
                    <Select
                      value={appearanceSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectAppearancePreference(opt.value as AppAppearanceOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70" onPress={prepareSnapshot}>
                        <Text
                          className="flex-1 text-[15px] font-semibold text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreAppearance')}
                        </Text>
                        <Text className="text-[13px] text-muted">{appearanceSelectValue.label}</Text>
                        <ChevronDown size={13} color={muted} />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" placement="top" width="trigger" className="rounded-3xl">
                          {APP_APPEARANCE_OPTIONS.map(option => (
                            <Select.Item
                              key={option.value}
                              value={option.value}
                              label={appearanceLabels[option.value]}
                            />
                          ))}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
                    <Separator />
                    <Select
                      value={themeSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectThemePreference(opt.value as AppThemeOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        <Text
                          className="flex-1 text-[15px] font-semibold text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreTheme')}
                        </Text>
                        <Text className="text-[13px] text-muted">{themeSelectValue.label}</Text>
                        <ChevronDown size={13} color={muted} />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" placement="top" width="trigger" className="rounded-3xl">
                          {APP_THEME_OPTIONS.map(option => (
                            <Select.Item
                              key={option.value}
                              value={option.value}
                              label={option.value === 'colorful' ? t('moreThemeColorful') : t('moreThemePlain')}
                            />
                          ))}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
                    <Separator />
                    <Select
                      value={uiStyleSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectUiStylePreference(opt.value as AppUiStyleOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        <Text
                          className="flex-1 text-[15px] font-semibold text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreStyle')}
                        </Text>
                        <Text className="text-[13px] text-muted">{uiStyleSelectValue.label}</Text>
                        <ChevronDown size={13} color={muted} />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" placement="top" width="trigger" className="rounded-3xl">
                          {APP_UI_STYLE_OPTIONS.map(option => (
                            <Select.Item
                              key={option.value}
                              value={option.value}
                              label={option.value === 'soft' ? t('moreStyleSoft') : t('moreStyleSharp')}
                            />
                          ))}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
              </Surface>
            </View>

            <View className="flex-1" />

            <View className="mt-6">
              <Surface className="bg-surface-secondary px-4 py-3.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[15px] font-semibold text-foreground">
                      {t('moreFollowProfile')}
                    </Text>
                    <Switch
                      isSelected={followProfileTheme}
                      onSelectedChange={handleToggleFollowProfile}
                    />
                  </View>
                  <Text className="mt-3 text-[12px] text-muted">
                    {t('moreFollowProfileHint')}
                  </Text>
              </Surface>
              <View className="mt-8">
                <AuthActionButton
                  label={t('moreSignOut')}
                  loadingLabel={t('moreSigningOut')}
                  variant="danger"
                  onPress={handleSignOut}
                  isLoading={isSigningOut}
                />
              </View>
              <View className="mt-12 px-1">
                <Text className="text-[13px] text-muted opacity-40 text-center tracking-widest mb-2">
                  {t('morePostcardCraftedByPrefix')}<Text
                    className="underline active:opacity-50"
                    onPress={() => {
                      const parentNavigation = navigation.getParent<NavigationProp<AuthStackParamList>>();
                      if (!parentNavigation) return;
                      parentNavigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
                        screen: AUTH_PROFILE_ROUTE.DETAIL,
                        params: { userId: 'realazy' },
                      });
                    }}
                  >@realazy</Text>{t('morePostcardCraftedBySuffix')}
                </Text>
                <PressableFeedback
                  className="items-center active:opacity-60"
                  onPress={() => {
                    setIsPostcardExpanded(v => {
                      if (!v) {
                        setTimeout(() => (scrollRef.current as { scrollToEnd?: (opts: { animated: boolean }) => void } | null)?.scrollToEnd?.({ animated: true }), 50);
                      }
                      return !v;
                    });
                  }}
                >
                  <Text className="text-[11px] text-muted opacity-30 text-center">{t('morePostcardLabel')}</Text>
                </PressableFeedback>
                {isPostcardExpanded && (
                  <>
                    <View className="flex-row items-center mt-5 mb-5">
                      <View className="flex-1 h-px bg-muted opacity-20" />
                      <Leaf size={13} color={muted} className="mx-2" />
                      <View className="flex-1 h-px bg-muted opacity-20" />
                    </View>
                    <Text className="text-[13px] text-muted leading-6 text-center">
                      广西南宁市青秀区凤凰岭路1号{'\n'}荣和大地二组团10B202（邮编 530028）{'\n'}realazy 收
                    </Text>
                    <View className="flex-row items-center mt-5">
                      <View className="flex-1 h-px bg-muted opacity-20" />
                      <Leaf size={13} color={muted} className="mx-2" />
                      <View className="flex-1 h-px bg-muted opacity-20" />
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </Animated.ScrollView>
      </NativeEdgeScrollShadow>
      <Dialog isOpen={isSignOutDialogOpen} onOpenChange={setIsSignOutDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/80" />
          <Dialog.Content>
            <View className="mb-5 gap-1.5">
              <Dialog.Title>{t('moreSignOutConfirmTitle')}</Dialog.Title>
              <Dialog.Description>{t('moreSignOutConfirmMessage')}</Dialog.Description>
            </View>
            <View className="flex-row justify-end gap-3">
              <Button variant="ghost" size="sm" onPress={() => setIsSignOutDialogOpen(false)}>
                {t('messageDeleteCancel')}
              </Button>
              <Button variant="danger" size="sm" onPress={handleConfirmSignOut}>
                {t('moreSignOut')}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </ProfilePageBackdrop>
  );
};
const MissingUserIdPlaceholder = () => {
  const { t } = useTranslation();
  const headerHeight = useHeaderHeight();
  const scrollShadowSize = resolveNativeEdgeScrollShadowSize({
    headerHeight,
  });
  const [background] = useThemeColor(['background']);
  const scrollRef =
    useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);
  const insets = useSafeAreaInsets();
  const statusBarHeight = getStatusBarHeight();
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
    paddingTop: resolveTopContentPadding({
      safeAreaTop: insets.top,
      statusBarHeight,
    }),
    paddingBottom: placeholderContentPadding + PAGE_BOTTOM_PADDING,
    justifyContent: 'center' as const,
  };
  return (
    <NativeEdgeScrollShadow
      className="flex-1"
      color={background}
      size={scrollShadowSize}
    >
      <Animated.ScrollView
        ref={scrollRef}
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustsScrollIndicatorInsets={false}
        scrollIndicatorInsets={{
          top: insets.top,
          bottom: placeholderScrollInset,
        }}
        contentContainerStyle={contentContainerStyle}
      >
        <Surface className="bg-surface-secondary px-5 py-6">
          <ErrorBanner message={t('moreAccountLoadFailedNoId')} />
        </Surface>
      </Animated.ScrollView>
    </NativeEdgeScrollShadow>
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
