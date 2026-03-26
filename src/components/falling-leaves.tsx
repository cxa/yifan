import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
  withSequence,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const LEAF_COUNT = 15;

const Leaf = ({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) => {
  const startX = Math.random() * width;
  const duration = 5000 + Math.random() * 4000;
  const delay = Math.random() * 4000;
  const scale = 0.4 + Math.random() * 0.4;
  const initialRotation = Math.random() * 360;

  const translateY = useSharedValue(-50);
  const rotation = useSharedValue(initialRotation);
  const translateX = useSharedValue(startX);

  useEffect(() => {
    translateY.value = -50;
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(height + 100, { duration, easing: Easing.linear }),
        -1, // infinite
        false // no reverse
      )
    );
    translateX.value = startX;
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(startX + 80, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(startX - 80, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1, // infinite
        true // reverse
      )
    );
    rotation.value = initialRotation;
    rotation.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(initialRotation + 45, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(initialRotation - 45, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      )
    );
  }, [height, duration, delay, startX, initialRotation]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation.value}deg` },
        { scale },
      ],
      opacity: 0.25,
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
      <Svg width="24" height="24" viewBox="0 0 24 24">
        <Path
          d="M12 2C8 2 2 8 2 12C2 17 7 22 12 22C17 22 22 17 22 12C22 8 16 2 12 2Z"
          fill={color}
        />
      </Svg>
    </Animated.View>
  );
};

export const FallingLeaves = ({ color }: { color: string }) => {
  const { width, height } = useWindowDimensions();

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: LEAF_COUNT }).map((_, i) => (
        <Leaf key={i} width={width} height={height} color={color} />
      ))}
    </Animated.View>
  );
};
