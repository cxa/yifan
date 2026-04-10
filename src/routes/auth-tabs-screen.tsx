import React, { useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { executeComposerSend } from '@/utils/composer-send';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from 'heroui-native';
import { Home, AtSign, MoreHorizontal, SquarePen } from 'lucide-react-native';
import { useAuthSession } from '@/auth/auth-session';
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
      return <Home color={color} size={24} />;
    case AUTH_TAB_ROUTE.MENTIONS:
      return <AtSign color={color} size={24} />;
    case AUTH_TAB_ROUTE.MORE:
      return <MoreHorizontal color={color} size={24} />;
    case AUTH_TAB_ROUTE.COMPOSE:
      return <SquarePen color={color} size={24} />;
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
  const [accent, muted, accentForeground, background] = useThemeColor([
    'accent',
    'muted',
    'accent-foreground',
    'background',
  ]);
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
    // Warm pastel tab colors matching design system
    const getActiveColors = (routeName: keyof AuthTabParamList) => {
      switch (routeName) {
        case AUTH_TAB_ROUTE.HOME:
          return { bg: '#D0E8F5', fg: '#1A1208' }; // Sky blue, dark brown text
        case AUTH_TAB_ROUTE.MENTIONS:
          return { bg: '#FDF3C8', fg: '#1A1208' }; // Warm yellow, dark brown text
        case AUTH_TAB_ROUTE.MORE:
          return { bg: '#C8EDE8', fg: '#1A1208' }; // Mint, dark brown text
        case AUTH_TAB_ROUTE.COMPOSE:
          return { bg: '#F47060', fg: '#FFFFFF' }; // Coral CTA, white text
        default:
          return { bg: accent, fg: accentForeground };
      }
    };
    const { bg: activeColor, fg: activeFg } = getActiveColors(route.name);
    const textColor = isFocused ? activeFg : muted;
    const bgColor = isFocused ? activeColor : background;
    const iconColor = isFocused ? activeFg : muted;
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
          className={`flex-row items-center justify-center shadow-sm rounded-full ${isFocused ? 'shadow-foreground/20' : ''
            }`}
          style={buttonStyle}
        >
          <Animated.View
            layout={springTransition}
            className="items-center justify-center w-6 h-6"
          >
            {iconForRoute(route.name, iconColor)}
          </Animated.View>
          {shouldShowLabel && (
            <Animated.Text
              entering={FadeInRight.duration(200)}
              exiting={FadeOutRight.duration(200)}
              className="ml-2 font-bold text-base"
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
          scrollEdgeEffects: isNativeScrollEdgeEffectAvailable
            ? { top: 'automatic' }
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
    const trimmedText = text.trim();
    const hasPhoto = Boolean(photo?.base64);
    if (!trimmedText && !hasPhoto) {
      showVariantToast('danger', t('postFailedTitle'), t('replyNeedsContent'));
      return;
    }
    setComposeVisible(false);
    executeComposerSend(
      () => statusUpdateMutation.mutateAsync({
        status: photo?.base64 ? trimmedText || undefined : trimmedText,
        photoBase64: photo?.base64,
      }),
      t('postFailedTitle'),
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
    fontWeight: '600',
  },
});
