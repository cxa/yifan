import React from 'react';
import { Pressable, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Surface } from 'heroui-native';

import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';
import { ShimmerBar } from '@/components/timeline-skeleton-card';

export type ProfileStatItem = {
  label: string;
  value: string | number | null | undefined;
  onPress?: () => void;
};

type ProfileStatRowProps = {
  stats: ProfileStatItem[];
  skeleton?: boolean;
  itemCount?: number;
  panelStyle?: StyleProp<ViewStyle>;
  shadowStyle?: StyleProp<ViewStyle>;
  valueTextStyle?: StyleProp<TextStyle>;
  labelTextStyle?: StyleProp<TextStyle>;
};

const getStatValue = (value: ProfileStatItem['value']) => value ?? '--';

const ProfileStatSkeletonCell = ({
  panelStyle,
  shadowStyle,
}: {
  panelStyle?: StyleProp<ViewStyle>;
  shadowStyle?: StyleProp<ViewStyle>;
}) => (
  <DropShadowBox containerClassName="flex-1" shadowStyle={shadowStyle}>
    <Surface className="bg-surface-secondary px-4 py-4" style={panelStyle}>
      <ShimmerBar className="h-8 w-12 bg-surface-tertiary" isActive />
      <ShimmerBar
        className="mt-1 h-5 w-16 bg-surface-tertiary"
        isActive={false}
      />
    </Surface>
  </DropShadowBox>
);

const ProfileStatRow = ({
  stats,
  skeleton,
  itemCount,
  panelStyle,
  shadowStyle,
  valueTextStyle,
  labelTextStyle,
}: ProfileStatRowProps) => {
  if (skeleton) {
    const count = itemCount ?? 3;
    return (
      <View className="flex-row gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <ProfileStatSkeletonCell
            key={i}
            panelStyle={panelStyle}
            shadowStyle={shadowStyle}
          />
        ))}
      </View>
    );
  }

  return (
    <View className="flex-row gap-4">
      {stats.map(stat => (
        <DropShadowBox
          key={stat.label}
          containerClassName="flex-1"
          shadowStyle={shadowStyle}
        >
          <Pressable
            onPress={stat.onPress}
            disabled={!stat.onPress}
            accessibilityRole={stat.onPress ? 'button' : undefined}
            className={stat.onPress ? 'active:opacity-75' : ''}
          >
            <Surface className="bg-surface-secondary px-4 py-4" style={panelStyle}>
              <Text
                className="text-2xl text-foreground"
                numberOfLines={1}
                minimumFontScale={0.7}
                allowFontScaling
                style={valueTextStyle}
              >
                {getStatValue(stat.value)}
              </Text>
              <Text
                className="text-sm text-foreground"
                numberOfLines={1}
                style={labelTextStyle}
              >
                {stat.label}
              </Text>
            </Surface>
          </Pressable>
        </DropShadowBox>
      ))}
    </View>
  );
};

export default ProfileStatRow;
