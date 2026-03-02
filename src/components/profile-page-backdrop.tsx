import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type ProfilePageBackdropProps = {
  backgroundColor: string;
  backgroundImageUrl?: string;
  isBackgroundImageTiled?: boolean;
  children: React.ReactNode;
};

const ProfilePageBackdrop = ({
  backgroundColor,
  backgroundImageUrl,
  isBackgroundImageTiled,
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
      {children}
    </View>
  );
};

export default ProfilePageBackdrop;
