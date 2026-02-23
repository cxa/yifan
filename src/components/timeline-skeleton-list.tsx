import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import TimelineSkeletonCard from '@/components/timeline-skeleton-card';

const DEFAULT_TIMELINE_SKELETON_COUNT = 6;

type TimelineSkeletonListProps = {
  keyPrefix: string;
  count?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

const TimelineSkeletonList = ({
  keyPrefix,
  count = DEFAULT_TIMELINE_SKELETON_COUNT,
  className = 'gap-8',
  style,
}: TimelineSkeletonListProps) => (
  <View className={className} style={style}>
    {Array.from({ length: count }).map((_, index) => (
      <TimelineSkeletonCard
        key={`${keyPrefix}-${index}`}
        lineCount={index % 2 === 0 ? 2 : 3}
      />
    ))}
  </View>
);

export default TimelineSkeletonList;
