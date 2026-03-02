import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import {
  getTimelineStatusStackStyle,
  TIMELINE_SPACING,
} from '@/components/timeline-list-settings';

const DEFAULT_TIMELINE_SKELETON_COUNT = 6;

// Approximate rendered height of a TimelineSkeletonCard (including DropShadowBox
// shadow offset) averaged across 2-line and 3-line variants.
const SKELETON_CARD_APPROX_HEIGHT = 92;
const SKELETON_CARD_GAP = TIMELINE_SPACING;

export const countSkeletonItemsForHeight = (
  availableHeight: number,
  itemHeight: number,
  gap: number,
  fallback: number,
): number => {
  if (availableHeight <= 0) {
    return fallback;
  }
  // n items fill: n * itemHeight + (n - 1) * gap = availableHeight
  // n = (availableHeight + gap) / (itemHeight + gap)
  const count = Math.ceil((availableHeight + gap) / (itemHeight + gap));
  return Math.max(1, count);
};

type TimelineSkeletonListProps = {
  keyPrefix: string;
  count?: number;
  availableHeight?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

const TimelineSkeletonList = ({
  keyPrefix,
  count,
  availableHeight,
  className = '',
  style,
}: TimelineSkeletonListProps) => {
  const resolvedCount =
    count ??
    (availableHeight != null
      ? countSkeletonItemsForHeight(
          availableHeight,
          SKELETON_CARD_APPROX_HEIGHT,
          SKELETON_CARD_GAP,
          DEFAULT_TIMELINE_SKELETON_COUNT,
        )
      : DEFAULT_TIMELINE_SKELETON_COUNT);

  return (
    <View className={className} style={[getTimelineStatusStackStyle(), style]}>
      {Array.from({ length: resolvedCount }).map((_, index) => (
        <TimelineSkeletonCard
          key={`${keyPrefix}-${index}`}
          lineCount={index % 2 === 0 ? 2 : 3}
        />
      ))}
    </View>
  );
};

export default TimelineSkeletonList;
