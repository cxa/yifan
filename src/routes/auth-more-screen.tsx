import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { useThemeTransition } from '@/context/theme-transition';
import {
  NativeModules,
  Platform,
  StatusBar,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useHeaderHeight } from '@react-navigation/elements';
import {
  useIsFocused,
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Dialog, PressableFeedback, Select, Surface, Switch, useThemeColor } from 'heroui-native';
import ErrorBanner from '@/components/error-banner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ALargeSmall,
  AlertCircle,
  ChevronRight,
  Languages,
  Leaf,
  Mail,
  Palette,
  Shapes,
  SunMoon,
  Type,
} from 'lucide-react-native';
import TimelineEmptyPlaceholder from '@/components/timeline-empty-placeholder';
import { checkForUpdate, notifyUpdateFound } from '@/services/app-updater';
import { setAuthAccessToken, useAuthSession } from '@/auth/auth-session';
import { saveAuthAccessToken } from '@/auth/secure-token-storage';
import AuthActionButton from '@/components/auth-action-button';
import { Text } from '@/components/app-text';
import {
  CARD_BG_DARK,
  CARD_BG_LIGHT,
  CARD_PASTEL_CYCLE,
} from '@/components/drop-shadow-box';
import ProfileDescriptionPaper from '@/components/profile-description-paper';
import ProfileHeroRow from '@/components/profile-hero-row';
import ProfilePageBackdrop from '@/components/profile-page-backdrop';
import ProfilePolaroidAvatar from '@/components/profile-polaroid-avatar';
import ProfileStatsRow from '@/components/profile-stats-row';
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
import { useReadableContentInsets } from '@/navigation/readable-content-guide';
import { setMoreBackgroundColor } from '@/routes/more-background-store';
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
  setAppMyProfileThemePreference,
  useAppMyProfileThemePreference,
} from '@/settings/app-my-profile-theme-preference';
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
const APP_VERSION: string = (require('../../package.json') as { version: string }).version;
const PAGE_HORIZONTAL_PADDING = 20;
const PAGE_BOTTOM_PADDING = 24;
const SECTION_GAP = 20;
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
const PROFILE_GROUP_GAP = 16;
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
  const [background, muted, foreground] = useThemeColor(['background', 'muted', 'foreground']);
  const { prepareSnapshot, requestTransition } = useThemeTransition();
  const isDark = useEffectiveIsDark();
  const followProfileTheme = useAppMyProfileThemePreference();
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
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
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
  useEffect(() => { setMoreBackgroundColor(pageBackgroundColor); }, [pageBackgroundColor]);
  const subtitleColor = `${foreground}8C`;
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
  const avatarInitial = displayName
    ? displayName.slice(0, 1).toUpperCase()
    : '?';
  const showLoadingState = !user && (isLoading || isFetching);
  const isPlainTheme = appThemePreference !== APP_THEME_OPTION.COLORFUL;
  const renderSettingIcon = (
    IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth: number }>,
    bgColor: string,
  ) =>
    isPlainTheme ? (
      <View className="size-7 items-center justify-center">
        <IconComponent size={18} color={muted} strokeWidth={2} />
      </View>
    ) : (
      <View
        className="size-7 rounded-md items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <IconComponent size={16} color="#FFFFFF" strokeWidth={2.2} />
      </View>
    );
  const readableInsets = useReadableContentInsets();
  const statsEdgePadding = Math.max(PAGE_HORIZONTAL_PADDING, readableInsets.left);
  const contentContainerStyle = {
    flexGrow: 1,
    paddingHorizontal: statsEdgePadding,
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
  const profileStats = [
    {
      label: t('profileStatPosts'),
      value: user?.statuses_count,
      onPress: handleOpenMyTimeline,
    },
    {
      label: t('profileStatFollowing'),
      value: user?.friends_count,
      onPress: handleOpenFollowing,
    },
    {
      label: t('profileStatFollowers'),
      value: user?.followers_count,
      onPress: handleOpenFollowers,
    },
    {
      label: t('profileStatFavorites'),
      value: user?.favourites_count,
      onPress: handleOpenFavorites,
    },
    {
      label: t('profileStatPhotos'),
      value: user?.photo_count,
      onPress: handleOpenPhotos,
    },
  ];
  const handleCheckUpdate = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      const info = await checkForUpdate();
      if (info) {
        notifyUpdateFound(info);
      } else {
        showVariantToast('default', t('moreCheckUpdateUpToDate'));
      }
    } catch {
      showVariantToast('danger', t('updateDownloadError'));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

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
      await setAppMyProfileThemePreference(next);
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
              {/* Profile block: V12 polaroid + journal + sticky notes */}
              <View style={{ gap: PROFILE_GROUP_GAP }}>
                <ProfileHeroRow
                  avatar={
                    <ProfilePolaroidAvatar
                      avatarUrl={avatarUrl}
                      handleName={handleName}
                      fallbackInitial={avatarInitial}
                      isLoading={showLoadingState}
                      mutedTextStyle={profileThemeStyles.mutedTextStyle}
                    />
                  }
                  displayName={displayName}
                  location={location}
                  joinedLine={joinedAt ? t('profileJoinedAt', { date: joinedAt }) : null}
                  profileUrl={profileUrl}
                  primaryTextStyle={profileThemeStyles.primaryTextStyle}
                  mutedTextStyle={profileThemeStyles.mutedTextStyle}
                  linkTextStyle={profileThemeStyles.linkTextStyle}
                />

                {errorMessage ? (
                  <ErrorBanner
                    message={errorMessage}
                    technicalDetail={technicalError}
                  />
                ) : null}

                <ProfileStatsRow
                  stats={profileStats}
                  isDark={isDark}
                  edgePadding={statsEdgePadding}
                  panelBackgroundColor={profileThemePalette.panelBackgroundColor}
                  primaryTextStyle={profileThemeStyles.primaryTextStyle}
                  mutedTextStyle={profileThemeStyles.mutedTextStyle}
                />

                {description ? (
                  <ProfileDescriptionPaper
                    description={description}
                    primaryTextStyle={profileThemeStyles.primaryTextStyle}
                  />
                ) : null}
              </View>

              {/* Messages */}
              <PressableFeedback
                onPress={handleOpenPrivateMessages}
                accessibilityRole="button"
                className="rounded-3xl overflow-hidden"
              >
                <Surface
                  className="bg-surface-secondary overflow-hidden p-0"
                  style={panelStyle.messages}
                >
                  <PressableFeedback.Highlight />
                  <View className="flex-row items-center gap-3 px-4 py-3.5">
                    {renderSettingIcon(Mail, '#FF2D55')}
                    <Text
                      className="flex-1 text-[15px] font-normal text-foreground"
                      style={profileThemeStyles.primaryTextStyle}
                    >
                      {t('morePrivateMessages')}
                    </Text>
                    <ChevronRight size={14} color={subtitleColor} />
                  </View>
                </Surface>
              </PressableFeedback>

              {/* Settings */}
              <Surface
                className="bg-surface-secondary overflow-hidden p-0"
                style={panelStyle.settings}
              >
                    <Select
                      value={languageSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectLanguagePreference(opt.value as AppLanguageOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        {renderSettingIcon(Languages, '#34C759')}
                        <Text
                          className="flex-1 text-[15px] font-normal text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreLanguage')}
                        </Text>
                        <Text className="text-[13px] text-foreground/55">{languageSelectValue.label}</Text>
                        <ChevronRight size={14} color={subtitleColor} />
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
                    <View className="h-px bg-foreground/10 ml-[60px]" />
                    <Select
                      value={fontSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectFontPreference(opt.value as AppFontOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        {renderSettingIcon(Type, '#3478F7')}
                        <Text
                          className="flex-1 text-[15px] font-normal text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreFontStyle')}
                        </Text>
                        <Text className="text-[13px] text-foreground/55">{fontSelectValue?.label}</Text>
                        <ChevronRight size={14} color={subtitleColor} />
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
                    <View className="h-px bg-foreground/10 ml-[60px]" />
                    <Select
                      value={fontSizeSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectFontSizePreference(opt.value as AppFontSizeOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        {renderSettingIcon(ALargeSmall, '#AF52DE')}
                        <Text
                          className="flex-1 text-[15px] font-normal text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreFontSize')}
                        </Text>
                        <Text className="text-[13px] text-foreground/55">{fontSizeSelectValue?.label}</Text>
                        <ChevronRight size={14} color={subtitleColor} />
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
                    <View className="h-px bg-foreground/10 ml-[60px]" />
                    <Select
                      value={appearanceSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectAppearancePreference(opt.value as AppAppearanceOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70" onPress={prepareSnapshot}>
                        {renderSettingIcon(SunMoon, '#FF9F0A')}
                        <Text
                          className="flex-1 text-[15px] font-normal text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreAppearance')}
                        </Text>
                        <Text className="text-[13px] text-foreground/55">{appearanceSelectValue.label}</Text>
                        <ChevronRight size={14} color={subtitleColor} />
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
                    <View className="h-px bg-foreground/10 ml-[60px]" />
                    <Select
                      value={themeSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectThemePreference(opt.value as AppThemeOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        {renderSettingIcon(Palette, '#FF375F')}
                        <Text
                          className="flex-1 text-[15px] font-normal text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreTheme')}
                        </Text>
                        <Text className="text-[13px] text-foreground/55">{themeSelectValue.label}</Text>
                        <ChevronRight size={14} color={subtitleColor} />
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
                    <View className="h-px bg-foreground/10 ml-[60px]" />
                    <Select
                      value={uiStyleSelectValue}
                      onValueChange={opt =>
                        opt &&
                        handleSelectUiStylePreference(opt.value as AppUiStyleOption)
                      }
                    >
                      <Select.Trigger variant="unstyled" className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
                        {renderSettingIcon(Shapes, '#5AC8FA')}
                        <Text
                          className="flex-1 text-[15px] font-normal text-foreground"
                          style={profileThemeStyles.primaryTextStyle}
                        >
                          {t('moreStyle')}
                        </Text>
                        <Text className="text-[13px] text-foreground/55">{uiStyleSelectValue.label}</Text>
                        <ChevronRight size={14} color={subtitleColor} />
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
                    <Text className="text-[15px] font-normal text-foreground">
                      {t('moreFollowProfile')}
                    </Text>
                    <Switch
                      isSelected={followProfileTheme}
                      onSelectedChange={handleToggleFollowProfile}
                    />
                  </View>
                  <Text className="mt-2 text-[12px] text-muted">
                    {t('moreFollowProfileHint')}
                  </Text>
              </Surface>
              {Platform.OS === 'android' && (
                <View className="mt-8">
                  <AuthActionButton
                    label={t('moreCheckUpdate')}
                    loadingLabel={t('moreCheckUpdateChecking')}
                    variant="secondary"
                    onPress={handleCheckUpdate}
                    isLoading={isCheckingUpdate}
                  />
                </View>
              )}
              <View className={Platform.OS === 'android' ? 'mt-3' : 'mt-8'}>
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
                <Text className="mt-6 text-[11px] text-muted opacity-30 text-center tracking-widest">
                  v{APP_VERSION}
                </Text>
              </View>
            </View>
          </View>
        </Animated.ScrollView>
      </NativeEdgeScrollShadow>
      <Dialog isOpen={isSignOutDialogOpen} onOpenChange={setIsSignOutDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/80" />
          <Dialog.Content className="w-[92%] max-w-[360px] self-center">
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
  const readableInsets = useReadableContentInsets();
  const contentContainerStyle = {
    flexGrow: 1,
    paddingHorizontal: Math.max(PAGE_HORIZONTAL_PADDING, readableInsets.left),
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
        <TimelineEmptyPlaceholder
          icon={AlertCircle}
          message={t('moreAccountLoadFailedNoId')}
          tone="danger"
        />
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
