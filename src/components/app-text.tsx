import React from 'react';
import {
  Platform,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { $ } from '@cxa/twx';

import { useAppFontClassName } from '@/settings/app-font-preference';

type ClassNameProp = { className?: string };
type AnimatedClassName = string | SharedValue<string | undefined> | undefined;
const IOS_DEFAULT_DYNAMIC_TYPE_RAMP: NonNullable<TextProps['dynamicTypeRamp']> =
  'body';

const withFont = (fontClassName?: string, className?: string) =>
  fontClassName ? $(fontClassName, className) : className;
const withFontAnimated = (
  fontClassName?: string,
  className?: AnimatedClassName,
) =>
  typeof className === 'string' || className === undefined
    ? fontClassName
      ? $(fontClassName, className)
      : className
    : className;

const Text = React.forwardRef<
  React.ComponentRef<typeof RNText>,
  TextProps & ClassNameProp
>(
  (
    {
      className,
      allowFontScaling = true,
      dynamicTypeRamp,
      maxFontSizeMultiplier,
      ...props
    },
    ref,
  ) => {
    const fontClassName = useAppFontClassName();

    return (
      <RNText
        ref={ref}
        {...props}
        allowFontScaling={allowFontScaling}
        dynamicTypeRamp={
          Platform.OS === 'ios'
            ? dynamicTypeRamp ?? IOS_DEFAULT_DYNAMIC_TYPE_RAMP
            : dynamicTypeRamp
        }
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        className={withFont(fontClassName, className)}
      />
    );
  },
);

Text.displayName = 'AppText';

const TextInput = React.forwardRef<
  React.ComponentRef<typeof RNTextInput>,
  TextInputProps & ClassNameProp
>(({ className, allowFontScaling = true, ...props }, ref) => {
  const fontClassName = useAppFontClassName();

  return (
    <RNTextInput
      ref={ref}
      {...props}
      allowFontScaling={allowFontScaling}
      className={withFont(fontClassName, className)}
    />
  );
});
TextInput.displayName = 'AppTextInput';

type AnimatedTextProps = React.ComponentProps<typeof Animated.Text>;
const AnimatedText = React.forwardRef<
  React.ComponentRef<typeof Animated.Text>,
  AnimatedTextProps
>(
  (
    {
      className,
      allowFontScaling = true,
      dynamicTypeRamp,
      maxFontSizeMultiplier,
      ...props
    },
    ref,
  ) => {
    const fontClassName = useAppFontClassName();

    return (
      <Animated.Text
        ref={ref}
        {...props}
        allowFontScaling={allowFontScaling}
        dynamicTypeRamp={
          Platform.OS === 'ios'
            ? dynamicTypeRamp ?? IOS_DEFAULT_DYNAMIC_TYPE_RAMP
            : dynamicTypeRamp
        }
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        className={withFontAnimated(fontClassName, className)}
      />
    );
  },
);
AnimatedText.displayName = 'AppAnimatedText';

const AnimatedTextInputBase = Animated.createAnimatedComponent(RNTextInput);
type AnimatedTextInputProps = React.ComponentProps<
  typeof AnimatedTextInputBase
> &
  ClassNameProp;
const AnimatedTextInput = React.forwardRef<
  React.ComponentRef<typeof RNTextInput>,
  AnimatedTextInputProps
>(({ className, allowFontScaling = true, ...props }, ref) => {
  const fontClassName = useAppFontClassName();

  return (
    <AnimatedTextInputBase
      ref={ref}
      {...props}
      allowFontScaling={allowFontScaling}
      className={withFontAnimated(fontClassName, className)}
    />
  );
});
AnimatedTextInput.displayName = 'AppAnimatedTextInput';

export { Text, TextInput, AnimatedText, AnimatedTextInput };
