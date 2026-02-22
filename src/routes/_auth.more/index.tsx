import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollShadow, Surface, useThemeColor } from 'heroui-native';
import LinearGradient from 'react-native-linear-gradient';

import { setAuthAccessToken } from '@/auth/auth-session';
import { saveAuthAccessToken } from '@/auth/secure-token-storage';
import AuthActionButton from '@/components/auth-action-button';
import { Text } from '@/components/app-text';
import {
  getTabBarBaseHeight,
  getTabBarHeight,
} from '@/navigation/tab-bar-layout';

const SPACING = 32;

const MoreRoute = () => {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [background] = useThemeColor(['background']);
  const insets = useSafeAreaInsets();
  const tabBarBaseHeight = getTabBarBaseHeight(insets.bottom);
  const tabBarHeight = getTabBarHeight(insets.bottom);
  useScrollToTop(scrollRef);
  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: 24,
      paddingTop: insets.top,
      paddingBottom: tabBarHeight + SPACING,
      gap: SPACING,
    }),
    [insets.top, tabBarHeight],
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

  return (
    <ScrollShadow
      LinearGradientComponent={LinearGradient}
      size={100}
      color={background}
    >
      <ScrollView
        ref={scrollRef}
        scrollIndicatorInsets={{
          bottom: tabBarBaseHeight,
        }}
        contentContainerStyle={contentContainerStyle}
      >
        <View className="gap-1">
          <Text className="text-[34px] font-bold text-foreground leading-[40px]">
            More
          </Text>
          <Text className="text-[14px] text-muted">
            Manage your account and settings.
          </Text>
        </View>

        <Surface className="bg-surface px-5 py-5 gap-4">
          <Text className="text-[14px] text-foreground">Account</Text>
          <AuthActionButton
            label="Sign out"
            loadingLabel="Signing out..."
            variant="danger"
            onPress={handleSignOut}
            isLoading={isSigningOut}
          />
        </Surface>
      </ScrollView>
    </ScrollShadow>
  );
};

export default MoreRoute;
