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

// Custom fonts lack emoji glyphs. On Android there is no automatic fallback to
// the system emoji font, so emoji appear as boxes. Wrap each emoji character in
// a plain RNText that explicitly sets the system font, overriding the inherited
// custom fontFamily. On iOS the system handles emoji fallback, but we still
// apply the override so behaviour is consistent across platforms.
// CJK custom fonts (HuiwenHKHei, Xiaolai, etc.) often have dummy glyph entries
// for emoji codepoints in their cmap table. This blocks Core Text / Android font
// fallback — emoji render as [?] even though the system emoji font is available.
// Fix: wrap every emoji character in a RNText that explicitly names an emoji-
// capable font, overriding the inherited custom fontFamily.
//   iOS    → 'Apple Color Emoji'  (built-in system font, loadable by PostScript name)
//   Android → 'sans-serif'        (Roboto/Noto, includes Noto Emoji fallback)
// 'Helvetica Neue' on iOS: valid system font without dummy CJK emoji cmap entries,
// so Core Text properly defers to Apple Color Emoji.
// 'sans-serif' on Android: Roboto/Noto which includes Noto Emoji fallback.
const EMOJI_FONT = Platform.OS === 'android' ? 'sans-serif' : 'Helvetica Neue';

// Surrogate-pair ranges covering U+1F000–U+1FFFF (most emoji) + BMP misc symbols.
// Intentionally avoids \p{} Unicode property escapes — older Hermes versions
// parse them without error but silently produce no matches.
const EMOJI_RE = /([\uD83C-\uD83F][\uDC00-\uDFFF]|[\u2600-\u27BF]|\u2764[\uFE0F]?)/g;

const wrapEmoji = (text: string): React.ReactNode => {
  const parts = text.split(EMOJI_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <RNText key={i} style={{ fontFamily: EMOJI_FONT }}>
        {part}
      </RNText>
    ) : (
      part
    ),
  );
};

const processEmojiChildren = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string') return wrapEmoji(children);
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child !== 'string') return child;
      const processed = wrapEmoji(child);
      return processed === child
        ? child
        : <React.Fragment key={i}>{processed}</React.Fragment>;
    });
  }
  return children;
};

type ClassNameProp = { className?: string; skipFont?: boolean };
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
      skipFont = false,
      allowFontScaling = true,
      dynamicTypeRamp,
      maxFontSizeMultiplier,
      children,
      ...props
    },
    ref,
  ) => {
    const rawFontClassName = useAppFontClassName();
    const fontClassName = skipFont ? undefined : rawFontClassName;

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
      >
        {fontClassName ? processEmojiChildren(children) : children}
      </RNText>
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
      children,
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
      >
        {fontClassName ? processEmojiChildren(children as React.ReactNode) : children}
      </Animated.Text>
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
