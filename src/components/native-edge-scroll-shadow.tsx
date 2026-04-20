import React, {
  Children,
  cloneElement,
  createElement,
  forwardRef,
  isValidElement,
  type ComponentType,
  useContext,
} from 'react';
import { HeaderHeightContext } from '@react-navigation/elements';
import { ScrollShadow } from 'heroui-native';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated from 'react-native-reanimated';
import { isNativeScrollEdgeEffectAvailable } from '@/navigation/native-scroll-edge';

type NativeEdgeScrollShadowProps = Omit<
  React.ComponentProps<typeof ScrollShadow>,
  'LinearGradientComponent' | 'isEnabled' | 'children'
> & {
  children: React.ReactNode;
};

type ResolveNativeEdgeScrollShadowSizeParams = {
  size?: number;
  headerHeight?: number | null;
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

// Tell HeroUI ScrollShadow this child is already animated-compatible,
// so it clones with handlers instead of wrapping with createAnimatedComponent.
(
  ScrollShadowChildrenContainer as typeof ScrollShadowChildrenContainer & {
    __isAnimatedComponent?: boolean;
  }
).__isAnimatedComponent = true;

export const DEFAULT_SCROLL_SHADOW_SIZE = 50;
// Header-height × multiplier becomes the shadow size for both edges (HeroUI's
// ScrollShadow uses a single size value). Anything above 1 was chosen to blur
// content cleanly beneath a transparent navbar at the top, but the bottom
// edge has no navbar and read as dramatic. Keeping 1× covers the navbar
// cleanly and keeps the bottom fade proportionate.
export const HEADER_SCROLL_SHADOW_SIZE_MULTIPLIER = 1;

export const resolveNativeEdgeScrollShadowSize = ({
  size,
  headerHeight,
}: ResolveNativeEdgeScrollShadowSizeParams) => {
  if (typeof size === 'number' && size > 0) {
    return size;
  }
  if (typeof headerHeight === 'number' && headerHeight > 0) {
    return headerHeight * HEADER_SCROLL_SHADOW_SIZE_MULTIPLIER;
  }
  return DEFAULT_SCROLL_SHADOW_SIZE;
};

const NativeEdgeScrollShadow = ({
  size,
  visibility,
  children,
  color,
  className,
  style,
  ...props
}: NativeEdgeScrollShadowProps) => {
  const headerHeight = useContext(HeaderHeightContext);

  // On iOS 26+, UIScrollView's native edge effects (exposed via
  // react-navigation's `scrollEdgeEffects: 'automatic'` screenOption on
  // the enclosing stack) produce a frosted fade directly on the scroll
  // view. Skip the HeroUI gradient overlay entirely in that case so we
  // don't double up a manual linear fade on top of the native one — the
  // native effect handles both navbar-backed and bare tab screens.
  // Still route children through ScrollShadowChildrenContainer so
  // Reanimated scroll handlers get a correctly wrapped animated component
  // instead of a raw worklet object.
  if (isNativeScrollEdgeEffectAvailable) {
    return (
      <View style={[styles.flex1, style]} className={className}>
        <ScrollShadowChildrenContainer>{children}</ScrollShadowChildrenContainer>
      </View>
    );
  }

  const childNodes = Children.toArray(children);
  const scrollableNode = childNodes.find(node => isValidElement(node));
  const scrollableProps = isValidElement(scrollableNode)
    ? (scrollableNode.props as {
        onContentSizeChange?: (...args: unknown[]) => void;
        onLayout?: (...args: unknown[]) => void;
        onScroll?: (...args: unknown[]) => void;
        scrollEventThrottle?: number;
      })
    : undefined;
  const resolvedSize = resolveNativeEdgeScrollShadowSize({
    size,
    headerHeight,
  });

  return (
    <View style={styles.flex1}>
      <ScrollShadow
        {...props}
        className={className}
        style={style}
        color={color}
        size={resolvedSize}
        visibility={visibility ?? 'both'}
        isEnabled
        LinearGradientComponent={LinearGradient}
      >
        <ScrollShadowChildrenContainer
          onContentSizeChange={scrollableProps?.onContentSizeChange}
          onLayout={scrollableProps?.onLayout}
          onScroll={scrollableProps?.onScroll}
          scrollEventThrottle={scrollableProps?.scrollEventThrottle}
        >
          {children}
        </ScrollShadowChildrenContainer>
      </ScrollShadow>
    </View>
  );
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
});

export default NativeEdgeScrollShadow;
