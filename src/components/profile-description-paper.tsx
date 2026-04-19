import React from 'react';
import { View, type TextStyle } from 'react-native';
import RuledPaperText from '@/components/ruled-paper-text';

type ProfileDescriptionPaperProps = {
  description: string;
  primaryTextStyle?: TextStyle;
};

const TILT = { transform: [{ rotate: '0.5deg' }] } as const;

const ProfileDescriptionPaper = ({
  description,
  primaryTextStyle,
}: ProfileDescriptionPaperProps) => (
  <View
    className="overflow-hidden rounded-sm bg-[#FDFBF5] dark:bg-surface-secondary border border-foreground/10 px-5 pt-6 pb-6 shadow-card"
    style={TILT}
  >
    <RuledPaperText
      text={description}
      className="text-[15px] leading-[28px] text-foreground"
      style={primaryTextStyle}
    />
  </View>
);

export default ProfileDescriptionPaper;
