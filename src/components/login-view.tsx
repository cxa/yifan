import React, { useRef, useState, useEffect } from 'react';
import { View, Pressable, Image, useWindowDimensions, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemeColor } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import {
  requestFanfouAccessToken,
  resolveAuthAccessTokenIdentity,
} from '@/auth/fanfou-client';
import { setAuthAccessToken } from '@/auth/auth-session';
import { saveAuthAccessToken } from '@/auth/secure-token-storage';
import ErrorBanner from '@/components/error-banner';
import TermsModal from '@/components/terms-modal';
import { AUTH_STACK_ROUTE, ROOT_STACK_ROUTE } from '@/navigation/route-names';
import type {
  LoginStackParamList,
  RootStackParamList,
} from '@/navigation/types';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/app-text';
import { FallingLeaves } from '@/components/falling-leaves';
import {
  LAUNCH_CONTENT_VIEWPORT,
  LAUNCH_FAN_PATH,
  LAUNCH_POEM_PATH,
  LAUNCH_POEM_EN_PATH,
} from '@/components/launch-content-paths';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import {
  getHasAgreedToTermsSnapshot,
  setAgreedToTerms,
} from '@/settings/terms-agreement';

const CALLBACK_URL = 'yifan://authorize_callback';

const LoginView = () => {
  const { t, i18n } = useTranslation();
  const poemPath = i18n.resolvedLanguage?.startsWith('zh')
    ? LAUNCH_POEM_PATH
    : LAUNCH_POEM_EN_PATH;

  const navigation = useNavigation<NavigationProp<LoginStackParamList>>();
  const rootNavigation =
    navigation.getParent<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [friendlyError, setFriendlyError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const signInAttemptIdRef = useRef(0);

  // Animation values
  const logoTranslateY = useSharedValue(50);
  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(50);

  useEffect(() => {
    // 1.5s splash screen entry
    logoTranslateY.value = withDelay(
      1500,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.exp) })
    );
    formOpacity.value = withDelay(
      1500,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) })
    );
    formTranslateY.value = withDelay(
      1500,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.exp) })
    );
  }, [logoTranslateY, formOpacity, formTranslateY]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const formAnimatedStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

  const handleCancelSignIn = () => {
    signInAttemptIdRef.current += 1;
    setIsSigningIn(false);
    setFriendlyError(null);
    setTechnicalError(null);
  };

  const doSignIn = async () => {
    if (isSigningIn) {
      return;
    }
    const attemptId = signInAttemptIdRef.current + 1;
    signInAttemptIdRef.current = attemptId;
    setFriendlyError(null);
    setTechnicalError(null);
    setIsSigningIn(true);
    try {
      const rawAccessToken = await requestFanfouAccessToken(CALLBACK_URL);
      if (signInAttemptIdRef.current !== attemptId) {
        return;
      }
      const accessToken = await resolveAuthAccessTokenIdentity(rawAccessToken);
      if (signInAttemptIdRef.current !== attemptId) {
        return;
      }
      await saveAuthAccessToken(accessToken);
      if (signInAttemptIdRef.current !== attemptId) {
        return;
      }
      setAuthAccessToken(accessToken);
      if (rootNavigation) {
        rootNavigation.reset({
          index: 0,
          routes: [
            {
              name: ROOT_STACK_ROUTE.AUTH,
              params: {
                screen: AUTH_STACK_ROUTE.TABS,
              },
            },
          ],
        });
      }
    } catch (error) {
      if (signInAttemptIdRef.current !== attemptId) {
        return;
      }
      const raw = error instanceof Error ? error.message : '';
      setTechnicalError(raw || null);
      if (raw.includes('timed out')) {
        setFriendlyError(t('loginErrorTimeout'));
      } else if (raw.toLowerCase().includes('cancel')) {
        setFriendlyError(t('loginErrorCancelled'));
      } else if (
        raw.toLowerCase().includes('network') ||
        raw.toLowerCase().includes('connect')
      ) {
        setFriendlyError(t('loginErrorNetwork'));
      } else {
        setFriendlyError(t('loginFailed'));
      }
    } finally {
      if (signInAttemptIdRef.current === attemptId) {
        setIsSigningIn(false);
      }
    }
  };

  const handleSignIn = () => {
    if (Platform.OS === 'ios' && !getHasAgreedToTermsSnapshot()) {
      setIsTermsOpen(true);
      return;
    }
    doSignIn().catch(() => undefined);
  };

  const handleAgreeToTerms = async () => {
    await setAgreedToTerms();
    setIsTermsOpen(false);
    doSignIn().catch(() => undefined);
  };

  const handleDeclineTerms = () => {
    setIsTermsOpen(false);
  };

  const [background] = useThemeColor(['background']);

  const { width } = useWindowDimensions();
  const isDark = useEffectiveIsDark();
  const inkColor = isDark ? '#F5EED7' : '#2A3B4C';

  return (
    <View
      className="flex-1 relative"
      style={{ backgroundColor: background }}
    >
      <TermsModal
        isOpen={isTermsOpen}
        onAgree={handleAgreeToTerms}
        onDecline={handleDeclineTerms}
      />
      <View 
        className="absolute bottom-0 left-0 right-0 top-0 overflow-hidden items-start justify-end pointer-events-none"
      >
        <Image 
          source={isDark ? require('../../assets/shared/splash_botanical_dark.png') : require('../../assets/shared/splash_botanical_light.png')} 
          style={{ width: width, height: width }}
          className="mb-0"
        />
      </View>
      <FallingLeaves color={inkColor} />

      {/* Main Content (Splash + Tagline) */}
      <Animated.View
        className="absolute top-0 left-0 right-0 z-10 w-full pointer-events-box-none px-6 items-center"
        style={[logoAnimatedStyle, { paddingTop: insets.top + 80 }]}
      >
        <View className="pointer-events-auto items-center opacity-90">
          <Svg
            width={LAUNCH_CONTENT_VIEWPORT.width}
            height={LAUNCH_CONTENT_VIEWPORT.height}
            viewBox={`0 0 ${LAUNCH_CONTENT_VIEWPORT.width} ${LAUNCH_CONTENT_VIEWPORT.height}`}
          >
            <Path d={LAUNCH_FAN_PATH} fill={inkColor} />
            <Path d={poemPath} fill={inkColor} fillOpacity={0.8} />
          </Svg>
        </View>

        {friendlyError ? (
          <View className="w-full max-w-[320px] pointer-events-auto mt-12">
            <ErrorBanner
              message={friendlyError}
              technicalDetail={technicalError}
            />
          </View>
        ) : null}
      </Animated.View>

      {/* Login Action (Bottom) */}
      <Animated.View
        className="absolute left-0 right-0 w-full px-8 items-center z-20"
        style={[formAnimatedStyle, { bottom: insets.bottom + 20 }]}
      >
        <View className="w-full max-w-[320px] pointer-events-auto items-center">
          {isSigningIn && (
            <View className="mb-4 w-full">
              <Pressable
                onPress={handleCancelSignIn}
                className={`w-full h-12 items-center justify-center rounded-full border shadow-sm ${
                  isDark ? 'border-[#F5EED7]/30 bg-white/10 active:bg-white/20' : 'border-[#2A3B4C]/30 bg-white/40 active:bg-white/70'
                }`}
              >
                <Text className={`text-[14px] font-medium tracking-wide ${isDark ? 'text-[#F5EED7]' : 'text-[#2A3B4C]'}`}>
                  {t('loginCancel')}
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={handleSignIn}
            disabled={isSigningIn}
            className={`w-full bg-accent h-14 items-center justify-center rounded-full active:opacity-80 shadow-sm ${
              isSigningIn ? 'opacity-70' : ''
            }`}
          >
            <Text className="text-accent-foreground text-[16px] font-bold tracking-wide">
              {isSigningIn ? t('loginLoading') : t('loginButton')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

export default LoginView;
