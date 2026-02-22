export const TAB_BAR_HEIGHT_WITH_BOTTOM_INSET = 32;
export const TAB_BAR_HEIGHT_WITHOUT_BOTTOM_INSET = 49;

export const getTabBarBaseHeight = (bottomInset: number): number =>
  bottomInset > 0
    ? TAB_BAR_HEIGHT_WITH_BOTTOM_INSET
    : TAB_BAR_HEIGHT_WITHOUT_BOTTOM_INSET;

export const getTabBarHeight = (bottomInset: number): number =>
  getTabBarBaseHeight(bottomInset) + Math.max(bottomInset, 0);
