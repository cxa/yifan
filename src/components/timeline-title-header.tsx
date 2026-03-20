import React from 'react';
import { View } from 'react-native';
import { Surface } from 'heroui-native';
import Animated from 'react-native-reanimated';

import { AnimatedText, Text } from '@/components/app-text';

type TimelineTitleHeaderProps = {
  title: string;
  titleContainerStyle?: React.ComponentProps<typeof Animated.View>['style'];
  titleTextStyle?: React.ComponentProps<typeof AnimatedText>['style'];
  errorMessage?: string | null;
  containerClassName?: string;
};

const TimelineTitleHeader = ({
  title,
  titleContainerStyle,
  titleTextStyle,
  errorMessage,
  containerClassName = 'px-1',
}: TimelineTitleHeaderProps) => (
  <View className={containerClassName}>
    <Animated.View
      className="overflow-hidden justify-end"
      style={titleContainerStyle}
    >
      <AnimatedText
        className="text-[34px] font-bold text-foreground leading-[40px]"
        style={titleTextStyle}
      >
        {title}
      </AnimatedText>
    </Animated.View>
    {errorMessage ? (
      <Surface className="rounded-[16px] mt-4 bg-danger-soft px-4 py-3">
        <Text className="text-[13px] text-danger-foreground">
          {errorMessage}
        </Text>
      </Surface>
    ) : null}
  </View>
);

export default TimelineTitleHeader;
