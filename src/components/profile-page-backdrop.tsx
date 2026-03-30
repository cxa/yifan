import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type ProfilePageBackdropProps = {
  backgroundColor: string;
  backgroundImageUrl?: string;
  isBackgroundImageTiled?: boolean;
  isDark?: boolean;
  children: React.ReactNode;
};

const ProfilePageBackdrop = ({
  backgroundColor,
  backgroundImageUrl,
  isBackgroundImageTiled,
  isDark,
  children,
}: ProfilePageBackdropProps) => {
  return (
    <View className="flex-1" style={{ backgroundColor }}>
      {backgroundImageUrl ? (
        <Image
          source={{ uri: backgroundImageUrl }}
          resizeMode={isBackgroundImageTiled ? 'repeat' : 'cover'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {backgroundImageUrl && isDark ? (
        <View style={styles.darkOverlay} />
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  darkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
});

export default ProfilePageBackdrop;
