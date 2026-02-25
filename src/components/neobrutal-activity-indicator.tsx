import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeColor } from 'heroui-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';

type NeobrutalActivityIndicatorProps = {
  color?: string;
  size?: 'small' | 'default';
  animate?: boolean;
};

const BLOCK_SIZES = {
  small: 0.7,
  default: 1,
} as const;

// Colors
const C_TEAL = '#00A29A';
const C_BLUE = '#0077A3';
const C_RED = '#E63946';
const C_STARBURST = [
  '#E63946', // Red
  '#F4A261', // Orange
  '#E9C46A', // Yellow
  '#2A9D8F', // Green
  '#00A29A', // Teal
  '#0077A3', // Blue
  '#7209B7', // Purple
  '#D90429', // Pink
];

const generatePillStates = (_foreground: string) => {
  const getDiamondRays = (cx: number, cy: number, side: number, t: number, color: string) => {
    const d = side / 2;
    const sin = 0.707106, cos = 0.707106;
    const m = (lx: number, ly: number, lr: number) => {
      const X = cx + lx * cos - ly * sin;
      const Y = cy + lx * sin + ly * cos;
      return { w: side + t, h: t, x: X, y: Y, r: 45 + lr, s: 1, c: color };
    };
    return [
      m(0, -d, 0),   // top
      m(d, 0, 90),   // right
      m(0, d, 0),    // bot
      m(-d, 0, 90)   // left
    ];
  };

  const states = [];

  // 0: Teal Layers
  states.push([
    ...getDiamondRays(0, -7, 16, 4, C_TEAL),
    ...getDiamondRays(0, 7, 16, 4, C_TEAL)
  ]);

  // 2: Blue Diamond
  states.push([
    ...getDiamondRays(0, 0, 24, 6, C_BLUE),
    ...Array.from({ length: 4 }).map(() => ({ w: 6, h: 6, x: 0, y: 0, r: 0, s: 0, c: C_BLUE }))
  ]);

  // 3: Red Hamburger
  states.push([
    { w: 24, h: 6, x: 0, y: -10, r: 0, s: 1, c: C_RED },
    { w: 24, h: 6, x: 0, y: 0, r: 0, s: 1, c: C_RED },
    { w: 24, h: 6, x: 0, y: 10, r: 0, s: 1, c: C_RED },
    ...Array.from({ length: 5 }).map(() => ({ w: 6, h: 6, x: 0, y: 0, r: 0, s: 0, c: C_RED }))
  ]);

  // 4: Starburst
  // The rays must be longer so they burst out clearly
  states.push(Array.from({ length: 8 }).map((_, i) => {
    const angleDeg = i * 45;
    const angleRad = angleDeg * Math.PI / 180;
    const R = 16;
    return {
      w: 14, h: 6, x: R * Math.cos(angleRad), y: R * Math.sin(angleRad), r: angleDeg, s: 1, c: C_STARBURST[i]
    };
  }));

  // Normalize rotations strictly for smooth transitions
  for (let p = 0; p < 8; p++) {
    for (let s = 1; s < states.length; s++) {
      let prev = states[s - 1][p].r;
      let curr = states[s][p].r;
      while (curr - prev > 180) curr -= 360;
      while (curr - prev < -180) curr += 360;
      states[s][p].r = curr;
    }
  }

  return states;
};

const PILL_INDICES = [0, 1, 2, 3, 4, 5, 6, 7];
const FRAME_INPUTS = [0, 1, 2, 3];

const AnimatedPill = ({
  index,
  progress,
  states,
  pullProgress = { value: 1 } as SharedValue<number>,
  globalScale,
}: {
  index: number;
  progress: SharedValue<number>;
  states: any[];
  pullProgress?: SharedValue<number>;
  globalScale: number;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const pp = pullProgress.value;

    const w = interpolate(p, FRAME_INPUTS, states.map(s => s[index].w), Extrapolation.CLAMP);
    const h = interpolate(p, FRAME_INPUTS, states.map(s => s[index].h), Extrapolation.CLAMP);
    const x = interpolate(p, FRAME_INPUTS, states.map(s => s[index].x), Extrapolation.CLAMP);
    const y = interpolate(p, FRAME_INPUTS, states.map(s => s[index].y), Extrapolation.CLAMP);
    const r = interpolate(p, FRAME_INPUTS, states.map(s => s[index].r), Extrapolation.CLAMP);
    const s = interpolate(p, FRAME_INPUTS, states.map(st => st[index].s), Extrapolation.CLAMP);
    const c = interpolateColor(p, FRAME_INPUTS, states.map(st => st[index].c));

    // Pull to refresh scales the whole thing based on scroll
    const finalScale = s * pp * globalScale;

    return {
      position: 'absolute',
      width: w,
      height: h,
      backgroundColor: c,
      opacity: finalScale > 0 ? 1 : 0, // avoid painting 0-scale invisible blocks
      transform: [
        { translateX: x * pp * globalScale },
        { translateY: y * pp * globalScale },
        { rotate: `${r}deg` },
        { scale: finalScale }
      ],
      borderRadius: 9999, // pure pill wrapper
    };
  });

  return <Animated.View style={animatedStyle} />;
};

