import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  useColorScheme,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import Svg, { Line, Path, Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';

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

const CALLBACK_URL = 'gohan://authorize_callback';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TechnicalBackground = ({
  insets,
}: {
  insets: { top: number; bottom: number; left: number; right: number };
}) => {
  const isDark = useColorScheme() === 'dark';

  const gridColor = isDark ? '#1A1A1A' : '#E5E5E5';
  const crosshairColor = isDark ? '#404040' : '#000000';
  const cropMarkColor = isDark ? '#52525B' : '#000000';

  const TL_X = 15 + insets.left;
  const TL_Y = 15 + insets.top;
  const TR_X = SCREEN_WIDTH - 15 - insets.right;
  const TR_Y = 15 + insets.top;
  const BL_X = 15 + insets.left;
  const BL_Y = SCREEN_HEIGHT - 15 - insets.bottom;
  const BR_X = SCREEN_WIDTH - 15 - insets.right;
  const BR_Y = SCREEN_HEIGHT - 15 - insets.bottom;

  return (
    <View
      className="absolute inset-0 bg-[#F2F2F2] dark:bg-[#0A0A0A]"
      pointerEvents="none"
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        {/* Diagonal Cross */}
        <Line
          x1={TL_X}
          y1={TL_Y}
          x2={BR_X}
          y2={BR_Y}
          stroke={gridColor}
          strokeWidth="1"
        />
        <Line
          x1={TR_X}
          y1={TR_Y}
          x2={BL_X}
          y2={BL_Y}
          stroke={gridColor}
          strokeWidth="1"
        />

        {/* Center Crosshairs */}
        <Line
          x1={SCREEN_WIDTH / 2}
          y1="0"
          x2={SCREEN_WIDTH / 2}
          y2="15"
          stroke={crosshairColor}
          strokeWidth="1"
        />
        <Line
          x1={SCREEN_WIDTH / 2}
          y1={SCREEN_HEIGHT - 15}
          x2={SCREEN_WIDTH / 2}
          y2={SCREEN_HEIGHT}
          stroke={crosshairColor}
          strokeWidth="1"
        />
        <Line
          x1="0"
          y1={SCREEN_HEIGHT / 2}
          x2="15"
          y2={SCREEN_HEIGHT / 2}
          stroke={crosshairColor}
          strokeWidth="1"
        />
        <Line
          x1={SCREEN_WIDTH - 15}
          y1={SCREEN_HEIGHT / 2}
          x2={SCREEN_WIDTH}
          y2={SCREEN_HEIGHT / 2}
          stroke={crosshairColor}
          strokeWidth="1"
        />

        {/* Center Circle Guide */}
        <Circle
          cx={SCREEN_WIDTH / 2}
          cy={SCREEN_HEIGHT / 2 - 40}
          r="100"
          stroke={gridColor}
          strokeWidth="1"
          fill="none"
        />

        {/* Corner Crop Marks */}
        {/* Top Left */}
        <Path
          d={`M ${TL_X} ${TL_Y} L ${
            TL_X + 15
          } ${TL_Y} M ${TL_X} ${TL_Y} L ${TL_X} ${TL_Y + 15}`}
          stroke={cropMarkColor}
          strokeWidth="1"
          fill="none"
        />
        {/* Top Right */}
        <Path
          d={`M ${TR_X} ${TR_Y} L ${
            TR_X - 15
          } ${TR_Y} M ${TR_X} ${TR_Y} L ${TR_X} ${TR_Y + 15}`}
          stroke={cropMarkColor}
          strokeWidth="1"
          fill="none"
        />
        {/* Bottom Left */}
        <Path
          d={`M ${BL_X} ${BL_Y} L ${
            BL_X + 15
          } ${BL_Y} M ${BL_X} ${BL_Y} L ${BL_X} ${BL_Y - 15}`}
          stroke={cropMarkColor}
          strokeWidth="1"
          fill="none"
        />
        {/* Bottom Right */}
        <Path
          d={`M ${BR_X} ${BR_Y} L ${
            BR_X - 15
          } ${BR_Y} M ${BR_X} ${BR_Y} L ${BR_X} ${BR_Y - 15}`}
          stroke={cropMarkColor}
          strokeWidth="1"
          fill="none"
        />
      </Svg>
    </View>
  );
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE = 65;
const GEOMETRY: {
  p1: [number, number, number];
  p2: [number, number, number];
}[] = [];
// Generate a 3D wireframe sphere (latitudes and longitudes)
const LATS = 8;
const LONS = 16;

for (let i = 0; i <= LATS; i++) {
  const lat = (i / LATS) * Math.PI - Math.PI / 2;
  const nextLat = ((i + 1) / LATS) * Math.PI - Math.PI / 2;
  const rLat = Math.cos(lat);
  const yLat = Math.sin(lat);
  const rNextLat = Math.cos(nextLat);
  const yNextLat = Math.sin(nextLat);

  for (let j = 0; j < LONS; j++) {
    const lon = (j / LONS) * Math.PI * 2;
    const nextLon = ((j + 1) / LONS) * Math.PI * 2;

    const p1: [number, number, number] = [
      rLat * Math.cos(lon),
      yLat,
      rLat * Math.sin(lon),
    ];
    const p2: [number, number, number] = [
      rLat * Math.cos(nextLon),
      yLat,
      rLat * Math.sin(nextLon),
    ];
    const p3: [number, number, number] = [
      rNextLat * Math.cos(lon),
      yNextLat,
      rNextLat * Math.sin(lon),
    ];

    // Horizontal ring line (scanline)
    GEOMETRY.push({ p1, p2 });
    // Vertical longitudinal line (classic wireframe globe effect)
    if (i < LATS) GEOMETRY.push({ p1, p2: p3 });
  }
}

type SharedValueLike<T> = { value: T };

const useGlobePathProps = ({
  colorType,
  time,
  cx,
  cy,
}: {
  colorType: 'main' | 'cyan' | 'magenta';
  time: SharedValueLike<number>;
  cx: number;
  cy: number;
}) =>
  useAnimatedProps(() => {
    let d = '';
    const t = time.value; // Rotation angle
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);

    // Global glitch probability
    const g1 = Math.pow(Math.sin(t * 8.3), 4);
    const g2 = Math.pow(Math.sin(t * 15.7), 4);
    let glitchTrigger = 0;
    if (g1 * g2 > 0.6) {
      glitchTrigger = (g1 * g2 - 0.6) * 2.5; // Scale spike 0 to 1
    }

    const tilt = 0.4; // Fixed X-axis downward tilt
    const sinTilt = Math.sin(tilt);
    const cosTilt = Math.cos(tilt);
    const focal = 3; // Perspective focal depth

    for (let i = 0; i < GEOMETRY.length; i++) {
      const edge = GEOMETRY[i];

      // Rotate P1 around Y-axis
      const x1_ = edge.p1[0] * cosT - edge.p1[2] * sinT;
      const z1_ = edge.p1[0] * sinT + edge.p1[2] * cosT;
      const y1_ = edge.p1[1];

      // Tilt P1 around X-axis
      const sy1 = y1_ * cosTilt - z1_ * sinTilt;
      const sz1 = y1_ * sinTilt + z1_ * cosTilt;
      const p1Scale = focal / (focal + sz1);

      // Rotate P2 around Y-axis
      const x2_ = edge.p2[0] * cosT - edge.p2[2] * sinT;
      const z2_ = edge.p2[0] * sinT + edge.p2[2] * cosT;
      const y2_ = edge.p2[1];

      // Tilt P2 around X-axis
      const sy2 = y2_ * cosTilt - z2_ * sinTilt;
      const sz2 = y2_ * sinTilt + z2_ * cosTilt;
      const p2Scale = focal / (focal + sz2);

      // Optional: Backface culling (only draw lines on front of sphere)
      // if (sz1 > 0 && sz2 > 0) continue;

      // Apply visual glitch jitter based on vertical position
      const lineJitter =
        Math.sin(sy1 * SIZE * 0.1 + t * 20) * 15 * glitchTrigger;

      // Chromatic offset
      let colorOffset = 0;
      if (colorType === 'cyan') colorOffset = -4 * glitchTrigger;
      if (colorType === 'magenta') colorOffset = 4 * glitchTrigger;

      const offsetX = lineJitter + colorOffset;

      const px1 = cx + x1_ * SIZE * p1Scale + offsetX;
      const py1 = cy + sy1 * SIZE * p1Scale;
      const px2 = cx + x2_ * SIZE * p2Scale + offsetX;
      const py2 = cy + sy2 * SIZE * p2Scale;

      d += `M ${px1} ${py1} L ${px2} ${py2} `;
    }
    return { d };
  });

const TechnicalAnimation = () => {
  const isDark = useColorScheme() === 'dark';
  const mainColor = isDark ? '#E5E5E5' : '#1A1A1A';

  const time = useSharedValue(0);

  useEffect(() => {
    time.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 15000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [time]);

  const cx = SCREEN_WIDTH / 2;
  const cy = SCREEN_HEIGHT / 2 - 40;

  const cyanProps = useGlobePathProps({ colorType: 'cyan', time, cx, cy });
  const magentaProps = useGlobePathProps({
    colorType: 'magenta',
    time,
    cx,
    cy,
  });
  const mainProps = useGlobePathProps({ colorType: 'main', time, cx, cy });

  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Chromatic aberration layers */}
        <AnimatedPath
          animatedProps={cyanProps}
          stroke="#00FFFF"
          strokeWidth="1.5"
          opacity={0.8}
        />
        <AnimatedPath
          animatedProps={magentaProps}
          stroke="#FF00FF"
          strokeWidth="1.5"
          opacity={0.8}
        />
        {/* Main geometry layer */}
        <AnimatedPath
          animatedProps={mainProps}
          stroke={mainColor}
          strokeWidth="1.5"
        />
      </Svg>
    </View>
  );
};

