import React from 'react';
import { Pressable, ScrollView, View, type TextStyle } from 'react-native';
import { Text } from '@/components/app-text';
import {
  CARD_BG_DARK,
  CARD_BG_LIGHT,
  type DropShadowBoxType,
} from '@/components/drop-shadow-box';
import {
  blendHexColors,
  isColorDark,
  resolveTextStylesForBackground,
} from '@/utils/profile-theme';

export type ProfileStat = {
  label: string;
  value: string | number | null | undefined;
  onPress: () => void;
};

type ProfileStatsRowProps = {
  stats: ProfileStat[];
  isDark: boolean;
  /**
   * Parent horizontal padding, in points. When set, the row bleeds out to the
   * screen edges by that amount so the last sticky gets clipped, hinting at
   * horizontal scrollability. Content still lines up with sibling rows.
   */
  edgePadding?: number;
  panelBackgroundColor?: string;
  primaryTextStyle?: TextStyle;
  mutedTextStyle?: TextStyle;
};

const STICKY_ROTATES = [
  { transform: [{ rotate: '-2deg' }] },
  { transform: [{ rotate: '1.5deg' }] },
  { transform: [{ rotate: '-1deg' }] },
  { transform: [{ rotate: '2deg' }] },
  { transform: [{ rotate: '-1.5deg' }] },
] as const;

const STICKY_TYPES: DropShadowBoxType[] = [
  'warning',
  'sky',
  'accent',
  'success',
  'danger',
];

const BASE_HORIZONTAL_PADDING = 2;
// Enough vertical padding for the rotated stickies' corners to clear the
// scroll viewport without being clipped. Caller should still provide the gap
// between this row and neighbouring content via its parent layout.
const CONTENT_VERTICAL_PADDING = 4;

const formatValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '--';
  if (typeof value === 'number') {
    try {
      return new Intl.NumberFormat().format(value);
    } catch {
      return String(value);
    }
  }
  return value;
};

const ProfileStatsRow = ({
  stats,
  isDark,
  edgePadding = 0,
  panelBackgroundColor,
  primaryTextStyle,
  mutedTextStyle,
}: ProfileStatsRowProps) => {
  const scrollStyle = { marginHorizontal: -edgePadding };
  const contentStyle = {
    gap: 8,
    paddingVertical: CONTENT_VERTICAL_PADDING,
    paddingHorizontal: edgePadding + BASE_HORIZONTAL_PADDING,
  };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={scrollStyle}
      contentContainerStyle={contentStyle}
    >
      {stats.map((stat, index) => {
        const type = STICKY_TYPES[index % STICKY_TYPES.length];
        const rotate = STICKY_ROTATES[index % STICKY_ROTATES.length];
        const pastel = (isDark ? CARD_BG_DARK : CARD_BG_LIGHT)[type];
        // Only blend pastel with the user's panel fill when they sit in the
        // same luminance zone. Mixing light pastel with a dark panel (or vice
        // versa) collapses the colour into muddy mid-grey.
        const panelIsDark = panelBackgroundColor
          ? isColorDark(panelBackgroundColor)
          : undefined;
        const shouldBlend =
          panelBackgroundColor !== undefined && panelIsDark === isDark;
        const pastelBlended =
          shouldBlend && panelBackgroundColor
            ? blendHexColors(pastel, panelBackgroundColor, 0.5)
            : pastel;
        const pressableStyle = { backgroundColor: pastelBlended };
        // The sticky sits on a pastel tile, not the panel fill the caller
        // tinted for. Re-tint against this specific pastel so numbers and
        // labels stay readable no matter which colour the tile landed on.
        const stickyTextStyles = resolveTextStylesForBackground(
          primaryTextStyle?.color as string | undefined,
          pastelBlended,
        );
        return (
          <View key={stat.label} style={rotate}>
            <Pressable
              onPress={stat.onPress}
              className="rounded-sm px-3 py-2 active:opacity-75"
              style={pressableStyle}
              accessibilityRole="button"
              accessibilityLabel={stat.label}
            >
              <Text
                className="text-[10px] uppercase tracking-normal font-bold text-foreground/70"
                style={stickyTextStyles.mutedTextStyle ?? mutedTextStyle}
                numberOfLines={1}
              >
                {stat.label}
              </Text>
              <Text
                className="mt-0.5 text-[20px] leading-[24px] font-extrabold tabular-nums text-foreground"
                style={stickyTextStyles.primaryTextStyle ?? primaryTextStyle}
                numberOfLines={1}
              >
                {formatValue(stat.value)}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
};

export default ProfileStatsRow;
