import React, { useContext } from 'react';
import { HeaderHeightContext } from '@react-navigation/elements';
import { ScrollShadow } from 'heroui-native';
import LinearGradient from 'react-native-linear-gradient';

import { isNativeScrollEdgeEffectAvailable } from '@/navigation/native-scroll-edge';

type NativeEdgeScrollShadowProps = Omit<
  React.ComponentProps<typeof ScrollShadow>,
  'LinearGradientComponent' | 'isEnabled'
>;

const DEFAULT_SCROLL_SHADOW_SIZE = 50;
const HEADER_SCROLL_SHADOW_SIZE_MULTIPLIER = 2;

const NativeEdgeScrollShadow = ({
  size,
  visibility,
  ...props
}: NativeEdgeScrollShadowProps) => {
  const headerHeight = useContext(HeaderHeightContext);
  const resolvedSize =
    size ??
    (typeof headerHeight === 'number' && headerHeight > 0
      ? headerHeight * HEADER_SCROLL_SHADOW_SIZE_MULTIPLIER
      : DEFAULT_SCROLL_SHADOW_SIZE);

  return (
    <ScrollShadow
      {...props}
      size={resolvedSize}
      visibility={visibility ?? 'top'}
      isEnabled={!isNativeScrollEdgeEffectAvailable}
      LinearGradientComponent={LinearGradient}
    />
  );
};

export default NativeEdgeScrollShadow;
