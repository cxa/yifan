import { useMemo } from 'react';
import type { ViewStyle } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import {
  getTabBarBaseHeight,
  getTabBarHeight,
} from '@/navigation/tab-bar-layout';

export const TIMELINE_SPACING = 32;
export const TIMELINE_HORIZONTAL_PADDING = 24;

type TimelineContentStyle = ViewStyle & { gap?: number };

export type TimelineListSettings = {
  contentContainerStyle: TimelineContentStyle;
  scrollIndicatorInsets: { bottom: number };
  scrollEventThrottle: number;
};

export const useTimelineListSettings = (
  insets: EdgeInsets,
): TimelineListSettings =>
  useMemo(() => {
    const tabBarBaseHeight = getTabBarBaseHeight(insets.bottom);
    const tabBarHeight = getTabBarHeight(insets.bottom);

    return {
      contentContainerStyle: {
        paddingHorizontal: TIMELINE_HORIZONTAL_PADDING,
        paddingTop: insets.top,
        paddingBottom: tabBarHeight + TIMELINE_SPACING,
        gap: TIMELINE_SPACING,
      },
      scrollIndicatorInsets: {
        bottom: tabBarBaseHeight,
      },
      scrollEventThrottle: 16,
    };
  }, [insets.bottom, insets.top]);
