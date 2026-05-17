import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeColor } from 'heroui-native';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import { ShimmerBar } from '@/components/timeline-skeleton-card';
import {
  CARD_BG_DARK,
  CARD_BG_LIGHT,
  CARD_PASTEL_CYCLE,
  PLAIN_CARD_BG_DARK,
  PLAIN_CARD_BG_LIGHT,
} from '@/components/drop-shadow-box';
import { APP_THEME_OPTION, useAppThemePreference } from '@/settings/app-theme-preference';
const AVATAR_SIZE = 44;
const UserSkeletonCard = ({ colorIndex = 0 }: { colorIndex?: number }) => {
  const isDark = useEffectiveIsDark();
  const themePreference = useAppThemePreference();
  const isPlain = themePreference === APP_THEME_OPTION.PLAIN;
  const [themeBorder] = useThemeColor(['border']);
  const shadowType = CARD_PASTEL_CYCLE[colorIndex % CARD_PASTEL_CYCLE.length];
  const cardBg = isPlain
    ? (isDark ? PLAIN_CARD_BG_DARK : PLAIN_CARD_BG_LIGHT)
    : (isDark ? CARD_BG_DARK : CARD_BG_LIGHT)[shadowType];
  const barColor = isPlain
    ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)')
    : undefined;
  const plainCardEdgeStyle = isPlain ? { borderColor: themeBorder } : null;
  // Randomly pick which bar shimmers: 0 = name bar, 1 = description bar
  const shimmerIndex = Math.floor(Math.random() * 2);
  return (
    <View
      style={[
        { backgroundColor: cardBg },
        styles.card,
        isPlain ? styles.plainCardEdge : null,
        plainCardEdgeStyle,
      ]}
      className="flex-row gap-3 rounded-3xl p-4"
    >
      <View
        className="rounded-full"
        style={[styles.avatar, { backgroundColor: barColor ?? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') }]}
      />
      <View className="flex-1 justify-center gap-2">
        <ShimmerBar
          className="h-3 w-28"
          barColor={barColor}
          isActive={shimmerIndex === 0}
        />
        <ShimmerBar
          className="h-3 w-full opacity-70"
          barColor={barColor}
          isActive={shimmerIndex === 1}
        />
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
  },
  plainCardEdge: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
});
export default UserSkeletonCard;
