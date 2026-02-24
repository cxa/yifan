import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from 'heroui-native';
import { Home, AtSign, MoreHorizontal, SquarePen } from 'lucide-react-native';

import { useAuthSession } from '@/auth/auth-session';
import { post, uploadPhoto } from '@/auth/fanfou-client';
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
import {
  TAB_BAR_BUTTON_HEIGHT,
  TAB_BAR_MIN_BOTTOM_GAP,
} from '@/navigation/tab-bar-layout';
import type { AuthTabParamList } from '@/navigation/types';
import AuthHomeRoute from '@/routes/auth-home-screen';
import { useAppFontFamily } from '@/settings/app-font-preference';
import MentionsRoute from '@/routes/auth-mentions-screen';
import MoreRoute from '@/routes/auth-more-screen';

const Tab = createBottomTabNavigator<AuthTabParamList>();

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

const labelForRoute = (routeName: keyof AuthTabParamList) => {
  switch (routeName) {
    case AUTH_TAB_ROUTE.HOME:
      return 'Home';
    case AUTH_TAB_ROUTE.MENTIONS:
      return 'Mentions';
    case AUTH_TAB_ROUTE.MORE:
      return 'More';
    case AUTH_TAB_ROUTE.COMPOSE:
      return 'Post';
    default:
      return '';
  }
};

const ComposeTabPlaceholder = () => <View className="flex-1 bg-background" />;

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
  const insets = useSafeAreaInsets();
  const [accent, muted, accentForeground, background] = useThemeColor([
    'accent',
    'muted',
    'accent-foreground',
    'background',
  ]);

  const leftRoutesGroup = state.routes.filter(r => r.name !== AUTH_TAB_ROUTE.COMPOSE);
  const rightRoutesGroup = state.routes.filter(r => r.name === AUTH_TAB_ROUTE.COMPOSE);
  const fontFamily = useAppFontFamily();

  const renderItem = (
    route: BottomTabBarProps['state']['routes'][number] | null,
  ) => {
    if (!route || !isTabRouteName(route.name)) return null;

    const { options } = descriptors[route.key];
    const isComposeRoute = route.name === AUTH_TAB_ROUTE.COMPOSE;
    const isFocused = isComposeRoute
      ? isComposerVisible
      : state.index === state.routes.indexOf(route);

    // Neobrutalism colors
    const activeColor = isComposeRoute ? '#FF4F00' : accent;
    const bgColor = isFocused ? activeColor : background;
    const iconColor = isFocused ? accentForeground : muted;
    const textColor = accentForeground;

    const buttonStyle = StyleSheet.flatten([
      styles.tabButton,
      {
        backgroundColor: bgColor,
        paddingHorizontal: isFocused ? 20 : 0,
        width: isFocused ? ('auto' as const) : TAB_BAR_BUTTON_HEIGHT,
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
        {/* Neobrutalist solid shadow */}
        <Animated.View
          layout={springTransition}
          className="absolute left-0 top-0 h-full w-full bg-foreground dark:bg-border rounded-full -translate-x-1 translate-y-1"
        />
        {/* Front floating button */}
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityState={isFocused ? { selected: true } : {}}
          accessibilityLabel={options.tabBarAccessibilityLabel}
          onPress={onPress}
          onLongPress={onLongPress}
          layout={springTransition}
          className="flex-row items-center justify-center border-2 border-foreground dark:border-border rounded-full overflow-hidden"
          style={buttonStyle}
        >
          <Animated.View layout={springTransition} className="items-center justify-center w-6 h-6">
            {iconForRoute(route.name, iconColor)}
          </Animated.View>
          {isFocused && (
            <Animated.Text
              entering={FadeInRight.duration(200)}
              exiting={FadeOutRight.duration(200)}
              className="ml-2 font-bold text-base"
              style={{ color: textColor, fontFamily }}
              numberOfLines={1}
            >
              {labelForRoute(route.name)}
            </Animated.Text>
          )}
        </AnimatedPressable>
      </View>
    );
  };

  return (
    <View
      className="absolute left-0 right-0 flex-row justify-between pointer-events-box-none items-center px-4"
      style={{ bottom: Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_GAP) }}
      pointerEvents="box-none"
    >
      <View className="flex-row items-center bg-transparent" pointerEvents="box-none">
        {leftRoutesGroup.map(route => renderItem(route))}
      </View>
      <View className="flex-row items-center bg-transparent" pointerEvents="box-none">
        {rightRoutesGroup.map(route => renderItem(route))}
      </View>
    </View>
  );
};

const AuthIndexRoute = () => {
  const auth = useAuthSession();
  const insets = useSafeAreaInsets();
  const [backgroundColor] = useThemeColor(['background']);
  const [composeVisible, setComposeVisible] = useState(false);

  const handleOpenComposer = useCallback(() => {
    setComposeVisible(true);
  }, []);

  const handleCloseComposer = useCallback(() => {
    setComposeVisible(false);
  }, []);

  const handleSubmitComposer = useCallback(
    async ({ text, photo }: ComposerModalSubmitPayload) => {
      const trimmedText = text.trim();
      const hasPhoto = Boolean(photo?.base64);
      if (!trimmedText && !hasPhoto) {
        Alert.alert('Cannot post', 'Please enter text or attach a photo.');
        return;
      }

      try {
        if (photo?.base64) {
          await uploadPhoto({
            photoBase64: photo.base64,
            status: trimmedText || undefined,
          });
        } else {
          await post('/statuses/update', { status: trimmedText });
        }
        setComposeVisible(false);
        Alert.alert('Posted', 'Your post was sent.');
      } catch (requestError) {
        Alert.alert(
          'Post failed',
          requestError instanceof Error
            ? requestError.message
            : 'Please try again.',
        );
      }
    },
    [],
  );

  const renderAuthTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <AuthTabBar
        {...props}
        isComposerVisible={composeVisible}
        onComposePress={handleOpenComposer}
      />
    ),
    [composeVisible, handleOpenComposer],
  );

  if (auth.status !== 'authenticated') {
    return <LoginView />;
  }

  return (
    <>
      <Tab.Navigator
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor } }}
        tabBar={renderAuthTabBar}
      >
        <Tab.Screen name={AUTH_TAB_ROUTE.HOME} component={AuthHomeRoute} />
        <Tab.Screen name={AUTH_TAB_ROUTE.MENTIONS} component={MentionsRoute} />
        <Tab.Screen
          name={AUTH_TAB_ROUTE.COMPOSE}
          component={ComposeTabPlaceholder}
        />
        <Tab.Screen name={AUTH_TAB_ROUTE.MORE} component={MoreRoute} />
      </Tab.Navigator>

      <ComposerModal
        visible={composeVisible}
        title="Compose"
        placeholder="What's happening?"
        submitLabel="Post"
        topInset={insets.top}
        enablePhoto
        resetKey="root-compose"
        onCancel={handleCloseComposer}
        onSubmit={handleSubmitComposer}
      />
    </>
  );
};

export default AuthIndexRoute;

const styles = StyleSheet.create({
  tabButton: {
    height: TAB_BAR_BUTTON_HEIGHT,
  },
});
