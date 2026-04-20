import React, {
  Children,
  cloneElement,
  createElement,
  forwardRef,
  isValidElement,
  useContext,
  type ComponentType,
} from 'react';
import { HeaderHeightContext } from '@react-navigation/elements';
import { Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

// Parse a #RRGGBB / #RGB color into an rgba() string with the given alpha.
// Needed because LinearGradient's two-stop fade `[color, 'rgba(0,0,0,0)']`
// interpolates RGB from the page bg down to pure black at the transparent
// end, producing a grey/muddy band mid-gradient. Using the same RGB with
// alpha 0 keeps the fade clean.
const hexWithAlpha = (hex: string, alpha: number): string => {
  const cleaned = hex.replace('#', '');
  const full =
    cleaned.length === 3
      ? cleaned.split('').map(ch => ch + ch).join('')
      : cleaned;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Rebuilds HeroUI's easeGradient in place — walks an easeInOut curve and
// emits a handful of intermediate alpha stops so the fade looks smooth
// across the whole gradient rather than stepping sharply near one end.
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const GRADIENT_STOPS = 12;
const buildEaseFadeStops = (
  color: string,
  fromAlpha: number,
  toAlpha: number,
) => {
  const colors: string[] = [];
  const locations: number[] = [];
  for (let index = 0; index <= GRADIENT_STOPS; index++) {
    const progress = index / GRADIENT_STOPS;
    const easedProgress = EASE_IN_OUT(progress);
    const alpha = fromAlpha + (toAlpha - fromAlpha) * easedProgress;
    colors.push(hexWithAlpha(color, alpha));
    locations.push(progress);
  }
  return { colors, locations };
};
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useComposedEventHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

type NativeEdgeScrollShadowProps = {
  children: React.ReactNode;
  color: string;
  className?: string;
  style?: ViewStyle;
};

type ScrollShadowChildrenContainerProps = {
  children: React.ReactNode;
  onContentSizeChange?: (...args: unknown[]) => void;
  onLayout?: (...args: unknown[]) => void;
  onScroll?: (...args: unknown[]) => void;
  scrollEventThrottle?: number;
};

const animatedComponentCache = new WeakMap<
  ComponentType<any>,
  ComponentType<any>
>();

const getAnimatedComponent = (
  componentType: ComponentType<any>,
): ComponentType<any> => {
  let cached = animatedComponentCache.get(componentType);
  if (!cached) {
    cached = Animated.createAnimatedComponent(componentType);
    animatedComponentCache.set(componentType, cached);
  }
  return cached;
};

// Wraps the scrollable child so Reanimated worklet scroll handlers get
// attached to an `Animated.createAnimatedComponent`-wrapped version of
// the underlying FlatList / ScrollView. Also extracts floating siblings
// so they render alongside the scrollable inside the gradient host.
const ScrollShadowChildrenContainer = forwardRef<
  React.ComponentRef<typeof View>,
  ScrollShadowChildrenContainerProps
>(
  (
    { children, onContentSizeChange, onLayout, onScroll, scrollEventThrottle },
    ref,
  ) => {
    const childNodes = Children.toArray(children);
    const scrollableIndex = childNodes.findIndex(node => isValidElement(node));

    if (scrollableIndex === -1) {
      return null;
    }

    const scrollableNode = childNodes[scrollableIndex];
    const floatingNodes = childNodes.filter(
      (_, index) => index !== scrollableIndex,
    );

    if (!isValidElement(scrollableNode)) {
      return null;
    }

    const scrollableChild = scrollableNode as React.ReactElement<{
      onContentSizeChange?: (...args: unknown[]) => void;
      onLayout?: (...args: unknown[]) => void;
      onScroll?: (...args: unknown[]) => void;
      scrollEventThrottle?: number;
    }>;
    const isAnimatedChild =
      (scrollableChild.type as any)?.displayName?.includes(
        'AnimatedComponent',
      ) || (scrollableChild.type as any)?.__isAnimatedComponent;
    const injectedProps: {
      onContentSizeChange?: (...args: unknown[]) => void;
      onLayout?: (...args: unknown[]) => void;
      onScroll?: (...args: unknown[]) => void;
      scrollEventThrottle?: number;
    } = {};

    if (onContentSizeChange) {
      injectedProps.onContentSizeChange = onContentSizeChange;
    }
    if (onLayout) {
      injectedProps.onLayout = onLayout;
    }
    if (onScroll) {
      injectedProps.onScroll = onScroll;
    }
    if (typeof scrollEventThrottle === 'number') {
      injectedProps.scrollEventThrottle = scrollEventThrottle;
    }

    return (
      <View ref={ref} className="flex-1">
        {isAnimatedChild
          ? cloneElement(scrollableChild, injectedProps)
          : createElement(
              getAnimatedComponent(scrollableChild.type as ComponentType<any>),
              {
                ...(scrollableChild.props as Record<string, unknown>),
                ...injectedProps,
              },
            )}
        {floatingNodes}
      </View>
    );
  },
);

ScrollShadowChildrenContainer.displayName =
  'NativeEdgeScrollShadowChildrenContainer';

// Baseline HeroUI-style gradient height — used as the bottom fade on
// every screen, and as the top fade on tab-root screens with no navbar.
// Tried iOS 26's native `scrollEdgeEffects` first, but without a real
// UITabBar at the bottom (the app uses a JS-drawn floating pill) the
// system's `automatic` mode can't find an anchor and renders nothing —
// so we render our own gradient everywhere. ~80px lines up with a
// navbar's height without feeling dramatic at the bottom.
export const NATIVE_EDGE_SCROLL_SHADOW_SIZE = 80;

type EdgeSizes = { top: number; bottom: number };

const resolveEdgeSizes = (
  headerHeight: number | null | undefined,
): EdgeSizes => {
  // Under a native navbar, the top fade must cover both the navbar's
  // translucent area and the scroll edge below, so it adds the
  // current headerHeight to the baseline. The bottom stays at the
  // baseline — there's no native toolbar below.
  const hasNavBar = typeof headerHeight === 'number' && headerHeight > 0;
  return {
    top: NATIVE_EDGE_SCROLL_SHADOW_SIZE + (hasNavBar ? headerHeight! : 0),
    bottom: NATIVE_EDGE_SCROLL_SHADOW_SIZE,
  };
};

// Fade-in threshold: how many pixels of scroll movement past an edge it
// takes for the shadow to reach full opacity. HeroUI uses size/4; we keep
// the same feel.
const OPACITY_RAMP_DIVISOR = 4;

const NativeEdgeScrollShadow = ({
  children,
  color,
  className,
  style,
}: NativeEdgeScrollShadowProps) => {
  const headerHeight = useContext(HeaderHeightContext);
  const { top: topSize, bottom: bottomSize } = resolveEdgeSizes(headerHeight);
  // Top fade: opaque page color at the very top, same RGB with alpha 0
  // at the bottom of the strip. Bottom fade: reversed.
  const topGradient = buildEaseFadeStops(color, 1, 0);
  const bottomGradient = buildEaseFadeStops(color, 0, 1);

  const scrollOffset = useSharedValue(0);
  const contentSize = useSharedValue(0);
  const containerSize = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollOffset.set(event.contentOffset.y);
    },
  });
  const handleContentSizeChange = (_w: number, h: number) => {
    contentSize.set(h);
  };
  const handleLayout = (event: { nativeEvent: { layout: { height: number } } }) => {
    containerSize.set(event.nativeEvent.layout.height);
  };

  const topShadowOpacity = useDerivedValue(() =>
    interpolate(
      scrollOffset.get(),
      [0, topSize / OPACITY_RAMP_DIVISOR],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  );
  const bottomShadowOpacity = useDerivedValue(() => {
    const total = contentSize.get();
    if (total <= 0) return 0;
    const visibleEnd = scrollOffset.get() + containerSize.get();
    return interpolate(
      visibleEnd,
      [total - bottomSize / OPACITY_RAMP_DIVISOR, total],
      [1, 0],
      Extrapolation.CLAMP,
    );
  });

  const topShadowStyle = useAnimatedStyle(() => ({
    opacity: topShadowOpacity.get(),
  }));
  const bottomShadowStyle = useAnimatedStyle(() => ({
    opacity: bottomShadowOpacity.get(),
  }));

  const childNodes = Children.toArray(children);
  const scrollableNode = childNodes.find(node => isValidElement(node));
  const originalScrollableProps = isValidElement(scrollableNode)
    ? (scrollableNode.props as {
        onScroll?: (...args: unknown[]) => void;
        onContentSizeChange?: (...args: unknown[]) => void;
        onLayout?: (...args: unknown[]) => void;
        scrollEventThrottle?: number;
      })
    : undefined;

  // Compose our worklet scroll tracker with whatever the caller passed
  // so the shadow always updates, and the screen's own worklet (if any)
  // still fires. Non-worklet onScroll props won't compose cleanly — the
  // few screens using this component all pass worklet handlers.
  const composedOnScroll = useComposedEventHandler(
    originalScrollableProps?.onScroll
      ? [scrollHandler, originalScrollableProps.onScroll as any]
      : [scrollHandler],
  );
  const composedOnContentSizeChange = (...args: unknown[]) => {
    handleContentSizeChange(args[0] as number, args[1] as number);
    originalScrollableProps?.onContentSizeChange?.(...args);
  };
  const composedOnLayout = (event: any) => {
    handleLayout(event);
    originalScrollableProps?.onLayout?.(event);
  };

  return (
    <View style={[styles.flex1, style]} className={className}>
      <ScrollShadowChildrenContainer
        onScroll={composedOnScroll as any}
        onContentSizeChange={composedOnContentSizeChange}
        onLayout={composedOnLayout}
        scrollEventThrottle={
          originalScrollableProps?.scrollEventThrottle ?? 16
        }
      >
        {children}
      </ScrollShadowChildrenContainer>
      {/* Top fade */}
      <Animated.View
        pointerEvents="none"
        style={[styles.topShadow, { height: topSize }, topShadowStyle]}
      >
        <LinearGradient
          colors={topGradient.colors as [string, string, ...string[]]}
          locations={topGradient.locations as [number, number, ...number[]]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Bottom fade */}
      <Animated.View
        pointerEvents="none"
        style={[styles.bottomShadow, { height: bottomSize }, bottomShadowStyle]}
      >
        <LinearGradient
          colors={bottomGradient.colors as [string, string, ...string[]]}
          locations={bottomGradient.locations as [number, number, ...number[]]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  topShadow: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomShadow: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});

export default NativeEdgeScrollShadow;
