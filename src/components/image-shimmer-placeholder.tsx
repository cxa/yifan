import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';

const SHIMMER_DURATION = 1600;
const SHIMMER_RATIO = 0.5;

/**
 * A full-area shimmer overlay intended as an image loading placeholder.
 * Renders on top of children (the actual <Image>) and hides itself
 * once `visible` is set to `false`.
 */
const ImageShimmerPlaceholder = ({ visible }: { visible: boolean }) => {
  const isDark = useEffectiveIsDark();
  const shimmer = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [width, setWidth] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (width <= 0 || !visible) {
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
  }, [visible, shimmer, width]);

  useEffect(() => {
    if (visible) {
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setDismissed(true);
    });
  }, [visible, opacity]);

  if (dismissed) {
    return null;
  }

  const shimmerWidth = Math.max(width * SHIMMER_RATIO, 60);
  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, width + shimmerWidth],
  });

  const gradientColors = isDark
    ? ['transparent', 'rgba(255,255,255,0.06)', 'transparent']
    : ['transparent', 'rgba(255,255,255,0.35)', 'transparent'];

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }]}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            styles.shimmer,
            { width: shimmerWidth, transform: [{ translateX }] },
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
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

export default ImageShimmerPlaceholder;
