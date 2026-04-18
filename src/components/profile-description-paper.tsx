import React, { useState } from 'react';
import { View, type TextStyle } from 'react-native';
import { Text } from '@/components/app-text';

type ProfileDescriptionPaperProps = {
  description: string;
  primaryTextStyle?: TextStyle;
};

const TILT = { transform: [{ rotate: '0.5deg' }] } as const;
const RULED_LINE_HEIGHT = 28;
const RULED_LINE_BASELINE = 46;
const RULED_LINE_STYLE = {
  backgroundColor: 'rgba(90, 135, 200, 0.22)',
} as const;

const ProfileDescriptionPaper = ({
  description,
  primaryTextStyle,
}: ProfileDescriptionPaperProps) => {
  const [textHeight, setTextHeight] = useState(0);
  // Android sometimes reports a text height slightly under `lines * lineHeight`,
  // which makes `floor` drop the final ruled line. Round instead so the last
  // line of text still gets its underline on both platforms.
  const lineCount = Math.max(
    0,
    Math.round(textHeight / RULED_LINE_HEIGHT),
  );

  return (
    <View
      className="mt-3 overflow-hidden rounded-sm bg-[#FDFBF5] dark:bg-surface-secondary border border-foreground/10 px-5 pt-6 pb-6 shadow-card"
      style={TILT}
    >
      {Array.from({ length: lineCount }).map((_, i) => (
        <View
          key={i}
          className="absolute inset-x-4 h-px"
          style={[
            { top: RULED_LINE_BASELINE + i * RULED_LINE_HEIGHT },
            RULED_LINE_STYLE,
          ]}
          pointerEvents="none"
        />
      ))}
      <Text
        className="text-[15px] leading-[28px] text-foreground"
        style={primaryTextStyle}
        onLayout={e => setTextHeight(e.nativeEvent.layout.height)}
      >
        {description}
      </Text>
    </View>
  );
};

export default ProfileDescriptionPaper;
