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
import ComposerModal from '@/components/composer-modal';
import LoginView from '@/components/login-view';
import { getTabBarHeight } from '@/navigation/tab-bar-layout';
import type { AuthTabParamList } from '@/navigation/types';
import AuthHomeRoute from '@/routes/_auth.home/index';
import MentionsRoute from '@/routes/_auth.mentions/index';
import MoreRoute from '@/routes/_auth.more/index';
import {
  pickImageFromLibrary,
  type PickedImage,
} from '@/utils/pick-image-from-library';

const Tab = createBottomTabNavigator<AuthTabParamList>();

const isTabRouteName = (
  routeName: string,
): routeName is keyof AuthTabParamList =>
  routeName === 'Home' ||
  routeName === 'Mentions' ||
  routeName === 'Compose' ||
  routeName === 'More';

const iconForRoute = (routeName: keyof AuthTabParamList, color: string) => {
  switch (routeName) {
    case 'Home':
      return <Home color={color} size={24} />;
    case 'Mentions':
      return <AtSign color={color} size={24} />;
    case 'More':
      return <MoreHorizontal color={color} size={24} />;
    case 'Compose':
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

  const composeIndex = state.routes.findIndex(r => r.name === 'Compose');
  const composeRoute = composeIndex !== -1 ? state.routes[composeIndex] : null;
  const mainRoutes = state.routes.filter(r => r.name !== 'Compose');

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
    const isComposeRoute = route.name === 'Compose';
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
  const [composeText, setComposeText] = useState('');
  const [composePhoto, setComposePhoto] = useState<PickedImage | null>(null);
  const [isComposeSubmitting, setIsComposeSubmitting] = useState(false);
  const [isComposePhotoPicking, setIsComposePhotoPicking] = useState(false);

  const handleOpenComposer = useCallback(() => {
    setComposeVisible(true);
  }, []);

  const handleCloseComposer = useCallback(() => {
    if (isComposeSubmitting || isComposePhotoPicking) {
      return;
    }
    setComposeVisible(false);
    setComposeText('');
    setComposePhoto(null);
  }, [isComposePhotoPicking, isComposeSubmitting]);

  const handlePickComposePhoto = useCallback(async () => {
    if (isComposeSubmitting || isComposePhotoPicking) {
      return;
    }
    setIsComposePhotoPicking(true);
    try {
      const pickedPhoto = await pickImageFromLibrary();
      if (pickedPhoto) {
        setComposePhoto(pickedPhoto);
      }
    } catch (requestError) {
      Alert.alert(
        'Unable to attach photo',
        requestError instanceof Error
          ? requestError.message
          : 'Please try again.',
      );
    } finally {
      setIsComposePhotoPicking(false);
    }
  }, [isComposePhotoPicking, isComposeSubmitting]);

  const handleRemoveComposePhoto = useCallback(() => {
    if (isComposeSubmitting) {
      return;
    }
    setComposePhoto(null);
  }, [isComposeSubmitting]);

  const handleSubmitComposer = useCallback(async () => {
    if (isComposeSubmitting || isComposePhotoPicking) {
      return;
    }

    const text = composeText.trim();
    const hasPhoto = Boolean(composePhoto?.base64);
    if (!text && !hasPhoto) {
      Alert.alert('Cannot post', 'Please enter text or attach a photo.');
      return;
    }

    setIsComposeSubmitting(true);
    try {
      if (composePhoto?.base64) {
        await uploadPhoto({
          photoBase64: composePhoto.base64,
          status: text || undefined,
        });
      } else {
        await post('/statuses/update', { status: text });
      }
      setComposeVisible(false);
      setComposeText('');
      setComposePhoto(null);
      Alert.alert('Posted', 'Your post was sent.');
    } catch (requestError) {
      Alert.alert(
        'Post failed',
        requestError instanceof Error
          ? requestError.message
          : 'Please try again.',
      );
    } finally {
      setIsComposeSubmitting(false);
    }
  }, [
    composePhoto?.base64,
    composeText,
    isComposePhotoPicking,
    isComposeSubmitting,
  ]);

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
        <Tab.Screen name="Home" component={AuthHomeRoute} />
        <Tab.Screen name="Mentions" component={MentionsRoute} />
        <Tab.Screen name="Compose" component={ComposeTabPlaceholder} />
        <Tab.Screen name="More" component={MoreRoute} />
      </Tab.Navigator>

      <ComposerModal
        visible={composeVisible}
        title="Compose"
        placeholder="What's happening?"
        submitLabel="Post"
        value={composeText}
        isSubmitting={isComposeSubmitting}
        topInset={insets.top}
        photoUri={composePhoto?.uri}
        isPhotoPicking={isComposePhotoPicking}
        onChangeText={setComposeText}
        onPickPhoto={handlePickComposePhoto}
        onRemovePhoto={handleRemoveComposePhoto}
        onCancel={handleCloseComposer}
        onSubmit={handleSubmitComposer}
      />
    </>
  );
};

export default AuthIndexRoute;
