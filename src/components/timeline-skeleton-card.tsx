import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, StyleSheet, View } from 'react-native';
import { useColorScheme } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';

type TimelineSkeletonCardProps = {
  lineCount?: number;
  message?: string;
};

const SHIMMER_DURATION = 1400;
const SHIMMER_MIN_WIDTH = 120;
const SHIMMER_RATIO = 0.6;
type ShimmerBarProps = {
  className?: string;
  style?: StyleProp<ViewStyle>;
  isActive: boolean;
};

const ShimmerBar = ({ className, style, isActive }: ShimmerBarProps) => {
  const isDark = useColorScheme() === 'dark';
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
  const translateX = useMemo(
    () =>
      shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [-shimmerWidth, width + shimmerWidth],
      }),
    [shimmer, shimmerWidth, width],
  );

  const gradientColors = isDark
    ? ['transparent', 'rgba(255,255,255,0.12)', 'transparent']
    : ['transparent', 'rgba(255,255,255,0.6)', 'transparent'];

  const shimmerStyle = useMemo(
    () => [
      styles.shimmer,
      {
        width: shimmerWidth,
        transform: [{ translateX }],
      },
    ],
    [shimmerWidth, translateX],
  );

  return (
    <View
      className={`relative overflow-hidden ${className ?? ''}`}
      style={style}
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
  lineCount = 2,
  message,
}: TimelineSkeletonCardProps) => {
  const shimmerIndex = useMemo(
    () => Math.floor(Math.random() * (lineCount + 1)),
    [lineCount],
  );

  return (
    <DropShadowBox>
      <View className="relative bg-surface border-2 border-foreground dark:border-border px-5 py-4 overflow-hidden">
        {message ? (
          <Text className="text-[14px] text-muted">{message}</Text>
        ) : (
          <View className="flex-row gap-3">
            <View className="h-10 w-10 rounded-full bg-surface-secondary" />
            <View className="flex-1 gap-2">
              <ShimmerBar
                className="h-3 w-28 bg-surface-secondary"
                isActive={shimmerIndex === 0}
              />
              {Array.from({ length: lineCount }).map((_, index) => (
                <ShimmerBar
                  key={`line-${index}`}
                  className="h-3 w-full bg-surface-secondary"
                  style={{ opacity: 0.7 - index * 0.15 }}
                  isActive={shimmerIndex === index + 1}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </DropShadowBox>
  );
};

const styles = StyleSheet.create({
  shimmer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});

export default TimelineSkeletonCard;
