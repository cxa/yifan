/** Height of each tab bar button (h-14 in Tailwind). */
export const TAB_BAR_BUTTON_HEIGHT = 56;

/** Neobrutalist shadow offset (translate-y-1). */
const TAB_BAR_SHADOW_OFFSET = 4;

/** Minimum gap between screen bottom edge and tab bar. */
export const TAB_BAR_MIN_BOTTOM_GAP = 16;

/**
 * The bottom offset applied to the tab bar container.
 * Matches `style={{ bottom: Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_GAP) }}`
 * in the AuthTabBar component.
 */
export const getTabBarBottomOffset = (bottomInset: number): number =>
  Math.max(bottomInset, TAB_BAR_MIN_BOTTOM_GAP);

/**
 * Visual height of the tab bar (button + shadow).
 * Used for scroll indicator insets relative to the tab bar itself.
 */
export const TAB_BAR_VISUAL_HEIGHT =
  TAB_BAR_BUTTON_HEIGHT + TAB_BAR_SHADOW_OFFSET;

/**
 * Total height obscured by the floating tab bar, measured from
 * the bottom of the screen. Content should pad by at least this much
 * to avoid being hidden behind the tab bar.
 */
export const getTabBarOccludedHeight = (bottomInset: number): number =>
  getTabBarBottomOffset(bottomInset) + TAB_BAR_VISUAL_HEIGHT;

/**
 * Bottom padding for scrollable content.
 * When the tab bar is visible, accounts for the full occluded area;
 * otherwise falls back to the safe area inset.
 */
export const getContentBottomPadding = (
  bottomInset: number,
  hasTabBar: boolean,
): number =>
  hasTabBar ? getTabBarOccludedHeight(bottomInset) : Math.max(bottomInset, 0);

/**
 * Scroll indicator bottom inset.
 * When the tab bar is visible, offsets by the bar's visual height;
 * otherwise falls back to the safe area inset.
 */
export const getScrollIndicatorBottomInset = (
  bottomInset: number,
  hasTabBar: boolean,
): number => (hasTabBar ? TAB_BAR_VISUAL_HEIGHT : Math.max(bottomInset, 0));
