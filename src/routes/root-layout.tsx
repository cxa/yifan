import React, { useRef, useState, useLayoutEffect } from 'react';
import { Uniwind } from 'uniwind';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Appearance, Image, StyleSheet } from 'react-native';
import { captureScreen, releaseCapture } from 'react-native-view-shot';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import ToastManagerSync from '@/components/toast-manager-sync';
import AppUpdateDialog from '@/components/app-update-dialog';
import QueryProvider from '@/query/query-provider';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import {
  ThemeTransitionContext,
  type ThemeTransitionCallback,
} from '@/context/theme-transition';

const FADE_OUT_MS = 450;

type RootLayoutProps = {
  children?: React.ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => {
  const isDark = useEffectiveIsDark();
  useLayoutEffect(() => {
    Uniwind.setTheme(isDark ? 'dark' : 'light');
    Appearance.setColorScheme('unspecified');
  }, [isDark]);
  const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
  const pendingUri = useRef<string | null>(null);
  const snapshotOpacity = useSharedValue(0);

  // Call before opening a picker/dropdown to capture a clean screenshot.
  const prepareSnapshot = () => {
    if (pendingUri.current) {
      releaseCapture(pendingUri.current);
      pendingUri.current = null;
    }
    captureScreen({ format: 'jpg', quality: 0.9 })
      .then(uri => { pendingUri.current = uri; })
      .catch(() => {});
  };

  // Uses the pre-captured snapshot (or falls back to a live capture).
  // 1. Show snapshot as top overlay — theme switches invisibly underneath.
  // 2. Two rAF let every component re-render with the new theme.
  // 3. Fade snapshot out — new theme revealed smoothly.
  const requestTransition = (fn: ThemeTransitionCallback) => {
    const doTransition = (uri: string) => {
      setSnapshotUri(uri);
      snapshotOpacity.value = 1;

      fn();

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          snapshotOpacity.value = withTiming(0, {
            duration: FADE_OUT_MS,
            easing: Easing.out(Easing.cubic),
          });
          setTimeout(() => {
            setSnapshotUri(prev => {
              if (prev) releaseCapture(prev);
              return null;
            });
          }, FADE_OUT_MS + 50);
        });
      });
    };

    if (pendingUri.current) {
      const uri = pendingUri.current;
      pendingUri.current = null;
      doTransition(uri);
    } else {
      captureScreen({ format: 'jpg', quality: 0.9 })
        .then(doTransition)
        .catch(() => { fn(); });
    }
  };

  const snapshotStyle = useAnimatedStyle(() => ({
    opacity: snapshotOpacity.value,
  }));

  return (
    <ThemeTransitionContext.Provider value={{ prepareSnapshot, requestTransition }}>
      <GestureHandlerRootView className={`flex-1 bg-background ${isDark ? 'dark' : ''}`}>
        <KeyboardProvider>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <HeroUINativeProvider
              config={{ devInfo: { stylingPrinciples: false } }}
            >
              <ToastManagerSync />
              <AppUpdateDialog />
              <QueryProvider>{children}</QueryProvider>
            </HeroUINativeProvider>
            {snapshotUri && (
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, snapshotStyle]}
              >
                <Image
                  source={{ uri: snapshotUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              </Animated.View>
            )}
          </SafeAreaProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ThemeTransitionContext.Provider>
  );
};

export default RootLayout;
