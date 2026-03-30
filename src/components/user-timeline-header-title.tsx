import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/app-text';
import { fixImageUrl } from '@/utils/fix-image-url';

const HEADER_AVATAR_SIZE = 26;
const styles = StyleSheet.create({
  avatarInitialMuted: {
    opacity: 0.82,
  },
  handleMuted: {
    opacity: 0.74,
  },
});

type UserTimelineHeaderTitleProps = {
  displayName: string;
  handleName: string;
  avatarUrl: string | null;
  avatarInitial: string;
  textColor?: string;
  isVisible?: boolean;
};

const UserTimelineHeaderTitle = ({
  displayName,
  handleName,
  avatarUrl,
  avatarInitial,
  textColor,
  isVisible = true,
}: UserTimelineHeaderTitleProps) => {
  const textColorStyle = textColor ? { color: textColor } : undefined;
  const revealProgress = useSharedValue(isVisible ? 1 : 0);

  useEffect(() => {
    revealProgress.value = withTiming(isVisible ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [isVisible, revealProgress]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealProgress.value,
    transform: [
      { translateY: (1 - revealProgress.value) * 4 },
      { scale: 0.97 + revealProgress.value * 0.03 },
    ],
  }));

  return (
    <Animated.View style={revealStyle}>
      <View className="flex-row items-center justify-center gap-3">
        <View className="min-w-0 flex-row items-center gap-2 shrink">
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl && fixImageUrl(avatarUrl) }}
              className="rounded-full bg-surface-secondary"
              style={{ width: HEADER_AVATAR_SIZE, height: HEADER_AVATAR_SIZE }}
            />
          ) : (
            <View
              className="items-center justify-center rounded-full bg-surface-secondary"
              style={{ width: HEADER_AVATAR_SIZE, height: HEADER_AVATAR_SIZE }}
            >
              <Text
                className="text-[11px] text-muted"
                style={
                  textColor
                    ? [textColorStyle, styles.avatarInitialMuted]
                    : undefined
                }
              >
                {avatarInitial}
              </Text>
            </View>
          )}
          <View className="min-w-0 items-start shrink">
            <Text
              className="shrink text-[13px] leading-4 text-foreground"
              style={textColorStyle}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              className="shrink text-[13px] leading-4 text-muted"
              style={
                textColor ? [textColorStyle, styles.handleMuted] : undefined
              }
              numberOfLines={1}
            >
              {handleName}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default UserTimelineHeaderTitle;
