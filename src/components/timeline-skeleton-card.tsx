import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, StyleSheet, View } from 'react-native';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import LinearGradient from 'react-native-linear-gradient';
import { Text } from '@/components/app-text';
import { APP_THEME_OPTION, useAppThemePreference } from '@/settings/app-theme-preference';

type TimelineSkeletonCardProps = {
  index?: number;
  lineCount?: number;
  message?: string;
};

const SHIMMER_DURATION = 1800;
const SHIMMER_MIN_WIDTH = 80;
const SHIMMER_RATIO = 0.4;

// Pastel card backgrounds — same cycle as TimelineStatusCard
const CARD_BG_LIGHT = ['#FDDBD5', '#FDF3C8', '#E8D5F5', '#D0E8F5', '#C8EDE8'] as const;
const CARD_BG_DARK  = ['#3D2820', '#352E18', '#2D1E38', '#1A2E3D', '#1A3530'] as const;

// Slightly deeper tint for shimmer bars on each pastel background
const BAR_BG_LIGHT  = ['#F5C4B8', '#F5E298', '#CCBAEC', '#A8D0EC', '#9ED6CC'] as const;
const BAR_BG_DARK   = ['#5A3830', '#4A4020', '#402850', '#203A50', '#1E4840'] as const;

type ShimmerBarProps = {
  className?: string;
  style?: StyleProp<ViewStyle>;
  barColor?: string;
  isActive: boolean;
};

export const ShimmerBar = ({ className, style, barColor, isActive }: ShimmerBarProps) => {
  const isDark = useEffectiveIsDark();
  const shimmer = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (width <= 0 || !isActive) {
      return;
    }
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [isActive, shimmer, width]);

  const shimmerWidth = Math.max(width * SHIMMER_RATIO, SHIMMER_MIN_WIDTH);
  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, width + shimmerWidth],
  });

  const gradientColors = isDark
    ? ['transparent', 'rgba(255,255,255,0.07)', 'transparent']
    : ['transparent', 'rgba(255,255,255,0.40)', 'transparent'];

  const shimmerStyle = [
    styles.shimmer,
    { width: shimmerWidth, transform: [{ translateX }] },
  ];

  const resolvedBarColor =
    barColor ?? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)');

  return (
    <View
      className={`relative overflow-hidden rounded-full ${className ?? ''}`}
      style={[style, { backgroundColor: resolvedBarColor }]}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      {isActive && width > 0 ? (
        <Animated.View pointerEvents="none" style={shimmerStyle}>
          <LinearGradient
            colors={gradientColors}
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
}: TimelineSkeletonCardProps) => {
  const isDark = useEffectiveIsDark();
  const themePreference = useAppThemePreference();
  const isPlain = themePreference === APP_THEME_OPTION.PLAIN;
  const paletteIndex = index % CARD_BG_LIGHT.length;
  const cardBg = isPlain
    ? (isDark ? '#1E1E1E' : '#FFFFFF')
    : (isDark ? CARD_BG_DARK : CARD_BG_LIGHT)[paletteIndex];
  const barColor = isPlain
    ? undefined
    : (isDark ? BAR_BG_DARK : BAR_BG_LIGHT)[paletteIndex];
  const shimmerIndex = Math.floor(Math.random() * (lineCount + 1));

  return (
    <View
      className="relative rounded-3xl px-5 py-6 overflow-hidden"
      style={[{ backgroundColor: cardBg }, styles.card]}
    >
      {message ? (
        <Text className="text-[14px] text-muted">{message}</Text>
      ) : (
        <View className="flex-row gap-3">
          <View
            className="h-10 w-10 rounded-full"
            style={{ backgroundColor: barColor ?? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') }}
          />
          <View className="flex-1 gap-2">
            <ShimmerBar
              className="h-3 w-28"
              barColor={barColor}
              isActive={shimmerIndex === 0}
            />
            {Array.from({ length: lineCount }).map((_, i) => (
              <ShimmerBar
                key={`line-${i}`}
                className="h-3 w-full"
                barColor={barColor}
                style={{ opacity: 0.7 - i * 0.15 }}
                isActive={shimmerIndex === i + 1}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
  },
  shimmer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});

export default TimelineSkeletonCard;
