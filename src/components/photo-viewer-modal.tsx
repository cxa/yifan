import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import NeobrutalActivityIndicator from '@/components/neobrutal-activity-indicator';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { Text } from '@/components/app-text';

type PhotoViewerOriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PhotoViewerModalProps = {
  visible: boolean;
  photoUrl: string | null;
  topInset: number;
  originRect?: PhotoViewerOriginRect | null;
  onClose: () => void;
};

type ImageSize = {
  width: number;
  height: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 820;
const EDGE_OVERSCROLL = 24;
const EDGE_RESISTANCE = 0.34;

const PAN_SPRING = {
  stiffness: 680,
  damping: 52,
  mass: 0.42,
  overshootClamping: false,
  energyThreshold: 6e-9,
} as const;

const OPEN_TIMING = {
  duration: 190,
  easing: Easing.bezier(0.22, 0.61, 0.36, 1),
} as const;

const CLOSE_MOVE_TIMING = {
  duration: 240,
  easing: Easing.bezier(0.22, 0.61, 0.36, 1),
} as const;

const CLOSE_CONTENT_FADE_OUT_TIMING = {
  duration: 160,
  easing: Easing.out(Easing.quad),
} as const;

const CLOSE_ORIGIN_FADE_IN_TIMING = {
  duration: 170,
  easing: Easing.out(Easing.quad),
} as const;

const CLOSE_BACKDROP_FADE_OUT_TIMING = {
  duration: 100,
  easing: Easing.out(Easing.quad),
} as const;

const LOADING_FALLBACK_MS = 8000;

const clampValue = (value: number, min: number, max: number) => {
  'worklet';

  return Math.max(min, Math.min(max, value));
};

const resolveOriginTransform = ({
  originRect,
  targetWidth,
  targetHeight,
  viewportWidth,
  viewportHeight,
}: {
  originRect?: PhotoViewerOriginRect | null;
  targetWidth: number;
  targetHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}) => {
  if (!originRect) {
    return {
      translateX: 0,
      translateY: 0,
      scale: 1,
    };
  }

  const originCenterX = originRect.x + originRect.width / 2;
  const originCenterY = originRect.y + originRect.height / 2;
  const translateX = originCenterX - viewportWidth / 2;
  const translateY = originCenterY - viewportHeight / 2;
  const scaleFromWidth = originRect.width / Math.max(targetWidth, 1);
  const scaleFromHeight = originRect.height / Math.max(targetHeight, 1);
  const scale = clampValue(Math.min(scaleFromWidth, scaleFromHeight), 0.08, 1);

  return {
    translateX,
    translateY,
    scale,
  };
};

const PhotoViewerModal = ({
  visible,
  photoUrl,
  topInset,
  originRect,
  onClose,
}: PhotoViewerModalProps) => {
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  const loadingFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseSizeRef = useRef({ width: viewportWidth, height: viewportHeight });

  const baseImageSize = useMemo(() => {
    if (!imageSize || imageSize.width <= 0 || imageSize.height <= 0) {
      return { width: viewportWidth, height: viewportHeight };
    }

    const scale = Math.min(
      viewportWidth / imageSize.width,
      viewportHeight / imageSize.height,
    );

    return {
      width: Math.max(1, imageSize.width * scale),
      height: Math.max(1, imageSize.height * scale),
    };
  }, [imageSize, viewportHeight, viewportWidth]);

  useEffect(() => {
    baseSizeRef.current = baseImageSize;
  }, [baseImageSize]);

  const baseWidth = useSharedValue(baseImageSize.width);
  const baseHeight = useSharedValue(baseImageSize.height);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const presentationTranslateX = useSharedValue(0);
  const presentationTranslateY = useSharedValue(0);
  const presentationScale = useSharedValue(1);
  const contentOpacity = useSharedValue(1);
  const originPreviewOpacity = useSharedValue(0);
  const isDismissing = useSharedValue(false);
  const hasOriginRect = useSharedValue(false);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const originWidth = useSharedValue(0);
  const originHeight = useSharedValue(0);

  useEffect(() => {
    baseWidth.value = baseImageSize.width;
    baseHeight.value = baseImageSize.height;
  }, [baseHeight, baseImageSize.height, baseImageSize.width, baseWidth]);

  useEffect(() => {
    if (originRect) {
      hasOriginRect.value = true;
      originX.value = originRect.x;
      originY.value = originRect.y;
      originWidth.value = originRect.width;
      originHeight.value = originRect.height;
      return;
    }

    hasOriginRect.value = false;
    originX.value = 0;
    originY.value = 0;
    originWidth.value = 0;
    originHeight.value = 0;
  }, [hasOriginRect, originHeight, originRect, originWidth, originX, originY]);

  const clearLoadingFallback = useCallback(() => {
    if (!loadingFallbackRef.current) {
      return;
    }

    clearTimeout(loadingFallbackRef.current);
    loadingFallbackRef.current = null;
  }, []);

  const markImageLoaded = useCallback(() => {
    clearLoadingFallback();
    setIsImageLoading(false);
  }, [clearLoadingFallback]);

  useEffect(() => {
    if (!visible || !photoUrl) {
      clearLoadingFallback();
      return;
    }

    setImageSize(null);
    setIsImageLoading(true);

    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    startScale.value = 1;
    startTranslateX.value = 0;
    startTranslateY.value = 0;
    isDismissing.value = false;

    const initialBaseSize = baseSizeRef.current;
    const startTransform = resolveOriginTransform({
      originRect,
      targetWidth: initialBaseSize.width,
      targetHeight: initialBaseSize.height,
      viewportWidth,
      viewportHeight,
    });

    presentationTranslateX.value = startTransform.translateX;
    presentationTranslateY.value = startTransform.translateY;
    presentationScale.value = startTransform.scale;
    contentOpacity.value = 1;
    originPreviewOpacity.value = 0;
    backdropOpacity.value = 0;

    presentationTranslateX.value = withTiming(0, OPEN_TIMING);
    presentationTranslateY.value = withTiming(0, OPEN_TIMING);
    presentationScale.value = withTiming(1, OPEN_TIMING);
    contentOpacity.value = withTiming(1, OPEN_TIMING);
    originPreviewOpacity.value = withTiming(0, OPEN_TIMING);
    backdropOpacity.value = withTiming(1, OPEN_TIMING);

    loadingFallbackRef.current = setTimeout(() => {
      setIsImageLoading(false);
      loadingFallbackRef.current = null;
    }, LOADING_FALLBACK_MS);

    let isCancelled = false;
    Image.getSize(
      photoUrl,
      (width, height) => {
        if (!isCancelled) {
          setImageSize({ width, height });
        }
      },
      () => {
        if (!isCancelled) {
          setImageSize(null);
        }
      },
    );

    Image.prefetch(photoUrl)
      .then(() => {
        if (!isCancelled) {
          setIsImageLoading(false);
          clearLoadingFallback();
        }
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
      clearLoadingFallback();
    };
  }, [
    backdropOpacity,
    clearLoadingFallback,
    isDismissing,
    originRect,
    photoUrl,
    presentationScale,
    presentationTranslateX,
    presentationTranslateY,
    contentOpacity,
    originPreviewOpacity,
    scale,
    startScale,
    startTranslateX,
    startTranslateY,
    translateX,
    translateY,
    viewportHeight,
    viewportWidth,
    visible,
  ]);

  const clamp = useCallback((value: number, min: number, max: number) => {
    'worklet';

    return Math.max(min, Math.min(max, value));
  }, []);

  const applyEdgeResistance = useCallback(
    (value: number, min: number, max: number) => {
      'worklet';

      if (value < min) {
        const overscroll = min - value;
        return min - Math.min(EDGE_OVERSCROLL, overscroll * EDGE_RESISTANCE);
      }

      if (value > max) {
        const overscroll = value - max;
        return max + Math.min(EDGE_OVERSCROLL, overscroll * EDGE_RESISTANCE);
      }

      return value;
    },
    [],
  );

  const getPanBounds = useCallback(
    (zoomScale: number) => {
      'worklet';

      if (zoomScale <= MIN_SCALE) {
        return {
          minX: 0,
          maxX: 0,
          minY: 0,
          maxY: 0,
        };
      }

      const scaledWidth = baseWidth.value * zoomScale;
      const scaledHeight = baseHeight.value * zoomScale;
      const maxX = Math.max((scaledWidth - viewportWidth) / 2, 0);
      const maxY = Math.max((scaledHeight - viewportHeight) / 2, 0);

      return {
        minX: -maxX,
        maxX,
        minY: -maxY,
        maxY,
      };
    },
    [baseHeight, baseWidth, viewportHeight, viewportWidth],
  );

  const closeOnRN = useCallback(() => {
    onClose();
  }, [onClose]);

  const startCloseTransition = useCallback(() => {
    'worklet';

    if (isDismissing.value) {
      return;
    }

    isDismissing.value = true;

    const originExists = hasOriginRect.value;
    const endTranslateX = originExists
      ? originX.value + originWidth.value / 2 - viewportWidth / 2
      : 0;
    const endTranslateY = originExists
      ? originY.value + originHeight.value / 2 - viewportHeight / 2
      : 0;
    const endScale = originExists
      ? clamp(
          Math.min(
            originWidth.value / Math.max(baseWidth.value, 1),
            originHeight.value / Math.max(baseHeight.value, 1),
          ),
          0.08,
          1,
        )
      : 1;

    translateX.value = withTiming(0, CLOSE_MOVE_TIMING);
    translateY.value = withTiming(0, CLOSE_MOVE_TIMING);
    scale.value = withTiming(1, CLOSE_MOVE_TIMING);

    presentationTranslateX.value = withTiming(endTranslateX, CLOSE_MOVE_TIMING);
    presentationTranslateY.value = withTiming(endTranslateY, CLOSE_MOVE_TIMING);
    presentationScale.value = withTiming(endScale, CLOSE_MOVE_TIMING);
    contentOpacity.value = withDelay(
      50,
      withTiming(0, CLOSE_CONTENT_FADE_OUT_TIMING),
    );
    originPreviewOpacity.value = withTiming(
      originExists ? 1 : 0,
      CLOSE_ORIGIN_FADE_IN_TIMING,
    );
    backdropOpacity.value = withDelay(
      140,
      withTiming(0, CLOSE_BACKDROP_FADE_OUT_TIMING, finished => {
        if (finished) {
          scheduleOnRN(closeOnRN);
        }
      }),
    );
  }, [
    baseHeight,
    baseWidth,
    backdropOpacity,
    clamp,
    closeOnRN,
    hasOriginRect,
    isDismissing,
    contentOpacity,
    originPreviewOpacity,
    originHeight,
    originWidth,
    originX,
    originY,
    presentationScale,
    presentationTranslateX,
    presentationTranslateY,
    scale,
    translateX,
    translateY,
    viewportHeight,
    viewportWidth,
  ]);
  const closeWithSharedTransition = useCallback(() => {
    scheduleOnUI(startCloseTransition);
  }, [startCloseTransition]);

  const snapBack = useCallback(
    (currentScale: number) => {
      'worklet';

      const bounds = getPanBounds(currentScale);
      const targetX = clamp(translateX.value, bounds.minX, bounds.maxX);
      const targetY = clamp(translateY.value, bounds.minY, bounds.maxY);

      translateX.value = withSpring(targetX, PAN_SPRING);
      translateY.value = withSpring(targetY, PAN_SPRING);
    },
    [clamp, getPanBounds, translateX, translateY],
  );

  const pinchGesture = useMemo(() => {
    return Gesture.Pinch()
      .onBegin(() => {
        startScale.value = scale.value;
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
      })
      .onUpdate(event => {
        const nextScale = clamp(
          startScale.value * event.scale,
          0.85,
          MAX_SCALE,
        );
        const ratio = nextScale / startScale.value;
        const focalX = event.focalX - viewportWidth / 2;
        const focalY = event.focalY - viewportHeight / 2;

        const nextTranslateX =
          startTranslateX.value * ratio + (1 - ratio) * focalX;
        const nextTranslateY =
          startTranslateY.value * ratio + (1 - ratio) * focalY;
        const bounds = getPanBounds(nextScale);

        scale.value = nextScale;
        translateX.value = applyEdgeResistance(
          nextTranslateX,
          bounds.minX,
          bounds.maxX,
        );
        translateY.value = applyEdgeResistance(
          nextTranslateY,
          bounds.minY,
          bounds.maxY,
        );
      })
      .onEnd(() => {
        const targetScale = clamp(scale.value, MIN_SCALE, MAX_SCALE);

        scale.value = withSpring(targetScale, PAN_SPRING);
        if (targetScale <= MIN_SCALE) {
          translateX.value = withSpring(0, PAN_SPRING);
          translateY.value = withSpring(0, PAN_SPRING);
          backdropOpacity.value = withTiming(1, OPEN_TIMING);
          return;
        }

        snapBack(targetScale);
      });
  }, [
    applyEdgeResistance,
    backdropOpacity,
    clamp,
    getPanBounds,
    scale,
    snapBack,
    startScale,
    startTranslateX,
    startTranslateY,
    translateX,
    translateY,
    viewportHeight,
    viewportWidth,
  ]);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .averageTouches(true)
      .activeOffsetY([-4, 4])
      .minDistance(1)
      .onBegin(() => {
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
      })
      .onUpdate(event => {
        if (isDismissing.value) {
          return;
        }

        const isZoomed = scale.value > MIN_SCALE + 0.01;

        if (isZoomed) {
          const bounds = getPanBounds(scale.value);
          const nextTranslateX = startTranslateX.value + event.translationX;
          const nextTranslateY = startTranslateY.value + event.translationY;

          translateX.value = applyEdgeResistance(
            nextTranslateX,
            bounds.minX,
            bounds.maxX,
          );
          translateY.value = applyEdgeResistance(
            nextTranslateY,
            bounds.minY,
            bounds.maxY,
          );
          backdropOpacity.value = 1;
          return;
        }

        const verticalDrag =
          event.translationY > 0
            ? event.translationY
            : event.translationY * 0.18;

        translateX.value = event.translationX * 0.16;
        translateY.value = verticalDrag;

        const dragDistance = Math.abs(verticalDrag);
        backdropOpacity.value = interpolate(
          dragDistance,
          [0, 220],
          [1, 0.3],
          Extrapolation.CLAMP,
        );
      })
      .onEnd(event => {
        if (isDismissing.value) {
          return;
        }

        const isZoomed = scale.value > MIN_SCALE + 0.01;

        if (isZoomed) {
          const bounds = getPanBounds(scale.value);
          const clampX: [number, number] = [
            bounds.minX - EDGE_OVERSCROLL,
            bounds.maxX + EDGE_OVERSCROLL,
          ];
          const clampY: [number, number] = [
            bounds.minY - EDGE_OVERSCROLL,
            bounds.maxY + EDGE_OVERSCROLL,
          ];

          translateX.value = withDecay(
            {
              velocity: event.velocityX,
              clamp: clampX,
              deceleration: 0.995,
              rubberBandEffect: true,
              rubberBandFactor: 0.72,
            },
            finished => {
              'worklet';

              if (!finished) {
                return;
              }

              const currentBounds = getPanBounds(scale.value);
              translateX.value = withSpring(
                clamp(translateX.value, currentBounds.minX, currentBounds.maxX),
                PAN_SPRING,
              );
            },
          );
          translateY.value = withDecay(
            {
              velocity: event.velocityY,
              clamp: clampY,
              deceleration: 0.995,
              rubberBandEffect: true,
              rubberBandFactor: 0.72,
            },
            finished => {
              'worklet';

              if (!finished) {
                return;
              }

              const currentBounds = getPanBounds(scale.value);
              translateY.value = withSpring(
                clamp(translateY.value, currentBounds.minY, currentBounds.maxY),
                PAN_SPRING,
              );
            },
          );
          return;
        }

        const shouldClose =
          translateY.value > DISMISS_DISTANCE ||
          event.velocityY > DISMISS_VELOCITY ||
          (translateY.value > 56 && event.velocityY > 420);

        if (shouldClose) {
          startCloseTransition();
          return;
        }

        translateX.value = withSpring(0, PAN_SPRING);
        translateY.value = withSpring(0, PAN_SPRING);
        scale.value = withSpring(1, PAN_SPRING);
        backdropOpacity.value = withTiming(1, OPEN_TIMING);
      });
  }, [
    applyEdgeResistance,
    backdropOpacity,
    clamp,
    getPanBounds,
    isDismissing,
    scale,
    startCloseTransition,
    startTranslateX,
    startTranslateY,
    translateX,
    translateY,
  ]);

  const doubleTapGesture = useMemo(() => {
    return Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(240)
      .maxDistance(18)
      .onEnd(event => {
        if (isDismissing.value) {
          return;
        }

        const isZoomed = scale.value > MIN_SCALE + 0.01;

        if (isZoomed) {
          scale.value = withTiming(1, OPEN_TIMING);
          translateX.value = withTiming(0, OPEN_TIMING);
          translateY.value = withTiming(0, OPEN_TIMING);
          backdropOpacity.value = withTiming(1, OPEN_TIMING);
          return;
        }

        const targetScale = DOUBLE_TAP_SCALE;
        const focalX = event.x - viewportWidth / 2;
        const focalY = event.y - viewportHeight / 2;
        const ratio = targetScale / scale.value;
        const nextTranslateX = translateX.value * ratio + (1 - ratio) * focalX;
        const nextTranslateY = translateY.value * ratio + (1 - ratio) * focalY;
        const bounds = getPanBounds(targetScale);
        const targetX = clamp(nextTranslateX, bounds.minX, bounds.maxX);
        const targetY = clamp(nextTranslateY, bounds.minY, bounds.maxY);

        scale.value = withTiming(targetScale, OPEN_TIMING);
        translateX.value = withTiming(targetX, OPEN_TIMING);
        translateY.value = withTiming(targetY, OPEN_TIMING);
        backdropOpacity.value = withTiming(1, OPEN_TIMING);
      });
  }, [
    backdropOpacity,
    clamp,
    getPanBounds,
    isDismissing,
    scale,
    translateX,
    translateY,
    viewportHeight,
    viewportWidth,
  ]);

  const gesture = useMemo(() => {
    return Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);
  }, [doubleTapGesture, panGesture, pinchGesture]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const presentationStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [
      { translateX: presentationTranslateX.value },
      { translateY: presentationTranslateY.value },
      { scale: presentationScale.value },
    ],
  }));
  const originPreviewStyle = useAnimatedStyle(() => ({
    opacity: originPreviewOpacity.value,
  }));
  const closeControlStyle = useAnimatedStyle(() => ({
    opacity: isDismissing.value ? 0 : 1,
  }));

  const imageTransformStyle = useAnimatedStyle(() => {
    const dismissScale =
      scale.value <= MIN_SCALE + 0.01
        ? interpolate(
            Math.abs(translateY.value),
            [0, 280],
            [1, 0.84],
            Extrapolation.CLAMP,
          )
        : 1;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value * dismissScale },
      ],
    };
  });

  if (!photoUrl) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeWithSharedTransition}
    >
      <View style={styles.root}>
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill}>
            <Animated.View style={[styles.backdrop, backdropStyle]} />
            <View style={styles.imageCenter} pointerEvents="box-none">
              <Animated.View style={presentationStyle}>
                <Animated.View style={imageTransformStyle}>
                  <Image
                    source={{ uri: photoUrl }}
                    style={[
                      styles.image,
                      {
                        width: baseImageSize.width,
                        height: baseImageSize.height,
                      },
                    ]}
                    resizeMode="contain"
                    onLoad={markImageLoaded}
                    onError={markImageLoaded}
                    onLoadEnd={markImageLoaded}
                  />
                </Animated.View>
              </Animated.View>
            </View>
            {originRect ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.originPreview,
                  {
                    left: originRect.x,
                    top: originRect.y,
                    width: originRect.width,
                    height: originRect.height,
                  },
                  originPreviewStyle,
                ]}
              >
                <Image
                  source={{ uri: photoUrl }}
                  style={styles.originPreviewImage}
                  resizeMode="cover"
                />
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
        {isImageLoading ? (
          <View style={styles.loading} pointerEvents="none">
            <NeobrutalActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
        <Animated.View
          style={[
            styles.closeWrap,
            { top: Math.max(topInset + 8, 16) },
            closeControlStyle,
          ]}
        >
          <Pressable
            onPress={closeWithSharedTransition}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close photo viewer"
          >
            <Text allowFontScaling style={styles.closeText}>
              CLOSE
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  imageCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: 'transparent',
  },
  originPreview: {
    position: 'absolute',
    overflow: 'hidden',
  },
  originPreviewImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeWrap: {
    position: 'absolute',
    right: 16,
  },
  closeButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeText: {
    color: '#FFFFFF',
  },
});

export default PhotoViewerModal;