const LoginView = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<LoginStackParamList>>();
  const rootNavigation =
    navigation.getParent<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (isSigningIn) {
      return;
    }
    setErrorMessage(null);
    setIsSigningIn(true);
    try {
      const rawAccessToken = await requestFanfouAccessToken(CALLBACK_URL);
      const accessToken = await resolveAuthAccessTokenIdentity(rawAccessToken);
      await saveAuthAccessToken(accessToken);
      setAuthAccessToken(accessToken);
      if (rootNavigation) {
        rootNavigation.reset({
          index: 0,
          routes: [
            {
              name: ROOT_STACK_ROUTE.AUTH,
              params: { screen: AUTH_STACK_ROUTE.TABS },
            },
          ],
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('loginFailed');
      setErrorMessage(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const containerStyle = useMemo(
    () => ({
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    }),
    [insets.bottom, insets.top],
  );

  const bottomButtonStyle = useMemo(
    () => ({ bottom: insets.bottom + 40 }),
    [insets.bottom],
  );

  return (
    <View
      className="flex-1 bg-[#F2F2F2] dark:bg-[#0A0A0A]"
      style={containerStyle}
    >
      <TechnicalBackground insets={insets} />
      <TechnicalAnimation />

      {/* Main Content (Centered) */}
      <View className="flex-1 items-center justify-center -mt-10 pointer-events-none">
        {errorMessage ? (
          <View className="absolute top-[65%] bg-red-500/10 px-4 py-3 rounded border border-red-500/20 pointer-events-auto">
            <Text className="text-[12px] text-red-600 font-mono text-center uppercase tracking-wide">
              [ ERROR: {errorMessage} ]
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom Button Layout */}
      <View
        className="absolute left-0 right-0 w-full px-8 items-center"
        style={bottomButtonStyle}
      >
        <Animated.View
          entering={FadeInDown.delay(500).duration(800).springify()}
          className="w-full max-w-[320px] pointer-events-auto"
        >
          {isSigningIn && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              className="mb-6 items-center"
            >
              <Pressable
                onPress={() => setIsSigningIn(false)}
                hitSlop={10}
                className="opacity-70 active:opacity-100"
              >
                <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide">
                  {t('loginCancel')}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          <AuthActionButton
            label={t('loginButton')}
            loadingLabel={t('loginLoading')}
            onPress={handleSignIn}
            isLoading={isSigningIn}
          />
        </Animated.View>
      </View>
    </View>
  );
};

export default LoginView;
