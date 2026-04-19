import React, { useState } from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import { Text } from '@/components/app-text';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import {
  RULED_LINE_INK_DARK,
  RULED_LINE_INK_LIGHT,
} from '@/components/drop-shadow-box';

type RuledPaperTextProps = {
  text: string;
  className?: string;
  containerClassName?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  inkColor?: string;
};

// Each rule sits at the bottom pixel of its line's line-height box — derived
// from the native text layout via onTextLayout, so CJK (no descender) and Latin
// (with descender) both come out with the rule under the characters without any
// hand-tuned offset.
const RuledPaperText = ({
  text,
  className,
  containerClassName,
  numberOfLines,
  style,
  inkColor,
}: RuledPaperTextProps) => {
  const [ruleYs, setRuleYs] = useState<number[]>([]);
  const isDark = useEffectiveIsDark();
  const ruleInk =
    inkColor ?? (isDark ? RULED_LINE_INK_DARK : RULED_LINE_INK_LIGHT);

  return (
    <View className={`relative ${containerClassName ?? ''}`}>
      {ruleYs.map((y, i) => (
        <View
          key={i}
          pointerEvents="none"
          className="absolute inset-x-0 h-px"
          style={{ top: y, backgroundColor: ruleInk }}
        />
      ))}
      <Text
        className={className}
        numberOfLines={numberOfLines}
        style={style}
        onTextLayout={e => {
          setRuleYs(
            e.nativeEvent.lines.map(l => Math.round(l.y + l.height) - 1),
          );
        }}
      >
        {text}
      </Text>
    </View>
  );
};

export default RuledPaperText;
