import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
type NeobrutalActivityIndicatorProps = {
  color?: string;
  size?: 'small' | 'default';
  animate?: boolean;
};
const PETAL_COLORS_LIGHT = [
  '#E06858', // deep coral
  '#C89020', // amber
  '#28A090', // deep teal
  '#3890C8', // deep sky blue
  '#9060C0', // deep lavender
  '#D07030', // warm orange
] as const;
const PETAL_COLORS_DARK = [
  '#C04838',
  '#A07018',
  '#1E8070',
  '#2870A8',
  '#6840A0',
  '#A05020',
] as const;
const CENTER_COLOR_LIGHT = '#F0C030';
const CENTER_COLOR_DARK = '#8A6808';
const PETAL_COUNT = 6;
const PETAL_WIDTH = 7;
const PETAL_HEIGHT = 16;
const PETAL_CENTER_OFFSET = 22; // center-to-petal-center; leaves gap between center dot and petals
const CENTER_DOT_SIZE = 16;
const FLOWER_SIZE = 60;
// Bloom cycle timing
const BLOOM_OUT_MS = 450;
const HOLD_OPEN_MS = 500;
const BLOOM_IN_MS = 350;
const HOLD_CLOSED_MS = 200;
const PETAL_STAGGER = 60;
const Petal = ({
  color,
  angle,
  delay,
  animate,
}: {
  color: string;
  angle: number;
  delay: number;
  animate: boolean;
}) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (animate) {
      progress.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, {
              duration: BLOOM_OUT_MS,
              easing: Easing.out(Easing.ease),
            }),
            withTiming(1, { duration: HOLD_OPEN_MS }),
            withTiming(0, {
              duration: BLOOM_IN_MS,
              easing: Easing.in(Easing.ease),
            }),
            withTiming(0, { duration: HOLD_CLOSED_MS }),
          ),
          -1,
          false,
        ),
      );
    } else {
      progress.value = withTiming(0, { duration: 400 });
    }
  }, [animate, delay, progress]);
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: [
        { rotate: `${angle}deg` },
        { translateY: interpolate(p, [0, 1], [-10, -PETAL_CENTER_OFFSET]) },
        { scale: p },
      ],
    };
  });
  return (
    <Animated.View style={[styles.petal, { backgroundColor: color }, animatedStyle]} />
  );
};
const CenterDot = ({
  color,
  animate,
}: {
  color: string;
  animate: boolean;
}) => {
  const scale = useSharedValue(0.7);
  useEffect(() => {
    if (animate) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.3, {
            duration: BLOOM_OUT_MS + HOLD_OPEN_MS / 2,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0.7, {
            duration: BLOOM_IN_MS + HOLD_CLOSED_MS + HOLD_OPEN_MS / 2,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      );
    } else {
      scale.value = withTiming(0.7, { duration: 300 });
    }
  }, [animate, scale]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[styles.centerDot, { backgroundColor: color }, style]} />
  );
};
const FlowerPetals = ({
  animate,
  petalColors,
  centerColor,
}: {
  animate: boolean;
  petalColors: readonly string[];
  centerColor: string;
}) => (
  <>
    {Array.from({ length: PETAL_COUNT }).map((_, i) => (
      <Petal
        key={i}
        color={petalColors[i % petalColors.length]}
        angle={(360 / PETAL_COUNT) * i}
        delay={i * PETAL_STAGGER}
        animate={animate}
      />
    ))}
    <CenterDot color={centerColor} animate={animate} />
  </>
);
const NeobrutalActivityIndicator = ({
  size = 'default',
  animate = true,
}: NeobrutalActivityIndicatorProps) => {
  const isDark = useEffectiveIsDark();
  const petalColors = isDark ? PETAL_COLORS_DARK : PETAL_COLORS_LIGHT;
  const centerColor = isDark ? CENTER_COLOR_DARK : CENTER_COLOR_LIGHT;
  const scale = size === 'small' ? 0.7 : 1;
  return (
    <Animated.View style={[styles.flower, { transform: [{ scale }] }]}>
      <FlowerPetals animate={animate} petalColors={petalColors} centerColor={centerColor} />
    </Animated.View>
  );
};
export const REFRESH_TOP_MARGIN = 16;
export const REFRESH_TOP_MARGIN_BELOW_NAV = 8;
export const DEFAULT_PULL_THRESHOLD = 60;
export const COMPACT_PULL_THRESHOLD = 36;
export const NeobrutalRefreshIndicator = ({
  refreshing,
  scrollY,
  safeAreaTop,
  scrollInsetTop,
  pullThreshold = COMPACT_PULL_THRESHOLD,
}: {
  refreshing: boolean;
  scrollY: SharedValue<number>;
  safeAreaTop: SharedValue<number>;
  scrollInsetTop: SharedValue<number>;
  pullThreshold?: number;
}) => {
  const isDark = useEffectiveIsDark();
  const petalColors = isDark ? PETAL_COLORS_DARK : PETAL_COLORS_LIGHT;
  const centerColor = isDark ? CENTER_COLOR_DARK : CENTER_COLOR_LIGHT;
  const refreshLock = useSharedValue(0);
  useEffect(() => {
    if (refreshing) {
      refreshLock.value = 1;
    } else {
      refreshLock.value = withDelay(
        200,
        withTiming(0, {
          duration: 250,
          easing: Easing.in(Easing.cubic),
        }),
      );
    }
  }, [refreshing, refreshLock]);
  const animatedStyle = useAnimatedStyle(() => {
    const sat = safeAreaTop.value;
    const sit = scrollInsetTop.value;
    const navBarHeight = sit - sat;
    const top =
      navBarHeight > 10
        ? sit + REFRESH_TOP_MARGIN_BELOW_NAV
        : sat + REFRESH_TOP_MARGIN;
    const pullAmt = interpolate(
      -scrollY.value,
      [0, pullThreshold],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const pullScale = interpolate(
      -scrollY.value,
      [0, pullThreshold],
      [0.4, 1],
      Extrapolation.CLAMP,
    );
    const visible = Math.max(pullAmt, refreshLock.value);
    return {
      opacity: visible,
      top,
      transform: [{ scale: refreshing ? 1 : pullScale }],
    };
  });
  return (
    <Animated.View style={[styles.refreshContainer, animatedStyle]}>
      <Animated.View style={styles.flower}>
        <FlowerPetals
          animate={refreshing}
          petalColors={petalColors}
          centerColor={centerColor}
        />
      </Animated.View>
    </Animated.View>
  );
};
const styles = StyleSheet.create({
  flower: {
    width: FLOWER_SIZE,
    height: FLOWER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petal: {
    position: 'absolute',
    width: PETAL_WIDTH,
    height: PETAL_HEIGHT,
    borderRadius: 999,
  },
  centerDot: {
    width: CENTER_DOT_SIZE,
    height: CENTER_DOT_SIZE,
    borderRadius: CENTER_DOT_SIZE / 2,
  },
  refreshContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
});
export default NeobrutalActivityIndicator;