const NeobrutalActivityIndicator = ({
  size = 'default',
  animate = true,
}: NeobrutalActivityIndicatorProps) => {
  const [foreground] = useThemeColor(['foreground']);
  const states = useMemo(() => generatePillStates(foreground as string), [foreground]);
  const globalScale = BLOCK_SIZES[size];
  const containerSize = 48 * globalScale;

  const progress = useSharedValue(3);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, { duration: 6000, easing: Easing.linear }),
        -1,
        false
      );

      // Just spin the Starburst shape directly, no morphing needed for the default indicator
      progress.value = withTiming(3, { duration: 0 });
    } else {
      progress.value = withTiming(3, { duration: 200 });
    }
  }, [animate, rotation, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { width: containerSize, height: containerSize },
        containerStyle,
      ]}
    >
      {PILL_INDICES.map(i => (
        <AnimatedPill
          key={i}
          index={i}
          progress={progress}
          states={states}
          globalScale={globalScale}
        />
      ))}
    </Animated.View>
  );
};

export const REFRESH_TOP_MARGIN = 16;
export const REFRESH_TOP_MARGIN_BELOW_NAV = 8;
export const DEFAULT_PULL_THRESHOLD = 80;
export const COMPACT_PULL_THRESHOLD = 50;

export const NeobrutalRefreshIndicator = ({
  refreshing,
  scrollY,
  safeAreaTop,
  scrollInsetTop,
  pullThreshold = DEFAULT_PULL_THRESHOLD,
}: {
  refreshing: boolean;
  scrollY: SharedValue<number>;
  safeAreaTop: SharedValue<number>;
  scrollInsetTop: SharedValue<number>;
  pullThreshold?: number;
}) => {
  const [foreground] = useThemeColor(['foreground']);
  const states = useMemo(() => generatePillStates(foreground as string), [foreground]);
  const globalScale = BLOCK_SIZES.small;
  const containerSize = 48 * globalScale;

  const refreshLock = useSharedValue(0);
  const progress = useSharedValue(3);
  const pullProgress = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      refreshLock.value = 1;
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, { duration: 4000, easing: Easing.linear }),
        -1,
        false
      );

      // Bring the shape to the final Starburst state and keep it there
      progress.value = withTiming(3, { duration: 300, easing: Easing.inOut(Easing.ease) });
    } else {
      refreshLock.value = withDelay(
        200,
        withTiming(0, { duration: 250, easing: Easing.in(Easing.cubic) }),
      );
      rotation.value = withTiming(0, { duration: 300 });
      progress.value = withTiming(3, { duration: 250 });
    }
  }, [refreshing, refreshLock, rotation, progress]);

  useAnimatedStyle(() => {
    const amount = -scrollY.value;
    let p = interpolate(amount, [0, pullThreshold], [3, 0], Extrapolation.CLAMP);
    if (!refreshing && refreshLock.value === 0) {
      // Map pull straight into morph progress
      progress.value = p;
    }

    // Spring up size
    let sizeP = interpolate(amount, [0, pullThreshold], [0, 1], Extrapolation.CLAMP);
    if (refreshing || refreshLock.value > 0) {
      sizeP = Math.max(sizeP, refreshLock.value);
    }
    pullProgress.value = sizeP;

    return {};
  });

  const animatedStyle = useAnimatedStyle(() => {
    const amount = -scrollY.value;
    // Map positive pull amount to opacity 0 -> 1
    const p = interpolate(amount, [0, pullThreshold], [0, 1], Extrapolation.CLAMP);
    const visible = Math.max(p, refreshLock.value);

    const sat = safeAreaTop.value;
    const sit = scrollInsetTop.value;
    const navBarHeight = sit - sat;
    const top = navBarHeight > 10 ? sit + REFRESH_TOP_MARGIN_BELOW_NAV : sat + REFRESH_TOP_MARGIN;

    return { opacity: visible, top };
  });

  const indicatorStyle = useAnimatedStyle(() => {
    const pullOffset = interpolate(scrollY.value, [-pullThreshold, 0], [0, -containerSize / 2], Extrapolation.CLAMP);
    // Add a gradual rotation so it spins delightfully while pulling
    const extraRotation = interpolate(-scrollY.value, [0, pullThreshold], [0, 180], Extrapolation.CLAMP);
    const r = rotation.value + (!refreshing && refreshLock.value === 0 ? extraRotation : 0);

    return {
      transform: [
        { translateY: refreshing ? 0 : pullOffset },
        { rotate: `${r}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.refreshContainer, animatedStyle]}>
      <Animated.View style={[styles.container, { width: containerSize, height: containerSize }, indicatorStyle]}>
        {PILL_INDICES.map(i => (
          <AnimatedPill
            key={i}
            index={i}
            progress={progress}
            states={states}
            pullProgress={pullProgress}
            globalScale={globalScale}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    position: 'absolute',
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
