import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useThemeColor } from 'heroui-native';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import { Text } from '@/components/app-text';
import { APP_THEME_OPTION, useAppThemePreference } from '@/settings/app-theme-preference';
import {
  CARD_BAR_DARK,
  CARD_BAR_LIGHT,
  CARD_BG_DARK,
  CARD_BG_LIGHT,
  CARD_PASTEL_CYCLE,
  SHIMMER_HIGHLIGHT_DARK,
  SHIMMER_HIGHLIGHT_LIGHT,
  SKELETON_BAR_FALLBACK_DARK,
  SKELETON_BAR_FALLBACK_LIGHT,
} from '@/components/drop-shadow-box';

type TimelineSkeletonCardProps = {
  index?: number;
  lineCount?: number;
  message?: string;
  showAvatar?: boolean;
  showAuthor?: boolean;
};

// One sweep per cycle: slow drift + long rest. Rest dominates the cycle so
// the card reads as still most of the time; the sweep becomes an occasional
// whisper, not constant motion. `inOut(sin)` gives continuous velocity so
// the drift itself is smooth.
const SWEEP_DURATION_MS = 2400;
const SWEEP_REST_MS = 1400;
const SWEEP_WIDTH_RATIO = 0.8;
const SWEEP_MIN_WIDTH = 140;
// Wide fade zone so the sweep enters and exits softly rather than clipping
// at the bar edges.
const SWEEP_OPACITY_INPUT = [0, 0.12, 0.88, 1];
const SWEEP_OPACITY_OUTPUT = [0, 1, 1, 0];

type ShimmerBarProps = {
  className?: string;
  style?: StyleProp<ViewStyle>;
  barColor?: string;
  isActive: boolean;
};

export const ShimmerBar = ({ className, style, barColor, isActive }: ShimmerBarProps) => {
  const isDark = useEffectiveIsDark();
  const sweep = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (width <= 0 || !isActive) {
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: SWEEP_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.delay(SWEEP_REST_MS),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [isActive, sweep, width]);

  const sweepWidth = Math.max(width * SWEEP_WIDTH_RATIO, SWEEP_MIN_WIDTH);
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-sweepWidth, width + sweepWidth],
  });
  const sweepOpacity = sweep.interpolate({
    inputRange: SWEEP_OPACITY_INPUT,
    outputRange: SWEEP_OPACITY_OUTPUT,
  });
  const highlight = isDark ? SHIMMER_HIGHLIGHT_DARK : SHIMMER_HIGHLIGHT_LIGHT;
  const resolvedBarColor =
    barColor ?? (isDark ? SKELETON_BAR_FALLBACK_DARK : SKELETON_BAR_FALLBACK_LIGHT);

  return (
    <View
      className={`relative overflow-hidden rounded-full ${className ?? ''}`}
      style={[{ backgroundColor: resolvedBarColor }, style]}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      {isActive && width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweep,
            { width: sweepWidth, opacity: sweepOpacity, transform: [{ translateX }] },
          ]}
        >
          <LinearGradient
            colors={['transparent', highlight, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
};

const TimelineSkeletonCard = ({
  index = 0,
  lineCount = 2,
  message,
  showAvatar = true,
  showAuthor = true,
}: TimelineSkeletonCardProps) => {
  const isDark = useEffectiveIsDark();
  const themePreference = useAppThemePreference();
  const isPlain = themePreference === APP_THEME_OPTION.PLAIN;
  const [themeBackground] = useThemeColor(['background']);
  const shadowType = CARD_PASTEL_CYCLE[index % CARD_PASTEL_CYCLE.length];
  const cardBg = isPlain
    ? themeBackground
    : (isDark ? CARD_BG_DARK : CARD_BG_LIGHT)[shadowType];
  const barColor = isPlain
    ? undefined
    : (isDark ? CARD_BAR_DARK : CARD_BAR_LIGHT)[shadowType];
  const avatarFallback = barColor
    ?? (isDark ? SKELETON_BAR_FALLBACK_DARK : SKELETON_BAR_FALLBACK_LIGHT);
  const barCount = (showAuthor ? 1 : 0) + lineCount;
  const shimmerIndex = Math.floor(Math.random() * Math.max(barCount, 1));

  const bodyLines = (
    <View className="gap-2">
      {showAuthor ? (
        <ShimmerBar
          className="h-3 w-28"
          barColor={barColor}
          isActive={shimmerIndex === 0}
        />
      ) : null}
      {Array.from({ length: lineCount }).map((_, i) => (
        <ShimmerBar
          key={`line-${i}`}
          className="h-3 w-full"
          barColor={barColor}
          style={{ opacity: 0.7 - i * 0.15 }}
          isActive={shimmerIndex === (showAuthor ? i + 1 : i)}
        />
      ))}
    </View>
  );

  return (
    <View
      className="relative rounded-3xl px-5 py-6 overflow-hidden"
      style={[{ backgroundColor: cardBg }, styles.card]}
    >
      {message ? (
        <Text className="text-[14px] text-muted">{message}</Text>
      ) : showAvatar ? (
        <View className="flex-row gap-3">
          <View
            className="size-10 rounded-full"
            style={{ backgroundColor: avatarFallback }}
          />
          <View className="flex-1">{bodyLines}</View>
        </View>
      ) : (
        bodyLines
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
  },
  sweep: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});

export default TimelineSkeletonCard;
