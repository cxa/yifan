import React, { useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemeColor } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import {
  requestFanfouAccessToken,
  resolveAuthAccessTokenIdentity,
} from '@/auth/fanfou-client';
import { setAuthAccessToken } from '@/auth/auth-session';
import { saveAuthAccessToken } from '@/auth/secure-token-storage';
import AuthActionButton from '@/components/auth-action-button';
import { AUTH_STACK_ROUTE, ROOT_STACK_ROUTE } from '@/navigation/route-names';
import type {
  LoginStackParamList,
  RootStackParamList,
} from '@/navigation/types';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/app-text';
import {
  LAUNCH_CONTENT_VIEWPORT,
  LAUNCH_FAN_PATH,
  LAUNCH_POEM_PATH,
  LAUNCH_POEM_EN_PATH,
} from '@/components/launch-content-paths';

const CALLBACK_URL = 'gohan://authorize_callback';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const signInAttemptIdRef = useRef(0);

  const handleCancelSignIn = () => {
    signInAttemptIdRef.current += 1;
    setIsSigningIn(false);
    setErrorMessage(null);
  };

  const handleSignIn = async () => {
    if (isSigningIn) {
      return;
    }
    const attemptId = signInAttemptIdRef.current + 1;
    signInAttemptIdRef.current = attemptId;
    setErrorMessage(null);
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
      const message = error instanceof Error ? error.message : t('loginFailed');
      setErrorMessage(message);
    } finally {
      if (signInAttemptIdRef.current === attemptId) {
        setIsSigningIn(false);
      }
    }
  };

  const containerStyle = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
  };
  const bottomButtonStyle = {
    bottom: insets.bottom + 40,
  };

  const [background, foreground] = useThemeColor(['background', 'foreground']);

  return (
    <View
      className="flex-1"
      style={[containerStyle, { backgroundColor: background }]}
    >
      <View className="flex-1 items-center justify-center px-6 -mt-20 z-10 w-full pointer-events-none">
        {/* Main Title — font glyphs as SVG paths */}
        <View className="w-full max-w-[320px] pointer-events-auto items-center">
          <Svg
            width={LAUNCH_CONTENT_VIEWPORT.width}
            height={LAUNCH_CONTENT_VIEWPORT.height}
            viewBox={`0 0 ${LAUNCH_CONTENT_VIEWPORT.width} ${LAUNCH_CONTENT_VIEWPORT.height}`}
          >
            <Path d={LAUNCH_FAN_PATH} fill="#F47060" />
            <Path d={poemPath} fill={foreground} fillOpacity={0.65} />
          </Svg>
        </View>

        {/* Error Message */}
        {errorMessage ? (
          <View className="w-full max-w-[320px] pointer-events-auto mt-8">
            <View className="rounded-2xl bg-danger-soft px-4 py-3">
              <Text className="text-sm text-danger font-bold text-center tracking-wide">
                ERROR: {errorMessage}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Bottom Actions */}
      <View
        className="absolute left-0 right-0 w-full px-8 items-center z-20"
        style={bottomButtonStyle}
      >
        <View className="w-full max-w-[320px] pointer-events-auto">
          {isSigningIn && (
            <View className="mb-6 items-center">
              <Pressable
                onPress={handleCancelSignIn}
                hitSlop={10}
                className="active:opacity-70"
              >
                <View className="pb-1">
                  <Text className="text-foreground text-sm font-black tracking-widest uppercase underline">
                    {t('loginCancel')}
                  </Text>
                </View>
              </Pressable>
            </View>
          )}

          <AuthActionButton
            label={t('loginButton')}
            loadingLabel={t('loginLoading')}
            onPress={handleSignIn}
            isLoading={isSigningIn}
          />
        </View>
      </View>
    </View>
  );
};

export default LoginView;
