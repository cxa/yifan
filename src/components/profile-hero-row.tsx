import React from 'react';
import { View, type TextStyle } from 'react-native';
import { Text } from '@/components/app-text';

type ProfileHeroRowProps = {
  avatar: React.ReactNode;
  displayName: string;
  location?: string | null;
  joinedLine?: string | null;
  profileUrl?: string | null;
  primaryTextStyle?: TextStyle;
  mutedTextStyle?: TextStyle;
  linkTextStyle?: TextStyle;
  textHaloStyle?: TextStyle | null;
};

const AVATAR_ROTATE = { transform: [{ rotate: '-3deg' }] } as const;
const NAME_ROTATE = { transform: [{ rotate: '1deg' }] } as const;

const ProfileHeroRow = ({
  avatar,
  displayName,
  location,
  joinedLine,
  profileUrl,
  primaryTextStyle,
  mutedTextStyle,
  linkTextStyle,
  textHaloStyle,
}: ProfileHeroRowProps) => (
  <View className="flex-row items-end gap-3 pt-1">
    <View style={AVATAR_ROTATE}>{avatar}</View>
    <View className="flex-1 mb-2 pl-1" style={NAME_ROTATE}>
      <Text
        className="text-[28px] font-black text-foreground"
        style={[primaryTextStyle, textHaloStyle]}
        dynamicTypeRamp="title1"
        numberOfLines={1}
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        allowFontScaling={false}
      >
        {displayName}
      </Text>
      {location ? (
        <Text
          className="text-[12px] text-muted mt-1"
          style={[mutedTextStyle, textHaloStyle]}
          numberOfLines={1}
        >
          {location}
        </Text>
      ) : null}
      {joinedLine ? (
        <Text
          className="text-[11px] text-muted mt-0.5"
          style={[mutedTextStyle, textHaloStyle]}
          numberOfLines={1}
        >
          {joinedLine}
        </Text>
      ) : null}
      {profileUrl ? (
        <Text
          className="text-[12px] font-semibold text-accent mt-1"
          style={[linkTextStyle, textHaloStyle]}
          numberOfLines={1}
        >
          {profileUrl}
        </Text>
      ) : null}
    </View>
  </View>
);

export default ProfileHeroRow;
