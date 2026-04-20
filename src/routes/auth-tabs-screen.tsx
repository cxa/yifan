import React, { useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { executeComposerSend, validateComposerContent } from '@/utils/composer-send';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from 'heroui-native';
import { Home, AtSign, Soup, Plus } from 'lucide-react-native';
import { useAuthSession } from '@/auth/auth-session';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import LoginView from '@/components/login-view';
import Animated, {
  FadeInRight,
  FadeOutRight,
  LinearTransition,
} from 'react-native-reanimated';
import { AUTH_TAB_ROUTE } from '@/navigation/route-names';
import { isNativeScrollEdgeEffectAvailable } from '@/navigation/native-scroll-edge';
import {
  TAB_BAR_BUTTON_HEIGHT,
  TAB_BAR_MIN_BOTTOM_GAP,
} from '@/navigation/tab-bar-layout';
import { useReadableContentInsets } from '@/navigation/readable-content-guide';
import { getMoreBackgroundColor } from '@/routes/more-background-store';
import type { AuthTabParamList } from '@/navigation/types';
import AuthHomeRoute from '@/routes/auth-home-screen';
import { useAppFontFamily } from '@/settings/app-font-preference';
import { useSystemFontFamilyOverride } from '@/settings/app-ui-style-preference';
import { useTranslation } from 'react-i18next';
import MentionsRoute from '@/routes/auth-mentions-screen';
import MoreRoute from '@/routes/auth-more-screen';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import { closePhotoViewer, usePhotoViewerStore } from '@/components/photo-viewer-store';
import { useStatusUpdateMutation } from '@/query/post-mutations';
const Tab = createBottomTabNavigator<AuthTabParamList>();
// Bottom tab bar intentionally inverts the app theme — a dark bar in light
// mode, light bar in dark mode — so the bar reads as a distinct surface
// sitting on top of the page content instead of blending with it. Each
// tab still carries its own hue family at rest and lifts to the full
// pastel when focused.
const TAB_BG_LIGHT        = '#FFFFFF';
const TAB_BG_DARK         = '#1E1E1E';
const TAB_MUTED_LIGHT     = '#7C7268';
const TAB_MUTED_DARK      = '#9C9288';
const TAB_FG_LIGHT        = '#1A1208';
const TAB_FG_DARK         = '#F2EDE8';
const TAB_ACTIVE_HOME     = { light: '#D0E8F5', dark: '#1A3E5A' };
const TAB_ACTIVE_MENTIONS = { light: '#FDF3C8', dark: '#4A3618' };
const TAB_ACTIVE_MORE     = { light: '#C8EDE8', dark: '#1A4538' };
// Compose uses a lilac pastel from CARD_BG.danger — distinct hue from
// all three siblings (sky blue / amber yellow / mint green) so no two
// pills read as "same color family" on the bar. Foreground follows
// tabForeground for consistency with siblings.
const TAB_ACTIVE_COMPOSE  = { light: '#E3CAEF', dark: '#3D2048' };
// Per-tab rest bg — each pill carries its own hue at rest, a ~50% wash of
// the active pastel toward the inverted bar bg. Keeps every tab
// identifiable at a glance without stealing focus from the active pill.
const TAB_REST_HOME       = { light: '#E8F3FA', dark: '#152D42' };
const TAB_REST_MENTIONS   = { light: '#FEFAE4', dark: '#362814' };
const TAB_REST_MORE       = { light: '#E4F6F3', dark: '#15332A' };
// Compose always reads as the primary CTA — the rest bg = active bg,
// no washed variant. The pill is permanently "Post-ready".
const TAB_REST_COMPOSE    = { light: '#E3CAEF', dark: '#3D2048' };
// Per-tab icon tints at rest — deeper brand hues readable against the
// pastel rest bg. `.light` pairs sit on white-ish rest pills (needs
// deeper chroma); `.dark` pairs sit on the dark rest pills (lifted for
// legibility).
const TAB_TINT_HOME       = { light: '#6A9DBC', dark: '#A8C4D6' };
const TAB_TINT_MENTIONS   = { light: '#A89250', dark: '#D4BE88' };
const TAB_TINT_MORE       = { light: '#6AAA92', dark: '#A8CEC0' };
const TabScaleWrapper = ({ children, backgroundColor }: { children: React.ReactNode; backgroundColor: string }) => {
  return (
    <View style={[styles.fill, { backgroundColor }]}>
      {children}
    </View>
  );
};
type MoreTabStackParamList = {
  MoreRoot: undefined;
};
const MoreStack = createNativeStackNavigator<MoreTabStackParamList>();
const HEADER_TITLE_FONT_SIZE = 17;
const isTabRouteName = (
  routeName: string,
): routeName is keyof AuthTabParamList =>
  routeName === AUTH_TAB_ROUTE.HOME ||
  routeName === AUTH_TAB_ROUTE.MENTIONS ||
  routeName === AUTH_TAB_ROUTE.COMPOSE ||
  routeName === AUTH_TAB_ROUTE.MORE;
const iconForRoute = (routeName: keyof AuthTabParamList, color: string) => {
  switch (routeName) {
    case AUTH_TAB_ROUTE.HOME:
      return <Home color={color} size={22} />;
    case AUTH_TAB_ROUTE.MENTIONS:
      return <AtSign color={color} size={22} />;
    case AUTH_TAB_ROUTE.MORE:
      return <Soup color={color} size={22} />;
    case AUTH_TAB_ROUTE.COMPOSE:
      return <Plus color={color} size={22} strokeWidth={2.5} />;
    default:
      return null;
  }
};
const tabRouteKey = (routeName: keyof AuthTabParamList): string => {
  switch (routeName) {
    case AUTH_TAB_ROUTE.HOME:
      return 'tabHome';
    case AUTH_TAB_ROUTE.MENTIONS:
      return 'tabMentions';
    case AUTH_TAB_ROUTE.MORE:
      return 'tabMore';
    case AUTH_TAB_ROUTE.COMPOSE:
      return 'tabCompose';
    default:
      return 'tabHome';
  }
};
const ComposeTabPlaceholder = () => <View className="flex-1 bg-background" />;
const PhotoViewerTabOverlay = () => {
  const { visible, photoUrl, originRect } = usePhotoViewerStore();
  return (
    <PhotoViewerModal
      visible={visible}
      photoUrl={photoUrl}
      onClose={closePhotoViewer}
      originRect={originRect}
      useModal={false}
    />
  );
};
type AuthTabBarProps = BottomTabBarProps & {
  isComposerVisible: boolean;
  onComposePress: () => void;
};
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const springTransition = LinearTransition.springify()
  .damping(12)
  .stiffness(150)
  .mass(1)
  .energyThreshold(0.01);
const AuthTabBar = ({
  state,
  descriptors,
  navigation,
  isComposerVisible,
  onComposePress,
}: AuthTabBarProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const readableInsets = useReadableContentInsets();
  const [accent, accentForeground] = useThemeColor([
    'accent',
    'accent-foreground',
  ]);
  const isDark = useEffectiveIsDark();
  const invertedIsDark = !isDark;
  const tabBackground = invertedIsDark ? TAB_BG_DARK : TAB_BG_LIGHT;
  const tabMuted = invertedIsDark ? TAB_MUTED_DARK : TAB_MUTED_LIGHT;
  const tabForeground = invertedIsDark ? TAB_FG_DARK : TAB_FG_LIGHT;
  const leftRoutesGroup = state.routes.filter(
    r => r.name !== AUTH_TAB_ROUTE.COMPOSE,
  );
  const rightRoutesGroup = state.routes.filter(
    r => r.name === AUTH_TAB_ROUTE.COMPOSE,
  );
  const fontFamily = useAppFontFamily();
  const systemFontOverride = useSystemFontFamilyOverride();
  const resolvedFontFamily = fontFamily ?? systemFontOverride;
  const renderItem = (
    route: BottomTabBarProps['state']['routes'][number] | null,
  ) => {
    if (!route || !isTabRouteName(route.name)) return null;
    const { options } = descriptors[route.key];
    const isComposeRoute = route.name === AUTH_TAB_ROUTE.COMPOSE;
    const isFocused = isComposeRoute
      ? isComposerVisible
      : state.index === state.routes.indexOf(route);
    // Warm pastel tab colors matching design system. Active pills flip to
    // their dark-palette counterparts when the bar itself is dark (i.e.
    // when the app is in light mode and the bar inverts to dark).
    const forInverted = (pair: { light: string; dark: string }) =>
      invertedIsDark ? pair.dark : pair.light;
    const getActiveColors = (routeName: keyof AuthTabParamList) => {
      switch (routeName) {
        case AUTH_TAB_ROUTE.HOME:
          return { bg: forInverted(TAB_ACTIVE_HOME), fg: tabForeground };
        case AUTH_TAB_ROUTE.MENTIONS:
          return { bg: forInverted(TAB_ACTIVE_MENTIONS), fg: tabForeground };
        case AUTH_TAB_ROUTE.MORE:
          return { bg: forInverted(TAB_ACTIVE_MORE), fg: tabForeground };
        case AUTH_TAB_ROUTE.COMPOSE:
          return { bg: forInverted(TAB_ACTIVE_COMPOSE), fg: tabForeground };
        default:
          return { bg: accent, fg: accentForeground };
      }
    };
    // Per-route rest bg — each tab keeps its own hue at rest as a washed
    // pastel so the bar reads as "four quiet tabs with one loud" instead
    // of "three blanks with one colored".
    const getRestBgColor = (routeName: keyof AuthTabParamList): string => {
      switch (routeName) {
        case AUTH_TAB_ROUTE.HOME:     return forInverted(TAB_REST_HOME);
        case AUTH_TAB_ROUTE.MENTIONS: return forInverted(TAB_REST_MENTIONS);
        case AUTH_TAB_ROUTE.MORE:     return forInverted(TAB_REST_MORE);
        case AUTH_TAB_ROUTE.COMPOSE:  return forInverted(TAB_REST_COMPOSE);
        default: return tabBackground;
      }
    };
    // Per-route tint for the icon at rest — adds color presence without
    // competing with the active pill.
    const getRestIconTint = (routeName: keyof AuthTabParamList): string => {
      switch (routeName) {
        case AUTH_TAB_ROUTE.HOME:     return forInverted(TAB_TINT_HOME);
        case AUTH_TAB_ROUTE.MENTIONS: return forInverted(TAB_TINT_MENTIONS);
        case AUTH_TAB_ROUTE.MORE:     return forInverted(TAB_TINT_MORE);
        case AUTH_TAB_ROUTE.COMPOSE:  return tabForeground;
        default: return tabMuted;
      }
    };
    const { bg: activeColor, fg: activeFg } = getActiveColors(route.name);
    const textColor = isFocused ? activeFg : tabMuted;
    const bgColor = isFocused ? activeColor : getRestBgColor(route.name);
    const iconColor = isFocused ? activeFg : getRestIconTint(route.name);
    const shouldShowLabel = isFocused && !isComposeRoute;

    const buttonStyle = StyleSheet.flatten([
      styles.tabButton,
      {
        backgroundColor: bgColor,
        paddingHorizontal: shouldShowLabel ? 20 : 0,
        width: shouldShowLabel ? ('auto' as const) : TAB_BAR_BUTTON_HEIGHT,
      },
    ]);
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (event.defaultPrevented) return;
      if (isComposeRoute) {
        onComposePress();
        return;
      }
      if (!isFocused) {
        navigation.navigate(route.name);
      }
    };
    const onLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };
    return (
      <View key={route.key} className="relative mx-[4px]">
        {/* Front floating pill */}
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityState={
            isFocused
              ? {
                selected: true,
              }
              : {}
          }
          accessibilityLabel={options.tabBarAccessibilityLabel}
          onPress={onPress}
          onLongPress={onLongPress}
          layout={springTransition}
          className={`flex-row items-center justify-center rounded-full active:scale-[0.96] ${isFocused ? 'shadow-sm shadow-foreground/20' : ''
            }`}
          style={buttonStyle}
        >
          <Animated.View
            layout={springTransition}
            className="items-center justify-center size-6"
          >
            {iconForRoute(route.name, iconColor)}
          </Animated.View>
          {shouldShowLabel && (
            <Animated.Text
              entering={FadeInRight.duration(200)}
              exiting={FadeOutRight.duration(200)}
              className="ml-2 font-extrabold text-base"
              style={{
                color: textColor,
                fontFamily: resolvedFontFamily,
              }}
              numberOfLines={1}
            >
              {t(tabRouteKey(route.name))}
            </Animated.Text>
          )}
        </AnimatedPressable>
      </View>
    );
  };
  return (
    <View
      className="absolute left-0 right-0 flex-row justify-between pointer-events-box-none items-center"
      style={[
        styles.tabBarContainer,
        {
          bottom: Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_GAP),
          paddingHorizontal: Math.max(16, readableInsets.left),
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        className="flex-row items-center bg-transparent"
        pointerEvents="box-none"
      >
        {leftRoutesGroup.map(route => renderItem(route))}
      </View>
      <View
        className="flex-row items-center bg-transparent"
        pointerEvents="box-none"
      >
        {rightRoutesGroup.map(route => renderItem(route))}
      </View>
    </View>
  );
};
type MoreHeaderTitleProps = { fontFamily: string | undefined; color: string; children: string };
const MoreHeaderTitle = ({ fontFamily, color, children }: MoreHeaderTitleProps) => (
  <Text style={[styles.headerTitle, { fontFamily, color }]}>{children}</Text>
);
const MoreStackRoute = () => {
  const [foreground] = useThemeColor(['foreground']);
  const headerFontFamily = useAppFontFamily();
  const headerSystemFontOverride = useSystemFontFamilyOverride();
  const resolvedHeaderFontFamily = headerFontFamily ?? headerSystemFontOverride;
  const auth = useAuthSession();
  const screenName = auth.accessToken?.screenName ?? '';
  const moreBackground = getMoreBackgroundColor();

  return (
    <View style={[styles.fill, { backgroundColor: moreBackground }]}>
      <MoreStack.Navigator
        screenOptions={{
          headerShown: true,
          headerLargeTitle: false,
          headerTransparent: true,
          headerTintColor: foreground,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          // Top uses 'automatic' so it fades beneath the transparent
          // navbar; bottom uses 'soft' so content visibly fades as it
          // meets the floating tab bar cluster at the screen's bottom.
          scrollEdgeEffects: isNativeScrollEdgeEffectAvailable
            ? { top: 'automatic', bottom: 'soft' }
            : undefined,
        }}
      >
        <MoreStack.Screen
          name="MoreRoot"
          component={MoreRoute}
          options={{
            // eslint-disable-next-line react/no-unstable-nested-components
            headerTitle: () => (
              <MoreHeaderTitle fontFamily={resolvedHeaderFontFamily} color={foreground}>
                {screenName}
              </MoreHeaderTitle>
            ),
          }}
        />
      </MoreStack.Navigator>
    </View>
  );
};
const AuthIndexRoute = () => {
  const { t } = useTranslation();
  const auth = useAuthSession();
  const [backgroundColor] = useThemeColor(['background']);
  const [composeVisible, setComposeVisible] = useState(false);
  const statusUpdateMutation = useStatusUpdateMutation();

  // Share intent is now consumed at the AuthStack level (app-navigator.tsx)
  // so it works even when a pushed screen is on top. The tab-level composer
  // only opens from the compose tab button.
  const handleOpenComposer = () => {
    setComposeVisible(true);
  };
  const handleCloseComposer = () => {
    setComposeVisible(false);
  };
  const handleSubmitComposer = ({
    text,
    photo,
  }: ComposerModalSubmitPayload) => {
    const hasPhoto = Boolean(photo?.base64);
    const trimmedText = validateComposerContent(text, hasPhoto, t('postFailedTitle'));
    if (trimmedText === null) return;
    setComposeVisible(false);
    executeComposerSend(
      () => statusUpdateMutation.mutateAsync({
        status: photo?.base64 ? trimmedText || undefined : trimmedText,
        photoBase64: photo?.base64,
        photoMimeType: photo?.mimeType,
        photoFileName: photo?.fileName,
      }),
      t('postFailedTitle'),
      () => showVariantToast('success', t('sentTitle'), t('postPendingReviewMessage')),
    );
  };
  const renderAuthTabBar = (props: BottomTabBarProps) => (
    <>
      <AuthTabBar
        {...props}
        isComposerVisible={composeVisible}
        onComposePress={handleOpenComposer}
      />
      <PhotoViewerTabOverlay />
    </>
  );
  if (auth.status !== 'authenticated') {
    return <LoginView />;
  }
  return (
    <View style={[styles.fill, { backgroundColor }]}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'none',
          sceneStyle: {
            backgroundColor,
          },
        }}
        tabBar={renderAuthTabBar}
      >
        <Tab.Screen name={AUTH_TAB_ROUTE.HOME}>
          {() => <TabScaleWrapper backgroundColor={backgroundColor}><AuthHomeRoute /></TabScaleWrapper>}
        </Tab.Screen>
        <Tab.Screen name={AUTH_TAB_ROUTE.MENTIONS}>
          {() => <TabScaleWrapper backgroundColor={backgroundColor}><MentionsRoute /></TabScaleWrapper>}
        </Tab.Screen>
        <Tab.Screen
          name={AUTH_TAB_ROUTE.COMPOSE}
          component={ComposeTabPlaceholder}
        />
        <Tab.Screen name={AUTH_TAB_ROUTE.MORE}>
          {() => <TabScaleWrapper backgroundColor={getMoreBackgroundColor()}><MoreStackRoute /></TabScaleWrapper>}
        </Tab.Screen>
      </Tab.Navigator>

      <ComposerModal
        visible={composeVisible}
        title={t('composerWritePost')}
        placeholder={t('composerWhatsNew')}
        submitLabel={t('composerSubmitPost')}
        enablePhoto
        resetKey="root-compose"
        isSubmitting={false}
        onCancel={handleCloseComposer}
        onSubmit={handleSubmitComposer}
      />
    </View>
  );
};
export default AuthIndexRoute;
const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  tabButton: {
    height: TAB_BAR_BUTTON_HEIGHT,
  },
  tabBarContainer: {
    zIndex: 100,
    elevation: 100,
  },
  headerTitle: {
    fontSize: HEADER_TITLE_FONT_SIZE,
    fontWeight: '800',
  },
});
