import React, { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
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
import { AUTH_TAB_ROUTE } from '@/navigation/route-names';
import { getTabBarHeight } from '@/navigation/tab-bar-layout';
import type { AuthTabParamList } from '@/navigation/types';
import AuthHomeRoute from '@/routes/auth-home-screen';
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

const ComposeTabPlaceholder = () => <View className="flex-1 bg-background" />;

type AuthTabBarProps = BottomTabBarProps & {
  isComposerVisible: boolean;
  onComposePress: () => void;
};

const AuthTabBar = ({
  state,
  descriptors,
  navigation,
  isComposerVisible,
  onComposePress,
}: AuthTabBarProps) => {
  const insets = useSafeAreaInsets();
  const [accent, muted, accentForeground] = useThemeColor([
    'accent',
    'muted',
    'accent-foreground',
  ]);

  const composeIndex = state.routes.findIndex(
    r => r.name === AUTH_TAB_ROUTE.COMPOSE,
  );
  const composeRoute = composeIndex !== -1 ? state.routes[composeIndex] : null;
  const mainRoutes = state.routes.filter(
    r => r.name !== AUTH_TAB_ROUTE.COMPOSE,
  );

  const renderItem = (
    route: BottomTabBarProps['state']['routes'][number],
    isLast: boolean,
    isBlock: boolean,
  ) => {
    if (!route) return null;
    if (!isTabRouteName(route.name)) {
      return null;
    }
    const { options } = descriptors[route.key];
    const isComposeRoute = route.name === AUTH_TAB_ROUTE.COMPOSE;
    const isFocused = isComposeRoute
      ? isComposerVisible
      : state.index === state.routes.indexOf(route);
    const backgroundColor = isFocused ? accent : 'transparent';
    const iconColor = isFocused ? accentForeground : muted;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (event.defaultPrevented) {
        return;
      }

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
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        className={`items-center justify-center border-foreground dark:border-border ${
          isBlock ? 'flex-1' : 'w-full'
        } ${!isLast && isBlock ? 'border-r-2' : ''}`}
        style={{
          backgroundColor,
          height: getTabBarHeight(insets.bottom),
        }}
      >
        {iconForRoute(route.name, iconColor)}
      </Pressable>
    );
  };

  return (
    <View className="absolute left-0 right-0 bottom-0 flex-row bg-transparent">
      {/* Main Tabs Block */}
      <View className="flex-1 flex-row border-2 border-b-0 border-l-0 bg-surface border-foreground dark:border-border">
        {mainRoutes.map((route, index) =>
          renderItem(route, index === mainRoutes.length - 1, true),
        )}
      </View>

      {/* Gap */}
      <View className="w-4" />

      {/* Compose Button Block */}
      {composeRoute ? (
        <View className="w-20 border-2 border-b-0 border-r-0 bg-surface border-foreground dark:border-border">
          {renderItem(composeRoute, true, false)}
        </View>
      ) : null}
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
