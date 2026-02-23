import React from 'react';
import { Pressable, View } from 'react-native';
import { Surface } from 'heroui-native';

import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';

export type ProfileStatItem = {
  label: string;
  value: string | number | null | undefined;
  onPress?: () => void;
};

type ProfileStatRowProps = {
  stats: ProfileStatItem[];
};

const getStatValue = (value: ProfileStatItem['value']) => value ?? '--';

const ProfileStatRow = ({ stats }: ProfileStatRowProps) => (
  <View className="flex-row gap-4">
    {stats.map(stat => (
      <DropShadowBox key={stat.label} containerClassName="flex-1">
        <Pressable
          onPress={stat.onPress}
          disabled={!stat.onPress}
          accessibilityRole={stat.onPress ? 'button' : undefined}
          className={
            stat.onPress
              ? 'active:translate-x-[-4px] active:translate-y-[4px]'
              : ''
          }
        >
          <Surface className="bg-surface border-2 border-foreground dark:border-border px-4 py-4">
            <Text
              className="text-2xl text-foreground"
              numberOfLines={1}
              minimumFontScale={0.7}
              allowFontScaling
            >
              {getStatValue(stat.value)}
            </Text>
            <Text className="mt-2 text-sm text-foreground" numberOfLines={1}>
              {stat.label}
            </Text>
          </Surface>
        </Pressable>
      </DropShadowBox>
    ))}
  </View>
);

export default ProfileStatRow;
