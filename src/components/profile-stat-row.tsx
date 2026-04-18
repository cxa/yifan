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
  valueTextStyle?: StyleProp<TextStyle>;
  labelTextStyle?: StyleProp<TextStyle>;
};

const getStatValue = (value: ProfileStatItem['value']) => value ?? '--';

const StatDivider = () => (
  <View className="w-px bg-foreground/10 my-4" />
);

const ProfileStatRow = ({
  stats,
  skeleton,
  itemCount,
  panelStyle,
  valueTextStyle,
  labelTextStyle,
}: ProfileStatRowProps) => {
  if (skeleton) {
    const count = itemCount ?? 3;
    return (
      <DropShadowBox>
        <Surface
          className="bg-surface-secondary overflow-hidden flex-row"
          style={panelStyle}
        >
          {Array.from({ length: count }).map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <StatDivider /> : null}
              <View className="flex-1 p-4">
                <ShimmerBar className="h-7 w-14 bg-surface-tertiary" isActive />
                <ShimmerBar
                  className="mt-1.5 h-3.5 w-12 bg-surface-tertiary"
                  isActive={false}
                />
              </View>
            </React.Fragment>
          ))}
        </Surface>
      </DropShadowBox>
    );
  }

  return (
    <DropShadowBox>
      <Surface
        className="bg-surface-secondary overflow-hidden flex-row"
        style={panelStyle}
      >
        {stats.map((stat, i) => (
          <React.Fragment key={stat.label}>
            {i > 0 ? <StatDivider /> : null}
            <Pressable
              onPress={stat.onPress}
              disabled={!stat.onPress}
              accessibilityRole={stat.onPress ? 'button' : undefined}
              className={`flex-1 p-4 ${stat.onPress ? 'active:opacity-75' : ''}`}
            >
              <Text
                className="tabular-nums text-2xl font-extrabold text-foreground"
                numberOfLines={1}
                minimumFontScale={0.7}
                allowFontScaling
                style={valueTextStyle}
              >
                {getStatValue(stat.value)}
              </Text>
              <Text
                className="mt-0.5 text-sm text-foreground/60"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={labelTextStyle}
              >
                {stat.label}
              </Text>
            </Pressable>
          </React.Fragment>
        ))}
      </Surface>
    </DropShadowBox>
  );
};

export default ProfileStatRow;
