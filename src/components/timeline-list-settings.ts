import { useMemo } from 'react';
import type { ViewStyle } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import {
  getTabBarBaseHeight,
  getTabBarHeight,
} from '@/navigation/tab-bar-layout';

export const TIMELINE_SPACING = 32;
export const TIMELINE_HORIZONTAL_PADDING = 24;
export const TIMELINE_INITIAL_PAGE_SIZE = 60;
export const TIMELINE_PAGE_SIZE = 20;
export const TIMELINE_AUTO_REFRESH_INTERVAL_MS = 60 * 1000;
export const TIMELINE_SCROLL_TOP_THRESHOLD = 12;

type TimelineContentStyle = ViewStyle & { gap?: number };

export type TimelineListSettings = {
  contentContainerStyle: TimelineContentStyle;
  scrollIndicatorInsets: { bottom: number };
  scrollEventThrottle: number;
};

type TimelineListSettingsOptions = {
  hasBottomTabBar?: boolean;
};

export const useTimelineListSettings = (
  insets: EdgeInsets,
  options?: TimelineListSettingsOptions,
): TimelineListSettings =>
  useMemo(() => {
    const hasBottomTabBar = options?.hasBottomTabBar ?? true;
    const safeBottomInset = Math.max(insets.bottom, 0);
    const tabBarBaseHeight = getTabBarBaseHeight(insets.bottom);
    const tabBarHeight = getTabBarHeight(insets.bottom);
    const contentBottomPadding = hasBottomTabBar
      ? tabBarHeight + TIMELINE_SPACING
      : safeBottomInset + TIMELINE_SPACING;
    const indicatorBottomInset = hasBottomTabBar
      ? tabBarBaseHeight
      : safeBottomInset;

    return {
      contentContainerStyle: {
        paddingHorizontal: TIMELINE_HORIZONTAL_PADDING,
        paddingTop: insets.top,
        paddingBottom: contentBottomPadding,
        gap: TIMELINE_SPACING,
      },
      scrollIndicatorInsets: {
        bottom: indicatorBottomInset,
      },
      scrollEventThrottle: 16,
    };
  }, [insets.bottom, insets.top, options?.hasBottomTabBar]);
