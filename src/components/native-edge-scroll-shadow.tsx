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

type NativeEdgeScrollShadowProps = Omit<
  React.ComponentProps<typeof ScrollShadow>,
  'LinearGradientComponent' | 'isEnabled' | 'children' | 'size'
> & {
  children: React.ReactNode;
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

// Baseline HeroUI gradient height — used as the bottom fade on every
// screen, and as the top fade on tab-root screens with no navbar. Tried
// iOS 26's native `scrollEdgeEffects` first, but without a real
// UITabBar at the bottom (the app uses a JS-drawn floating pill) the
// system's `automatic` mode can't find an anchor and renders nothing —
// so we fall back to a uniform HeroUI gradient everywhere. ~80px lines
// up with a navbar's height without feeling dramatic at the bottom.
export const NATIVE_EDGE_SCROLL_SHADOW_SIZE = 80;
const resolveShadowSize = (headerHeight: number | null | undefined): number => {
  // Screens under a native navbar get the baseline + the navbar height
  // so the gradient covers both the navbar's translucent area and the
  // edge of the scroll view below it. Bare tab roots just use the
  // baseline.
  if (typeof headerHeight === 'number' && headerHeight > 0) {
    return NATIVE_EDGE_SCROLL_SHADOW_SIZE + headerHeight;
  }
  return NATIVE_EDGE_SCROLL_SHADOW_SIZE;
};

const NativeEdgeScrollShadow = ({
  visibility,
  children,
  color,
  className,
  style,
  ...props
}: NativeEdgeScrollShadowProps) => {
  const headerHeight = useContext(HeaderHeightContext);
  const size = resolveShadowSize(headerHeight);
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

  return (
    <View style={styles.flex1}>
      <ScrollShadow
        {...props}
        className={className}
        style={style}
        color={color}
        size={size}
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
