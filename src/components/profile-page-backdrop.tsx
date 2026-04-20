import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

type ProfilePageBackdropProps = {
  backgroundColor: string;
  backgroundImageUrl?: string;
  isBackgroundImageTiled?: boolean;
  isDark?: boolean;
  children: React.ReactNode;
};

// Non-tiled profile backgrounds on Fanfou web use `background-position: left top`
// with no repeat — the image hangs from the top-left corner at its natural size
// and anything past the viewport edge is clipped. React Native's `resizeMode`
// has no matching option (`cover` stretches, `center` centers, `contain`
// letterboxes), so we render an absolutely-positioned Image at the size
// reported by `Image.getSize`.
const TopLeftAnchoredBackground = ({ url }: { url: string }) => {
  const [dimensions, setDimensions] = useState<
    { width: number; height: number } | null
  >(null);
  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      url,
      (width, height) => {
        if (!cancelled) setDimensions({ width, height });
      },
      () => {
        // Silent fail — without dimensions we just don't render the image.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!dimensions) return null;
  return (
    <Image
      source={{ uri: url }}
      style={[styles.topLeftAnchor, dimensions]}
    />
  );
};

const styles = StyleSheet.create({
  topLeftAnchor: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

const ProfilePageBackdrop = ({
  backgroundColor,
  backgroundImageUrl,
  isBackgroundImageTiled,
  isDark,
  children,
}: ProfilePageBackdropProps) => {
  // Dark-mode overlay tint: use the (already dark-adapted) page background
  // instead of pure black. That way the image area (image × 0.2 + tint × 0.8)
  // and the non-image area (pageBg × 0.2 + tint × 0.8 = pageBg) settle into
  // the same colour family, eliminating the visible seam where the image
  // ends. `CC` is 80% alpha in #RRGGBBAA.
  const overlayColor =
    isDark && /^#[0-9A-Fa-f]{6}$/.test(backgroundColor)
      ? `${backgroundColor}CC`
      : 'rgba(0,0,0,0.8)';
  return (
    <View className="flex-1" style={{ backgroundColor }}>
      {backgroundImageUrl ? (
        isBackgroundImageTiled ? (
          <Image
            source={{ uri: backgroundImageUrl }}
            resizeMode="repeat"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <TopLeftAnchoredBackground url={backgroundImageUrl} />
        )
      ) : null}
      {backgroundImageUrl && isDark ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]}
        />
      ) : null}
      {children}
    </View>
  );
};

export default ProfilePageBackdrop;
