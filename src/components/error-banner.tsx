import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
  LinearTransition,
  Easing,
} from 'react-native-reanimated';
import { Surface } from 'heroui-native';
import { Info } from 'lucide-react-native';
import { Text } from '@/components/app-text';

type ErrorBannerProps = {
  message: string;
  technicalDetail?: string | null;
};

const TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };
const FADE_IN = FadeIn.duration(220).easing(Easing.out(Easing.cubic));
const FADE_OUT = FadeOut.duration(160).easing(Easing.in(Easing.cubic));

const ErrorBanner = ({ message, technicalDetail }: ErrorBannerProps) => {
  const [expanded, setExpanded] = useState(false);
  const progress = useSharedValue(0);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    progress.value = withTiming(next ? 1 : 0, TIMING);
  };

  const iconStyle = useAnimatedStyle(() => ({
    opacity: expanded ? withTiming(0.7, TIMING) : withTiming(0.35, TIMING),
  }));

  return (
    <Animated.View layout={LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}>
      <Surface className="rounded-3xl bg-danger-soft px-4 py-3">
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 text-[13px] text-danger">{message}</Text>
          {technicalDetail ? (
            <Pressable
              onPress={handleToggle}
              hitSlop={13}
              className="active:opacity-60 mt-0.5"
            >
              <Animated.View style={iconStyle}>
                <Info size={14} className="color-danger" />
              </Animated.View>
            </Pressable>
          ) : null}
        </View>
        {expanded && (
          <Animated.View entering={FADE_IN} exiting={FADE_OUT} className="mt-2">
            <Text className="text-[11px] text-danger/60 font-mono leading-relaxed">
              {technicalDetail}
            </Text>
          </Animated.View>
        )}
      </Surface>
    </Animated.View>
  );
};

export default ErrorBanner;
