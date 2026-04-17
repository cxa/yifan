import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedText } from '@/components/app-text';
import ErrorBanner from '@/components/error-banner';

type TimelineTitleHeaderProps = {
  title: string;
  titleContainerStyle?: React.ComponentProps<typeof Animated.View>['style'];
  titleTextStyle?: React.ComponentProps<typeof AnimatedText>['style'];
  errorMessage?: string | null;
  technicalError?: string | null;
  containerClassName?: string;
};

const TimelineTitleHeader = ({
  title,
  titleContainerStyle,
  titleTextStyle,
  errorMessage,
  technicalError,
  containerClassName = 'px-1',
}: TimelineTitleHeaderProps) => (
  <View className={containerClassName}>
    <Animated.View
      className="overflow-hidden justify-end"
      style={titleContainerStyle}
    >
      <AnimatedText
        className="text-[34px] font-extrabold text-foreground leading-[40px]"
        style={titleTextStyle}
      >
        {title}
      </AnimatedText>
    </Animated.View>
    {errorMessage ? (
      <View className="mt-4">
        <ErrorBanner message={errorMessage} technicalDetail={technicalError} />
      </View>
    ) : null}
  </View>
);

export default TimelineTitleHeader;
