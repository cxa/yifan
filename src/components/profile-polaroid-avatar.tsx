import React from 'react';
import { Image, Pressable, View, type TextStyle } from 'react-native';
import NeobrutalActivityIndicator from '@/components/neobrutal-activity-indicator';
import { Text } from '@/components/app-text';

type ProfilePolaroidAvatarProps = {
  avatarUrl: string | null | undefined;
  handleName: string;
  fallbackInitial: string;
  isLoading?: boolean;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  mutedTextStyle?: TextStyle;
};

const DEFAULT_SIZE = 96;
const NO_FONT_PADDING = { includeFontPadding: false } as const;

const ProfilePolaroidAvatar = ({
  avatarUrl,
  handleName,
  fallbackInitial,
  isLoading = false,
  size = DEFAULT_SIZE,
  onPress,
  accessibilityLabel,
  mutedTextStyle,
}: ProfilePolaroidAvatarProps) => {
  const hasAvatar = Boolean(avatarUrl && avatarUrl.trim().length > 0);
  const imageSize = { width: size, height: size };
  const captionStyle = { width: size } as const;
  const caption = (
    <Text
      className="mt-1 text-[10px] leading-[12px] text-center text-foreground/70"
      style={[captionStyle, NO_FONT_PADDING, mutedTextStyle]}
      numberOfLines={1}
      ellipsizeMode="tail"
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {handleName}
    </Text>
  );
  const frameClassName =
    'bg-white dark:bg-surface-secondary rounded-sm p-2 border border-foreground/10 shadow-card';
  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View className={`${frameClassName} pb-6`}>
        <View
          className="items-center justify-center bg-surface-tertiary"
          style={imageSize}
        >
          <NeobrutalActivityIndicator size="small" />
        </View>
      </View>
    );
  } else if (hasAvatar && avatarUrl) {
    body = (
      <View className={frameClassName}>
        <View className="overflow-hidden bg-surface-tertiary" style={imageSize}>
          <Image source={{ uri: avatarUrl }} className="h-full w-full" />
        </View>
        {caption}
      </View>
    );
  } else {
    body = (
      <View className={frameClassName}>
        <View
          className="items-center justify-center bg-surface-tertiary"
          style={imageSize}
        >
          <Text className="text-[40px] font-black text-foreground">
            {fallbackInitial}
          </Text>
        </View>
        {caption}
      </View>
    );
  }
  if (onPress && !isLoading) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {body}
      </Pressable>
    );
  }
  return <>{body}</>;
};

export default ProfilePolaroidAvatar;
