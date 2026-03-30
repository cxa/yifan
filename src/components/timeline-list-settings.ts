import { Platform } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';
import {
  getContentBottomPadding,
  getScrollIndicatorBottomInset,
} from '@/navigation/tab-bar-layout';
import {
  useReadableContentAnimatedItemStyle,
} from '@/navigation/readable-content-guide';
export const TIMELINE_SPACING = 16;
export const TIMELINE_HORIZONTAL_PADDING = 24;
export const TIMELINE_TOP_CONTENT_GAP = 16;
export const TIMELINE_INITIAL_PAGE_SIZE = 60;
export const TIMELINE_PAGE_SIZE = 20;
export const TIMELINE_AUTO_REFRESH_INTERVAL_MS = 60 * 1000;
export const TIMELINE_SCROLL_TOP_THRESHOLD = 12;
type TimelineContentStyle = ViewStyle & {
  gap?: number;
};
export type TimelineListSettings = {
  contentContainerStyle: TimelineContentStyle;
  scrollIndicatorInsets: {
    bottom: number;
  };
  scrollEventThrottle: number;
  // Animated padding style for Animated.View wrappers around each item,
  // ListHeaderComponent, ListFooterComponent, and ListEmptyComponent.
  // On iOS: always { paddingHorizontal: animLeft } — starts at 24 (iPhone default),
  // animates to the readable-content-guide inset on iPad after native module responds.
  // On Android: always {} (container carries paddingHorizontal instead).
  animatedItemStyle: AnimatedStyle<{ paddingHorizontal?: number }>;
};
const TIMELINE_STATUS_STACK_STYLE: StyleProp<ViewStyle> = {
  gap: TIMELINE_SPACING,
};
export const getTimelineStatusStackStyle = () => TIMELINE_STATUS_STACK_STYLE;
const TIMELINE_ITEM_SEPARATOR_STYLE: StyleProp<ViewStyle> = {
  height: TIMELINE_SPACING,
};
export const getTimelineItemSeparatorStyle = () =>
  TIMELINE_ITEM_SEPARATOR_STYLE;
type TimelineListSettingsOptions = {
  hasBottomTabBar?: boolean;
};
export const useTimelineListSettings = (
  insets: EdgeInsets,
  options?: TimelineListSettingsOptions,
): TimelineListSettings => {
  const animatedItemStyle = useReadableContentAnimatedItemStyle();
  const hasBottomTabBar = options?.hasBottomTabBar ?? true;
  const contentBottomPadding =
    getContentBottomPadding(insets.bottom, hasBottomTabBar) +
    TIMELINE_SPACING;
  const indicatorBottomInset = getScrollIndicatorBottomInset(
    insets.bottom,
    hasBottomTabBar,
  );
  // On iOS: no horizontal padding on the container — each item carries its own
  // paddingHorizontal via animatedItemStyle (a Reanimated SharedValue that starts
  // at 24 and smoothly animates to the readable-content-guide inset, eliminating
  // the first-render flash).  On Android animatedItemStyle returns {}, so the
  // container carries the standard paddingHorizontal instead.
  const contentContainerStyle: TimelineContentStyle = Platform.OS === 'ios'
    ? {
        paddingTop: insets.top,
        paddingBottom: contentBottomPadding,
        gap: TIMELINE_SPACING,
      }
    : {
        paddingHorizontal: TIMELINE_HORIZONTAL_PADDING,
        paddingTop: insets.top,
        paddingBottom: contentBottomPadding,
        gap: TIMELINE_SPACING,
      };
  return {
    contentContainerStyle,
    scrollIndicatorInsets: {
      bottom: indicatorBottomInset,
    },
    scrollEventThrottle: 16,
    animatedItemStyle,
  };
};
